import {
  signInWithPopup,
  signOut,
  updateProfile,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-storage.js";

import { auth, provider, db, storage } from "./firebase.js";

const root = document.getElementById("root");
const modalArea = document.getElementById("modalArea");
const toast = document.getElementById("toast");

let currentUser = null;
let projects = [];
let activeView = "dashboard";
let currentProjectId = null;
let projectSearch = "";
let projectStatusFilter = "all";
let unsubscribeProjects = null;
let isLoadingProjects = false;
let isUploadingScreenshot = false;
let selectedProjectPhotoFile = null;
let selectedProjectPhotoUrl = null;
let welcomePopupShown = false;
let dashboardClockTimer = null;
let selectedProfilePhotoFile = null;
let isSavingProfile = false;
let isClaimingKey = false;
let isOpeningProtectedSource = false;

let unsubscribeKeys = null;
let keysProjectId = null;
let currentProjectKeys = [];

let publicProject = null;
let publicOwnerUid = null;
let publicAccess = null;
let hasSyncedPublicProjects = false;

const ADMIN_EMAIL = "ahmadrzzaq14@gmail.com";
const ADMIN_UID = "ST4UPUpnnva8eBp11hpnTFuT6DP2";
const DEFAULT_WHATSAPP_NUMBER = "6283867622796";
const BRAND_OWNER_NAME = "King Rojak";
const SECURITY_CONFIG = {
  keyMaxAttempts: 5,
  keyLockMs: 5 * 60 * 1000,
  maxProjectNameLength: 80,
  maxProjectDescriptionLength: 1800,
  maxProjectTechLength: 350,
  maxWhatsappLength: 16,
  keyPattern: /^CP-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/,
  allowedDownloadHosts: [
    "mediafire.com",
    "www.mediafire.com",
    "drive.google.com",
    "github.com",
    "github.io",
    "vercel.app",
    "netlify.app",
    "catbox.moe",
    "files.catbox.moe"
  ],
  allowedImageHosts: [
    "i.imgur.com",
    "imgur.com",
    "postimg.cc",
    "i.postimg.cc",
    "catbox.moe",
    "files.catbox.moe",
    "lh3.googleusercontent.com",
    "drive.google.com",
    "googleusercontent.com"
  ]
};

function isAdminUser(user = currentUser) {
  return Boolean(
    user?.uid === ADMIN_UID &&
    user?.email &&
    user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()
  );
}

function requireAdmin() {
  if (isAdminUser()) return true;

  showWarningPopup(
    "Khusus Admin",
    "Fitur ini hanya bisa digunakan oleh akun admin yang terdaftar."
  );

  return false;
}

const projectStatuses = [
  "Planning",
  "In Progress",
  "Bug Fixing",
  "Testing",
  "Completed",
  "Paused"
];

const featureStatuses = ["Belum", "Proses", "Selesai"];
const bugStatuses = ["Belum diperbaiki", "Sedang diperbaiki", "Selesai"];
const ideaStatuses = ["Ide", "Dipertimbangkan", "Dikerjakan", "Selesai"];



function getDisplayName() {
  return currentUser?.displayName || currentUser?.email?.split("@")[0] || "User";
}

function renderBrandOwnerMarkup() {
  return '<span class="verified-owner-name">' + BRAND_OWNER_NAME + '</span>';
}

function getGreetingText() {
  const hour = new Date().getHours();
  if (hour < 11) return "Selamat pagi";
  if (hour < 15) return "Selamat siang";
  if (hour < 18) return "Selamat sore";
  return "Selamat malam";
}

function getDashboardDateTime() {
  const now = new Date();

  return {
    day: new Intl.DateTimeFormat("id-ID", { weekday: "long" }).format(now),
    date: new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "long", year: "numeric" }).format(now),
    time: new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(now).replace(/\./g, ":")
  };
}

function renderDashboardTimeCard() {
  const dateTime = getDashboardDateTime();
  const role = isAdminUser() ? "Admin" : "Member";

  return `
    <section class="dashboard-premium-panel">
      <div class="dashboard-premium-copy">
        <span class="premium-chip">Live Workspace</span>
        <h2>${getGreetingText()}, ${esc(getDisplayName())}</h2>
        <p>Pantau referensi project, progress coding, akses source code, dan aktivitas akun dari satu dashboard.</p>
      </div>

      <div class="dashboard-clock-card">
        <span id="dashboardDay">${esc(dateTime.day)}</span>
        <strong id="dashboardClock">${esc(dateTime.time)}</strong>
        <p id="dashboardDate">${esc(dateTime.date)}</p>
        <em>${role} Access</em>
      </div>
    </section>
  `;
}

function updateDashboardClock() {
  const clock = document.getElementById("dashboardClock");
  const day = document.getElementById("dashboardDay");
  const date = document.getElementById("dashboardDate");

  if (!clock || !day || !date) return;

  const dateTime = getDashboardDateTime();
  clock.textContent = dateTime.time;
  day.textContent = dateTime.day;
  date.textContent = dateTime.date;
}

function startDashboardClock() {
  updateDashboardClock();

  if (dashboardClockTimer) {
    clearInterval(dashboardClockTimer);
  }

  dashboardClockTimer = setInterval(updateDashboardClock, 1000);
}

function showWelcomePopup() {
  if (!currentUser || welcomePopupShown || parseShareRoute()) return;

  welcomePopupShown = true;

  const oldPopup = document.getElementById("welcomeCenterPopup");
  if (oldPopup) oldPopup.remove();

  const dateTime = getDashboardDateTime();
  const role = isAdminUser() ? "Admin" : "Member";

  const popup = document.createElement("div");
  popup.id = "welcomeCenterPopup";
  popup.className = "welcome-center-overlay";
  popup.setAttribute("role", "dialog");
  popup.setAttribute("aria-modal", "true");

  popup.innerHTML = `
    <div class="welcome-center-card">
      <div class="welcome-glow"></div>
      <div class="welcome-center-top">
        <div class="welcome-center-logo">${safeIconSvg("code")}</div>
        <span>${role} Mode</span>
      </div>

      <h2>${getGreetingText()}, ${esc(getDisplayName())}</h2>
      <p>Welcome back ke CodeProgress. Dashboard kamu siap untuk melihat project, progress, source code, dan akses key.</p>

      <div class="welcome-center-time">
        <div>
          <span>Hari ini</span>
          <strong>${esc(dateTime.day)}</strong>
        </div>
        <div>
          <span>Jam</span>
          <strong>${esc(dateTime.time)}</strong>
        </div>
      </div>

      <button class="btn btn-primary welcome-center-btn" type="button">Masuk Dashboard</button>
    </div>
  `;

  document.body.appendChild(popup);
  document.body.classList.add("welcome-open");

  const closeWelcome = () => {
    popup.classList.add("closing");
    document.body.classList.remove("welcome-open");
    setTimeout(() => popup.remove(), 170);
  };

  popup.querySelector(".welcome-center-btn")?.addEventListener("click", closeWelcome);
  popup.addEventListener("click", event => {
    if (event.target === popup) closeWelcome();
  });
}

function showWelcomeIfNeeded() {
  if (!currentUser || parseShareRoute()) return;

  setTimeout(() => {
    if (activeView !== "dashboard") {
      activeView = "dashboard";
      currentProjectId = null;
      render();
    }

    showWelcomePopup();
  }, 420);
}


function nowIso() {
  return new Date().toISOString();
}

function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}



function safeIconSvg(type = "code") {
  try {
    if (typeof appIconSvg === "function") return appIconSvg(type);
  } catch (error) {
    console.error("Icon render error:", error);
  }

  return `
    <svg viewBox="0 0 48 48" role="img" aria-hidden="true">
      <path d="M18 17l-7 7l7 7"></path>
      <path d="M30 17l7 7l-7 7"></path>
      <path d="M27 13l-6 22"></path>
    </svg>
  `;
}

function appIconSvg(type = "code") {
  const icons = {
    admin: `
      <svg viewBox="0 0 48 48" role="img" aria-hidden="true">
        <path d="M24 7l14 6v10c0 9-6 15-14 18C16 38 10 32 10 23V13l14-6z"></path>
        <path d="M18 24l4 4l8-9"></path>
      </svg>
    `,
    viewer: `
      <svg viewBox="0 0 48 48" role="img" aria-hidden="true">
        <path d="M8 24s6-11 16-11s16 11 16 11s-6 11-16 11S8 24 8 24z"></path>
        <circle cx="24" cy="24" r="5"></circle>
      </svg>
    `,
    key: `
      <svg viewBox="0 0 48 48" role="img" aria-hidden="true">
        <circle cx="19" cy="24" r="7"></circle>
        <path d="M26 24h14"></path>
        <path d="M34 24v5"></path>
        <path d="M39 24v4"></path>
      </svg>
    `,
    file: `
      <svg viewBox="0 0 48 48" role="img" aria-hidden="true">
        <path d="M15 8h13l7 7v25H15z"></path>
        <path d="M28 8v8h7"></path>
        <path d="M20 25h10"></path>
        <path d="M20 31h8"></path>
      </svg>
    `,
    share: `
      <svg viewBox="0 0 48 48" role="img" aria-hidden="true">
        <circle cx="17" cy="24" r="5"></circle>
        <circle cx="32" cy="15" r="5"></circle>
        <circle cx="32" cy="33" r="5"></circle>
        <path d="M21 22l7-4"></path>
        <path d="M21 26l7 4"></path>
      </svg>
    `,
    progress: `
      <svg viewBox="0 0 48 48" role="img" aria-hidden="true">
        <path d="M10 34h28"></path>
        <path d="M10 24h20"></path>
        <path d="M10 14h28"></path>
      </svg>
    `,
    code: `
      <svg viewBox="0 0 48 48" role="img" aria-hidden="true">
        <path d="M18 17l-7 7l7 7"></path>
        <path d="M30 17l7 7l-7 7"></path>
        <path d="M27 13l-6 22"></path>
      </svg>
    `
  };

  return icons[type] || icons.code;
}


function buildBuyKeyWhatsAppMessage(project = null, ownerUid = "") {
  const projectName = project?.name || project?.title || "";
  const userName = currentUser?.displayName || "";
  const userEmail = currentUser?.email || "";

  return [
    "*Halo admin, saya mau beli key source code.*",
    "",
    `*📋 Nama :* ${userName}`,
    `*📧 Email :* ${userEmail}`,
    `*📁 Nama project :* ${projectName}`,
    "*💳 Metode pembayaran :* DANA / QRIS",
    "*🖼️ Bukti transfer :* Saya kirim setelah pembayaran.",
    "",
    "> *Mohon info total harga dan nomor tujuan pembayaran ya.*",
    "- Terima kasih."
  ].join("\n");
}

function getAdminWhatsAppLink(project = null) {
  const number = cleanWhatsAppNumber(project?.whatsappNumber || DEFAULT_WHATSAPP_NUMBER);
  const message = buildBuyKeyWhatsAppMessage(project);

  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

function renderWhatsAppAdminText(project = null) {
  return `Belum punya key? Beli key lewat <a class="whatsapp-admin-link" href="${getAdminWhatsAppLink(project)}" target="_blank" rel="noopener">WhatsApp admin</a>.`;
}


function isAllowedHost(hostname = "", allowedHosts = []) {
  const host = String(hostname || "").toLowerCase();

  return allowedHosts.some(allowed => {
    const clean = String(allowed || "").toLowerCase();
    return host === clean || host.endsWith("." + clean);
  });
}

function isLocalHttpHost(hostname = "") {
  const host = String(hostname || "").toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function normalizeExternalUrl(value = "") {
  return String(value || "").trim();
}

function isSafeExternalUrl(value = "", options = {}) {
  const url = normalizeExternalUrl(value);
  if (!url) return options.allowEmpty === true;

  try {
    const parsed = new URL(url);
    const protocol = parsed.protocol.toLowerCase();

    if (protocol === "http:" && !(options.allowLocalHttp && isLocalHttpHost(parsed.hostname))) {
      return false;
    }

    if (protocol !== "https:" && protocol !== "http:") {
      return false;
    }

    if (Array.isArray(options.allowedHosts) && options.allowedHosts.length > 0) {
      return isAllowedHost(parsed.hostname, options.allowedHosts);
    }

    return true;
  } catch {
    return false;
  }
}

function safeExternalHref(value = "") {
  const url = normalizeExternalUrl(value);

  if (!isSafeExternalUrl(url, { allowLocalHttp: true })) {
    return "#";
  }

  return url;
}

function validateProjectSecurityInput({ name, description, tech, whatsappNumber, projectDownloadUrl }) {
  if (!name || name.length > SECURITY_CONFIG.maxProjectNameLength) {
    return {
      ok: false,
      title: "Nama Project Kurang Valid",
      message: `Nama project wajib diisi dan maksimal ${SECURITY_CONFIG.maxProjectNameLength} karakter.`
    };
  }

  if (description.length > SECURITY_CONFIG.maxProjectDescriptionLength) {
    return {
      ok: false,
      title: "Deskripsi Terlalu Panjang",
      message: `Deskripsi maksimal ${SECURITY_CONFIG.maxProjectDescriptionLength} karakter agar halaman tetap ringan.`
    };
  }

  if (tech.length > SECURITY_CONFIG.maxProjectTechLength) {
    return {
      ok: false,
      title: "Teknologi Terlalu Panjang",
      message: `Daftar teknologi maksimal ${SECURITY_CONFIG.maxProjectTechLength} karakter.`
    };
  }

  if (whatsappNumber.length > SECURITY_CONFIG.maxWhatsappLength) {
    return {
      ok: false,
      title: "Nomor WhatsApp Tidak Valid",
      message: "Nomor WhatsApp terlalu panjang. Masukkan nomor aktif dengan format Indonesia."
    };
  }

  if (projectDownloadUrl && !isSafeExternalUrl(projectDownloadUrl, {
    allowLocalHttp: true,
    allowedHosts: SECURITY_CONFIG.allowedDownloadHosts
  })) {
    return {
      ok: false,
      title: "Link Source Code Ditolak",
      message: "Gunakan link HTTPS dari MediaFire, Google Drive, GitHub, Vercel, Netlify, atau Catbox. Link javascript/data/http publik diblokir."
    };
  }

  return { ok: true };
}

function getKeyAttemptStorageKey(ownerUid, projectId, userId = currentUser?.uid || "guest") {
  return `codeprogress_key_attempts_${ownerUid || "owner"}_${projectId || "project"}_${userId}`;
}

function readKeyAttemptState(ownerUid, projectId) {
  try {
    const raw = localStorage.getItem(getKeyAttemptStorageKey(ownerUid, projectId));
    const state = raw ? JSON.parse(raw) : null;

    if (!state || typeof state !== "object") {
      return { count: 0, lockUntil: 0, updatedAt: 0 };
    }

    if (state.lockUntil && Number(state.lockUntil) <= Date.now()) {
      clearKeyAttempts(ownerUid, projectId);
      return { count: 0, lockUntil: 0, updatedAt: 0 };
    }

    return {
      count: Number(state.count) || 0,
      lockUntil: Number(state.lockUntil) || 0,
      updatedAt: Number(state.updatedAt) || 0
    };
  } catch {
    return { count: 0, lockUntil: 0, updatedAt: 0 };
  }
}

function clearKeyAttempts(ownerUid, projectId) {
  try {
    localStorage.removeItem(getKeyAttemptStorageKey(ownerUid, projectId));
  } catch {}
}

function getKeyLockInfo(ownerUid, projectId) {
  const state = readKeyAttemptState(ownerUid, projectId);
  const remainingMs = Math.max(0, state.lockUntil - Date.now());

  return {
    locked: remainingMs > 0,
    remainingMs,
    remainingSeconds: Math.ceil(remainingMs / 1000)
  };
}

function registerFailedKeyAttempt(ownerUid, projectId) {
  const state = readKeyAttemptState(ownerUid, projectId);
  const nextCount = state.count + 1;
  const shouldLock = nextCount >= SECURITY_CONFIG.keyMaxAttempts;
  const nextState = {
    count: shouldLock ? SECURITY_CONFIG.keyMaxAttempts : nextCount,
    lockUntil: shouldLock ? Date.now() + SECURITY_CONFIG.keyLockMs : 0,
    updatedAt: Date.now()
  };

  try {
    localStorage.setItem(getKeyAttemptStorageKey(ownerUid, projectId), JSON.stringify(nextState));
  } catch {}

  return {
    locked: shouldLock,
    remainingAttempts: Math.max(0, SECURITY_CONFIG.keyMaxAttempts - nextCount),
    remainingSeconds: Math.ceil(SECURITY_CONFIG.keyLockMs / 1000)
  };
}

function renderKeyAttemptWarning(result) {
  if (result.locked) {
    return `Terlalu banyak percobaan salah. Tunggu sekitar ${Math.ceil(result.remainingSeconds / 60)} menit sebelum mencoba lagi.`;
  }

  return `Percobaan tersisa: ${result.remainingAttempts}.`;
}

function esc(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getShortDescription(value, maxLength = 135) {
  const text = String(value || "Belum ada deskripsi project.")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length <= maxLength) return text;

  return text.slice(0, maxLength).trim().replace(/[.,;:\s]+$/g, "") + "...";
}

function renderFormattedDescription(value, fallback = "Belum ada deskripsi.") {
  const rawText = String(value || "").trim();
  const text = rawText || fallback;

  const paragraphs = text
    .split(/\n\s*\n/g)
    .map(paragraph => paragraph.trim())
    .filter(Boolean);

  return `
    <div class="formatted-description">
      ${
        paragraphs.length === 0
          ? `<p>${esc(fallback)}</p>`
          : paragraphs.map(paragraph => {
              const lines = paragraph
                .split(/\n/g)
                .map(line => line.trim())
                .filter(Boolean)
                .map(line => esc(line))
                .join("<br>");

              return `<p>${lines}</p>`;
            }).join("")
      }
    </div>
  `;
}

function getTechItems(value) {
  return String(value || "")
    .split(/[,;|•\n]+/g)
    .map(item => item.trim())
    .filter(Boolean);
}

function renderTechBadges(value, fallback = "Belum diisi") {
  const techItems = getTechItems(value);

  if (techItems.length === 0) {
    return `<div class="tech-chip-list"><span class="tech-chip muted">${esc(fallback)}</span></div>`;
  }

  return `
    <div class="tech-chip-list">
      ${techItems.map(tech => `<span class="tech-chip">${esc(tech)}</span>`).join("")}
    </div>
  `;
}

function renderTechInline(value, fallback = "Belum diisi") {
  const techItems = getTechItems(value);

  if (techItems.length === 0) {
    return esc(fallback);
  }

  return techItems.map(tech => esc(tech)).join(" - ");
}


function renderCompactTechBadges(value, limit = 4) {
  const techItems = getTechItems(value);

  if (techItems.length === 0) {
    return `<div class="compact-tech-list"><span class="compact-tech-chip muted">No tech</span></div>`;
  }

  const shownItems = techItems.slice(0, limit);
  const hiddenCount = techItems.length - shownItems.length;

  return `
    <div class="compact-tech-list">
      ${shownItems.map(tech => `<span class="compact-tech-chip">${esc(tech)}</span>`).join("")}
      ${hiddenCount > 0 ? `<span class="compact-tech-chip more">+${hiddenCount}</span>` : ""}
    </div>
  `;
}
function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.min(max, Math.max(min, number));
}

function formatDate(value) {
  if (!value) return "-";

  const date =
    value?.toDate ? value.toDate() :
    typeof value === "string" ? new Date(value) :
    value instanceof Date ? value :
    null;

  if (!date || Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}






function renderFatalBlankFix(message = "Web gagal dimuat. Refresh halaman untuk mencoba lagi.") {
  const target = document.getElementById("root") || document.body;
  if (!target) return;

  const hasContent = target.textContent && target.textContent.trim().length > 10;
  if (hasContent) return;

  target.innerHTML = `
    <section class="blank-hard-fix-page">
      <div class="blank-hard-fix-card">
        <div class="blank-hard-fix-icon">!</div>
        <h1>Web gagal dimuat</h1>
        <p>${typeof esc === "function" ? esc(message) : String(message)}</p>
        <button onclick="window.location.reload()">Refresh Halaman</button>
      </div>
    </section>
  `;
}

window.addEventListener("error", (event) => {
  console.error("Runtime error:", event.error || event.message);
  setTimeout(() => {
    const appEl = document.getElementById("root") || document.getElementById("root");
    if (!appEl || !appEl.innerHTML || appEl.innerHTML.trim().length < 20) {
      renderFatalBlankFix("Ada error JavaScript yang membuat halaman kosong. Refresh halaman atau upload file fix terbaru.");
    }
  }, 80);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled promise rejection:", event.reason);
  setTimeout(() => {
    const appEl = document.getElementById("root") || document.getElementById("root");
    if (!appEl || !appEl.innerHTML || appEl.innerHTML.trim().length < 20) {
      renderFatalBlankFix("Ada proses yang gagal saat memuat data. Refresh halaman atau cek koneksi internet.");
    }
  }, 80);
});

setTimeout(() => {
  const appEl = document.getElementById("root") || document.getElementById("root");
  if (!appEl || !appEl.innerHTML || appEl.innerHTML.trim().length < 20) {
    renderFatalBlankFix("Halaman belum berhasil dimuat. Coba refresh halaman.");
  }
}, 5000);

function showPopupNotification(type = "error", title = "Terjadi Kesalahan", message = "Ada sesuatu yang gagal diproses.") {
  const oldPopup = document.getElementById("appPopupNotification");
  if (oldPopup) oldPopup.remove();

  const iconMap = {
    success: "✓",
    warning: "!",
    error: "×",
    info: "i"
  };

  const actionText = type === "success" ? "Oke, lanjut" : "Saya mengerti";
  const icon = iconMap[type] || iconMap.error;
  const safeTitle = typeof esc === "function" ? esc(title) : String(title).replace(/[&<>"']/g, "");
  const safeMessage = typeof esc === "function" ? esc(message) : String(message).replace(/[&<>"']/g, "");

  const popup = document.createElement("div");
  popup.id = "appPopupNotification";
  popup.className = `app-popup-notification ${type}`;
  popup.setAttribute("role", "dialog");
  popup.setAttribute("aria-modal", "true");

  popup.innerHTML = `
    <div class="app-popup-card">
      <button class="app-popup-close" type="button" aria-label="Tutup">×</button>

      <div class="app-popup-icon">${icon}</div>

      <div class="app-popup-content">
        <span class="app-popup-kicker">${type === "success" ? "Berhasil" : type === "warning" ? "Perlu Dicek" : "Gagal Diproses"}</span>
        <h3>${safeTitle}</h3>
        <p>${safeMessage}</p>
      </div>

      <button class="btn btn-primary app-popup-action" type="button">${actionText}</button>
    </div>
  `;

  document.body.appendChild(popup);
  document.body.classList.add("popup-open");

  const closePopup = () => {
    popup.classList.add("closing");
    document.body.classList.remove("popup-open");
    setTimeout(() => popup.remove(), 180);
  };

  popup.querySelector(".app-popup-close")?.addEventListener("click", closePopup);
  popup.querySelector(".app-popup-action")?.addEventListener("click", closePopup);

  popup.addEventListener("click", event => {
    if (event.target === popup) closePopup();
  });

  document.addEventListener("keydown", function escClose(event) {
    if (event.key === "Escape" && document.body.contains(popup)) {
      closePopup();
      document.removeEventListener("keydown", escClose);
    }
  });
}


function showCenterConfirm({
  type = "warning",
  title = "Konfirmasi Aksi",
  message = "Aksi ini membutuhkan persetujuan kamu.",
  confirmText = "Lanjutkan",
  cancelText = "Batal",
  danger = false
} = {}) {
  return new Promise(resolve => {
    const oldPopup = document.getElementById("appCenterConfirm");
    if (oldPopup) oldPopup.remove();

    const safeTitle = typeof esc === "function" ? esc(title) : String(title).replace(/[&<>"']/g, "");
    const safeMessage = typeof esc === "function" ? esc(message) : String(message).replace(/[&<>"']/g, "");
    const safeConfirm = typeof esc === "function" ? esc(confirmText) : String(confirmText).replace(/[&<>"']/g, "");
    const safeCancel = typeof esc === "function" ? esc(cancelText) : String(cancelText).replace(/[&<>"']/g, "");

    const iconMap = {
      delete: "!",
      logout: "↪",
      warning: "!",
      info: "i"
    };

    const popup = document.createElement("div");
    popup.id = "appCenterConfirm";
    popup.className = `center-confirm-overlay ${danger ? "danger" : type}`;
    popup.setAttribute("role", "dialog");
    popup.setAttribute("aria-modal", "true");

    popup.innerHTML = `
      <div class="center-confirm-card">
        <div class="center-confirm-icon">${iconMap[type] || iconMap.warning}</div>

        <div class="center-confirm-content">
          <span>${danger ? "Aksi Berisiko" : "Konfirmasi"}</span>
          <h3>${safeTitle}</h3>
          <p>${safeMessage}</p>
        </div>

        <div class="center-confirm-actions">
          <button class="btn center-confirm-cancel" type="button">${safeCancel}</button>
          <button class="btn ${danger ? "btn-danger" : "btn-primary"} center-confirm-ok" type="button">${safeConfirm}</button>
        </div>
      </div>
    `;

    document.body.appendChild(popup);
    document.body.classList.add("confirm-open");

    const closeConfirm = value => {
      popup.classList.add("closing");
      document.body.classList.remove("confirm-open");
      document.removeEventListener("keydown", keyHandler);
      setTimeout(() => popup.remove(), 160);
      resolve(value);
    };

    const keyHandler = event => {
      if (event.key === "Escape") closeConfirm(false);
      if (event.key === "Enter") closeConfirm(true);
    };

    popup.querySelector(".center-confirm-cancel")?.addEventListener("click", () => closeConfirm(false));
    popup.querySelector(".center-confirm-ok")?.addEventListener("click", () => closeConfirm(true));

    popup.addEventListener("click", event => {
      if (event.target === popup) closeConfirm(false);
    });

    document.addEventListener("keydown", keyHandler);
  });
}


function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2600);
}


function keepScrollPosition(scrollY) {
  requestAnimationFrame(() => {
    window.scrollTo({
      top: scrollY,
      left: 0,
      behavior: "auto"
    });
  });
}


function showWarningPopup(title, message) {
  showToast(message);
  showPopupNotification("warning", title, message);
}

function showSuccessPopup(title, message) {
  showToast(message);
  showPopupNotification("success", title, message);
}

function showError(error, fallbackMessage = "Terjadi kesalahan.") {
  console.error(error);

  const code = error?.code || "";
  const rawMessage = error?.message || "";
  let title = "Aksi Gagal";
  let message = fallbackMessage;

  if (code === "permission-denied" || rawMessage.includes("Missing or insufficient permissions")) {
    title = "Akses Ditolak";
    message = "Akun ini belum punya izin untuk membuka data tersebut. Cek rules database atau login dengan akun yang benar.";
  } else if (code === "auth/unauthorized-domain") {
    title = "Domain Belum Diizinkan";
    message = "Domain web ini belum diizinkan untuk login Google. Tambahkan domain ini di pengaturan Authentication.";
  } else if (code === "auth/popup-blocked") {
    title = "Popup Login Diblokir";
    message = "Browser memblokir jendela login. Izinkan popup, lalu coba login lagi.";
  } else if (code === "auth/popup-closed-by-user") {
    title = "Login Dibatalkan";
    message = "Jendela login ditutup sebelum proses selesai. Klik login lagi untuk melanjutkan.";
  } else if (code === "auth/cancelled-popup-request") {
    title = "Login Belum Selesai";
    message = "Masih ada proses login sebelumnya. Tutup popup lama, lalu coba lagi.";
  } else if (rawMessage.includes("missing initial state")) {
    title = "Sesi Login Bermasalah";
    message = "Tutup tab login yang putih, kembali ke web utama, lalu klik Login dengan Google lagi.";
  }

  showToast(message);
  showPopupNotification("error", title, message);
}

function statusClass(status) {
  return "status-" + String(status).toLowerCase().replaceAll(" ", "-");
}

function getPublicProjectsRef() {
  return collection(db, "publicProjects");
}

function getPublicMirrorProjectRef(projectId) {
  return doc(db, "publicProjects", projectId);
}

function getPublicProjectData(project) {
  return {
    id: project.id,
    ownerUid: ADMIN_UID,
    name: project.name || "",
    description: project.description || "",
    tech: project.tech || "",
    status: project.status || "Planning",
    whatsappNumber: project.whatsappNumber || DEFAULT_WHATSAPP_NUMBER,
    manualProgress: project.manualProgress ?? null,
    features: project.features || [],
    bugs: project.bugs || [],
    ideas: project.ideas || [],
    screenshots: project.screenshots || [],
    isPublic: true,
    createdAt: project.createdAt || nowIso(),
    updatedAt: nowIso()
  };
}

async function syncPublicProject(project) {
  if (!isAdminUser() || !project?.id) return;

  try {
    if (project.isPublic) {
      await setDoc(getPublicMirrorProjectRef(project.id), getPublicProjectData(project), { merge: true });
    } else {
      await deleteDoc(getPublicMirrorProjectRef(project.id));
    }
  } catch (error) {
    console.warn("Gagal sync public project:", error);
  }
}

async function syncAllPublicProjects() {
  if (!isAdminUser()) return;

  const syncJobs = projects.map(project => syncPublicProject(project));
  await Promise.allSettled(syncJobs);
}

async function forceSyncPublicProjectsFromAdmin() {
  if (!isAdminUser() || !Array.isArray(projects)) return;

  const publicItems = projects.filter(project => project && project.isPublic === true);
  if (publicItems.length === 0) return;

  await Promise.allSettled(publicItems.map(project => syncPublicProject(project)));
}



function getProjectsRef() {
  const ownerUid = isAdminUser() ? currentUser.uid : ADMIN_UID;
  return collection(db, "users", ownerUid, "projects");
}

function getAdminProjectsRef() {
  return collection(db, "users", ADMIN_UID, "projects");
}

function getProjectRef(projectId) {
  return doc(db, "users", currentUser.uid, "projects", projectId);
}

function getUserProjectRef(ownerUid, projectId) {
  return doc(db, "users", ownerUid, "projects", projectId);
}

function getKeysRef(ownerUid, projectId) {
  return collection(db, "users", ownerUid, "projects", projectId, "keys");
}

function getKeyRef(ownerUid, projectId, key) {
  return doc(db, "users", ownerUid, "projects", projectId, "keys", normalizeKey(key));
}

function getProjectPrivateRef(ownerUid, projectId) {
  return doc(db, "users", ownerUid, "projects", projectId, "private", "settings");
}

function getProject(id) {
  return projects.find(project => project.id === id);
}

function getBaseUrl() {
  return window.location.href.split("#")[0];
}

function getProjectShareUrl(project, ownerUid = currentUser?.uid) {
  if (!ownerUid || !project) return "";
  return `${getBaseUrl()}#/share/${ownerUid}/${project.id}`;
}

function parseShareRoute() {
  const match = window.location.hash.match(/^#\/share\/([^/]+)\/([^/]+)$/);
  if (!match) return null;

  return {
    userId: match[1],
    projectId: match[2]
  };
}

function normalizeProjectData(id, data) {
  return {
    id,
    ...data,
    features: data.features || [],
    bugs: data.bugs || [],
    ideas: data.ideas || [],
    screenshots: data.screenshots || [],
    isPublic: data.isPublic || false,
    whatsappNumber: data.whatsappNumber || DEFAULT_WHATSAPP_NUMBER,
    manualProgress: Number.isFinite(Number(data.manualProgress)) ? Number(data.manualProgress) : null
  };
}

function getProgress(project) {
  const manual = clampNumber(project.manualProgress, 0, 100);
  if (manual !== null) return manual;

  const features = project.features || [];

  if (features.length > 0) {
    const totalScore = features.reduce((total, item) => {
      if (item.status === "Selesai") return total + 1;
      if (item.status === "Proses") return total + 0.5;
      return total;
    }, 0);

    return Math.round((totalScore / features.length) * 100);
  }

  if (project.status === "Completed") return 100;
  if (project.status === "Testing") return 80;
  if (project.status === "Bug Fixing") return 65;
  if (project.status === "In Progress") return 45;
  return 0;
}

function countOpenBugs() {
  return projects.reduce((total, project) => {
    return total + (project.bugs || []).filter(bug => bug.status !== "Selesai").length;
  }, 0);
}

function countDoneFeatures() {
  return projects.reduce((total, project) => {
    return total + (project.features || []).filter(feature => feature.status === "Selesai").length;
  }, 0);
}

function cleanWhatsAppNumber(value) {
  let number = String(value || DEFAULT_WHATSAPP_NUMBER).replace(/\D/g, "");

  if (number.startsWith("0")) {
    number = "62" + number.slice(1);
  }

  return number || DEFAULT_WHATSAPP_NUMBER;
}

function getWhatsAppKeyUrl(project, ownerUid = "") {
  const number = cleanWhatsAppNumber(project?.whatsappNumber || DEFAULT_WHATSAPP_NUMBER);
  const message = buildBuyKeyWhatsAppMessage(project, ownerUid);

  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function generateKeyCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const part = (length) => Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `CP-${part(4)}-${part(4)}-${part(4)}`;
}

function getAccessStorageKey(ownerUid, projectId) {
  return `codeprogress_access_key_${ownerUid}_${projectId}`;
}

function hasSafeSourceAccess(access = publicAccess) {
  return Boolean(
    access?.fileUrl &&
    isSafeExternalUrl(access.fileUrl, {
      allowLocalHttp: true,
      allowedHosts: SECURITY_CONFIG.allowedDownloadHosts
    })
  );
}

async function syncProjectKeysFileUrl(projectId, fileUrl, projectName = "") {
  if (!isAdminUser() || !projectId || !fileUrl) return;

  try {
    const snapshot = await getDocs(getKeysRef(currentUser.uid, projectId));
    const jobs = snapshot.docs.map(item => {
      const data = item.data() || {};
      const nextData = {
        fileUrl,
        updatedAt: nowIso()
      };

      if (projectName) {
        nextData.projectName = projectName;
      }

      if (data.projectId !== projectId) {
        nextData.projectId = projectId;
      }

      return updateDoc(item.ref, nextData);
    });

    await Promise.allSettled(jobs);
  } catch (error) {
    console.warn("Gagal sinkron link source code ke key lama:", error);
  }
}

function getAccessDocFromSnapshot(snapshot) {
  if (!snapshot.exists()) return null;
  const data = snapshot.data();

  if (!currentUser || data.usedBy !== currentUser.uid) {
    return null;
  }

  return {
    id: snapshot.id,
    ...data
  };
}

/* AUTH */

async function loginGoogle() {
  try {
    showToast("Membuka login Google...");

    await setPersistence(auth, browserLocalPersistence);
    await signInWithPopup(auth, provider);

    showToast("Login berhasil");
  } catch (error) {
    const code = error?.code || "";

    if (
      code === "auth/popup-blocked" ||
      code === "auth/cancelled-popup-request" ||
      code === "auth/popup-closed-by-user"
    ) {
      showWarningPopup("Login Gagal", "Login dibatalkan atau popup diblokir. Aktifkan popup lalu coba lagi.");
      return;
    }

    showError(error, "Login Google gagal. Tutup tab login yang error, lalu coba login lagi dari halaman utama.");
  }
}

async function logout() {
  const confirmLogout = await showCenterConfirm({
    type: "logout",
    title: "Keluar dari akun?",
    message: "Kamu akan keluar dari CodeProgress. Data project tetap tersimpan dan bisa dibuka lagi setelah login.",
    confirmText: "Ya, Logout",
    cancelText: "Tetap Login",
    danger: false
  });

  if (!confirmLogout) return;

  try {
    if (unsubscribeProjects) unsubscribeProjects();
    unsubscribeProjects = null;
    if (publicOwnerUid && publicProject?.id) {
      localStorage.removeItem(getAccessStorageKey(publicOwnerUid, publicProject.id));
    }
    publicAccess = null;
    await signOut(auth);
  } catch (error) {
    showError(error, "Logout gagal.");
  }
}

/* PUBLIC PAGE */

function renderPublicLoading() {
  root.innerHTML = `
    <main class="public-page">
      <nav class="public-nav">
        <div class="brand public-brand">
          <div class="logo" aria-label="CodeProgress logo">
            <svg viewBox="0 0 48 48" role="img" aria-hidden="true">
              <rect x="6" y="6" width="36" height="36" rx="12"></rect>
              <path d="M17 19L12 24L17 29"></path>
              <path d="M31 19L36 24L31 29"></path>
              <path d="M27 15L21 33"></path>
            </svg>
          </div>
          <div>
            <h2>CodeProgress</h2>
            <span>Code Showcase</span>
          </div>
        </div>
        <a class="btn" href="${getBaseUrl()}">Buka Dashboard</a>
      </nav>

      <section class="public-state">
        <div class="loader-ring"></div>
        <h1>Mengambil project...</h1>
        <p>Data project sedang dimuat dari sistem.</p>
      </section>
    </main>
  `;
}

function renderPublicNotFound(message = "Project tidak ditemukan atau belum dibuka untuk publik.") {
  root.innerHTML = `
    <main class="public-page">
      <nav class="public-nav">
        <div class="brand public-brand">
          <div class="logo" aria-label="CodeProgress logo">
            <svg viewBox="0 0 48 48" role="img" aria-hidden="true">
              <rect x="6" y="6" width="36" height="36" rx="12"></rect>
              <path d="M17 19L12 24L17 29"></path>
              <path d="M31 19L36 24L31 29"></path>
              <path d="M27 15L21 33"></path>
            </svg>
          </div>
          <div>
            <h2>CodeProgress</h2>
            <span>Code Showcase</span>
          </div>
        </div>
        <a class="btn btn-primary" href="${getBaseUrl()}">Buka Dashboard</a>
      </nav>

      <section class="public-state">
        <div class="public-icon">!</div>
        <h1>Project tidak bisa dibuka</h1>
        <p>${esc(message)}</p>
      </section>
    </main>
  `;
}

function publicStatusBadge(status) {
  return `<span class="badge-status ${statusClass(status)}">${esc(status || "No Status")}</span>`;
}

function renderPublicItemList(items, emptyText) {
  if (!items || items.length === 0) {
    return `<div class="empty">${esc(emptyText)}</div>`;
  }

  return items.map(item => `
    <div class="public-list-item">
      <div>
        <strong>${esc(item.title)}</strong>
        <small>${formatDate(item.createdAt)}</small>
      </div>
      <span class="badge-status">${esc(item.status)}</span>
    </div>
  `).join("");
}

function renderProjectAccessCard(project, ownerUid, variant = "public") {
  const waUrl = getWhatsAppKeyUrl(project, ownerUid);
  const hasWa = Boolean(cleanWhatsAppNumber(project.whatsappNumber));
  const hasAccess = hasSafeSourceAccess(publicAccess);
  const wrapperClass = variant === "viewer" ? "viewer-access-card" : "public-download-card";

  return `
    <section class="${wrapperClass}">
      <div>
        <span class="badge">Akses Source Code</span>
        <h2>Source code dikunci pakai key</h2>
        <p class="access-description-text">
          Untuk membuka file web atau source code, login dulu lalu beli key akses ke admin.
          Key hanya berlaku untuk satu akun dan satu project.
        </p>
      </div>

      <div class="download-action-box">
        ${
          !currentUser
            ? `<button class="btn btn-primary btn-big" data-public-login="true">Login dulu untuk akses file</button>`
            : hasAccess
              ? `
                <a
                  class="btn btn-primary btn-big"
                  href="${esc(safeExternalHref(publicAccess.fileUrl))}"
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                >Download / Buka Source Code</a>
                <button class="btn btn-ghost btn-full" type="button" data-copy-source-url="${esc(safeExternalHref(publicAccess.fileUrl))}">Copy Link Download</button>
              `
              : `
                ${hasWa ? `
` : ""}
                <form class="key-form" id="claimKeyForm">
                  <label>Masukkan key akses</label>
                  <input type="text" id="accessKeyInput" placeholder="Contoh: CP-ABCD-1234-EFGH" required />
                  <button class="btn btn-primary btn-full" type="submit">Buka Akses Source Code</button>
                </form>
              `
        }

        <small>
          ${
            !currentUser
              ? "Login dibutuhkan agar satu key hanya terikat ke satu akun."
              : hasAccess
                ? `Key aktif: ${esc(publicAccess.key)} • link download hanya muncul untuk akun yang key-nya valid.`
                : publicAccess?.key && !hasAccess
                  ? "Key valid, tapi link source code belum tersimpan di key ini. Admin perlu klik Edit Project → Simpan Perubahan, lalu refresh halaman."
                  : renderWhatsAppAdminText(project)
          }
        </small>
      </div>
    </section>
  `;
}

function renderPublicFileCard(project, ownerUid) {
  return renderProjectAccessCard(project, ownerUid, "public");
}

function renderPublicProject(project, ownerUid) {
  const progress = getProgress(project);
  const features = project.features || [];
  const bugs = project.bugs || [];
  const ideas = project.ideas || [];
  const screenshots = project.screenshots || [];
  const doneFeatures = features.filter(item => item.status === "Selesai").length;
  const openBugs = bugs.filter(item => item.status !== "Selesai").length;
  const techList = String(project.tech || "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);

  const heroImage = screenshots[0]?.url || "";

  root.innerHTML = `
    <main class="public-page">
      <nav class="public-nav">
        <div class="brand public-brand">
          <div class="logo" aria-label="CodeProgress logo">
            <svg viewBox="0 0 48 48" role="img" aria-hidden="true">
              <rect x="6" y="6" width="36" height="36" rx="12"></rect>
              <path d="M17 19L12 24L17 29"></path>
              <path d="M31 19L36 24L31 29"></path>
              <path d="M27 15L21 33"></path>
            </svg>
          </div>
          <div>
            <h2>CodeProgress</h2>
            <span>Code Showcase</span>
          </div>
        </div>

        ${
          currentUser
            ? `<a class="btn public-account-pill" href="${getBaseUrl()}">Dashboard</a>`
            : `<button class="btn btn-primary" data-public-login="true">Login</button>`
        }
      </nav>

      <section class="public-hero">
        <div class="public-hero-content">
          <div class="public-badge-row">
            <span class="badge">Code Showcase</span>
            ${publicStatusBadge(project.status)}
          </div>

          <h1>${esc(project.name)}</h1>
          ${renderFormattedDescription(project.description, "Belum ada deskripsi project.")}

          <div class="public-tech-summary tech-summary-box">
            <span class="tech-summary-label">Teknologi</span>
            ${renderTechBadges(project.tech, "Belum dicatat")}
          </div>

          <div class="public-progress-card">
            <div class="progress-info">
              <span>Progress project</span>
              <strong>${progress}%</strong>
            </div>
            <div class="progress">
              <div class="progress-bar" style="width: ${progress}%"></div>
            </div>
          </div>
        </div>

        <div class="public-preview public-preview-small-photos">
          ${
            screenshots.length > 0
              ? `<div class="public-hero-photo-strip center-middle-photos photo-scroll-v2" aria-label="Foto project">
                  ${screenshots.map(shot => `
                    <a class="public-hero-thumb" href="${esc(shot.displayUrl || shot.url)}" target="_blank" rel="noopener">
                      <img src="${esc(shot.displayUrl || shot.url)}" alt="${esc(shot.name)}" loading="lazy" />
                    </a>
                  `).join("")}
                </div>`
              : `<div class="code-window">
                  <div class="code-dots"><span></span><span></span><span></span></div>
                  <pre>&lt;project&gt;\n  status: ${esc(project.status)}\n  progress: ${progress}%\n&lt;/project&gt;</pre>
                </div>`
          }
        </div>
      </section>

      ${renderPublicFileCard(project, ownerUid)}

      <section class="grid public-stats">
        <div class="stat-card">
          <span>Fitur Selesai</span>
          <h3>${doneFeatures}</h3>
        </div>
        <div class="stat-card">
          <span>Total Fitur</span>
          <h3>${features.length}</h3>
        </div>
        <div class="stat-card">
          <span>Bug Terbuka</span>
          <h3>${openBugs}</h3>
        </div>
        <div class="stat-card">
          <span>Ide Update</span>
          <h3>${ideas.length}</h3>
        </div>
      </section>

      <section class="public-content-grid">
        <div class="grid">
          <div class="card public-section-card">
            <div class="section-title">
              <h2>Fitur Project</h2>
              <span class="badge-status">${features.length} item</span>
            </div>
            <div class="public-list">
              ${renderPublicItemList(features, "Belum ada fitur yang dicatat.")}
            </div>
          </div>

          <div class="card public-section-card">
            <div class="section-title">
              <h2>Bug</h2>
              <span class="badge-status">${bugs.length} item</span>
            </div>
            <div class="public-list">
              ${renderPublicItemList(bugs, "Belum ada bug yang dicatat.")}
            </div>
          </div>

          <div class="card public-section-card">
            <div class="section-title">
              <h2>Ide Update</h2>
              <span class="badge-status">${ideas.length} item</span>
            </div>
            <div class="public-list">
              ${renderPublicItemList(ideas, "Belum ada ide update.")}
            </div>
          </div>
        </div>

        <aside class="grid">
          <div class="card public-section-card">
            <div class="section-title">
              <h2>Info Project</h2>
            </div>

            <div class="profile-row">
              <span>Status</span>
              <strong>${esc(project.status || "-")}</strong>
            </div>

            <div class="profile-row">
              <span>Progress</span>
              <strong>${progress}%</strong>
            </div>

            <div class="profile-row">
              <span>Teknologi</span>
              <strong>${esc(project.tech || "Belum diisi")}</strong>
            </div>

            <div class="profile-row">
              <span>Dibuat</span>
              <strong>${formatDate(project.createdAt)}</strong>
            </div>
          </div>

          <div class="card public-section-card">
            <div class="section-title">
              <h2>Foto Project</h2>
              <span class="badge-status">${screenshots.length}</span>
            </div>

            ${
              screenshots.length === 0
                ? `<div class="empty">Belum ada foto project.</div>`
                : `<div class="photo-carousel public-photo-carousel center-middle-photos photo-scroll-v2" aria-label="Foto project">
                    ${screenshots.map(shot => `
                      <a class="photo-slide public-shot" href="${esc(shot.displayUrl || shot.url)}" target="_blank" rel="noopener">
                        <img src="${esc(shot.displayUrl || shot.url)}" alt="${esc(shot.name)}" loading="lazy" />
                      </a>
                    `).join("")}
                  </div>`
            }
          </div>
        </aside>
      </section>

      <footer class="public-footer">
        <span>CodeProgress Code Showcase</span>
      </footer>
    </main>
  `;

  setTimeout(hydratePhotoCarousels, 80);
  setTimeout(refreshPhotoGalleries, 100);
  setTimeout(setStaticMiddlePhotos, 90);
}

async function loadStoredAccess(ownerUid, projectId) {
  publicAccess = null;

  if (!currentUser) return;

  const savedKey = localStorage.getItem(getAccessStorageKey(ownerUid, projectId));
  if (!savedKey) return;

  try {
    const snap = await getDoc(getKeyRef(ownerUid, projectId, savedKey));
    publicAccess = getAccessDocFromSnapshot(snap);
  } catch (error) {
    console.warn("Gagal cek akses lama:", error);
  }
}

async function loadPublicProject(ownerUid, projectId) {
  renderPublicLoading();

  try {
    let project = null;
    let actualOwnerUid = ownerUid;

    /*
      Fix public link:
      Jangan langsung baca users/{uid}/projects/{id} karena rules ketat bisa menolak member/guest.
      Ambil data public dari mirror publicProjects/{projectId} dulu.
      Kalau mirror belum ada, baru fallback ke project admin yang isPublic = true.
    */
    const publicSnap = await getDoc(getPublicMirrorProjectRef(projectId));

    if (publicSnap.exists()) {
      const publicData = publicSnap.data();

      if (publicData.ownerUid && publicData.ownerUid !== ownerUid) {
        renderPublicNotFound("Link public tidak cocok dengan pemilik project.");
        return;
      }

      project = normalizeProjectData(publicSnap.id, publicData);
      actualOwnerUid = publicData.ownerUid || ownerUid;
    } else {
      const privateSnap = await getDoc(getUserProjectRef(ownerUid, projectId));

      if (!privateSnap.exists()) {
        renderPublicNotFound("Project public belum tersedia. Admin perlu membuka dashboard sekali atau mengaktifkan ulang share project.");
        return;
      }

      project = normalizeProjectData(privateSnap.id, privateSnap.data());
      actualOwnerUid = ownerUid;
    }

    if (!project.isPublic) {
      renderPublicNotFound("Pemilik project belum mengaktifkan mode public.");
      return;
    }

    publicProject = project;
    publicOwnerUid = actualOwnerUid;

    await loadStoredAccess(actualOwnerUid, projectId);
    renderPublicProject(project, actualOwnerUid);
    setTimeout(photoProjectScrollV2, 120);
  } catch (error) {
    console.error(error);

    if (error?.code === "permission-denied") {
      renderPublicNotFound("Akses public ditolak oleh Firestore Rules. Pasang ulang firestore.rules terbaru dari ZIP ini, lalu refresh.");
      return;
    }

    renderPublicNotFound("Gagal membuka project. Cek koneksi internet atau coba refresh halaman.");
  }
}

function handleRoute() {
  const route = parseShareRoute();

  if (route) {
    if (unsubscribeProjects) {
      unsubscribeProjects();
      unsubscribeProjects = null;
    }

    if (unsubscribeKeys) {
      unsubscribeKeys();
      unsubscribeKeys = null;
      keysProjectId = null;
    }

    loadPublicProject(route.userId, route.projectId);
    return true;
  }

  return false;
}

async function claimAccessKey(keyValue) {
  const key = normalizeKey(keyValue);

  if (isClaimingKey) {
    showWarningPopup("Sedang Diproses", "Tunggu proses key sebelumnya selesai dulu.");
    return;
  }

  if (!currentUser) {
    showWarningPopup(
      "Login Diperlukan",
      "Login dengan Google dulu agar key bisa dikunci ke akun kamu."
    );
    await loginGoogle();
    return;
  }

  if (!publicProject || !publicOwnerUid) {
    showWarningPopup(
      "Project Belum Siap",
      "Data project belum selesai dimuat. Tunggu sebentar, lalu coba lagi."
    );
    return;
  }

  const lockInfo = getKeyLockInfo(publicOwnerUid, publicProject.id);
  if (lockInfo.locked) {
    showWarningPopup(
      "Percobaan Dikunci",
      `Tunggu ${lockInfo.remainingSeconds} detik sebelum mencoba key lagi.`
    );
    return;
  }

  if (!key) {
    showWarningPopup(
      "Key Belum Diisi",
      "Masukkan key akses yang kamu dapat dari admin untuk membuka source code."
    );
    return;
  }

  if (!SECURITY_CONFIG.keyPattern.test(key)) {
    const attempt = registerFailedKeyAttempt(publicOwnerUid, publicProject.id);
    showWarningPopup(
      "Format Key Salah",
      `Format key harus seperti CP-ABCD-1234-EFGH. ${renderKeyAttemptWarning(attempt)}`
    );
    return;
  }

  const keyRef = getKeyRef(publicOwnerUid, publicProject.id, key);
  isClaimingKey = true;
  setClaimKeyLoading(true);

  try {
    /*
      Lebih aman: jangan getDoc() key sebelum update.
      Rules hanya mengizinkan member update key valid yang belum dipakai,
      lalu member baru boleh baca key setelah usedBy = uid miliknya.
    */
    await updateDoc(keyRef, {
      isUsed: true,
      usedBy: currentUser.uid,
      usedByEmail: currentUser.email || "",
      usedByName: currentUser.displayName || "",
      usedAt: serverTimestamp()
    });

    const afterSnap = await getDoc(keyRef);
    const access = getAccessDocFromSnapshot(afterSnap);

    if (!access) {
      showWarningPopup(
        "Akses Belum Terbaca",
        "Key berhasil dikunci ke akun kamu, tapi akses belum terbaca. Refresh halaman lalu coba buka lagi."
      );
      return;
    }

    if (!isSafeExternalUrl(access.fileUrl, { allowLocalHttp: true })) {
      showWarningPopup(
        "Link File Diblokir",
        "Key valid, tetapi link file diblokir karena tidak aman. Hubungi admin untuk memperbarui link source code."
      );
      return;
    }

    clearKeyAttempts(publicOwnerUid, publicProject.id);
    localStorage.setItem(getAccessStorageKey(publicOwnerUid, publicProject.id), key);

    publicAccess = access;
    renderPublicProject(publicProject, publicOwnerUid);

    showSuccessPopup(
      "Akses Berhasil Dibuka",
      "Key valid. Source code untuk project ini sekarang bisa kamu buka."
    );
  } catch (error) {
    try {
      const ownSnap = await getDoc(keyRef);
      const ownAccess = getAccessDocFromSnapshot(ownSnap);

      if (ownAccess) {
        if (!isSafeExternalUrl(ownAccess.fileUrl, { allowLocalHttp: true })) {
          showWarningPopup("Link File Tidak Aman", "Akses key terbaca, tetapi link file diblokir karena tidak aman.");
          return;
        }

        clearKeyAttempts(publicOwnerUid, publicProject.id);
        localStorage.setItem(getAccessStorageKey(publicOwnerUid, publicProject.id), key);
        publicAccess = ownAccess;
        renderPublicProject(publicProject, publicOwnerUid);

        showSuccessPopup(
          "Akses Sudah Aktif",
          "Key ini sudah terhubung dengan akun kamu. Source code bisa dibuka sekarang."
        );
        return;
      }
    } catch {}

    const attempt = registerFailedKeyAttempt(publicOwnerUid, publicProject.id);

    if (error?.code === "permission-denied") {
      showWarningPopup(
        "Key Ditolak",
        `Key salah, sudah dipakai akun lain, atau tidak terdaftar. ${renderKeyAttemptWarning(attempt)}`
      );
      return;
    }

    showPopupNotification(
      "error",
      "Key Gagal Diproses",
      "Koneksi atau sistem sedang bermasalah. Refresh halaman, lalu coba masukkan key lagi."
    );
  } finally {
    isClaimingKey = false;
    setClaimKeyLoading(false);
  }
}

/* PRIVATE DASHBOARD */

function stopKeysListener() {
  if (unsubscribeKeys) {
    unsubscribeKeys();
    unsubscribeKeys = null;
  }

  keysProjectId = null;
  currentProjectKeys = [];
}

function listenKeysForProject(projectId) {
  if (!currentUser || !projectId) return;
  if (keysProjectId === projectId && unsubscribeKeys) return;

  stopKeysListener();

  keysProjectId = projectId;
  const q = query(getKeysRef(currentUser.uid, projectId), orderBy("createdAt", "desc"));

  unsubscribeKeys = onSnapshot(q, (snapshot) => {
    currentProjectKeys = snapshot.docs.map(item => {
      return {
        id: item.id,
        ...item.data()
      };
    });

    if (activeView === "detail" && currentProjectId === projectId) {
      renderProjectDetail();
    setTimeout(forceTopAfterDetailRender, 60);
  setTimeout(photoProjectScrollV2, 120);
    }
  }, (error) => {
    console.warn("Gagal mengambil key:", error);
  });
}

function listenProjects() {
  if (!currentUser) return;
  if (unsubscribeProjects) unsubscribeProjects();

  isLoadingProjects = true;

  const projectsQuery = isAdminUser()
    ? query(getProjectsRef())
    : query(getPublicProjectsRef());

  unsubscribeProjects = onSnapshot(projectsQuery, (snapshot) => {
    const allProjects = snapshot.docs.map(document => {
      return normalizeProjectData(document.id, document.data());
    });

    projects = isAdminUser()
      ? allProjects
      : allProjects.filter(project => project.isPublic === true);

    projects.sort((a, b) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
      return (dateB || 0) - (dateA || 0);
    });

    isLoadingProjects = false;
    render();

    if (isAdminUser()) {
      setTimeout(() => forceSyncPublicProjectsFromAdmin(), 250);
    }
  }, (error) => {
    isLoadingProjects = false;
    render();

    if (!isAdminUser()) {
      showError(error, "Project public belum bisa ditampilkan. Update rules terbaru lalu refresh.");
      return;
    }

    showError(error, "Gagal mengambil data project. Cek rules dan koneksi internet.");
  });
}

function renderAppContent() {
  if (parseShareRoute()) {
    handleRoute();
    return;
  }

  if (!currentUser) {
    renderLogin();
    return;
  }

  if (activeView !== "detail") {
    stopKeysListener();
  }

  root.innerHTML = `
    <div class="app">
      <aside class="sidebar">
        <div class="brand">
          <div class="logo" aria-label="CodeProgress logo">
            <svg viewBox="0 0 48 48" role="img" aria-hidden="true">
              <rect x="6" y="6" width="36" height="36" rx="12"></rect>
              <path d="M17 19L12 24L17 29"></path>
              <path d="M31 19L36 24L31 29"></path>
              <path d="M27 15L21 33"></path>
            </svg>
          </div>
          <div>
            <h2>CodeProgress</h2>
            <span>Code Reference & Progress Hub</span>
          </div>
        </div>

        ${activeView === "detail" ? "" : `
        <nav class="nav">
          <button class="btn ${activeView === "dashboard" ? "active" : ""}" data-view="dashboard">Dashboard</button>
          <button class="btn ${activeView === "projects" ? "active" : ""}" data-view="projects">Project</button>
          <button class="btn ${activeView === "profile" ? "active" : ""}" data-view="profile">Profile</button>
        </nav>
        `}


      </aside>

      <main class="main" id="mainContent"></main>
    </div>
  `;

  if (activeView === "dashboard") renderDashboard();
  if (activeView === "projects") renderProjects();
  if (activeView === "detail") renderProjectDetail();
  if (activeView === "profile") renderProfile();
}








function setStaticMiddlePhotos() {
  const galleries = document.querySelectorAll(".center-middle-photos");

  galleries.forEach(gallery => {
    const items = Array.from(gallery.querySelectorAll(".photo-slide, .shot, .public-shot, .public-hero-thumb"));
    if (!items.length) return;

    const middleIndex = Math.floor(items.length / 2);

    items.forEach((item, index) => {
      item.classList.toggle("is-middle-photo", index === middleIndex);
    });
  });
}

function centerMiddlePhotoGalleries() {
  const galleries = document.querySelectorAll(".center-middle-photos");

  galleries.forEach(gallery => {
    const items = Array.from(gallery.querySelectorAll(".photo-slide, .shot, .public-shot, .public-hero-thumb"));
    if (!items.length) return;

    const middleIndex = Math.floor(items.length / 2);
    const middleItem = items[middleIndex];

    items.forEach((item, index) => {
      item.classList.toggle("is-middle-photo", index === middleIndex);
    });

    requestAnimationFrame(() => {
      const maxScroll = Math.max(0, gallery.scrollWidth - gallery.clientWidth);
      const target =
        middleItem.offsetLeft -
        (gallery.clientWidth / 2) +
        (middleItem.offsetWidth / 2);

      gallery.scrollLeft = Math.min(Math.max(target, 0), maxScroll);
    });
  });
}

function hydrateBoundedPhotoScroll() {
  const galleries = document.querySelectorAll(".center-middle-photos");

  galleries.forEach(gallery => {
    if (gallery.dataset.boundedScrollReady === "true") return;
    gallery.dataset.boundedScrollReady = "true";

    gallery.addEventListener("scroll", () => {
      const maxScroll = Math.max(0, gallery.scrollWidth - gallery.clientWidth);

      if (gallery.scrollLeft < 0) gallery.scrollLeft = 0;
      if (gallery.scrollLeft > maxScroll) gallery.scrollLeft = maxScroll;
    }, { passive: true });
  });
}

function refreshPhotoGalleries() {
  setStaticMiddlePhotos();
  hydrateBoundedPhotoScroll();
  setTimeout(centerMiddlePhotoGalleries, 80);
  setTimeout(centerMiddlePhotoGalleries, 250);
}

function hydratePhotoCarousels() {
  const carousels = document.querySelectorAll(".photo-carousel");

  carousels.forEach(carousel => {
    const slides = Array.from(carousel.querySelectorAll(".photo-slide"));
    if (!slides.length) return;

    carousel.classList.toggle("single", slides.length === 1);

    const setActiveSlide = () => {
      const rect = carousel.getBoundingClientRect();
      const center = rect.left + rect.width / 2;

      let activeSlide = slides[0];
      let smallestDistance = Infinity;

      slides.forEach(slide => {
        const slideRect = slide.getBoundingClientRect();
        const slideCenter = slideRect.left + slideRect.width / 2;
        const distance = Math.abs(center - slideCenter);

        if (distance < smallestDistance) {
          smallestDistance = distance;
          activeSlide = slide;
        }
      });

      slides.forEach(slide => {
        slide.classList.toggle("is-active", slide === activeSlide);
      });
    };

    if (!carousel.dataset.carouselReady) {
      carousel.dataset.carouselReady = "true";

      let ticking = false;
      carousel.addEventListener("scroll", () => {
        if (ticking) return;

        ticking = true;
        requestAnimationFrame(() => {
          setActiveSlide();
          ticking = false;
        });
      }, { passive: true });

      slides.forEach(slide => {
        slide.addEventListener("click", event => {
          if (event.target.closest("button")) return;
          slide.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
            inline: "center"
          });
        });
      });
    }

    setTimeout(setActiveSlide, 60);
  });
}



function scrollPageToTopInstant() {
  requestAnimationFrame(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "instant"
    });

    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  });
}

function scrollPageToTopSmooth() {
  requestAnimationFrame(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "smooth"
    });
  });
}



function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function switchTabView(nextView) {
  if (!nextView || activeView === nextView) return;

  const main = document.getElementById("mainContent");
  const nextBtn = document.querySelector(`.nav [data-view="${nextView}"]`);

  if (nextBtn) {
    nextBtn.classList.remove("tab-activated");
    nextBtn.classList.add("tab-clicking");
    setTimeout(() => nextBtn.classList.remove("tab-clicking"), 220);
  }

  if (main) {
    main.classList.remove("view-switch-in", "view-switch-in-active");
    main.classList.add("view-switch-out");
    await wait(170);
  }

  activeView = nextView;
  render();

  requestAnimationFrame(() => {
    const freshMain = document.getElementById("mainContent");
    const freshBtn = document.querySelector(`.nav [data-view="${nextView}"]`);

    if (freshMain) {
      freshMain.classList.add("view-switch-in");
      requestAnimationFrame(() => {
        freshMain.classList.add("view-switch-in-active");
      });
      setTimeout(() => {
        freshMain.classList.remove("view-switch-in", "view-switch-in-active");
      }, 360);
    }

    if (freshBtn) {
      freshBtn.classList.add("tab-activated");
      setTimeout(() => freshBtn.classList.remove("tab-activated"), 460);
    }
  });
}

function render() {
  try {
    renderAppContent();

    setTimeout(() => {
      const appEl = document.getElementById("root");
      const hasRealContent = appEl && appEl.textContent && appEl.textContent.trim().length > 10;

      hydratePhotoCarousels();
      refreshPhotoGalleries();
      setStaticMiddlePhotos();

      if (!hasRealContent) {
        console.warn("Render kosong terdeteksi. Menampilkan halaman login fallback.");
        renderLogin();
      }
    }, 120);
  } catch (error) {
    console.error("Render gagal:", error);

    try {
      renderLogin();

      if (typeof showPopupNotification === "function") {
        showPopupNotification(
          "error",
          "Halaman Gagal Dimuat",
          "Ada bagian web yang gagal diproses. Saya tampilkan halaman login agar web tetap bisa digunakan."
        );
      }
    } catch (loginError) {
      console.error("Fallback login gagal:", loginError);
      const appEl = document.getElementById("root") || document.body;
      appEl.innerHTML = `
        <section class="blank-hard-fix-page">
          <div class="blank-hard-fix-card">
            <div class="blank-hard-fix-icon">!</div>
            <h1>Web gagal dimuat</h1>
            <p>Terjadi error saat membuka aplikasi. Refresh halaman atau upload ZIP fix terbaru.</p>
            <button onclick="window.location.reload()">Refresh Halaman</button>
          </div>
        </section>
      `;
    }
  }
}



function renderNoAdminAccess() {
  root.innerHTML = `
    <section class="login-page">
      <div class="hero-card">
        <div class="badge">Akses dibatasi</div>
        <h1>Dashboard hanya untuk <span class="gradient-text">admin</span>.</h1>
        <p>
          Akun ini berhasil login, tapi tidak punya akses admin untuk mengelola project.
          Kamu masih bisa menggunakan link public untuk memasukkan key akses file.
        </p>

        <div class="feature-list">
          <div class="feature-item">Akses admin dibatasi</div>
          <div class="feature-item">Akun ini: ${esc(currentUser?.email || "-")}</div>
          <div class="feature-item">Dashboard dikunci</div>
          <div class="feature-item">Public link tetap bisa dipakai</div>
        </div>
      </div>

      <div class="login-card">
        <h2>Bukan akun admin</h2>
        <p>Silakan logout lalu masuk memakai akun admin yang benar.</p>

        <button class="btn btn-danger btn-full" id="logoutBtn">Logout</button>

        <div class="setup-note">
          Akses admin hanya diberikan ke akun pemilik sistem.
        </div>
      </div>
    </section>
  `;
}

function renderLogin() {
  root.innerHTML = `
    <section class="login-page login-pro-page">
      <div class="login-pro-hero">
        <div class="login-pro-brand">
          <div class="login-pro-logo">
            ${safeIconSvg("code")}
          </div>
          <div>
            <h2>CodeProgress</h2>
            <p>Code Reference & Progress Hub</p>
          </div>
        </div>

        <div class="login-pro-copy">
          <span class="login-pro-chip">CodeProgress System</span>
          <h1>Referensi project dan source code siap pakai.</h1>
          <p>
            Lihat progress coding, jadikan project sebagai referensi,
            lalu beli source code jika kamu membutuhkannya.
          </p>
        </div>

        <div class="login-pro-role-grid">
          <div class="login-pro-role-card">
            <div class="login-pro-role-icon">${safeIconSvg("admin")}</div>
            <div>
              <h3>Admin</h3>
              <p>Kelola project dan generate key.</p>
            </div>
          </div>

          <div class="login-pro-role-card">
            <div class="login-pro-role-icon">${safeIconSvg("viewer")}</div>
            <div>
              <h3>Member</h3>
              <p>Lihat referensi dan beli source code.</p>
            </div>
          </div>
        </div>
      </div>

      <div class="login-pro-panel">
        <div class="login-pro-panel-head">
          <span>Secure Access</span>
          <h2>Masuk ke akun</h2>
          <p>
            Login dengan Google untuk masuk sebagai admin atau member.
            Role akun akan disesuaikan otomatis.
          </p>
        </div>

        <button class="btn btn-primary btn-full login-pro-button" id="googleLoginBtn">
          Login dengan Google
        </button>

        <div class="login-pro-list">
          <div>
            <div class="login-pro-list-icon">${safeIconSvg("admin")}</div>
            <div>
              <strong>Admin Mode</strong>
              <p>Tambah project, edit progress, share public, dan generate key pembeli.</p>
            </div>
          </div>

          <div>
            <div class="login-pro-list-icon">${safeIconSvg("viewer")}</div>
            <div>
              <strong>Member Mode</strong>
              <p>Cari referensi, lihat project public, beli key, dan buka source code.</p>
            </div>
          </div>
        </div>

        <div class="login-pro-note">
          Key hanya berlaku untuk satu akun dan satu project.
        </div>
      </div>
    </section>
  `;
}

function renderDashboard() {
  const main = document.getElementById("mainContent");
  const activeProjects = projects.filter(project => project.status !== "Completed" && project.status !== "Paused").length;
  const latestProjects = [...projects].slice(0, 3);

  main.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Dashboard</h1>
        ${isLoadingProjects ? `<p>Mengambil data dari sistem...</p>` : `<p>Ringkasan progress coding kamu.</p>`}
      </div>
      ${isAdminUser() ? `<button class="btn btn-primary" id="openProjectModal">Tambah Project</button>` : `<span class="viewer-dashboard-badge">Member Access</span>`}
    </div>

    ${renderDashboardTimeCard()}

    <div class="grid stats">
      <div class="stat-card">
        <span>Total Project</span>
        <h3>${projects.length}</h3>
      </div>
      <div class="stat-card">
        <span>Project Aktif</span>
        <h3>${activeProjects}</h3>
      </div>
      <div class="stat-card">
        <span>Fitur Selesai</span>
        <h3>${countDoneFeatures()}</h3>
      </div>
      <div class="stat-card">
        <span>Bug Terbuka</span>
        <h3>${countOpenBugs()}</h3>
      </div>
    </div>

    ${isAdminUser() ? "" : renderViewerDashboardInfo()}

    <div class="card">
      <div class="section-title">
        <h2>Project Terbaru</h2>
        <button class="btn" data-view="projects">Lihat Semua</button>
      </div>

      ${
        latestProjects.length === 0
          ? `<div class="empty">${isAdminUser() ? "Belum ada project. Klik tambah project untuk mulai." : "Belum ada project public. Admin perlu membuka dashboard sekali agar data public tersinkron."}</div>`
          : `<div class="grid project-grid">${latestProjects.map(projectCard).join("")}</div>`
      }
    </div>
  `;

    startDashboardClock();

  setTimeout(() => {
    const select = document.getElementById("dashboardKeyProjectSelect");
    if (select && select.value) {
      loadDashboardKeyHistory(select.value);
    }
  }, 0);
}

function renderViewerDashboardInfo() {
  return `
    <div class="card viewer-info-card">
      <div class="section-title">
        <div>
          <h2>Mode Member</h2>
          <p class="helper-text" style="margin: 6px 0 0;">
            Kamu login sebagai member. Kamu hanya bisa melihat project public milik admin CodeProgress.
          </p>
        </div>
        <span class="viewer-dashboard-badge">Read Only</span>
      </div>

      <div class="viewer-info-grid">
        <div>
          <span>Akun kamu</span>
          <strong>${esc(currentUser?.email || "-")}</strong>
        </div>
        <div>
          <span>Sumber Project</span>
          <strong class="owner-source-strong">${renderBrandOwnerMarkup()}</strong>
        </div>
      </div>
    </div>
  `;
}

function renderDashboardKeyGenerator() {
  if (projects.length === 0) {
    return `
      <div class="card dashboard-key-card dashboard-key-card-pro">
        <div class="section-title">
          <h2>Admin Key Generator</h2>
          <span class="badge-status private-badge">Admin</span>
        </div>
        <div class="empty">Buat project dulu agar bisa generate key.</div>
      </div>
    `;
  }

  const selectedProjectId = projects[0]?.id || "";

  return `
    <div class="card dashboard-key-card dashboard-key-card-pro">
      <div class="section-title dashboard-key-title">
        <div>
          <h2>Admin Key Generator</h2>
          <p class="helper-text" style="margin: 6px 0 0;">
            Pilih project source code yang ingin diberi key akses.
          </p>
        </div>
        <span class="badge-status public-badge">Only Admin</span>
      </div>

      <div class="dashboard-key-simple dashboard-key-picker-wrap">
        <input type="hidden" id="dashboardKeyProjectSelect" value="${esc(selectedProjectId)}" />

        <div class="dashboard-project-picker">
          ${projects.map((project, index) => `
            <button
              type="button"
              class="dashboard-project-option ${index === 0 ? "active" : ""}"
              data-dashboard-key-project="${esc(project.id)}"
            >
              <span>
                <strong>${esc(project.name)}</strong>
                <small>${esc(project.status || "Project")} • ${getProgress(project)}%</small>
              </span>
              <em>${index === 0 ? "Dipilih" : "Pilih"}</em>
            </button>
          `).join("")}
        </div>

        <button class="btn btn-primary btn-full" id="dashboardGenerateKeyBtn">Generate Key Akses</button>
      </div>

      <div class="dashboard-key-history">
        <div class="section-title">
          <div>
            <h2>Riwayat Key</h2>
            <p class="helper-text" style="margin: 6px 0 0;">
              Key yang sudah dibuat untuk project yang dipilih.
            </p>
          </div>
          <button class="btn" id="refreshDashboardKeyHistoryBtn">Refresh</button>
        </div>

        <div class="key-history-list" id="dashboardKeyHistory">
          <div class="empty">Memuat riwayat key...</div>
        </div>
      </div>
    </div>
  `;
}



function renderDashboardKeyHistory(keys = [], projectId = "") {
  const target = document.getElementById("dashboardKeyHistory");
  if (!target) return;

  if (!keys.length) {
    target.innerHTML = `<div class="empty">Belum ada key untuk project ini.</div>`;
    return;
  }

  target.innerHTML = keys.map(keyItem => {
    const keyText = keyItem.key || keyItem.id;
    const used = Boolean(keyItem.isUsed);
    const usedInfo = used
      ? `Dipakai oleh ${esc(keyItem.usedByEmail || keyItem.usedByName || keyItem.usedBy || "akun pembeli")}`
      : "Belum dipakai";

    return `
      <div class="key-history-item ${used ? "used" : ""}">
        <div class="key-history-main">
          <div class="key-history-top">
            <strong>${esc(keyText)}</strong>
            <span class="badge-status ${used ? "private-badge" : "public-badge"}">
              ${used ? "Sudah dipakai" : "Aktif"}
            </span>
          </div>

          <div class="key-history-meta">
            <span>${usedInfo}</span>
            <span>Dibuat: ${formatDate(keyItem.createdAt)}</span>
            ${used ? `<span>Dipakai: ${formatDate(keyItem.usedAt)}</span>` : ""}
          </div>
        </div>

        <div class="key-history-actions">
          <button class="btn" data-copy-key="${esc(keyText)}">Copy Key</button>
          ${!used ? `<button class="btn btn-danger" data-delete-dashboard-key="${esc(keyText)}" data-project-id="${esc(projectId)}">Hapus</button>` : ""}
        </div>
      </div>
    `;
  }).join("");
}

async function loadDashboardKeyHistory(projectId, options = {}) {
  const target = document.getElementById("dashboardKeyHistory");
  if (!target || !currentUser || !projectId) return;

  const scrollY = window.scrollY;
  const shouldKeepScroll = options.keepScroll === true;
  const hasExistingContent = target.querySelector(".key-history-item") || target.querySelector(".empty");

  if (!hasExistingContent) {
    target.innerHTML = `<div class="empty">Mengambil riwayat key...</div>`;
  }

  try {
    const q = query(getKeysRef(currentUser.uid, projectId), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    const keys = snapshot.docs.map(item => {
      return {
        id: item.id,
        ...item.data()
      };
    });

    renderDashboardKeyHistory(keys, projectId);

    if (shouldKeepScroll) {
      keepScrollPosition(scrollY);
    }
  } catch (error) {
    console.error(error);
    target.innerHTML = `<div class="empty">Gagal mengambil riwayat key. Cek rules.</div>`;

    if (shouldKeepScroll) {
      keepScrollPosition(scrollY);
    }
  }
}

async function loadDashboardPrivateFile(projectId) {
  if (!currentUser || !projectId) return "";

  try {
    const snap = await getDoc(getProjectPrivateRef(currentUser.uid, projectId));
    return snap.exists() ? (snap.data().fileUrl || "") : "";
  } catch (error) {
    console.warn("Gagal mengambil link file:", error);
    return "";
  }
}

async function generateDashboardAccessKey() {
  if (!requireAdmin()) return;

  const control = document.getElementById("dashboardKeyProjectSelect");
  const button = document.getElementById("dashboardGenerateKeyBtn");
  const scrollY = window.scrollY;

  if (!control) return;

  const projectId = control.value;
  const project = getProject(projectId);

  if (button) {
    button.disabled = true;
    button.textContent = "Membuat key...";
  }

  if (!project) {
    showWarningPopup("Project Tidak Ditemukan", "Project yang dipilih tidak ditemukan atau belum tersinkron.");
    showPopupNotification("error", "Project Tidak Ditemukan", "Project yang dipilih tidak ditemukan atau belum tersinkron.");
    if (button) {
      button.disabled = false;
      button.textContent = "Generate Key Akses";
    }
    keepScrollPosition(scrollY);
    return;
  }

  try {
    const privateSnap = await getDoc(getProjectPrivateRef(currentUser.uid, projectId));
    const fileUrl = normalizeExternalUrl(privateSnap.exists() ? (privateSnap.data().fileUrl || "") : "");

    if (!fileUrl) {
      showWarningPopup("Link File Belum Ada", "Simpan link source code terlebih dahulu sebelum membuat key.");
      showPopupNotification("warning", "Link File Belum Ada", "Simpan link source code terlebih dahulu sebelum membuat key.");
      if (button) {
        button.disabled = false;
        button.textContent = "Generate Key Akses";
      }
      keepScrollPosition(scrollY);
      return;
    }

    if (!isSafeExternalUrl(fileUrl, {
      allowLocalHttp: true,
      allowedHosts: SECURITY_CONFIG.allowedDownloadHosts
    })) {
      showWarningPopup("Link Source Tidak Aman", "Perbaiki link source code di Edit Project. Gunakan host aman seperti MediaFire, Google Drive, GitHub, Vercel, Netlify, atau Catbox.");
      if (button) {
        button.disabled = false;
        button.textContent = "Generate Key Akses";
      }
      keepScrollPosition(scrollY);
      return;
    }

    const key = generateKeyCode();

    await setDoc(getKeyRef(currentUser.uid, projectId, key), {
      key,
      fileUrl,
      projectId,
      projectName: project.name,
      isUsed: false,
      usedBy: "",
      usedByEmail: "",
      usedByName: "",
      createdAt: serverTimestamp(),
      usedAt: null
    });

    await loadDashboardKeyHistory(projectId, { keepScroll: true });

    if (button) {
      button.disabled = false;
      button.textContent = "Generate Key Akses";
    }

    keepScrollPosition(scrollY);

    try {
      await navigator.clipboard.writeText(key);
      showToast("Key berhasil dibuat dan disalin.");
    } catch (error) {
      prompt("Key berhasil dibuat. Salin key ini:", key);
    }
  } catch (error) {
    if (button) {
      button.disabled = false;
      button.textContent = "Generate Key Akses";
    }

    keepScrollPosition(scrollY);
    showError(error, "Gagal generate key.");
  }
}



function renderProjects() {
  const main = document.getElementById("mainContent");

  const filteredProjects = projects.filter(project => {
    const text = `${project.name || ""} ${project.description || ""} ${project.tech || ""}`.toLowerCase();
    const matchText = text.includes(projectSearch.toLowerCase());
    const matchStatus = projectStatusFilter === "all" || project.status === projectStatusFilter;

    return matchText && matchStatus;
  });

  main.innerHTML = `
    <div class="topbar">
      <div>
        <h1>${isAdminUser() ? "Project" : "Project Admin"}</h1>
        ${isLoadingProjects ? `<p>Mengambil data project...</p>` : `<p>${isAdminUser() ? "Kelola semua project coding kamu." : "Lihat project public dari admin CodeProgress."}</p>`}
      </div>
      ${isAdminUser() ? `<button class="btn btn-primary" id="openProjectModal">Tambah Project</button>` : `<span class="viewer-dashboard-badge">Member Access</span>`}
    </div>

    <div class="toolbar">
      <input type="text" id="searchProject" placeholder="Cari project..." value="${esc(projectSearch)}" />

      <select id="filterProjectStatus">
        <option value="all">Semua Status</option>
        ${projectStatuses.map(status => `
          <option value="${esc(status)}" ${projectStatusFilter === status ? "selected" : ""}>${esc(status)}</option>
        `).join("")}
      </select>

      <button class="btn" id="clearFilterBtn">Reset</button>
    </div>

    ${
      filteredProjects.length === 0
        ? `<div class="empty">${isAdminUser() ? "Project belum ditemukan." : "Belum ada project public. Admin perlu membuka dashboard sekali agar data public tersinkron."}</div>`
        : `<div class="grid project-grid">${filteredProjects.map(projectCard).join("")}</div>`
    }
  `;
}

function projectCard(project) {
  const progress = getProgress(project);

  return `
    <article class="card project-card">
      <div>
        <span class="badge-status ${statusClass(project.status)}">${esc(project.status)}</span>
      </div>

      <div>
        <h3>${esc(project.name)}</h3>
        <p class="project-card-desc-short">${esc(getShortDescription(project.description, 155))}</p>
      </div>

      <div class="progress-wrap">
        <div class="progress-info">
          <span>Progress project</span>
          <strong>${progress}%</strong>
        </div>
        <div class="progress">
          <div class="progress-bar" style="width: ${progress}%"></div>
        </div>
      </div>

      <div class="project-meta">
        ${renderCompactTechBadges(project.tech || "No tech")}
        <span class="badge-status">${(project.features || []).length} fitur</span>
        <span class="badge-status">${(project.bugs || []).length} bug</span>
        ${project.isPublic ? `<span class="badge-status public-badge">Public</span>` : `<span class="badge-status private-badge">Private</span>`}
      </div>

      <button class="btn btn-primary" data-detail="${project.id}">Buka Detail</button>
    </article>
  `;
}

function renderProjectDetail() {
  const main = document.getElementById("mainContent");
  const project = getProject(currentProjectId);

  if (!project) {
    activeView = "projects";
    render();
    return;
  }

  if (!isAdminUser()) {
    renderViewerProjectDetail(project);
  setTimeout(photoProjectScrollV2, 120);
    return;
  }

  listenKeysForProject(project.id);

  const progress = getProgress(project);
  const shareUrl = getProjectShareUrl(project);

  main.innerHTML = `
    <div class="topbar project-detail-topbar">
      <div class="project-detail-summary">
        <div class="project-detail-topline">
          <button class="btn detail-back-btn" data-view="projects">Kembali</button>
        </div>

        <div class="project-title-block">
          <div class="detail-badge-row admin-detail-badges">
            <span class="project-label">Project Admin</span>
            <span class="project-detail-badge">${project.isPublic ? "Public Project" : "Private Project"}</span>
          </div>
          <h1>${esc(project.name)}</h1>
          ${renderFormattedDescription(project.description, "Belum ada deskripsi.")}
        </div>

        <div class="project-detail-meta">
          <div>
            <span>Status</span>
            <strong>${esc(project.status || "Belum diisi")}</strong>
          </div>
          <div class="technology-meta-row">
            <span>Teknologi</span>
            ${renderTechBadges(project.tech)}
          </div>
          <div>
            <span>Progress</span>
            <strong>${progress}%</strong>
          </div>
        </div>
      </div>

      <div class="actions project-detail-actions">
        <button class="btn ${project.isPublic ? "btn-danger" : "btn-success"}" data-toggle-share="${project.id}">
          ${project.isPublic ? "Matikan Share" : "Aktifkan Share"}
        </button>
        ${project.isPublic ? `<button class="btn" data-copy-share="${project.id}">Copy Link</button>` : ""}
        ${project.isPublic ? `<a class="btn btn-primary" href="${esc(shareUrl)}" target="_blank" rel="noopener">Lihat Publik</a>` : ""}
        <button class="btn" data-edit-project="${project.id}">Edit</button>
        <button class="btn btn-danger" data-delete-project="${project.id}">Hapus</button>
      </div>
    </div>

    <div class="detail-layout">
      <div class="grid">
        ${renderTaskCard("Fitur Project", "features", project.features || [], featureStatuses, "Contoh: Login user selesai")}
        ${renderTaskCard("Bug", "bugs", project.bugs || [], bugStatuses, "Contoh: Navbar rusak di HP")}
        ${renderTaskCard("Ide Update", "ideas", project.ideas || [], ideaStatuses, "Contoh: Tambah dark mode")}
        ${renderKeyAdminCard(project)}
      </div>

      <aside class="grid">
        <div class="card">
          <div class="section-title">
            <h2>Info Project</h2>
          </div>

          <div class="progress-wrap">
            <div class="progress-info">
              <span>Progress project</span>
              <strong>${progress}%</strong>
            </div>
            <div class="progress">
              <div class="progress-bar" style="width: ${progress}%"></div>
            </div>
          </div>

          <div class="profile-row">
            <span>Status</span>
            <strong>${esc(project.status)}</strong>
          </div>

          <div class="profile-row">
            <span>Progress</span>
            <strong>${progress}% ${project.manualProgress !== null ? "(manual)" : "(otomatis)"}</strong>
          </div>

          <div class="profile-row technology-profile-row">
            <span>Teknologi</span>
            ${renderTechBadges(project.tech)}
          </div>

          <div class="profile-row">
            <span>Dibuat</span>
            <strong>${formatDate(project.createdAt)}</strong>
          </div>
        </div>

        <div class="card share-card">
          <div class="section-title">
            <h2>Share Project</h2>
            <span class="badge-status ${project.isPublic ? "public-badge" : "private-badge"}">
              ${project.isPublic ? "Public" : "Private"}
            </span>
          </div>

          <p class="helper-text">
            Aktifkan share agar project bisa dilihat orang lain lewat link khusus.
          </p>

          <div class="share-link-box">
            <input type="text" readonly value="${project.isPublic ? esc(shareUrl) : "Aktifkan share untuk membuat link"}" />
          </div>

          <div class="share-actions">
            <button class="btn ${project.isPublic ? "btn-danger" : "btn-success"}" data-toggle-share="${project.id}">
              ${project.isPublic ? "Matikan Share" : "Aktifkan Share"}
            </button>
            ${project.isPublic ? `<button class="btn" data-copy-share="${project.id}">Copy Link</button>` : ""}
          </div>
        </div>

        <div class="card file-card">
          <div class="section-title">
            <h2>Setting Order</h2>
          </div>

          <p class="helper-text">
            Nomor WA dan link download diatur lewat tombol Edit Project.
            Link file baru muncul setelah pembeli memasukkan key valid.
          </p>

          <div class="profile-row">
            <span>WhatsApp</span>
            <strong>${esc(cleanWhatsAppNumber(project.whatsappNumber || DEFAULT_WHATSAPP_NUMBER))}</strong>
          </div>

          <button class="btn btn-primary btn-full" data-edit-project="${project.id}">Edit WA & Progress</button>
        </div>

        <div class="card">
          <div class="section-title">
            <h2>Foto Project</h2>
            <span class="badge-status">${(project.screenshots || []).length}</span>
          </div>

          <div class="form-group">
            <label>Link foto tampilan project</label>
            <div class="project-photo-upload-box">
              <input
                type="url"
                id="screenshotUrlInput"
                placeholder="https://contoh.com/foto-project.jpg"
                autocomplete="off"
              />
              <button class="btn btn-primary" type="button" id="saveScreenshotBtn" disabled>Masukkan Link Dulu</button>
            </div>

            <div class="project-photo-pending" id="projectPhotoPendingPreview">
              <img id="projectPhotoPendingImg" alt="Preview foto project" />
              <div>
                <strong id="projectPhotoPendingName"></strong>
                <span id="projectPhotoPendingSize"></span>
                <p>Foto belum tersimpan. Klik Simpan Link Foto agar masuk ke database.</p>
              </div>
            </div>

            <small class="helper-text">Pakai link gambar yang bisa dibuka publik. Contoh aman: Imgur, Postimages, atau Google Drive yang sudah public.</small>
          </div>

          ${
            (project.screenshots || []).length === 0
              ? `<div class="empty">Belum ada foto project.</div>`
              : `<div class="photo-carousel project-photo-carousel center-middle-photos photo-scroll-v2" aria-label="Foto project">
                  ${(project.screenshots || []).map(shot => `
                    <div class="photo-slide shot">
                      <img src="${esc(shot.displayUrl || shot.url)}" alt="${esc(shot.name)}" loading="lazy" />
                      <button data-delete-shot="${shot.id}">×</button>
                    </div>
                  `).join("")}
                </div>`
          }
        </div>
      </aside>
    </div>
  `;
}

async function renderViewerProjectDetail(project) {
  const progress = getProgress(project);
  const shareUrl = getProjectShareUrl(project, ADMIN_UID);
  const features = project.features || [];
  const bugs = project.bugs || [];
  const ideas = project.ideas || [];
  const screenshots = project.screenshots || [];

  publicProject = project;
  publicOwnerUid = ADMIN_UID;
  await loadStoredAccess(ADMIN_UID, project.id);

  const main = document.getElementById("mainContent");
  main.innerHTML = `
    <div class="viewer-detail-head viewer-detail-head-polished">
      <div class="viewer-detail-toolbar viewer-toolbar-fixed">
        <button class="btn viewer-back-btn" data-view="projects">Kembali</button>
      </div>

      <div class="viewer-detail-content">
        <div class="viewer-title-row">
          <div class="detail-badge-row viewer-reference-badges">
            <span class="project-overline">Referensi Project</span>
            <span class="viewer-mode-badge">Read Only</span>
          </div>
          <h1>${esc(project.name)}</h1>
          ${renderFormattedDescription(project.description, "Belum ada deskripsi.")}
        </div>

        <div class="viewer-head-actions">
          ${project.isPublic ? `<a class="btn btn-primary" href="${esc(shareUrl)}" target="_blank" rel="noopener">Buka Link Public</a>` : ""}
        </div>
      </div>
    </div>

    ${renderProjectAccessCard(project, ADMIN_UID, "viewer")}

    <div class="detail-layout viewer-detail-layout">
      <div class="grid">
        <div class="card">
          <div class="section-title">
            <h2>Fitur Project</h2>
            <span class="badge-status">${features.length} item</span>
          </div>
          <div class="public-list">
            ${renderPublicItemList(features, "Belum ada fitur yang dicatat.")}
          </div>
        </div>

        <div class="card">
          <div class="section-title">
            <h2>Bug</h2>
            <span class="badge-status">${bugs.length} item</span>
          </div>
          <div class="public-list">
            ${renderPublicItemList(bugs, "Belum ada bug yang dicatat.")}
          </div>
        </div>

        <div class="card">
          <div class="section-title">
            <h2>Ide Update</h2>
            <span class="badge-status">${ideas.length} item</span>
          </div>
          <div class="public-list">
            ${renderPublicItemList(ideas, "Belum ada ide update.")}
          </div>
        </div>
      </div>

      <aside class="grid">
        <div class="card">
          <div class="section-title">
            <h2>Info Project</h2>
          </div>

          <div class="progress-wrap">
            <div class="progress-info">
              <span>Progress project</span>
              <strong>${progress}%</strong>
            </div>
            <div class="progress">
              <div class="progress-bar" style="width: ${progress}%"></div>
            </div>
          </div>

          <div class="profile-row">
            <span>Status</span>
            <strong>${esc(project.status || "-")}</strong>
          </div>

          <div class="profile-row technology-profile-row">
            <span>Teknologi</span>
            ${renderTechBadges(project.tech)}
          </div>

          <div class="profile-row">
            <span>Akses</span>
            <strong>Member</strong>
          </div>

          <div class="profile-row">
            <span>Sumber</span>
            <strong class="owner-source-strong">${renderBrandOwnerMarkup()}</strong>
          </div>
        </div>

        <div class="card">
          <div class="section-title">
            <h2>Foto Project</h2>
            <span class="badge-status">${screenshots.length}</span>
          </div>

          ${
            screenshots.length === 0
              ? `<div class="empty">Belum ada foto project.</div>`
              : `<div class="photo-carousel project-photo-carousel center-middle-photos photo-scroll-v2" aria-label="Foto project">
                  ${screenshots.map(shot => `
                    <div class="photo-slide shot">
                      <img src="${esc(shot.displayUrl || shot.url)}" alt="${esc(shot.name)}" loading="lazy" />
                    </div>
                  `).join("")}
                </div>`
          }
        </div>
      </aside>
    </div>
  `;
}

function renderTaskCard(title, type, items, statuses, placeholder) {
  return `
    <div class="card">
      <div class="section-title">
        <h2>${esc(title)}</h2>
        <span class="badge-status">${items.length} item</span>
      </div>

      <form class="mini-form" data-add-item="${type}">
        <input type="text" placeholder="${esc(placeholder)}" required />
        <select>
          ${statuses.map(status => `<option value="${esc(status)}">${esc(status)}</option>`).join("")}
        </select>
        <button class="btn btn-primary" type="submit">Tambah</button>
      </form>

      <div class="item-list">
        ${renderItems(items, type, statuses)}
      </div>
    </div>
  `;
}

function renderItems(items, type, statuses) {
  if (items.length === 0) {
    return `<div class="empty">Belum ada data.</div>`;
  }

  return items.map(item => `
    <div class="item">
      <div>
        <strong>${esc(item.title)}</strong>
        <small>${formatDate(item.createdAt)}</small>
      </div>

      <select data-update-item="${type}" data-item-id="${item.id}">
        ${statuses.map(status => `
          <option value="${esc(status)}" ${item.status === status ? "selected" : ""}>${esc(status)}</option>
        `).join("")}
      </select>

      <button class="btn btn-danger" data-delete-item="${type}" data-item-id="${item.id}">Hapus</button>
    </div>
  `).join("");
}

function renderKeyAdminCard(project) {
  return `
    <div class="card key-admin-card">
      <div class="section-title">
        <div>
          <h2>Daftar Key Project</h2>
          <p class="helper-text" style="margin: 6px 0 0;">
            Generate key sekarang ada di Dashboard. Di sini hanya untuk melihat dan menyalin key project ini.
          </p>
        </div>
        <span class="badge-status">${currentProjectKeys.length} key</span>
      </div>

      <div class="key-list">
        ${
          currentProjectKeys.length === 0
            ? `<div class="empty">Belum ada key untuk project ini. Generate key dari Dashboard.</div>`
            : currentProjectKeys.map(keyItem => renderKeyItem(keyItem)).join("")
        }
      </div>
    </div>
  `;
}

function renderKeyItem(keyItem) {
  return `
    <div class="key-item ${keyItem.isUsed ? "used" : ""}">
      <div>
        <strong>${esc(keyItem.key || keyItem.id)}</strong>
        <small>${esc(keyItem.fileName || "File web")} • ${keyItem.isUsed ? "Sudah dipakai" : "Belum dipakai"}</small>
        ${
          keyItem.usedByEmail
            ? `<small>Dipakai oleh: ${esc(keyItem.usedByEmail)}</small>`
            : ""
        }
      </div>

      <div class="key-actions">
        <button class="btn" data-copy-key="${esc(keyItem.key || keyItem.id)}">Copy Key</button>
        ${!keyItem.isUsed ? `<button class="btn btn-danger" data-delete-key="${esc(keyItem.id)}">Hapus</button>` : ""}
      </div>
    </div>
  `;
}

function getUserPhotoUrl() {
  if (currentUser?.photoURL) return currentUser.photoURL;
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.displayName || "User")}&background=6366f1&color=ffffff&bold=true`;
}

function renderProfileBenefits() {
  if (isAdminUser()) {
    return `
      <div class="profile-benefits">
        <div class="benefit-card admin-benefit">
          <div class="benefit-icon benefit-svg-icon">${appIconSvg("admin")}</div>
          <div>
            <h3>Full Admin Access</h3>
            <p>Kelola progress coding, status project, fitur, bug, dan ide update.</p>
          </div>
        </div>

        <div class="benefit-card">
          <div class="benefit-icon benefit-svg-icon">${appIconSvg("key")}</div>
          <div>
            <h3>Key Generator</h3>
            <p>Buat key akses untuk pembeli source code setelah pembayaran dikonfirmasi.</p>
          </div>
        </div>

        <div class="benefit-card">
          <div class="benefit-icon benefit-svg-icon">${appIconSvg("file")}</div>
          <div>
            <h3>File Control</h3>
            <p>Atur link download source code dan kunci akses memakai key per akun.</p>
          </div>
        </div>

        <div class="benefit-card">
          <div class="benefit-icon benefit-svg-icon">${appIconSvg("share")}</div>
          <div>
            <h3>Code Showcase</h3>
            <p>Publikasikan project agar bisa jadi referensi dan katalog source code.</p>
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="profile-benefits">
      <div class="benefit-card viewer-benefit">
        <div class="benefit-icon benefit-svg-icon">${appIconSvg("viewer")}</div>
        <div>
          <h3>Member Access</h3>
          <p>Lihat project public dari CodeProgress tanpa bisa mengubah data admin.</p>
        </div>
      </div>

      <div class="benefit-card">
        <div class="benefit-icon benefit-svg-icon">${appIconSvg("progress")}</div>
        <div>
          <h3>Project Preview</h3>
          <p>Buka detail project, lihat progress, fitur, bug, ide update, dan screenshot.</p>
        </div>
      </div>

      <div class="benefit-card">
        <div class="benefit-icon benefit-svg-icon">${appIconSvg("key")}</div>
        <div>
          <h3>Beli Key</h3>
          <p>Minta key akses file lewat WhatsApp untuk project yang ingin kamu ambil.</p>
        </div>
      </div>

      <div class="benefit-card">
        <div class="benefit-icon benefit-svg-icon">${appIconSvg("admin")}</div>
        <div>
          <h3>Key Per Akun</h3>
          <p>Key yang valid akan dikunci ke akun Google kamu, jadi akses lebih aman.</p>
        </div>
      </div>
    </div>
  `;
}



function renderProfile() {
  const main = document.getElementById("mainContent");
  const role = isAdminUser() ? "Admin" : "Member";
  const accessText = isAdminUser() ? "Kelola project" : "Lihat project admin";
  const roleDescription = isAdminUser()
    ? "Akun ini punya akses penuh untuk mengelola CodeProgress."
    : "Akun ini bisa melihat project public dan membuka file dengan key valid.";

  main.innerHTML = `
    <div class="profile-hero-card">
      <div>
        <span class="profile-kicker">${role} Mode</span>
        <h1>Profile</h1>
        <p>${roleDescription}</p>
      </div>

      <span class="profile-role-pill ${isAdminUser() ? "admin" : "viewer"}">${role}</span>
    </div>

    <div class="profile-layout">
      <div class="profile-main-card">
        <div class="profile-banner ${isAdminUser() ? "admin" : "viewer"}">
          <div class="profile-banner-overlay">
            <span class="profile-banner-kicker">${role} Account</span>
            <strong>${isAdminUser() ? "Kelola semua progress project" : "Akses referensi project dengan rapi"}</strong>
            <small>${isAdminUser() ? "Pantau, atur, dan bagikan project dari satu dashboard." : "Lihat project public dan buka file dengan key yang valid."}</small>
          </div>
        </div>

        <div class="profile-header profile-header-modern">
          <img src="${esc(getUserPhotoUrl())}" alt="Foto user" />
          <div>
            <span class="profile-role-mini">${role} Account</span>
            <h2>${esc(currentUser.displayName || "User")}</h2>
            <p>${esc(currentUser.email)}</p>

            <button class="profile-edit-name-chip" id="editProfileBtn" type="button">
              Ubah Nama
            </button>
          </div>
        </div>

        <div class="profile-stats-grid ${isAdminUser() ? "admin-stats" : "member-stats"}">
          ${isAdminUser() ? `
          <div>
            <span>Total Project</span>
            <strong>${projects.length}</strong>
          </div>` : ""}
          <div>
            <span>Role</span>
            <strong>${role}</strong>
          </div>
          <div>
            <span>Akses</span>
            <strong>${accessText}</strong>
          </div>
        </div>

        <div class="profile-row">
          <span>User ID</span>
          <strong>${esc(currentUser.uid)}</strong>
        </div>

        <div class="profile-action-row" style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 18px;">
          <button class="btn profile-name-edit-btn" id="editProfileBtnSecondary" type="button">Ubah Nama</button>
          ${isAdminUser() ? `<button class="btn" id="exportJsonBtn">Export JSON</button>` : ""}
          <button class="btn btn-danger" id="logoutBtn">Logout</button>
        </div>
      </div>

      ${isAdminUser() ? `<div class="profile-key-generator-wrap">${renderDashboardKeyGenerator()}</div>` : ""}

      <div class="profile-side-card">
        <div class="section-title">
          <div>
            <h2>Keuntungan Mode ${role}</h2>
            <p class="helper-text" style="margin: 6px 0 0;">
              Fitur yang tersedia sesuai mode akun kamu.
            </p>
          </div>
        </div>

        ${renderProfileBenefits()}
      </div>
    </div>
  `;

  if (isAdminUser()) {
    setTimeout(() => {
      const select = document.getElementById("dashboardKeyProjectSelect");
      if (select && select.value) {
        loadDashboardKeyHistory(select.value);
      }
    }, 0);
  }
}


function openProfileModal() {
  const currentName = getDisplayName();

  modalArea.classList.add("show");
  modalArea.innerHTML = `
    <div class="modal profile-edit-modal">
      <div class="modal-head">
        <div>
          <span class="modal-kicker">Profile Settings</span>
          <h2>Ubah Nama Profile</h2>
        </div>
        <button class="close-btn" id="closeModal" type="button">×</button>
      </div>

      <form id="profileForm">
        <div class="profile-edit-preview">
          <img id="profilePhotoPreview" src="${esc(getUserPhotoUrl())}" alt="Preview foto profil" />
          <div>
            <h3>${esc(currentName)}</h3>
            <p>${esc(currentUser?.email || "-")}</p>
            <span>Nama ini akan tampil di akun CodeProgress kamu.</span>
          </div>
        </div>

        <div class="form-grid">
          <div class="form-group full">
            <label>Nama Tampilan</label>
            <input type="text" id="profileDisplayName" value="${esc(currentName)}" maxlength="40" required />
          </div>
          <div class="form-group full">
            <label>Link Foto Profil</label>
            <input
              type="url"
              id="profilePhotoUrlInput"
              value="${esc(currentUser?.photoURL || "")}"
              placeholder="https://contoh.com/foto-profil.jpg"
              autocomplete="off"
            />
            <small class="field-note">Pakai link gambar yang bisa dibuka publik. Tidak perlu Firebase Storage.</small>
          </div>
        </div>

        <div class="form-actions">
          <button class="btn" id="closeModal" type="button">Batal</button>
          <button class="btn btn-primary" type="submit" id="saveProfileBtn">Simpan Profile</button>
        </div>
      </form>
    </div>
  `;
}

async function saveProfileForm() {
  if (!currentUser) return;

  const displayName = document.getElementById("profileDisplayName")?.value.trim();
  const photoUrlInput = document.getElementById("profilePhotoUrlInput");
  const photoURL = photoUrlInput?.value.trim() || "";

  if (!displayName || displayName.length < 2) {
    showWarningPopup("Nama Terlalu Pendek", "Isi nama tampilan minimal 2 karakter.");
    return;
  }

  if (photoURL && !isValidImageUrl(photoURL)) {
    showWarningPopup(
      "Link Foto Profil Kurang Valid",
      "Gunakan link gambar langsung yang bisa dibuka publik. Contoh: link berakhiran .jpg, .png, atau .webp."
    );
    return;
  }

  const saveBtn = document.getElementById("saveProfileBtn");

  try {
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = `<span class="btn-loader"></span>Menyimpan...`;
    }

    await updateProfile(currentUser, {
      displayName,
      photoURL: photoURL || null
    });

    currentUser = auth.currentUser;
    closeModal();

    showSuccessPopup(
      "Profile Berhasil Diperbarui",
      "Nama profile berhasil diperbarui."
    );

    if (activeView === "profile") renderProfile();
    else render();
  } catch (error) {
    showError(error, "Gagal menyimpan profile.");
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Simpan Profile";
    }
  }
}




function openProjectModal(projectId = null) {
  const project = projectId ? getProject(projectId) : null;
  const manualProgressValue = project?.manualProgress !== null && project?.manualProgress !== undefined
    ? project.manualProgress
    : "";

  modalArea.classList.add("show");
  modalArea.innerHTML = `
    <div class="modal">
      <div class="modal-head">
        <h2>${project ? "Edit Project" : "Tambah Project"}</h2>
        <button class="close-btn" id="closeModal">×</button>
      </div>

      <form id="projectForm" data-project-id="${project ? project.id : ""}">
        <div class="form-grid">
          <div class="form-group">
            <label>Nama Project</label>
            <input type="text" id="projectName" value="${esc(project?.name || "")}" placeholder="Contoh: Web Store" maxlength="${SECURITY_CONFIG.maxProjectNameLength}" required />
          </div>

          <div class="form-group">
            <label>Status</label>
            <select id="projectStatus">
              ${projectStatuses.map(status => `
                <option value="${esc(status)}" ${project?.status === status ? "selected" : ""}>${esc(status)}</option>
              `).join("")}
            </select>
          </div>

          <div class="form-group">
            <label>Progress Manual (%)</label>
            <input type="number" id="manualProgress" min="0" max="100" value="${esc(manualProgressValue)}" placeholder="Kosongkan untuk otomatis" />
          </div>

          <div class="form-group">
            <label>Nomor WhatsApp Order Key</label>
            <input type="text" id="whatsappNumber" value="${esc(project?.whatsappNumber || DEFAULT_WHATSAPP_NUMBER)}" placeholder="Contoh: 6281234567890" />
          </div>

          <div class="form-group full">
            <label>Teknologi</label>
            <input type="text" id="projectTech" value="${esc(project?.tech || "")}" placeholder="Contoh: HTML, CSS, JavaScript" />
          </div>

          <div class="form-group full">
            <label>Link Download Project</label>
            <input type="url" id="projectDownloadUrl" value="" placeholder="Isi link file ZIP, Google Drive, MediaFire, GitHub, atau link hosting file" />
            <small class="field-note">Link ini hanya muncul ke pembeli setelah key valid.</small>
          </div>

          <div class="form-group full">
            <label>Deskripsi</label>
            <textarea id="projectDescription" maxlength="${SECURITY_CONFIG.maxProjectDescriptionLength}" placeholder="Jelaskan fungsi project kamu...

Tekan Enter untuk membuat paragraf baru. Nanti jaraknya akan ikut tampil di detail project.">${esc(project?.description || "")}</textarea>
            <small class="field-note">Enter pada deskripsi akan ikut tampil sebagai paragraf setelah project disimpan.</small>
          </div>
        </div>

        <div class="form-actions">
          <button class="btn" id="closeModal" type="button">Batal</button>
          <button class="btn btn-primary" type="submit">
            ${project ? "Simpan Perubahan" : "Tambah Project"}
          </button>
        </div>
      </form>
    </div>
  `;

  if (project) {
    loadProjectDownloadUrlForModal(project.id);
  }
}

async function loadProjectDownloadUrlForModal(projectId) {
  const input = document.getElementById("projectDownloadUrl");
  if (!input || !currentUser || !projectId) return;

  input.value = "Mengambil link...";
  const fileUrl = await loadDashboardPrivateFile(projectId);
  input.value = fileUrl;
}

function closeModal() {
  modalArea.classList.remove("show");
  modalArea.innerHTML = "";
}

/* FIRESTORE ACTIONS */

async function saveProjectForm(form) {
  if (!requireAdmin()) return;

  const projectId = form.dataset.projectId;
  const name = document.getElementById("projectName").value.trim();
  const description = document.getElementById("projectDescription").value.trim();
  const tech = document.getElementById("projectTech").value.trim();
  const status = document.getElementById("projectStatus").value;
  const whatsappNumber = cleanWhatsAppNumber(document.getElementById("whatsappNumber").value.trim() || DEFAULT_WHATSAPP_NUMBER);
  const projectDownloadUrl = normalizeExternalUrl(document.getElementById("projectDownloadUrl").value.trim());
  const manualProgressInput = document.getElementById("manualProgress").value.trim();
  const manualProgress = manualProgressInput === "" ? null : clampNumber(manualProgressInput, 0, 100);

  const securityCheck = validateProjectSecurityInput({
    name,
    description,
    tech,
    whatsappNumber,
    projectDownloadUrl
  });

  if (!securityCheck.ok) {
    showWarningPopup(securityCheck.title, securityCheck.message);
    return;
  }

  try {
    if (projectId) {
      await updateDoc(getProjectRef(projectId), {
        name,
        description,
        tech,
        status,
        whatsappNumber,
        manualProgress,
        updatedAt: nowIso()
      });

      await setDoc(getProjectPrivateRef(currentUser.uid, projectId), {
        fileUrl: projectDownloadUrl,
        updatedAt: nowIso()
      }, { merge: true });

      await syncProjectKeysFileUrl(projectId, projectDownloadUrl, name);

      await syncPublicProject({
        id: projectId,
        name,
        description,
        tech,
        status,
        whatsappNumber,
        manualProgress,
        features: getProject(projectId)?.features || [],
        bugs: getProject(projectId)?.bugs || [],
        ideas: getProject(projectId)?.ideas || [],
        screenshots: getProject(projectId)?.screenshots || [],
        isPublic: getProject(projectId)?.isPublic || false,
        createdAt: getProject(projectId)?.createdAt || nowIso()
      });

      showToast("Project berhasil diedit");
    } else {
      const createdAt = nowIso();

      const newProjectRef = await addDoc(getProjectsRef(), {
        name,
        description,
        tech,
        status,
        whatsappNumber,
        manualProgress,
        features: [],
        bugs: [],
        ideas: [],
        screenshots: [],
        isPublic: false,
        createdAt,
        updatedAt: createdAt
      });

      const newProjectData = {
        id: newProjectRef.id,
        name,
        description,
        tech,
        status,
        whatsappNumber,
        manualProgress,
        features: [],
        bugs: [],
        ideas: [],
        screenshots: [],
        isPublic: false,
        createdAt,
        updatedAt: createdAt
      };

      if (!projects.some(project => project.id === newProjectRef.id)) {
        projects = [newProjectData, ...projects];
        render();
      }

      await setDoc(getProjectPrivateRef(currentUser.uid, newProjectRef.id), {
        fileUrl: projectDownloadUrl,
        updatedAt: nowIso()
      }, { merge: true });

      showToast("Project berhasil ditambahkan");
    }

    closeModal();
  } catch (error) {
    showError(error, "Gagal menyimpan project.");
  }
}

async function addProjectItem(form) {
  if (!requireAdmin()) return;

  const type = form.dataset.addItem;
  const project = getProject(currentProjectId);
  const input = form.querySelector("input");
  const select = form.querySelector("select");

  const newItem = {
    id: uid(),
    title: input.value.trim(),
    status: select.value,
    createdAt: new Date().toISOString()
  };

  const nextItems = [newItem, ...(project[type] || [])];

  try {
    await updateDoc(getProjectRef(project.id), {
      [type]: nextItems,
      updatedAt: nowIso()
    });

    await syncPublicProject({
      ...project,
      [type]: nextItems,
      updatedAt: nowIso()
    });

    showToast("Data berhasil ditambahkan");
  } catch (error) {
    showError(error, "Gagal menambah data.");
  }
}

async function updateProjectItem(type, itemId, status) {
  if (!requireAdmin()) return;

  const project = getProject(currentProjectId);

  const nextItems = (project[type] || []).map(item => {
    if (item.id !== itemId) return item;
    return { ...item, status };
  });

  try {
    await updateDoc(getProjectRef(project.id), {
      [type]: nextItems,
      updatedAt: nowIso()
    });

    await syncPublicProject({
      ...project,
      [type]: nextItems,
      updatedAt: nowIso()
    });

    showToast("Status diperbarui");
  } catch (error) {
    showError(error, "Gagal update status.");
  }
}

async function deleteProjectItem(type, itemId) {
  if (!requireAdmin()) return;

  const confirmDelete = await showCenterConfirm({
    type: "delete",
    title: "Hapus item ini?",
    message: "Item ini akan dihapus dari project. Aksi ini tidak bisa dibatalkan lewat tombol undo.",
    confirmText: "Ya, Hapus",
    cancelText: "Batal",
    danger: true
  });

  if (!confirmDelete) return;

  const project = getProject(currentProjectId);
  const nextItems = (project[type] || []).filter(item => item.id !== itemId);

  try {
    await updateDoc(getProjectRef(project.id), {
      [type]: nextItems,
      updatedAt: nowIso()
    });

    await syncPublicProject({
      ...project,
      [type]: nextItems,
      updatedAt: nowIso()
    });

    showToast("Item berhasil dihapus");
  } catch (error) {
    showError(error, "Gagal menghapus item.");
  }
}

async function deleteProject(projectId) {
  if (!requireAdmin()) return;

  const project = getProject(projectId);
  const confirmDelete = await showCenterConfirm({
    type: "delete",
    title: "Hapus project ini?",
    message: `Project "${project?.name || "ini"}" akan dihapus permanen, termasuk data fitur, bug, ide update, screenshot, dan key aksesnya.`,
    confirmText: "Hapus Project",
    cancelText: "Batal",
    danger: true
  });

  if (!confirmDelete) return;

  try {
    for (const shot of project.screenshots || []) {
      if (shot.path) {
        try {
          await deleteObject(ref(storage, shot.path));
        } catch (storageError) {
          console.warn("Gagal menghapus file storage:", storageError);
        }
      }
    }

    await deleteDoc(getProjectRef(projectId));
    await deleteDoc(getPublicMirrorProjectRef(projectId)).catch(() => {});
    activeView = "projects";
    currentProjectId = null;
    stopKeysListener();
    showToast("Project berhasil dihapus");
  } catch (error) {
    showError(error, "Gagal menghapus project.");
  }
}

async function toggleShareProject(projectId) {
  if (!requireAdmin()) return;

  const project = getProject(projectId);
  if (!project) return;

  const nextPublic = !project.isPublic;
  const updatedAt = nowIso();

  try {
    await updateDoc(getProjectRef(projectId), {
      isPublic: nextPublic,
      sharedAt: nextPublic ? updatedAt : null,
      updatedAt
    });

    await syncPublicProject({
      ...project,
      isPublic: nextPublic,
      updatedAt
    });

    projects = projects.map(item => {
      if (item.id !== projectId) return item;
      return {
        ...item,
        isPublic: nextPublic,
        updatedAt
      };
    });

    renderProjectDetail();

    showToast(nextPublic ? "Project sekarang bisa dishare" : "Share project dimatikan");
  } catch (error) {
    showError(error, "Gagal mengubah status share.");
  }
}

async function copyShareLink(projectId) {
  if (!requireAdmin()) return;

  const project = getProject(projectId);
  if (!project) return;

  const link = getProjectShareUrl(project);

  try {
    await navigator.clipboard.writeText(link);
    showToast("Link share berhasil disalin");
  } catch (error) {
    prompt("Salin link ini:", link);
  }
}

async function deleteDashboardAccessKey(projectId, keyId) {
  if (!requireAdmin()) return;

  const confirmDelete = await showCenterConfirm({
    type: "delete",
    title: "Hapus key ini?",
    message: "Key akan dihapus dari riwayat project. Pembeli tidak bisa memakai key ini setelah dihapus.",
    confirmText: "Hapus Key",
    cancelText: "Batal",
    danger: true
  });

  if (!confirmDelete) return;

  try {
    await deleteDoc(getKeyRef(currentUser.uid, projectId, keyId));
    await loadDashboardKeyHistory(projectId);
    showToast("Key berhasil dihapus");
  } catch (error) {
    showError(error, "Gagal hapus key.");
  }
}

async function deleteAccessKey(keyId) {
  if (!requireAdmin()) return;

  const confirmDelete = await showCenterConfirm({
    type: "delete",
    title: "Hapus key akses?",
    message: "Key akses ini akan dihapus dari project. Pastikan key memang tidak dibutuhkan lagi.",
    confirmText: "Hapus Key",
    cancelText: "Batal",
    danger: true
  });

  if (!confirmDelete) return;

  try {
    await deleteDoc(getKeyRef(currentUser.uid, currentProjectId, keyId));
    showToast("Key berhasil dihapus");
  } catch (error) {
    showError(error, "Gagal hapus key.");
  }
}

async function copyText(text, successMessage = "Berhasil disalin") {
  try {
    await navigator.clipboard.writeText(text);
    showToast(successMessage);
  } catch (error) {
    prompt("Salin manual:", text);
  }
}



function setSavePhotoButtonLoading(isLoading, text = "Menyimpan Foto...") {
  const btn = document.getElementById("saveScreenshotBtn");
  const input = document.getElementById("screenshotInput");

  if (!btn) return;

  btn.disabled = isLoading || !selectedProjectPhotoFile;
  btn.classList.toggle("is-loading", Boolean(isLoading));

  if (isLoading) {
    btn.dataset.originalText = btn.dataset.originalText || btn.textContent.trim() || "Simpan Foto";
    btn.innerHTML = `<span class="btn-loader"></span>${text}`;
  } else {
    btn.innerHTML = btn.dataset.originalText || "Simpan Foto";
  }

  if (input) input.disabled = Boolean(isLoading);
}

function updateSelectedProjectPhoto(file) {
  selectedProjectPhotoFile = file || null;

  const btn = document.getElementById("saveScreenshotBtn");
  const previewWrap = document.getElementById("projectPhotoPendingPreview");
  const previewImg = document.getElementById("projectPhotoPendingImg");
  const previewName = document.getElementById("projectPhotoPendingName");
  const previewSize = document.getElementById("projectPhotoPendingSize");

  if (btn) {
    btn.disabled = !selectedProjectPhotoFile;
    btn.dataset.originalText = selectedProjectPhotoFile ? "Simpan Foto Project" : "Pilih Foto Dulu";
    btn.textContent = btn.dataset.originalText;
  }

  if (!selectedProjectPhotoFile) {
    if (previewWrap) previewWrap.classList.remove("show");
    if (previewImg) previewImg.removeAttribute("src");
    if (previewName) previewName.textContent = "";
    if (previewSize) previewSize.textContent = "";
    return;
  }

  if (previewWrap) previewWrap.classList.add("show");
  if (previewImg) previewImg.src = URL.createObjectURL(selectedProjectPhotoFile);
  if (previewName) previewName.textContent = selectedProjectPhotoFile.name;
  if (previewSize) previewSize.textContent = formatFileSize(selectedProjectPhotoFile.size);
}










function formatFileSize(bytes = 0) {
  if (!bytes) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Gambar tidak bisa dibaca browser."));
    };

    image.src = url;
  });
}

function canvasToBlob(canvas, type = "image/jpeg", quality = 0.82) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error("Gagal mengompres gambar."));
    }, type, quality);
  });
}

async function prepareScreenshotFile(file) {
  const maxOriginalSize = 15 * 1024 * 1024;
  const maxUploadSize = 4.7 * 1024 * 1024;
  const maxSide = 1600;

  if (!file) {
    throw new Error("File belum dipilih.");
  }

  if (!file.type || !file.type.startsWith("image/")) {
    const error = new Error("Upload file gambar saja, seperti JPG, PNG, atau WEBP.");
    error.code = "invalid-image-type";
    throw error;
  }

  if (file.size > maxOriginalSize) {
    const error = new Error("Ukuran foto terlalu besar. Maksimal 15 MB sebelum dikompres.");
    error.code = "image-too-large";
    throw error;
  }

  const canUseOriginal =
    file.size <= maxUploadSize &&
    ["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type);

  if (canUseOriginal) {
    return {
      file,
      blob: file,
      name: file.name,
      contentType: file.type,
      compressed: false
    };
  }

  const image = await loadImageFromFile(file);
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#0b0706";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);

  let blob = await canvasToBlob(canvas, "image/jpeg", 0.82);

  if (blob.size > maxUploadSize) {
    blob = await canvasToBlob(canvas, "image/jpeg", 0.70);
  }

  if (blob.size > maxUploadSize) {
    const error = new Error("Foto masih terlalu besar setelah dikompres. Coba pilih foto lain atau crop dulu.");
    error.code = "compressed-image-too-large";
    throw error;
  }

  const baseName = file.name.replace(/\.[^/.]+$/, "");
  const safeBase = baseName || "screenshot";

  return {
    file,
    blob,
    name: `${safeBase}.jpg`,
    contentType: "image/jpeg",
    compressed: true,
    originalSize: file.size,
    finalSize: blob.size
  };
}


function normalizeImageUrl(url = "") {
  const raw = String(url || "").trim();

  if (!raw) return "";

  try {
    const parsed = new URL(raw);

    if (parsed.hostname.includes("drive.google.com")) {
      const fileMatch = raw.match(/\/file\/d\/([^/]+)/) || raw.match(/[?&]id=([^&]+)/);
      const fileId = fileMatch?.[1];

      if (fileId) {
        return `https://drive.google.com/uc?export=view&id=${fileId}`;
      }
    }

    if (parsed.hostname.includes("postimg.cc") && !parsed.hostname.includes("i.postimg.cc")) {
      return raw;
    }

    return raw;
  } catch {
    return raw;
  }
}

function getImageDirectUrl(url = "") {
  return normalizeImageUrl(url);
}

function isValidImageUrl(url = "") {
  return isSafeExternalUrl(url, {
    allowLocalHttp: true,
    allowedHosts: SECURITY_CONFIG.allowedImageHosts
  });
}

function setClaimKeyLoading(isLoading, text = "Memproses Key...") {
  const form = document.getElementById("claimKeyForm");
  const input = document.getElementById("accessKeyInput");
  const button = form?.querySelector("button[type='submit']");

  if (input) input.disabled = Boolean(isLoading);

  if (!button) return;

  button.disabled = Boolean(isLoading);
  button.classList.toggle("is-loading", Boolean(isLoading));

  if (isLoading) {
    button.dataset.originalText = button.dataset.originalText || button.textContent.trim() || "Buka Akses Source Code";
    button.innerHTML = `<span class="btn-loader"></span>${text}`;
  } else {
    button.innerHTML = button.dataset.originalText || "Buka Akses Source Code";
  }
}

function setProtectedSourceLoading(isLoading, text = "Mengecek Akses...") {
  const button = document.querySelector("[data-open-protected-source]");

  if (!button) return;

  button.disabled = Boolean(isLoading);
  button.classList.toggle("is-loading", Boolean(isLoading));

  if (isLoading) {
    button.dataset.originalText = button.dataset.originalText || button.textContent.trim() || "Buka Source Code";
    button.innerHTML = `<span class="btn-loader"></span>${text}`;
  } else {
    button.innerHTML = button.dataset.originalText || "Buka Source Code";
  }
}

async function openProtectedPublicSource() {
  if (isOpeningProtectedSource) {
    showWarningPopup("Sedang Dicek", "Tunggu proses pengecekan akses selesai dulu.");
    return;
  }

  if (!currentUser) {
    showWarningPopup(
      "Login Diperlukan",
      "Login dulu agar akses source code bisa dicek berdasarkan akun kamu."
    );
    await loginGoogle();
    return;
  }

  if (!publicProject || !publicOwnerUid) {
    showWarningPopup(
      "Project Belum Siap",
      "Data project belum selesai dimuat. Refresh halaman lalu coba lagi."
    );
    return;
  }

  const storedKey = normalizeKey(localStorage.getItem(getAccessStorageKey(publicOwnerUid, publicProject.id)));
  const activeKey = normalizeKey(publicAccess?.key || storedKey);

  if (!activeKey || !SECURITY_CONFIG.keyPattern.test(activeKey)) {
    showWarningPopup(
      "Akses Belum Valid",
      "Masukkan key yang valid dulu sebelum membuka source code."
    );
    return;
  }

  let sourceWindow = null;

  try {
    sourceWindow = window.open("about:blank", "_blank", "noopener,noreferrer");

    if (sourceWindow) {
      sourceWindow.document.write(`
        <html>
          <head>
            <title>Mengecek Akses...</title>
            <meta name="referrer" content="no-referrer">
            <style>
              body{
                margin:0;
                min-height:100vh;
                display:grid;
                place-items:center;
                background:#090302;
                color:#fff7ed;
                font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
              }
              div{
                max-width:320px;
                text-align:center;
                padding:24px;
              }
              strong{display:block;font-size:20px;margin-bottom:8px;}
              span{color:#fb923c;}
            </style>
          </head>
          <body>
            <div>
              <strong>Mengecek akses...</strong>
              <p>Tunggu sebentar, source code akan dibuka kalau key valid.</p>
              <span>CodeProgress Security</span>
            </div>
          </body>
        </html>
      `);
      sourceWindow.document.close();
    }
  } catch {
    sourceWindow = null;
  }

  isOpeningProtectedSource = true;
  setProtectedSourceLoading(true);

  try {
    const keyRef = getKeyRef(publicOwnerUid, publicProject.id, activeKey);
    const snap = await getDoc(keyRef);
    const verifiedAccess = getAccessDocFromSnapshot(snap);

    if (!verifiedAccess) {
      if (sourceWindow) sourceWindow.close();

      localStorage.removeItem(getAccessStorageKey(publicOwnerUid, publicProject.id));
      publicAccess = null;
      renderPublicProject(publicProject, publicOwnerUid);

      showWarningPopup(
        "Akses Tidak Valid",
        "Key belum dikunci ke akun ini, sudah dicabut, atau bukan milik akun kamu."
      );
      return;
    }

    if (verifiedAccess.projectId && verifiedAccess.projectId !== publicProject.id) {
      if (sourceWindow) sourceWindow.close();

      showWarningPopup(
        "Key Tidak Cocok",
        "Key ini tidak cocok untuk project yang sedang dibuka."
      );
      return;
    }

    if (!isSafeExternalUrl(verifiedAccess.fileUrl, {
      allowLocalHttp: true,
      allowedHosts: SECURITY_CONFIG.allowedDownloadHosts
    })) {
      if (sourceWindow) sourceWindow.close();

      showWarningPopup(
        "Link Source Diblokir",
        "Link source code tidak masuk daftar host aman. Minta admin memperbarui link."
      );
      return;
    }

    publicAccess = verifiedAccess;
    localStorage.setItem(getAccessStorageKey(publicOwnerUid, publicProject.id), activeKey);

    renderPublicProject(publicProject, publicOwnerUid);

    const safeUrl = safeExternalHref(verifiedAccess.fileUrl);

    if (sourceWindow && !sourceWindow.closed) {
      sourceWindow.location.replace(safeUrl);
    } else {
      window.open(safeUrl, "_blank", "noopener,noreferrer");
    }

    showToast("Akses valid, link download source code sudah muncul.");
  } catch (error) {
    if (sourceWindow) sourceWindow.close();

    console.error(error);

    if (error?.code === "permission-denied") {
      showWarningPopup(
        "Akses Ditolak",
        "Akun ini tidak punya izin membuka link source code. Pastikan key sudah valid untuk akun ini."
      );
      return;
    }

    showPopupNotification(
      "error",
      "Gagal Membuka Source",
      "Koneksi bermasalah saat mengecek key. Refresh halaman lalu coba lagi."
    );
  } finally {
    isOpeningProtectedSource = false;
    setProtectedSourceLoading(false);
  }
}

function setSavePhotoLinkLoading(isLoading, text = "Menyimpan Link...") {
  const btn = document.getElementById("saveScreenshotBtn");
  const input = document.getElementById("screenshotUrlInput");

  if (!btn) return;

  btn.disabled = Boolean(isLoading);
  btn.classList.toggle("is-loading", Boolean(isLoading));

  if (isLoading) {
    btn.dataset.originalText = btn.dataset.originalText || btn.textContent.trim() || "Simpan Link Foto";
    btn.innerHTML = `<span class="btn-loader"></span>${text}`;
  } else {
    const value = input?.value.trim() || selectedProjectPhotoUrl || "";
    btn.disabled = !value;
    btn.innerHTML = value ? "Simpan Link Foto" : "Masukkan Link Dulu";
  }

  if (input) input.disabled = Boolean(isLoading);
}

function updateSelectedProjectPhotoUrl(url = "") {
  selectedProjectPhotoUrl = String(url || "").trim();

  const btn = document.getElementById("saveScreenshotBtn");
  const previewWrap = document.getElementById("projectPhotoPendingPreview");
  const previewImg = document.getElementById("projectPhotoPendingImg");
  const previewName = document.getElementById("projectPhotoPendingName");
  const previewSize = document.getElementById("projectPhotoPendingSize");

  if (btn) {
    btn.disabled = !selectedProjectPhotoUrl;
    btn.textContent = selectedProjectPhotoUrl ? "Simpan Link Foto" : "Masukkan Link Dulu";
  }

  if (!selectedProjectPhotoUrl) {
    if (previewWrap) previewWrap.classList.remove("show");
    if (previewImg) previewImg.removeAttribute("src");
    if (previewName) previewName.textContent = "";
    if (previewSize) previewSize.textContent = "";
    return;
  }

  if (!isValidImageUrl(selectedProjectPhotoUrl)) {
    if (previewWrap) previewWrap.classList.add("show");
    if (previewImg) previewImg.removeAttribute("src");
    if (previewName) previewName.textContent = "Link foto tidak aman";
    if (previewSize) previewSize.textContent = "Gunakan link HTTPS publik dari host yang diizinkan.";
    return;
  }

  const directUrl = getImageDirectUrl(selectedProjectPhotoUrl);

  if (previewWrap) previewWrap.classList.add("show");
  if (previewImg) {
    previewImg.src = directUrl;
    previewImg.onerror = () => {
      previewImg.removeAttribute("src");
      if (previewName) previewName.textContent = "Preview belum bisa tampil";
      if (previewSize) previewSize.textContent = "Link tetap bisa disimpan kalau link publik benar.";
    };
  }

  if (previewName) previewName.textContent = "Preview foto project";
  if (previewSize) previewSize.textContent = directUrl;
}


async function uploadScreenshot(url) {
  if (!requireAdmin()) return;

  const project = getProject(currentProjectId);
  const rawUrl = String(url || "").trim();

  if (!project) return;

  if (!rawUrl) {
    showWarningPopup("Link Foto Masih Kosong", "Tempel link foto project dulu, lalu klik Simpan Link Foto.");
    return;
  }

  if (!isValidImageUrl(rawUrl)) {
    showWarningPopup(
      "Link Foto Kurang Valid",
      "Gunakan link HTTPS dari Imgur, Postimages, Catbox, Googleusercontent, atau Google Drive yang sudah public."
    );
    return;
  }

  if (isUploadingScreenshot) {
    showWarningPopup("Masih Menyimpan", "Tunggu proses simpan link foto sebelumnya selesai dulu.");
    return;
  }

  isUploadingScreenshot = true;
  setSavePhotoLinkLoading(true, "Menyimpan ke Database...");

  try {
    const imageUrl = getImageDirectUrl(rawUrl);
    const fileId = uid();

    const newShot = {
      id: fileId,
      name: "Foto dari link",
      url: imageUrl,
      originalUrl: rawUrl,
      displayUrl: imageUrl,
      path: "",
      source: "link",
      size: 0,
      contentType: "image/link",
      createdAt: new Date().toISOString()
    };

    const nextScreenshots = [newShot, ...(project.screenshots || [])];
    const nextProject = {
      ...project,
      screenshots: nextScreenshots,
      updatedAt: nowIso()
    };

    await updateDoc(getProjectRef(project.id), {
      screenshots: nextScreenshots,
      updatedAt: nextProject.updatedAt
    });

    await syncPublicProject(nextProject);

    projects = projects.map(item => item.id === project.id ? nextProject : item);
    selectedProjectPhotoUrl = "";

    const urlInput = document.getElementById("screenshotUrlInput");
    if (urlInput) urlInput.value = "";

    showSuccessPopup(
      "Foto Berhasil Ditampilkan",
      "Link foto sudah tersimpan ke database dan foto akan tampil di detail project serta halaman public."
    );

    if ((activeView === "detail" || activeView === "projectDetail") && currentProjectId === project.id) {
      renderProjectDetail();
    }
  } catch (error) {
    console.error(error);
    showError(error, "Gagal menyimpan link foto project.");
  } finally {
    isUploadingScreenshot = false;
    setSavePhotoLinkLoading(false);
  }
}







async function deleteScreenshot(shotId) {
  if (!requireAdmin()) return;

  const confirmDelete = await showCenterConfirm({
    type: "delete",
    title: "Hapus screenshot?",
    message: "Screenshot ini akan dihapus dari tampilan project dan penyimpanan file.",
    confirmText: "Hapus Screenshot",
    cancelText: "Batal",
    danger: true
  });

  if (!confirmDelete) return;

  const project = getProject(currentProjectId);
  const shot = (project.screenshots || []).find(item => item.id === shotId);
  const nextScreenshots = (project.screenshots || []).filter(item => item.id !== shotId);

  try {
    if (shot?.path) {
      await deleteObject(ref(storage, shot.path));
    }

    await updateDoc(getProjectRef(project.id), {
      screenshots: nextScreenshots,
      updatedAt: nowIso()
    });

    await syncPublicProject({
      ...project,
      screenshots: nextScreenshots,
      updatedAt: nowIso()
    });

    showToast("Screenshot dihapus");
  } catch (error) {
    showError(error, "Gagal menghapus screenshot.");
  }
}

function exportJson() {
  const blob = new Blob([JSON.stringify(projects, null, 2)], {
    type: "application/json"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "codeprogress-projects.json";
  link.click();

  URL.revokeObjectURL(url);
}

/* EVENTS */


window.addEventListener("error", (event) => {
  console.error("App error:", event.error || event.message);

  if (!root.innerHTML.trim()) {
    root.innerHTML = `
      <section class="login-page">
        <div class="login-card">
          <h2>Terjadi error</h2>
          <p>Aplikasi gagal dimuat. Coba refresh halaman atau update file terbaru.</p>
          <button class="btn btn-primary btn-full" onclick="location.reload()">Refresh</button>
        </div>
      </section>
    `;
  }
});

document.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (event.target.id === "projectForm") {
    await saveProjectForm(event.target);
  }

  if (event.target.dataset.addItem) {
    await addProjectItem(event.target);
  }

  if (event.target.id === "claimKeyForm") {
    await claimAccessKey(document.getElementById("accessKeyInput").value);
  }

  if (event.target.id === "profileForm") {
    await saveProfileForm();
  }
});

document.addEventListener("click", async (event) => {
  const target = event.target;

  const savePhotoBtn = target.closest?.("#saveScreenshotBtn");
  if (savePhotoBtn) {
    const urlInput = document.getElementById("screenshotUrlInput");
    const imageUrl = urlInput?.value.trim() || selectedProjectPhotoUrl;

    if (!imageUrl) {
      showWarningPopup("Link Foto Masih Kosong", "Tempel link foto project dulu, lalu klik Simpan Link Foto.");
      return;
    }

    await uploadScreenshot(imageUrl);
    return;
  }


  if (target.dataset.copySourceUrl) {
    await copyText(target.dataset.copySourceUrl, "Link download source code berhasil disalin.");
    return;
  }

  if (target.dataset.openProtectedSource) {
    await openProtectedPublicSource();
    return;
  }

  if (target.id === "googleLoginBtn" || target.dataset.publicLogin) {
    await loginGoogle();
  }
  if (target.dataset.view) {
    await switchTabView(target.dataset.view);
    return;
  }

  if (target.id === "openProjectModal") {
    if (!requireAdmin()) return;
    openProjectModal();
  }

  if (target.id === "closeModal") {
    closeModal();
  }

  if (target.id === "editProfileBtn" || target.id === "editProfileBtnSecondary") {
    openProfileModal();
  }

  if (target.id === "logoutBtn") {
    await logout();
  }

  if (target.dataset.detail) {
    currentProjectId = target.dataset.detail;
    activeView = "detail";
    render();
  }

  if (target.dataset.editProject) {
    openProjectModal(target.dataset.editProject);
  }

  if (target.dataset.deleteProject) {
    await deleteProject(target.dataset.deleteProject);
  }

  if (target.dataset.toggleShare) {
    await toggleShareProject(target.dataset.toggleShare);
  }

  if (target.dataset.copyShare) {
    await copyShareLink(target.dataset.copyShare);
  }

  if (target.dataset.copyKey) {
    await copyText(target.dataset.copyKey, "Key berhasil disalin");
  }

  if (target.dataset.deleteKey) {
    await deleteAccessKey(target.dataset.deleteKey);
  }

  if (target.dataset.deleteItem) {
    await deleteProjectItem(target.dataset.deleteItem, target.dataset.itemId);
  }

  if (target.dataset.deleteShot) {
    await deleteScreenshot(target.dataset.deleteShot);
  }

  if (target.id === "clearFilterBtn") {
    projectSearch = "";
    projectStatusFilter = "all";
    renderProjects();
  }

  if (target.dataset.dashboardKeyProject) {
    const selectedId = target.dataset.dashboardKeyProject;
    const input = document.getElementById("dashboardKeyProjectSelect");
    if (input) input.value = selectedId;

    document.querySelectorAll("[data-dashboard-key-project]").forEach(button => {
      const active = button.dataset.dashboardKeyProject === selectedId;
      button.classList.toggle("active", active);
      const label = button.querySelector("em");
      if (label) label.textContent = active ? "Dipilih" : "Pilih";
    });

    await loadDashboardKeyHistory(selectedId);
  }

  if (target.id === "dashboardGenerateKeyBtn") {
    await generateDashboardAccessKey();
  }

  if (target.id === "refreshDashboardKeyHistoryBtn") {
    const select = document.getElementById("dashboardKeyProjectSelect");
    if (select) await loadDashboardKeyHistory(select.value);
  }

  if (target.dataset.deleteDashboardKey) {
    await deleteDashboardAccessKey(target.dataset.projectId, target.dataset.deleteDashboardKey);
  }

  if (target.id === "exportJsonBtn") {
    exportJson();
  }
});

document.addEventListener("change", async (event) => {
  const target = event.target;

  if (target.id === "filterProjectStatus") {
    projectStatusFilter = target.value;
    renderProjects();
  }

  if (target.id === "dashboardKeyProjectSelect") {
    await loadDashboardKeyHistory(target.value);
  }

  if (target.dataset.updateItem) {
    await updateProjectItem(target.dataset.updateItem, target.dataset.itemId, target.value);
  }

  if (target.id === "screenshotUrlInput") {
    updateSelectedProjectPhotoUrl(target.value);
  }
});

document.addEventListener("input", (event) => {
  if (event.target.id === "searchProject") {
    projectSearch = event.target.value;
    renderProjects();
  }

  if (event.target.id === "screenshotUrlInput") {
    updateSelectedProjectPhotoUrl(event.target.value);
  }

  if (event.target.id === "profilePhotoUrlInput") {
    const preview = document.getElementById("profilePhotoPreview");
    const url = event.target.value.trim();

    if (preview && url) {
      preview.src = getImageDirectUrl(url);
    }
  }
});

modalArea.addEventListener("click", (event) => {
  if (event.target === modalArea) {
    closeModal();
  }
});

window.addEventListener("hashchange", () => {
  if (handleRoute()) return;

  if (currentUser) {
    activeView = "dashboard";
    listenProjects();
    showWelcomeIfNeeded();
    render();
  } else {
    renderLogin();
  }
});

onAuthStateChanged(auth, (user) => {
  currentUser = user;

  const route = parseShareRoute();

  if (route) {
    loadPublicProject(route.userId, route.projectId);
    return;
  }

  if (user) {
    projects = [];
    activeView = "dashboard";
    currentProjectId = null;
    hasSyncedPublicProjects = false;

    render();
    listenProjects();
  } else {
    projects = [];
    activeView = "dashboard";
    currentProjectId = null;
    isLoadingProjects = false;
    publicAccess = null;
    hasSyncedPublicProjects = false;

    if (unsubscribeProjects) {
      unsubscribeProjects();
      unsubscribeProjects = null;
    }

    stopKeysListener();
    renderLogin();
  }
});

if (!handleRoute()) {
  renderLogin();
}


// BLANK_PAGE_HARD_FALLBACK_V1
window.addEventListener("load", () => {
  setTimeout(() => {
    const appEl = document.getElementById("root");
    const text = appEl?.textContent?.trim() || "";

    if (!appEl || text.length < 10) {
      console.warn("Blank page fallback aktif.");
      try {
        renderLogin();
      } catch (error) {
        console.error("Render login fallback gagal:", error);
        const target = document.getElementById("root") || document.body;
        target.innerHTML = `
          <section class="blank-hard-fix-page">
            <div class="blank-hard-fix-card">
              <div class="blank-hard-fix-icon">!</div>
              <h1>Web gagal dimuat</h1>
              <p>Halaman kosong karena ada error JavaScript. Refresh halaman atau upload ZIP fix terbaru.</p>
              <button onclick="window.location.reload()">Refresh Halaman</button>
            </div>
          </section>
        `;
      }
    }
  }, 900);
});



document.addEventListener("input", event => {
  const target = event.target;

  if (target.id === "screenshotUrlInput") {
    updateSelectedProjectPhotoUrl(target.value);
  }
});




/* PHOTO PROJECT SCROLL V2 HARDFIX */
function photoProjectScrollV2() {
  const galleries = document.querySelectorAll(
    ".photo-scroll-v2, .center-middle-photos, .photo-carousel, .project-photo-carousel, .public-photo-carousel, .public-hero-photo-strip"
  );

  galleries.forEach(gallery => {
    const items = Array.from(
      gallery.querySelectorAll(".photo-slide, .shot, .public-shot, .public-hero-thumb")
    );

    if (!items.length) return;

    gallery.classList.add("photo-scroll-v2");
    gallery.classList.toggle("single", items.length === 1);

    const middleIndex = Math.floor(items.length / 2);
    const middleItem = items[middleIndex];

    items.forEach((item, index) => {
      item.classList.toggle("is-middle-photo", index === middleIndex);
    });

    const currentCount = String(items.length);
    const shouldCenter =
      gallery.dataset.photoCount !== currentCount ||
      gallery.dataset.centeredV2 !== "true";

    gallery.dataset.photoCount = currentCount;

    if (!shouldCenter || items.length === 1) return;

    requestAnimationFrame(() => {
      const maxScroll = Math.max(0, gallery.scrollWidth - gallery.clientWidth);
      const target =
        middleItem.offsetLeft -
        (gallery.clientWidth / 2) +
        (middleItem.offsetWidth / 2);

      gallery.scrollLeft = Math.min(Math.max(target, 0), maxScroll);
      gallery.dataset.centeredV2 = "true";
    });
  });
}

function startPhotoProjectScrollV2() {
  console.log("CodeProgress Photo Scroll V2 aktif");

  photoProjectScrollV2();
  setTimeout(photoProjectScrollV2, 150);
  setTimeout(photoProjectScrollV2, 450);
  setTimeout(photoProjectScrollV2, 900);

  const target = document.getElementById("root") || document.body;
  if (!target || target.dataset.photoScrollObserverV2 === "true") return;

  target.dataset.photoScrollObserverV2 = "true";

  let timer = null;
  const observer = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(photoProjectScrollV2, 80);
  });

  observer.observe(target, {
    childList: true,
    subtree: true
  });
}

setTimeout(startPhotoProjectScrollV2, 0);
window.addEventListener("load", startPhotoProjectScrollV2);
window.addEventListener("resize", () => {
  document.querySelectorAll(".photo-scroll-v2").forEach(gallery => {
    gallery.dataset.centeredV2 = "false";
  });
  photoProjectScrollV2();
});




/* TOP PHOTO SMOOTH CAROUSEL FIX */
function hydrateTopPhotoSmoothCarousel() {
  const strips = document.querySelectorAll(".public-hero-photo-strip, .public-photo-carousel");

  strips.forEach(strip => {
    const items = Array.from(strip.querySelectorAll(".public-hero-thumb, .photo-slide, .public-shot"));
    if (!items.length) return;

    strip.classList.add("top-photo-smooth-carousel");

    const updateActive = () => {
      const rect = strip.getBoundingClientRect();
      const center = rect.left + rect.width / 2;

      let active = items[0];
      let minDistance = Infinity;

      items.forEach(item => {
        const itemRect = item.getBoundingClientRect();
        const itemCenter = itemRect.left + itemRect.width / 2;
        const distance = Math.abs(center - itemCenter);

        if (distance < minDistance) {
          minDistance = distance;
          active = item;
        }
      });

      items.forEach(item => {
        item.classList.toggle("is-smooth-active", item === active);
      });
    };

    if (strip.dataset.topSmoothReady !== "true") {
      strip.dataset.topSmoothReady = "true";

      let ticking = false;
      strip.addEventListener("scroll", () => {
        if (ticking) return;

        ticking = true;
        requestAnimationFrame(() => {
          updateActive();
          ticking = false;
        });
      }, { passive: true });

      items.forEach(item => {
        item.addEventListener("click", event => {
          if (event.target.closest("button")) return;

          item.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
            inline: "center"
          });
        });
      });
    }

    updateActive();
  });
}

function startTopPhotoSmoothCarousel() {
  hydrateTopPhotoSmoothCarousel();
  setTimeout(hydrateTopPhotoSmoothCarousel, 120);
  setTimeout(hydrateTopPhotoSmoothCarousel, 420);
}

setTimeout(startTopPhotoSmoothCarousel, 0);
window.addEventListener("load", startTopPhotoSmoothCarousel);
window.addEventListener("resize", startTopPhotoSmoothCarousel);




/* WA ADMIN LITERAL RUNTIME GUARD */
function fixWhatsAppAdminLiteralText() {
  const badText = "${renderWhatsAppAdminText(project)}";
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);

  const nodes = [];
  while (walker.nextNode()) {
    if (walker.currentNode.nodeValue && walker.currentNode.nodeValue.includes(badText)) {
      nodes.push(walker.currentNode);
    }
  }

  nodes.forEach(node => {
    const wrapper = document.createElement("span");
    wrapper.className = "source-wa-note";
    wrapper.innerHTML = renderWhatsAppAdminText(
      typeof currentProjectId !== "undefined" && Array.isArray(projects)
        ? projects.find(item => item.id === currentProjectId)
        : null
    );
    node.parentNode.replaceChild(wrapper, node);
  });
}

setTimeout(fixWhatsAppAdminLiteralText, 0);
setTimeout(fixWhatsAppAdminLiteralText, 300);
setTimeout(fixWhatsAppAdminLiteralText, 800);

if (typeof MutationObserver !== "undefined") {
  const waLiteralObserver = new MutationObserver(() => {
    fixWhatsAppAdminLiteralText();
  });

  setTimeout(() => {
    if (document.body && document.body.dataset.waLiteralGuard !== "true") {
      document.body.dataset.waLiteralGuard = "true";
      waLiteralObserver.observe(document.body, { childList: true, subtree: true });
    }
  }, 300);
}




/* DETAIL AUTO SCROLL TOP FIX */
document.addEventListener("click", event => {
  const detailTarget = event.target.closest?.(
    "[data-detail], [data-project-detail], [data-open-detail], .open-detail, .btn-detail"
  );

  if (!detailTarget) return;

  setTimeout(scrollPageToTopInstant, 30);
  setTimeout(scrollPageToTopInstant, 120);
}, true);

function forceTopAfterDetailRender() {
  if (activeView === "detail" || activeView === "projectDetail") {
    scrollPageToTopInstant();
  }
}