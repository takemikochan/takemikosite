import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import worker from './index';

const ALLOWED_ORIGIN = 'https://takemiko.com';

// schema.sql と同じ定義（テスト環境の Miniflare D1 はまっさらなので毎回作成する）
const SCHEMA = `
CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  ip TEXT,
  ua TEXT,
  created_at TEXT NOT NULL,
  delivery_status TEXT NOT NULL DEFAULT 'pending',
  delivery_attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);
`;

beforeAll(async () => {
  await env.DB.exec(SCHEMA.replace(/\n/g, ' '));
});

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request('https://form.takemiko.workers.dev/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ALLOWED_ORIGIN, ...headers },
    body: JSON.stringify(body),
  });
}

async function run(req: Request) {
  const ctx = createExecutionContext();
  const res = await worker.fetch(req, env, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

describe('contact worker', () => {
  it('rejects non-POST methods', async () => {
    const res = await run(new Request('https://form.takemiko.workers.dev/', { method: 'GET' }));
    expect(res.status).toBe(405);
  });

  it('rejects requests from a disallowed origin', async () => {
    const res = await run(
      post(
        { name: 'a', email: 'a@b.com', subject: 's', message: 'm', token: 'dummy' },
        { Origin: 'https://evil.example.com' },
      ),
    );
    expect(res.status).toBe(403);
    expect((await res.json()) as { error: string }).toMatchObject({ error: 'forbidden_origin' });
  });

  it('rejects malformed JSON', async () => {
    const req = new Request('https://form.takemiko.workers.dev/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ALLOWED_ORIGIN },
      body: '{not json',
    });
    const res = await run(req);
    expect(res.status).toBe(400);
  });

  it('rejects input missing required fields', async () => {
    const res = await run(post({ name: 'a' }));
    expect(res.status).toBe(400);
    expect((await res.json()) as { error: string }).toMatchObject({ error: 'invalid_input' });
  });

  it('rejects unknown extra fields (strict schema)', async () => {
    const res = await run(
      post({
        name: 'a',
        email: 'a@b.com',
        subject: 's',
        message: 'm',
        token: 'dummy',
        extra: 'should not be allowed',
      }),
    );
    expect(res.status).toBe(400);
  });

  it('rejects an oversized declared Content-Length without reading the body', async () => {
    const res = await run(
      post(
        { name: 'a', email: 'a@b.com', subject: 's', message: 'm', token: 'dummy' },
        { 'Content-Length': '999999' },
      ),
    );
    expect(res.status).toBe(413);
  });

  it('pretends success on a honeypot submission without saving to D1', async () => {
    const before = await env.DB.prepare('SELECT COUNT(*) as count FROM submissions').first<{
      count: number;
    }>();

    const res = await run(
      post({
        name: 'bot',
        email: 'bot@example.com',
        subject: 's',
        message: 'm',
        token: 'dummy',
        website: 'http://spam.example.com',
      }),
    );

    expect(res.status).toBe(200);
    expect((await res.json()) as { ok: boolean }).toMatchObject({ ok: true });

    const after = await env.DB.prepare('SELECT COUNT(*) as count FROM submissions').first<{
      count: number;
    }>();
    expect(after?.count).toBe(before?.count ?? 0);
  });
});
