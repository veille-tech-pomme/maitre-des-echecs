// Pilier 2 (cahier GOAT) : maîtrise par notion. BKT simplifié (Corbett & Anderson, 1995) + règles de maîtrise (F2.3) :
// « Maîtrisée » = probabilité ≥ seuil ET réussites du premier coup sur plusieurs positions distinctes ET une réussite
// après au moins un jour ET une réussite en contexte entrelacé (thème non annoncé). Un échec repasse à « Fragile ».
import { CONCEPT, type ConceptFamily, type ConceptId } from '../data/concepts';

export type Mastery = 'unseen' | 'learning' | 'fragile' | 'mastered';
export const MASTERY_LABEL: Record<Mastery, string> = { unseen: 'Pas vue', learning: 'En cours', fragile: 'Fragile', mastered: 'Maîtrisée' };
export interface ConceptState {
  /** probabilité de maîtrise (BKT) */ p: number;
  /** observations */ n: number;
  lastOk: number; lastFail: number;
  /** réussites du premier coup, sans indice, d'affilée */ firstTryStreak: number;
  /** positions distinctes réussies du premier coup (empreintes, 8 au plus) */ contexts: string[];
  /** jours distincts avec une réussite (aaaa-mm-jj, 6 au plus) */ days: string[];
  /** réussites en contexte entrelacé (fil, révision : thème non annoncé) */ inter: number;
  /** date à laquelle la notion est devenue « Maîtrisée » (absent si elle ne l'est pas ou plus) */ at?: number;
  /** a déjà été maîtrisée puis ratée */ fragile?: boolean;
  /** a déjà été maîtrisée au moins une fois (la célébration n'a lieu qu'à la première fois) */ ever?: boolean;
  /** 5 derniers résultats (1 réussite, 0 échec) pour la fiche */ last: number[];
}
/** Paramètres BKT par famille : p0 initiale, T apprentissage, G devinette, S inattention. À régler sur le banc simulé. */
export const BKT: Record<ConceptFamily, { p0: number; T: number; G: number; S: number }> = {
  rules: { p0: 0.3, T: 0.25, G: 0.25, S: 0.08 },
  tactics: { p0: 0.15, T: 0.15, G: 0.15, S: 0.1 },
  mates: { p0: 0.15, T: 0.18, G: 0.12, S: 0.1 },
  openings: { p0: 0.2, T: 0.15, G: 0.25, S: 0.1 },
  endgames: { p0: 0.1, T: 0.12, G: 0.15, S: 0.12 },
  strategy: { p0: 0.1, T: 0.1, G: 0.25, S: 0.15 },
};
export const MASTERY_P = 0.9, MASTERY_CONTEXTS = 3;
export interface Observation { ok: boolean; /** niveau d'indice utilisé (0 à 3) ; 3 ou la solution = échec pour la maîtrise */ hint?: number; firstTry?: boolean; ctx?: string; interleaved?: boolean; t?: number }
const DAY = 86400000;
const dayOf = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export function newConceptState(id: ConceptId): ConceptState { return { p: BKT[CONCEPT[id]?.family || 'tactics'].p0, n: 0, lastOk: 0, lastFail: 0, firstTryStreak: 0, contexts: [], days: [], inter: 0, last: [] }; }
/** Empreinte courte d'une position (contextes distincts). */
export function ctxKey(fen: string) { let h = 2166136261; const s = fen.split(' ').slice(0, 2).join(' '); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
export function masteryOf(c: ConceptState | undefined): Mastery {
  if (!c || !c.n) return 'unseen';
  if (c.at) return 'mastered';
  if (c.fragile) return 'fragile';
  return 'learning';
}
/** Conditions de F2.3 (sans l'état précédent). */
export function meetsMastery(c: ConceptState): boolean {
  const firstOkDay = c.days[0]; const later = c.days.some((d) => d !== firstOkDay);
  return c.p >= MASTERY_P && c.contexts.length >= MASTERY_CONTEXTS && later && c.inter >= 1;
}
/** Met à jour une notion. Renvoie la transition (« mastered » exactement quand elle passe à « Maîtrisée »). */
export function observeConcept(c: ConceptState, id: ConceptId, o: Observation): { c: ConceptState; became?: 'mastered' | 'fragile' } {
  const t = o.t ?? Date.now(); const prm = BKT[CONCEPT[id]?.family || 'tactics']; const n: ConceptState = { ...c, contexts: [...c.contexts], days: [...c.days], last: [...c.last] };
  const hint = o.hint ?? 0; const clean = o.ok && hint === 0 && o.firstTry !== false;
  // BKT : réussite avec indice = demi-preuve ; indice 3 ou solution = échec
  const correct = o.ok && hint < 3;
  const post = correct ? (n.p * (1 - prm.S)) / (n.p * (1 - prm.S) + (1 - n.p) * prm.G) : (n.p * prm.S) / (n.p * prm.S + (1 - n.p) * (1 - prm.G));
  const w = correct ? (hint === 0 ? 1 : hint === 1 ? 0.6 : 0.3) : 1;
  const pp = n.p + (post - n.p) * w; n.p = Math.min(0.999, Math.max(0.001, pp + (1 - pp) * prm.T * (correct ? w : 0.5)));
  n.n++; n.last = [...n.last, o.ok && hint < 3 ? 1 : 0].slice(-5);
  let became: 'mastered' | 'fragile' | undefined;
  if (o.ok && hint < 3) {
    n.lastOk = t; const d = dayOf(t); if (!n.days.includes(d)) n.days = [...n.days, d].slice(-6);
    if (clean) { n.firstTryStreak++; if (o.ctx && !n.contexts.includes(o.ctx)) n.contexts = [...n.contexts, o.ctx].slice(-8); if (o.interleaved) n.inter++; }
    if (!n.at && meetsMastery(n)) { n.at = t; n.fragile = false; became = 'mastered'; if (!c.ever) n.ever = true; }
  } else {
    n.lastFail = t; n.firstTryStreak = 0;
    if (n.at) { delete n.at; n.fragile = true; became = 'fragile'; }
    else if (n.fragile) n.fragile = true;
  }
  return { c: n, became };
}
/** Une phrase de preuve pour la fiche (« 4 réussites sur les 5 dernières, sur 3 positions différentes »). */
export function evidenceText(c: ConceptState | undefined): string {
  if (!c || !c.n) return 'Pas encore travaillée.';
  const ok = c.last.reduce((a, b) => a + b, 0);
  return `${ok} réussite${ok > 1 ? 's' : ''} sur ${c.last.length === 1 ? 'la dernière tentative' : `les ${c.last.length} dernières`}, sur ${c.contexts.length} position${c.contexts.length > 1 ? 's' : ''} différente${c.contexts.length > 1 ? 's' : ''} du premier coup.`;
}
/** Ce qui manque pour « Maîtrisée » (fiche de la notion). */
export function missingForMastery(c: ConceptState | undefined): string[] {
  if (!c) return ['Commence par une leçon ou un exercice.'];
  const out: string[] = [];
  if (c.contexts.length < MASTERY_CONTEXTS) out.push(`réussir du premier coup ${MASTERY_CONTEXTS - c.contexts.length} position${MASTERY_CONTEXTS - c.contexts.length > 1 ? 's' : ''} de plus`);
  if (!c.days.some((d) => d !== c.days[0])) out.push('réussir encore un autre jour');
  if (c.inter < 1) out.push('la reconnaître dans le fil, sans que le thème soit annoncé');
  if (c.p < MASTERY_P) out.push('confirmer par quelques réussites de plus');
  return out;
}
export { DAY };
