/**
 * DeBait for YouTube™
 * Content Script - Zero-lag, high-performance thumbnail replacer
 */

// Pure helper functions (exported for automated unit testing)
function extractVideoIdFromUrl(url) {
  if (!url || typeof url !== 'string') return null;

  const vParam = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (vParam) return vParam[1];

  const liveParam = url.match(/\/live\/([a-zA-Z0-9_-]{11})/);
  if (liveParam) return liveParam[1];

  const shortsParam = url.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (shortsParam) return shortsParam[1];

  const embedParam = url.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
  if (embedParam) return embedParam[1];

  const youtuBeParam = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (youtuBeParam) return youtuBeParam[1];

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
  if (typeof window === 'undefined' || typeof chrome === 'undefined') return;

  function isContextValid() {
    return typeof chrome !== 'undefined' && !!chrome?.runtime?.id;
  }

  // Prevent injection in cross-origin or ad/widget iframes
  if (window.top !== window.self) return;

  const DEFAULTS = {
    enabled: true,
    quality: 'high',
    showBadge: true,
    showNavbarToggle: true,
    showIndividualToggle: true
  };

  const THUMB_RE = /^(?:https?:)?\/\/i\d*\.ytimg\.com\/vi(?:_webp)?\/([\w-]{11})\/(\w+)\.(?:jpg|webp)/;
  const AUTO_FRAME_RE = /^(?:hq|mq|sd|maxres|oar|hq720_)?[123]$/;
  const CSS_URL_RE = /url\(\s*["']?([^"')]+)["']?\s*\)/;

  let settings = { ...DEFAULTS };
  let isScanScheduled = false;

  function parseThumbUrl(url) {
    const m = url && THUMB_RE.exec(url);
    if (!m || AUTO_FRAME_RE.test(m[2])) return null;
    return m[1];
  }

  function resolveIdFromContext(img) {
    const anchor = img.closest('a') ||
      img.closest('ytd-thumbnail, ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-reel-item-renderer')?.querySelector('a#thumbnail, a#video-title-link, a[href*="watch?v="], a[href*="/shorts/"]');
    if (anchor && anchor.href) {
      return extractVideoIdFromUrl(anchor.href);
    }
    return null;
  }

  // ---- High-Performance, Instant Image Swapper (0ms Latency) ----------------

  function processImg(img) {
    if (!isContextValid()) return;

    // Shield against infinite mutation cycles: ignore if already managed and active
    if (img.dataset.debaitActive === 'true' && settings.enabled) return;

    const src = img.src || img.getAttribute('src') || '';
    const id = parseThumbUrl(src) || resolveIdFromContext(img);
    if (!id) return;

    // Cache genuine creator thumbnail for instant rollback
    if (src && !src.startsWith('data:') && !src.includes('hq720_2') && !src.includes('hq2.jpg') && !src.includes('/2.jpg')) {
      if (!img.dataset.debaitOrig) {
        img.dataset.debaitOrig = src;
      }
    }

    const container = img.closest('ytd-thumbnail, #thumbnail, .ytp-videowall-still') || img.parentElement;
    if (container) {
      container.dataset.debaitVideoId = id;
      setupIndividualFlipButton(container, img, id);
    }

    // Check individual override
    const override = container?.dataset?.debaitManualOverride;
    const shouldShow = override !== undefined ? override === 'true' : settings.enabled;

    if (!shouldShow) {
      restoreImg(img, container);
      return;
    }

    // Lock element BEFORE mutating attributes to shield against MutationObserver feedback loops
    img.dataset.debaitActive = 'true';

    // Instant zero-lag swap: assign immediately without network probe delay
    const halfwayUrl = getHalfwayUrl(id, settings.quality);
    img.dataset.debait = halfwayUrl;

    if (img.hasAttribute('srcset') && !img.dataset.debaitSrcset) {
      img.dataset.debaitSrcset = img.getAttribute('srcset');
      img.removeAttribute('srcset');
    }

    // Background fallback: if 720p is unavailable (e.g. vintage 240p video), fall back to hq2
    img.onerror = () => {
      const fallback = getFallbackUrl(img.src, id);
      if (fallback && img.src !== fallback) {
        img.src = fallback;
        img.dataset.debait = fallback;
        img.style.opacity = '1';
        img.style.visibility = 'visible';
      } else {
        img.onerror = null;
        if (img.dataset.debaitOrig) {
          img.src = img.dataset.debaitOrig;
        } else {
          img.src = `https://i.ytimg.com/vi/${id}/hq720.jpg`;
        }
        img.dataset.debaitState = 'original';
        if (container) {
          container.dataset.debaitState = 'original';
          updateBadge(container, false);
          updateFlipButtonTooltip(container, 'original');
        }
      }
    };

    img.src = halfwayUrl;
    img.style.objectFit = 'cover';

    // Overcome YouTube Polymer/Lit hidden image state
    img.classList.add('yt-core-image--loaded');
    img.style.opacity = '1';
    img.style.visibility = 'visible';
    img.style.display = 'block';

    const wrapper = img.closest('yt-image, yt-img-shadow');
    if (wrapper) {
      wrapper.setAttribute('loaded', '');
      wrapper.classList.remove('empty');
      wrapper.style.opacity = '1';
      wrapper.style.visibility = 'visible';
    }

    if (container) {
      container.dataset.debaitState = 'halfway';
      updateBadge(container, true);
      updateFlipButtonTooltip(container, 'halfway');
    }
  }

  function restoreImg(img, container) {
    img.dataset.debaitActive = 'false';

    if (img.dataset.debaitOrig) {
      img.src = img.dataset.debaitOrig;
      delete img.dataset.debait;
    } else {
      const id = container?.dataset?.debaitVideoId;
      if (id) {
        img.src = `https://i.ytimg.com/vi/${id}/hq720.jpg`;
        delete img.dataset.debait;
      }
    }
    if (img.dataset.debaitSrcset) {
      img.setAttribute('srcset', img.dataset.debaitSrcset);
      delete img.dataset.debaitSrcset;
    }
    if (container) {
      container.dataset.debaitState = 'original';
      updateBadge(container, false);
      updateFlipButtonTooltip(container, 'original');
    }
  }

  // ---- Background Image Processing (e.g. Endscreens) -------------------------

  function processBg(el) {
    const style = el.getAttribute('style');
    if (!style || !style.includes('ytimg.com')) return;
    const bg = el.style.backgroundImage;
    const m = bg && CSS_URL_RE.exec(bg);
    if (!m) return;
    const current = m[1];
    if (el.dataset.debaitBg && current === el.dataset.debaitBg) return;

    const id = parseThumbUrl(current);
    if (!id) return;

    el.dataset.debaitBgOrig = bg;
    if (!settings.enabled) return;

    const halfwayUrl = getHalfwayUrl(id, settings.quality);
    el.dataset.debaitBg = halfwayUrl;
    el.style.backgroundImage = `url("${halfwayUrl}")`;
  }

  // ---- Fast Targeted Scanning & Debounced Observation -----------------------

  function scanImmediate() {
    // 1. Fast query for thumbnail images directly
    const imgs = document.querySelectorAll('ytd-thumbnail img, #thumbnail img, img[src*="ytimg.com/vi"]');
    for (let i = 0; i < imgs.length; i++) {
      processImg(imgs[i]);
    }

    // 2. Background image elements
    const bgs = document.querySelectorAll('.ytp-videowall-still-image, [style*="ytimg.com/vi"]');
    for (let i = 0; i < bgs.length; i++) {
      processBg(bgs[i]);
    }
  }

  function scheduleScan() {
    if (isScanScheduled) return;
    isScanScheduled = true;

    requestAnimationFrame(() => {
      if (settings.enabled) {
        scanImmediate();
      }
      injectNavbarToggle();
      isScanScheduled = false;
    });
  }

  const observer = new MutationObserver((mutations) => {
    if (!isContextValid()) {
      observer.disconnect();
      return;
    }

    let shouldScan = false;

    for (let i = 0; i < mutations.length; i++) {
      const m = mutations[i];

      // Skip DeBait's own controls and active images to prevent recursion
      if (m.target) {
        if (m.target.dataset && m.target.dataset.debaitActive === 'true') {
          continue;
        }
        if (
          m.target.classList &&
          (m.target.classList.contains('debait-thumbnail-badge') ||
           m.target.classList.contains('debait-flip-btn') ||
           m.target.classList.contains('debait-navbar-toggle'))
        ) {
          continue;
        }
      }

      if (m.type === 'attributes') {
        if (m.attributeName === 'src' && m.target.tagName === 'IMG') {
          processImg(m.target);
        } else if (m.attributeName === 'style') {
          processBg(m.target);
        }
      } else if (m.addedNodes.length > 0) {
        shouldScan = true;
      }
    }

    if (shouldScan) {
      scheduleScan();
    }
  });

  // ---- Instant Synchronous Revert (Toggle OFF) -----------------------------

  function revertAll() {
    const modifiedImgs = document.querySelectorAll('img[data-debait-orig]');
    for (let i = 0; i < modifiedImgs.length; i++) {
      const img = modifiedImgs[i];
      const container = img.closest('ytd-thumbnail, #thumbnail, .ytp-videowall-still') || img.parentElement;
      restoreImg(img, container);
    }

    const modifiedBgs = document.querySelectorAll('[data-debait-bg-orig]');
    for (let i = 0; i < modifiedBgs.length; i++) {
      const el = modifiedBgs[i];
      if (el.dataset.debaitBgOrig) {
        el.style.backgroundImage = el.dataset.debaitBgOrig;
        delete el.dataset.debaitBg;
        delete el.dataset.debaitBgOrig;
      }
    }
  }

  // ---- Stageshow UI: 50% Midpoint Badge ------------------------------------

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

  // ---- Stageshow UI: Hover Flip Button -------------------------------------

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

        if (willBeHalfway) {
          processImg(img);
        } else {
          restoreImg(img, container);
        }
      });

      container.appendChild(btn);
    }

    btn.style.display = 'flex';
  }

  function updateFlipButtonTooltip(container, state) {
    const btn = container.querySelector('.debait-flip-btn');
    if (!btn) return;
    btn.title = state === 'halfway'
      ? 'DeBait: Showing 50% midpoint frame. Click to view creator thumbnail.'
      : 'DeBait: Showing creator thumbnail. Click to view 50% midpoint frame.';
  }

  // ---- Stageshow UI: Masthead Pill -----------------------------------------

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

      // Synchronous instant visual feedback on click (0ms delay)
      updateNavbarToggleState();
      if (newEnabled) {
        scanImmediate();
      } else {
        revertAll();
      }

      // Persist in background asynchronously with context protection
      if (isContextValid()) {
        try {
          chrome.storage.sync.set({ enabled: newEnabled });
        } catch (_) {
          // Extension context reloaded
        }
      }
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

  // ---- Bootstrap & Navigation Listeners -------------------------------------

  function start() {
    if (!isContextValid()) return;

    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['src', 'style'],
    });

    if (settings.enabled) {
      scanImmediate();
    }
    injectNavbarToggle();

    // YouTube SPA navigation events
    window.addEventListener('yt-navigate-finish', () => {
      if (!isContextValid()) return;
      if (settings.enabled) scheduleScan();
      injectNavbarToggle();
    });

    window.addEventListener('yt-page-data-updated', () => {
      if (!isContextValid()) return;
      if (settings.enabled) scheduleScan();
    });

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        if (!isContextValid()) return;
        if (settings.enabled) scanImmediate();
        injectNavbarToggle();
      });
    }
  }

  // React instantly to external changes (Popup toggle or keyboard shortcut Alt+H)
  if (typeof chrome !== 'undefined' && chrome?.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (!isContextValid() || area !== 'sync') {
        if (!isContextValid()) observer.disconnect();
        return;
      }

      let hasRelevantChange = false;
      let enabledChanged = false;

      for (const [key, { newValue }] of Object.entries(changes)) {
        if (key in settings) {
          if (settings[key] !== newValue) {
            hasRelevantChange = true;
            if (key === 'enabled') {
              enabledChanged = true;
            }
          }
          settings[key] = newValue;
        }
      }

      if (!hasRelevantChange) return;

      updateNavbarToggleState();

      // Instant zero-lag synchronous flip
      if (enabledChanged) {
        if (!settings.enabled) {
          revertAll();
        } else {
          scanImmediate();
        }
      }
    });
  }

  if (!isContextValid() || !chrome?.storage?.sync) return;

  try {
    chrome.storage.sync.get(DEFAULTS, (stored) => {
      if (!isContextValid() || (chrome.runtime && chrome.runtime.lastError)) return;
      settings = { ...DEFAULTS, ...stored };
      start();
    });
  } catch (_) {
    // Context invalidated during startup
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
