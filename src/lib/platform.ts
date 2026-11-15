// Détection de la plateforme (app native Capacitor, PWA installée, navigateur).
export function isNative(): boolean { const c = (window as any).Capacitor; return !!(c && c.isNativePlatform && c.isNativePlatform()); }
export function isIOS(): boolean { return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
export function isStandalone(): boolean { return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true; }
