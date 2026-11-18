import { ICONS, type IconName } from './icons.gen';
export type { IconName };
/** Icône vectorielle (Lucide, trait 2 px). `fill` remplit légèrement la forme (onglet actif). */
export function Icon({ name, size = 22, stroke = 2, class: cls = '', label }: { name: IconName; size?: number; stroke?: number; class?: string; label?: string }) {
  return (
    <svg class={'ico ' + cls} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={stroke} stroke-linecap="round" stroke-linejoin="round"
      aria-hidden={label ? undefined : 'true'} role={label ? 'img' : undefined} aria-label={label} dangerouslySetInnerHTML={{ __html: ICONS[name] }} />
  );
}
const EMOJI: Record<string, IconName> = { '✨': 'sparkles', '⭐': 'star', '🎉': 'trophy', '🏅': 'award', '⚠️': 'info', '✅': 'checkCircle', '📋': 'copy', '💡': 'bulb', '🔓': 'lock', '🔒': 'lock', '👑': 'crown', '🔥': 'flame', '⏰': 'clock', '🗑️': 'reset', '💾': 'download' };
export const iconFor = (x?: string): IconName => (x && (x in ICONS ? (x as IconName) : EMOJI[x])) || 'checkCircle';
