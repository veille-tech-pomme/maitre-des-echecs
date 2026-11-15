// Étape 1 : extrait des PGN Lichess Broadcast (CC0, parties OTB retransmises) les parties standard
// entre joueurs classés (≥ MIN Elo FIDE chacun) → tools/data/elite.jsonl (une partie par ligne).
import fs from 'node:fs'; import zlib from 'node:zlib'; import readline from 'node:readline';
const DIR = 'tools/data/bcast'; const MIN = +(process.env.MIN || 2000);
const out = fs.createWriteStream('tools/data/elite.jsonl');
const seen = new Set(); let kept = 0, total = 0, dup = 0;
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.zst')).sort();
function strip(mt) {
  return mt.replace(/\{[^}]*\}/g, ' ').replace(/\([^()]*\)/g, ' ').replace(/\([^()]*\)/g, ' ').replace(/\$\d+/g, ' ')
    .replace(/\d+\.(\.\.)?/g, ' ').replace(/(1-0|0-1|1\/2-1\/2|\*)\s*$/, ' ').replace(/[?!]+/g, '').trim().split(/\s+/).filter(Boolean);
}
for (const f of files) {
  const rl = readline.createInterface({ input: fs.createReadStream(`${DIR}/${f}`).pipe(zlib.createZstdDecompress()), crlfDelay: Infinity });
  let h = {}, mt = [];
  const flush = () => {
    if (!h.Result) { h = {}; mt = []; return; }
    total++;
    const we = +h.WhiteElo || 0, be = +h.BlackElo || 0, res = h.Result;
    const ok = we >= MIN && be >= MIN && (!h.Variant || h.Variant === 'Standard') && !h.FEN && ['1-0', '0-1', '1/2-1/2'].includes(res);
    if (ok) {
      const mv = strip(mt.join(' '));
      if (mv.length >= 10) {
        const key = `${h.White}|${h.Black}|${mv.slice(0, 60).join(' ')}`;
        if (seen.has(key)) dup++; else {
          seen.add(key); kept++;
          out.write(JSON.stringify({ w: h.White, b: h.Black, we, be, r: res === '1-0' ? 1 : res === '0-1' ? 0 : 0.5, y: (h.Date || h.UTCDate || '').slice(0, 10), e: h.BroadcastName || h.Event || '', tc: h.TimeControl || '', u: h.GameURL || h.Site || '', m: mv.join(' ') }) + '\n');
        }
      }
    }
    h = {}; mt = [];
  };
  for await (const line of rl) {
    if (line.startsWith('[')) { if (mt.length) flush(); const m = /^\[(\w+) "(.*)"\]$/.exec(line); if (m) h[m[1]] = m[2]; }
    else if (line.trim()) mt.push(line);
  }
  flush();
  console.log(f, 'total', total, 'gardées', kept, 'doublons', dup);
}
out.end();
