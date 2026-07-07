/**
 * In-page notifications for timer phase changes: a browser Notification (so
 * the timer still reaches you in a background tab) plus a short beep.
 * Web push for the closed-app case lives separately (service worker).
 */

export function ensureNotifyPermission() {
  try {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  } catch (_error) {
    /* unsupported browser */
  }
}

export function notify(title, body) {
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      const n = new Notification(title, { body, icon: "/favicon.ico" });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    }
  } catch (_error) {
    /* best effort */
  }
}

export function beep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    osc.start();
    osc.stop(ctx.currentTime + 0.55);
    osc.onended = () => ctx.close().catch(() => {});
  } catch (_error) {
    /* best effort */
  }
}
