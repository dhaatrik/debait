const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

describe('Background Service Worker', () => {
  let mockStorage;
  let installedListeners;
  let commandListeners;
  let storageChangedListeners;
  let badgeState;

  beforeEach(() => {
    mockStorage = {};
    installedListeners = [];
    commandListeners = [];
    storageChangedListeners = [];
    badgeState = { text: '', color: '' };

    global.chrome = {
      runtime: {
        onInstalled: {
          addListener: (fn) => installedListeners.push(fn)
        },
        onStartup: {
          addListener: () => {}
        }
      },
      storage: {
        sync: {
          get: async (keys) => {
            if (Array.isArray(keys)) {
              const res = {};
              for (const k of keys) {
                if (k in mockStorage) res[k] = mockStorage[k];
              }
              return res;
            }
            if (typeof keys === 'string') {
              return { [keys]: mockStorage[keys] };
            }
            if (typeof keys === 'object' && keys !== null) {
              const res = { ...keys };
              for (const k of Object.keys(keys)) {
                if (k in mockStorage) res[k] = mockStorage[k];
              }
              return res;
            }
            return { ...mockStorage };
          },
          set: async (items) => {
            Object.assign(mockStorage, items);
          }
        },
        onChanged: {
          addListener: (fn) => storageChangedListeners.push(fn)
        }
      },
      action: {
        setBadgeText: ({ text }) => {
          badgeState.text = text;
        },
        setBadgeBackgroundColor: ({ color }) => {
          badgeState.color = color;
        }
      },
      commands: {
        onCommand: {
          addListener: (fn) => commandListeners.push(fn)
        }
      }
    };

    // Clear module cache to re-execute service worker with fresh mocks
    delete require.cache[require.resolve('../background.js')];
    require('../background.js');
  });

  test('onInstalled initializes all default settings into empty storage', async () => {
    assert.equal(installedListeners.length, 1);
    await installedListeners[0]();

    assert.equal(mockStorage.enabled, true);
    assert.equal(mockStorage.quality, 'high');
    assert.equal(mockStorage.showBadge, true);
    assert.equal(mockStorage.showNavbarToggle, true);
    assert.equal(mockStorage.showIndividualToggle, true);
    assert.equal(mockStorage.replaceShorts, false);
    assert.equal(badgeState.text, 'ON');
    assert.equal(badgeState.color, '#10B981');
  });

  test('onInstalled preserves existing user settings', async () => {
    mockStorage.quality = 'standard';
    mockStorage.showBadge = false;

    await installedListeners[0]();

    assert.equal(mockStorage.quality, 'standard');
    assert.equal(mockStorage.showBadge, false);
    assert.equal(mockStorage.enabled, true);
  });

  test('toggle-thumbnails command toggles enabled state and action badge', async () => {
    mockStorage.enabled = true;
    assert.equal(commandListeners.length, 1);

    await commandListeners[0]('toggle-thumbnails');
    assert.equal(mockStorage.enabled, false);
    assert.equal(badgeState.text, 'OFF');
    assert.equal(badgeState.color, '#64748B');

    await commandListeners[0]('toggle-thumbnails');
    assert.equal(mockStorage.enabled, true);
    assert.equal(badgeState.text, 'ON');
    assert.equal(badgeState.color, '#10B981');
  });

  test('ignores unknown commands', async () => {
    mockStorage.enabled = true;
    await commandListeners[0]('unknown-command');
    assert.equal(mockStorage.enabled, true);
  });

  test('storage onChanged updates badge when enabled changes', () => {
    assert.equal(storageChangedListeners.length, 1);

    storageChangedListeners[0]({ enabled: { newValue: false } }, 'sync');
    assert.equal(badgeState.text, 'OFF');
    assert.equal(badgeState.color, '#64748B');

    storageChangedListeners[0]({ enabled: { newValue: true } }, 'sync');
    assert.equal(badgeState.text, 'ON');
    assert.equal(badgeState.color, '#10B981');
  });

  test('storage onChanged ignores changes from non-sync areas', () => {
    badgeState.text = 'ON';
    storageChangedListeners[0]({ enabled: { newValue: false } }, 'local');
    assert.equal(badgeState.text, 'ON');
  });
});
