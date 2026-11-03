// DeBait for YouTube - Background Service Worker
// Network-level keyframe redirection engine (declarativeNetRequest)

const RULE_ID_MIDPOINT = 1;

const DEFAULT_SETTINGS = {
  enabled: true,
  quality: 'high', // 'high' = hq720_2.jpg (1280x720 HD), 'standard' = hq2.jpg (480x360)
  showBadge: true,
  showNavbarToggle: true,
  showIndividualToggle: true
};

// Initialize settings and dynamic redirection rules on install
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

  const { enabled = true, quality = 'high' } = await chrome.storage.sync.get(['enabled', 'quality']);
  await updateRedirectRules(enabled, quality);
  updateActionBadge(enabled);
});

// Sync rules whenever browser starts up
chrome.runtime.onStartup.addListener(async () => {
  const { enabled = true, quality = 'high' } = await chrome.storage.sync.get(['enabled', 'quality']);
  await updateRedirectRules(enabled, quality);
  updateActionBadge(enabled);
});

// React to setting changes
chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName !== 'sync') return;

  if (changes.enabled !== undefined || changes.quality !== undefined) {
    const { enabled = true, quality = 'high' } = await chrome.storage.sync.get(['enabled', 'quality']);
    await updateRedirectRules(enabled, quality);
    updateActionBadge(enabled);
  }
});

// Configure declarativeNetRequest dynamic redirect rules
async function updateRedirectRules(enabled, quality) {
  try {
    if (!enabled) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [RULE_ID_MIDPOINT]
      });
      return;
    }

    const targetFile = quality === 'high' ? 'hq720_2' : 'hq2';

    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [RULE_ID_MIDPOINT],
      addRules: [
        {
          id: RULE_ID_MIDPOINT,
          priority: 1,
          action: {
            type: 'redirect',
            redirect: {
              // Redirect to midpoint frame while preserving query params
              regexSubstitution: `https://i.ytimg.com/vi/\\1/${targetFile}.jpg\\2`
            }
          },
          condition: {
            regexFilter: '^https://i[0-9]?\\.ytimg\\.com/(?:vi|vi_webp)/([a-zA-Z0-9_-]{11})/(?:default|hqdefault|mqdefault|sddefault|hq720)(?:_custom_[0-9]+)?\\.(?:jpg|webp)(.*)',
            resourceTypes: ['image']
          }
        }
      ]
    });
  } catch (err) {
    console.error('DeBait: Failed to update declarativeNetRequest rules:', err);
  }
}

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
