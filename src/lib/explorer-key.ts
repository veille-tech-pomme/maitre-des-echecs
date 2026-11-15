// Clé de position partagée par l'outil de construction et l'app : 4 premiers champs FEN
// (pièces, trait, roques, en passant) → deux hachages FNV-1a 32 bits indépendants (64 bits au total).
export const EXPLORER_SHARDS = 512;
export function posKey(fen: string): string { return fen.split(' ').slice(0, 4).join(' '); }
export function hashKey(key: string): [number, number] {
  let a = 0x811c9dc5, b = 0x050c5d1f;
  for (let i = 0; i < key.length; i++) {
    const c = key.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b ^ c, 0x01000193) ^ (b >>> 15);
  }
  return [a >>> 0, b >>> 0];
}
/** Identifiant compact (base 36) et numéro de fragment d'une position. */
export function posId(fen: string): { id: string; shard: number } {
  const [a, b] = hashKey(posKey(fen));
  return { id: a.toString(36) + '.' + b.toString(36), shard: a % EXPLORER_SHARDS };
}
