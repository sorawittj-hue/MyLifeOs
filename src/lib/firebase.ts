import { initializeApp } from "firebase/app";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getMessaging, isSupported } from "firebase/messaging";
import firebaseConfig from "../../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);

// ── Firestore with Offline Persistence ──────────────────────
// Uses IndexedDB under the hood — works across multiple tabs.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// ── Firebase Cloud Messaging (FCM) ──────────────────────────
// Initialize only if browser supports it
let messaging: ReturnType<typeof getMessaging> | null = null;

export async function getFirebaseMessaging() {
  if (messaging) return messaging;
  const supported = await isSupported();
  if (supported) {
    messaging = getMessaging(app);
  }
  return messaging;
}
