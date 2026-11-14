/**
 * Copies text to the clipboard. Falls back to a hidden textarea for browsers
 * or contexts where the async Clipboard API is unavailable (older Android
 * webviews, http). Shows a toast and gives a tiny haptic tap on phones.
 */
export async function copyText(text, message = 'Copied') {
  const value = String(text ?? '');
  let ok = false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      ok = true;
    }
  } catch {
    ok = false;
  }
  if (!ok) {
    try {
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      ok = document.execCommand('copy');
      document.body.removeChild(ta);
    } catch {
      ok = false;
    }
  }
  if (ok) {
    try { navigator.vibrate?.(12); } catch { /* not supported */ }
    toast(message);
  } else {
    toast("Couldn't copy. Press and hold the number to copy it.");
  }
  return ok;
}

/** Shows a short message at the bottom of the screen (see <Toast/> in App). */
export function toast(message) {
  window.dispatchEvent(new CustomEvent('app-toast', { detail: { message, id: Date.now() } }));
}
