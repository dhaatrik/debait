/**
 * DeBait for YouTube™
 * Content Script - Robust thumbnail replacer & Stageshow-crafted controls
 */

// Pure helper functions (exported for automated unit testing)
function extractVideoIdFromUrl(url) {
  if (!url || typeof url !== 'string') return null;

  const vParam = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (vParam) return vParam[1];

  const shortsParam = url.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (shortsParam) return shortsParam[1];

  const embedParam = url.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
  if (embedParam) return embedParam[1];

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

  const DEFAULTS = {
    enabled: true,
    quality: 'high',
    showBadge: true,
    showNavbarToggle: true,
    showIndividualToggle: true
  };

  const ORIGIN = 'https://i.ytimg.com';
  const THUMB_RE = /^(?:https?:)?\/\/i\d*\.ytimg\.com\/vi(?:_webp)?\/([\w-]{11})\/(\w+)\.(?:jpg|webp)/;
  const AUTO_FRAME_RE = /^(?:hq|mq|sd|maxres|oar|hq720_)?[123]$/;
  const CSS_URL_RE = /url\(\s*["']?([^"')]+)["']?\s*\)/;
  const PLACEHOLDER_WIDTH = 120; // YouTube serves 120x90 grey placeholder for missing frames

  let settings = { ...DEFAULTS };
  const probeCache = new Map();

  function probe(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img.naturalWidth > PLACEHOLDER_WIDTH);
      img.onerror = () => resolve(false);
      img.src = url;
    });
  }

  function resolveMidpointFrame(id, quality) {
    const key = `${id}:${quality}`;
    let promise = probeCache.get(key);
    if (!promise) {
      promise = (async () => {
        const candidates = quality === 'high'
          ? [`${ORIGIN}/vi/${id}/hq720_2.jpg`, `${ORIGIN}/vi/${id}/hq2.jpg`]
          : [`${ORIGIN}/vi/${id}/hq2.jpg`];

        for (const url of candidates) {
          if (await probe(url)) return url;
        }
        return `${ORIGIN}/vi/${id}/hq2.jpg`; // Ultimate fallback
      })();
      probeCache.set(key, promise);
    }
    return promise;
  }

  function parseThumbUrl(url) {
    const m = url && THUMB_RE.exec(url);
    if (!m || AUTO_FRAME_RE.test(m[2])) return null;
    return m[1];
  }

  // ---- <img> Element Processing ---------------------------------------------

  function processImg(img) {
    const src = img.getAttribute('src') || '';
    if (img.dataset.debait && src === img.dataset.debait) return; // Already processed

    const id = parseThumbUrl(src) || resolveIdFromContext(img);
    if (!id) return;

    if (!img.dataset.debaitOrig) {
      img.dataset.debaitOrig = src;
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

    resolveMidpointFrame(id, settings.quality).then((url) => {
      if (!url || img.getAttribute('src') !== src) return;

      img.dataset.debait = url;

      if (img.hasAttribute('srcset') && !img.dataset.debaitSrcset) {
        img.dataset.debaitSrcset = img.getAttribute('srcset');
        img.removeAttribute('srcset');
      }

      img.src = url;
      img.style.objectFit = 'cover';

      if (container) {
        container.dataset.debaitState = 'halfway';
        updateBadge(container, true);
        updateFlipButtonTooltip(container, 'halfway');
      }
    });
  }

  function restoreImg(img, container) {
    if (img.dataset.debaitOrig) {
      img.src = img.dataset.debaitOrig;
      delete img.dataset.debait;
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

    resolveMidpointFrame(id, settings.quality).then((url) => {
      if (!url || !settings.enabled || el.style.backgroundImage !== bg) return;
      el.dataset.debaitBg = url;
      el.style.backgroundImage = `url("${url}")`;
    });
  }

  function resolveIdFromContext(img) {
    const anchor = img.closest('a') ||
      img.closest('ytd-thumbnail, ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer')?.querySelector('a#thumbnail, a#video-title-link, a[href*="watch?v="]');
    if (anchor && anchor.href) {
      return extractVideoIdFromUrl(anchor.href);
    }
    return null;
  }

  // ---- DOM Scanning & MutationObserver --------------------------------------

  function scan(root) {
    if (!root || (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE)) return;

    if (root.tagName === 'IMG') processImg(root);
    else if (root.getAttribute && root.getAttribute('style')) processBg(root);

    const imgs = root.querySelectorAll ? root.querySelectorAll('img[src*="ytimg.com/vi"]') : [];
    for (const img of imgs) processImg(img);

    const bgs = root.querySelectorAll ? root.querySelectorAll('[style*="ytimg.com/vi"]') : [];
    for (const el of bgs) processBg(el);
  }

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (
        m.target &&
        m.target.classList &&
        (m.target.classList.contains('debait-thumbnail-badge') ||
         m.target.classList.contains('debait-flip-btn') ||
         m.target.classList.contains('debait-navbar-toggle'))
      ) {
        continue;
      }

      if (m.type === 'attributes') {
        if (m.attributeName === 'src') {
          if (m.target.tagName === 'IMG') processImg(m.target);
        } else if (m.attributeName === 'style') {
          processBg(m.target);
        }
      } else {
        for (const node of m.addedNodes) scan(node);
      }
    }
  });

  function revertAll() {
    for (const img of document.querySelectorAll('img[data-debait-orig]')) {
      const container = img.closest('ytd-thumbnail, #thumbnail, .ytp-videowall-still') || img.parentElement;
      restoreImg(img, container);
    }
    for (const el of document.querySelectorAll('[data-debait-bg-orig]')) {
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

      chrome.storage.sync.set({ enabled: newEnabled }, () => {
        updateNavbarToggleState();
        if (newEnabled) {
          scan(document);
        } else {
          revertAll();
        }
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

  // ---- Bootstrap -----------------------------------------------------------

  function start() {
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['src', 'style'],
    });

    if (settings.enabled) scan(document);
    injectNavbarToggle();

    window.addEventListener('yt-navigate-finish', () => {
      if (settings.enabled) scan(document);
      injectNavbarToggle();
    });

    window.addEventListener('yt-page-data-updated', () => {
      if (settings.enabled) scan(document);
    });

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        if (settings.enabled) scan(document);
        injectNavbarToggle();
      });
    }
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    for (const [key, { newValue }] of Object.entries(changes)) {
      if (key in settings) settings[key] = newValue;
    }
    updateNavbarToggleState();
    if (!settings.enabled) {
      revertAll();
    } else {
      scan(document);
    }
  });

  chrome.storage.sync.get(DEFAULTS, (stored) => {
    settings = { ...DEFAULTS, ...stored };
    start();
  });
})();

// Export for automated unit test runner
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    extractVideoIdFromUrl,
    getHalfwayUrl,
    getFallbackUrl
  };
}
