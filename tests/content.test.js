const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// Setup mock DOM environment before loading content script
function createMockElement(tagName, attributes = {}) {
  const dataset = {};
  const style = {};
  const classes = new Set();
  const children = [];
  let parent = null;

  const el = {
    tagName: tagName.toUpperCase(),
    nodeType: 1,
    dataset,
    style,
    children,
    attributes: { ...attributes },
    get isConnected() { return true; },
    get parentElement() { return parent; },
    set parentElement(p) { parent = p; },
    classList: {
      add: (...cls) => cls.forEach(c => classes.add(c)),
      remove: (...cls) => cls.forEach(c => classes.delete(c)),
      contains: (c) => classes.has(c)
    },
    getAttribute: (name) => el.attributes[name] ?? null,
    setAttribute: (name, val) => { el.attributes[name] = String(val); },
    hasAttribute: (name) => name in el.attributes,
    removeAttribute: (name) => { delete el.attributes[name]; },
    addEventListener: () => {},
    appendChild: (child) => {
      child.parentElement = el;
      children.push(child);
      return child;
    },
    querySelector: (selector) => {
      if (selector === '.debait-flip-btn') {
        return children.find(c => c.classList?.contains('debait-flip-btn')) || null;
      }
      if (selector === '.debait-thumbnail-badge') {
        return children.find(c => c.classList?.contains('debait-thumbnail-badge')) || null;
      }
      if (selector === 'img') {
        return children.find(c => c.tagName === 'IMG') || null;
      }
      return null;
    },
    closest: (selector) => {
      let cur = el;
      while (cur) {
        if (selector.includes('ytd-thumbnail') && cur.tagName === 'YTD-THUMBNAIL') return cur;
        if (selector.includes('#thumbnail') && cur.id === 'thumbnail') return cur;
        if (selector.includes('yt-image') && cur.tagName === 'YT-IMAGE') return cur;
        if (selector.includes('yt-img-shadow') && cur.tagName === 'YT-IMG-SHADOW') return cur;
        cur = cur.parentElement;
      }
      return null;
    }
  };

  if (tagName.toUpperCase() === 'IMG') {
    Object.defineProperty(el, 'src', {
      get: () => el.attributes['src'] || '',
      set: (val) => { el.attributes['src'] = val; }
    });
  }

  return el;
}

// Minimal global mock DOM
let elementsRegistry = [];

global.window = {
  addEventListener: () => {},
  MutationObserver: class {
    observe() {}
    disconnect() {}
  },
  requestAnimationFrame: (cb) => cb()
};
global.window.top = global.window;
global.window.self = global.window;
global.MutationObserver = global.window.MutationObserver;
global.requestAnimationFrame = global.window.requestAnimationFrame;

global.chrome = {
  runtime: { id: 'test-content-id' },
  storage: {
    sync: {
      get: (defs, cb) => cb?.(defs),
      set: () => {},
      onChanged: { addListener: () => {} }
    }
  }
};

global.document = {
  createElement: (tag) => createMockElement(tag),
  querySelectorAll: (selector) => {
    if (selector.includes('img[data-debait-orig]')) {
      return elementsRegistry.filter(el => el.tagName === 'IMG' && el.dataset.debaitOrig);
    }
    if (selector.includes('[data-debait-bg-orig]')) {
      return elementsRegistry.filter(el => el.dataset.debaitBgOrig);
    }
    return [];
  },
  querySelector: () => null,
  documentElement: createMockElement('html')
};

// Import content script with DOM mocks active
delete require.cache[require.resolve('../content/content.js')];
const content = require('../content/content.js');

describe('Content Script DOM Replacement & Revert Engine', () => {
  beforeEach(() => {
    elementsRegistry = [];
  });

  test('processImg updates thumbnail to midpoint frame and marks Polymer state', () => {
    const container = createMockElement('ytd-thumbnail');
    const wrapper = createMockElement('yt-image');
    const img = createMockElement('img');

    img.src = 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hq720.jpg';
    container.appendChild(wrapper);
    wrapper.appendChild(img);
    elementsRegistry.push(img);

    content.processImg(img);

    assert.equal(img.src, 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hq720_2.jpg');
    assert.equal(img.dataset.debaitActive, 'true');
    assert.equal(img.dataset.debaitOrig, 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hq720.jpg');
    assert.equal(img.classList.contains('yt-core-image--loaded'), true);
    assert.equal(wrapper.hasAttribute('loaded'), true);
    assert.equal(container.dataset.debaitState, 'halfway');
    assert.equal(container.dataset.debaitVideoId, 'dQw4w9WgXcQ');
  });

  test('restoreImg cleanly rolls back img to genuine creator thumbnail', () => {
    const container = createMockElement('ytd-thumbnail');
    const wrapper = createMockElement('yt-image');
    const img = createMockElement('img');

    img.src = 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hq720.jpg';
    container.appendChild(wrapper);
    wrapper.appendChild(img);
    elementsRegistry.push(img);

    content.processImg(img);
    assert.equal(img.src, 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hq720_2.jpg');

    content.restoreImg(img, container);

    assert.equal(img.src, 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hq720.jpg');
    assert.equal(img.dataset.debaitActive, 'false');
    assert.equal(img.dataset.debait, undefined);
    assert.equal(container.dataset.debaitState, 'original');
  });

  test('revertAll rolls back every modified element across the page', () => {
    const c1 = createMockElement('ytd-thumbnail');
    const img1 = createMockElement('img');
    img1.src = 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hq720.jpg';
    c1.appendChild(img1);
    elementsRegistry.push(img1);

    const c2 = createMockElement('ytd-thumbnail');
    const img2 = createMockElement('img');
    img2.src = 'https://i.ytimg.com/vi/9bZkp7q19f0/hq720.jpg';
    c2.appendChild(img2);
    elementsRegistry.push(img2);

    content.processImg(img1);
    content.processImg(img2);
    assert.equal(img1.src, 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hq720_2.jpg');
    assert.equal(img2.src, 'https://i.ytimg.com/vi/9bZkp7q19f0/hq720_2.jpg');

    content.revertAll();

    assert.equal(img1.src, 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hq720.jpg');
    assert.equal(img2.src, 'https://i.ytimg.com/vi/9bZkp7q19f0/hq720.jpg');
    assert.equal(img1.dataset.debaitActive, 'false');
    assert.equal(img2.dataset.debaitActive, 'false');
  });

  test('srcset is preserved and restored upon rollback', () => {
    const container = createMockElement('ytd-thumbnail');
    const img = createMockElement('img');
    const originalSrcset = 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg 1x, https://i.ytimg.com/vi/dQw4w9WgXcQ/hq720.jpg 2x';

    img.src = 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hq720.jpg';
    img.setAttribute('srcset', originalSrcset);
    container.appendChild(img);
    elementsRegistry.push(img);

    content.processImg(img);
    assert.equal(img.hasAttribute('srcset'), false);
    assert.equal(img.dataset.debaitSrcset, originalSrcset);

    content.restoreImg(img, container);
    assert.equal(img.getAttribute('srcset'), originalSrcset);
    assert.equal(img.dataset.debaitSrcset, undefined);
  });
});
