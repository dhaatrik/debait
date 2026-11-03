// DeBait for YouTube - Background Service Worker
// Network-level keyframe redirection engine (declarativeNetRequest)

const RULE_IDS = [1, 2, 3];

const DEFAULT_SETTINGS = {
  enabled: true,
  quality: 'high', // 'high' = hq720_2.jpg, 'standard' = hq2.jpg
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
    // Always clear existing rules first
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: RULE_IDS
    });

    if (!enabled) return;

    const targetFile = quality === 'high' ? 'hq720_2' : 'hq2';

    // Three lightweight, linear rules (<200 bytes compiled memory each, well below 2KB limit)
    const newRules = [
      // 1. HD thumbnails (hq720.jpg)
      {
        id: 1,
        priority: 1,
        action: {
          type: 'redirect',
          redirect: {
            regexSubstitution: `https://i.ytimg.com/vi/\\1/${targetFile}.jpg`
          }
        },
        condition: {
          regexFilter: '^https://i[0-9]?\\.ytimg\\.com/vi/([^/]+)/hq720(?:\\.jpg|_custom).*',
          resourceTypes: ['image']
        }
      },
      // 2. Default & medium quality thumbnails (hqdefault, mqdefault, sddefault, default)
      {
        id: 2,
        priority: 1,
        action: {
          type: 'redirect',
          redirect: {
            regexSubstitution: `https://i.ytimg.com/vi/\\1/${targetFile}.jpg`
          }
        },
        condition: {
          regexFilter: '^https://i[0-9]?\\.ytimg\\.com/vi/([^/]+)/(?:hq|mq|sd)?default(?:\\.jpg|_custom).*',
          resourceTypes: ['image']
        }
      },
      // 3. WebP variations
      {
        id: 3,
        priority: 1,
        action: {
          type: 'redirect',
          redirect: {
            regexSubstitution: `https://i.ytimg.com/vi/\\1/${targetFile}.jpg`
          }
        },
        condition: {
          regexFilter: '^https://i[0-9]?\\.ytimg\\.com/vi_webp/([^/]+)/[a-z0-9_]+(?:\\.webp|_custom).*',
          resourceTypes: ['image']
        }
      }
    ];

    // Verify regex memory safety before applying
    if (chrome.declarativeNetRequest.isRegexSupported) {
      for (const rule of newRules) {
        const check = await chrome.declarativeNetRequest.isRegexSupported({
          regex: rule.condition.regexFilter
        });
        if (!check.isSupported) {
          console.warn('DeBait: regex not supported, skipping rule:', rule.id, check.reason);
          return;
        }
      }
    }

    await chrome.declarativeNetRequest.updateDynamicRules({
      addRules: newRules
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
