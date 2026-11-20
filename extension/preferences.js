function normalize(settings) {
  const { quickSwitch, autoLockMinutes } = settings ?? {};
  const validMinutes = Number.isInteger(autoLockMinutes) && autoLockMinutes >= 0 && autoLockMinutes <= 1440;
  return { quickSwitch: quickSwitch === true, autoLockMinutes: validMinutes ? autoLockMinutes : 0 };
}

export async function readPreferences() {
  const { settings } = await chrome.storage.local.get("settings");
  return normalize(settings);
}

export async function savePreferences(patch) {
  const current = await readPreferences();
  const {
    quickSwitch = current.quickSwitch, autoLockMinutes = current.autoLockMinutes
  } = patch ?? {};
  const settings = normalize({ quickSwitch, autoLockMinutes });
  await chrome.storage.local.set({ settings });
  return settings;
}
