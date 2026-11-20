import { VaultError } from "./vault.js";

export const toolCommands = new Set(["archive", "exportOrganization", "importOrganization", "clearHistory", "removeOld"]);

const historyLimit = 100;
const dayMs = 86_400_000;

export function checkAlias(alias) {
  if (typeof alias !== "string" || !alias.trim() || alias.trim().length > 48) {
    throw new VaultError("alias");
  }
  return alias.trim();
}

function validColor(color) {
  return typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color);
}

function checkColor(color) {
  if (color === null || validColor(color)) return color;
  throw new VaultError("invalid_color");
}

function normalizeGroup(group) {
  if (typeof group !== "string") return null;
  return group.normalize("NFC").replace(/[\p{Cc}\p{Bidi_Control}\s]+/gu, " ")
    .trim().slice(0, 48).toWellFormed().trimEnd() || null;
}

function normalizeNote(note) {
  if (typeof note !== "string") return "";
  return note.replace(/\r\n?/g, "\n")
    .replace(/[\p{Cc}\p{Bidi_Control}]/gu, (character) => "\t\n".includes(character) ? character : "")
    .trim().slice(0, 500).toWellFormed().trimEnd();
}

function validTimestamp(value) {
  return Number.isSafeInteger(value) && value > 0 && value <= 8_640_000_000_000_000;
}

function organization(account) {
  return {
    alias: account.alias,
    favorite: account.favorite === true,
    color: validColor(account.color) ? account.color : null,
    group: normalizeGroup(account.group),
    archived: account.archived === true,
    requireConfirm: account.requireConfirm === true
  };
}

export function publicAccount(account) {
  return {
    id: account.id,
    ...organization(account),
    avatar: account.avatar ?? null,
    handle: account.handle ?? null,
    note: normalizeNote(account.note),
    metadataOnly: account.metadataOnly === true,
    lastUsedAt: validTimestamp(account.lastUsedAt) ? account.lastUsedAt : null,
    lastSavedAt: validTimestamp(account.lastSavedAt) ? account.lastSavedAt : null
  };
}

export function editedAccount(existing, message) {
  return {
    ...existing,
    alias: message.alias === undefined ? existing.alias : checkAlias(message.alias),
    favorite: message.favorite === undefined ? existing.favorite : message.favorite === true,
    color: message.color === undefined ? existing.color : checkColor(message.color),
    group: message.group === undefined ? existing.group : normalizeGroup(message.group),
    note: message.note === undefined ? existing.note : normalizeNote(message.note),
    requireConfirm: message.requireConfirm === undefined ? existing.requireConfirm : message.requireConfirm === true
  };
}

function normalizeHistoryEntry(entry) {
  if (!entry || typeof entry.to !== "string" || !entry.to || !validTimestamp(entry.when)) return null;
  return {
    from: typeof entry.from === "string" && entry.from ? entry.from : null,
    to: entry.to,
    when: entry.when
  };
}

function historyEntries(state) {
  const history = Array.isArray(state.history) ? state.history : [];
  return history.slice(0, historyLimit).map(normalizeHistoryEntry).filter(Boolean);
}

export function appendHistory(state, entry) {
  const recent = normalizeHistoryEntry(entry);
  return recent ? { ...state, history: [recent, ...historyEntries(state)].slice(0, historyLimit) } : state;
}

export function readHistory(state) {
  const aliases = new Map(state.accounts.map(({ id, alias }) => [id, alias]));
  return historyEntries(state).map((entry) => ({
    ...entry,
    fromAlias: aliases.get(entry.from) ?? null,
    toAlias: aliases.get(entry.to) ?? null
  }));
}

function normalizedAlias(alias) {
  return alias.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("es");
}

function importOrganization(state, backup) {
  if (backup?.version !== 1 || !Array.isArray(backup.accounts)) throw new VaultError("invalid_backup");
  const aliases = new Set(state.accounts.map(({ alias }) => normalizedAlias(alias)));
  const added = [];
  for (const account of backup.accounts) {
    if (!account || typeof account !== "object" || Array.isArray(account) ||
        ["favorite", "archived", "requireConfirm"].some((field) =>
          account[field] !== undefined && typeof account[field] !== "boolean"
        ) || (account.group != null && typeof account.group !== "string")) {
      throw new VaultError("invalid_backup");
    }
    if (account.color != null && !validColor(account.color)) throw new VaultError("invalid_backup");
    let alias;
    try {
      alias = checkAlias(account.alias);
    } catch {
      throw new VaultError("invalid_backup");
    }
    const key = normalizedAlias(alias);
    if (aliases.has(key)) continue;
    aliases.add(key);
    added.push({ id: crypto.randomUUID(), ...organization({ ...account, alias }), metadataOnly: true });
  }
  return added.length ? { ...state, accounts: [...state.accounts, ...added] } : state;
}

function archiveAccount(state, { id, archived }, activeId) {
  if (typeof archived !== "boolean" ||
      (archived && (id === activeId || id === state.setup?.accountId))) {
    throw new VaultError("invalid_archive");
  }
  if (!state.accounts.some((account) => account.id === id)) throw new VaultError("unknown_account");
  return {
    ...state,
    accounts: state.accounts.map((account) => account.id === id ? { ...account, archived } : account)
  };
}

function removeOldAccounts(state, { ids, maxAgeDays }, { activeId, now }) {
  if (state.pending) throw new VaultError("recovery");
  if (!Array.isArray(ids) || !ids.length || !Number.isSafeInteger(maxAgeDays) ||
      maxAgeDays <= 0 || maxAgeDays > Math.floor(now / dayMs)) {
    throw new VaultError("invalid_cleanup");
  }
  const selected = new Set(ids);
  const protectedIds = new Set([activeId, state.active, state.setup?.accountId]);
  const cutoff = now - maxAgeDays * dayMs;
  const eligible = new Set(state.accounts.filter((account) => {
    if (protectedIds.has(account.id) || account.metadataOnly === true) return false;
    const knownDates = [account.lastUsedAt, account.lastSavedAt].filter(validTimestamp);
    return knownDates.length > 0 && Math.max(...knownDates) <= cutoff;
  }).map(({ id }) => id));
  if (selected.size !== ids.length || ids.some((id) => !eligible.has(id))) {
    throw new VaultError("invalid_cleanup");
  }
  return {
    ...state,
    accounts: state.accounts.filter(({ id }) => !selected.has(id)),
    previous: selected.has(state.previous) ? null : state.previous
  };
}

export function applyAccountTool(state, message, { activeId, now = Date.now() } = {}) {
  switch (message.command) {
    case "archive":
      return { state: archiveAccount(state, message, activeId) };
    case "exportOrganization":
      return { backup: { version: 1, accounts: state.accounts.map(organization) } };
    case "importOrganization":
      return { state: importOrganization(state, message.backup) };
    case "clearHistory":
      return { state: { ...state, history: [] } };
    case "removeOld":
      return { state: removeOldAccounts(state, message, { activeId, now }) };
    default:
      throw new VaultError("unexpected");
  }
}
