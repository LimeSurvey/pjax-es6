"use strict";

import on from "./lib/events/on.js";
import log from "./lib/proto/log.js";
import trigger from "./lib/events/trigger.js";
import doRequest from "./lib/request.js";
import getSwitchSelectors from './lib/switches-selectors.js';
import getAttachLink from "./lib/proto/attach-link.js";
import getAttachForm from "./lib/proto/attach-form.js";
import getExecuteScripts from './lib/execute-scripts.js';
import getUnattachLink from "./lib/proto/unattach-link.js";
import getUnattachForm from "./lib/proto/unattach-form.js";
import getUpdateStylesheets from "./lib/update-stylesheets.js";
import getUtility from './lib/utility.js';
import {isSupported} from './lib/utility.js';
import getParsers from "./lib/proto/parsers.js";
import getDomUtils from "./lib/domutil.js";

const PjaxFactory = function () {

  class Pjax {

    constructor(options) {
      this.firstrun = true;
      this.oUtilities = getUtility();
      this.oDomUtils = getDomUtils.call(this);
      this.oParsers = getParsers.call(this);
      
      this.oParsers.parseOptions.call(this, options);
      this.log = log.call(this);

      this.doRequest = doRequest;
      this.getElements = this.oUtilities.getElements;
      this.parseElementUnload = this.oParsers.parseElementUnload;
      this.parseElement = this.oParsers.parseElement;
      this.parseDOM = this.oParsers.parseDOM;
      this.parseDOMUnload = this.oParsers.parseDOMUnload;
      this.refresh = this.oDomUtils.refresh;
      this.reload = this.oDomUtils.reload;
      this.isSupported = this.oUtilities.isSupported;
      this.attachLink = getAttachLink.call(this);
      this.attachForm = getAttachForm.call(this);
      this.unattachLink = getUnattachLink.call(this);
      this.unattachForm = getUnattachForm.call(this);
      this.updateStylesheets = getUpdateStylesheets.call(this);

  

      this.log.log("Pjax options", this.options);
      this.maxUid = this.lastUid = this.oUtilities.newUid();
      this.parseDOM(document);

      on(window, "popstate", (st) => {
        this.log.log("OPT -> ", st);

        if (st.state) {
          const opt = this.oUtilities.clone(this.options);

          opt.url = st.state.url;
          opt.title = st.state.title;
          opt.history = false;
          opt.requestOptions = {};
            
            this.log.log("OPT -> ", opt);
            this.log.log("State UID", st.state.uid);
            this.log.log("lastUID", this.lastUid);

          if (st.state.uid < this.lastUid) {
            opt.backward = true;
          } else {
            opt.forward = true;
          }
          this.lastUid = st.state.uid;

          // @todo implement history cache here, based on uid
          this.loadUrl(st.state.url, opt);
        }
      });

      return this;
    }


    forEachSelectors(cb, context, DOMcontext) {
      return this.oDomUtils.foreachSelectors(this.options.selectors, cb, context, DOMcontext);
    }

    switchSelectors(selectors, fromEl, toEl, options) {
      const fnSwitchSelectors = getSwitchSelectors.call(this);
      return fnSwitchSelectors(this.options.switches, this.options.switchesOptions, selectors, fromEl, toEl, options);
    }


    latestChance(href) {
      window.location.href = href;
      return false;
    }

    onSwitch() {
      trigger(window, "resize scroll");
    }

    loadContent(html, options) {
      const fnExecuteScripts = getExecuteScripts.apply(this);
      const tmpEl = window.document.implementation.createHTMLDocument("pjax");
      //Collector array to store the promises in
      const collectForScriptcomplete = [(Promise.resolve("basic resolve"))];

      //parse HTML attributes to copy them
      //since we are forced to use documentElement.innerHTML (outerHTML can't be used for <html>)
      const htmlRegex = /<html[^>]+>/gi;
      const htmlAttribsRegex = /\s?[a-z:]+(?:=(?:'|")[^'">]+(?:'|"))*/gi;

      let matches = html.match(htmlRegex);
      if (matches && matches.length) {
        matches = matches[0].match(htmlAttribsRegex);
        if (matches.length) {
          matches.shift();
          matches.forEach(function (htmlAttrib) {
            var attr = htmlAttrib.trim().split("=");
            if (attr.length === 1) {
              tmpEl.documentElement.setAttribute(attr[0], true);
            } else {
              tmpEl.documentElement.setAttribute(attr[0], attr[1].slice(1, -1));
            }
          });
        }
      }

      let jsonContent = null;
      try {
        jsonContent = JSON.parse(html);
      } catch (e) {
        this.log.warn('No JSON found. If you expected it there was an error');
      }

      tmpEl.documentElement.innerHTML = html;
      this.log.log("load content", tmpEl.documentElement.attributes, tmpEl.documentElement.innerHTML.length);

      if (jsonContent !== null) {
        this.log.log("found JSON document", jsonContent);
        this.options.onJsonDocument.call(this, jsonContent);
      }

      // Clear out any focused controls before inserting new page contents.
      // we clear focus on non form elements
      if (window.document.activeElement && !window.document.activeElement.value) {
        try {
          window.document.activeElement.blur();
        } catch (e) {
          // Nothing to do, just ignore any issues
        }
      }

      this.switchSelectors(this.options.selectors, tmpEl, document, options);

      //reset stylesheets if activated
      if (this.options.reRenderCSS === true) {
        this.updateStylesheets(tmpEl.querySelectorAll('link[rel=stylesheet]'), document.querySelectorAll('link[rel=stylesheet]'));
      }

      // FF bug: Won’t autofocus fields that are inserted via JS.
      // This behavior is incorrect. So if theres no current focus, autofocus
      // the last field.
      //
      // http://www.w3.org/html/wg/drafts/html/master/forms.html
      const autofocusEl = Array.prototype.slice.call(document.querySelectorAll("[autofocus]")).pop();
      if (autofocusEl && document.activeElement !== autofocusEl) {
        autofocusEl.focus();
      }

      // execute scripts when DOM have been completely updated
      this.options.selectors.forEach((selector) => {
        this.oUtilities.forEachEls(document.querySelectorAll(selector), function (el) {
          collectForScriptcomplete.push.apply(collectForScriptcomplete, fnExecuteScripts(el));
        }, this);
      });
      // }
      // catch(e) {
      //   if (this.options.debug) {
      //     this.log.log("Pjax switch fail: ", e)
      //   }
      //   this.switchFallback(tmpEl, document)
      // }
      this.log.log("waiting for scriptcomplete", collectForScriptcomplete);

      //Fallback! If something can't be loaded or is not loaded correctly -> just force eventing in error
      let timeOutScriptEvent = null;
      timeOutScriptEvent = window.setTimeout(function () {
        trigger(document, "pjax:scriptcomplete pjax:scripttimeout", options);
        timeOutScriptEvent = null;
      }, this.options.scriptloadtimeout);

      Promise.all(collectForScriptcomplete).then(
        //resolved
        function () {
          if (timeOutScriptEvent !== null) {
            window.clearTimeout(timeOutScriptEvent);
            trigger(document, "pjax:scriptcomplete pjax:scriptsuccess", options);
          }
        },
        function () {
          if (timeOutScriptEvent !== null) {
            window.clearTimeout(timeOutScriptEvent);
            trigger(document, "pjax:scriptcomplete pjax:scripterror", options);
          }
        }
      );
    }

    loadUrl(href, options) {
      this.log.log("load href", href, options);

      trigger(document, "pjax:send", options);

      // Do the request
      this.doRequest(href, options.requestOptions, (html, requestData) => {
        // Fail if unable to load HTML via AJAX
        if (html === false || requestData.status !== 200) {
          trigger(document, "pjax:complete pjax:error", {
            options: options,
            requestData: requestData,
            href: href
          });
          return options.pjaxErrorHandler(href, options, requestData);
        }

        // Clear out any focused controls before inserting new page contents.
        document.activeElement.blur();

        try {
          this.loadContent(html, options);
        } catch (e) {
          if (!this.options.debug) {
            if (console && this.options.logObject.error) {
              this.options.logObject.error("Pjax switch fail: ", e);
            }
            return options.pjaxErrorHandler(href, options, requestData) || this.latestChance(href);
          } else {
            if (this.options.forceRedirectOnFail) {
              return options.pjaxErrorHandler(href, options, requestData) || this.latestChance(href);
            }
            throw e;
          }
        }

        if (options.history) {
          if (this.firstrun) {
            this.lastUid = this.maxUid = this.oUtilities.newUid();
            this.firstrun = false;
            window.history.replaceState({
                url: window.location.href,
                title: document.title,
                uid: this.maxUid
              },
              document.title);
          }

          // Update browser history
          this.lastUid = this.maxUid = this.oUtilities.newUid();
          window.history.pushState({
              url: href,
              title: options.title,
              uid: this.maxUid
            },
            options.title,
            href);
        }

        this.forEachSelectors(el => this.parseDOM(el));

        // Fire Events
        trigger(document, "pjax:complete pjax:success", options);

        options.analytics();

        // Scroll page to top on new page load
        if (options.scrollTo !== false) {
          if (options.scrollTo.length > 1) {
            window.scrollTo(options.scrollTo[0], options.scrollTo[1]);
          } else {
            window.scrollTo(0, options.scrollTo);
          }
        }
      });
    }
  }
  
  // if there isn’t required browser functions, returning stupid api
  if (!isSupported()) {
      console.warn('Pjax not supported');
    const stupidPjax = function () {};
    for (let key in Pjax.prototype) {
      if (key in Pjax.prototype && typeof Pjax.prototype[key] === "function") {
        stupidPjax[key] = stupidPjax;
      }
    }
    return stupidPjax;
  }

  return Pjax;
};

export default new PjaxFactory();
