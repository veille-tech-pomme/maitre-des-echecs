// Génère les icônes PWA / iOS à partir d'un SVG (cavalier cburnett sur fond dégradé).
import sharp from 'sharp';
import fs from 'node:fs';
const knight = `<g transform="translate(%X,%Y) scale(%S)"><g fill="none" fill-rule="evenodd" stroke="#1a1d24" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21" fill="#fff"/><path d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4.003 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.994-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.992 2.5-3c1 0 1 3 1 3" fill="#fff"/><path d="M9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 1 1 1 0zm5.433-9.75a.5 1.5 30 1 1-.866-.5.5 1.5 30 1 1 .866.5z" fill="#1a1d24"/></g></g>`;
function svg(size, pad, rounded) {
  const s = (size * (1 - pad * 2)) / 45;
  const k = knight.replace('%X', size * pad).replace('%Y', size * pad * 0.9).replace('%S', s);
  const r = rounded ? size * 0.22 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7c5cff"/><stop offset="1" stop-color="#2bc48a"/></linearGradient></defs>
  <rect width="${size}" height="${size}" rx="${r}" fill="url(#g)"/>
  <g opacity="0.16" fill="#000">${[0,1,2,3].map(i=>[0,1,2,3].map(j=>(i+j)%2?`<rect x="${i*size/4}" y="${j*size/4}" width="${size/4}" height="${size/4}"/>`:'').join('')).join('')}</g>
  ${k}</svg>`;
}
fs.mkdirSync('public/icons', { recursive: true });
fs.writeFileSync('public/icons/icon.svg', svg(512, 0.14, true));
const jobs = [['icon-192.png', 192, 0.14, false], ['icon-512.png', 512, 0.14, false], ['icon-maskable-512.png', 512, 0.22, false], ['apple-touch-icon.png', 180, 0.14, false], ['icon-1024.png', 1024, 0.14, false]];
for (const [n, sz, pad, r] of jobs) await sharp(Buffer.from(svg(sz, pad, r))).png().toFile('public/icons/' + n);
// ressources Capacitor (icône + splash)
fs.mkdirSync('resources', { recursive: true });
await sharp(Buffer.from(svg(1024, 0.14, false))).png().toFile('resources/icon.png');
const splash = (w, h, bg) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="${bg}"/><g transform="translate(${w/2-300},${h/2-300})">${svg(600,0.14,true).replace(/^<svg[^>]*>/,'').replace('</svg>','')}</g></svg>`;
await sharp(Buffer.from(splash(2732, 2732, '#0f1115'))).png().toFile('resources/splash.png');
await sharp(Buffer.from(splash(2732, 2732, '#0f1115'))).png().toFile('resources/splash-dark.png');
console.log('icônes générées');
