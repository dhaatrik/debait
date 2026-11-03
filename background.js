// DeBait for YouTube - Background Service Worker

const DEFAULT_SETTINGS = {
  enabled: true,
  quality: 'high', // 'high' = hq720_2.jpg, 'standard' = hq2.jpg
  showBadge: true,
  showNavbarToggle: true,
  showIndividualToggle: true
};

// Initialize settings and badge on installation
chrome.runtime.onInstalled.addListener(async (details) => {
  const current = await chrome.storage.sync.get(Object.keys(DEFAULT_SETTINGS));
  const newSettings = {};

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    if (current[key] === undefined) {
      newSettings[key] = value;
    }
  }

  if (Object.keys(newSettings).length > 0) {
    await chrome.storage.sync.set(newSettings);
  }

  const { enabled = true } = await chrome.storage.sync.get('enabled');
  updateActionBadge(enabled);
});

// Update badge when enabled setting changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && changes.enabled !== undefined) {
    updateActionBadge(changes.enabled.newValue);
  }
});

// Update extension icon badge
function updateActionBadge(enabled) {
  if (enabled) {
    chrome.action.setBadgeText({ text: 'ON' });
    chrome.action.setBadgeBackgroundColor({ color: '#00C853' }); // Bright honest green
  } else {
    chrome.action.setBadgeText({ text: 'OFF' });
    chrome.action.setBadgeBackgroundColor({ color: '#757575' }); // Muted gray
  }
}

// Handle keyboard shortcuts (Alt+H)
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-thumbnails') {
    const { enabled = true } = await chrome.storage.sync.get('enabled');
    const newState = !enabled;
    await chrome.storage.sync.set({ enabled: newState });
    updateActionBadge(newState);
  }
});

// Keep badge synced on startup
chrome.runtime.onStartup.addListener(async () => {
  const { enabled = true } = await chrome.storage.sync.get('enabled');
  updateActionBadge(enabled);
});
