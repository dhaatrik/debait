// DeBait for YouTube - Popup Controller

document.addEventListener('DOMContentLoaded', async () => {
  const masterToggle = document.getElementById('master-toggle');
  const statusBadge = document.getElementById('status-badge');
  const statusLabel = document.getElementById('status-label');
  const heroCard = document.getElementById('hero-card') || document.querySelector('.hero-surface');

  const settingNavbar = document.getElementById('setting-navbar');
  const settingFlipBtn = document.getElementById('setting-flip-btn');
  const settingBadge = document.getElementById('setting-badge');
  const settingQuality = document.getElementById('setting-quality');

  // Load existing settings
  const settings = await chrome.storage.sync.get({
    enabled: true,
    quality: 'high',
    showBadge: true,
    showNavbarToggle: true,
    showIndividualToggle: true
  });

  // Apply to UI
  updateMasterToggleUI(settings.enabled);
  settingNavbar.checked = settings.showNavbarToggle;
  settingFlipBtn.checked = settings.showIndividualToggle;
  settingBadge.checked = settings.showBadge;
  settingQuality.checked = settings.quality === 'high';

  // Master Toggle Change Handler
  masterToggle.addEventListener('change', async (e) => {
    const isEnabled = e.target.checked;
    await chrome.storage.sync.set({ enabled: isEnabled });
    updateMasterToggleUI(isEnabled);
  });

  // Top Bar Navbar Toggle
  settingNavbar.addEventListener('change', async (e) => {
    await chrome.storage.sync.set({ showNavbarToggle: e.target.checked });
  });

  // Hover Flip Button Toggle
  settingFlipBtn.addEventListener('change', async (e) => {
    await chrome.storage.sync.set({ showIndividualToggle: e.target.checked });
  });

  // Badge Toggle
  settingBadge.addEventListener('change', async (e) => {
    await chrome.storage.sync.set({ showBadge: e.target.checked });
  });

  // HD Quality Toggle
  settingQuality.addEventListener('change', async (e) => {
    const quality = e.target.checked ? 'high' : 'standard';
    await chrome.storage.sync.set({ quality });
  });

  // Helper to sync visual state
  function updateMasterToggleUI(enabled) {
    masterToggle.checked = enabled;

    if (enabled) {
      statusBadge.classList.add('active');
      statusLabel.textContent = 'Active';
      heroCard.classList.add('active');
    } else {
      statusBadge.classList.remove('active');
      statusLabel.textContent = 'Paused';
      heroCard.classList.remove('active');
    }
  }

  // React to changes from background or other tabs
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync' && changes.enabled !== undefined) {
      updateMasterToggleUI(changes.enabled.newValue);
    }
  });
});
