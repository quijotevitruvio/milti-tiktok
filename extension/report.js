const allowedCodes = new Set([
  "account_mismatch", "alias", "busy", "expired", "focus_failed", "identity_unconfirmed",
  "interrupted", "invalid_color", "invalid_order", "locked", "multiple_tabs", "open_failed",
  "park_failed", "permission", "phrase_length", "recovery", "restored", "save_tab", "setup_active",
  "sign_in", "storage", "unexpected", "unknown_account", "unsaved", "wrong_phrase"
]);

export function reportUrl(code) {
  const { version } = chrome.runtime.getManifest();
  const safeVersion = /^\d+(?:\.\d+){0,3}$/.test(version) ? version : "desconocida";
  const safeCode = allowedCodes.has(code) ? code : "unexpected";
  const url = new URL("https://github.com/quijotevitruvio/milti-tiktok/issues/new");
  url.searchParams.set("title", "Problema con MultiTikTok");
  const lines = [`Versión de MultiTikTok: ${safeVersion}`];
  if (code != null) lines.push(`Código de error: ${safeCode}`);
  url.searchParams.set("body", lines.join("\n"));
  return url.toString();
}
