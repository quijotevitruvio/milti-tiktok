function readProfile() {
  const profileHandle = (url) => {
    if (!url || url.origin !== location.origin) return null;
    return url.pathname.match(/^\/(@[a-z0-9._]{1,24})\/?$/i)?.[1] ?? null;
  };
  const nav = document.querySelector([
    '[data-e2e="nav-profile"] a[href]', 'a[data-e2e="nav-profile"][href]',
    '[data-e2e="profile-icon"] a[href]', 'a[data-e2e="profile-icon"][href]'
  ].join(", "));
  const handle = nav ? profileHandle(new URL(nav.href, location.href)) : null;
  if (handle) {
    const image = nav.querySelector("img") ?? document.querySelector(
      '[data-e2e="profile-icon"] img, [data-e2e="profile-avatar"] img, img[data-e2e="profile-avatar"]'
    );
    return { handle, avatar: image?.currentSrc || image?.src || null };
  }

  const ownHandle = profileHandle(new URL(location.href));
  const canEdit = document.querySelector('[data-e2e="edit-profile"], [data-e2e="edit-profile-button"]');
  if (!ownHandle || !canEdit) return null;
  const image = document.querySelector('[data-e2e="user-avatar"] img, img[data-e2e="user-avatar"]');
  return { handle: ownHandle, avatar: image?.currentSrc || image?.src || null };
}

function safeAvatar(value) {
  if (typeof value !== "string" || value.length > 4096) return null;
  try {
    const url = new URL(value);
    const imageHost = /(^|\.)tiktokcdn(?:-us|-eu)?\.com$/i;
    return url.protocol === "https:" && !url.username && !url.password && !url.port && imageHost.test(url.hostname)
      ? url.href : null;
  } catch {
    return null;
  }
}

export async function readIdentity(tabId) {
  try {
    const [frame] = await chrome.scripting.executeScript({ target: { tabId }, func: readProfile });
    const { handle, avatar } = frame?.result ?? {};
    if (typeof handle !== "string" || !/^@[a-z0-9._]{1,24}$/i.test(handle)) return null;
    return { handle, avatar: safeAvatar(avatar) };
  } catch {
    return null;
  }
}
