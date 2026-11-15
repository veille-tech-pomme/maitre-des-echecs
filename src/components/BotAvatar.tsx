// Avatars de bots générés en SVG (aucune image externe, aucun visage réel).
import type { Bot } from '../data/bots';
export interface Persona { kind?: 'human' | 'robot' | 'cat' | 'rabbit' | 'bear' | 'fox' | 'owl' | 'dragon'; skin?: string; hair?: number; hairColor?: string; eyes?: 'dots' | 'glasses' | 'sun' | 'monocle' | 'happy' | 'sharp'; mouth?: 'smile' | 'flat' | 'grin' | 'o' | 'smirk'; beard?: 'none' | 'moustache' | 'full' | 'goatee'; hat?: 'none' | 'crown' | 'beret' | 'cap' | 'wizard' | 'pirate' | 'tophat' | 'headband' | 'helmet' | 'bow' | 'flower'; bg?: string }
function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const SKINS = ['#f9d7b9', '#f1c19d', '#d9a07a', '#b97a56', '#8d5a3b', '#5e3b26'];
const HAIRS = ['#2b2016', '#5a3825', '#a0522d', '#d9a441', '#e8e1d6', '#8a8a8a', '#c0392b', '#1f2a44'];
export function personaOf(b: Bot): Persona {
  const h = hash(b.id); const p = (b as any).persona || {};
  return { kind: 'human', skin: SKINS[h % 6], hair: (h >> 3) % 7, hairColor: HAIRS[(h >> 6) % 8], eyes: 'dots', mouth: (['smile', 'flat', 'grin', 'smirk'] as const)[(h >> 9) % 4], beard: 'none', hat: 'none', bg: b.color, ...p };
}
export function BotAvatar({ bot, size = 56 }: { bot: Bot; size?: number }) {
  const p = personaOf(bot); const k = p.kind!;
  const face = k === 'robot' ? '#b8c4d6' : k === 'cat' ? '#f0a35e' : k === 'rabbit' ? '#f3eef0' : k === 'bear' ? '#9c6b43' : k === 'fox' ? '#e87a3c' : k === 'owl' ? '#a07850' : k === 'dragon' ? '#5bbf6b' : p.skin!;
  const dark = '#22252c';
  const eyes = () => {
    switch (p.eyes) {
      case 'glasses': return <g fill="none" stroke={dark} stroke-width="2.2"><circle cx="40" cy="48" r="7" /><circle cx="60" cy="48" r="7" /><path d="M47 48h6" /><circle cx="40" cy="48" r="2" fill={dark} /><circle cx="60" cy="48" r="2" fill={dark} /></g>;
      case 'sun': return <g fill={dark}><rect x="31" y="43" width="16" height="9" rx="4" /><rect x="53" y="43" width="16" height="9" rx="4" /><rect x="46" y="45" width="8" height="2" /></g>;
      case 'monocle': return <g><circle cx="40" cy="48" r="2.6" fill={dark} /><circle cx="60" cy="48" r="7" fill="none" stroke="#c9a227" stroke-width="2" /><circle cx="60" cy="48" r="2.6" fill={dark} /><path d="M66 52 q4 10 0 18" stroke="#c9a227" fill="none" stroke-width="1.2" /></g>;
      case 'happy': return <g fill="none" stroke={dark} stroke-width="2.6" stroke-linecap="round"><path d="M35 49 q5 -6 10 0" /><path d="M55 49 q5 -6 10 0" /></g>;
      case 'sharp': return <g fill={dark}><path d="M34 46 l11 2 -11 3z" /><path d="M66 46 l-11 2 11 3z" /></g>;
      default: return <g fill={dark}><circle cx="40" cy="48" r="3" /><circle cx="60" cy="48" r="3" /><circle cx="41" cy="47" r="1" fill="#fff" /><circle cx="61" cy="47" r="1" fill="#fff" /></g>;
    }
  };
  const mouth = () => {
    switch (p.mouth) {
      case 'flat': return <path d="M42 64h16" stroke={dark} stroke-width="2.6" stroke-linecap="round" />;
      case 'grin': return <path d="M38 61 q12 12 24 0z" fill={dark} />;
      case 'o': return <circle cx="50" cy="64" r="3.5" fill={dark} />;
      case 'smirk': return <path d="M42 64 q8 4 16 -3" stroke={dark} stroke-width="2.6" fill="none" stroke-linecap="round" />;
      default: return <path d="M40 61 q10 9 20 0" stroke={dark} stroke-width="2.6" fill="none" stroke-linecap="round" />;
    }
  };
  const hair = () => {
    if (k !== 'human') return null; const c = p.hairColor;
    switch (p.hair) {
      case 0: return <path d="M24 46 q0 -26 26 -26 q26 0 26 26 q-4 -12 -26 -14 q-22 2 -26 14z" fill={c} />;
      case 1: return <path d="M22 50 q-2 -32 28 -32 q30 0 28 32 l-6 0 q0 -16 -22 -18 q-22 2 -22 18z" fill={c} />;
      case 2: return <g fill={c}><path d="M22 48 q0 -30 28 -30 q28 0 28 30 l0 26 l-8 -2 l0 -26 q-20 -10 -40 0 l0 26 l-8 2z" /></g>;
      case 3: return <g fill={c}><circle cx="50" cy="20" r="9" /><path d="M24 46 q0 -24 26 -24 q26 0 26 24 q-26 -14 -52 0z" /></g>;
      case 4: return <path d="M26 40 q4 -20 24 -20 q20 0 24 20 q-6 -6 -12 -4 q-6 -8 -12 -4 q-6 -6 -12 0 q-6 -2 -12 8z" fill={c} />;
      case 5: return <g fill={c}><path d="M28 34 q22 -22 44 0 q-22 -8 -44 0z" /><circle cx="24" cy="50" r="6" /><circle cx="76" cy="50" r="6" /></g>;
      default: return null;
    }
  };
  const ears = () => {
    switch (k) {
      case 'cat': case 'fox': return <g fill={face}><path d="M24 36 l4 -22 l16 14z" /><path d="M76 36 l-4 -22 l-16 14z" /><path d="M28 30 l2 -10 l8 7z" fill="#fff" opacity=".5" /><path d="M72 30 l-2 -10 l-8 7z" fill="#fff" opacity=".5" /></g>;
      case 'rabbit': return <g fill={face}><ellipse cx="38" cy="14" rx="6" ry="16" /><ellipse cx="62" cy="14" rx="6" ry="16" /><ellipse cx="38" cy="14" rx="3" ry="11" fill="#f7b6c8" /><ellipse cx="62" cy="14" rx="3" ry="11" fill="#f7b6c8" /></g>;
      case 'bear': return <g fill={face}><circle cx="28" cy="28" r="9" /><circle cx="72" cy="28" r="9" /></g>;
      case 'owl': return <g fill={face}><path d="M26 32 l2 -16 l12 10z" /><path d="M74 32 l-2 -16 l-12 10z" /></g>;
      case 'dragon': return <g fill="#f2c94c"><path d="M30 30 l-6 -18 l12 12z" /><path d="M70 30 l6 -18 l-12 12z" /></g>;
      case 'robot': return <g><path d="M50 22 v-10" stroke="#8795ab" stroke-width="3" /><circle cx="50" cy="10" r="4" fill="#ff5e5e" /><rect x="18" y="42" width="6" height="14" rx="2" fill="#8795ab" /><rect x="76" y="42" width="6" height="14" rx="2" fill="#8795ab" /></g>;
      default: return null;
    }
  };
  const hat = () => {
    switch (p.hat) {
      case 'crown': return <path d="M30 26 l4 -16 l9 10 l7 -14 l7 14 l9 -10 l4 16z" fill="#f2c94c" stroke="#c9a227" stroke-width="1.5" />;
      case 'beret': return <g><ellipse cx="46" cy="24" rx="26" ry="9" fill="#2c3e50" /><circle cx="46" cy="15" r="3" fill="#2c3e50" /></g>;
      case 'cap': return <g fill="#e74c3c"><path d="M26 32 q0 -18 24 -18 q24 0 24 18z" /><rect x="50" y="28" width="30" height="5" rx="2.5" /></g>;
      case 'wizard': return <g><path d="M24 30 l26 -30 l26 30z" fill="#5b3cc4" /><circle cx="44" cy="16" r="2" fill="#f2c94c" /><circle cx="54" cy="22" r="1.6" fill="#f2c94c" /><rect x="20" y="27" width="60" height="6" rx="3" fill="#432c99" /></g>;
      case 'pirate': return <g><path d="M24 34 q0 -20 26 -20 q26 0 26 20z" fill="#1d1d1d" /><circle cx="50" cy="24" r="4" fill="#fff" /><path d="M32 46 h14 v6 h-14z" fill="#1d1d1d" /></g>;
      case 'tophat': return <g fill="#1d1d1d"><rect x="34" y="2" width="32" height="24" rx="2" /><rect x="24" y="24" width="52" height="6" rx="3" /><rect x="34" y="18" width="32" height="4" fill="#b03a2e" /></g>;
      case 'headband': return <rect x="24" y="30" width="52" height="6" rx="3" fill="#e74c3c" />;
      case 'helmet': return <path d="M22 40 q0 -26 28 -26 q28 0 28 26 l-8 0 q-2 -16 -20 -16 q-18 0 -20 16z" fill="#7f8c8d" />;
      case 'bow': return <g fill="#ff6fa8"><path d="M58 22 l12 -8 v16z" /><path d="M58 22 l-12 -8 v16z" /><circle cx="58" cy="22" r="3" /></g>;
      case 'flower': return <g><circle cx="70" cy="26" r="4" fill="#f2c94c" />{[0, 72, 144, 216, 288].map((a) => <circle cx={70 + 6 * Math.cos((a * Math.PI) / 180)} cy={26 + 6 * Math.sin((a * Math.PI) / 180)} r="3.5" fill="#ff8fab" />)}</g>;
      default: return null;
    }
  };
  const beard = () => {
    switch (p.beard) {
      case 'moustache': return <path d="M38 58 q6 -4 12 0 q6 -4 12 0 q-6 4 -12 1 q-6 3 -12 -1z" fill={p.hairColor} />;
      case 'full': return <path d="M28 52 q2 30 22 30 q20 0 22 -30 q-4 10 -10 12 q-12 -4 -24 0 q-6 -2 -10 -12z" fill={p.hairColor} />;
      case 'goatee': return <path d="M44 68 q6 12 12 0z" fill={p.hairColor} />;
      default: return null;
    }
  };
  return (
    <svg class="bot-svg" width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={bot.name}>
      <circle cx="50" cy="50" r="50" fill={p.bg} opacity=".28" />
      {ears()}
      {k === 'robot' ? <rect x="24" y="24" width="52" height="54" rx="12" fill={face} /> : <ellipse cx="50" cy="52" rx="26" ry="28" fill={face} />}
      {k === 'owl' && <g fill="#fff"><circle cx="40" cy="48" r="9" /><circle cx="60" cy="48" r="9" /></g>}
      {k === 'fox' && <path d="M28 56 q22 28 44 0 q-22 10 -44 0z" fill="#fff" />}
      {hair()}{beard()}{eyes()}
      {k === 'robot' ? <rect x="38" y="62" width="24" height="6" rx="2" fill="#5c6b80" /> : k === 'owl' ? <path d="M46 56 l4 7 l4 -7z" fill="#f2a33a" /> : mouth()}
      {(k === 'cat' || k === 'rabbit' || k === 'bear' || k === 'fox') && <ellipse cx="50" cy="57" rx="3.5" ry="2.5" fill="#3b2a2a" />}
      {hat()}
    </svg>
  );
}
