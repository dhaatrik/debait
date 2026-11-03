/**
 * DeBait for YouTube™
 * Content Script - Injects halfway video frames and interactive toggles
 */

(() => {
  // Guard against multiple injections
  if (window.__debaitInitialized) return;
  window.__debaitInitialized = true;

  // Extension Settings (synced from storage)
  let settings = {
    enabled: true,
    quality: 'high', // 'high' (hq720_2) or 'standard' (hq2)
    showBadge: true,
    showNavbarToggle: true,
    showIndividualToggle: true
  };

  // Keep track of processed images and total session swaps
  let swappedCount = 0;
  let isProcessingScheduled = false;

  // Initialize settings from Chrome storage
  chrome.storage.sync.get(
    ['enabled', 'quality', 'showBadge', 'showNavbarToggle', 'showIndividualToggle'],
    (items) => {
      if (items.enabled !== undefined) settings.enabled = items.enabled;
      if (items.quality !== undefined) settings.quality = items.quality;
      if (items.showBadge !== undefined) settings.showBadge = items.showBadge;
      if (items.showNavbarToggle !== undefined) settings.showNavbarToggle = items.showNavbarToggle;
      if (items.showIndividualToggle !== undefined) settings.showIndividualToggle = items.showIndividualToggle;

      init();
    }
  );

  // Listen for storage updates (e.g. toggled from popup or keyboard shortcut)
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync') return;

    let needsUpdate = false;
    for (const [key, change] of Object.entries(changes)) {
      if (settings[key] !== change.newValue) {
        settings[key] = change.newValue;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      updateNavbarToggleState();
      applySettingsToAll();
    }
  });

  // Main initializer
  function init() {
    scheduleProcessThumbnails();
    injectNavbarToggle();

    // Setup MutationObserver to handle YouTube dynamic scrolling and navigation
    const observer = new MutationObserver((mutations) => {
      let shouldProcess = false;

      for (const mutation of mutations) {
        // Skip mutations caused by our own UI elements
        if (
          mutation.target &&
          mutation.target.classList &&
          (mutation.target.classList.contains('debait-thumbnail-badge') ||
           mutation.target.classList.contains('debait-flip-btn') ||
           mutation.target.classList.contains('debait-navbar-toggle'))
        ) {
          continue;
        }

        if (mutation.addedNodes.length > 0) {
          shouldProcess = true;
          break;
        }
      }

      if (shouldProcess) {
        scheduleProcessThumbnails();
        injectNavbarToggle();
      }
    });

    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });

    // YouTube SPA navigation events
    window.addEventListener('yt-navigate-finish', () => {
      scheduleProcessThumbnails();
      injectNavbarToggle();
    });

    window.addEventListener('yt-page-data-updated', () => {
      scheduleProcessThumbnails();
    });
  }

  // Schedule a batched thumbnail update via requestAnimationFrame
  function scheduleProcessThumbnails() {
    if (isProcessingScheduled) return;
    isProcessingScheduled = true;

    requestAnimationFrame(() => {
      processThumbnails();
      isProcessingScheduled = false;
    });
  }

  /**
   * Extracts YouTube Video ID from element or its surroundings
   */
  function extractVideoId(container, img) {
    // 1. Check parent anchors for watch?v= or /shorts/
    const anchor = container.closest('a') ||
      container.querySelector('a#thumbnail, a#video-title-link, a.yt-simple-endpoint[href*="watch?v="], a[href*="/shorts/"]') ||
      container.closest('ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer')?.querySelector('a#thumbnail, a#video-title-link');

    if (anchor && anchor.href) {
      const vParam = anchor.href.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
      if (vParam) return vParam[1];

      const shortsParam = anchor.href.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
      if (shortsParam) return shortsParam[1];
    }

    // 2. Check image src or currentSrc directly
    const srcToCheck = (img && (img.currentSrc || img.src || img.getAttribute('src'))) || '';
    if (srcToCheck) {
      const match = srcToCheck.match(/\/(?:vi|vi_webp)\/([a-zA-Z0-9_-]{11})\//);
      if (match) return match[1];
    }

    // 3. Check srcset if present
    const srcSet = img && img.getAttribute('srcset');
    if (srcSet) {
      const match = srcSet.match(/\/(?:vi|vi_webp)\/([a-zA-Z0-9_-]{11})\//);
      if (match) return match[1];
    }

    return null;
  }

  /**
   * Processes all thumbnail containers on the current page
   */
  function processThumbnails() {
    // Target common YouTube thumbnail containers
    const containers = document.querySelectorAll(
      'ytd-thumbnail, #thumbnail.ytd-thumbnail, .ytp-videowall-still, ytd-playlist-video-renderer #thumbnail'
    );

    containers.forEach((container) => {
      // Find the actual image element
      const img = container.querySelector('img#img, img.yt-core-image, img');
      if (!img) return;

      const videoId = extractVideoId(container, img);
      if (!videoId) return;

      container.dataset.debaitVideoId = videoId;

      // Ensure original source is preserved once
      if (!img.dataset.debaitOrigSrc) {
        const initialSrc = img.currentSrc || img.src || img.getAttribute('src');
        if (initialSrc && !initialSrc.includes('_2.jpg') && !initialSrc.includes('/2.jpg')) {
          img.dataset.debaitOrigSrc = initialSrc;
        }
      }

      if (img.getAttribute('srcset') && !img.dataset.debaitOrigSrcset) {
        img.dataset.debaitOrigSrcset = img.getAttribute('srcset');
      }

      // Generate halfway URL
      const halfwayUrl = settings.quality === 'high'
        ? `https://i.ytimg.com/vi/${videoId}/hq720_2.jpg`
        : `https://i.ytimg.com/vi/${videoId}/hq2.jpg`;

      img.dataset.debaitHalfwaySrc = halfwayUrl;

      // Handle individual flip button
      setupIndividualFlipButton(container, img, videoId);

      // Apply current view (halfway vs original)
      // Check if container has a manual per-video override
      const override = container.dataset.debaitManualOverride;
      const shouldShowHalfway = override !== undefined
        ? override === 'true'
        : settings.enabled;

      if (shouldShowHalfway) {
        showHalfwayThumbnail(container, img, videoId, halfwayUrl);
      } else {
        showOriginalThumbnail(container, img);
      }
    });
  }

  /**
   * Display the halfway video frame on an image
   */
  function showHalfwayThumbnail(container, img, videoId, halfwayUrl) {
    if (img.dataset.debaitState === 'halfway' && img.src.includes('_2.jpg')) {
      // Already showing halfway frame
      updateBadge(container, true);
      return;
    }

    // Set error fallback: hq720_2 -> hq2 -> 2.jpg
    img.onerror = () => {
      if (img.src.includes('hq720_2.jpg')) {
        img.src = `https://i.ytimg.com/vi/${videoId}/hq2.jpg`;
      } else if (img.src.includes('hq2.jpg')) {
        img.src = `https://i.ytimg.com/vi/${videoId}/2.jpg`;
      }
    };

    if (img.getAttribute('srcset')) {
      img.removeAttribute('srcset');
    }

    img.src = halfwayUrl;
    img.dataset.debaitState = 'halfway';
    container.dataset.debaitState = 'halfway';

    updateBadge(container, true);
    updateFlipButtonTooltip(container, 'halfway');
    swappedCount++;
  }

  /**
   * Revert thumbnail back to creator's original uploaded image
   */
  function showOriginalThumbnail(container, img) {
    if (img.dataset.debaitState === 'original' && !img.src.includes('_2.jpg')) {
      updateBadge(container, false);
      return;
    }

    if (img.dataset.debaitOrigSrc) {
      img.src = img.dataset.debaitOrigSrc;
      if (img.dataset.debaitOrigSrcset) {
        img.setAttribute('srcset', img.dataset.debaitOrigSrcset);
      }
    }

    img.dataset.debaitState = 'original';
    container.dataset.debaitState = 'original';

    updateBadge(container, false);
    updateFlipButtonTooltip(container, 'original');
  }

  /**
   * Updates or removes the "50%" badge on a thumbnail container
   */
  function updateBadge(container, isHalfway) {
    let badge = container.querySelector('.debait-thumbnail-badge');

    if (isHalfway && settings.showBadge) {
      if (!badge) {
        badge = document.createElement('div');
        badge.className = 'debait-thumbnail-badge';
        badge.innerHTML = `
          <svg viewBox="0 0 24 24"><path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4zm-6.75 11.25L10 17l-1.25-1.75L7 14l1.75-1.25L10 11l1.25 1.75L13 14l-1.75 1.25z"/></svg>
          <span>50%</span>
        `;
        container.appendChild(badge);
      }
      badge.style.display = 'inline-flex';
    } else if (badge) {
      badge.style.display = 'none';
    }
  }

  /**
   * Creates or updates the per-thumbnail flip toggle button
   */
  function setupIndividualFlipButton(container, img, videoId) {
    if (!settings.showIndividualToggle) {
      const existingBtn = container.querySelector('.debait-flip-btn');
      if (existingBtn) existingBtn.style.display = 'none';
      return;
    }

    let btn = container.querySelector('.debait-flip-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.className = 'debait-flip-btn';
      btn.type = 'button';
      btn.innerHTML = `
        <svg viewBox="0 0 24 24">
          <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
        </svg>
      `;

      // Crucial: stop propagation so clicking doesn't navigate to the video
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const currentState = container.dataset.debaitState || 'halfway';
        const willBeHalfway = currentState !== 'halfway';

        container.dataset.debaitManualOverride = willBeHalfway ? 'true' : 'false';

        const halfwayUrl = settings.quality === 'high'
          ? `https://i.ytimg.com/vi/${videoId}/hq720_2.jpg`
          : `https://i.ytimg.com/vi/${videoId}/hq2.jpg`;

        if (willBeHalfway) {
          showHalfwayThumbnail(container, img, videoId, halfwayUrl);
        } else {
          showOriginalThumbnail(container, img);
        }
      });

      container.appendChild(btn);
    }

    btn.style.display = 'flex';
    updateFlipButtonTooltip(container, container.dataset.debaitState || 'halfway');
  }

  function updateFlipButtonTooltip(container, currentState) {
    const btn = container.querySelector('.debait-flip-btn');
    if (!btn) return;

    if (currentState === 'halfway') {
      btn.title = 'DeBait: Showing halfway frame. Click to view creator thumbnail.';
    } else {
      btn.title = 'DeBait: Showing creator thumbnail. Click to view halfway frame.';
    }
  }

  /**
   * Inject or update the global toggle switch in YouTube's masthead
   */
  function injectNavbarToggle() {
    if (!settings.showNavbarToggle) {
      const existing = document.getElementById('debait-navbar-toggle-container');
      if (existing) existing.remove();
      return;
    }

    if (document.getElementById('debait-navbar-toggle-container')) {
      updateNavbarToggleState();
      return;
    }

    // Try finding YouTube's top bar buttons container
    const mastheadButtons = document.querySelector(
      'ytd-masthead #end #buttons, #masthead-container #end #buttons, ytd-masthead #end'
    );

    if (!mastheadButtons) return;

    const toggleWrapper = document.createElement('div');
    toggleWrapper.id = 'debait-navbar-toggle-container';

    const toggleBtn = document.createElement('div');
    toggleBtn.className = `debait-navbar-toggle ${settings.enabled ? 'is-active' : 'is-disabled'}`;
    toggleBtn.title = 'DeBait: Toggle between halfway video frames and creator thumbnails (Alt+H)';

    toggleBtn.innerHTML = `
      <div class="debait-toggle-icon">
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path fill="currentColor" d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 9l-4 2.5V8l4 3z"/>
        </svg>
      </div>
      <span class="debait-toggle-label">DeBait</span>
      <div class="debait-toggle-pill"></div>
    `;

    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const newEnabled = !settings.enabled;
      settings.enabled = newEnabled;

      // Clear manual overrides on toggle so entire page aligns
      document.querySelectorAll('[data-debait-manual-override]').forEach((el) => {
        delete el.dataset.debaitManualOverride;
      });

      chrome.storage.sync.set({ enabled: newEnabled }, () => {
        updateNavbarToggleState();
        applySettingsToAll();
      });
    });

    toggleWrapper.appendChild(toggleBtn);
    mastheadButtons.insertBefore(toggleWrapper, mastheadButtons.firstChild);
  }

  function updateNavbarToggleState() {
    const toggleBtn = document.querySelector('.debait-navbar-toggle');
    if (!toggleBtn) return;

    if (settings.enabled) {
      toggleBtn.classList.add('is-active');
      toggleBtn.classList.remove('is-disabled');
    } else {
      toggleBtn.classList.remove('is-active');
      toggleBtn.classList.add('is-disabled');
    }
  }

  /**
   * Applies the current global settings across all thumbnails on the page
   */
  function applySettingsToAll() {
    const containers = document.querySelectorAll(
      'ytd-thumbnail, #thumbnail.ytd-thumbnail, .ytp-videowall-still, ytd-playlist-video-renderer #thumbnail'
    );

    containers.forEach((container) => {
      const img = container.querySelector('img#img, img.yt-core-image, img');
      if (!img) return;

      const videoId = container.dataset.debaitVideoId || extractVideoId(container, img);
      if (!videoId) return;

      const halfwayUrl = settings.quality === 'high'
        ? `https://i.ytimg.com/vi/${videoId}/hq720_2.jpg`
        : `https://i.ytimg.com/vi/${videoId}/hq2.jpg`;

      if (settings.enabled) {
        showHalfwayThumbnail(container, img, videoId, halfwayUrl);
      } else {
        showOriginalThumbnail(container, img);
      }

      setupIndividualFlipButton(container, img, videoId);
    });
  }
})();
