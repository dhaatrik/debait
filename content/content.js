/**
 * DeBait for YouTube™
 * Content Script - Dual-layer thumbnail replacement & Stageshow-crafted controls
 */

// Pure helper functions (exported for automated unit testing)
function extractVideoIdFromUrl(url) {
  if (!url || typeof url !== 'string') return null;

  // Standard watch URL: watch?v=...
  const vParam = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (vParam) return vParam[1];

  // YouTube Shorts: /shorts/...
  const shortsParam = url.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (shortsParam) return shortsParam[1];

  // YouTube Embed: /embed/...
  const embedParam = url.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
  if (embedParam) return embedParam[1];

  // CDN image endpoints: /vi/<ID>/ or /vi_webp/<ID>/
  const cdnMatch = url.match(/\/(?:vi|vi_webp)\/([a-zA-Z0-9_-]{11})\//);
  if (cdnMatch) return cdnMatch[1];

  return null;
}

function getHalfwayUrl(videoId, quality = 'high') {
  if (!videoId || typeof videoId !== 'string') return null;
  return quality === 'high'
    ? `https://i.ytimg.com/vi/${videoId}/hq720_2.jpg`
    : `https://i.ytimg.com/vi/${videoId}/hq2.jpg`;
}

function getFallbackUrl(currentUrl, videoId) {
  if (!currentUrl || !videoId) return null;
  if (currentUrl.includes('hq720_2.jpg')) {
    return `https://i.ytimg.com/vi/${videoId}/hq2.jpg`;
  } else if (currentUrl.includes('hq2.jpg')) {
    return `https://i.ytimg.com/vi/${videoId}/2.jpg`;
  }
  return null;
}

// Browser content script execution
(() => {
  if (typeof window === 'undefined' || typeof chrome === 'undefined' || !chrome.storage) return;

  if (window.__debaitInitialized) return;
  window.__debaitInitialized = true;

  let settings = {
    enabled: true,
    quality: 'high',
    showBadge: true,
    showNavbarToggle: true,
    showIndividualToggle: true
  };

  let isScheduled = false;

  // Load initial settings
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

  // Sync settings dynamically
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

  function init() {
    startObserver();
    scheduleScan();

    // YouTube SPA navigation events
    window.addEventListener('yt-navigate-finish', () => {
      scheduleScan();
      injectNavbarToggle();
    });

    window.addEventListener('yt-page-data-updated', () => {
      scheduleScan();
    });

    // Intercept image load events in capture phase to catch lazy-loaded thumbnails immediately
    window.addEventListener('load', (e) => {
      if (e.target && e.target.tagName === 'IMG') {
        const img = e.target;
        if (isYouTubeThumbnail(img)) {
          processImage(img);
        }
      }
    }, true);

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        scheduleScan();
        injectNavbarToggle();
      });
    } else {
      injectNavbarToggle();
    }
  }

  function startObserver() {
    const observer = new MutationObserver((mutations) => {
      let needsScan = false;

      for (const m of mutations) {
        // Skip mutations caused by DeBait's own controls
        if (
          m.target &&
          m.target.classList &&
          (m.target.classList.contains('debait-thumbnail-badge') ||
           m.target.classList.contains('debait-flip-btn') ||
           m.target.classList.contains('debait-navbar-toggle'))
        ) {
          continue;
        }

        if (m.type === 'childList' && m.addedNodes.length > 0) {
          needsScan = true;
          break;
        }

        // CRITICAL FIX: Detect lazy-loaded image src/srcset and anchor href mutations
        if (m.type === 'attributes') {
          if (m.target && m.target.tagName === 'IMG') {
            const img = m.target;
            if (isYouTubeThumbnail(img)) {
              processImage(img);
            }
          } else if (m.target && m.target.tagName === 'A' && m.attributeName === 'href') {
            needsScan = true;
            break;
          }
        }
      }

      if (needsScan) {
        scheduleScan();
      }
    });

    const targetNode = document.body || document.documentElement;
    if (targetNode) {
      observer.observe(targetNode, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src', 'srcset', 'href']
      });
    }
  }

  function scheduleScan() {
    if (isScheduled) return;
    isScheduled = true;

    requestAnimationFrame(() => {
      scanAndProcessAll();
      injectNavbarToggle();
      isScheduled = false;
    });
  }

  function isYouTubeThumbnail(img) {
    if (!img) return false;
    const src = img.currentSrc || img.src || img.getAttribute('src') || '';
    if (src.includes('ytimg.com/vi/') || src.includes('ytimg.com/vi_webp/')) return true;

    const closestThumbnail = img.closest('ytd-thumbnail, #thumbnail, a[href*="watch?v="], a[href*="/shorts/"]');
    return !!closestThumbnail;
  }

  function resolveVideoId(container, img) {
    // 1. Check parent container anchors
    const anchor = container ? (
      container.closest('a') ||
      container.querySelector('a#thumbnail, a#video-title-link, a.yt-simple-endpoint[href*="watch?v="], a[href*="/shorts/"]') ||
      container.closest('ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer')?.querySelector('a#thumbnail, a#video-title-link')
    ) : null;

    if (anchor && anchor.href) {
      const id = extractVideoIdFromUrl(anchor.href);
      if (id) return id;
    }

    // 2. Check image attributes directly
    const src = (img && (img.currentSrc || img.src || img.getAttribute('src'))) || '';
    if (src) {
      const id = extractVideoIdFromUrl(src);
      if (id) return id;
    }

    const srcset = img && img.getAttribute('srcset');
    if (srcset) {
      const id = extractVideoIdFromUrl(srcset);
      if (id) return id;
    }

    return null;
  }

  function scanAndProcessAll() {
    // 1. Query thumbnail containers
    const containers = document.querySelectorAll(
      'ytd-thumbnail, #thumbnail, ytd-rich-grid-media ytd-thumbnail, ytd-compact-video-renderer ytd-thumbnail, .ytp-videowall-still'
    );

    containers.forEach((container) => {
      const img = container.querySelector('img#img, img.yt-core-image, img');
      if (img) {
        processThumbnail(container, img);
      }
    });

    // 2. Direct scan of all YouTube thumbnail images on page (ensures coverage even on customized feeds)
    const images = document.querySelectorAll('img[src*="ytimg.com/vi"], img[src*="ytimg.com/vi_webp"]');
    images.forEach((img) => {
      const container = img.closest('ytd-thumbnail, #thumbnail, .ytp-videowall-still') || img.parentElement;
      if (container) {
        processThumbnail(container, img);
      }
    });
  }

  function processImage(img) {
    const container = img.closest('ytd-thumbnail, #thumbnail, .ytp-videowall-still') || img.parentElement;
    if (container) {
      processThumbnail(container, img);
    }
  }

  function processThumbnail(container, img) {
    const videoId = container.dataset.debaitVideoId || resolveVideoId(container, img);
    if (!videoId) return;

    container.dataset.debaitVideoId = videoId;

    // Cache original creator image attributes safely
    if (!img.dataset.debaitOrigSrc) {
      const initialSrc = img.currentSrc || img.src || img.getAttribute('src');
      if (initialSrc && !initialSrc.includes('_2.jpg') && !initialSrc.includes('/2.jpg')) {
        img.dataset.debaitOrigSrc = initialSrc;
      }
    }

    if (img.getAttribute('srcset') && !img.dataset.debaitOrigSrcset) {
      img.dataset.debaitOrigSrcset = img.getAttribute('srcset');
    }

    const halfwayUrl = getHalfwayUrl(videoId, settings.quality);
    img.dataset.debaitHalfwaySrc = halfwayUrl;

    // Setup per-video flip button
    setupIndividualFlipButton(container, img, videoId);

    // Check manual override
    const override = container.dataset.debaitManualOverride;
    const shouldShowHalfway = override !== undefined
      ? override === 'true'
      : settings.enabled;

    if (shouldShowHalfway) {
      showHalfwayThumbnail(container, img, videoId, halfwayUrl);
    } else {
      showOriginalThumbnail(container, img);
    }
  }

  function showHalfwayThumbnail(container, img, videoId, halfwayUrl) {
    if (img.dataset.debaitState === 'halfway' && (img.src.includes('_2.jpg') || img.src.includes('/2.jpg'))) {
      updateBadge(container, true);
      return;
    }

    img.onerror = () => {
      const fallback = getFallbackUrl(img.src, videoId);
      if (fallback && img.src !== fallback) {
        img.src = fallback;
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
  }

  function showOriginalThumbnail(container, img) {
    if (img.dataset.debaitState === 'original' && !img.src.includes('_2.jpg') && !img.src.includes('/2.jpg')) {
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

  function updateBadge(container, isHalfway) {
    let badge = container.querySelector('.debait-thumbnail-badge');

    if (isHalfway && settings.showBadge) {
      if (!badge) {
        badge = document.createElement('div');
        badge.className = 'debait-thumbnail-badge';
        badge.innerHTML = `
          <span class="debait-badge-dot"></span>
          <span class="debait-badge-text">50% MIDPOINT</span>
        `;
        container.appendChild(badge);
      }
      badge.style.display = 'inline-flex';
    } else if (badge) {
      badge.style.display = 'none';
    }
  }

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
        <svg viewBox="0 0 24 24" width="14" height="14">
          <path fill="currentColor" d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
        </svg>
      `;

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const currentState = container.dataset.debaitState || 'halfway';
        const willBeHalfway = currentState !== 'halfway';

        container.dataset.debaitManualOverride = willBeHalfway ? 'true' : 'false';

        const halfwayUrl = getHalfwayUrl(videoId, settings.quality);

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
      btn.title = 'Showing 50% midpoint frame. Click to view creator thumbnail.';
    } else {
      btn.title = 'Showing creator thumbnail. Click to view 50% midpoint frame.';
    }
  }

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

    const mastheadButtons = document.querySelector(
      'ytd-masthead #end #buttons, #masthead-container #end #buttons, ytd-masthead #end, #masthead #end'
    );

    if (!mastheadButtons) return;

    const toggleWrapper = document.createElement('div');
    toggleWrapper.id = 'debait-navbar-toggle-container';

    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = `debait-navbar-toggle ${settings.enabled ? 'is-active' : 'is-disabled'}`;
    toggleBtn.title = 'DeBait: Toggle between midpoint frames and creator thumbnails (Alt+H)';

    toggleBtn.innerHTML = `
      <div class="debait-nav-pill-content">
        <span class="debait-status-light"></span>
        <span class="debait-nav-label">DeBait</span>
        <div class="debait-nav-switch">
          <div class="debait-nav-switch-thumb"></div>
        </div>
      </div>
    `;

    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const newEnabled = !settings.enabled;
      settings.enabled = newEnabled;

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

  function applySettingsToAll() {
    scanAndProcessAll();
  }
})();

// Export for automated unit test runner
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    extractVideoIdFromUrl,
    getHalfwayUrl,
    getFallbackUrl
  };
}
