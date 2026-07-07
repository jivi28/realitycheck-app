/**
 * Web push subscription management. Subscriptions are stored per browser in
 * the Supabase `rc_push_subscriptions` table; the Vercel cron function
 * api/push-nudge.js reads them to send the evening reconcile / streak-at-risk
 * nudges when the app is closed.
 *
 * Needs REACT_APP_VAPID_PUBLIC_KEY at build time (plus VAPID_PRIVATE_KEY on
 * the server side) and Supabase sync configured.
 */
import { CLOUD_ENABLED, savePushSubscription, deletePushSubscription } from "./cloudSync";

const VAPID_PUBLIC_KEY = process.env.REACT_APP_VAPID_PUBLIC_KEY || "";

export function pushAvailable() {
  return Boolean(
    VAPID_PUBLIC_KEY &&
      CLOUD_ENABLED &&
      typeof navigator !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window
  );
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

// Stable per-endpoint row id (endpoints are too long/charset-hostile for a PK).
function subscriptionId(endpoint) {
  let hash = 5381;
  for (let i = 0; i < endpoint.length; i++) hash = ((hash << 5) + hash + endpoint.charCodeAt(i)) >>> 0;
  return `push_${hash.toString(36)}_${endpoint.length}`;
}

export async function isPushEnabled() {
  if (!pushAvailable()) return false;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    return Boolean(subscription);
  } catch (_error) {
    return false;
  }
}

export async function enablePush() {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notifications are blocked for this site");
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });
  await savePushSubscription(subscriptionId(subscription.endpoint), {
    subscription: subscription.toJSON(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    created_at: new Date().toISOString(),
  });
}

export async function disablePush() {
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  try {
    await deletePushSubscription(subscriptionId(subscription.endpoint));
  } finally {
    await subscription.unsubscribe();
  }
}
