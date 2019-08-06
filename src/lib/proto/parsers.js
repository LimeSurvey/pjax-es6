/**
 * Collection of parsing methods
 *  Exports:
 *  -> parseDOMUnload
 *  -> parseDOM
 *  -> parseElementUnload
 *  -> parseElement
 *  -> parseOptions
 */

import {
  forEachEls
} from "../utility";



export default function () {
  return {
    parseElementUnload: function (el) {
      switch (el.tagName.toLowerCase()) {
        case "a":
          // only attach link if el does not already have link attached
          if (!el.hasAttribute('data-pjax-click-state')) {
            this.unattachLink(el)
          }
          break

        case "form":
          // only attach link if el does not already have link attached
          if (!el.hasAttribute('data-pjax-click-state')) {
            this.unattachForm(el)
          }
          break

        default:
          throw "Pjax can only be applied on <a> or <form> submit"
      }
    },

    parseElement: function (el) {
      switch (el.tagName.toLowerCase()) {
        case "a":
          // only attach link if el does not already have link attached
          if (!el.hasAttribute('data-pjax-click-state')) {
            this.attachLink(el)
          }
          break

        case "form":
          // only attach link if el does not already have link attached
          if (!el.hasAttribute('data-pjax-click-state')) {
            this.attachForm(el)
          }
          break

        default:
          throw "Pjax can only be applied on <a> or <form> submit"
      }
    },
    parseDOMUnload: function (el) {
      forEachEls(this.getElements(el), this.parseElementUnload, this)
    },

    parseDOM: function (el) {
      forEachEls(this.getElements(el), this.parseElement, this)
    },

    parseOptions: function (options) {
      this.options = options;

      this.options.elements = this.options.elements || "a[href], form[action]";
      this.options.reRenderCSS = this.options.reRenderCSS || false;
      this.options.forceRedirectOnFail = this.options.forceRedirectOnFail || false;
      this.options.scriptloadtimeout = this.options.scriptloadtimeout || 1000;
      this.options.mainScriptElement = this.options.mainScriptElement || "head";
      this.options.removeScriptsAfterParsing = this.options.removeScriptsAfterParsing || true;
      this.options.logObject = this.options.logObject || console;
      this.options.latestChance = this.options.latestChance || null;
      this.options.selectors = this.options.selectors || ["title", ".js-Pjax"];
      this.options.switches = this.options.switches || {};
      this.options.switchesOptions = this.options.switchesOptions || {};
      this.options.history = this.options.history || true;
      this.options.onDomDiffers = this.options.onDomDiffers || (() => true);
      this.options.pjaxErrorHandler = this.options.pjaxErrorHandler || (() => false);
      this.options.onJsonDocument = this.options.onJsonDocument || (() => true);
      this.options.analytics = this.options.analytics || (() => {
        // options.backward or options.foward can be true or undefined
        // by default, we do track back/foward hit
        // https://productforums.google.com/forum/#!topic/analytics/WVwMDjLhXYk
        if (window._gaq) {
          window._gaq.push(["_trackPageview"])
        }
        if (window.ga) {
          window.ga("send", "pageview", {
            page: location.pathname,
            title: document.title
          })
        }
      });
      this.options.scrollTo = (typeof this.options.scrollTo === 'undefined') ? 0 : this.options.scrollTo;
      this.options.cacheBust = (typeof this.options.cacheBust === 'undefined') ? true : this.options.cacheBust
      this.options.debug = this.options.debug || false

      // we can’t replace body.outerHTML or head.outerHTML
      // it create a bug where new body or new head are created in the dom
      // if you set head.outerHTML, a new body tag is appended, so the dom get 2 body
      // & it break the switchFallback which replace head & body
      if (!this.options.switches.head) {
        this.options.switches.head = this.switchElementsAlt
      }
      if (!this.options.switches.body) {
        this.options.switches.body = this.switchElementsAlt
      }
      if (typeof options.analytics !== "function") {
        options.analytics = function () {}
      }
    }
  };
};
