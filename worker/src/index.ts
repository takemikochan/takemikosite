import { z } from 'zod';

export interface Env {
  DB: D1Database;
  ALLOWED_ORIGIN: string;
  TURNSTILE_SECRET: string;
  RESEND_API_KEY: string;
  CONTACT_NOTIFY_EMAIL: string;
}

const ContactSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(200),
  subject: z.string().min(1).max(120),
  message: z.string().min(1).max(4000),
  token: z.string().min(1),
  website: z.string().optional(), // ハニーポット。人間には見えないフィールド
});
type ContactInput = z.infer<typeof ContactSchema>;

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
  async fetch(req: Request, env: Env): Promise<Response> {
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
        remoteip: req.headers.get('CF-Connecting-IP') ?? '',
      }),
    });
    const verify = await verifyRes.json<{ success: boolean }>();
    if (!verify.success) {
      return json({ ok: false, error: 'verification_failed' }, 400, env.ALLOWED_ORIGIN);
    }

    // 取りこぼし防止：通知メールが後で失敗しても問い合わせ自体はここで確定させる
    await env.DB.prepare(
      `INSERT INTO submissions (id, name, email, subject, message, ip, ua, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        crypto.randomUUID(),
        input.name,
        input.email,
        input.subject,
        input.message,
        req.headers.get('CF-Connecting-IP') ?? '',
        req.headers.get('User-Agent') ?? '',
        new Date().toISOString(),
      )
      .run();

    await deliver(input, env);

    return json({ ok: true }, 200, env.ALLOWED_ORIGIN);
  },
};

// CRM が決まったらこの関数だけ差し替える（疎結合の実体）
async function deliver(input: ContactInput, env: Env): Promise<void> {
  try {
    await fetch('https://api.resend.com/emails', {
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
  } catch (err) {
    // メール通知が失敗してもD1には保存済みなので、問い合わせ自体は失われない
    console.error('[deliver] notification email failed', err);
  }
}
