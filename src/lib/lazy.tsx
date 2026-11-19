// Chargement différé des écrans secondaires : le premier chargement reste léger.
import { useEffect, useState } from 'preact/hooks';
import type { FunctionComponent, VNode } from 'preact';
export function lazy<P = any>(load: () => Promise<any>, name: string, fallback?: () => VNode): FunctionComponent<P> {
  let C: FunctionComponent<P> | null = null; let p: Promise<void> | null = null;
  const get = () => (p ||= load().then((m) => { C = m[name]; }).catch((e) => { p = null; throw e; }));
  return (props: P) => {
    const [, force] = useState(0);
    useEffect(() => { if (!C) get().then(() => force((x) => x + 1), () => setTimeout(() => force((x) => x + 1), 800)); }, []);
    return C ? <C {...(props as any)} /> : fallback ? fallback() : <div class="lazy-wait" aria-busy="true" />;
  };
}
