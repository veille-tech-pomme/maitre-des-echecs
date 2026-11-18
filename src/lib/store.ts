// État persistant de l'application (localStorage), avec abonnement réactif.
import { useEffect, useState } from 'preact/hooks';
import type { SrsItem } from './srs';

export type ThemeMode = 'auto' | 'dark' | 'light';
export interface Settings {
  theme: ThemeMode; board: string; pieces: string; sound: boolean; coords: boolean; animation: boolean;
  showLegal: boolean; autoQueen: boolean; coachInPlay: boolean; reduceMotion: boolean; boardSize: number; name: string;
}
export interface GameRecord {
  id: string; date: number; botId: string; color: 'w' | 'b'; result: '1-0' | '0-1' | '1/2-1/2' | '*';
  pgn: string; moves: string[]; reviewed?: boolean; accuracy?: number;
  counts?: Record<string, number>; weaknesses?: string[]; phaseAcc?: { opening?: number; middlegame?: number; endgame?: number };
}
export interface ThemeStat { ok: number; ko: number }
export interface State {
  v: number;
  createdAt: number;
  xp: number;
  streak: { count: number; best: number; last: string };
  activity: Record<string, number>; // date -> xp gagné
  lessons: Record<string, { done: boolean; stars: number; step: number; best?: number }>;
  puzzle: { rating: number; games: number; history: { t: number; r: number }[]; solved: number; failed: number; seen: string[]; streak: number; bestStreak: number };
  themes: Record<string, ThemeStat>;
  daily: Record<string, boolean>;
  rush: { best3: number; best5: number; survival: number; runs: number };
  srs: Record<string, SrsItem>;
  games: GameRecord[];
  reviews: { date: string; count: number };
  badges: Record<string, number>;
  openings: Record<string, { ok: number; ko: number; last: number }>;
  repertoire: { id: string; name: string; color: 'w' | 'b'; moves: string[] }[];
  endgames: Record<string, { done: boolean; best?: number }>;
  plan: { date: string; done: string[] };
  settings: Settings;
  onboarded: boolean;
  trial?: { startedAt: number; endsAt: number; reminded?: boolean };
  /** Modes d'entraînement : duel, parcours de puzzles, coordonnées, mémoire, devine le coup, mats… */
  training: Record<string, any>;
}
const KEY = 'echecs-app-v1';
export const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export function defaultState(): State {
  return {
    v: 1, createdAt: Date.now(), xp: 0, streak: { count: 0, best: 0, last: '' }, activity: {}, lessons: {},
    puzzle: { rating: 800, games: 0, history: [], solved: 0, failed: 0, seen: [], streak: 0, bestStreak: 0 },
    themes: {}, daily: {}, rush: { best3: 0, best5: 0, survival: 0, runs: 0 }, srs: {}, games: [], reviews: { date: '', count: 0 },
    badges: {}, openings: {}, repertoire: [], endgames: {}, plan: { date: '', done: [] },
    settings: { theme: 'auto', board: 'maitre', pieces: 'cburnett', sound: true, coords: true, animation: true, showLegal: true, autoQueen: false, coachInPlay: true, reduceMotion: false, boardSize: 100, name: '' },
    onboarded: false, training: {},
  };
}
function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const s = JSON.parse(raw);
    const d = defaultState();
    return { ...d, ...s, settings: { ...d.settings, ...(s.settings || {}) }, puzzle: { ...d.puzzle, ...(s.puzzle || {}) }, rush: { ...d.rush, ...(s.rush || {}) } };
  } catch { return defaultState(); }
}
let state: State = typeof localStorage !== 'undefined' ? load() : defaultState();
const subs = new Set<() => void>();
let saveTimer: any = null;
export function getState() { return state; }
export function setState(fn: (s: State) => void) {
  const next = structuredClone(state); fn(next); state = next;
  subs.forEach((f) => f());
  if (typeof localStorage !== 'undefined') { clearTimeout(saveTimer); saveTimer = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} }, 150); }
}
export function replaceState(s: State) { state = s; subs.forEach((f) => f()); try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} }
export function subscribe(f: () => void) { subs.add(f); return () => subs.delete(f); }
export function useStore<T>(sel: (s: State) => T): T {
  const [, force] = useState(0);
  useEffect(() => subscribe(() => force((x) => x + 1)), []);
  return sel(state);
}
export function exportData() { return JSON.stringify(state); }
export function importData(json: string) { const s = JSON.parse(json); if (!s || typeof s !== 'object' || !('xp' in s)) throw new Error('Fichier invalide'); replaceState({ ...defaultState(), ...s }); }
export function resetAll() { replaceState(defaultState()); }

// ——— XP, niveaux, séries ———
export const levelFromXp = (xp: number) => { let lvl = 1, need = 100, acc = 0; while (xp >= acc + need) { acc += need; lvl++; need = Math.round(need * 1.18); } return { level: lvl, into: xp - acc, need }; };
type Listener = (e: { type: 'xp'; amount: number; reason: string } | { type: 'badge'; id: string } | { type: 'level'; level: number }) => void;
const listeners = new Set<Listener>();
export function onEvent(l: Listener) { listeners.add(l); return () => listeners.delete(l); }
export function emit(e: Parameters<Listener>[0]) { listeners.forEach((l) => l(e)); }
export function addXp(amount: number, reason: string) {
  const before = levelFromXp(state.xp).level;
  setState((s) => {
    s.xp += amount; const d = today(); s.activity[d] = (s.activity[d] || 0) + amount;
    if (s.streak.last !== d) {
      const y = new Date(); y.setDate(y.getDate() - 1);
      s.streak.count = s.streak.last === today(y) ? s.streak.count + 1 : 1; s.streak.last = d; s.streak.best = Math.max(s.streak.best, s.streak.count);
    }
  });
  emit({ type: 'xp', amount, reason });
  const after = levelFromXp(state.xp).level; if (after > before) emit({ type: 'level', level: after });
}
export function streakAlive(s: State) { const y = new Date(); y.setDate(y.getDate() - 1); return s.streak.last === today() || s.streak.last === today(y); }
