// Change this to your deployed address before packaging the extension.
const APP_URL = "https://sat-studio.vercel.app/";

// The service worker can be shut down between clicks, so the window id lives in session storage.
chrome.action.onClicked.addListener(async () => {
  const { appWindowId } = await chrome.storage.session.get("appWindowId");
  if (appWindowId != null) {
    try {
      await chrome.windows.update(appWindowId, { focused: true });
      return;
    } catch {
      // that window was closed; open a new one below
    }
  }
  const win = await chrome.windows.create({ url: APP_URL, type: "popup", width: 1280, height: 860, focused: true });
  await chrome.storage.session.set({ appWindowId: win.id });
});

chrome.windows.onRemoved.addListener(async (id) => {
  const { appWindowId } = await chrome.storage.session.get("appWindowId");
  if (id === appWindowId) await chrome.storage.session.remove("appWindowId");
});
