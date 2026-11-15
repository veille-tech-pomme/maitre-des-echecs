import { useEffect, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { onEvent } from '../lib/store';
import { play } from '../lib/sound';

/** Mini-Markdown : **gras**, listes « - » et « 1. », sauts de ligne. */
export function Md({ text }: { text: string }) {
  const blocks = text.split('\n\n');
  const inline = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((part) => (part.startsWith('**') ? <strong>{part.slice(2, -2)}</strong> : part));
  return (
    <div class="md">
      {blocks.map((b) => {
        const lines = b.split('\n');
        if (lines.every((l) => /^- /.test(l))) return <ul>{lines.map((l) => <li>{inline(l.slice(2))}</li>)}</ul>;
        if (lines.every((l) => /^\d+\. /.test(l))) return <ol>{lines.map((l) => <li>{inline(l.replace(/^\d+\. /, ''))}</li>)}</ol>;
        if (lines.length > 1 && lines.slice(1).every((l) => /^(- |\d+\. )/.test(l))) {
          const ordered = /^\d+\. /.test(lines[1]);
          const items = lines.slice(1).map((l) => <li>{inline(l.replace(/^(- |\d+\. )/, ''))}</li>);
          return <><p>{inline(lines[0])}</p>{ordered ? <ol>{items}</ol> : <ul>{items}</ul>}</>;
        }
        return <p>{lines.map((l, i) => <>{i > 0 && <br />}{inline(l)}</>)}</p>;
      })}
    </div>
  );
}
export function Progress({ value, color }: { value: number; color?: string }) {
  return <div class="progress" role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }} /></div>;
}
export function Ring({ value, size = 56, label, color = 'var(--accent)' }: { value: number; size?: number; label?: ComponentChildren; color?: string }) {
  const r = size / 2 - 5; const c = 2 * Math.PI * r;
  return (
    <div class="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true"><circle cx={size / 2} cy={size / 2} r={r} stroke="var(--line)" stroke-width="5" fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} stroke-width="5" fill="none" stroke-dasharray={c} stroke-dashoffset={c * (1 - Math.max(0, Math.min(1, value)))} stroke-linecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} /></svg>
      <span>{label}</span>
    </div>
  );
}
export function Modal({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: ComponentChildren; title?: string }) {
  useEffect(() => { if (!open) return; const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [open]);
  if (!open) return null;
  return (
    <div class="modal-bg" onClick={onClose}>
      <div class="modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        {title && <h2>{title}</h2>}
        {children}
      </div>
    </div>
  );
}
interface ToastMsg { id: number; text: string; icon: string }
let tid = 0;
const toastSubs = new Set<(t: ToastMsg) => void>();
export function toast(text: string, icon = '✨') { const t = { id: ++tid, text, icon }; toastSubs.forEach((f) => f(t)); }
export function Toasts() {
  const [list, setList] = useState<ToastMsg[]>([]);
  useEffect(() => {
    const add = (t: ToastMsg) => { setList((l) => [...l.slice(-2), t]); setTimeout(() => setList((l) => l.filter((x) => x.id !== t.id)), 2600); };
    toastSubs.add(add);
    const off = onEvent((e) => {
      if (e.type === 'xp') add({ id: ++tid, text: `+${e.amount} XP · ${e.reason}`, icon: '⭐' });
      if (e.type === 'level') { play('win'); add({ id: ++tid, text: `Niveau ${e.level} atteint !`, icon: '🎉' }); }
      if (e.type === 'badge') { play('notify'); add({ id: ++tid, text: `Nouveau badge : ${e.id}`, icon: '🏅' }); }
    });
    return () => { toastSubs.delete(add); off(); };
  }, []);
  return <div class="toasts" aria-live="polite">{list.map((t) => <div class="toast" key={t.id}><span>{t.icon}</span>{t.text}</div>)}</div>;
}
export function EvalBar({ cp, orientation = 'white', label }: { cp: number; orientation?: 'white' | 'black'; label?: string }) {
  const w = 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * Math.max(-2000, Math.min(2000, cp)))) - 1);
  const pct = cp >= 9000 ? 100 : cp <= -9000 ? 0 : w;
  return (
    <div class={'evalbar ' + (orientation === 'black' ? 'flip' : '')} aria-label={`Évaluation ${label || ''}`} title={label}>
      <div class="evalbar-white" style={{ height: pct + '%' }} />
      <span class={'evalbar-label ' + (cp >= 0 ? 'w' : 'b')}>{label}</span>
    </div>
  );
}
/** Courbe simple (SVG). */
export function LineChart({ points, height = 140, color = 'var(--accent)', fill = true, zero }: { points: number[]; height?: number; color?: string; fill?: boolean; zero?: number }) {
  if (points.length < 2) return <div class="chart-empty">Pas encore assez de données — joue quelques puzzles !</div>;
  const W = 600, H = height; const min = Math.min(...points, zero ?? Infinity), max = Math.max(...points, zero ?? -Infinity); const pad = (max - min) * 0.1 || 10;
  const x = (i: number) => (i / (points.length - 1)) * W; const y = (v: number) => H - ((v - (min - pad)) / (max - min + 2 * pad)) * H;
  const d = points.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <svg class="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Graphique d’évolution">
      {zero != null && <line x1="0" x2={W} y1={y(zero)} y2={y(zero)} stroke="var(--line)" stroke-dasharray="4 4" />}
      {fill && <path d={`${d} L${W},${H} L0,${H} Z`} fill={color} opacity="0.15" />}
      <path d={d} fill="none" stroke={color} stroke-width="3" vector-effect="non-scaling-stroke" stroke-linejoin="round" />
    </svg>
  );
}
export function Empty({ icon, title, text, children }: { icon: string; title: string; text?: string; children?: ComponentChildren }) {
  return <div class="empty"><div class="empty-icon">{icon}</div><h3>{title}</h3>{text && <p>{text}</p>}{children}</div>;
}
export function PremiumLock({ title, text }: { title: string; text: string }) {
  return (
    <div class="lock-card">
      <div class="lock-icon">👑</div>
      <h3>{title}</h3>
      <p>{text}</p>
      <a class="btn primary" href="#/premium">Découvrir Premium — 7 jours gratuits</a>
      <p class="muted small">Ta progression reste 100 % gratuite : leçons Débutant → Avancé, puzzles, bots et analyse.</p>
    </div>
  );
}
