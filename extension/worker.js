import { fingerprint, home, hostPermission, login, readCookies, replaceCookies } from "./sessions.js";
import { lock, persist, readVault, setProtection, unlock, VaultError } from "./vault.js";
import { profilePhoto } from "./avatar.js";

const transition = chrome.runtime.getURL("transition.html");
const permissions = { origins: [hostPermission] };
let busy = false;

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.url !== chrome.runtime.getURL("popup.html")) return;
  if (busy) {
    respond({ error: "busy" });
    return;
  }
  busy = true;
  dispatch(message)
    .catch((error) => ({ error: error instanceof VaultError ? error.message : "unexpected" }))
    .then((result) => {
      busy = false;
      respond(result);
    });
  return true;
});

function write(vault, state) {
  return persist(state, vault.key, vault.salt);
}

function currentAccount(state, identity) {
  return identity ? state.accounts.find((account) => account.identity === identity) : undefined;
}

async function view(vault, allowed) {
  const { state } = vault;
  if (!state) return { allowed, protected: true, unlocked: false };
  const active = allowed && !state.pending
    ? currentAccount(state, await fingerprint(await readCookies()))?.id ?? null : null;
  return {
    allowed, protected: Boolean(vault.salt), unlocked: true, active, previous: state.previous,
    recovery: Boolean(state.pending), invite: state.invite === "pending",
    accounts: state.accounts.map(({ id, alias, favorite, avatar }) => ({ id, alias, favorite, avatar }))
  };
}

async function dispatch(message) {
  const command = message?.command;
  const allowed = await chrome.permissions.contains(permissions);
  let vault = await readVault();
  if (command === "view") return view(vault, allowed);
  if (command === "unlock") {
    vault = await unlock(message.phrase);
    return view(vault, allowed);
  }
  if (command === "lock") {
    await lock();
    return view(await readVault(), allowed);
  }
  if (!vault.state) throw new VaultError("locked");
  if (command === "setProtection") {
    await setProtection(vault.state, message.phrase);
    return view(await readVault(), allowed);
  }
  if (!allowed) throw new VaultError("permission");
  if (command === "recover") {
    await recover(vault);
    return view(await readVault(), allowed);
  }
  const { state } = vault;
  if (state.pending) throw new VaultError("recovery");
  switch (command) {
    case "save":
      await saveAccount(vault, message.alias);
      break;
    case "edit":
      await editAccount(vault, message);
      break;
    case "forget": {
      await write(vault, {
        ...state,
        accounts: state.accounts.filter(({ id }) => id !== message.id),
        active: state.active === message.id ? null : state.active,
        previous: state.previous === message.id ? null : state.previous
      });
      break;
    }
    case "dismiss":
      await write(vault, { ...state, invite: "shown" });
      break;
    case "add":
    case "switch": {
      const destination = await changeSession(vault, command, message.id);
      // The popup may close during navigation. Its next opening reads the committed state.
      return { destination };
    }
    default:
      throw new VaultError("unexpected");
  }
  return view(await readVault(), allowed);
}

async function tiktokTabs() {
  const tabs = await chrome.tabs.query({ url: [hostPermission] });
  return tabs.filter((tab) => !tab.incognito);
}

function checkAlias(alias) {
  if (typeof alias !== "string" || !alias.trim() || alias.trim().length > 48) {
    throw new VaultError("alias");
  }
  return alias.trim();
}

async function saveAccount(vault, label) {
  const alias = checkAlias(label);
  const tabs = await tiktokTabs();
  if (tabs.length !== 1) throw new VaultError("save_tab");
  const cookies = await readCookies();
  const identity = await fingerprint(cookies);
  if (!identity) throw new VaultError("sign_in");
  const { state } = vault;
  const existing = currentAccount(state, identity);
  const avatar = await profilePhoto(tabs[0].id);
  if (await fingerprint(await readCookies()) !== identity) throw new VaultError("unsaved");
  const account = {
    id: existing?.id ?? crypto.randomUUID(), alias, favorite: existing?.favorite ?? false,
    cookies, identity, avatar: avatar ?? existing?.avatar ?? null
  };
  const accounts = existing
    ? state.accounts.map((item) => item.id === account.id ? account : item)
    : [...state.accounts, account];
  await write(vault, {
    ...state, accounts, active: account.id,
    previous: state.active && state.active !== account.id ? state.active : state.previous
  });
}

async function editAccount(vault, message) {
  const alias = checkAlias(message.alias);
  const accounts = vault.state.accounts.map((account) => account.id === message.id
    ? { ...account, alias, favorite: Boolean(message.favorite) } : account);
  await write(vault, { ...vault.state, accounts });
}

async function park(tabId) {
  const tabs = await tiktokTabs();
  if (tabs.length > 1) throw new VaultError("multiple_tabs");
  const tab = tabs[0] ?? (tabId === undefined ? null : await getTab(tabId));
  let id;
  if (tab?.url === transition) {
    id = tab.id;
  } else if (tabs.length) {
    await chrome.tabs.update(tab.id, { url: transition });
    id = tab.id;
  } else {
    id = (await chrome.tabs.create({ url: transition, active: false })).id;
  }
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const parked = await getTab(id);
    if (parked?.url === transition && parked.status === "complete") {
      if ((await tiktokTabs()).length) break;
      return id;
    }
    if (!parked) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new VaultError("park_failed");
}

async function getTab(id) {
  try {
    return await chrome.tabs.get(id);
  } catch {
    return null;
  }
}

async function navigate(id, url) {
  try {
    await chrome.tabs.update(id, { url, active: true });
    return true;
  } catch {
    return false;
  }
}

async function recover(vault) {
  const pending = vault.state.pending;
  if (!pending) return;
  const tabId = await park(pending.tabId);
  try {
    await replaceCookies(pending.before);
    await write(vault, { ...vault.state, pending: null });
  } catch {
    throw new VaultError("recovery");
  }
  await navigate(tabId, home);
}

async function changeSession(vault, command, id) {
  const { state } = vault;
  const target = command === "switch" ? state.accounts.find((account) => account.id === id) : null;
  if (command === "switch" && !target) throw new VaultError("unknown_account");
  if (target && await fingerprint(target.cookies) !== target.identity) throw new VaultError("expired");
  const initialIdentity = await fingerprint(await readCookies());
  if (initialIdentity && !currentAccount(state, initialIdentity)) throw new VaultError("unsaved");

  const tabId = await park();
  let before;
  let identity;
  try {
    before = await readCookies();
    identity = await fingerprint(before);
  } catch {
    await navigate(tabId, home);
    throw new VaultError("unexpected");
  }
  const current = currentAccount(state, identity);
  if (identity && !current) {
    await navigate(tabId, home);
    throw new VaultError("unsaved");
  }
  if (current?.id === target?.id && target) {
    return { opened: await navigate(tabId, home), login: false };
  }
  const saved = {
    ...state,
    accounts: state.accounts.map((account) =>
      account.id === current?.id ? { ...account, cookies: before } : account)
  };
  const pending = { ...saved, pending: { before, tabId } };
  try {
    await write(vault, pending);
  } catch {
    await navigate(tabId, home);
    throw new VaultError("storage");
  }
  try {
    if ((await tiktokTabs()).length) throw new VaultError("multiple_tabs");
    await replaceCookies(target?.cookies ?? []);
    if ((await tiktokTabs()).length) throw new VaultError("multiple_tabs");
    await write(vault, {
      ...saved, active: target?.id ?? null,
      previous: current?.id ?? (state.previous === target?.id ? null : state.previous),
      invite: state.invite ?? (target && current ? "pending" : null),
      pending: null
    });
  } catch (error) {
    try {
      await recover({ ...vault, state: pending });
    } catch {
      throw new VaultError("recovery");
    }
    throw error instanceof VaultError ? error : new VaultError("restored");
  }
  return { opened: await navigate(tabId, target ? home : login), login: !target };
}
