const DASHBOARD_PATH = "dashboard/index.html";
const API_BASE = "https://ontrack.deakin.edu.au/api";

browser.action.onClicked.addListener(async () => {
  const url = browser.runtime.getURL(DASHBOARD_PATH);
  const tabs = await browser.tabs.query({ url: `${url}*` });
  if (tabs.length > 0) {
    await browser.tabs.update(tabs[0].id, { active: true });
    await browser.windows.update(tabs[0].windowId, { focused: true });
  } else {
    await browser.tabs.create({ url });
  }
});

browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "GET_AUTH") {
    browser.storage.local.get(["auth", "lastProjectId"]).then(sendResponse);
    return true;
  }
  if (message.type === "API_FETCH") {
    apiFetch(message.path)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }
  if (message.type === "SAVE_LAST_PROJECT") {
    browser.storage.local.set({ lastProjectId: message.projectId }).then(() =>
      sendResponse({ ok: true })
    );
    return true;
  }
  return false;
});

async function apiFetch(path) {
  const { auth } = await browser.storage.local.get("auth");
  if (!auth?.token || !auth?.username) {
    throw new Error(
      "Not signed in to OnTrack. Open ontrack.deakin.edu.au in a tab and load any page, then try again."
    );
  }

  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json, text/plain, */*",
      "Auth-Token": auth.token,
      Username: auth.username,
    },
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error(`OnTrack API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}
