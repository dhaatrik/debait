// DeBait for YouTube - Background Service Worker

const DEFAULT_SETTINGS = {
  enabled: true,
  quality: 'high', // 'high' (maxres2 / hq720_2) with fallback to hq2
  showBadge: true,
  showNavbarToggle: true,
  showIndividualToggle: true
};

// Initialize settings and action badge on install
chrome.runtime.onInstalled.addListener(async () => {
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

// Sync badge on browser startup
chrome.runtime.onStartup.addListener(async () => {
  const { enabled = true } = await chrome.storage.sync.get('enabled');
  updateActionBadge(enabled);
});

// Sync badge whenever settings change
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && changes.enabled !== undefined) {
    updateActionBadge(changes.enabled.newValue);
  }
});

// Update extension icon badge
function updateActionBadge(enabled) {
  if (enabled) {
    chrome.action.setBadgeText({ text: 'ON' });
    chrome.action.setBadgeBackgroundColor({ color: '#10B981' }); // Emerald green
  } else {
    chrome.action.setBadgeText({ text: 'OFF' });
    chrome.action.setBadgeBackgroundColor({ color: '#64748B' }); // Muted slate
  }
}

// Handle keyboard shortcut (Alt+H)
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-thumbnails') {
    const { enabled = true } = await chrome.storage.sync.get('enabled');
    const newState = !enabled;
    await chrome.storage.sync.set({ enabled: newState });
    updateActionBadge(newState);
  }
});
