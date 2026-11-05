const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { isDeBaitNode, isShortsElement } = require('../content/content.js');

describe('DOM & Observer Filtering Helpers', () => {
  describe('isDeBaitNode', () => {
    test('identifies DeBait thumbnail badge as internal node', () => {
      const node = {
        nodeType: 1,
        classList: { contains: (cls) => cls === 'debait-thumbnail-badge' }
      };
      assert.equal(isDeBaitNode(node), true);
    });

    test('identifies DeBait flip button as internal node', () => {
      const node = {
        nodeType: 1,
        classList: { contains: (cls) => cls === 'debait-flip-btn' }
      };
      assert.equal(isDeBaitNode(node), true);
    });

    test('identifies DeBait navbar toggle as internal node', () => {
      const node = {
        nodeType: 1,
        classList: { contains: (cls) => cls === 'debait-navbar-toggle' }
      };
      assert.equal(isDeBaitNode(node), true);
    });

    test('identifies DeBait navbar container by ID as internal node', () => {
      const node = {
        nodeType: 1,
        id: 'debait-navbar-toggle-container',
        classList: { contains: () => false }
      };
      assert.equal(isDeBaitNode(node), true);
    });

    test('returns false for standard YouTube elements', () => {
      const ytNode = {
        nodeType: 1,
        tagName: 'YTD-RICH-ITEM-RENDERER',
        id: 'content',
        classList: { contains: () => false }
      };
      assert.equal(isDeBaitNode(ytNode), false);
    });

    test('returns false for null or non-element nodes', () => {
      assert.equal(isDeBaitNode(null), false);
      assert.equal(isDeBaitNode(undefined), false);
      assert.equal(isDeBaitNode({ nodeType: 3 }), false); // Text node
    });
  });

  describe('isShortsElement', () => {
    test('identifies elements inside ytd-reel-item-renderer as Shorts', () => {
      const node = {
        nodeType: 1,
        closest: (selector) => selector.includes('ytd-reel-item-renderer') ? {} : null,
        matches: () => false
      };
      assert.equal(isShortsElement(node), true);
    });

    test('identifies elements inside ytd-rich-shelf-renderer[is-shorts] as Shorts', () => {
      const node = {
        nodeType: 1,
        closest: (selector) => selector.includes('is-shorts') ? {} : null,
        matches: () => false
      };
      assert.equal(isShortsElement(node), true);
    });

    test('returns false for standard video container elements', () => {
      const node = {
        nodeType: 1,
        closest: () => null,
        matches: () => false
      };
      assert.equal(isShortsElement(node), false);
    });

    test('returns false for null or undefined input', () => {
      assert.equal(isShortsElement(null), false);
      assert.equal(isShortsElement(undefined), false);
    });
  });
});
