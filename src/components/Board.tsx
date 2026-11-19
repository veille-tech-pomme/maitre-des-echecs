import { useEffect, useRef, useState } from 'preact/hooks';
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { Config } from 'chessground/config';
import type { DrawShape } from 'chessground/draw';
import type { Key } from 'chessground/types';
import { getState } from '../lib/store';
import { unlockAudio } from '../lib/sound';

export interface BoardProps {
  fen: string;
  orientation?: 'white' | 'black';
  turn?: 'white' | 'black';
  movable?: 'white' | 'black' | 'both' | 'none';
  dests?: Map<string, string[]>;
  lastMove?: [string, string] | null;
  check?: boolean;
  shapes?: DrawShape[];
  highlight?: Map<string, string>;
  onMove?: (from: string, to: string, promotion?: string) => boolean | void;
  onSquare?: (sq: string) => void;
  viewOnly?: boolean;
  free?: boolean;
  promotionCheck?: (from: string, to: string) => boolean;
  coordinates?: boolean;
  class?: string;
}
const PROMO = ['q', 'n', 'r', 'b'] as const;
const ROLE: Record<string, string> = { q: 'queen', n: 'knight', r: 'rook', b: 'bishop' };

export function Board(p: BoardProps) {
  const el = useRef<HTMLDivElement>(null);
  const cg = useRef<Api | null>(null);
  const props = useRef(p); props.current = p;
  const [promo, setPromo] = useState<{ from: string; to: string; color: 'white' | 'black' } | null>(null);

  const config = (): Config => {
    const s = getState().settings; const q = props.current;
    const color = q.movable === 'none' || q.viewOnly ? undefined : q.movable || q.turn;
    return {
      fen: q.fen.split(' ')[0],
      orientation: q.orientation || 'white',
      turnColor: q.turn || (q.fen.split(' ')[1] === 'b' ? 'black' : 'white'),
      check: q.check || false,
      lastMove: (q.lastMove || undefined) as Key[] | undefined,
      viewOnly: !!q.viewOnly,
      coordinates: q.coordinates ?? s.coords,
      animation: { enabled: s.animation && !s.reduceMotion, duration: 220 },
      highlight: { lastMove: true, check: true, custom: (q.highlight || new Map()) as Map<Key, string> },
      movable: { free: !!q.free, color: color as any, dests: (q.dests || new Map()) as Map<Key, Key[]>, showDests: s.showLegal, events: { after: onAfter } },
      premovable: { enabled: false },
      draggable: { enabled: true, showGhost: true },
      selectable: { enabled: true },
      drawable: { enabled: true, visible: true, autoShapes: validShapes(q.shapes), defaultSnapToValidMove: true },
      events: { select: (k: Key) => props.current.onSquare?.(k) },
    };
  };
  function onAfter(from: Key, to: Key) {
    const q = props.current;
    const needsPromo = q.promotionCheck ? q.promotionCheck(from, to) : false;
    if (needsPromo) {
      if (getState().settings.autoQueen) return finish(from, to, 'q');
      const color = (q.turn || (q.fen.split(' ')[1] === 'b' ? 'black' : 'white')) as 'white' | 'black';
      setPromo({ from, to, color });
      return;
    }
    finish(from, to);
  }
  function finish(from: string, to: string, promotion?: string) {
    const r = props.current.onMove?.(from, to, promotion);
    if (r === false) setTimeout(() => cg.current?.set(config()), 380);
  }
  useEffect(() => {
    if (!el.current) return;
    cg.current = Chessground(el.current, config());
    let raf = 0;
    const ro = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { const e = el.current; if (e && e.isConnected && e.clientWidth > 0) cg.current?.redrawAll(); }); });
    ro.observe(el.current);
    const unlock = () => unlockAudio();
    el.current.addEventListener('pointerdown', unlock, { once: true });
    // chessground garde en cache la position de l'échiquier : si elle a été mesurée pendant une animation d'entrée
    // (translate/scale d'une carte), les touchers tombaient sur la mauvaise case. On remesure avant chaque toucher
    // (phase de capture, avant chessground) et à la fin de toute animation d'un ancêtre.
    const fresh = () => cg.current?.state.dom.bounds.clear();
    el.current.addEventListener('mousedown', fresh, { capture: true }); el.current.addEventListener('touchstart', fresh, { capture: true, passive: true });
    const onAnim = (e: Event) => { const t = e.target; if (el.current && t instanceof Element && t !== el.current && t.contains(el.current)) { fresh(); cg.current?.state.dom.redraw(); } };
    document.addEventListener('animationend', onAnim); document.addEventListener('transitionend', onAnim);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); document.removeEventListener('animationend', onAnim); document.removeEventListener('transitionend', onAnim); cg.current?.destroy(); cg.current = null; };
  }, []);
  useEffect(() => { cg.current?.set(config()); cg.current?.setAutoShapes(validShapes(p.shapes)); });

  return (
    <div class={'board-wrap ' + (p.class || '')}>
      <div class="board-sq"><div ref={el} class="cg-host" /></div>
      {promo && (
        <div class="promo-overlay" onClick={() => { setPromo(null); cg.current?.set(config()); }}>
          <div class="promo-box" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Choisis la pièce de promotion">
            {PROMO.map((r) => (
              <button class={`promo-piece cg-wrap`} aria-label={{ q: 'Dame', n: 'Cavalier', r: 'Tour', b: 'Fou' }[r]} onClick={() => { const pr = promo; setPromo(null); finish(pr.from, pr.to, r); }}>
                <piece class={`${ROLE[r]} ${promo.color}`} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
export type { DrawShape };
const KEY = /^[a-h][1-8]$/;
function validShapes(list?: DrawShape[]): DrawShape[] { return (list || []).filter((s) => KEY.test(s.orig) && (!s.dest || (KEY.test(s.dest) && s.dest !== s.orig))); }
/** Convertit une liste « e2e4 » / « e4 » en formes chessground. */
export function toShapes(list: string[] = [], brush = 'green'): DrawShape[] {
  return list.map((s) => (s.length >= 4 ? { orig: s.slice(0, 2) as Key, dest: s.slice(2, 4) as Key, brush } : { orig: s as Key, brush }));
}
