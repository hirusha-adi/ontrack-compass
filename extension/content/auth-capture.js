(function injectPageBridge() {
  const script = document.createElement("script");
  script.src = browser.runtime.getURL("content/page-bridge.js");
  script.onload = () => script.remove();
  (document.documentElement || document.head || document.body).appendChild(script);
})();

function saveAuth(token, username) {
  if (!token || !username) return;
  browser.storage.local.set({
    auth: { token, username, capturedAt: Date.now() },
  });
}

function saveProjectFromUrl() {
  const match = location.pathname.match(/\/projects\/(\d+)/);
  if (match) {
    browser.storage.local.set({ lastProjectId: parseInt(match[1], 10) });
  }
}

window.addEventListener("message", (event) => {
  if (event.source !== window || event.data?.source !== "ontrack-compass-bridge") {
    return;
  }
  if (event.data.type === "AUTH_HEADERS") {
    saveAuth(event.data.token, event.data.username);
  }
});

saveProjectFromUrl();

let lastUrl = location.href;
const observer = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    saveProjectFromUrl();
  }
});
observer.observe(document.documentElement, { childList: true, subtree: true });
