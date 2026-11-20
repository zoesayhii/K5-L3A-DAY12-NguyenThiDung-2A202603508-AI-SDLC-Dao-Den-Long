// Chay game: node server.mjs [port]   (mac dinh 8080)
// Xuat bang xep hang: node server.mjs --export-leaderboard out.json
import { createApp } from './server/app.mjs';
import { exportLeaderboard } from './server/leaderboard.mjs';

const args = process.argv.slice(2);
const exp = args.indexOf('--export-leaderboard');
if (exp >= 0) {
  const out = args[exp + 1];
  if (!out) {
    process.stderr.write('Dung: node server.mjs --export-leaderboard <out.json>\n');
    process.exit(1);
  }
  exportLeaderboard(out);
  process.exit(0);
}
const portArg = args.find((a) => /^\d+$/.test(a)) ?? process.env.PORT ?? 8080;
createApp().listen(Number(portArg), () => console.log(`Dao Den Long: http://localhost:${portArg}`));
