import { translate, translateDom } from "./i18n.js";

const maxAgeDays = 90;
const maxBackupBytes = 512 * 1024;
const ageMs = maxAgeDays * 24 * 60 * 60 * 1000;

function latestUse(account) {
  return Math.max(account.lastUsedAt ?? 0, account.lastSavedAt ?? 0);
}

function downloadBackup(backup) {
  const documentData = JSON.stringify(backup, null, 2);
  const url = URL.createObjectURL(new Blob([documentData], { type: "application/json" }));
  const link = document.createElement("a");
  link.download = "multitiktok-organizacion.json";
  link.href = url;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formatDate(timestamp, locale) {
  const date = new Date(timestamp);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date) : "";
}

function localText(text, className) {
  const element = document.createElement("span");
  element.dataset.noTranslate = "";
  element.className = className;
  element.textContent = text;
  return element;
}

export function connectDataDialog({ ui, getModel, request, run, send, ask, messages }) {
  const dialog = ui["data-dialog"];
  const status = ui["data-status"];
  const cleanupList = ui["cleanup-list"];
  let cleanupSnapshot;
  let historySnapshot;
  let fileRead = 0;

  const showStatus = (message) => {
    status.textContent = translate(message ?? "");
    status.hidden = !message;
  };
  const showError = (error) => showStatus(messages[error] ?? messages.unexpected);

  function renderHistory(history, locale) {
    const snapshot = JSON.stringify([history, locale]);
    if (snapshot === historySnapshot) return;
    historySnapshot = snapshot;
    const rows = history.map(({ fromAlias, toAlias, when }) => {
      const item = document.createElement("li");
      item.className = "history-row";
      const change = document.createElement("span");
      const from = fromAlias || translate("Cuenta anterior");
      const to = toAlias || translate("Cuenta de destino");
      change.append(localText(from, ""), " → ", localText(to, ""));
      item.append(change, localText(formatDate(when, locale), "detail"));
      return item;
    });
    ui["history-list"].replaceChildren(...rows);
    ui["history-empty"].hidden = rows.length > 0;
    ui["clear-history"].disabled = rows.length === 0;
  }

  function checkedIds() {
    return Array.from(cleanupList.querySelectorAll("input:checked"), ({ value }) => value);
  }

  function renderCleanup(accounts, active, setup, locale) {
    const past = Date.now() - ageMs;
    const candidates = accounts.filter((account) => {
      const timestamp = latestUse(account);
      return !account.metadataOnly && account.id !== active && account.id !== setup?.accountId && timestamp > 0 && timestamp <= past;
    });
    const snapshot = JSON.stringify([candidates, locale]);
    if (snapshot === cleanupSnapshot) return;
    cleanupSnapshot = snapshot;
    const selected = new Set(checkedIds());
    const rows = candidates.map((account) => {
      const item = document.createElement("li");
      const label = document.createElement("label");
      label.className = "check";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = account.id;
      checkbox.checked = selected.has(account.id);
      label.append(checkbox, localText(account.alias, ""));
      item.append(label, localText(formatDate(latestUse(account), locale), "detail"));
      return item;
    });
    cleanupList.replaceChildren(...rows);
    ui["cleanup-empty"].hidden = rows.length > 0;
    ui["remove-old"].disabled = checkedIds().length === 0;
  }

  function render() {
    const { accounts = [], active, setup, history = [], settings } = getModel();
    const locale = settings?.locale ?? document.documentElement.lang;
    renderHistory(history, locale);
    renderCleanup(accounts, active, setup, locale);
    translateDom(dialog);
  }

  ui["manage-data"].addEventListener("click", () => {
    ui.preferences.close();
    showStatus("");
    render();
    dialog.showModal();
  });
  dialog.addEventListener("close", () => {
    fileRead += 1;
    ui["backup-file"].value = "";
    ui["history-list"].replaceChildren();
    cleanupList.replaceChildren();
    cleanupSnapshot = undefined;
    historySnapshot = undefined;
  });
  ui["clear-history"].addEventListener("click", () => ask({
    title: "¿Limpiar el historial?",
    detail: "Se eliminará el historial de cambios de cuenta de este perfil de Chrome.",
    label: "Limpiar historial",
    kind: "data",
    onConfirm: async () => {
      if (await send("clearHistory", {}, "", showError)) showStatus("Historial eliminado.");
    }
  }));

  ui["export-data"].addEventListener("click", async () => {
    const exported = await run(async () => {
      const result = await request("exportOrganization");
      if (!result?.backup) return { error: result?.error ?? "invalid_backup" };
      downloadBackup(result.backup);
      return request("view");
    }, "", showError);
    if (exported) showStatus("Copia de organización exportada.");
  });
  ui["import-data"].addEventListener("click", () => ui["backup-file"].click());
  ui["backup-file"].addEventListener("change", async () => {
    const [file] = ui["backup-file"].files ?? [];
    ui["backup-file"].value = "";
    const attempt = ++fileRead;
    if (!file) return;
    let backup;
    try {
      if (file.size > maxBackupBytes) throw new TypeError("backup");
      backup = JSON.parse(await file.text());
      if (backup?.version !== 1 || !Array.isArray(backup.accounts)) throw new TypeError("backup");
    } catch {
      if (attempt === fileRead && dialog.open) showError("invalid_backup");
      return;
    }
    if (attempt !== fileRead || !dialog.open) return;
    ask({
      title: "¿Importar esta organización?",
      detail: "Se aplicarán los datos de organización del archivo. Reconecta en TikTok las cuentas importadas que necesiten una sesión.",
      label: "Importar JSON",
      kind: "data",
      onConfirm: async () => {
        if (await send("importOrganization", { backup }, "", showError)) showStatus("Organización importada.");
      }
    });
  });
  cleanupList.addEventListener("change", () => { ui["remove-old"].disabled = checkedIds().length === 0; });
  ui["remove-old"].addEventListener("click", () => {
    const ids = checkedIds();
    if (!ids.length) return;
    ask({
      title: "¿Borrar las copias seleccionadas?",
      detail: "Se borrarán las copias seleccionadas de este perfil de Chrome. Podrás volver a guardarlas iniciando sesión en TikTok.",
      label: "Borrar seleccionadas",
      kind: "data",
      onConfirm: async () => {
        if (await send("removeOld", { ids, maxAgeDays }, "", showError)) showStatus("Copias seleccionadas eliminadas.");
      }
    });
  });

  return { render };
}
