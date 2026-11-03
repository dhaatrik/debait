const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

describe('Manifest V3 Schema & Asset Verification', () => {
  const rootDir = path.resolve(__dirname, '..');
  const manifestPath = path.join(rootDir, 'manifest.json');

  test('manifest.json exists and is valid JSON', () => {
    assert.ok(fs.existsSync(manifestPath), 'manifest.json must exist');
    const content = fs.readFileSync(manifestPath, 'utf8');
    assert.doesNotThrow(() => JSON.parse(content), 'manifest.json must be valid JSON');
  });

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  test('declares Manifest V3 and valid identity fields', () => {
    assert.equal(manifest.manifest_version, 3);
    assert.ok(manifest.name && manifest.name.length > 0, 'name is required');
    assert.ok(manifest.version && /^\d+\.\d+\.\d+$/.test(manifest.version), 'version must follow SemVer');
    assert.ok(manifest.description && manifest.description.length > 0, 'description is required');
  });

  test('declares minimal required permissions', () => {
    assert.deepEqual(manifest.permissions, ['storage']);
    assert.deepEqual(manifest.host_permissions, ['*://*.youtube.com/*']);
  });

  test('references valid background service worker file', () => {
    assert.ok(manifest.background && manifest.background.service_worker);
    const swPath = path.join(rootDir, manifest.background.service_worker);
    assert.ok(fs.existsSync(swPath), `Service worker file ${swPath} must exist on disk`);
  });

  test('references valid content scripts on disk', () => {
    assert.ok(Array.isArray(manifest.content_scripts));
    assert.ok(manifest.content_scripts.length > 0);

    for (const cs of manifest.content_scripts) {
      assert.ok(cs.matches.includes('*://*.youtube.com/*'));
      for (const js of cs.js) {
        const fullPath = path.join(rootDir, js);
        assert.ok(fs.existsSync(fullPath), `Content script ${fullPath} must exist`);
      }
      for (const css of cs.css) {
        const fullPath = path.join(rootDir, css);
        assert.ok(fs.existsSync(fullPath), `Content style ${fullPath} must exist`);
      }
    }
  });

  test('references valid popup action assets on disk', () => {
    assert.ok(manifest.action && manifest.action.default_popup);
    const popupPath = path.join(rootDir, manifest.action.default_popup);
    assert.ok(fs.existsSync(popupPath), `Popup HTML ${popupPath} must exist`);
  });

  test('all required icon resolutions exist as valid non-empty files', () => {
    const requiredSizes = ['16', '48', '128'];
    for (const size of requiredSizes) {
      const relPath = manifest.icons[size];
      assert.ok(relPath, `manifest.icons must define ${size}`);
      const fullPath = path.join(rootDir, relPath);
      assert.ok(fs.existsSync(fullPath), `Icon file ${fullPath} must exist`);
      const stat = fs.statSync(fullPath);
      assert.ok(stat.size > 50, `Icon file ${fullPath} must not be empty`);
    }
  });
});
