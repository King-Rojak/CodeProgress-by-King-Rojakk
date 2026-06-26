import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import {
  initializeAuth,
  GoogleAuthProvider,
  browserLocalPersistence,
  browserPopupRedirectResolver
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import {
  getStorage
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-storage.js";

import { firebaseConfig } from "./firebase-config.js";

const isConfigMissing = Object.values(firebaseConfig).some(value => {
  return typeof value === "string" && value.startsWith("ISI_");
});

if (isConfigMissing) {
  console.warn("Firebase config belum diisi. Buka firebase-config.js lalu masukkan config dari Firebase Console.");
}

export const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: browserLocalPersistence,
  popupRedirectResolver: browserPopupRedirectResolver
});

export const provider = new GoogleAuthProvider();
provider.setCustomParameters({
  prompt: "select_account"
});

export const db = getFirestore(app);
export const storage = getStorage(app);
