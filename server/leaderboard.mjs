// Bang xep hang cuc bo (Ticket-04 muc 3). Luu tren dia: data/leaderboard.json (hoac $DDL_DATA_DIR).
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const NAME_RE = /^[A-Za-z0-9_]{3,12}$/;
export const TOP = 10;
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const dataFile = (dir = process.env.DDL_DATA_DIR ?? join(root, 'data')) => join(dir, 'leaderboard.json');

// Tra ve chuoi loi hoac null.
export function validateEntry(e) {
  if (!e || typeof e !== 'object') return 'entry phai la object';
  if (typeof e.name !== 'string' || !NAME_RE.test(e.name)) return 'ten phai 3-12 ky tu [A-Za-z0-9_]';
  if (!Number.isInteger(e.score) || e.score < 0) return 'score phai la so nguyen >= 0';
  if (!Number.isInteger(e.nights_won) || e.nights_won < 0 || e.nights_won > 3) return 'nights_won phai trong 0..3';
  if (!Number.isInteger(e.seed)) return 'seed phai la so nguyen';
  return null;
}

// Score giam dan; bang diem thi ai dat truoc dung tren (achieved_at tang dan, roi thu tu chen).
export function sortEntries(entries) {
  return entries
    .map((e, i) => [e, i])
    .sort(([a, i], [b, j]) => b.score - a.score || Date.parse(a.achieved_at) - Date.parse(b.achieved_at) || i - j)
    .map(([e]) => e)
    .slice(0, TOP);
}

export function makeEntry({ name, score, nights_won, seed }, now = new Date()) {
  return { name, score, nights_won, achieved_at: now.toISOString(), seed };
}

export function addEntry(entries, entry) {
  const next = sortEntries([...entries, entry]);
  return { entries: next, rank: next.includes(entry) ? next.indexOf(entry) + 1 : null };
}

export function loadEntries(file = dataFile()) {
  try {
    const d = JSON.parse(readFileSync(file, 'utf8'));
    return sortEntries(Array.isArray(d.entries) ? d.entries.filter((e) => !validateEntry(e) && !Number.isNaN(Date.parse(e.achieved_at))) : []);
  } catch {
    return [];
  }
}

export function saveEntries(entries, file = dataFile()) {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify({ entries }, null, 2) + '\n');
  renameSync(tmp, file); // ghi nguyen tu: tat giua chung khong lam hong file
}

export function exportLeaderboard(out, file = dataFile()) {
  writeFileSync(out, JSON.stringify({ entries: loadEntries(file) }, null, 2) + '\n');
}
