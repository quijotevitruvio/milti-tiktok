const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const empty = () => ({ accounts: [], active: null, previous: null, invite: null, pending: null });

export class VaultError extends Error {}

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
    vaultV1: { salt: Array.from(salt), iv: Array.from(iv), data: Array.from(new Uint8Array(ciphertext)) }
  });
}

export async function unlock(phrase) {
  const { vaultV1 } = await chrome.storage.local.get("vaultV1");
  if (typeof phrase !== "string" || phrase.length < 12 || phrase.length > 256) {
    throw new VaultError("phrase_length");
  }
  const salt = vaultV1 ? new Uint8Array(vaultV1.salt) : crypto.getRandomValues(new Uint8Array(16));
  const bytes = await derive(phrase, salt);
  const key = await keyFrom(bytes);
  let state;
  if (vaultV1) {
    try {
      state = await decrypt(vaultV1, key);
    } catch {
      throw new VaultError("wrong_phrase");
    }
  } else {
    state = empty();
    await persist(state, key, salt);
  }
  await chrome.storage.session.set({ vaultKey: Array.from(bytes) });
  return { state, key, salt };
}

export async function readVault() {
  const [{ vaultV1 }, { vaultKey }] = await Promise.all([
    chrome.storage.local.get("vaultV1"), chrome.storage.session.get("vaultKey")
  ]);
  if (!vaultV1 || !vaultKey) return { exists: Boolean(vaultV1) };
  const key = await keyFrom(vaultKey);
  const salt = new Uint8Array(vaultV1.salt);
  return { exists: true, state: await decrypt(vaultV1, key), key, salt };
}

export async function lock() {
  await chrome.storage.session.remove("vaultKey");
}
