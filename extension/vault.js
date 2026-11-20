import { readPreferences } from "./preferences.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const empty = () => ({ accounts: [], active: null, previous: null, invite: null, pending: null });
const autoLockAlarm = "vault-auto-lock";
let accessQueue = Promise.resolve();

export class VaultError extends Error {}

function withVaultAccess(operation) {
  const result = accessQueue.then(operation);
  accessQueue = result.catch(() => {});
  return result;
}

function openKeyStore() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("multitiktok-keys", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("keys");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function deviceKey() {
  return openKeyStore().then(async (db) => {
    try {
      const existing = await new Promise((resolve, reject) => {
        const request = db.transaction("keys", "readonly").objectStore("keys").get("device");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      if (existing) return existing;
      const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
      await new Promise((resolve, reject) => {
        const transaction = db.transaction("keys", "readwrite");
        transaction.oncomplete = resolve;
        transaction.onabort = () => reject(transaction.error);
        transaction.objectStore("keys").add(key, "device");
      });
      return key;
    } finally {
      db.close();
    }
  });
}

async function derive(phrase, salt) {
  const input = await crypto.subtle.importKey("raw", encoder.encode(phrase), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 600_000, hash: "SHA-256" }, input, 256
  );
  return new Uint8Array(bits);
}

async function keyFrom(bytes) {
  return crypto.subtle.importKey("raw", new Uint8Array(bytes), "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function decrypt(record, key) {
  const raw = await crypto.subtle.decrypt({
    name: "AES-GCM", iv: new Uint8Array(record.iv)
  }, key, new Uint8Array(record.data));
  return JSON.parse(decoder.decode(raw));
}

async function encrypt(state, key, salt) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(JSON.stringify(state)));
  return { salt: salt ? Array.from(salt) : null, iv: Array.from(iv), data: Array.from(new Uint8Array(ciphertext)) };
}

export async function persist(state, key, salt) {
  await chrome.storage.local.set({ vaultV1: await encrypt(state, key, salt) });
}

async function phraseKey(phrase, salt) {
  if (typeof phrase !== "string" || phrase.length < 12 || phrase.length > 256) {
    throw new VaultError("phrase_length");
  }
  return derive(phrase, salt);
}

async function getAccess() {
  const [{ vaultV1 }, { vaultKey }, { autoLockMinutes }] = await Promise.all([
    chrome.storage.local.get("vaultV1"), chrome.storage.session.get("vaultKey"), readPreferences()
  ]);
  return { vaultV1, vaultKey, autoLockMinutes };
}

function matchingSessionKey(vaultV1, vaultKey) {
  const salt = vaultV1?.salt;
  if (!salt) return null;
  if (Array.isArray(vaultKey)) return { salt, bytes: vaultKey };
  return [vaultKey?.current, vaultKey?.fallback].find((key) =>
    key?.salt.length === salt.length && salt.every((byte, index) => byte === key.salt[index])
  ) ?? null;
}

async function clearAccess() {
  await chrome.storage.session.remove("vaultKey");
  await chrome.alarms.clear(autoLockAlarm);
}

async function refreshAutoLock({ vaultV1, vaultKey, autoLockMinutes }, touch = false) {
  const current = matchingSessionKey(vaultV1, vaultKey);
  if (!current) {
    if (vaultKey) await chrome.storage.session.remove("vaultKey");
    await chrome.alarms.clear(autoLockAlarm);
    return null;
  }

  const now = Date.now();
  const interval = autoLockMinutes * 60_000;
  const lastActivity = vaultKey.lastActivity ?? now;
  if (interval && lastActivity + interval <= now) {
    await clearAccess();
    return null;
  }

  const activity = touch ? now : lastActivity;
  if (vaultKey.current !== current || vaultKey.fallback || vaultKey.lastActivity !== activity) {
    await chrome.storage.session.set({ vaultKey: { current, lastActivity: activity } });
  }
  if (interval) {
    const deadline = activity + interval;
    const alarm = await chrome.alarms.get(autoLockAlarm);
    if (alarm?.scheduledTime !== deadline) await chrome.alarms.create(autoLockAlarm, { when: deadline });
  } else {
    await chrome.alarms.clear(autoLockAlarm);
  }
  return current;
}

async function openVault(vaultV1, sessionKey) {
  if (!vaultV1?.salt) {
    const key = await deviceKey();
    return { state: vaultV1 ? await decrypt(vaultV1, key) : empty(), key, salt: null };
  }
  if (!sessionKey) return { protected: true };
  const key = await keyFrom(sessionKey.bytes);
  const salt = new Uint8Array(vaultV1.salt);
  return { exists: true, state: await decrypt(vaultV1, key), key, salt };
}

export function readVault() {
  return withVaultAccess(async () => {
    const access = await getAccess();
    return openVault(access.vaultV1, await refreshAutoLock(access));
  });
}

export function unlock(phrase) {
  return withVaultAccess(async () => {
    const access = await getAccess();
    const { vaultV1 } = access;
    if (!vaultV1?.salt) return openVault(vaultV1);
    const salt = new Uint8Array(vaultV1.salt);
    const bytes = await phraseKey(phrase, salt);
    const key = await keyFrom(bytes);
    let state;
    try {
      state = await decrypt(vaultV1, key);
    } catch {
      throw new VaultError("wrong_phrase");
    }
    const vaultKey = { current: { salt: vaultV1.salt, bytes: Array.from(bytes) }, lastActivity: Date.now() };
    await chrome.storage.session.set({ vaultKey });
    await refreshAutoLock({ ...access, vaultKey });
    return { state, key, salt };
  });
}

export function setProtection(state, phrase) {
  return withVaultAccess(async () => {
    const access = await getAccess();
    const previous = await refreshAutoLock(access);
    if (access.vaultV1?.salt && !previous) throw new VaultError("locked");
    if (phrase === null) {
      await persist(state, await deviceKey(), null);
      await clearAccess();
      return;
    }
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const bytes = await phraseKey(phrase, salt);
    const vaultV1 = await encrypt(state, await keyFrom(bytes), salt);
    // Keep the key for the durable record until its replacement has committed.
    const vaultKey = {
      current: { salt: vaultV1.salt, bytes: Array.from(bytes) },
      fallback: previous,
      lastActivity: Date.now()
    };
    await chrome.storage.session.set({ vaultKey });
    await chrome.storage.local.set({ vaultV1 });
    await refreshAutoLock({ ...access, vaultV1, vaultKey });
  });
}

export function lock() {
  return withVaultAccess(clearAccess);
}

export function touchVault() {
  return withVaultAccess(async () => { await refreshAutoLock(await getAccess(), true); });
}

function reconcileAutoLock() {
  withVaultAccess(async () => { await refreshAutoLock(await getAccess()); })
    .catch(() => console.warn("No se pudo sincronizar el autobloqueo de MultiTikTok."));
}

chrome.alarms.onAlarm.addListener(({ name }) => {
  if (name === autoLockAlarm) reconcileAutoLock();
});
reconcileAutoLock();
