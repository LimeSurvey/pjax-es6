/**
 * General utility file 
 * Exports: 
 * -> forEachEls
 * -> getElements
 * -> clone
 * -> isSupported
 * -> newUid
 */
import './polyfills/Array.prototype.from';

export const forEachEls = 
function (els, fn, ctx) {
  if (els instanceof HTMLCollection || els instanceof NodeList || els instanceof Array) {
    return Array.prototype.from(els).forEach((el) => fn.call(ctx, el));
  }
  // assume simple dom element
  return fn.call(ctx, els);
};

export const getElements = function (el) {
  return el.querySelectorAll(this.options.elements)
}

export const clone = function (obj) {
  if (null === obj || "object" != typeof obj) {
    return obj
  }
  const copy = obj.constructor()
  for (var attr in obj) {
    if (attr in obj) {
      copy[attr] = obj[attr];
    }
  }
  return copy;
}

export const isSupported = function () {
  // Borrowed wholesale from https://github.com/defunkt/jquery-pjax
  return window.history &&
    window.history.pushState &&
    window.history.replaceState &&
    // pushState isn’t reliable on iOS until 5.
    !navigator.userAgent.match(/((iPod|iPhone|iPad).+\bOS\s+[1-4]\D|WebApps\/.+CFNetwork)/)
}

export const newUid = (function() {
    var counter = 0
    return function() {
      var id = ("pjax" + (new Date().getTime())) + "_" + counter
      counter++
      return id
    }
  })();

export default function() {
    return {
        forEachEls,
        getElements,
        clone,
        isSupported,
        newUid
    }
}