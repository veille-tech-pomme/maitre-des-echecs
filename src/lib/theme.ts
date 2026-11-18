// Apparence : thème clair/sombre, échiquier et jeu de pièces.
import { getState } from './store';
import { getEnt } from './entitlements';
export const BOARDS: { id: string; name: string; light: string; dark: string; premium?: boolean }[] = [
  { id: 'maitre', name: 'Maître (ardoise)', light: '#E9E2D0', dark: '#8A9FA8' },
  { id: 'vert', name: 'Tournoi (vert)', light: '#ebecd0', dark: '#739552' },
  { id: 'bois', name: 'Bois', light: '#f0d9b5', dark: '#b58863' },
  { id: 'bleu', name: 'Bleu', light: '#dee3e6', dark: '#8ca2ad' },
  { id: 'gris', name: 'Ardoise', light: '#d9d9d9', dark: '#8a8a8a' },
  { id: 'violet', name: 'Améthyste', light: '#e8e2f4', dark: '#8f7ac1', premium: true },
  { id: 'corail', name: 'Corail', light: '#f6e5d8', dark: '#d9826b', premium: true },
  { id: 'nuit', name: 'Nuit', light: '#a7b0c0', dark: '#4a5468', premium: true },
  { id: 'marbre', name: 'Marbre', light: '#f4f1ea', dark: '#9d9a93', premium: true },
];
export const PIECE_SETS: { id: string; name: string; premium?: boolean }[] = [
  { id: 'cburnett', name: 'Classique' }, { id: 'merida', name: 'Merida' },
  { id: 'chessnut', name: 'Chessnut', premium: true }, { id: 'fantasy', name: 'Fantasy', premium: true },
  { id: 'celtic', name: 'Celtique', premium: true }, { id: 'spatial', name: 'Spatial', premium: true },
];
const ROLES: [string, string][] = [['pawn', 'P'], ['knight', 'N'], ['bishop', 'B'], ['rook', 'R'], ['queen', 'Q'], ['king', 'K']];
export function applyAppearance() {
  const s = getState().settings;
  const dark = s.theme === 'dark' || (s.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.classList.toggle('reduce-motion', s.reduceMotion);
  const prem = getEnt().premium;
  const b = BOARDS.find((x) => x.id === s.board && (prem || !x.premium)) || BOARDS[0];
  document.documentElement.style.setProperty('--sq-light', b.light);
  document.documentElement.style.setProperty('--sq-dark', b.dark);
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#0B0C10' : '#F2F2F7');
  let st = document.getElementById('pieceset') as HTMLStyleElement | null;
  if (!st) { st = document.createElement('style'); st.id = 'pieceset'; document.head.appendChild(st); }
  const set = PIECE_SETS.find((x) => x.id === s.pieces && (prem || !x.premium))?.id || 'cburnett';
  const base = new URL('pieces/' + set + '/', document.baseURI).href;
  st.textContent = ROLES.map(([r, l]) => `.cg-wrap piece.${r}.white{background-image:url('${base}w${l}.svg')}.cg-wrap piece.${r}.black{background-image:url('${base}b${l}.svg')}`).join('');
}
