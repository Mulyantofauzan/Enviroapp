import { Hono } from 'hono';
import { isDueDate, isLate, isValidDate, todayInSite } from '@evo/shared';
import type { AppEnv } from '../types';
import { requireAuth, requireExecutor } from '../auth/guard';
import { safeFilename, sniffMime } from './sniff';

export const evidenceRoutes = new Hono<AppEnv>();

const MAX_BYTES = 10 * 1024 * 1024;
const FORM_OVERHEAD = 256 * 1024;

/** Reads a multipart body but stops as soon as it passes `max` bytes, whatever the headers claim. */
async function readFormLimited(req: Request, max: number): Promise<FormData | 'too_big' | null> {
  if (!req.body) return null;
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) { await reader.cancel(); return 'too_big'; }
    chunks.push(value);
  }
  return new Response(new Blob(chunks), { headers: { 'content-type': req.headers.get('content-type') ?? '' } }).formData().catch(() => null);
}
const LOCKED = 'Event sudah selesai. Eviden tidak bisa diubah.';
const NOT_YET = 'Event ini belum waktunya.';

type Sched = { id: string; frequency: any; start_date: string; ended_on: string | null };

/** Finds the schedule and checks the date is one of its due dates. */
async function findDue(db: D1Database, scheduleId: string, date: string): Promise<Sched | null> {
  const s = await db.prepare('SELECT id, frequency, start_date, ended_on FROM event_schedules WHERE id = ?').bind(scheduleId).first<Sched>();
  return s && isDueDate(s, date) ? s : null;
}

evidenceRoutes.post('/events/:scheduleId/:date/evidence', requireAuth, requireExecutor, async (c) => {
  const date = c.req.param('date');
  if (!isValidDate(date)) return c.json({ error: 'Tanggal harus berbentuk 2026-11-02.' }, 400);
  const db = c.env.DB;
  const s = await findDue(db, c.req.param('scheduleId'), date);
  if (!s) return c.json({ error: 'Event tidak ditemukan.' }, 404);
  if (date > todayInSite()) return c.json({ error: NOT_YET }, 409);
  const done = await db.prepare('SELECT 1 x FROM event_completions WHERE schedule_id = ? AND due_date = ?').bind(s.id, date).first();
  if (done) return c.json({ error: LOCKED }, 409);

  const tooBig = c.json({ error: 'Berkas terlalu besar. Maksimal 10 MB.' }, 413);
  const declared = Number(c.req.header('content-length') ?? 0);
  if (declared > MAX_BYTES + FORM_OVERHEAD) return tooBig;
  const form = await readFormLimited(c.req.raw, MAX_BYTES + FORM_OVERHEAD);
  if (form === 'too_big') return tooBig;
  const file = form?.get('file');
  if (!file || typeof file === 'string') return c.json({ error: 'Pilih berkas untuk diunggah.' }, 400);
  if (file.size === 0) return c.json({ error: 'Berkas kosong.' }, 400);
  if (file.size > MAX_BYTES) return tooBig;
  const data = new Uint8Array(await file.arrayBuffer());
  const mime = sniffMime(data);
  if (!mime) return c.json({ error: 'Jenis berkas tidak didukung. Gunakan foto atau PDF.' }, 400);

  const id = crypto.randomUUID();
  const key = `evidence/${s.id}/${date}/${id}`;
  const filename = safeFilename(file.name);
  await c.env.EVIDENCE.put(key, data, { httpMetadata: { contentType: mime } });
  // Written as one statement so an event completed a moment ago cannot receive a new file.
  const res = await db.prepare(
    `INSERT INTO evidences (id,schedule_id,due_date,r2_key,filename,mime,size,uploaded_by,uploaded_at)
     SELECT ?,?,?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM event_completions WHERE schedule_id = ? AND due_date = ?)`,
  ).bind(id, s.id, date, key, filename, mime, data.length, c.get('user').id, new Date().toISOString(), s.id, date).run();
  if (res.meta.changes === 0) {
    await c.env.EVIDENCE.delete(key);
    return c.json({ error: LOCKED }, 409);
  }
  return c.json({ id, filename, mime, size: data.length }, 201);
});

evidenceRoutes.delete('/evidence/:id', requireAuth, requireExecutor, async (c) => {
  const db = c.env.DB;
  const row = await db.prepare('SELECT id, r2_key, uploaded_by FROM evidences WHERE id = ?').bind(c.req.param('id')).first<{ id: string; r2_key: string; uploaded_by: string }>();
  if (!row) return c.json({ error: 'Eviden tidak ditemukan.' }, 404);
  const user = c.get('user');
  if (row.uploaded_by !== user.id && user.role !== 'Admin') return c.json({ error: 'Hanya pengunggah atau Admin yang boleh menghapus.' }, 403);
  const res = await db.prepare(
    `DELETE FROM evidences WHERE id = ? AND NOT EXISTS (SELECT 1 FROM event_completions c WHERE c.schedule_id = evidences.schedule_id AND c.due_date = evidences.due_date)`,
  ).bind(row.id).run();
  if (res.meta.changes === 0) return c.json({ error: LOCKED }, 409);
  await c.env.EVIDENCE.delete(row.r2_key);
  return c.json({ ok: true });
});

evidenceRoutes.get('/evidence/:id/file', requireAuth, async (c) => {
  const row = await c.env.DB.prepare('SELECT r2_key, filename, mime FROM evidences WHERE id = ?').bind(c.req.param('id')).first<{ r2_key: string; filename: string; mime: string }>();
  if (!row) return c.json({ error: 'Eviden tidak ditemukan.' }, 404);
  const obj = await c.env.EVIDENCE.get(row.r2_key);
  if (!obj) return c.json({ error: 'Berkas tidak ditemukan.' }, 404);
  const name = safeFilename(row.filename);
  const asciiName = name.replace(/[^\x20-\x7e]/g, '_').replace(/[\\"]/g, '');
  const kind = row.mime === 'application/pdf' ? 'attachment' : 'inline';
  return new Response(obj.body, {
    headers: {
      'content-type': row.mime,
      'content-length': String(obj.size),
      'content-disposition': `${kind}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      'x-content-type-options': 'nosniff',
      'cache-control': 'private, max-age=300',
    },
  });
});

evidenceRoutes.post('/events/:scheduleId/:date/complete', requireAuth, requireExecutor, async (c) => {
  const date = c.req.param('date');
  if (!isValidDate(date)) return c.json({ error: 'Tanggal harus berbentuk 2026-11-02.' }, 400);
  const db = c.env.DB;
  const s = await findDue(db, c.req.param('scheduleId'), date);
  if (!s) return c.json({ error: 'Event tidak ditemukan.' }, 404);
  const today = todayInSite();
  if (date > today) return c.json({ error: NOT_YET }, 409);
  const ALREADY = 'Event ini sudah selesai.';
  const exists = await db.prepare('SELECT 1 x FROM event_completions WHERE schedule_id = ? AND due_date = ?').bind(s.id, date).first();
  if (exists) return c.json({ error: ALREADY }, 409);
  const at = new Date().toISOString();
  try {
    const res = await db.prepare(
      `INSERT INTO event_completions (schedule_id,due_date,completed_by,completed_at,completed_on)
       SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM evidences WHERE schedule_id = ? AND due_date = ?)`,
    ).bind(s.id, date, c.get('user').id, at, today, s.id, date).run();
    if (res.meta.changes === 0) return c.json({ error: 'Unggah minimal satu eviden dulu.' }, 409);
  } catch {
    return c.json({ error: ALREADY }, 409); // two completions at once: the primary key lets only one through
  }
  return c.json({ completed_at: at, completed_on: today, late: isLate(date, today) });
});
