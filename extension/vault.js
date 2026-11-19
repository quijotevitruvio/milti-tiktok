const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const empty = () => ({ accounts: [], active: null, previous: null, invite: null, pending: null });

export class VaultError extends Error {}

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

export async function persist(state, key, salt) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(JSON.stringify(state)));
  await chrome.storage.local.set({
    vaultV1: { salt: salt ? Array.from(salt) : null, iv: Array.from(iv), data: Array.from(new Uint8Array(ciphertext)) }
  });
}

export async function unlock(phrase) {
  const { vaultV1 } = await chrome.storage.local.get("vaultV1");
  if (!vaultV1?.salt) return readVault();
  const salt = new Uint8Array(vaultV1.salt);
  const bytes = await phraseKey(phrase, salt);
  const key = await keyFrom(bytes);
  let state;
  try {
    state = await decrypt(vaultV1, key);
  } catch {
    throw new VaultError("wrong_phrase");
  }
  await chrome.storage.session.set({ vaultKey: Array.from(bytes) });
  return { state, key, salt };
}

async function phraseKey(phrase, salt) {
  if (typeof phrase !== "string" || phrase.length < 12 || phrase.length > 256) {
    throw new VaultError("phrase_length");
  }
  return derive(phrase, salt);
}

export async function setProtection(state, phrase) {
  if (phrase === null) {
    await persist(state, await deviceKey(), null);
    await lock();
    return;
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bytes = await phraseKey(phrase, salt);
  const key = await keyFrom(bytes);
  await chrome.storage.session.set({ vaultKey: Array.from(bytes) });
  await persist(state, key, salt);
}

export async function readVault() {
  const [{ vaultV1 }, { vaultKey }] = await Promise.all([
    chrome.storage.local.get("vaultV1"), chrome.storage.session.get("vaultKey")
  ]);
  if (!vaultV1?.salt) {
    const key = await deviceKey();
    return { state: vaultV1 ? await decrypt(vaultV1, key) : empty(), key, salt: null };
  }
  if (!vaultKey) return { protected: true };
  const key = await keyFrom(vaultKey);
  const salt = new Uint8Array(vaultV1.salt);
  return { exists: true, state: await decrypt(vaultV1, key), key, salt };
}

export async function lock() {
  await chrome.storage.session.remove("vaultKey");
}
