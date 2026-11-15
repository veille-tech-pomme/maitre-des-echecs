import { useEffect, useState } from 'preact/hooks';
export function parseHash() { const h = location.hash.replace(/^#\/?/, ''); const [path, q] = h.split('?'); return { parts: path.split('/').filter(Boolean).map(decodeURIComponent), query: new URLSearchParams(q || '') }; }
export function useRoute() {
  const [r, setR] = useState(parseHash());
  useEffect(() => { const f = () => { setR(parseHash()); window.scrollTo(0, 0); }; addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  return r;
}
export const go = (path: string) => { location.hash = path.startsWith('#') ? path : '#' + path; };
