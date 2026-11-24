// ULID (https://github.com/ulid/spec) : 48 bits de temps + 80 bits aléatoires, encodés en Crockford base 32.
// Sert d'identifiant d'installation (R4a, plan §6.1) et d'identifiant d'évènement : triable dans le temps,
// unique sans serveur. AUCUNE donnée de l'appareil n'entre dans le calcul (ce n'est pas une empreinte).
const ENC = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
let lastT = -1; let lastR: number[] = [];
function rand80(): number[] {
  const b = new Uint8Array(10); globalThis.crypto.getRandomValues(b);
  // 80 bits → 16 chiffres base 32
  const out: number[] = []; let acc = 0, bits = 0;
  for (const x of b) { acc = (acc << 8) | x; bits += 8; while (bits >= 5) { bits -= 5; out.push((acc >> bits) & 31); } acc &= (1 << bits) - 1; }
  return out;
}
/** ULID monotone : deux appels dans la même milliseconde restent ordonnés (incrément de la partie aléatoire). */
export function ulid(t = Date.now()): string {
  let r: number[];
  if (t === lastT) { r = lastR.slice(); for (let i = r.length - 1; i >= 0; i--) { if (r[i] < 31) { r[i]++; break; } r[i] = 0; } }
  else { r = rand80(); lastT = t; }
  lastR = r;
  let ts = ''; let x = t; for (let i = 0; i < 10; i++) { ts = ENC[x % 32] + ts; x = Math.floor(x / 32); }
  return ts + r.map((i) => ENC[i]).join('');
}
export const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;
/** instant (ms) encodé dans un ULID */
export function ulidTime(id: string): number { let t = 0; for (const c of id.slice(0, 10)) t = t * 32 + ENC.indexOf(c); return t; }
