import { z } from 'zod';

export interface Env {
  DB: D1Database;
  ALLOWED_ORIGIN: string;
  TURNSTILE_SECRET: string;
  RESEND_API_KEY: string;
  CONTACT_NOTIFY_EMAIL: string;
}

const ContactSchema = z
  .object({
    name: z.string().min(1).max(100),
    email: z.string().email().max(200),
    subject: z.string().min(1).max(120),
    message: z.string().min(1).max(4000),
    token: z.string().min(1),
    website: z.string().optional(), // ハニーポット。人間には見えないフィールド
  })
  .strict(); // 未知フィールドは拒否（不要な巨大ペイロードでのパース負荷対策）

const MAX_BODY_BYTES = 20_000; // name/email/subject/messageの上限を踏まえた十分な余裕
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10分
const RATE_LIMIT_MAX = 5; // 同一IPからの許容送信数
const RETENTION_DAYS = 180; // §PRIV-01: この日数を過ぎた問い合わせは scheduled() で自動削除する

function json(body: unknown, status: number, origin: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': origin,
    },
  });
}

export default {
  async fetch(req: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }
    if (req.method !== 'POST') {
      return json({ ok: false, error: 'method_not_allowed' }, 405, env.ALLOWED_ORIGIN);
    }
    if (req.headers.get('Origin') !== env.ALLOWED_ORIGIN) {
      return json({ ok: false, error: 'forbidden_origin' }, 403, env.ALLOWED_ORIGIN);
    }

    // Content-Length を先に確認し、巨大なボディのパースを避ける
    const contentLength = Number(req.headers.get('Content-Length') ?? '0');
    if (contentLength > MAX_BODY_BYTES) {
      return json({ ok: false, error: 'payload_too_large' }, 413, env.ALLOWED_ORIGIN);
    }

    const ip = req.headers.get('CF-Connecting-IP') ?? '';

    // レート制限：同一IPからの短時間の大量送信を拒否する
    if (ip) {
      const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
      const { results } = await env.DB.prepare(
        'SELECT COUNT(*) as count FROM submissions WHERE ip = ? AND created_at > ?',
      )
        .bind(ip, since)
        .all<{ count: number }>();
      if ((results?.[0]?.count ?? 0) >= RATE_LIMIT_MAX) {
        return json({ ok: false, error: 'rate_limited' }, 429, env.ALLOWED_ORIGIN);
      }
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return json({ ok: false, error: 'invalid_json' }, 400, env.ALLOWED_ORIGIN);
    }

    const parsed = ContactSchema.safeParse(rawBody);
    if (!parsed.success) {
      return json({ ok: false, error: 'invalid_input' }, 400, env.ALLOWED_ORIGIN);
    }
    const input = parsed.data;

    // ハニーポットが埋まっていればボット。成功を装って黙って破棄する
    if (input.website) {
      return json({ ok: true }, 200, env.ALLOWED_ORIGIN);
    }

    const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET,
        response: input.token,
        remoteip: ip,
      }),
    });
    const verify = await verifyRes.json<{ success: boolean; hostname?: string; action?: string }>();
    const expectedHostname = new URL(env.ALLOWED_ORIGIN).hostname;
    if (!verify.success || verify.hostname !== expectedHostname || verify.action !== 'contact') {
      return json({ ok: false, error: 'verification_failed' }, 400, env.ALLOWED_ORIGIN);
    }

    // 取りこぼし防止：通知メールが後で失敗しても問い合わせ自体はここで確定させる
    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO submissions (id, name, email, subject, message, ip, ua, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        input.name,
        input.email,
        input.subject,
        input.message,
        ip,
        req.headers.get('User-Agent') ?? '',
        new Date().toISOString(),
      )
      .run();

    await deliver(
      { id, name: input.name, email: input.email, subject: input.subject, message: input.message },
      env,
    );

    return json({ ok: true }, 200, env.ALLOWED_ORIGIN);
  },

  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    // §PRIV-01: 保持期間（RETENTION_DAYS）を過ぎた問い合わせデータを削除する
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    await env.DB.prepare('DELETE FROM submissions WHERE created_at < ?').bind(cutoff).run();

    // §REL-01: 通知メール送信が失敗した分を再送する（直近24時間・5回まで）
    const retryWindow = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { results } = await env.DB.prepare(
      `SELECT id, name, email, subject, message FROM submissions
       WHERE delivery_status = 'failed' AND delivery_attempts < 5 AND created_at > ?
       LIMIT 20`,
    )
      .bind(retryWindow)
      .all<DeliveryInput>();
    for (const row of results ?? []) {
      await deliver(row, env);
    }
  },
};

interface DeliveryInput {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
}

// CRM が決まったらこの関数だけ差し替える（疎結合の実体）。
// §REL-01: 送達状況をD1に記録し、失敗時は scheduled() から再送できるようにする。
async function deliver(input: DeliveryInput, env: Env): Promise<void> {
  const { id } = input;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'たけみこ公式サイト <onboarding@resend.dev>',
        to: env.CONTACT_NOTIFY_EMAIL,
        reply_to: input.email,
        subject: `[お問い合わせ] ${input.subject}`,
        text: `お名前: ${input.name}\nメール: ${input.email}\n\n${input.message}`,
      }),
    });

    if (res.ok) {
      await env.DB.prepare(
        `UPDATE submissions SET delivery_status = 'sent', delivery_attempts = delivery_attempts + 1 WHERE id = ?`,
      )
        .bind(id)
        .run();
    } else {
      const body = await res.text();
      console.error('[deliver] resend returned non-ok status', res.status, body);
      await env.DB.prepare(
        `UPDATE submissions SET delivery_status = 'failed', delivery_attempts = delivery_attempts + 1, last_error = ? WHERE id = ?`,
      )
        .bind(`HTTP ${res.status}: ${body.slice(0, 500)}`, id)
        .run();
    }
  } catch (err) {
    // メール通知が失敗してもD1には保存済みなので、問い合わせ自体は失われない（scheduled()で再送を試みる）
    console.error('[deliver] notification email failed', err);
    await env.DB.prepare(
      `UPDATE submissions SET delivery_status = 'failed', delivery_attempts = delivery_attempts + 1, last_error = ? WHERE id = ?`,
    )
      .bind(String(err).slice(0, 500), id)
      .run();
  }
}
