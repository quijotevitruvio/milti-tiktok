function normalize(settings) {
  const {
    quickSwitch, autoLockMinutes, sortMode, density, highContrast, locale, favoriteShortcutId, seenVersion
  } = settings ?? {};
  const validMinutes = Number.isInteger(autoLockMinutes) && autoLockMinutes >= 0 && autoLockMinutes <= 1440;
  const validShortcut = typeof favoriteShortcutId === "string" && /^[^\s\p{Cc}]{1,128}$/u.test(favoriteShortcutId);
  const validVersion = typeof seenVersion === "string" && /^\d{1,5}(\.\d{1,5}){0,3}$/.test(seenVersion);
  return {
    quickSwitch: quickSwitch === true,
    autoLockMinutes: validMinutes ? autoLockMinutes : 0,
    sortMode: sortMode === "recent" ? sortMode : "manual",
    density: density === "compact" ? density : "comfortable",
    highContrast: highContrast === true,
    locale: ["es", "en", "pt"].includes(locale) ? locale : "es",
    favoriteShortcutId: validShortcut ? favoriteShortcutId : null,
    seenVersion: validVersion ? seenVersion : null
  };
}

export async function readPreferences() {
  const { settings } = await chrome.storage.local.get("settings");
  return normalize(settings);
}

export async function savePreferences(patch) {
  const current = await readPreferences();
  const defined = Object.entries(patch ?? {}).filter(([, value]) => value !== undefined);
  const settings = normalize({ ...current, ...Object.fromEntries(defined) });
  await chrome.storage.local.set({ settings });
  return settings;
}
