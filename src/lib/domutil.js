/**
 * Exports
 *  -> refresh
 *  -> reload
 *  -> foreachSelectors
 *  -> unattach
 */
import {
  forEachEls
} from './utility';
import off from "./events/off";
export default function () {
  return {
    refresh: (el) => {
      this.parseDOM(el || document);
    },

    reload: function () {
      window.location.reload();
    },

    foreachSelectors: (selectors, cb, context, DOMcontext) => {
      DOMcontext = DOMcontext || document;
      selectors.forEach(function (selector) {
        forEachEls(DOMcontext.querySelectorAll(selector), cb, context);
      });
    },

    unattach: (el) => {
      forEachEls(this.getElements(el), (el) => {
        off(el, 'click');
        off(el, 'keyup');
      }, this);
    }
  };
}
