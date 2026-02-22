(function () {
  'use strict';
  try {
    var href = window.location.href;
    var isFb = /^https?:\/\/(www\.)?(facebook|fb|m\.facebook)\.com/i.test(href);
    if (isFb && /\/reel\//i.test(window.location.pathname)) {
      window.location.replace('https://www.facebook.com/');
    }
  } catch (_) {}
})();
