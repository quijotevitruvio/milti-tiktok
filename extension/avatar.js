function readProfilePhoto() {
  const nav = document.querySelector('[data-e2e="nav-profile"] a[href^="/@"], a[data-e2e="nav-profile"][href^="/@"]');
  const menu = document.querySelector(
    '[data-e2e="profile-icon"] img, [data-e2e="profile-avatar"] img, img[data-e2e="profile-avatar"]'
  );
  const navImage = nav?.querySelector("img") ?? menu;
  if (navImage) return navImage.currentSrc || navImage.src;

  // The edit control is present when the signed-in user is viewing their own profile.
  const isOwnProfile = /^\/@[^/]+\/?$/.test(location.pathname) &&
    document.querySelector('[data-e2e="edit-profile"], [data-e2e="edit-profile-button"]');
  if (!isOwnProfile) return null;
  const header = document.querySelector('[data-e2e="user-avatar"] img, img[data-e2e="user-avatar"]');
  return header?.currentSrc || header?.src || null;
}

export async function profilePhoto(tabId) {
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: readProfilePhoto
    });
    if (typeof result !== "string" || result.length > 4096) return null;
    const url = new URL(result);
    const imageHost = /(^|\.)tiktokcdn(?:-us|-eu)?\.com$/i;
    return url.protocol === "https:" && !url.username && !url.password && !url.port && imageHost.test(url.hostname)
      ? url.href : null;
  } catch {
    return null;
  }
}
