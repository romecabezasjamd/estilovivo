const HAPTIC_KEY = 'estilovivo_haptic';

let enabled = true;

try {
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(HAPTIC_KEY) : null;
  enabled = stored !== 'off';
} catch {}

export function isHapticEnabled(): boolean {
  return enabled;
}

export function setHapticEnabled(val: boolean) {
  enabled = val;
  try { localStorage.setItem(HAPTIC_KEY, val ? 'on' : 'off'); } catch {}
}

export function lightImpact() {
  if (!enabled) return;
  try {
    if (navigator.vibrate) navigator.vibrate(10);
  } catch {}
}

export function mediumImpact() {
  if (!enabled) return;
  try {
    if (navigator.vibrate) navigator.vibrate(20);
  } catch {}
}

export function heavyImpact() {
  if (!enabled) return;
  try {
    if (navigator.vibrate) navigator.vibrate(40);
  } catch {}
}

export function successImpact() {
  if (!enabled) return;
  try {
    if (navigator.vibrate) navigator.vibrate([10, 50, 10]);
  } catch {}
}

export function errorImpact() {
  if (!enabled) return;
  try {
    if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
  } catch {}
}
