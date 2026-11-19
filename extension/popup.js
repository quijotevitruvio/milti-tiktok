import { askHost, describeError } from "./native.js";

const ui = Object.fromEntries(
  Array.from(document.querySelectorAll("[id]"), (element) => [element.id, element])
);
const collator = new Intl.Collator("es", { sensitivity: "base" });

let accounts = [];
let profiles = [];
let history = {};
let hostReady = false;
let editingId;
let busy = false;

function announce(message, error = false) {
  ui.status.textContent = message;
  ui.status.dataset.error = String(error);
}

function render() {
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  const ordered = [...accounts].sort((first, second) =>
    Number(second.favorite) - Number(first.favorite) || collator.compare(first.alias, second.alias)
  );
  const rows = ordered.map((account) => {
    const row = ui["account-row"].content.cloneNode(true);
    const available = profilesById.has(account.id);
    const detail = [];
    if (account.favorite) detail.push("Favorita");
    if (!available && hostReady) detail.push("Perfil no disponible");
    if (account.id === history.last) detail.push("Última abierta");
    if (available) detail.push(profilesById.get(account.id).name);

    row.querySelector(".name").textContent = account.alias;
    row.querySelector(".avatar").textContent = Array.from(account.alias)[0].toLocaleUpperCase("es");
    row.querySelector(".detail").textContent = detail.join(" · ");
    const open = row.querySelector(".account");
    open.dataset.accountId = account.id;
    open.disabled = busy || !available;
    open.setAttribute("aria-label", `Abrir ${account.alias}`);
    open.addEventListener("click", () => run(() => openProfile(account)));
    const more = row.querySelector(".more");
    more.dataset.accountId = account.id;
    more.disabled = busy;
    more.setAttribute("aria-label", `Editar ${account.alias}`);
    more.addEventListener("click", () => editAccount(account));
    return row;
  });
  ui.accounts.replaceChildren(...rows);

  const selected = ui.profile.value;
  const linked = new Set(accounts.map((account) => account.id));
  const unlinked = profiles.filter((profile) => !linked.has(profile.id));
  ui.profile.replaceChildren(...unlinked.map((profile) => new Option(profile.name, profile.id)));
  if (unlinked.some((profile) => profile.id === selected)) ui.profile.value = selected;
  ui.add.hidden = !hostReady || unlinked.length === 0;
  ui.help.hidden = !hostReady || unlinked.length > 0;
  ui.help.textContent = "Crea otro perfil desde el menú de Chrome y pulsa Actualizar.";

  ui.previous.hidden = !linked.has(history.previous) || !profilesById.has(history.previous);
  ui.previous.disabled = busy;
  ui.refresh.disabled = busy;
  for (const control of ui.add.elements) control.disabled = busy;
}

async function run(operation) {
  if (busy) return;
  const trigger = document.activeElement;
  busy = true;
  render();
  try {
    await operation();
  } catch {
    announce("No se pudo completar la acción. Vuelve a intentarlo.", true);
  } finally {
    busy = false;
    render();
    if (document.activeElement === document.body && trigger instanceof HTMLElement) {
      const replacement = trigger.isConnected ? trigger : Array.from(ui.accounts.querySelectorAll("button"))
        .find((button) => button.className === trigger.className &&
          button.dataset.accountId === trigger.dataset.accountId);
      if (replacement && !replacement.disabled && replacement.getClientRects().length) {
        replacement.focus();
      }
    }
  }
}

async function refreshProfiles() {
  announce("Buscando perfiles de Chrome…");
  const result = await askHost({ command: "listProfiles" });
  hostReady = result.ok;
  profiles = result.ok ? result.profiles : [];
  announce(result.ok ? "" : describeError(result.error), !result.ok);
}

async function saveAccounts(next) {
  await chrome.storage.local.set({ accounts: next });
  accounts = next;
}

async function openProfile(account) {
  if (!account) return;
  announce(`Abriendo ${account.alias}…`);
  const result = await chrome.runtime.sendMessage({ type: "openProfile", id: account.id });
  if (!result.ok) {
    announce(describeError(result.error), true);
    return;
  }
  ({ history = {} } = await chrome.storage.local.get("history"));
  announce(`Chrome recibió la solicitud para abrir ${account.alias}.`);
}

function editAccount(account) {
  editingId = account.id;
  ui["edit-alias"].value = account.alias;
  ui["edit-alias"].setCustomValidity("");
  ui.favorite.checked = account.favorite;
  ui.edit.showModal();
}

ui.refresh.addEventListener("click", () => run(refreshProfiles));
ui.previous.addEventListener("click", () =>
  run(() => openProfile(accounts.find((account) => account.id === history.previous)))
);
ui.add.addEventListener("submit", (event) => {
  event.preventDefault();
  const profile = profiles.find((item) => item.id === ui.profile.value);
  if (!profile || accounts.some((account) => account.id === profile.id)) return;
  const alias = ui.alias.value.trim() || profile.name.slice(0, 48);
  run(async () => {
    await saveAccounts([...accounts, { id: profile.id, alias, favorite: false }]);
    ui.alias.value = "";
    announce(`${alias} quedó vinculada. Ábrela para iniciar sesión en TikTok.`);
  });
});
ui["edit-form"].addEventListener("submit", (event) => {
  event.preventDefault();
  const alias = ui["edit-alias"].value.trim();
  if (!alias) {
    ui["edit-alias"].setCustomValidity("Escribe un alias.");
    ui["edit-alias"].reportValidity();
    return;
  }
  const favorite = ui.favorite.checked;
  ui.edit.close();
  run(async () => {
    await saveAccounts(accounts.map((account) =>
      account.id === editingId ? { ...account, alias, favorite } : account
    ));
    announce("Cambios guardados.");
  });
});
ui["edit-alias"].addEventListener("input", () => ui["edit-alias"].setCustomValidity(""));
ui.cancel.addEventListener("click", () => ui.edit.close());
ui.unlink.addEventListener("click", () => {
  ui.edit.close();
  run(async () => {
    await saveAccounts(accounts.filter((account) => account.id !== editingId));
    announce("Cuenta desvinculada. La sesión de TikTok sigue en el perfil de Chrome.");
  });
});
for (const id of ["dismiss", "star"]) {
  ui[id].addEventListener("click", () => { ui.invite.hidden = true; });
}

run(async () => {
  const saved = await chrome.storage.local.get(["accounts", "history", "invite"]);
  accounts = saved.accounts ?? [];
  history = saved.history ?? {};
  if (saved.invite === "pending") {
    await chrome.storage.local.set({ invite: "shown" });
    ui.invite.hidden = false;
  }
  await refreshProfiles();
});
