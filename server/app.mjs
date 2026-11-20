// Server tinh + API bang xep hang (+ kenh ket qua benchmark). Dung chung cho server.mjs va bench/run.mjs.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join, normalize, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateEntry, makeEntry, addEntry, loadEntries, saveEntries, dataFile } from './leaderboard.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const allowed = ['/web/', '/sim/', '/node_modules/three/', '/game.contract.json'];
const types = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json' };

function readBody(req, max = 8192) {
  return new Promise((resolve, reject) => {
    let n = 0;
    const chunks = [];
    req.on('data', (c) => {
      n += c.length;
      if (n > max) {
        reject(new Error('body qua lon'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
const json = (res, code, obj) => res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(JSON.stringify(obj));

// onBench(type, payload): benchmark runner nhan su kien tu trang (start / measure / result)
export function createApp({ dataDir, onBench } = {}) {
  const file = dataFile(dataDir);
  return createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    let p = decodeURIComponent(url.pathname);
    try {
      if (p === '/api/leaderboard' && req.method === 'GET') return json(res, 200, { entries: loadEntries(file) });
      if (p === '/api/leaderboard' && req.method === 'POST') {
        const body = JSON.parse(await readBody(req));
        const err = validateEntry({ ...body, achieved_at: undefined });
        if (err) return json(res, 400, { error: err });
        const entry = makeEntry(body);
        const { entries, rank } = addEntry(loadEntries(file), entry);
        saveEntries(entries, file);
        return json(res, 200, { entries, rank });
      }
      if (p.startsWith('/api/bench/') && req.method === 'POST' && onBench) {
        const body = (await readBody(req, 1 << 20)) || '{}';
        onBench(p.slice('/api/bench/'.length), JSON.parse(body));
        return json(res, 200, { ok: true });
      }
    } catch (e) {
      return json(res, 400, { error: String(e.message ?? e) });
    }
    if (p === '/') p = '/web/index.html';
    p = normalize(p);
    if (!allowed.some((a) => p === a || p.startsWith(a)) || p.includes('..')) {
      res.writeHead(404).end('not found');
      return;
    }
    try {
      const data = await readFile(join(root, p));
      res.writeHead(200, { 'content-type': types[extname(p)] ?? 'application/octet-stream' }).end(data);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
}
