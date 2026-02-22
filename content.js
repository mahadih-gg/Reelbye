(function () {
  'use strict';

  // Redirect Facebook reel URLs to home
  try {
    var isFb = /^https?:\/\/(www\.)?(facebook|fb|m\.facebook)\.com/i.test(window.location.href);
    if (isFb && /\/reel\//i.test(window.location.pathname)) {
      window.location.replace('https://www.facebook.com/');
      return;
    }
  } catch (_) {}

  // Iframe URL patterns that indicate video content (host or path)
  const VIDEO_IFRAME_PATTERNS = [
    /facebook\.com\/watch/i,
    /facebook\.com\/video/i,
    /fb\.watch/i,
    /fbcdn\.net.*video/i,
    /youtube\.com/i,
    /youtube\.com\/embed/i,
    /youtu\.be/i,
    /vimeo\.com/i,
    /player\.vimeo\.com/i,
    /twitch\.tv/i,
    /player\.twitch\.tv/i,
    /dailymotion\.com/i,
    /embed\.dailymotion\.com/i,
  ];

  // Facebook-specific container selectors (tunable after testing)
  const FACEBOOK_VIDEO_SELECTORS = [
    '[data-video-id]',
    '[data-pagelet*="Video"]',
    '[data-pagelet="VideoReels"]',
    '[data-ad-preview="video"]',
    'div[data-video-count]',
  ];

  function getIframeUrl(iframe) {
    const src = iframe.getAttribute('src') || iframe.getAttribute('data-src') || '';
    if (!src || src.startsWith('about:')) return '';
    try {
      return new URL(src, document.baseURI || window.location.href).href;
    } catch {
      return src;
    }
  }

  function isVideoIframe(iframe) {
    const url = getIframeUrl(iframe);
    if (!url) return false;
    return VIDEO_IFRAME_PATTERNS.some(function (re) { return re.test(url); });
  }

  function isFacebook() {
    try {
      return /^https?:\/\/(www\.)?(facebook|fb|m\.facebook)\.com/i.test(window.location.href);
    } catch {
      return false;
    }
  }

  function removeElement(el) {
    if (el && el.parentNode) {
      el.parentNode.removeChild(el);
    }
  }

  function removeFacebookReelsSections(root) {
    if (!root || !isFacebook()) return;
    try {
      // Strategy 1: Remove direct children of [role="feed"] that contain "Reels"
      var feed = root.querySelector && root.querySelector('[role="feed"]');
      if (feed) {
        var children = feed.children;
        for (var i = children.length - 1; i >= 0; i--) {
          var el = children[i];
          if (el && el.textContent && el.textContent.indexOf('Reels') !== -1) {
            removeElement(el);
          }
        }
      }

      // Strategy 2: Find any "Reels" label inside the feed and remove its feed-unit ancestor
      // (handles nested structure where the card is not a direct child)
      var feed2 = root.querySelector && root.querySelector('[role="feed"]');
      if (feed2) {
        var reelsLabels = root.querySelectorAll('span, div, a, h1, h2, h3, h4');
        for (var j = 0; j < reelsLabels.length; j++) {
          var label = reelsLabels[j];
          var text = (label.textContent || '').trim();
          if (text !== 'Reels') continue;
          if (!feed2.contains(label)) continue;
          var ancestor = label;
          while (ancestor && ancestor.parentNode !== feed2) {
            ancestor = ancestor.parentNode;
          }
          if (ancestor && ancestor.parentNode === feed2) {
            removeElement(ancestor);
            break;
          }
        }
      }

      // Strategy 3: Within [role="main"], remove containers that look like Reels cards
      // (fallback when feed structure differs: large block containing "Reels" and no other main text)
      var main = root.querySelector && root.querySelector('[role="main"]');
      if (main) {
        var candidates = main.querySelectorAll('div[dir="auto"]');
        for (var k = 0; k < candidates.length; k++) {
          var box = candidates[k];
          if (!box.textContent || box.textContent.indexOf('Reels') === -1) continue;
          if (box.offsetWidth < 400 || box.offsetHeight < 200) continue;
          var firstText = (box.textContent || '').trim().split(/\s+/)[0];
          if (firstText === 'Reels') {
            var card = box.closest ? box.closest('div[role="article"]') : null;
            if (!card) {
              var p = box.parentNode;
              while (p && p !== main && (p.offsetWidth < 400 || p.offsetHeight < 200)) {
                p = p.parentNode;
              }
              card = p && p !== main ? p : box;
            }
            if (card && card.parentNode && card !== main) {
              removeElement(card);
              break;
            }
          }
        }
      }
    } catch (_) {}
  }

  function removeVideosInNode(node) {
    if (!node || typeof node.querySelectorAll !== 'function') return;

    // Remove native video elements
    node.querySelectorAll('video').forEach(removeElement);

    // Remove video iframes
    node.querySelectorAll('iframe').forEach(function (iframe) {
      if (isVideoIframe(iframe)) removeElement(iframe);
    });

    // Facebook-specific containers (only on Facebook)
    if (isFacebook()) {
      FACEBOOK_VIDEO_SELECTORS.forEach(function (selector) {
        try {
          node.querySelectorAll(selector).forEach(removeElement);
        } catch (_) {}
      });
      removeFacebookReelsSections(node);
    }
  }

  function processAddedNodes(addedNodes) {
    addedNodes.forEach(function (node) {
      if (node.nodeType !== Node.ELEMENT_NODE) return;

      if (node.tagName === 'VIDEO') {
        removeElement(node);
        return;
      }
      if (node.tagName === 'IFRAME' && isVideoIframe(node)) {
        removeElement(node);
        return;
      }

      if (isFacebook()) {
        var match = false;
        FACEBOOK_VIDEO_SELECTORS.forEach(function (selector) {
          try {
            if (node.matches && node.matches(selector)) match = true;
          } catch (_) {}
        });
        if (match) {
          removeElement(node);
          return;
        }
      }

      removeVideosInNode(node);
    });
  }

  function runInitialSweep() {
    removeVideosInNode(document.documentElement);
  }

  function startObserver() {
    var root = document.body || document.documentElement;
    if (!root) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startObserver);
      }
      return;
    }

    runInitialSweep();

    if (isFacebook()) {
      setTimeout(function () { removeFacebookReelsSections(root); }, 500);
      setTimeout(function () { removeFacebookReelsSections(root); }, 2000);
    }

    var observer = new MutationObserver(function (mutations) {
      var toProcess = [];
      mutations.forEach(function (m) {
        if (m.addedNodes && m.addedNodes.length) {
          for (var i = 0; i < m.addedNodes.length; i++) toProcess.push(m.addedNodes[i]);
        }
      });
      if (toProcess.length === 0) return;
      setTimeout(function () {
        processAddedNodes(toProcess);
        if (isFacebook()) removeFacebookReelsSections(document.body);
      }, 0);
    });

    observer.observe(root, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver);
  } else {
    startObserver();
  }
})();
