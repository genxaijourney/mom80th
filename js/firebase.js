/* Sharon 80 — Firebase init + anonymous auth
 * -------------------------------------------------------------
 * REPLACE the placeholder values below with your real web config.
 * Get it from: Firebase Console -> Project Settings -> "Your apps"
 *   -> Web app -> "SDK setup and configuration" -> "Config"
 * -------------------------------------------------------------
 * NOTE: This web config is PUBLIC by design (safe to commit).
 * Real secrets (Admin SDK) never belong in this file.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  set,
  get,
  update,
  onValue,
  push,
  child,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// ============================================================
// >>> REPLACE THESE PLACEHOLDERS <<<
// ============================================================
const firebaseConfig = {
  apiKey:            "AIzaSyBIcXicy4CLnoTXluPOoGoJnTbOqUjkwmA",
  authDomain:        "mom80th-3bce5.firebaseapp.com",
  databaseURL:       "https://mom80th-3bce5-default-rtdb.firebaseio.com",
  projectId:         "mom80th-3bce5",
  storageBucket:     "mom80th-3bce5.firebasestorage.app",
  messagingSenderId: "767885711356",
  appId:             "1:767885711356:web:5f2362d03e4f3d7a554479"
};
// ============================================================

export const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getDatabase(app);

// Anonymous auth — every visitor gets a stable UID we can use for scores
export function ensureSignedIn() {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        resolve(user);
      } else {
        signInAnonymously(auth).catch(reject);
      }
    });
  });
}

// Re-export DB helpers so other modules just import from firebase.js
export { ref, set, get, update, onValue, push, child, serverTimestamp };
