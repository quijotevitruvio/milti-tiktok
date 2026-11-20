export function registerShortcuts({ openPrevious, openFavorite }) {
  const shortcuts = {
    "open-previous-account": openPrevious,
    "open-favorite-account": openFavorite
  };
  chrome.commands.onCommand.addListener(async (command) => {
    const action = Object.hasOwn(shortcuts, command) ? shortcuts[command] : null;
    if (!action) return;
    try {
      await action();
    } catch {
      console.warn("No se pudo abrir la cuenta de TikTok desde el atajo.");
    }
  });
}
