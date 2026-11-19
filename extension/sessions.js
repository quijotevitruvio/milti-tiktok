export const hostPermission = "https://*.tiktok.com/*";
export const home = "https://www.tiktok.com/";
export const login = "https://www.tiktok.com/login";
const domain = "tiktok.com";
const partitionKey = { topLevelSite: "https://tiktok.com", hasCrossSiteAncestor: false };

export async function readCookies() {
  const [regular, partitioned] = await Promise.all([
    chrome.cookies.getAll({ domain }),
    chrome.cookies.getAll({ domain, partitionKey })
  ]);
  return [...regular.filter((cookie) => !cookie.partitionKey),
    ...partitioned.filter((cookie) => cookie.partitionKey)];
}

function isFresh(cookie) {
  return cookie.expirationDate === undefined || cookie.expirationDate > Date.now() / 1000;
}

// Use TikTok's desktop session markers as heuristics. Only TikTok can confirm the login.
export async function fingerprint(cookies) {
  const candidates = cookies.filter((cookie) =>
    !cookie.partitionKey && isFresh(cookie) && [".tiktok.com", "tiktok.com", "www.tiktok.com"].includes(cookie.domain)
  );
  const session = candidates.find((cookie) => cookie.name === "sessionid" && cookie.value) ??
    candidates.find((cookie) => cookie.name === "sessionid_ss" && cookie.value);
  if (!session) return null;
  const user = candidates.find((cookie) => cookie.name === "uid_tt" && cookie.value) ??
    candidates.find((cookie) => cookie.name === "uid_tt_ss" && cookie.value);
  const source = user ? `user:${user.value}` : `session:${session.value}`;
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function setDetails(cookie, deleteCookie = false) {
  const hostname = cookie.domain.replace(/^\./, "");
  const details = {
    url: `https://${hostname}/`,
    name: cookie.name,
    value: deleteCookie ? "" : cookie.value,
    path: cookie.path,
    secure: cookie.secure,
    httpOnly: cookie.httpOnly,
    sameSite: cookie.sameSite,
    storeId: cookie.storeId
  };
  if (!cookie.hostOnly) details.domain = cookie.domain;
  if (cookie.partitionKey) details.partitionKey = cookie.partitionKey;
  if (deleteCookie) details.expirationDate = 1;
  else if (!cookie.session) details.expirationDate = cookie.expirationDate;
  return details;
}

function pairs(cookies) {
  return cookies.filter(isFresh).map((cookie) => JSON.stringify([
    cookie.domain, cookie.name, cookie.path, cookie.hostOnly, Boolean(cookie.partitionKey), cookie.value
  ])).sort();
}

export async function replaceCookies(cookies) {
  const desired = cookies.filter(isFresh);
  for (const cookie of await readCookies()) {
    // Expire the exact domain/path tuple, including host-only and partition metadata.
    await chrome.cookies.set(setDetails(cookie, true));
  }
  for (const cookie of desired) {
    await chrome.cookies.set(setDetails(cookie));
  }
  if (JSON.stringify(pairs(await readCookies())) !== JSON.stringify(pairs(desired))) {
    throw new Error("cookie_mismatch");
  }
}
