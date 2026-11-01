// Usage: npx tsx apps/api/scripts/seed-admin.ts you@x.id 'password' [--remote]
// Prints SQL and runs it with: wrangler d1 execute evo [--remote] --command "<sql>"
import { execFileSync } from 'node:child_process';
import { pbkdf2Sync, randomBytes, randomUUID } from 'node:crypto';

const [email, password, flag] = process.argv.slice(2);
if (!email || !password) { console.error('Usage: seed-admin.ts <email> <password> [--remote]'); process.exit(1); }
const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, 100_000, 32, 'sha256').toString('hex');
const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const sql = `INSERT INTO users (id,name,email,password_hash,role) VALUES (${q(randomUUID())},'Admin',${q(email.toLowerCase())},${q(`${salt.toString('hex')}$${hash}`)},'Admin');`;
execFileSync('npx', ['wrangler', 'd1', 'execute', 'evo', flag === '--remote' ? '--remote' : '--local', '--command', sql], { stdio: 'inherit', cwd: new URL('..', import.meta.url).pathname });
