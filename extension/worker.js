import { askHost } from "./native.js";

let opening = false;
const popupUrl = chrome.runtime.getURL("popup.html");

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.url !== popupUrl || message?.type !== "openProfile") {
    return;
  }
  if (opening) {
    respond({ ok: false, error: "switch_busy" });
    return;
  }
  opening = true;
  openProfile(message.id)
    .catch(() => ({ ok: false, error: "unavailable_host" }))
    .then((result) => {
      opening = false;
      respond(result);
    });
  return true;
});

async function openProfile(id) {
  const { accounts = [], history = {}, invite } = await chrome.storage.local.get([
    "accounts", "history", "invite"
  ]);
  if (!accounts.some((account) => account.id === id)) {
    return { ok: false, error: "profile_unavailable" };
  }

  const result = await askHost({ command: "openProfile", id });
  if (!result.ok) {
    return result;
  }

  const updates = {};
  if (id !== history.last) {
    updates.history = { last: id, previous: history.last ?? null };
  }
  if (invite === undefined) {
    updates.invite = "pending";
  }
  try {
    await chrome.storage.local.set(updates);
  } catch {
    return { ok: false, error: "history_unavailable" };
  }
  return { ok: true };
}
