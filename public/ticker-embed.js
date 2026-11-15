(function () {
  "use strict";

  // A separate flag also works alongside older WordPress snippets.
  if (window.otwTickerEmbed) return;
  window.otwTickerEmbed = true;

  var registered = new WeakSet();

  function tickerUrl(frame) {
    try {
      var url = new URL(frame.src, document.baseURI);
      return /^\/embed\/ticker\/?$/.test(url.pathname) ? url : null;
    } catch (_) {
      return null;
    }
  }

  function requestHeight(frame) {
    var url = tickerUrl(frame);
    if (url && frame.contentWindow) {
      frame.contentWindow.postMessage({ type: "lovable-weather:request-height" }, url.origin);
    }
  }

  function findFrames() {
    document.querySelectorAll(".otw-ticker iframe").forEach(function (frame) {
      if (!tickerUrl(frame)) return;
      if (!registered.has(frame)) {
        registered.add(frame);
        // Growing must be immediate, otherwise the iframe clips its own content.
        frame.style.transition = "none";
        frame.style.margin = "0";
        frame.addEventListener("load", function () { requestHeight(frame); });
      }
      requestHeight(frame);
    });
  }

  window.addEventListener("message", function (event) {
    var data = event.data;
    if (!data || data.type !== "lovable-weather:height") return;
    if (typeof data.height !== "number" || !Number.isFinite(data.height) || data.height < 60) return;

    document.querySelectorAll(".otw-ticker iframe").forEach(function (frame) {
      var url = tickerUrl(frame);
      if (!url || event.origin !== url.origin || event.source !== frame.contentWindow) return;
      var height = Math.ceil(data.height) + "px";
      if (frame.style.height !== height) frame.style.height = height;
    });
  });

  // Also covers delayed scripts, hidden desktop/mobile copies and inserted widgets.
  window.addEventListener("resize", findFrames);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", findFrames, { once: true });
  }
  if (document.documentElement) {
    new MutationObserver(findFrames).observe(document.documentElement, { childList: true, subtree: true });
  }
  findFrames();
})();