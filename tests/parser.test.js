const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { extractVideoIdFromUrl, getHalfwayUrl, getFallbackUrl } = require('../content/content.js');

describe('Video ID Parser', () => {
  test('extracts video ID from standard watch URL', () => {
    const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    assert.equal(extractVideoIdFromUrl(url), 'dQw4w9WgXcQ');
  });

  test('extracts video ID with leading and trailing query parameters', () => {
    const url = 'https://www.youtube.com/watch?feature=shared&v=dQw4w9WgXcQ&t=42s&list=PLrAXtmErZgOd';
    assert.equal(extractVideoIdFromUrl(url), 'dQw4w9WgXcQ');
  });

  test('extracts video ID from YouTube Shorts URL', () => {
    const url = 'https://www.youtube.com/shorts/kJQP7kiw5Fk';
    assert.equal(extractVideoIdFromUrl(url), 'kJQP7kiw5Fk');
  });

  test('extracts video ID from YouTube Shorts URL with trailing query', () => {
    const url = 'https://www.youtube.com/shorts/kJQP7kiw5Fk?feature=share';
    assert.equal(extractVideoIdFromUrl(url), 'kJQP7kiw5Fk');
  });

  test('extracts video ID from YouTube Embed URL', () => {
    const url = 'https://www.youtube.com/embed/9bZkp7q19f0';
    assert.equal(extractVideoIdFromUrl(url), '9bZkp7q19f0');
  });

  test('extracts video ID from YouTube Live stream URL', () => {
    const url = 'https://www.youtube.com/live/dQw4w9WgXcQ';
    assert.equal(extractVideoIdFromUrl(url), 'dQw4w9WgXcQ');
  });

  test('extracts video ID from YouTube Live stream URL with trailing query', () => {
    const url = 'https://www.youtube.com/live/dQw4w9WgXcQ?feature=share';
    assert.equal(extractVideoIdFromUrl(url), 'dQw4w9WgXcQ');
  });

  test('extracts video ID from youtu.be short URL', () => {
    const url = 'https://youtu.be/dQw4w9WgXcQ';
    assert.equal(extractVideoIdFromUrl(url), 'dQw4w9WgXcQ');
  });

  test('extracts video ID from youtu.be short URL with trailing query', () => {
    const url = 'https://youtu.be/dQw4w9WgXcQ?t=120';
    assert.equal(extractVideoIdFromUrl(url), 'dQw4w9WgXcQ');
  });

  test('extracts video ID from i.ytimg.com JPEG CDN URL', () => {
    const url = 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hq720.jpg?sqp=-oaymwEcCNAFEJQDSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CL';
    assert.equal(extractVideoIdFromUrl(url), 'dQw4w9WgXcQ');
  });

  test('extracts video ID from i.ytimg.com WebP CDN URL', () => {
    const url = 'https://i.ytimg.com/vi_webp/9bZkp7q19f0/maxresdefault.webp';
    assert.equal(extractVideoIdFromUrl(url), '9bZkp7q19f0');
  });

  test('returns null for malformed or non-YouTube URLs', () => {
    assert.equal(extractVideoIdFromUrl(''), null);
    assert.equal(extractVideoIdFromUrl(null), null);
    assert.equal(extractVideoIdFromUrl(undefined), null);
    assert.equal(extractVideoIdFromUrl('https://google.com/search?q=youtube'), null);
    assert.equal(extractVideoIdFromUrl('https://www.youtube.com/feed/subscriptions'), null);
  });
});

describe('Halfway Frame URL Generator', () => {
  test('generates 1280x720 HD midpoint URL for high quality', () => {
    const url = getHalfwayUrl('dQw4w9WgXcQ', 'high');
    assert.equal(url, 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hq720_2.jpg');
  });

  test('generates 480x360 midpoint URL for standard quality', () => {
    const url = getHalfwayUrl('dQw4w9WgXcQ', 'standard');
    assert.equal(url, 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hq2.jpg');
  });

  test('returns null for missing video ID', () => {
    assert.equal(getHalfwayUrl(''), null);
    assert.equal(getHalfwayUrl(null), null);
  });
});

describe('Resolution Fallback Engine', () => {
  test('falls back from hq720_2.jpg to hq2.jpg', () => {
    const current = 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hq720_2.jpg';
    assert.equal(getFallbackUrl(current, 'dQw4w9WgXcQ'), 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hq2.jpg');
  });

  test('falls back from hq2.jpg to 2.jpg', () => {
    const current = 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hq2.jpg';
    assert.equal(getFallbackUrl(current, 'dQw4w9WgXcQ'), 'https://i.ytimg.com/vi/dQw4w9WgXcQ/2.jpg');
  });

  test('returns null when fallback exhausted', () => {
    const current = 'https://i.ytimg.com/vi/dQw4w9WgXcQ/2.jpg';
    assert.equal(getFallbackUrl(current, 'dQw4w9WgXcQ'), null);
  });
});
