// Génère src/components/icons.gen.ts à partir de lucide-static (ISC) : seules les icônes utilisées sont embarquées.
import fs from 'node:fs';
const MAP = {
  today: 'sun', home: 'house', learn: 'graduation-cap', puzzle: 'puzzle', play: 'chess-knight', me: 'circle-user-round', king: 'chess-king', queen: 'chess-queen', rook: 'chess-rook', pawn: 'chess-pawn', bishop: 'chess-bishop',
  right: 'chevron-right', left: 'chevron-left', down: 'chevron-down', up: 'chevron-up', close: 'x', settings: 'settings', crown: 'crown', flame: 'flame', star: 'star', bolt: 'zap', timer: 'timer',
  swords: 'swords', target: 'target', book: 'book-open', flag: 'flag', undo: 'undo-2', reset: 'rotate-ccw', bulb: 'lightbulb', eye: 'eye', flip: 'arrow-up-down', playIcon: 'play', pause: 'pause',
  first: 'chevrons-left', last: 'chevrons-right', check: 'check', checkCircle: 'circle-check', xCircle: 'circle-x', lock: 'lock', chart: 'chart-line', trophy: 'trophy', sparkles: 'sparkles', brain: 'brain',
  compass: 'compass', search: 'search', dumbbell: 'dumbbell', calendar: 'calendar-days', repeat: 'repeat', share: 'share', plus: 'plus', info: 'info', shield: 'shield-check', bot: 'bot', user: 'user',
  route: 'route', library: 'library', castle: 'castle', grid: 'grid-3x3', crosshair: 'crosshair', copy: 'copy', upload: 'upload', download: 'download', bell: 'bell', moon: 'moon', palette: 'palette',
  sound: 'volume-2', help: 'circle-help', sliders: 'sliders-horizontal', trend: 'trending-up', award: 'award', medal: 'medal', clock: 'clock', heart: 'heart', gift: 'gift', wand: 'wand-sparkles',
  microscope: 'microscope', layers: 'layers', list: 'list', dice: 'dices', sword: 'sword', message: 'message-circle', hand: 'hand', brainCircuit: 'brain-circuit', mountain: 'mountain', sprout: 'sprout',
  shieldHalf: 'shield-half', gauge: 'gauge', more: 'ellipsis', logout: 'log-out', file: 'file-text', keyboard: 'keyboard', smartphone: 'smartphone', badge: 'badge-check', hourglass: 'hourglass', piece: 'shapes', gem: 'gem', moonStar: 'moon-star', sun: 'sun', sunMoon: 'sun-moon', lockOpen: 'lock-open', trash: 'trash-2', vibrate: 'vibrate', hash: 'hash', zap: 'zap', move: 'move', paw: 'paw-print', footprints: 'footprints', infinity: 'infinity', cloud: 'cloud', mail: 'mail', code: 'code', externalLink: 'external-link', cpu: 'cpu',
};
const out = {};
for (const [k, n] of Object.entries(MAP)) {
  const f = `node_modules/lucide-static/icons/${n}.svg`;
  if (!fs.existsSync(f)) { console.error('manquante', n); process.exit(1); }
  const svg = fs.readFileSync(f, 'utf8');
  out[k] = svg.slice(svg.indexOf('>', svg.indexOf('<svg')) + 1, svg.lastIndexOf('</svg>')).replace(/\s*\n\s*/g, '').replace(/\s+\/>/g, '/>').trim();
}
fs.writeFileSync('src/components/icons.gen.ts', `// Généré par tools/build-icons.mjs — icônes Lucide (ISC, https://lucide.dev)\nexport const ICONS = ${JSON.stringify(out, null, 0)} as const;\nexport type IconName = keyof typeof ICONS;\n`);
console.log(Object.keys(out).length, 'icônes', fs.statSync('src/components/icons.gen.ts').size, 'octets');
