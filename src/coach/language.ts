// Couche de langage du coach. Par défaut : générateur local, déterministe et hors ligne (explain.ts).
// Interface prévue pour un modèle de langage optionnel (local ou distant) — AUCUNE clé ni service payant ici.
// Règle d'or : un fournisseur ne peut que reformuler les faits vérifiés (`facts`), jamais en ajouter.
import type { Explanation, Fact } from './explain';
import type { Level } from './explain';

export interface CoachLanguageContext { level: Level; tone?: 'neutral' | 'warm' | 'concise'; locale: 'fr' }
export interface CoachLanguage {
  readonly id: string;
  /** Disponible maintenant (ex. modèle téléchargé) ? */
  available(): Promise<boolean>;
  /** Reformule une explication. Doit conserver `facts`, `arrows`, `marks`, `tags` à l'identique. */
  rephrase(ex: Explanation, ctx: CoachLanguageContext): Promise<Explanation>;
  /** Réponse libre à une question, fondée uniquement sur les faits fournis. */
  answer?(question: string, facts: Fact[], ctx: CoachLanguageContext): Promise<string | null>;
}
/** Fournisseur local : renvoie le texte généré par les gabarits (aucun réseau). */
export const localLanguage: CoachLanguage = {
  id: 'local-templates',
  available: async () => true,
  rephrase: async (ex) => ex,
  answer: async () => null,
};
let current: CoachLanguage = localLanguage;
export const setCoachLanguage = (l: CoachLanguage) => { current = l; };
export const coachLanguage = () => current;
/** Garde-fou : si un fournisseur modifie les faits ou la structure, on revient au texte local. */
export async function phrase(ex: Explanation, ctx: CoachLanguageContext): Promise<Explanation> {
  if (current === localLanguage) return ex;
  try {
    if (!(await current.available())) return ex;
    const r = await current.rephrase(ex, ctx);
    const same = JSON.stringify(r.facts) === JSON.stringify(ex.facts) && JSON.stringify(r.tags) === JSON.stringify(ex.tags) && r.arrows.length === ex.arrows.length;
    return same && r.headline && r.why ? r : ex;
  } catch { return ex; }
}
