// Server tinh nho cho ban co giao dien: node server.mjs [port]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join, normalize, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.argv[2] ?? process.env.PORT ?? 8080);
const allowed = ['/web/', '/sim/', '/node_modules/three/', '/game.contract.json'];
const types = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json' };

createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
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
}).listen(port, () => console.log(`Dao Den Long: http://localhost:${port}`));
