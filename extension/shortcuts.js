export function registerShortcuts({ openPrevious }) {
  chrome.commands.onCommand.addListener(async (command) => {
    if (command !== "open-previous-account") return;
    try {
      await openPrevious();
    } catch {
      console.warn("No se pudo abrir la cuenta anterior desde el atajo.");
    }
  });
}
