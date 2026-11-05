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

function isDeBaitNode(node) {
  if (!node || node.nodeType !== 1) return false;
  return Boolean(
    node.classList?.contains('debait-thumbnail-badge') ||
    node.classList?.contains('debait-flip-btn') ||
    node.classList?.contains('debait-navbar-toggle') ||
    node.id === 'debait-navbar-toggle-container'
  );
}

function isShortsElement(el) {
  if (!el || el.nodeType !== 1) return false;
  return Boolean(
    el.closest?.('ytd-reel-item-renderer, ytd-rich-shelf-renderer[is-shorts], #shorts-container') ||
    el.matches?.('ytd-reel-item-renderer, ytd-rich-shelf-renderer[is-shorts], #shorts-container')
  );
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
    showIndividualToggle: true,
    replaceShorts: false
  };

  const THUMB_RE = /^(?:https?:)?\/\/i\d*\.ytimg\.com\/vi(?:_webp)?\/([\w-]{11})\/(\w+)\.(?:jpg|webp)/;
  const AUTO_FRAME_RE = /^(?:hq|mq|sd|maxres|oar|hq720_)?[123]$/;
  const CSS_URL_RE = /url\(\s*["']?([^"')]+)["']?\s*\)/;

  let settings = { ...DEFAULTS };
  let isScanScheduled = false;
  let isReverting = false;

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
    if (!isContextValid() || isReverting) return;

    const container = img.closest('ytd-thumbnail, #thumbnail, .ytp-videowall-still') || img.parentElement;
    const override = container?.dataset?.debaitManualOverride;
    const shouldShow = override !== undefined ? override === 'true' : settings.enabled;

    if (!shouldShow) {
      if (img.dataset.debaitActive === 'true' || img.dataset.debaitOrig) {
        restoreImg(img, container);
      }
      return;
    }

    // Shield against infinite mutation cycles: ignore if already managed and active
    if (img.dataset.debaitActive === 'true') return;

    const src = img.src || img.getAttribute('src') || '';
    const id = parseThumbUrl(src) || resolveIdFromContext(img);
    if (!id) return;

    // Cache genuine creator thumbnail for instant rollback
    if (src && !src.startsWith('data:') && !src.includes('hq720_2') && !src.includes('hq2.jpg') && !src.includes('/2.jpg')) {
      if (!img.dataset.debaitOrig) {
        img.dataset.debaitOrig = src;
      }
    }

    if (container) {
      if (container.dataset.debaitVideoId && container.dataset.debaitVideoId !== id) {
        delete container.dataset.debaitManualOverride;
      }
      container.dataset.debaitVideoId = id;
      setupIndividualFlipButton(container, img, id);
    }

    // Bypass replacement for vertical Shorts when setting is disabled
    if (!settings.replaceShorts && (isShortsElement(container) || isShortsElement(img))) {
      if (img.dataset.debaitActive === 'true') {
        restoreImg(img, container);
      }
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

    // Background fallback: if 720p is unavailable, fall back to lower resolutions
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
    if (img.dataset.debaitActive === 'false' && !img.dataset.debaitOrig && !img.dataset.debait) {
      return;
    }

    img.dataset.debaitActive = 'false';

    if (img.dataset.debaitOrig) {
      const orig = img.dataset.debaitOrig;
      delete img.dataset.debaitOrig;
      delete img.dataset.debait;
      img.src = orig;
    } else if (img.dataset.debait) {
      delete img.dataset.debait;
      const id = container?.dataset?.debaitVideoId;
      if (id) {
        img.src = `https://i.ytimg.com/vi/${id}/hq720.jpg`;
      }
    }

    if (img.dataset.debaitSrcset) {
      const origSrcset = img.dataset.debaitSrcset;
      delete img.dataset.debaitSrcset;
      img.setAttribute('srcset', origSrcset);
    }

    if (container) {
      container.dataset.debaitState = 'original';
      updateBadge(container, false);
      updateFlipButtonTooltip(container, 'original');
    }
  }

  // ---- Background Image Processing (e.g. Endscreens) -------------------------

  function processBg(el) {
    if (!isContextValid() || isReverting || !settings.enabled) return;
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

    const halfwayUrl = getHalfwayUrl(id, settings.quality);
    el.dataset.debaitBg = halfwayUrl;
    el.style.backgroundImage = `url("${halfwayUrl}")`;
  }

  // ---- Fast Targeted Scanning & Debounced Observation -----------------------

  function scanImmediate(root = document) {
    if (!isContextValid() || isReverting || !settings.enabled) return;
    if (!root || !root.querySelectorAll) return;

    if (root.tagName === 'IMG' && (root.closest?.('ytd-thumbnail, #thumbnail') || (root.src && root.src.includes('ytimg.com/vi')))) {
      processImg(root);
    }

    const imgs = root.querySelectorAll('ytd-thumbnail img, #thumbnail img, img[src*="ytimg.com/vi"]');
    for (let i = 0; i < imgs.length; i++) {
      processImg(imgs[i]);
    }

    const bgs = root.querySelectorAll('.ytp-videowall-still-image, [style*="ytimg.com/vi"]');
    for (let i = 0; i < bgs.length; i++) {
      processBg(bgs[i]);
    }
  }

  function scheduleScan() {
    if (isScanScheduled || isReverting || !settings.enabled) return;
    isScanScheduled = true;

    requestAnimationFrame(() => {
      isScanScheduled = false;
      if (settings.enabled && !isReverting) {
        scanImmediate(document);
      }
      injectNavbarToggle();
    });
  }

  const ObserverClass = typeof MutationObserver !== 'undefined' ? MutationObserver : (typeof window !== 'undefined' && window.MutationObserver ? window.MutationObserver : null);
  const observer = ObserverClass ? new ObserverClass((mutations) => {
    if (!isContextValid() || isReverting || !settings.enabled) {
      if (!isContextValid()) observer.disconnect();
      return;
    }

    let shouldScan = false;

    for (let i = 0; i < mutations.length; i++) {
      const m = mutations[i];

      // Skip DeBait's internal controls and active elements to prevent recursion
      if (m.target) {
        if (m.target.dataset && m.target.dataset.debaitActive === 'true' && m.attributeName !== 'srcset') {
          continue;
        }
        if (isDeBaitNode(m.target)) {
          continue;
        }
      }

      if (m.type === 'attributes') {
        if (!settings.enabled) continue;

        if (m.attributeName === 'srcset' && m.target.tagName === 'IMG') {
          const img = m.target;
          if (img.dataset.debaitActive === 'true' && img.hasAttribute('srcset')) {
            img.dataset.debaitSrcset = img.getAttribute('srcset');
            img.removeAttribute('srcset');
          }
        } else if (m.attributeName === 'src' && m.target.tagName === 'IMG') {
          processImg(m.target);
        } else if (m.attributeName === 'style') {
          processBg(m.target);
        }
      } else if (m.type === 'childList') {
        if (!settings.enabled) continue;

        for (let j = 0; j < m.addedNodes.length; j++) {
          const node = m.addedNodes[j];
          if (node.nodeType === 1 && !isDeBaitNode(node)) {
            shouldScan = true;
            break;
          }
        }
      }
    }

    if (shouldScan && settings.enabled) {
      scheduleScan();
    }
  }) : null;

  // ---- Instant Synchronous Revert (Toggle OFF) -----------------------------

  function revertAll() {
    isReverting = true;

    const modifiedImgs = document.querySelectorAll('img[data-debait-orig], img[data-debait], img[data-debait-active="true"]');
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

    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => {
        isReverting = false;
      });
    } else {
      isReverting = false;
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

        const targetContainer = btn.closest('ytd-thumbnail, #thumbnail, .ytp-videowall-still') || btn.parentElement;
        const targetImg = targetContainer?.querySelector('img');
        if (!targetContainer || !targetImg) return;

        const currentState = targetContainer.dataset.debaitState || 'halfway';
        const willBeHalfway = currentState !== 'halfway';
        targetContainer.dataset.debaitManualOverride = willBeHalfway ? 'true' : 'false';

        if (willBeHalfway) {
          processImg(targetImg);
        } else {
          restoreImg(targetImg, targetContainer);
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
        scanImmediate(document);
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

    if (observer) {
      observer.observe(document.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['src', 'srcset', 'style'],
      });
    }

    if (settings.enabled) {
      scanImmediate(document);
    }
    injectNavbarToggle();

    window.addEventListener('yt-navigate-finish', () => {
      scheduleScan();
    });

    window.addEventListener('popstate', () => {
      scheduleScan();
    });

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'sync') return;

      if (!isContextValid()) {
        if (!isContextValid()) observer.disconnect();
        return;
      }

      let hasRelevantChange = false;
      let enabledChanged = false;
      let shortsChanged = false;

      for (const [key, { newValue }] of Object.entries(changes)) {
        if (key in settings) {
          if (settings[key] !== newValue) {
            hasRelevantChange = true;
            if (key === 'enabled') {
              enabledChanged = true;
            } else if (key === 'replaceShorts') {
              shortsChanged = true;
            }
          }
          settings[key] = newValue;
        }
      }

      if (!hasRelevantChange) return;

      updateNavbarToggleState();

      if (enabledChanged) {
        if (!settings.enabled) {
          revertAll();
        } else {
          scanImmediate(document);
        }
      } else if (shortsChanged) {
        scanImmediate(document);
      }
    });
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports.processImg = processImg;
    module.exports.restoreImg = restoreImg;
    module.exports.revertAll = revertAll;
    module.exports.scanImmediate = scanImmediate;
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
  Object.assign(module.exports, {
    extractVideoIdFromUrl,
    getHalfwayUrl,
    getFallbackUrl,
    isDeBaitNode,
    isShortsElement
  });
}
