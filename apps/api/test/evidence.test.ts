import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:workers';
import { todayInSite } from '@evo/shared';
import { call, login, json } from './helpers';
import { app } from '../src/index';
import { sniffMime, safeFilename } from '../src/events/sniff';

const T = todayInSite();
const add = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const d = (n: number) => add(T, n);
const MB = 1024 * 1024;

const bytes = (head: number[], size = 64) => { const u = new Uint8Array(size); u.set(head); return u; };
const JPEG = (size = 64) => bytes([0xff, 0xd8, 0xff, 0xe0], size);
const PNG = bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP = bytes([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const PDF = bytes([0x25, 0x50, 0x44, 0x46, 0x2d]);
const HEIC = bytes([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);
const EXE = bytes([0x4d, 0x5a, 0x90, 0x00]);

async function schedule(by: string, over: Record<string, unknown> = {}) {
  const s = { id: crypto.randomUUID(), frequency: 'Daily', start_date: d(-3), ...over };
  await env.DB.prepare('INSERT INTO event_schedules (id,title,frequency,start_date,created_by,created_at) VALUES (?,?,?,?,?,?)')
    .bind(s.id, 'Cek Saluran Inlet', s.frequency, s.start_date, by, new Date().toISOString()).run();
  return s.id;
}
const form = (data: Uint8Array, name = 'foto.jpg', type = 'image/jpeg') => { const f = new FormData(); f.append('file', new File([data], name, { type })); return f; };
const upload = (cookie: string, sid: string, date: string, f: FormData) => call(`/events/${sid}/${date}/evidence`, { method: 'POST', cookie, body: f });
const errOf = async (r: Response) => ((await r.json()) as any).error as string;
const count = async (sid: string) => (await env.DB.prepare('SELECT COUNT(*) n FROM evidences WHERE schedule_id = ?').bind(sid).first<any>()).n as number;
const complete = (cookie: string, sid: string, date: string) => call(`/events/${sid}/${date}/complete`, { method: 'POST', cookie });

describe('sniffMime and safeFilename', () => {
  it('recognises the allowed formats from content', () => {
    expect(sniffMime(JPEG())).toBe('image/jpeg');
    expect(sniffMime(PNG)).toBe('image/png');
    expect(sniffMime(WEBP)).toBe('image/webp');
    expect(sniffMime(PDF)).toBe('application/pdf');
    expect(sniffMime(HEIC)).toBe('image/heic');
  });
  it('rejects everything else', () => {
    expect(sniffMime(EXE)).toBeNull();
    expect(sniffMime(new TextEncoder().encode('hello world'))).toBeNull();
    expect(sniffMime(new Uint8Array(0))).toBeNull();
    expect(sniffMime(new Uint8Array([0xff]))).toBeNull();
  });
  it('strips paths, quotes and control characters; never empty; capped', () => {
    expect(safeFilename('a"b\r\nX-Evil: 1/../x.jpg')).toBe('x.jpg');
    expect(safeFilename('C:\\Users\\a\\foto.png')).toBe('foto.png');
    expect(safeFilename('   ')).toBe('berkas');
    expect(safeFilename('x'.repeat(300)).length).toBeLessThanOrEqual(100);
    expect(safeFilename('laporan "final".pdf')).toBe('laporan final.pdf');
  });
});

describe('upload', () => {
  it.each([['jpeg', JPEG(), 'image/jpeg'], ['png', PNG, 'image/png'], ['webp', WEBP, 'image/webp'], ['pdf', PDF, 'application/pdf'], ['heic', HEIC, 'image/heic']] as const)(
    'accepts %s and stores it in R2 with the sniffed type', async (_n, data, mime) => {
      const op = await login('Operator');
      const sid = await schedule(op.user.id);
      const res = await upload(op.cookie, sid, d(-1), form(data, 'berkas.bin', 'application/octet-stream'));
      expect(res.status).toBe(201);
      const out = (await res.json()) as any;
      expect(out).toMatchObject({ filename: 'berkas.bin', mime, size: data.length });
      const row = await env.DB.prepare('SELECT r2_key FROM evidences WHERE id = ?').bind(out.id).first<any>();
      const obj = await env.EVIDENCE.get(row.r2_key);
      expect(obj).not.toBeNull();
      expect(new Uint8Array(await obj!.arrayBuffer())).toEqual(data);
    });
  it('rejects an executable renamed .jpg even with an image content-type', async () => {
    const op = await login('Operator');
    const sid = await schedule(op.user.id);
    const res = await upload(op.cookie, sid, d(-1), form(EXE, 'a.jpg', 'image/jpeg'));
    expect(res.status).toBe(400);
    expect(await errOf(res)).toBe('Jenis berkas tidak didukung. Gunakan foto atau PDF.');
    expect(await count(sid)).toBe(0);
  });
  it('rejects plain text', async () => {
    const op = await login('Operator');
    const sid = await schedule(op.user.id);
    expect((await upload(op.cookie, sid, d(-1), form(new TextEncoder().encode('hello'), 'a.txt', 'text/plain'))).status).toBe(400);
  });
  it('rejects 10 MB + 1 byte, accepts exactly 10 MB', async () => {
    const op = await login('Operator');
    const sid = await schedule(op.user.id);
    const big = await upload(op.cookie, sid, d(-1), form(JPEG(10 * MB + 1)));
    expect(big.status).toBe(413);
    expect(await errOf(big)).toBe('Berkas terlalu besar. Maksimal 10 MB.');
    expect((await upload(op.cookie, sid, d(-1), form(JPEG(10 * MB)))).status).toBe(201);
  });
  it('rejects an empty file and a missing field', async () => {
    const op = await login('Operator');
    const sid = await schedule(op.user.id);
    expect((await upload(op.cookie, sid, d(-1), form(new Uint8Array(0)))).status).toBe(400);
    const none = new FormData();
    none.append('x', 'y');
    expect((await upload(op.cookie, sid, d(-1), none)).status).toBe(400);
  });
  it('a future due date is "belum waktunya"', async () => {
    const op = await login('Operator');
    const sid = await schedule(op.user.id, { start_date: d(5) });
    const res = await upload(op.cookie, sid, d(5), form(JPEG()));
    expect(res.status).toBe(409);
    expect(await errOf(res)).toBe('Event ini belum waktunya.');
  });
  it('a date that is not a due date is 404', async () => {
    const op = await login('Operator');
    const sid = await schedule(op.user.id, { frequency: 'Weekly', start_date: d(-14) });
    expect((await upload(op.cookie, sid, d(-10), form(JPEG()))).status).toBe(404);
  });
  it('today is allowed', async () => {
    const op = await login('Operator');
    const sid = await schedule(op.user.id);
    expect((await upload(op.cookie, sid, d(0), form(JPEG()))).status).toBe(201);
  });
  it('a finished event is locked', async () => {
    const op = await login('Operator');
    const sid = await schedule(op.user.id);
    await upload(op.cookie, sid, d(-1), form(JPEG()));
    expect((await complete(op.cookie, sid, d(-1))).status).toBe(200);
    const res = await upload(op.cookie, sid, d(-1), form(JPEG()));
    expect(res.status).toBe(409);
    expect(await errOf(res)).toBe('Event sudah selesai. Eviden tidak bisa diubah.');
  });
  it.each(['Manager', 'Auditor'] as const)('%s cannot upload', async (role) => {
    const op = await login('Operator');
    const sid = await schedule(op.user.id);
    const { cookie } = await login(role);
    const res = await upload(cookie, sid, d(-1), form(JPEG()));
    expect(res.status).toBe(403);
    expect(await errOf(res)).toBe('Hanya Operator atau Admin yang boleh mengerjakan event.');
  });
  it('admin can upload', async () => {
    const ad = await login('Admin');
    const sid = await schedule(ad.user.id);
    expect((await upload(ad.cookie, sid, d(-1), form(JPEG()))).status).toBe(201);
  });
  it('needs a session', async () => {
    const op = await login('Operator');
    const sid = await schedule(op.user.id);
    expect((await upload('', sid, d(-1), form(JPEG()))).status).toBe(401);
  });
  it('an upload racing a completion cannot slip in after it', async () => {
    const op = await login('Operator');
    const sid = await schedule(op.user.id);
    await upload(op.cookie, sid, d(-1), form(JPEG()));
    // The event gets completed by someone else right before our INSERT runs.
    const racing = new Proxy(env.DB, {
      get(t, p) {
        if (p !== 'prepare') { const v = (t as any)[p]; return typeof v === 'function' ? v.bind(t) : v; }
        return (sql: string) => {
          const stmt = t.prepare(sql);
          if (!sql.includes('INSERT INTO evidences')) return stmt;
          return new Proxy(stmt, {
            get(s, k) {
              if (k !== 'bind') { const v = (s as any)[k]; return typeof v === 'function' ? v.bind(s) : v; }
              return (...a: unknown[]) => {
                const bound = s.bind(...a);
                return new Proxy(bound, {
                  get(bs, bk) {
                    if (bk !== 'run') { const v = (bs as any)[bk]; return typeof v === 'function' ? v.bind(bs) : v; }
                    return async () => {
                      await t.prepare('INSERT INTO event_completions (schedule_id,due_date,completed_by,completed_at,completed_on) VALUES (?,?,?,?,?)')
                        .bind(sid, d(-1), op.user.id, new Date().toISOString(), T).run();
                      return bs.run();
                    };
                  },
                });
              };
            },
          });
        };
      },
    });
    const res = await app.request(`/api/events/${sid}/${d(-1)}/evidence`, { method: 'POST', headers: { cookie: op.cookie }, body: form(JPEG()) }, { DB: racing, EVIDENCE: env.EVIDENCE });
    expect(res.status).toBe(409);
    expect(await count(sid)).toBe(1);
  });
});

describe('delete evidence', () => {
  const mk = async () => {
    const op = await login('Operator');
    const sid = await schedule(op.user.id);
    const id = ((await (await upload(op.cookie, sid, d(-1), form(JPEG()))).json()) as any).id as string;
    const key = (await env.DB.prepare('SELECT r2_key FROM evidences WHERE id = ?').bind(id).first<any>()).r2_key as string;
    return { op, sid, id, key };
  };
  it('the uploader can delete, and the R2 object goes too', async () => {
    const { op, id, key } = await mk();
    expect((await call(`/evidence/${id}`, { method: 'DELETE', cookie: op.cookie })).status).toBe(200);
    expect(await env.EVIDENCE.get(key)).toBeNull();
  });
  it('admin can delete someone else\'s', async () => {
    const { id } = await mk();
    const ad = await login('Admin');
    expect((await call(`/evidence/${id}`, { method: 'DELETE', cookie: ad.cookie })).status).toBe(200);
  });
  it('another operator cannot', async () => {
    const { id } = await mk();
    const other = await (async () => {
      const { addUser } = await import('./helpers');
      const u = await addUser('Operator', 'op2@x.id');
      const res = await call('/auth/login', { method: 'POST', body: json({ email: u.email, password: u.password }) });
      return res.headers.get('set-cookie')!.split(';')[0];
    })();
    const res = await call(`/evidence/${id}`, { method: 'DELETE', cookie: other });
    expect(res.status).toBe(403);
  });
  it('manager cannot', async () => {
    const { id } = await mk();
    const m = await login('Manager');
    expect((await call(`/evidence/${id}`, { method: 'DELETE', cookie: m.cookie })).status).toBe(403);
  });
  it('after completion it is locked', async () => {
    const { op, sid, id } = await mk();
    await complete(op.cookie, sid, d(-1));
    const res = await call(`/evidence/${id}`, { method: 'DELETE', cookie: op.cookie });
    expect(res.status).toBe(409);
    expect(await errOf(res)).toBe('Event sudah selesai. Eviden tidak bisa diubah.');
  });
  it('unknown id is 404', async () => {
    const op = await login('Operator');
    expect((await call('/evidence/nope', { method: 'DELETE', cookie: op.cookie })).status).toBe(404);
  });
});

describe('complete', () => {
  it('needs at least one evidence', async () => {
    const op = await login('Operator');
    const sid = await schedule(op.user.id);
    const res = await complete(op.cookie, sid, d(-1));
    expect(res.status).toBe(409);
    expect(await errOf(res)).toBe('Unggah minimal satu eviden dulu.');
  });
  it('succeeds once, a second try is 409', async () => {
    const op = await login('Operator');
    const sid = await schedule(op.user.id);
    await upload(op.cookie, sid, d(0), form(JPEG()));
    const first = await complete(op.cookie, sid, d(0));
    expect(first.status).toBe(200);
    expect(((await first.json()) as any)).toMatchObject({ completed_on: T, late: false });
    const second = await complete(op.cookie, sid, d(0));
    expect(second.status).toBe(409);
    expect(await errOf(second)).toBe('Event ini sudah selesai.');
  });
  it('is late when finished after the due date', async () => {
    const op = await login('Operator');
    const sid = await schedule(op.user.id);
    await upload(op.cookie, sid, d(-2), form(JPEG()));
    expect(((await (await complete(op.cookie, sid, d(-2))).json()) as any).late).toBe(true);
  });
  it('a future event cannot be completed', async () => {
    const op = await login('Operator');
    const sid = await schedule(op.user.id, { start_date: d(5) });
    expect((await complete(op.cookie, sid, d(5))).status).toBe(409);
  });
  it('manager and auditor cannot', async () => {
    const op = await login('Operator');
    const sid = await schedule(op.user.id);
    await upload(op.cookie, sid, d(-1), form(JPEG()));
    for (const role of ['Manager', 'Auditor'] as const) {
      const { cookie } = await login(role);
      expect((await complete(cookie, sid, d(-1))).status).toBe(403);
    }
  });
  it('after it, the event reads as done', async () => {
    const op = await login('Operator');
    const sid = await schedule(op.user.id);
    await upload(op.cookie, sid, d(-1), form(JPEG()));
    await complete(op.cookie, sid, d(-1));
    const r = (await (await call(`/events/${sid}/${d(-1)}`, { cookie: op.cookie })).json()) as any;
    expect(r.event).toMatchObject({ status: 'done', completed_by_name: 'Operator User', evidence_count: 1 });
  });
  it('a stopped schedule can still finish its past overdue days', async () => {
    const op = await login('Operator');
    const sid = await schedule(op.user.id, { start_date: d(-5) });
    await env.DB.prepare('UPDATE event_schedules SET ended_on = ? WHERE id = ?').bind(d(-3), sid).run();
    await upload(op.cookie, sid, d(-4), form(JPEG()));
    expect((await complete(op.cookie, sid, d(-4))).status).toBe(200);
    expect((await upload(op.cookie, sid, d(-2), form(JPEG()))).status).toBe(404);
  });
});

describe('download', () => {
  const mk = async (data: Uint8Array, name: string, type: string) => {
    const op = await login('Operator');
    const sid = await schedule(op.user.id);
    const id = ((await (await upload(op.cookie, sid, d(-1), form(data, name, type))).json()) as any).id as string;
    return { id, opCookie: op.cookie };
  };
  it.each(['Auditor', 'Manager', 'Operator', 'Admin'] as const)('%s can download an image with its stored type', async (role) => {
    const { id, opCookie } = await mk(JPEG(), 'foto.jpg', 'image/jpeg');
    const cookie = role === 'Operator' ? opCookie : (await login(role)).cookie;
    const res = await call(`/evidence/${id}/file`, { cookie });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/jpeg');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(JPEG());
  });
  it('a PDF is served as an attachment', async () => {
    const { id } = await mk(PDF, 'laporan.pdf', 'application/pdf');
    const op = await login('Auditor');
    const res = await call(`/evidence/${id}/file`, { cookie: op.cookie });
    expect(res.headers.get('content-disposition')).toMatch(/^attachment;/);
  });
  it('a hostile stored file name cannot inject a header or break out of the quotes', async () => {
    const { id } = await mk(JPEG(), 'foto.jpg', 'image/jpeg');
    await env.DB.prepare('UPDATE evidences SET filename = ? WHERE id = ?').bind('a"b\r\nX-Evil: 1/../x\u00e9.jpg', id).run();
    const { cookie } = await login('Auditor');
    const res = await call(`/evidence/${id}/file`, { cookie });
    expect(res.status).toBe(200);
    const cd = res.headers.get('content-disposition')!;
    expect(cd).not.toMatch(/[\r\n]/);
    expect(res.headers.get('x-evil')).toBeNull();
    expect(cd).toContain('filename="x_.jpg"');
    expect(cd).toContain("filename*=UTF-8''x%C3%A9.jpg");
  });
  it('a row whose R2 object is gone is 404, not 500', async () => {
    const { id } = await mk(JPEG(), 'foto.jpg', 'image/jpeg');
    const key = (await env.DB.prepare('SELECT r2_key FROM evidences WHERE id = ?').bind(id).first<any>()).r2_key as string;
    await env.EVIDENCE.delete(key);
    const { cookie } = await login('Auditor');
    const res = await call(`/evidence/${id}/file`, { cookie });
    expect(res.status).toBe(404);
    expect(await errOf(res)).toBe('Berkas tidak ditemukan.');
  });
  it('unknown id is 404 and no session is 401', async () => {
    const { cookie } = await login('Auditor');
    expect((await call('/evidence/nope/file', { cookie })).status).toBe(404);
    expect((await call('/evidence/nope/file')).status).toBe(401);
  });
});
