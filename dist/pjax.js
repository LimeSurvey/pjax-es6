(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.Pjax = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
var clone = require('./lib/clone.js')
var executeScripts = require('./lib/execute-scripts.js')
var forEachEls = require("./lib/foreach-els.js")
var newUid = require("./lib/uniqueid.js")

var on = require("./lib/events/on.js")
// var off = require("./lib/events/on.js")
var trigger = require("./lib/events/trigger.js")


var Pjax = function(options) {
    this.firstrun = true

    var parseOptions = require("./lib/proto/parse-options.js");
    parseOptions.apply(this,[options])
    this.log("Pjax options", this.options)

    this.maxUid = this.lastUid = newUid()

    this.parseDOM(document)

    on(window, "popstate", function(st) {
      if (st.state) {
        var opt = clone(this.options)
        opt.url = st.state.url
        opt.title = st.state.title
        opt.history = false
        opt.requestOptions = {};
        if (st.state.uid < this.lastUid) {
          opt.backward = true
        }
        else {
          opt.forward = true
        }
        this.lastUid = st.state.uid

        // @todo implement history cache here, based on uid
        this.loadUrl(st.state.url, opt)
      }
    }.bind(this));

    return this;
  }

Pjax.prototype = {
  log: require("./lib/proto/log.js"),

  getElements: require("./lib/proto/get-elements.js"),

  parseDOM: require("./lib/proto/parse-dom.js"),

  parseDOMtoUnload: require("./lib/proto/parse-dom-unload.js"),

  refresh: require("./lib/proto/refresh.js"),

  reload: require("./lib/reload.js"),

  attachLink: require("./lib/proto/attach-link.js"),

  attachForm: require("./lib/proto/attach-form.js"),

  unattachLink: require("./lib/proto/unattach-link.js"),

  unattachForm: require("./lib/proto/unattach-form.js"),

  updateStylesheets: require("./lib/update-stylesheets.js"),

  forEachSelectors: function(cb, context, DOMcontext) {
    return require("./lib/foreach-selectors.js").bind(this)(this.options.selectors, cb, context, DOMcontext)
  },

  switchSelectors: function(selectors, fromEl, toEl, options) {
    return require("./lib/switches-selectors.js").bind(this)(this.options.switches, this.options.switchesOptions, selectors, fromEl, toEl, options)
  },

  // too much problem with the code below
  // + it’s too dangerous
//   switchFallback: function(fromEl, toEl) {
//     this.switchSelectors(["head", "body"], fromEl, toEl)
//     // execute script when DOM is like it should be
//     Pjax.executeScripts(document.querySelector("head"))
//     Pjax.executeScripts(document.querySelector("body"))
//   }

  latestChance: function(href) {
      window.location.href = href;
      return false;
  },

  onSwitch: function() {
    trigger(window, "resize scroll")
  },

  loadContent: function(html, options) {
    var tmpEl = document.implementation.createHTMLDocument("pjax")
    var collectForScriptcomplete = [
      (Promise.resolve("basic resolve"))
    ];

    // parse HTML attributes to copy them
    // since we are forced to use documentElement.innerHTML (outerHTML can't be used for <html>)
    var htmlRegex = /<html[^>]+>/gi
    var htmlAttribsRegex = /\s?[a-z:]+(?:\=(?:\'|\")[^\'\">]+(?:\'|\"))*/gi
    var matches = html.match(htmlRegex)
    if (matches && matches.length) {
      matches = matches[0].match(htmlAttribsRegex)
      if (matches.length) {
        matches.shift()
        matches.forEach(function(htmlAttrib) {
          var attr = htmlAttrib.trim().split("=")
          if (attr.length === 1) {
            tmpEl.documentElement.setAttribute(attr[0], true)
          }
          else {
            tmpEl.documentElement.setAttribute(attr[0], attr[1].slice(1, -1))
          }
        })
      }
    }

    jsonContent = null;
    try{
      jsonContent = JSON.parse(html);
    } catch(e) {}

    tmpEl.documentElement.innerHTML = html
    this.log("load content", tmpEl.documentElement.attributes, tmpEl.documentElement.innerHTML.length)

    if(jsonContent !== null) {
      this.log("found JSON document", jsonContent);
      this.options.onJsonDocument.call(this, jsonContent);  
    }

    // Clear out any focused controls before inserting new page contents.
    // we clear focus on non form elements
    if (document.activeElement && !document.activeElement.value) {
      try {
        document.activeElement.blur()
      } catch (e) { }
    }

    this.switchSelectors(this.options.selectors, tmpEl, document, options)

    //reset stylesheets if activated
    if(this.options.reRenderCSS === true){
      this.updateStylesheets.call(this, tmpEl.querySelectorAll('link[rel=stylesheet]'), document.querySelectorAll('link[rel=stylesheet]'));
    }

    // FF bug: Won’t autofocus fields that are inserted via JS.
    // This behavior is incorrect. So if theres no current focus, autofocus
    // the last field.
    //
    // http://www.w3.org/html/wg/drafts/html/master/forms.html
    var autofocusEl = Array.prototype.slice.call(document.querySelectorAll("[autofocus]")).pop()
    if (autofocusEl && document.activeElement !== autofocusEl) {
      autofocusEl.focus();
    }

    // execute scripts when DOM have been completely updated
    this.options.selectors.forEach( function(selector) {
      forEachEls(document.querySelectorAll(selector), function(el) {

        collectForScriptcomplete.push.apply(collectForScriptcomplete, executeScripts.call(this, el));

      }, this);

    },this);
    // }
    // catch(e) {
    //   if (this.options.debug) {
    //     this.log("Pjax switch fail: ", e)
    //   }
    //   this.switchFallback(tmpEl, document)
    // }
    this.log("waiting for scriptcomplete",collectForScriptcomplete);

    //Fallback! If something can't be loaded or is not loaded correctly -> just force eventing in error
    var timeOutScriptEvent = null;
    timeOutScriptEvent = window.setTimeout( function(){
      trigger(document,"pjax:scriptcomplete pjax:scripttimeout", options)
      timeOutScriptEvent = null;
    }, this.options.scriptloadtimeout);

    Promise.all(collectForScriptcomplete).then(
      //resolved
      function(){
        if(timeOutScriptEvent !== null ){
          window.clearTimeout(timeOutScriptEvent);
          trigger(document,"pjax:scriptcomplete pjax:scriptsuccess", options)
        }
      },
      function(){
        if(timeOutScriptEvent !== null ){
          window.clearTimeout(timeOutScriptEvent);
          trigger(document,"pjax:scriptcomplete pjax:scripterror", options)
        }
      }
    );


  },

  doRequest: require("./lib/request.js"),

  loadUrl: function(href, options) {
    this.log("load href", href, options)

    trigger(document, "pjax:send", options);

    // Do the request
    this.doRequest(href, options.requestOptions, function(html, requestData) {
      // Fail if unable to load HTML via AJAX
      if (html === false || requestData.status !== 200) {
        trigger(document,"pjax:complete pjax:error", {options: options, requestData: requestData, href: href});
        return options.pjaxErrorHandler(href, options, requestData);
      }

      // Clear out any focused controls before inserting new page contents.
      document.activeElement.blur()

      try {
        this.loadContent(html, options)
      }
      catch (e) {
        if (!this.options.debug) {
          if (console && this.options.logObject.error) {
            this.options.logObject.error("Pjax switch fail: ", e)
          }
          return options.pjaxErrorHandler(href, options, requestData) || this.latestChance(href);
        }
        else {
          if (this.options.forceRedirectOnFail) {
            return options.pjaxErrorHandler(href, options, requestData) || this.latestChance(href);
          }
          throw e;
        }
      }

      if (options.history) {
        if (this.firstrun) {
          this.lastUid = this.maxUid = newUid()
          this.firstrun = false
          window.history.replaceState({
            url: window.location.href,
            title: document.title,
            uid: this.maxUid
          },
          document.title)
        }

        // Update browser history
        this.lastUid = this.maxUid = newUid()
        window.history.pushState({
          url: href,
          title: options.title,
          uid: this.maxUid
        },
          options.title,
          href)
      }

      this.forEachSelectors(function(el) {
        this.parseDOM(el)
      }, this)

      // Fire Events
      trigger(document,"pjax:complete pjax:success", options)

      options.analytics()

      // Scroll page to top on new page load
      if (options.scrollTo !== false) {
        if (options.scrollTo.length > 1) {
          window.scrollTo(options.scrollTo[0], options.scrollTo[1])
        }
        else {
          window.scrollTo(0, options.scrollTo)
        }
      }
    }.bind(this))
  }
}

Pjax.isSupported = require("./lib/is-supported.js");

//arguably could do `if( require("./lib/is-supported.js")()) {` but that might be a little to simple
if (Pjax.isSupported()) {
  module.exports = Pjax
}
// if there isn’t required browser functions, returning stupid api
else {
  var stupidPjax = function() {}
  for (var key in Pjax.prototype) {
    if (Pjax.prototype.hasOwnProperty(key) && typeof Pjax.prototype[key] === "function") {
      stupidPjax[key] = stupidPjax
    }
  }

  module.exports = stupidPjax
}

},{"./lib/clone.js":2,"./lib/events/on.js":5,"./lib/events/trigger.js":6,"./lib/execute-scripts.js":7,"./lib/foreach-els.js":8,"./lib/foreach-selectors.js":9,"./lib/is-supported.js":10,"./lib/proto/attach-form.js":12,"./lib/proto/attach-link.js":13,"./lib/proto/get-elements.js":14,"./lib/proto/log.js":15,"./lib/proto/parse-dom-unload.js":16,"./lib/proto/parse-dom.js":17,"./lib/proto/parse-options.js":20,"./lib/proto/refresh.js":21,"./lib/proto/unattach-form.js":22,"./lib/proto/unattach-link.js":23,"./lib/reload.js":24,"./lib/request.js":25,"./lib/switches-selectors.js":26,"./lib/uniqueid.js":28,"./lib/update-stylesheets.js":29}],2:[function(require,module,exports){
module.exports = function(obj) {
  if (null === obj || "object" != typeof obj) {
    return obj
  }
  var copy = obj.constructor()
  for (var attr in obj) {
    if (obj.hasOwnProperty(attr)) {
      copy[attr] = obj[attr]
    }
  }
  return copy
}

},{}],3:[function(require,module,exports){
module.exports = function(el) {
  var querySelector = this.options.mainScriptElement;
  var code = (el.text || el.textContent || el.innerHTML || "")
  var src = (el.src || "");
  var parent = el.parentNode || document.querySelector(querySelector) || document.documentElement
  var script = document.createElement("script")
  var promise = null;

  this.log("Evaluating Script: ", el);

  if (code.match("document.write")) {
    if (console && this.options.logObject.log) {
      this.options.logObject.log("Script contains document.write. Can’t be executed correctly. Code skipped ", el)
    }
    return false
  }

  promise = new Promise( function(resolve, reject){

    script.type = "text/javascript"
    if (src != "") {
      script.src = src;
      script.addEventListener('load', function(){resolve(src);} );
      script.async = true; // force asynchronous loading of peripheral js
    }

    if (code != "") {
      try {
        script.appendChild(document.createTextNode(code))
      }
      catch (e) {
        // old IEs have funky script nodes
        script.text = code
      }
      resolve('text-node');
    }
  });

  this.log('ParentElement => ', parent );

  // execute
  parent.appendChild(script);
  parent.removeChild(script)
  // avoid pollution only in head or body tags
  // of if the setting removeScriptsAfterParsing is active
  if( (["head","body"].indexOf( parent.tagName.toLowerCase()) > 0) || (this.options.removeScriptsAfterParsing === true) ) {
  }

  return promise;
}

},{}],4:[function(require,module,exports){
var forEachEls = require("../foreach-els")

module.exports = function(els, events, listener, useCapture) {
  events = (typeof events === "string" ? events.split(" ") : events)

  events.forEach(function(e) {
    forEachEls(els, function(el) {
      el.removeEventListener(e, listener, useCapture)
    })
  })
}

},{"../foreach-els":8}],5:[function(require,module,exports){
var forEachEls = require("../foreach-els")

module.exports = function(els, events, listener, useCapture) {
  events = (typeof events === "string" ? events.split(" ") : events)

  events.forEach(function(e) {
    forEachEls(els, function(el) {
      el.addEventListener(e, listener, useCapture)
    })
  })
}

},{"../foreach-els":8}],6:[function(require,module,exports){
var forEachEls = require("../foreach-els")

module.exports = function(els, events, opts) {
  events = (typeof events === "string" ? events.split(" ") : events)

  events.forEach(function(e) {
    var event // = new CustomEvent(e) // doesn't everywhere yet
    event = document.createEvent("HTMLEvents")
    event.initEvent(e, true, true)
    event.eventName = e
    if (opts) {
      Object.keys(opts).forEach(function(key) {
        event[key] = opts[key]
      })
    }

    forEachEls(els, function(el) {
      var domFix = false
      if (!el.parentNode && el !== document && el !== window) {
        // THANKS YOU IE (9/10//11 concerned)
        // dispatchEvent doesn't work if element is not in the dom
        domFix = true
        document.body.appendChild(el)
      }
      el.dispatchEvent(event)
      if (domFix) {
        el.parentNode.removeChild(el)
      }
    })
  })
}

},{"../foreach-els":8}],7:[function(require,module,exports){
var forEachEls = require("./foreach-els")
var evalScript = require("./eval-script")
// Finds and executes scripts (used for newly added elements)
// Needed since innerHTML does not run scripts
module.exports = function(el) {

  this.log("Executing scripts for ", el);

  var loadingScripts = [];

  if(el === undefined) return Promise.resolve();

  if (el.tagName.toLowerCase() === "script") {
    evalScript.call(this, el);
  }

  forEachEls(el.querySelectorAll("script"), function(script) {
    if (!script.type || script.type.toLowerCase() === "text/javascript") {
      // if (script.parentNode) {
      //   script.parentNode.removeChild(script)
      // }
      loadingScripts.push(evalScript.call(this, script));
    }
  }, this);

  return loadingScripts;
}

},{"./eval-script":3,"./foreach-els":8}],8:[function(require,module,exports){
/* global HTMLCollection: true */

module.exports = function(els, fn, context) {
  if (els instanceof HTMLCollection || els instanceof NodeList || els instanceof Array) {
    return Array.prototype.forEach.call(els, fn, context)
  }
  // assume simple dom element
  return fn.call(context, els)
}

},{}],9:[function(require,module,exports){
var forEachEls = require("./foreach-els")

module.exports = function(selectors, cb, context, DOMcontext) {
  DOMcontext = DOMcontext || document
  selectors.forEach(function(selector) {
    forEachEls(DOMcontext.querySelectorAll(selector), cb, context)
  })
}

},{"./foreach-els":8}],10:[function(require,module,exports){
module.exports = function() {
  // Borrowed wholesale from https://github.com/defunkt/jquery-pjax
  return window.history &&
    window.history.pushState &&
    window.history.replaceState &&
    // pushState isn’t reliable on iOS until 5.
    !navigator.userAgent.match(/((iPod|iPhone|iPad).+\bOS\s+[1-4]\D|WebApps\/.+CFNetwork)/)
}

},{}],11:[function(require,module,exports){
if (!Function.prototype.bind) {
  Function.prototype.bind = function(oThis) {
    if (typeof this !== "function") {
      // closest thing possible to the ECMAScript 5 internal IsCallable function
      throw new TypeError("Function.prototype.bind - what is trying to be bound is not callable")
    }

    var aArgs = Array.prototype.slice.call(arguments, 1)
    var that = this
    var Fnoop = function() {}
    var fBound = function() {
      return that.apply(this instanceof Fnoop && oThis ? this : oThis, aArgs.concat(Array.prototype.slice.call(arguments)))
    }

    Fnoop.prototype = this.prototype
    fBound.prototype = new Fnoop()

    return fBound
  }
}

},{}],12:[function(require,module,exports){
require("../polyfills/Function.prototype.bind")

var on = require("../events/on")
var clone = require("../clone")

var attrClick = "data-pjax-submit-state"

var formAction = function(el, event){

  this.options.requestOptions = {
    requestUrl : el.getAttribute('action') || window.location.href,
    requestMethod : el.getAttribute('method') || 'GET',
  }

  //create a testable virtual link of the form action
  var virtLinkElement = document.createElement('a');
  virtLinkElement.setAttribute('href', this.options.requestOptions.requestUrl);

  // Ignore external links.
  if (virtLinkElement.protocol !== window.location.protocol || virtLinkElement.host !== window.location.host) {
    el.setAttribute(attrClick, "external");
    return
  }

  // Ignore click if we are on an anchor on the same page
  if (virtLinkElement.pathname === window.location.pathname && virtLinkElement.hash.length > 0) {
    el.setAttribute(attrClick, "anchor-present");
    return
  }

  // Ignore empty anchor "foo.html#"
  if (virtLinkElement.href === window.location.href.split("#")[0] + "#") {
    el.setAttribute(attrClick, "anchor-empty")
    return
  }

  // if declared as a full reload, just normally submit the form
  if ( this.options.currentUrlFullReload) {
    el.setAttribute(attrClick, "reload");
    return;
  }

  event.preventDefault()
  var nameList = [];
  var paramObject = [];
  for(var elementKey in el.elements) {
    var element = el.elements[elementKey];
    if (!!element.name && element.attributes !== undefined && element.tagName.toLowerCase() !== 'button'){
      
      if (
        (element.type !== 'checkbox' && element.type !== 'radio') || element.checked
      ) {
        if(nameList.indexOf(element.name) === -1){
          nameList.push(element.name);
          
          if (String(element.nodeName).toLowerCase() === 'select' && element.multiple == true) {
            var selected = Array.from(element.options).map(function(item,i) { return (item.selected ? item.value : null) });
            paramObject.push({ name: encodeURIComponent(element.name), value: selected});
            return;
          } 

          paramObject.push({ name: encodeURIComponent(element.name), value: encodeURIComponent(element.value)});
          
        }

      }
    }
  }



  //Creating a getString
  var paramsString = (paramObject.map(function(value){return value.name+"="+value.value;})).join('&');

  this.options.requestOptions.requestPayload = paramObject;
  this.options.requestOptions.requestPayloadString = paramsString;

  el.setAttribute(attrClick, "submit");

  this.loadUrl(virtLinkElement.href, clone(this.options))

};

var isDefaultPrevented = function(event) {
  return event.defaultPrevented || event.returnValue === false;
};


module.exports = function(el) {
  var that = this

  on(el, "submit", function(event) {
    if (isDefaultPrevented(event)) {
      return
    }

    formAction.call(that, el, event)
  })
}

},{"../clone":2,"../events/on":5,"../polyfills/Function.prototype.bind":11}],13:[function(require,module,exports){
require("../polyfills/Function.prototype.bind")

var on = require("../events/on")
var clone = require("../clone")

var attrClick = "data-pjax-click-state"
var attrKey = "data-pjax-keyup-state"

var linkAction = function(el, event) {
  // Don’t break browser special behavior on links (like page in new window)
  if (event.which > 1 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    el.setAttribute(attrClick, "modifier")
    return
  }

  // we do test on href now to prevent unexpected behavior if for some reason
  // user have href that can be dynamically updated

  // Ignore external links.
  if (el.protocol !== window.location.protocol || el.host !== window.location.host) {
    el.setAttribute(attrClick, "external")
    return
  }

  // Ignore click if we are on an anchor on the same page
  if (el.pathname === window.location.pathname && el.hash.length > 0) {
    el.setAttribute(attrClick, "anchor-present")
    return
  }

  // Ignore anchors on the same page (keep native behavior)
  if (el.hash && el.href.replace(el.hash, "") === window.location.href.replace(location.hash, "")) {
    el.setAttribute(attrClick, "anchor")
    return
  }

  // Ignore empty anchor "foo.html#"
  if (el.href === window.location.href.split("#")[0] + "#") {
    el.setAttribute(attrClick, "anchor-empty")
    return
  }

  event.preventDefault()

  // don’t do "nothing" if user try to reload the page by clicking the same link twice
  if (
    this.options.currentUrlFullReload &&
    el.href === window.location.href.split("#")[0]
  ) {
    el.setAttribute(attrClick, "reload")
    this.reload()
    return
  }
  this.options.requestOptions = this.options.requestOptions || {};
  el.setAttribute(attrClick, "load")
  this.loadUrl(el.href, clone(this.options))
}

var isDefaultPrevented = function(event) {
  return event.defaultPrevented || event.returnValue === false;
}

module.exports = function(el) {
  var that = this

  on(el, "click", function(event) {
    if (isDefaultPrevented(event)) {
      return
    }

    linkAction.call(that, el, event)
  })

  on(el, "keyup", function(event) {
    if (isDefaultPrevented(event)) {
      return
    }

    // Don’t break browser special behavior on links (like page in new window)
    if (event.which > 1 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      el.setAttribute(attrKey, "modifier")
      return
    }

    if (event.keyCode == 13) {
      linkAction.call(that, el, event)
    }
  }.bind(this))
}

},{"../clone":2,"../events/on":5,"../polyfills/Function.prototype.bind":11}],14:[function(require,module,exports){
module.exports = function(el) {
  return el.querySelectorAll(this.options.elements)
}

},{}],15:[function(require,module,exports){
module.exports = function() {
  if ((this.options.debug && this.options.logObject)) {
    if (typeof this.options.logObject.log === "function") {
      this.options.logObject.log.apply(this.options.logObject, ['PJAX ->',arguments]);
    }
    // ie is weird
    else if (this.options.logObject.log) {
      this.options.logObject.log(['PJAX ->',arguments]);
    }
  }
}

},{}],16:[function(require,module,exports){
var forEachEls = require("../foreach-els")

var parseElementUnload = require("./parse-element-unload")

module.exports = function(el) {
  forEachEls(this.getElements(el), parseElementUnload, this)
}

},{"../foreach-els":8,"./parse-element-unload":18}],17:[function(require,module,exports){
var forEachEls = require("../foreach-els")

var parseElement = require("./parse-element")

module.exports = function(el) {
  forEachEls(this.getElements(el), parseElement, this)
}

},{"../foreach-els":8,"./parse-element":19}],18:[function(require,module,exports){
module.exports = function(el) {
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
}

},{}],19:[function(require,module,exports){
module.exports = function(el) {
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
}

},{}],20:[function(require,module,exports){
/* global _gaq: true, ga: true */

module.exports = function(options){
  this.options = options
  this.options.elements = this.options.elements || "a[href], form[action]",
  this.options.reRenderCSS = this.options.reRenderCSS || false,
  this.options.forceRedirectOnFail = this.options.forceRedirectOnFail || false,
  this.options.scriptloadtimeout = this.options.scriptloadtimeout || 1000,
  this.options.mainScriptElement = this.options.mainScriptElement || "head"
  this.options.removeScriptsAfterParsing = this.options.removeScriptsAfterParsing || true
  this.options.logObject = this.options.logObject || console
  this.options.latestChance = this.options.latestChance || null
  this.options.selectors = this.options.selectors || ["title", ".js-Pjax"]
  this.options.switches = this.options.switches || {}
  this.options.switchesOptions = this.options.switchesOptions || {}
  this.options.history = this.options.history || true
  this.options.onDomDiffers = this.options.onDomDiffers || function(oldDom, newDom){
    return true;
  }
  this.options.pjaxErrorHandler = this.options.pjaxErrorHandler || function(href, options, requestData){
    return false;
  }
  this.options.onJsonDocument = this.options.onJsonDocument || function(jsonDocument){
    return true;
  }
  this.options.analytics = this.options.analytics || function() {
    // options.backward or options.foward can be true or undefined
    // by default, we do track back/foward hit
    // https://productforums.google.com/forum/#!topic/analytics/WVwMDjLhXYk
    if (window._gaq) {
      _gaq.push(["_trackPageview"])
    }
    if (window.ga) {
      ga("send", "pageview", {page: location.pathname, title: document.title})
    }
  }
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
    options.analytics = function() {}
  }
}

},{}],21:[function(require,module,exports){
module.exports = function(el) {
  this.parseDOM(el || document)
}

},{}],22:[function(require,module,exports){
require("../polyfills/Function.prototype.bind")

var off = require("../events/off")
var clone = require("../clone")

var attrClick = "data-pjax-click-state"

var formAction = function(el, event){

  this.options.requestOptions = {
    requestUrl : el.getAttribute('action') || window.location.href,
    requestMethod : el.getAttribute('method') || 'GET',
  }

  //create a testable virtual link of the form action
  var virtLinkElement = document.createElement('a');
  virtLinkElement.setAttribute('href', this.options.requestOptions.requestUrl);

  // Ignore external links.
  if (virtLinkElement.protocol !== window.location.protocol || virtLinkElement.host !== window.location.host) {
    el.setAttribute(attrClick, "external");
    return
  }

  // Ignore click if we are on an anchor on the same page
  if (virtLinkElement.pathname === window.location.pathname && virtLinkElement.hash.length > 0) {
    el.setAttribute(attrClick, "anchor-present");
    return
  }

  // Ignore empty anchor "foo.html#"
  if (virtLinkElement.href === window.location.href.split("#")[0] + "#") {
    el.setAttribute(attrClick, "anchor-empty")
    return
  }

  // if declared as a full reload, just normally submit the form
  if ( this.options.currentUrlFullReload) {
    el.setAttribute(attrClick, "reload");
    return;
  }

  event.preventDefault()
  var nameList = [];
  var paramObject = [];
  for(var elementKey in el.elements) {
    var element = el.elements[elementKey];
    if (!!element.name && element.attributes !== undefined && element.tagName.toLowerCase() !== 'button'){
      if (
        (element.type !== 'checkbox' && element.type !== 'radio') || element.checked
      ) {
        if(nameList.indexOf(element.name) === -1){
          nameList.push(element.name);
          paramObject.push({ name: encodeURIComponent(element.name), value: encodeURIComponent(element.value)});
        }
      }
    }
  }



  //Creating a getString
  var paramsString = (paramObject.map(function(value){return value.name+"="+value.value;})).join('&');

  this.options.requestOptions.requestPayload = paramObject;
  this.options.requestOptions.requestPayloadString = paramsString;

  el.setAttribute(attrClick, "submit");

  this.loadUrl(virtLinkElement.href, clone(this.options))

};

var isDefaultPrevented = function(event) {
  return event.defaultPrevented || event.returnValue === false;
};


module.exports = function(el) {
  var that = this

  off(el, "submit", function(event) {
    if (isDefaultPrevented(event)) {
      return
    }

    formAction.call(that, el, event)
  })

  off(el, "keyup", function(event) {
    if (isDefaultPrevented(event)) {
      return
    }


    if (event.keyCode == 13) {
      formAction.call(that, el, event)
    }
  }.bind(this))
}

},{"../clone":2,"../events/off":4,"../polyfills/Function.prototype.bind":11}],23:[function(require,module,exports){
require("../polyfills/Function.prototype.bind")

var off = require("../events/off")
var clone = require("../clone")

var attrClick = "data-pjax-click-state"
var attrKey = "data-pjax-keyup-state"

var linkAction = function(el, event) {
  // Don’t break browser special behavior on links (like page in new window)
  if (event.which > 1 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    el.setAttribute(attrClick, "modifier")
    return
  }

  // we do test on href now to prevent unexpected behavior if for some reason
  // user have href that can be dynamically updated

  // Ignore external links.
  if (el.protocol !== window.location.protocol || el.host !== window.location.host) {
    el.setAttribute(attrClick, "external")
    return
  }

  // Ignore click if we are on an anchor on the same page
  if (el.pathname === window.location.pathname && el.hash.length > 0) {
    el.setAttribute(attrClick, "anchor-present")
    return
  }

  // Ignore anchors on the same page (keep native behavior)
  if (el.hash && el.href.replace(el.hash, "") === window.location.href.replace(location.hash, "")) {
    el.setAttribute(attrClick, "anchor")
    return
  }

  // Ignore empty anchor "foo.html#"
  if (el.href === window.location.href.split("#")[0] + "#") {
    el.setAttribute(attrClick, "anchor-empty")
    return
  }

  event.preventDefault()

  // don’t do "nothing" if user try to reload the page by clicking the same link twice
  if (
    this.options.currentUrlFullReload &&
    el.href === window.location.href.split("#")[0]
  ) {
    el.setAttribute(attrClick, "reload")
    this.reload()
    return
  }
  this.options.requestOptions = this.options.requestOptions || {};
  el.setAttribute(attrClick, "load")
  this.loadUrl(el.href, clone(this.options))
}

var isDefaultPrevented = function(event) {
  return event.defaultPrevented || event.returnValue === false;
}

module.exports = function(el) {
  var that = this

  off(el, "click", function(event) {
    if (isDefaultPrevented(event)) {
      return
    }

    linkAction.call(that, el, event)
  })

  off(el, "keyup", function(event) {
    if (isDefaultPrevented(event)) {
      return
    }

    // Don’t break browser special behavior on links (like page in new window)
    if (event.which > 1 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      el.setAttribute(attrKey, "modifier")
      return
    }

    if (event.keyCode == 13) {
      linkAction.call(that, el, event)
    }
  }.bind(this))
}

},{"../clone":2,"../events/off":4,"../polyfills/Function.prototype.bind":11}],24:[function(require,module,exports){
module.exports = function() {
  window.location.reload()
}

},{}],25:[function(require,module,exports){
module.exports = function(location, options, callback) {
  options = options || {};
  var requestMethod = options.requestMethod || "GET";
  var requestPayload = options.requestPayloadString || null;
  var request = new XMLHttpRequest()

  request.onreadystatechange = function() {
    if (request.readyState === 4) {
      if (request.status === 200) {
        callback(request.responseText, request)
      }
      else {
        callback(null, request)
      }
    }
  }

  // Add a timestamp as part of the query string if cache busting is enabled
  if (this.options.cacheBust) {
    location += (!/[?&]/.test(location) ? "?" : "&") + new Date().getTime()
  }

  request.open(requestMethod.toUpperCase(), location, true)
  request.setRequestHeader("X-Requested-With", "XMLHttpRequest")

  // Add the request payload if available
  if (options.requestPayloadString != undefined && options.requestPayloadString != "") {
    // Send the proper header information along with the request
    request.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
  }

  request.send(requestPayload)

  return request
}

},{}],26:[function(require,module,exports){
var forEachEls = require("./foreach-els")

var defaultSwitches = require("./switches")

module.exports = function(switches, switchesOptions, selectors, fromEl, toEl, options) {
  selectors.forEach(function(selector) {
    var newEls = fromEl.querySelectorAll(selector)
    var oldEls = toEl.querySelectorAll(selector)
    if (this.log) {
      this.log("Pjax switch", selector, newEls, oldEls)
    }
    if (newEls.length !== oldEls.length) {
      var throwError = options.onDomDiffers(toEl, fromEl);
      if(throwError) {
        throw "DOM doesn’t look the same on new loaded page: ’" + selector + "’ - new " + newEls.length + ", old " + oldEls.length;
      }
    }

    forEachEls(newEls, function(newEl, i) {
      var oldEl = oldEls[i]
      if (this.log) {
        this.log("newEl", newEl, "oldEl", oldEl)
      }
      if (switches[selector]) {
        switches[selector].bind(this)(oldEl, newEl, options, switchesOptions[selector])
      }
      else {
        defaultSwitches.outerHTML.bind(this)(oldEl, newEl, options)
      }
    }, this)
  }, this)
}

},{"./foreach-els":8,"./switches":27}],27:[function(require,module,exports){
var on = require("./events/on.js")
// var off = require("./lib/events/on.js")
// var trigger = require("./lib/events/trigger.js")


module.exports = {
  outerHTML: function(oldEl, newEl) {
    oldEl.outerHTML = newEl.outerHTML
    this.onSwitch()
  },

  innerHTML: function(oldEl, newEl) {
    oldEl.innerHTML = newEl.innerHTML
    oldEl.className = newEl.className
    this.onSwitch()
  },

  sideBySide: function(oldEl, newEl, options, switchOptions) {
    var forEach = Array.prototype.forEach
    var elsToRemove = []
    var elsToAdd = []
    var fragToAppend = document.createDocumentFragment()
    // height transition are shitty on safari
    // so commented for now (until I found something ?)
    // var relevantHeight = 0
    var animationEventNames = "animationend webkitAnimationEnd MSAnimationEnd oanimationend"
    var animatedElsNumber = 0
    var sexyAnimationEnd = function(e) {
          if (e.target != e.currentTarget) {
            // end triggered by an animation on a child
            return
          }

          animatedElsNumber--
          if (animatedElsNumber <= 0 && elsToRemove) {
            elsToRemove.forEach(function(el) {
              // browsing quickly can make the el
              // already removed by last page update ?
              if (el.parentNode) {
                el.parentNode.removeChild(el)
              }
            })

            elsToAdd.forEach(function(el) {
              el.className = el.className.replace(el.getAttribute("data-pjax-classes"), "")
              el.removeAttribute("data-pjax-classes")
              // Pjax.off(el, animationEventNames, sexyAnimationEnd, true)
            })

            elsToAdd = null // free memory
            elsToRemove = null // free memory

            // assume the height is now useless (avoid bug since there is overflow hidden on the parent)
            // oldEl.style.height = "auto"

            // this is to trigger some repaint (example: picturefill)
            this.onSwitch()
            // Pjax.trigger(window, "scroll")
          }
        }.bind(this)

    // Force height to be able to trigger css animation
    // here we get the relevant height
    // oldEl.parentNode.appendChild(newEl)
    // relevantHeight = newEl.getBoundingClientRect().height
    // oldEl.parentNode.removeChild(newEl)
    // oldEl.style.height = oldEl.getBoundingClientRect().height + "px"

    switchOptions = switchOptions || {}

    forEach.call(oldEl.childNodes, function(el) {
      elsToRemove.push(el)
      if (el.classList && !el.classList.contains("js-Pjax-remove")) {
        // for fast switch, clean element that just have been added, & not cleaned yet.
        if (el.hasAttribute("data-pjax-classes")) {
          el.className = el.className.replace(el.getAttribute("data-pjax-classes"), "")
          el.removeAttribute("data-pjax-classes")
        }
        el.classList.add("js-Pjax-remove")
        if (switchOptions.callbacks && switchOptions.callbacks.removeElement) {
          switchOptions.callbacks.removeElement(el)
        }
        if (switchOptions.classNames) {
          el.className += " " + switchOptions.classNames.remove + " " + (options.backward ? switchOptions.classNames.backward : switchOptions.classNames.forward)
        }
        animatedElsNumber++
        on(el, animationEventNames, sexyAnimationEnd, true)
      }
    })

    forEach.call(newEl.childNodes, function(el) {
      if (el.classList) {
        var addClasses = ""
        if (switchOptions.classNames) {
          addClasses = " js-Pjax-add " + switchOptions.classNames.add + " " + (options.backward ? switchOptions.classNames.forward : switchOptions.classNames.backward)
        }
        if (switchOptions.callbacks && switchOptions.callbacks.addElement) {
          switchOptions.callbacks.addElement(el)
        }
        el.className += addClasses
        el.setAttribute("data-pjax-classes", addClasses)
        elsToAdd.push(el)
        fragToAppend.appendChild(el)
        animatedElsNumber++
        on(el, animationEventNames, sexyAnimationEnd, true)
      }
    })

    // pass all className of the parent
    oldEl.className = newEl.className
    oldEl.appendChild(fragToAppend)

    // oldEl.style.height = relevantHeight + "px"
  }
}

},{"./events/on.js":5}],28:[function(require,module,exports){
module.exports = (function() {
  var counter = 0
  return function() {
    var id = ("pjax" + (new Date().getTime())) + "_" + counter
    counter++
    return id
  }
})()

},{}],29:[function(require,module,exports){
var forEachEls = require("./foreach-els")

module.exports = function(elements, oldElements) {
   this.log("styleheets old elements", oldElements);
   this.log("styleheets new elements", elements);
  var toArray = function(enumerable){
      var arr = [];
      for(var i = enumerable.length; i--; arr.unshift(enumerable[i]));
      return arr;
  };
  forEachEls(elements, function(newEl, i) {
    var oldElementsArray = toArray(oldElements);
    var resemblingOld = oldElementsArray.reduce(function(acc, oldEl){
      acc = ((oldEl.href === newEl.href) ? oldEl : acc);
      return acc;
    }, null);

    if(resemblingOld !== null){
      if (this.log) {
        this.log("old stylesheet found not resetting");
      }
    } else {
      if (this.log) {
        this.log("new stylesheet => add to head");
      }
      var head = document.getElementsByTagName( 'head' )[0],
       link = document.createElement( 'link' );
        link.setAttribute( 'href', newEl.href );
        link.setAttribute( 'rel', 'stylesheet' );
        link.setAttribute( 'type', 'text/css' );
        head.appendChild(link);
    }
  }, this);

}

},{"./foreach-els":8}]},{},[1])(1)
});

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsImxpYi9jbG9uZS5qcyIsImxpYi9ldmFsLXNjcmlwdC5qcyIsImxpYi9ldmVudHMvb2ZmLmpzIiwibGliL2V2ZW50cy9vbi5qcyIsImxpYi9ldmVudHMvdHJpZ2dlci5qcyIsImxpYi9leGVjdXRlLXNjcmlwdHMuanMiLCJsaWIvZm9yZWFjaC1lbHMuanMiLCJsaWIvZm9yZWFjaC1zZWxlY3RvcnMuanMiLCJsaWIvaXMtc3VwcG9ydGVkLmpzIiwibGliL3BvbHlmaWxscy9GdW5jdGlvbi5wcm90b3R5cGUuYmluZC5qcyIsImxpYi9wcm90by9hdHRhY2gtZm9ybS5qcyIsImxpYi9wcm90by9hdHRhY2gtbGluay5qcyIsImxpYi9wcm90by9nZXQtZWxlbWVudHMuanMiLCJsaWIvcHJvdG8vbG9nLmpzIiwibGliL3Byb3RvL3BhcnNlLWRvbS11bmxvYWQuanMiLCJsaWIvcHJvdG8vcGFyc2UtZG9tLmpzIiwibGliL3Byb3RvL3BhcnNlLWVsZW1lbnQtdW5sb2FkLmpzIiwibGliL3Byb3RvL3BhcnNlLWVsZW1lbnQuanMiLCJsaWIvcHJvdG8vcGFyc2Utb3B0aW9ucy5qcyIsImxpYi9wcm90by9yZWZyZXNoLmpzIiwibGliL3Byb3RvL3VuYXR0YWNoLWZvcm0uanMiLCJsaWIvcHJvdG8vdW5hdHRhY2gtbGluay5qcyIsImxpYi9yZWxvYWQuanMiLCJsaWIvcmVxdWVzdC5qcyIsImxpYi9zd2l0Y2hlcy1zZWxlY3RvcnMuanMiLCJsaWIvc3dpdGNoZXMuanMiLCJsaWIvdW5pcXVlaWQuanMiLCJsaWIvdXBkYXRlLXN0eWxlc2hlZXRzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNVNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25HQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekZBO0FBQ0E7QUFDQTtBQUNBOztBQ0hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3REQTtBQUNBO0FBQ0E7QUFDQTs7QUNIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekZBO0FBQ0E7QUFDQTtBQUNBOztBQ0hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25IQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiByKGUsbix0KXtmdW5jdGlvbiBvKGksZil7aWYoIW5baV0pe2lmKCFlW2ldKXt2YXIgYz1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFmJiZjKXJldHVybiBjKGksITApO2lmKHUpcmV0dXJuIHUoaSwhMCk7dmFyIGE9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitpK1wiJ1wiKTt0aHJvdyBhLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsYX12YXIgcD1uW2ldPXtleHBvcnRzOnt9fTtlW2ldWzBdLmNhbGwocC5leHBvcnRzLGZ1bmN0aW9uKHIpe3ZhciBuPWVbaV1bMV1bcl07cmV0dXJuIG8obnx8cil9LHAscC5leHBvcnRzLHIsZSxuLHQpfXJldHVybiBuW2ldLmV4cG9ydHN9Zm9yKHZhciB1PVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmUsaT0wO2k8dC5sZW5ndGg7aSsrKW8odFtpXSk7cmV0dXJuIG99cmV0dXJuIHJ9KSgpIiwidmFyIGNsb25lID0gcmVxdWlyZSgnLi9saWIvY2xvbmUuanMnKVxyXG52YXIgZXhlY3V0ZVNjcmlwdHMgPSByZXF1aXJlKCcuL2xpYi9leGVjdXRlLXNjcmlwdHMuanMnKVxyXG52YXIgZm9yRWFjaEVscyA9IHJlcXVpcmUoXCIuL2xpYi9mb3JlYWNoLWVscy5qc1wiKVxyXG52YXIgbmV3VWlkID0gcmVxdWlyZShcIi4vbGliL3VuaXF1ZWlkLmpzXCIpXHJcblxyXG52YXIgb24gPSByZXF1aXJlKFwiLi9saWIvZXZlbnRzL29uLmpzXCIpXHJcbi8vIHZhciBvZmYgPSByZXF1aXJlKFwiLi9saWIvZXZlbnRzL29uLmpzXCIpXHJcbnZhciB0cmlnZ2VyID0gcmVxdWlyZShcIi4vbGliL2V2ZW50cy90cmlnZ2VyLmpzXCIpXHJcblxyXG5cclxudmFyIFBqYXggPSBmdW5jdGlvbihvcHRpb25zKSB7XHJcbiAgICB0aGlzLmZpcnN0cnVuID0gdHJ1ZVxyXG5cclxuICAgIHZhciBwYXJzZU9wdGlvbnMgPSByZXF1aXJlKFwiLi9saWIvcHJvdG8vcGFyc2Utb3B0aW9ucy5qc1wiKTtcclxuICAgIHBhcnNlT3B0aW9ucy5hcHBseSh0aGlzLFtvcHRpb25zXSlcclxuICAgIHRoaXMubG9nKFwiUGpheCBvcHRpb25zXCIsIHRoaXMub3B0aW9ucylcclxuXHJcbiAgICB0aGlzLm1heFVpZCA9IHRoaXMubGFzdFVpZCA9IG5ld1VpZCgpXHJcblxyXG4gICAgdGhpcy5wYXJzZURPTShkb2N1bWVudClcclxuXHJcbiAgICBvbih3aW5kb3csIFwicG9wc3RhdGVcIiwgZnVuY3Rpb24oc3QpIHtcclxuICAgICAgaWYgKHN0LnN0YXRlKSB7XHJcbiAgICAgICAgdmFyIG9wdCA9IGNsb25lKHRoaXMub3B0aW9ucylcclxuICAgICAgICBvcHQudXJsID0gc3Quc3RhdGUudXJsXHJcbiAgICAgICAgb3B0LnRpdGxlID0gc3Quc3RhdGUudGl0bGVcclxuICAgICAgICBvcHQuaGlzdG9yeSA9IGZhbHNlXHJcbiAgICAgICAgb3B0LnJlcXVlc3RPcHRpb25zID0ge307XHJcbiAgICAgICAgaWYgKHN0LnN0YXRlLnVpZCA8IHRoaXMubGFzdFVpZCkge1xyXG4gICAgICAgICAgb3B0LmJhY2t3YXJkID0gdHJ1ZVxyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgIG9wdC5mb3J3YXJkID0gdHJ1ZVxyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLmxhc3RVaWQgPSBzdC5zdGF0ZS51aWRcclxuXHJcbiAgICAgICAgLy8gQHRvZG8gaW1wbGVtZW50IGhpc3RvcnkgY2FjaGUgaGVyZSwgYmFzZWQgb24gdWlkXHJcbiAgICAgICAgdGhpcy5sb2FkVXJsKHN0LnN0YXRlLnVybCwgb3B0KVxyXG4gICAgICB9XHJcbiAgICB9LmJpbmQodGhpcykpO1xyXG5cclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcblBqYXgucHJvdG90eXBlID0ge1xyXG4gIGxvZzogcmVxdWlyZShcIi4vbGliL3Byb3RvL2xvZy5qc1wiKSxcclxuXHJcbiAgZ2V0RWxlbWVudHM6IHJlcXVpcmUoXCIuL2xpYi9wcm90by9nZXQtZWxlbWVudHMuanNcIiksXHJcblxyXG4gIHBhcnNlRE9NOiByZXF1aXJlKFwiLi9saWIvcHJvdG8vcGFyc2UtZG9tLmpzXCIpLFxyXG5cclxuICBwYXJzZURPTXRvVW5sb2FkOiByZXF1aXJlKFwiLi9saWIvcHJvdG8vcGFyc2UtZG9tLXVubG9hZC5qc1wiKSxcclxuXHJcbiAgcmVmcmVzaDogcmVxdWlyZShcIi4vbGliL3Byb3RvL3JlZnJlc2guanNcIiksXHJcblxyXG4gIHJlbG9hZDogcmVxdWlyZShcIi4vbGliL3JlbG9hZC5qc1wiKSxcclxuXHJcbiAgYXR0YWNoTGluazogcmVxdWlyZShcIi4vbGliL3Byb3RvL2F0dGFjaC1saW5rLmpzXCIpLFxyXG5cclxuICBhdHRhY2hGb3JtOiByZXF1aXJlKFwiLi9saWIvcHJvdG8vYXR0YWNoLWZvcm0uanNcIiksXHJcblxyXG4gIHVuYXR0YWNoTGluazogcmVxdWlyZShcIi4vbGliL3Byb3RvL3VuYXR0YWNoLWxpbmsuanNcIiksXHJcblxyXG4gIHVuYXR0YWNoRm9ybTogcmVxdWlyZShcIi4vbGliL3Byb3RvL3VuYXR0YWNoLWZvcm0uanNcIiksXHJcblxyXG4gIHVwZGF0ZVN0eWxlc2hlZXRzOiByZXF1aXJlKFwiLi9saWIvdXBkYXRlLXN0eWxlc2hlZXRzLmpzXCIpLFxyXG5cclxuICBmb3JFYWNoU2VsZWN0b3JzOiBmdW5jdGlvbihjYiwgY29udGV4dCwgRE9NY29udGV4dCkge1xyXG4gICAgcmV0dXJuIHJlcXVpcmUoXCIuL2xpYi9mb3JlYWNoLXNlbGVjdG9ycy5qc1wiKS5iaW5kKHRoaXMpKHRoaXMub3B0aW9ucy5zZWxlY3RvcnMsIGNiLCBjb250ZXh0LCBET01jb250ZXh0KVxyXG4gIH0sXHJcblxyXG4gIHN3aXRjaFNlbGVjdG9yczogZnVuY3Rpb24oc2VsZWN0b3JzLCBmcm9tRWwsIHRvRWwsIG9wdGlvbnMpIHtcclxuICAgIHJldHVybiByZXF1aXJlKFwiLi9saWIvc3dpdGNoZXMtc2VsZWN0b3JzLmpzXCIpLmJpbmQodGhpcykodGhpcy5vcHRpb25zLnN3aXRjaGVzLCB0aGlzLm9wdGlvbnMuc3dpdGNoZXNPcHRpb25zLCBzZWxlY3RvcnMsIGZyb21FbCwgdG9FbCwgb3B0aW9ucylcclxuICB9LFxyXG5cclxuICAvLyB0b28gbXVjaCBwcm9ibGVtIHdpdGggdGhlIGNvZGUgYmVsb3dcclxuICAvLyArIGl04oCZcyB0b28gZGFuZ2Vyb3VzXHJcbi8vICAgc3dpdGNoRmFsbGJhY2s6IGZ1bmN0aW9uKGZyb21FbCwgdG9FbCkge1xyXG4vLyAgICAgdGhpcy5zd2l0Y2hTZWxlY3RvcnMoW1wiaGVhZFwiLCBcImJvZHlcIl0sIGZyb21FbCwgdG9FbClcclxuLy8gICAgIC8vIGV4ZWN1dGUgc2NyaXB0IHdoZW4gRE9NIGlzIGxpa2UgaXQgc2hvdWxkIGJlXHJcbi8vICAgICBQamF4LmV4ZWN1dGVTY3JpcHRzKGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCJoZWFkXCIpKVxyXG4vLyAgICAgUGpheC5leGVjdXRlU2NyaXB0cyhkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiYm9keVwiKSlcclxuLy8gICB9XHJcblxyXG4gIGxhdGVzdENoYW5jZTogZnVuY3Rpb24oaHJlZikge1xyXG4gICAgICB3aW5kb3cubG9jYXRpb24uaHJlZiA9IGhyZWY7XHJcbiAgICAgIHJldHVybiBmYWxzZTtcclxuICB9LFxyXG5cclxuICBvblN3aXRjaDogZnVuY3Rpb24oKSB7XHJcbiAgICB0cmlnZ2VyKHdpbmRvdywgXCJyZXNpemUgc2Nyb2xsXCIpXHJcbiAgfSxcclxuXHJcbiAgbG9hZENvbnRlbnQ6IGZ1bmN0aW9uKGh0bWwsIG9wdGlvbnMpIHtcclxuICAgIHZhciB0bXBFbCA9IGRvY3VtZW50LmltcGxlbWVudGF0aW9uLmNyZWF0ZUhUTUxEb2N1bWVudChcInBqYXhcIilcclxuICAgIHZhciBjb2xsZWN0Rm9yU2NyaXB0Y29tcGxldGUgPSBbXHJcbiAgICAgIChQcm9taXNlLnJlc29sdmUoXCJiYXNpYyByZXNvbHZlXCIpKVxyXG4gICAgXTtcclxuXHJcbiAgICAvLyBwYXJzZSBIVE1MIGF0dHJpYnV0ZXMgdG8gY29weSB0aGVtXHJcbiAgICAvLyBzaW5jZSB3ZSBhcmUgZm9yY2VkIHRvIHVzZSBkb2N1bWVudEVsZW1lbnQuaW5uZXJIVE1MIChvdXRlckhUTUwgY2FuJ3QgYmUgdXNlZCBmb3IgPGh0bWw+KVxyXG4gICAgdmFyIGh0bWxSZWdleCA9IC88aHRtbFtePl0rPi9naVxyXG4gICAgdmFyIGh0bWxBdHRyaWJzUmVnZXggPSAvXFxzP1thLXo6XSsoPzpcXD0oPzpcXCd8XFxcIilbXlxcJ1xcXCI+XSsoPzpcXCd8XFxcIikpKi9naVxyXG4gICAgdmFyIG1hdGNoZXMgPSBodG1sLm1hdGNoKGh0bWxSZWdleClcclxuICAgIGlmIChtYXRjaGVzICYmIG1hdGNoZXMubGVuZ3RoKSB7XHJcbiAgICAgIG1hdGNoZXMgPSBtYXRjaGVzWzBdLm1hdGNoKGh0bWxBdHRyaWJzUmVnZXgpXHJcbiAgICAgIGlmIChtYXRjaGVzLmxlbmd0aCkge1xyXG4gICAgICAgIG1hdGNoZXMuc2hpZnQoKVxyXG4gICAgICAgIG1hdGNoZXMuZm9yRWFjaChmdW5jdGlvbihodG1sQXR0cmliKSB7XHJcbiAgICAgICAgICB2YXIgYXR0ciA9IGh0bWxBdHRyaWIudHJpbSgpLnNwbGl0KFwiPVwiKVxyXG4gICAgICAgICAgaWYgKGF0dHIubGVuZ3RoID09PSAxKSB7XHJcbiAgICAgICAgICAgIHRtcEVsLmRvY3VtZW50RWxlbWVudC5zZXRBdHRyaWJ1dGUoYXR0clswXSwgdHJ1ZSlcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICB0bXBFbC5kb2N1bWVudEVsZW1lbnQuc2V0QXR0cmlidXRlKGF0dHJbMF0sIGF0dHJbMV0uc2xpY2UoMSwgLTEpKVxyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0pXHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBqc29uQ29udGVudCA9IG51bGw7XHJcbiAgICB0cnl7XHJcbiAgICAgIGpzb25Db250ZW50ID0gSlNPTi5wYXJzZShodG1sKTtcclxuICAgIH0gY2F0Y2goZSkge31cclxuXHJcbiAgICB0bXBFbC5kb2N1bWVudEVsZW1lbnQuaW5uZXJIVE1MID0gaHRtbFxyXG4gICAgdGhpcy5sb2coXCJsb2FkIGNvbnRlbnRcIiwgdG1wRWwuZG9jdW1lbnRFbGVtZW50LmF0dHJpYnV0ZXMsIHRtcEVsLmRvY3VtZW50RWxlbWVudC5pbm5lckhUTUwubGVuZ3RoKVxyXG5cclxuICAgIGlmKGpzb25Db250ZW50ICE9PSBudWxsKSB7XHJcbiAgICAgIHRoaXMubG9nKFwiZm91bmQgSlNPTiBkb2N1bWVudFwiLCBqc29uQ29udGVudCk7XHJcbiAgICAgIHRoaXMub3B0aW9ucy5vbkpzb25Eb2N1bWVudC5jYWxsKHRoaXMsIGpzb25Db250ZW50KTsgIFxyXG4gICAgfVxyXG5cclxuICAgIC8vIENsZWFyIG91dCBhbnkgZm9jdXNlZCBjb250cm9scyBiZWZvcmUgaW5zZXJ0aW5nIG5ldyBwYWdlIGNvbnRlbnRzLlxyXG4gICAgLy8gd2UgY2xlYXIgZm9jdXMgb24gbm9uIGZvcm0gZWxlbWVudHNcclxuICAgIGlmIChkb2N1bWVudC5hY3RpdmVFbGVtZW50ICYmICFkb2N1bWVudC5hY3RpdmVFbGVtZW50LnZhbHVlKSB7XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgZG9jdW1lbnQuYWN0aXZlRWxlbWVudC5ibHVyKClcclxuICAgICAgfSBjYXRjaCAoZSkgeyB9XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5zd2l0Y2hTZWxlY3RvcnModGhpcy5vcHRpb25zLnNlbGVjdG9ycywgdG1wRWwsIGRvY3VtZW50LCBvcHRpb25zKVxyXG5cclxuICAgIC8vcmVzZXQgc3R5bGVzaGVldHMgaWYgYWN0aXZhdGVkXHJcbiAgICBpZih0aGlzLm9wdGlvbnMucmVSZW5kZXJDU1MgPT09IHRydWUpe1xyXG4gICAgICB0aGlzLnVwZGF0ZVN0eWxlc2hlZXRzLmNhbGwodGhpcywgdG1wRWwucXVlcnlTZWxlY3RvckFsbCgnbGlua1tyZWw9c3R5bGVzaGVldF0nKSwgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnbGlua1tyZWw9c3R5bGVzaGVldF0nKSk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gRkYgYnVnOiBXb27igJl0IGF1dG9mb2N1cyBmaWVsZHMgdGhhdCBhcmUgaW5zZXJ0ZWQgdmlhIEpTLlxyXG4gICAgLy8gVGhpcyBiZWhhdmlvciBpcyBpbmNvcnJlY3QuIFNvIGlmIHRoZXJlcyBubyBjdXJyZW50IGZvY3VzLCBhdXRvZm9jdXNcclxuICAgIC8vIHRoZSBsYXN0IGZpZWxkLlxyXG4gICAgLy9cclxuICAgIC8vIGh0dHA6Ly93d3cudzMub3JnL2h0bWwvd2cvZHJhZnRzL2h0bWwvbWFzdGVyL2Zvcm1zLmh0bWxcclxuICAgIHZhciBhdXRvZm9jdXNFbCA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCJbYXV0b2ZvY3VzXVwiKSkucG9wKClcclxuICAgIGlmIChhdXRvZm9jdXNFbCAmJiBkb2N1bWVudC5hY3RpdmVFbGVtZW50ICE9PSBhdXRvZm9jdXNFbCkge1xyXG4gICAgICBhdXRvZm9jdXNFbC5mb2N1cygpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIGV4ZWN1dGUgc2NyaXB0cyB3aGVuIERPTSBoYXZlIGJlZW4gY29tcGxldGVseSB1cGRhdGVkXHJcbiAgICB0aGlzLm9wdGlvbnMuc2VsZWN0b3JzLmZvckVhY2goIGZ1bmN0aW9uKHNlbGVjdG9yKSB7XHJcbiAgICAgIGZvckVhY2hFbHMoZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChzZWxlY3RvciksIGZ1bmN0aW9uKGVsKSB7XHJcblxyXG4gICAgICAgIGNvbGxlY3RGb3JTY3JpcHRjb21wbGV0ZS5wdXNoLmFwcGx5KGNvbGxlY3RGb3JTY3JpcHRjb21wbGV0ZSwgZXhlY3V0ZVNjcmlwdHMuY2FsbCh0aGlzLCBlbCkpO1xyXG5cclxuICAgICAgfSwgdGhpcyk7XHJcblxyXG4gICAgfSx0aGlzKTtcclxuICAgIC8vIH1cclxuICAgIC8vIGNhdGNoKGUpIHtcclxuICAgIC8vICAgaWYgKHRoaXMub3B0aW9ucy5kZWJ1Zykge1xyXG4gICAgLy8gICAgIHRoaXMubG9nKFwiUGpheCBzd2l0Y2ggZmFpbDogXCIsIGUpXHJcbiAgICAvLyAgIH1cclxuICAgIC8vICAgdGhpcy5zd2l0Y2hGYWxsYmFjayh0bXBFbCwgZG9jdW1lbnQpXHJcbiAgICAvLyB9XHJcbiAgICB0aGlzLmxvZyhcIndhaXRpbmcgZm9yIHNjcmlwdGNvbXBsZXRlXCIsY29sbGVjdEZvclNjcmlwdGNvbXBsZXRlKTtcclxuXHJcbiAgICAvL0ZhbGxiYWNrISBJZiBzb21ldGhpbmcgY2FuJ3QgYmUgbG9hZGVkIG9yIGlzIG5vdCBsb2FkZWQgY29ycmVjdGx5IC0+IGp1c3QgZm9yY2UgZXZlbnRpbmcgaW4gZXJyb3JcclxuICAgIHZhciB0aW1lT3V0U2NyaXB0RXZlbnQgPSBudWxsO1xyXG4gICAgdGltZU91dFNjcmlwdEV2ZW50ID0gd2luZG93LnNldFRpbWVvdXQoIGZ1bmN0aW9uKCl7XHJcbiAgICAgIHRyaWdnZXIoZG9jdW1lbnQsXCJwamF4OnNjcmlwdGNvbXBsZXRlIHBqYXg6c2NyaXB0dGltZW91dFwiLCBvcHRpb25zKVxyXG4gICAgICB0aW1lT3V0U2NyaXB0RXZlbnQgPSBudWxsO1xyXG4gICAgfSwgdGhpcy5vcHRpb25zLnNjcmlwdGxvYWR0aW1lb3V0KTtcclxuXHJcbiAgICBQcm9taXNlLmFsbChjb2xsZWN0Rm9yU2NyaXB0Y29tcGxldGUpLnRoZW4oXHJcbiAgICAgIC8vcmVzb2x2ZWRcclxuICAgICAgZnVuY3Rpb24oKXtcclxuICAgICAgICBpZih0aW1lT3V0U2NyaXB0RXZlbnQgIT09IG51bGwgKXtcclxuICAgICAgICAgIHdpbmRvdy5jbGVhclRpbWVvdXQodGltZU91dFNjcmlwdEV2ZW50KTtcclxuICAgICAgICAgIHRyaWdnZXIoZG9jdW1lbnQsXCJwamF4OnNjcmlwdGNvbXBsZXRlIHBqYXg6c2NyaXB0c3VjY2Vzc1wiLCBvcHRpb25zKVxyXG4gICAgICAgIH1cclxuICAgICAgfSxcclxuICAgICAgZnVuY3Rpb24oKXtcclxuICAgICAgICBpZih0aW1lT3V0U2NyaXB0RXZlbnQgIT09IG51bGwgKXtcclxuICAgICAgICAgIHdpbmRvdy5jbGVhclRpbWVvdXQodGltZU91dFNjcmlwdEV2ZW50KTtcclxuICAgICAgICAgIHRyaWdnZXIoZG9jdW1lbnQsXCJwamF4OnNjcmlwdGNvbXBsZXRlIHBqYXg6c2NyaXB0ZXJyb3JcIiwgb3B0aW9ucylcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICk7XHJcblxyXG5cclxuICB9LFxyXG5cclxuICBkb1JlcXVlc3Q6IHJlcXVpcmUoXCIuL2xpYi9yZXF1ZXN0LmpzXCIpLFxyXG5cclxuICBsb2FkVXJsOiBmdW5jdGlvbihocmVmLCBvcHRpb25zKSB7XHJcbiAgICB0aGlzLmxvZyhcImxvYWQgaHJlZlwiLCBocmVmLCBvcHRpb25zKVxyXG5cclxuICAgIHRyaWdnZXIoZG9jdW1lbnQsIFwicGpheDpzZW5kXCIsIG9wdGlvbnMpO1xyXG5cclxuICAgIC8vIERvIHRoZSByZXF1ZXN0XHJcbiAgICB0aGlzLmRvUmVxdWVzdChocmVmLCBvcHRpb25zLnJlcXVlc3RPcHRpb25zLCBmdW5jdGlvbihodG1sLCByZXF1ZXN0RGF0YSkge1xyXG4gICAgICAvLyBGYWlsIGlmIHVuYWJsZSB0byBsb2FkIEhUTUwgdmlhIEFKQVhcclxuICAgICAgaWYgKGh0bWwgPT09IGZhbHNlIHx8IHJlcXVlc3REYXRhLnN0YXR1cyAhPT0gMjAwKSB7XHJcbiAgICAgICAgdHJpZ2dlcihkb2N1bWVudCxcInBqYXg6Y29tcGxldGUgcGpheDplcnJvclwiLCB7b3B0aW9uczogb3B0aW9ucywgcmVxdWVzdERhdGE6IHJlcXVlc3REYXRhLCBocmVmOiBocmVmfSk7XHJcbiAgICAgICAgcmV0dXJuIG9wdGlvbnMucGpheEVycm9ySGFuZGxlcihocmVmLCBvcHRpb25zLCByZXF1ZXN0RGF0YSk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8vIENsZWFyIG91dCBhbnkgZm9jdXNlZCBjb250cm9scyBiZWZvcmUgaW5zZXJ0aW5nIG5ldyBwYWdlIGNvbnRlbnRzLlxyXG4gICAgICBkb2N1bWVudC5hY3RpdmVFbGVtZW50LmJsdXIoKVxyXG5cclxuICAgICAgdHJ5IHtcclxuICAgICAgICB0aGlzLmxvYWRDb250ZW50KGh0bWwsIG9wdGlvbnMpXHJcbiAgICAgIH1cclxuICAgICAgY2F0Y2ggKGUpIHtcclxuICAgICAgICBpZiAoIXRoaXMub3B0aW9ucy5kZWJ1Zykge1xyXG4gICAgICAgICAgaWYgKGNvbnNvbGUgJiYgdGhpcy5vcHRpb25zLmxvZ09iamVjdC5lcnJvcikge1xyXG4gICAgICAgICAgICB0aGlzLm9wdGlvbnMubG9nT2JqZWN0LmVycm9yKFwiUGpheCBzd2l0Y2ggZmFpbDogXCIsIGUpXHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICByZXR1cm4gb3B0aW9ucy5wamF4RXJyb3JIYW5kbGVyKGhyZWYsIG9wdGlvbnMsIHJlcXVlc3REYXRhKSB8fCB0aGlzLmxhdGVzdENoYW5jZShocmVmKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICBpZiAodGhpcy5vcHRpb25zLmZvcmNlUmVkaXJlY3RPbkZhaWwpIHtcclxuICAgICAgICAgICAgcmV0dXJuIG9wdGlvbnMucGpheEVycm9ySGFuZGxlcihocmVmLCBvcHRpb25zLCByZXF1ZXN0RGF0YSkgfHwgdGhpcy5sYXRlc3RDaGFuY2UoaHJlZik7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICB0aHJvdyBlO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG5cclxuICAgICAgaWYgKG9wdGlvbnMuaGlzdG9yeSkge1xyXG4gICAgICAgIGlmICh0aGlzLmZpcnN0cnVuKSB7XHJcbiAgICAgICAgICB0aGlzLmxhc3RVaWQgPSB0aGlzLm1heFVpZCA9IG5ld1VpZCgpXHJcbiAgICAgICAgICB0aGlzLmZpcnN0cnVuID0gZmFsc2VcclxuICAgICAgICAgIHdpbmRvdy5oaXN0b3J5LnJlcGxhY2VTdGF0ZSh7XHJcbiAgICAgICAgICAgIHVybDogd2luZG93LmxvY2F0aW9uLmhyZWYsXHJcbiAgICAgICAgICAgIHRpdGxlOiBkb2N1bWVudC50aXRsZSxcclxuICAgICAgICAgICAgdWlkOiB0aGlzLm1heFVpZFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgIGRvY3VtZW50LnRpdGxlKVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gVXBkYXRlIGJyb3dzZXIgaGlzdG9yeVxyXG4gICAgICAgIHRoaXMubGFzdFVpZCA9IHRoaXMubWF4VWlkID0gbmV3VWlkKClcclxuICAgICAgICB3aW5kb3cuaGlzdG9yeS5wdXNoU3RhdGUoe1xyXG4gICAgICAgICAgdXJsOiBocmVmLFxyXG4gICAgICAgICAgdGl0bGU6IG9wdGlvbnMudGl0bGUsXHJcbiAgICAgICAgICB1aWQ6IHRoaXMubWF4VWlkXHJcbiAgICAgICAgfSxcclxuICAgICAgICAgIG9wdGlvbnMudGl0bGUsXHJcbiAgICAgICAgICBocmVmKVxyXG4gICAgICB9XHJcblxyXG4gICAgICB0aGlzLmZvckVhY2hTZWxlY3RvcnMoZnVuY3Rpb24oZWwpIHtcclxuICAgICAgICB0aGlzLnBhcnNlRE9NKGVsKVxyXG4gICAgICB9LCB0aGlzKVxyXG5cclxuICAgICAgLy8gRmlyZSBFdmVudHNcclxuICAgICAgdHJpZ2dlcihkb2N1bWVudCxcInBqYXg6Y29tcGxldGUgcGpheDpzdWNjZXNzXCIsIG9wdGlvbnMpXHJcblxyXG4gICAgICBvcHRpb25zLmFuYWx5dGljcygpXHJcblxyXG4gICAgICAvLyBTY3JvbGwgcGFnZSB0byB0b3Agb24gbmV3IHBhZ2UgbG9hZFxyXG4gICAgICBpZiAob3B0aW9ucy5zY3JvbGxUbyAhPT0gZmFsc2UpIHtcclxuICAgICAgICBpZiAob3B0aW9ucy5zY3JvbGxUby5sZW5ndGggPiAxKSB7XHJcbiAgICAgICAgICB3aW5kb3cuc2Nyb2xsVG8ob3B0aW9ucy5zY3JvbGxUb1swXSwgb3B0aW9ucy5zY3JvbGxUb1sxXSlcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICB3aW5kb3cuc2Nyb2xsVG8oMCwgb3B0aW9ucy5zY3JvbGxUbylcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH0uYmluZCh0aGlzKSlcclxuICB9XHJcbn1cclxuXHJcblBqYXguaXNTdXBwb3J0ZWQgPSByZXF1aXJlKFwiLi9saWIvaXMtc3VwcG9ydGVkLmpzXCIpO1xyXG5cclxuLy9hcmd1YWJseSBjb3VsZCBkbyBgaWYoIHJlcXVpcmUoXCIuL2xpYi9pcy1zdXBwb3J0ZWQuanNcIikoKSkge2AgYnV0IHRoYXQgbWlnaHQgYmUgYSBsaXR0bGUgdG8gc2ltcGxlXHJcbmlmIChQamF4LmlzU3VwcG9ydGVkKCkpIHtcclxuICBtb2R1bGUuZXhwb3J0cyA9IFBqYXhcclxufVxyXG4vLyBpZiB0aGVyZSBpc27igJl0IHJlcXVpcmVkIGJyb3dzZXIgZnVuY3Rpb25zLCByZXR1cm5pbmcgc3R1cGlkIGFwaVxyXG5lbHNlIHtcclxuICB2YXIgc3R1cGlkUGpheCA9IGZ1bmN0aW9uKCkge31cclxuICBmb3IgKHZhciBrZXkgaW4gUGpheC5wcm90b3R5cGUpIHtcclxuICAgIGlmIChQamF4LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eShrZXkpICYmIHR5cGVvZiBQamF4LnByb3RvdHlwZVtrZXldID09PSBcImZ1bmN0aW9uXCIpIHtcclxuICAgICAgc3R1cGlkUGpheFtrZXldID0gc3R1cGlkUGpheFxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgbW9kdWxlLmV4cG9ydHMgPSBzdHVwaWRQamF4XHJcbn1cclxuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihvYmopIHtcclxuICBpZiAobnVsbCA9PT0gb2JqIHx8IFwib2JqZWN0XCIgIT0gdHlwZW9mIG9iaikge1xyXG4gICAgcmV0dXJuIG9ialxyXG4gIH1cclxuICB2YXIgY29weSA9IG9iai5jb25zdHJ1Y3RvcigpXHJcbiAgZm9yICh2YXIgYXR0ciBpbiBvYmopIHtcclxuICAgIGlmIChvYmouaGFzT3duUHJvcGVydHkoYXR0cikpIHtcclxuICAgICAgY29weVthdHRyXSA9IG9ialthdHRyXVxyXG4gICAgfVxyXG4gIH1cclxuICByZXR1cm4gY29weVxyXG59XHJcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oZWwpIHtcclxuICB2YXIgcXVlcnlTZWxlY3RvciA9IHRoaXMub3B0aW9ucy5tYWluU2NyaXB0RWxlbWVudDtcclxuICB2YXIgY29kZSA9IChlbC50ZXh0IHx8IGVsLnRleHRDb250ZW50IHx8IGVsLmlubmVySFRNTCB8fCBcIlwiKVxyXG4gIHZhciBzcmMgPSAoZWwuc3JjIHx8IFwiXCIpO1xyXG4gIHZhciBwYXJlbnQgPSBlbC5wYXJlbnROb2RlIHx8IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IocXVlcnlTZWxlY3RvcikgfHwgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50XHJcbiAgdmFyIHNjcmlwdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzY3JpcHRcIilcclxuICB2YXIgcHJvbWlzZSA9IG51bGw7XHJcblxyXG4gIHRoaXMubG9nKFwiRXZhbHVhdGluZyBTY3JpcHQ6IFwiLCBlbCk7XHJcblxyXG4gIGlmIChjb2RlLm1hdGNoKFwiZG9jdW1lbnQud3JpdGVcIikpIHtcclxuICAgIGlmIChjb25zb2xlICYmIHRoaXMub3B0aW9ucy5sb2dPYmplY3QubG9nKSB7XHJcbiAgICAgIHRoaXMub3B0aW9ucy5sb2dPYmplY3QubG9nKFwiU2NyaXB0IGNvbnRhaW5zIGRvY3VtZW50LndyaXRlLiBDYW7igJl0IGJlIGV4ZWN1dGVkIGNvcnJlY3RseS4gQ29kZSBza2lwcGVkIFwiLCBlbClcclxuICAgIH1cclxuICAgIHJldHVybiBmYWxzZVxyXG4gIH1cclxuXHJcbiAgcHJvbWlzZSA9IG5ldyBQcm9taXNlKCBmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xyXG5cclxuICAgIHNjcmlwdC50eXBlID0gXCJ0ZXh0L2phdmFzY3JpcHRcIlxyXG4gICAgaWYgKHNyYyAhPSBcIlwiKSB7XHJcbiAgICAgIHNjcmlwdC5zcmMgPSBzcmM7XHJcbiAgICAgIHNjcmlwdC5hZGRFdmVudExpc3RlbmVyKCdsb2FkJywgZnVuY3Rpb24oKXtyZXNvbHZlKHNyYyk7fSApO1xyXG4gICAgICBzY3JpcHQuYXN5bmMgPSB0cnVlOyAvLyBmb3JjZSBhc3luY2hyb25vdXMgbG9hZGluZyBvZiBwZXJpcGhlcmFsIGpzXHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGNvZGUgIT0gXCJcIikge1xyXG4gICAgICB0cnkge1xyXG4gICAgICAgIHNjcmlwdC5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShjb2RlKSlcclxuICAgICAgfVxyXG4gICAgICBjYXRjaCAoZSkge1xyXG4gICAgICAgIC8vIG9sZCBJRXMgaGF2ZSBmdW5reSBzY3JpcHQgbm9kZXNcclxuICAgICAgICBzY3JpcHQudGV4dCA9IGNvZGVcclxuICAgICAgfVxyXG4gICAgICByZXNvbHZlKCd0ZXh0LW5vZGUnKTtcclxuICAgIH1cclxuICB9KTtcclxuXHJcbiAgdGhpcy5sb2coJ1BhcmVudEVsZW1lbnQgPT4gJywgcGFyZW50ICk7XHJcblxyXG4gIC8vIGV4ZWN1dGVcclxuICBwYXJlbnQuYXBwZW5kQ2hpbGQoc2NyaXB0KTtcclxuICBwYXJlbnQucmVtb3ZlQ2hpbGQoc2NyaXB0KVxyXG4gIC8vIGF2b2lkIHBvbGx1dGlvbiBvbmx5IGluIGhlYWQgb3IgYm9keSB0YWdzXHJcbiAgLy8gb2YgaWYgdGhlIHNldHRpbmcgcmVtb3ZlU2NyaXB0c0FmdGVyUGFyc2luZyBpcyBhY3RpdmVcclxuICBpZiggKFtcImhlYWRcIixcImJvZHlcIl0uaW5kZXhPZiggcGFyZW50LnRhZ05hbWUudG9Mb3dlckNhc2UoKSkgPiAwKSB8fCAodGhpcy5vcHRpb25zLnJlbW92ZVNjcmlwdHNBZnRlclBhcnNpbmcgPT09IHRydWUpICkge1xyXG4gIH1cclxuXHJcbiAgcmV0dXJuIHByb21pc2U7XHJcbn1cclxuIiwidmFyIGZvckVhY2hFbHMgPSByZXF1aXJlKFwiLi4vZm9yZWFjaC1lbHNcIilcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oZWxzLCBldmVudHMsIGxpc3RlbmVyLCB1c2VDYXB0dXJlKSB7XHJcbiAgZXZlbnRzID0gKHR5cGVvZiBldmVudHMgPT09IFwic3RyaW5nXCIgPyBldmVudHMuc3BsaXQoXCIgXCIpIDogZXZlbnRzKVxyXG5cclxuICBldmVudHMuZm9yRWFjaChmdW5jdGlvbihlKSB7XHJcbiAgICBmb3JFYWNoRWxzKGVscywgZnVuY3Rpb24oZWwpIHtcclxuICAgICAgZWwucmVtb3ZlRXZlbnRMaXN0ZW5lcihlLCBsaXN0ZW5lciwgdXNlQ2FwdHVyZSlcclxuICAgIH0pXHJcbiAgfSlcclxufVxyXG4iLCJ2YXIgZm9yRWFjaEVscyA9IHJlcXVpcmUoXCIuLi9mb3JlYWNoLWVsc1wiKVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihlbHMsIGV2ZW50cywgbGlzdGVuZXIsIHVzZUNhcHR1cmUpIHtcclxuICBldmVudHMgPSAodHlwZW9mIGV2ZW50cyA9PT0gXCJzdHJpbmdcIiA/IGV2ZW50cy5zcGxpdChcIiBcIikgOiBldmVudHMpXHJcblxyXG4gIGV2ZW50cy5mb3JFYWNoKGZ1bmN0aW9uKGUpIHtcclxuICAgIGZvckVhY2hFbHMoZWxzLCBmdW5jdGlvbihlbCkge1xyXG4gICAgICBlbC5hZGRFdmVudExpc3RlbmVyKGUsIGxpc3RlbmVyLCB1c2VDYXB0dXJlKVxyXG4gICAgfSlcclxuICB9KVxyXG59XHJcbiIsInZhciBmb3JFYWNoRWxzID0gcmVxdWlyZShcIi4uL2ZvcmVhY2gtZWxzXCIpXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGVscywgZXZlbnRzLCBvcHRzKSB7XHJcbiAgZXZlbnRzID0gKHR5cGVvZiBldmVudHMgPT09IFwic3RyaW5nXCIgPyBldmVudHMuc3BsaXQoXCIgXCIpIDogZXZlbnRzKVxyXG5cclxuICBldmVudHMuZm9yRWFjaChmdW5jdGlvbihlKSB7XHJcbiAgICB2YXIgZXZlbnQgLy8gPSBuZXcgQ3VzdG9tRXZlbnQoZSkgLy8gZG9lc24ndCBldmVyeXdoZXJlIHlldFxyXG4gICAgZXZlbnQgPSBkb2N1bWVudC5jcmVhdGVFdmVudChcIkhUTUxFdmVudHNcIilcclxuICAgIGV2ZW50LmluaXRFdmVudChlLCB0cnVlLCB0cnVlKVxyXG4gICAgZXZlbnQuZXZlbnROYW1lID0gZVxyXG4gICAgaWYgKG9wdHMpIHtcclxuICAgICAgT2JqZWN0LmtleXMob3B0cykuZm9yRWFjaChmdW5jdGlvbihrZXkpIHtcclxuICAgICAgICBldmVudFtrZXldID0gb3B0c1trZXldXHJcbiAgICAgIH0pXHJcbiAgICB9XHJcblxyXG4gICAgZm9yRWFjaEVscyhlbHMsIGZ1bmN0aW9uKGVsKSB7XHJcbiAgICAgIHZhciBkb21GaXggPSBmYWxzZVxyXG4gICAgICBpZiAoIWVsLnBhcmVudE5vZGUgJiYgZWwgIT09IGRvY3VtZW50ICYmIGVsICE9PSB3aW5kb3cpIHtcclxuICAgICAgICAvLyBUSEFOS1MgWU9VIElFICg5LzEwLy8xMSBjb25jZXJuZWQpXHJcbiAgICAgICAgLy8gZGlzcGF0Y2hFdmVudCBkb2Vzbid0IHdvcmsgaWYgZWxlbWVudCBpcyBub3QgaW4gdGhlIGRvbVxyXG4gICAgICAgIGRvbUZpeCA9IHRydWVcclxuICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGVsKVxyXG4gICAgICB9XHJcbiAgICAgIGVsLmRpc3BhdGNoRXZlbnQoZXZlbnQpXHJcbiAgICAgIGlmIChkb21GaXgpIHtcclxuICAgICAgICBlbC5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKGVsKVxyXG4gICAgICB9XHJcbiAgICB9KVxyXG4gIH0pXHJcbn1cclxuIiwidmFyIGZvckVhY2hFbHMgPSByZXF1aXJlKFwiLi9mb3JlYWNoLWVsc1wiKVxyXG52YXIgZXZhbFNjcmlwdCA9IHJlcXVpcmUoXCIuL2V2YWwtc2NyaXB0XCIpXHJcbi8vIEZpbmRzIGFuZCBleGVjdXRlcyBzY3JpcHRzICh1c2VkIGZvciBuZXdseSBhZGRlZCBlbGVtZW50cylcclxuLy8gTmVlZGVkIHNpbmNlIGlubmVySFRNTCBkb2VzIG5vdCBydW4gc2NyaXB0c1xyXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGVsKSB7XHJcblxyXG4gIHRoaXMubG9nKFwiRXhlY3V0aW5nIHNjcmlwdHMgZm9yIFwiLCBlbCk7XHJcblxyXG4gIHZhciBsb2FkaW5nU2NyaXB0cyA9IFtdO1xyXG5cclxuICBpZihlbCA9PT0gdW5kZWZpbmVkKSByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XHJcblxyXG4gIGlmIChlbC50YWdOYW1lLnRvTG93ZXJDYXNlKCkgPT09IFwic2NyaXB0XCIpIHtcclxuICAgIGV2YWxTY3JpcHQuY2FsbCh0aGlzLCBlbCk7XHJcbiAgfVxyXG5cclxuICBmb3JFYWNoRWxzKGVsLnF1ZXJ5U2VsZWN0b3JBbGwoXCJzY3JpcHRcIiksIGZ1bmN0aW9uKHNjcmlwdCkge1xyXG4gICAgaWYgKCFzY3JpcHQudHlwZSB8fCBzY3JpcHQudHlwZS50b0xvd2VyQ2FzZSgpID09PSBcInRleHQvamF2YXNjcmlwdFwiKSB7XHJcbiAgICAgIC8vIGlmIChzY3JpcHQucGFyZW50Tm9kZSkge1xyXG4gICAgICAvLyAgIHNjcmlwdC5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHNjcmlwdClcclxuICAgICAgLy8gfVxyXG4gICAgICBsb2FkaW5nU2NyaXB0cy5wdXNoKGV2YWxTY3JpcHQuY2FsbCh0aGlzLCBzY3JpcHQpKTtcclxuICAgIH1cclxuICB9LCB0aGlzKTtcclxuXHJcbiAgcmV0dXJuIGxvYWRpbmdTY3JpcHRzO1xyXG59XHJcbiIsIi8qIGdsb2JhbCBIVE1MQ29sbGVjdGlvbjogdHJ1ZSAqL1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihlbHMsIGZuLCBjb250ZXh0KSB7XHJcbiAgaWYgKGVscyBpbnN0YW5jZW9mIEhUTUxDb2xsZWN0aW9uIHx8IGVscyBpbnN0YW5jZW9mIE5vZGVMaXN0IHx8IGVscyBpbnN0YW5jZW9mIEFycmF5KSB7XHJcbiAgICByZXR1cm4gQXJyYXkucHJvdG90eXBlLmZvckVhY2guY2FsbChlbHMsIGZuLCBjb250ZXh0KVxyXG4gIH1cclxuICAvLyBhc3N1bWUgc2ltcGxlIGRvbSBlbGVtZW50XHJcbiAgcmV0dXJuIGZuLmNhbGwoY29udGV4dCwgZWxzKVxyXG59XHJcbiIsInZhciBmb3JFYWNoRWxzID0gcmVxdWlyZShcIi4vZm9yZWFjaC1lbHNcIilcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oc2VsZWN0b3JzLCBjYiwgY29udGV4dCwgRE9NY29udGV4dCkge1xyXG4gIERPTWNvbnRleHQgPSBET01jb250ZXh0IHx8IGRvY3VtZW50XHJcbiAgc2VsZWN0b3JzLmZvckVhY2goZnVuY3Rpb24oc2VsZWN0b3IpIHtcclxuICAgIGZvckVhY2hFbHMoRE9NY29udGV4dC5xdWVyeVNlbGVjdG9yQWxsKHNlbGVjdG9yKSwgY2IsIGNvbnRleHQpXHJcbiAgfSlcclxufVxyXG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCkge1xyXG4gIC8vIEJvcnJvd2VkIHdob2xlc2FsZSBmcm9tIGh0dHBzOi8vZ2l0aHViLmNvbS9kZWZ1bmt0L2pxdWVyeS1wamF4XHJcbiAgcmV0dXJuIHdpbmRvdy5oaXN0b3J5ICYmXHJcbiAgICB3aW5kb3cuaGlzdG9yeS5wdXNoU3RhdGUgJiZcclxuICAgIHdpbmRvdy5oaXN0b3J5LnJlcGxhY2VTdGF0ZSAmJlxyXG4gICAgLy8gcHVzaFN0YXRlIGlzbuKAmXQgcmVsaWFibGUgb24gaU9TIHVudGlsIDUuXHJcbiAgICAhbmF2aWdhdG9yLnVzZXJBZ2VudC5tYXRjaCgvKChpUG9kfGlQaG9uZXxpUGFkKS4rXFxiT1NcXHMrWzEtNF1cXER8V2ViQXBwc1xcLy4rQ0ZOZXR3b3JrKS8pXHJcbn1cclxuIiwiaWYgKCFGdW5jdGlvbi5wcm90b3R5cGUuYmluZCkge1xyXG4gIEZ1bmN0aW9uLnByb3RvdHlwZS5iaW5kID0gZnVuY3Rpb24ob1RoaXMpIHtcclxuICAgIGlmICh0eXBlb2YgdGhpcyAhPT0gXCJmdW5jdGlvblwiKSB7XHJcbiAgICAgIC8vIGNsb3Nlc3QgdGhpbmcgcG9zc2libGUgdG8gdGhlIEVDTUFTY3JpcHQgNSBpbnRlcm5hbCBJc0NhbGxhYmxlIGZ1bmN0aW9uXHJcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJGdW5jdGlvbi5wcm90b3R5cGUuYmluZCAtIHdoYXQgaXMgdHJ5aW5nIHRvIGJlIGJvdW5kIGlzIG5vdCBjYWxsYWJsZVwiKVxyXG4gICAgfVxyXG5cclxuICAgIHZhciBhQXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSlcclxuICAgIHZhciB0aGF0ID0gdGhpc1xyXG4gICAgdmFyIEZub29wID0gZnVuY3Rpb24oKSB7fVxyXG4gICAgdmFyIGZCb3VuZCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICByZXR1cm4gdGhhdC5hcHBseSh0aGlzIGluc3RhbmNlb2YgRm5vb3AgJiYgb1RoaXMgPyB0aGlzIDogb1RoaXMsIGFBcmdzLmNvbmNhdChBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpKSlcclxuICAgIH1cclxuXHJcbiAgICBGbm9vcC5wcm90b3R5cGUgPSB0aGlzLnByb3RvdHlwZVxyXG4gICAgZkJvdW5kLnByb3RvdHlwZSA9IG5ldyBGbm9vcCgpXHJcblxyXG4gICAgcmV0dXJuIGZCb3VuZFxyXG4gIH1cclxufVxyXG4iLCJyZXF1aXJlKFwiLi4vcG9seWZpbGxzL0Z1bmN0aW9uLnByb3RvdHlwZS5iaW5kXCIpXHJcblxyXG52YXIgb24gPSByZXF1aXJlKFwiLi4vZXZlbnRzL29uXCIpXHJcbnZhciBjbG9uZSA9IHJlcXVpcmUoXCIuLi9jbG9uZVwiKVxyXG5cclxudmFyIGF0dHJDbGljayA9IFwiZGF0YS1wamF4LXN1Ym1pdC1zdGF0ZVwiXHJcblxyXG52YXIgZm9ybUFjdGlvbiA9IGZ1bmN0aW9uKGVsLCBldmVudCl7XHJcblxyXG4gIHRoaXMub3B0aW9ucy5yZXF1ZXN0T3B0aW9ucyA9IHtcclxuICAgIHJlcXVlc3RVcmwgOiBlbC5nZXRBdHRyaWJ1dGUoJ2FjdGlvbicpIHx8IHdpbmRvdy5sb2NhdGlvbi5ocmVmLFxyXG4gICAgcmVxdWVzdE1ldGhvZCA6IGVsLmdldEF0dHJpYnV0ZSgnbWV0aG9kJykgfHwgJ0dFVCcsXHJcbiAgfVxyXG5cclxuICAvL2NyZWF0ZSBhIHRlc3RhYmxlIHZpcnR1YWwgbGluayBvZiB0aGUgZm9ybSBhY3Rpb25cclxuICB2YXIgdmlydExpbmtFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpO1xyXG4gIHZpcnRMaW5rRWxlbWVudC5zZXRBdHRyaWJ1dGUoJ2hyZWYnLCB0aGlzLm9wdGlvbnMucmVxdWVzdE9wdGlvbnMucmVxdWVzdFVybCk7XHJcblxyXG4gIC8vIElnbm9yZSBleHRlcm5hbCBsaW5rcy5cclxuICBpZiAodmlydExpbmtFbGVtZW50LnByb3RvY29sICE9PSB3aW5kb3cubG9jYXRpb24ucHJvdG9jb2wgfHwgdmlydExpbmtFbGVtZW50Lmhvc3QgIT09IHdpbmRvdy5sb2NhdGlvbi5ob3N0KSB7XHJcbiAgICBlbC5zZXRBdHRyaWJ1dGUoYXR0ckNsaWNrLCBcImV4dGVybmFsXCIpO1xyXG4gICAgcmV0dXJuXHJcbiAgfVxyXG5cclxuICAvLyBJZ25vcmUgY2xpY2sgaWYgd2UgYXJlIG9uIGFuIGFuY2hvciBvbiB0aGUgc2FtZSBwYWdlXHJcbiAgaWYgKHZpcnRMaW5rRWxlbWVudC5wYXRobmFtZSA9PT0gd2luZG93LmxvY2F0aW9uLnBhdGhuYW1lICYmIHZpcnRMaW5rRWxlbWVudC5oYXNoLmxlbmd0aCA+IDApIHtcclxuICAgIGVsLnNldEF0dHJpYnV0ZShhdHRyQ2xpY2ssIFwiYW5jaG9yLXByZXNlbnRcIik7XHJcbiAgICByZXR1cm5cclxuICB9XHJcblxyXG4gIC8vIElnbm9yZSBlbXB0eSBhbmNob3IgXCJmb28uaHRtbCNcIlxyXG4gIGlmICh2aXJ0TGlua0VsZW1lbnQuaHJlZiA9PT0gd2luZG93LmxvY2F0aW9uLmhyZWYuc3BsaXQoXCIjXCIpWzBdICsgXCIjXCIpIHtcclxuICAgIGVsLnNldEF0dHJpYnV0ZShhdHRyQ2xpY2ssIFwiYW5jaG9yLWVtcHR5XCIpXHJcbiAgICByZXR1cm5cclxuICB9XHJcblxyXG4gIC8vIGlmIGRlY2xhcmVkIGFzIGEgZnVsbCByZWxvYWQsIGp1c3Qgbm9ybWFsbHkgc3VibWl0IHRoZSBmb3JtXHJcbiAgaWYgKCB0aGlzLm9wdGlvbnMuY3VycmVudFVybEZ1bGxSZWxvYWQpIHtcclxuICAgIGVsLnNldEF0dHJpYnV0ZShhdHRyQ2xpY2ssIFwicmVsb2FkXCIpO1xyXG4gICAgcmV0dXJuO1xyXG4gIH1cclxuXHJcbiAgZXZlbnQucHJldmVudERlZmF1bHQoKVxyXG4gIHZhciBuYW1lTGlzdCA9IFtdO1xyXG4gIHZhciBwYXJhbU9iamVjdCA9IFtdO1xyXG4gIGZvcih2YXIgZWxlbWVudEtleSBpbiBlbC5lbGVtZW50cykge1xyXG4gICAgdmFyIGVsZW1lbnQgPSBlbC5lbGVtZW50c1tlbGVtZW50S2V5XTtcclxuICAgIGlmICghIWVsZW1lbnQubmFtZSAmJiBlbGVtZW50LmF0dHJpYnV0ZXMgIT09IHVuZGVmaW5lZCAmJiBlbGVtZW50LnRhZ05hbWUudG9Mb3dlckNhc2UoKSAhPT0gJ2J1dHRvbicpe1xyXG4gICAgICBcclxuICAgICAgaWYgKFxyXG4gICAgICAgIChlbGVtZW50LnR5cGUgIT09ICdjaGVja2JveCcgJiYgZWxlbWVudC50eXBlICE9PSAncmFkaW8nKSB8fCBlbGVtZW50LmNoZWNrZWRcclxuICAgICAgKSB7XHJcbiAgICAgICAgaWYobmFtZUxpc3QuaW5kZXhPZihlbGVtZW50Lm5hbWUpID09PSAtMSl7XHJcbiAgICAgICAgICBuYW1lTGlzdC5wdXNoKGVsZW1lbnQubmFtZSk7XHJcbiAgICAgICAgICBcclxuICAgICAgICAgIGlmIChTdHJpbmcoZWxlbWVudC5ub2RlTmFtZSkudG9Mb3dlckNhc2UoKSA9PT0gJ3NlbGVjdCcgJiYgZWxlbWVudC5tdWx0aXBsZSA9PSB0cnVlKSB7XHJcbiAgICAgICAgICAgIHZhciBzZWxlY3RlZCA9IEFycmF5LmZyb20oZWxlbWVudC5vcHRpb25zKS5tYXAoZnVuY3Rpb24oaXRlbSxpKSB7IHJldHVybiAoaXRlbS5zZWxlY3RlZCA/IGl0ZW0udmFsdWUgOiBudWxsKSB9KTtcclxuICAgICAgICAgICAgcGFyYW1PYmplY3QucHVzaCh7IG5hbWU6IGVuY29kZVVSSUNvbXBvbmVudChlbGVtZW50Lm5hbWUpLCB2YWx1ZTogc2VsZWN0ZWR9KTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgfSBcclxuXHJcbiAgICAgICAgICBwYXJhbU9iamVjdC5wdXNoKHsgbmFtZTogZW5jb2RlVVJJQ29tcG9uZW50KGVsZW1lbnQubmFtZSksIHZhbHVlOiBlbmNvZGVVUklDb21wb25lbnQoZWxlbWVudC52YWx1ZSl9KTtcclxuICAgICAgICAgIFxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG5cclxuXHJcbiAgLy9DcmVhdGluZyBhIGdldFN0cmluZ1xyXG4gIHZhciBwYXJhbXNTdHJpbmcgPSAocGFyYW1PYmplY3QubWFwKGZ1bmN0aW9uKHZhbHVlKXtyZXR1cm4gdmFsdWUubmFtZStcIj1cIit2YWx1ZS52YWx1ZTt9KSkuam9pbignJicpO1xyXG5cclxuICB0aGlzLm9wdGlvbnMucmVxdWVzdE9wdGlvbnMucmVxdWVzdFBheWxvYWQgPSBwYXJhbU9iamVjdDtcclxuICB0aGlzLm9wdGlvbnMucmVxdWVzdE9wdGlvbnMucmVxdWVzdFBheWxvYWRTdHJpbmcgPSBwYXJhbXNTdHJpbmc7XHJcblxyXG4gIGVsLnNldEF0dHJpYnV0ZShhdHRyQ2xpY2ssIFwic3VibWl0XCIpO1xyXG5cclxuICB0aGlzLmxvYWRVcmwodmlydExpbmtFbGVtZW50LmhyZWYsIGNsb25lKHRoaXMub3B0aW9ucykpXHJcblxyXG59O1xyXG5cclxudmFyIGlzRGVmYXVsdFByZXZlbnRlZCA9IGZ1bmN0aW9uKGV2ZW50KSB7XHJcbiAgcmV0dXJuIGV2ZW50LmRlZmF1bHRQcmV2ZW50ZWQgfHwgZXZlbnQucmV0dXJuVmFsdWUgPT09IGZhbHNlO1xyXG59O1xyXG5cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oZWwpIHtcclxuICB2YXIgdGhhdCA9IHRoaXNcclxuXHJcbiAgb24oZWwsIFwic3VibWl0XCIsIGZ1bmN0aW9uKGV2ZW50KSB7XHJcbiAgICBpZiAoaXNEZWZhdWx0UHJldmVudGVkKGV2ZW50KSkge1xyXG4gICAgICByZXR1cm5cclxuICAgIH1cclxuXHJcbiAgICBmb3JtQWN0aW9uLmNhbGwodGhhdCwgZWwsIGV2ZW50KVxyXG4gIH0pXHJcbn1cclxuIiwicmVxdWlyZShcIi4uL3BvbHlmaWxscy9GdW5jdGlvbi5wcm90b3R5cGUuYmluZFwiKVxyXG5cclxudmFyIG9uID0gcmVxdWlyZShcIi4uL2V2ZW50cy9vblwiKVxyXG52YXIgY2xvbmUgPSByZXF1aXJlKFwiLi4vY2xvbmVcIilcclxuXHJcbnZhciBhdHRyQ2xpY2sgPSBcImRhdGEtcGpheC1jbGljay1zdGF0ZVwiXHJcbnZhciBhdHRyS2V5ID0gXCJkYXRhLXBqYXgta2V5dXAtc3RhdGVcIlxyXG5cclxudmFyIGxpbmtBY3Rpb24gPSBmdW5jdGlvbihlbCwgZXZlbnQpIHtcclxuICAvLyBEb27igJl0IGJyZWFrIGJyb3dzZXIgc3BlY2lhbCBiZWhhdmlvciBvbiBsaW5rcyAobGlrZSBwYWdlIGluIG5ldyB3aW5kb3cpXHJcbiAgaWYgKGV2ZW50LndoaWNoID4gMSB8fCBldmVudC5tZXRhS2V5IHx8IGV2ZW50LmN0cmxLZXkgfHwgZXZlbnQuc2hpZnRLZXkgfHwgZXZlbnQuYWx0S2V5KSB7XHJcbiAgICBlbC5zZXRBdHRyaWJ1dGUoYXR0ckNsaWNrLCBcIm1vZGlmaWVyXCIpXHJcbiAgICByZXR1cm5cclxuICB9XHJcblxyXG4gIC8vIHdlIGRvIHRlc3Qgb24gaHJlZiBub3cgdG8gcHJldmVudCB1bmV4cGVjdGVkIGJlaGF2aW9yIGlmIGZvciBzb21lIHJlYXNvblxyXG4gIC8vIHVzZXIgaGF2ZSBocmVmIHRoYXQgY2FuIGJlIGR5bmFtaWNhbGx5IHVwZGF0ZWRcclxuXHJcbiAgLy8gSWdub3JlIGV4dGVybmFsIGxpbmtzLlxyXG4gIGlmIChlbC5wcm90b2NvbCAhPT0gd2luZG93LmxvY2F0aW9uLnByb3RvY29sIHx8IGVsLmhvc3QgIT09IHdpbmRvdy5sb2NhdGlvbi5ob3N0KSB7XHJcbiAgICBlbC5zZXRBdHRyaWJ1dGUoYXR0ckNsaWNrLCBcImV4dGVybmFsXCIpXHJcbiAgICByZXR1cm5cclxuICB9XHJcblxyXG4gIC8vIElnbm9yZSBjbGljayBpZiB3ZSBhcmUgb24gYW4gYW5jaG9yIG9uIHRoZSBzYW1lIHBhZ2VcclxuICBpZiAoZWwucGF0aG5hbWUgPT09IHdpbmRvdy5sb2NhdGlvbi5wYXRobmFtZSAmJiBlbC5oYXNoLmxlbmd0aCA+IDApIHtcclxuICAgIGVsLnNldEF0dHJpYnV0ZShhdHRyQ2xpY2ssIFwiYW5jaG9yLXByZXNlbnRcIilcclxuICAgIHJldHVyblxyXG4gIH1cclxuXHJcbiAgLy8gSWdub3JlIGFuY2hvcnMgb24gdGhlIHNhbWUgcGFnZSAoa2VlcCBuYXRpdmUgYmVoYXZpb3IpXHJcbiAgaWYgKGVsLmhhc2ggJiYgZWwuaHJlZi5yZXBsYWNlKGVsLmhhc2gsIFwiXCIpID09PSB3aW5kb3cubG9jYXRpb24uaHJlZi5yZXBsYWNlKGxvY2F0aW9uLmhhc2gsIFwiXCIpKSB7XHJcbiAgICBlbC5zZXRBdHRyaWJ1dGUoYXR0ckNsaWNrLCBcImFuY2hvclwiKVxyXG4gICAgcmV0dXJuXHJcbiAgfVxyXG5cclxuICAvLyBJZ25vcmUgZW1wdHkgYW5jaG9yIFwiZm9vLmh0bWwjXCJcclxuICBpZiAoZWwuaHJlZiA9PT0gd2luZG93LmxvY2F0aW9uLmhyZWYuc3BsaXQoXCIjXCIpWzBdICsgXCIjXCIpIHtcclxuICAgIGVsLnNldEF0dHJpYnV0ZShhdHRyQ2xpY2ssIFwiYW5jaG9yLWVtcHR5XCIpXHJcbiAgICByZXR1cm5cclxuICB9XHJcblxyXG4gIGV2ZW50LnByZXZlbnREZWZhdWx0KClcclxuXHJcbiAgLy8gZG9u4oCZdCBkbyBcIm5vdGhpbmdcIiBpZiB1c2VyIHRyeSB0byByZWxvYWQgdGhlIHBhZ2UgYnkgY2xpY2tpbmcgdGhlIHNhbWUgbGluayB0d2ljZVxyXG4gIGlmIChcclxuICAgIHRoaXMub3B0aW9ucy5jdXJyZW50VXJsRnVsbFJlbG9hZCAmJlxyXG4gICAgZWwuaHJlZiA9PT0gd2luZG93LmxvY2F0aW9uLmhyZWYuc3BsaXQoXCIjXCIpWzBdXHJcbiAgKSB7XHJcbiAgICBlbC5zZXRBdHRyaWJ1dGUoYXR0ckNsaWNrLCBcInJlbG9hZFwiKVxyXG4gICAgdGhpcy5yZWxvYWQoKVxyXG4gICAgcmV0dXJuXHJcbiAgfVxyXG4gIHRoaXMub3B0aW9ucy5yZXF1ZXN0T3B0aW9ucyA9IHRoaXMub3B0aW9ucy5yZXF1ZXN0T3B0aW9ucyB8fCB7fTtcclxuICBlbC5zZXRBdHRyaWJ1dGUoYXR0ckNsaWNrLCBcImxvYWRcIilcclxuICB0aGlzLmxvYWRVcmwoZWwuaHJlZiwgY2xvbmUodGhpcy5vcHRpb25zKSlcclxufVxyXG5cclxudmFyIGlzRGVmYXVsdFByZXZlbnRlZCA9IGZ1bmN0aW9uKGV2ZW50KSB7XHJcbiAgcmV0dXJuIGV2ZW50LmRlZmF1bHRQcmV2ZW50ZWQgfHwgZXZlbnQucmV0dXJuVmFsdWUgPT09IGZhbHNlO1xyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGVsKSB7XHJcbiAgdmFyIHRoYXQgPSB0aGlzXHJcblxyXG4gIG9uKGVsLCBcImNsaWNrXCIsIGZ1bmN0aW9uKGV2ZW50KSB7XHJcbiAgICBpZiAoaXNEZWZhdWx0UHJldmVudGVkKGV2ZW50KSkge1xyXG4gICAgICByZXR1cm5cclxuICAgIH1cclxuXHJcbiAgICBsaW5rQWN0aW9uLmNhbGwodGhhdCwgZWwsIGV2ZW50KVxyXG4gIH0pXHJcblxyXG4gIG9uKGVsLCBcImtleXVwXCIsIGZ1bmN0aW9uKGV2ZW50KSB7XHJcbiAgICBpZiAoaXNEZWZhdWx0UHJldmVudGVkKGV2ZW50KSkge1xyXG4gICAgICByZXR1cm5cclxuICAgIH1cclxuXHJcbiAgICAvLyBEb27igJl0IGJyZWFrIGJyb3dzZXIgc3BlY2lhbCBiZWhhdmlvciBvbiBsaW5rcyAobGlrZSBwYWdlIGluIG5ldyB3aW5kb3cpXHJcbiAgICBpZiAoZXZlbnQud2hpY2ggPiAxIHx8IGV2ZW50Lm1ldGFLZXkgfHwgZXZlbnQuY3RybEtleSB8fCBldmVudC5zaGlmdEtleSB8fCBldmVudC5hbHRLZXkpIHtcclxuICAgICAgZWwuc2V0QXR0cmlidXRlKGF0dHJLZXksIFwibW9kaWZpZXJcIilcclxuICAgICAgcmV0dXJuXHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGV2ZW50LmtleUNvZGUgPT0gMTMpIHtcclxuICAgICAgbGlua0FjdGlvbi5jYWxsKHRoYXQsIGVsLCBldmVudClcclxuICAgIH1cclxuICB9LmJpbmQodGhpcykpXHJcbn1cclxuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihlbCkge1xyXG4gIHJldHVybiBlbC5xdWVyeVNlbGVjdG9yQWxsKHRoaXMub3B0aW9ucy5lbGVtZW50cylcclxufVxyXG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCkge1xyXG4gIGlmICgodGhpcy5vcHRpb25zLmRlYnVnICYmIHRoaXMub3B0aW9ucy5sb2dPYmplY3QpKSB7XHJcbiAgICBpZiAodHlwZW9mIHRoaXMub3B0aW9ucy5sb2dPYmplY3QubG9nID09PSBcImZ1bmN0aW9uXCIpIHtcclxuICAgICAgdGhpcy5vcHRpb25zLmxvZ09iamVjdC5sb2cuYXBwbHkodGhpcy5vcHRpb25zLmxvZ09iamVjdCwgWydQSkFYIC0+Jyxhcmd1bWVudHNdKTtcclxuICAgIH1cclxuICAgIC8vIGllIGlzIHdlaXJkXHJcbiAgICBlbHNlIGlmICh0aGlzLm9wdGlvbnMubG9nT2JqZWN0LmxvZykge1xyXG4gICAgICB0aGlzLm9wdGlvbnMubG9nT2JqZWN0LmxvZyhbJ1BKQVggLT4nLGFyZ3VtZW50c10pO1xyXG4gICAgfVxyXG4gIH1cclxufVxyXG4iLCJ2YXIgZm9yRWFjaEVscyA9IHJlcXVpcmUoXCIuLi9mb3JlYWNoLWVsc1wiKVxyXG5cclxudmFyIHBhcnNlRWxlbWVudFVubG9hZCA9IHJlcXVpcmUoXCIuL3BhcnNlLWVsZW1lbnQtdW5sb2FkXCIpXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGVsKSB7XHJcbiAgZm9yRWFjaEVscyh0aGlzLmdldEVsZW1lbnRzKGVsKSwgcGFyc2VFbGVtZW50VW5sb2FkLCB0aGlzKVxyXG59XHJcbiIsInZhciBmb3JFYWNoRWxzID0gcmVxdWlyZShcIi4uL2ZvcmVhY2gtZWxzXCIpXHJcblxyXG52YXIgcGFyc2VFbGVtZW50ID0gcmVxdWlyZShcIi4vcGFyc2UtZWxlbWVudFwiKVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihlbCkge1xyXG4gIGZvckVhY2hFbHModGhpcy5nZXRFbGVtZW50cyhlbCksIHBhcnNlRWxlbWVudCwgdGhpcylcclxufVxyXG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGVsKSB7XHJcbiAgc3dpdGNoIChlbC50YWdOYW1lLnRvTG93ZXJDYXNlKCkpIHtcclxuICBjYXNlIFwiYVwiOlxyXG4gICAgLy8gb25seSBhdHRhY2ggbGluayBpZiBlbCBkb2VzIG5vdCBhbHJlYWR5IGhhdmUgbGluayBhdHRhY2hlZFxyXG4gICAgaWYgKCFlbC5oYXNBdHRyaWJ1dGUoJ2RhdGEtcGpheC1jbGljay1zdGF0ZScpKSB7XHJcbiAgICAgIHRoaXMudW5hdHRhY2hMaW5rKGVsKVxyXG4gICAgfVxyXG4gICAgYnJlYWtcclxuXHJcbiAgICBjYXNlIFwiZm9ybVwiOlxyXG4gICAgICAvLyBvbmx5IGF0dGFjaCBsaW5rIGlmIGVsIGRvZXMgbm90IGFscmVhZHkgaGF2ZSBsaW5rIGF0dGFjaGVkXHJcbiAgICAgIGlmICghZWwuaGFzQXR0cmlidXRlKCdkYXRhLXBqYXgtY2xpY2stc3RhdGUnKSkge1xyXG4gICAgICAgIHRoaXMudW5hdHRhY2hGb3JtKGVsKVxyXG4gICAgICB9XHJcbiAgICBicmVha1xyXG5cclxuICBkZWZhdWx0OlxyXG4gICAgdGhyb3cgXCJQamF4IGNhbiBvbmx5IGJlIGFwcGxpZWQgb24gPGE+IG9yIDxmb3JtPiBzdWJtaXRcIlxyXG4gIH1cclxufVxyXG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGVsKSB7XHJcbiAgc3dpdGNoIChlbC50YWdOYW1lLnRvTG93ZXJDYXNlKCkpIHtcclxuICBjYXNlIFwiYVwiOlxyXG4gICAgLy8gb25seSBhdHRhY2ggbGluayBpZiBlbCBkb2VzIG5vdCBhbHJlYWR5IGhhdmUgbGluayBhdHRhY2hlZFxyXG4gICAgaWYgKCFlbC5oYXNBdHRyaWJ1dGUoJ2RhdGEtcGpheC1jbGljay1zdGF0ZScpKSB7XHJcbiAgICAgIHRoaXMuYXR0YWNoTGluayhlbClcclxuICAgIH1cclxuICAgIGJyZWFrXHJcblxyXG4gICAgY2FzZSBcImZvcm1cIjpcclxuICAgICAgLy8gb25seSBhdHRhY2ggbGluayBpZiBlbCBkb2VzIG5vdCBhbHJlYWR5IGhhdmUgbGluayBhdHRhY2hlZFxyXG4gICAgICBpZiAoIWVsLmhhc0F0dHJpYnV0ZSgnZGF0YS1wamF4LWNsaWNrLXN0YXRlJykpIHtcclxuICAgICAgICB0aGlzLmF0dGFjaEZvcm0oZWwpXHJcbiAgICAgIH1cclxuICAgIGJyZWFrXHJcblxyXG4gIGRlZmF1bHQ6XHJcbiAgICB0aHJvdyBcIlBqYXggY2FuIG9ubHkgYmUgYXBwbGllZCBvbiA8YT4gb3IgPGZvcm0+IHN1Ym1pdFwiXHJcbiAgfVxyXG59XHJcbiIsIi8qIGdsb2JhbCBfZ2FxOiB0cnVlLCBnYTogdHJ1ZSAqL1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihvcHRpb25zKXtcclxuICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zXHJcbiAgdGhpcy5vcHRpb25zLmVsZW1lbnRzID0gdGhpcy5vcHRpb25zLmVsZW1lbnRzIHx8IFwiYVtocmVmXSwgZm9ybVthY3Rpb25dXCIsXHJcbiAgdGhpcy5vcHRpb25zLnJlUmVuZGVyQ1NTID0gdGhpcy5vcHRpb25zLnJlUmVuZGVyQ1NTIHx8IGZhbHNlLFxyXG4gIHRoaXMub3B0aW9ucy5mb3JjZVJlZGlyZWN0T25GYWlsID0gdGhpcy5vcHRpb25zLmZvcmNlUmVkaXJlY3RPbkZhaWwgfHwgZmFsc2UsXHJcbiAgdGhpcy5vcHRpb25zLnNjcmlwdGxvYWR0aW1lb3V0ID0gdGhpcy5vcHRpb25zLnNjcmlwdGxvYWR0aW1lb3V0IHx8IDEwMDAsXHJcbiAgdGhpcy5vcHRpb25zLm1haW5TY3JpcHRFbGVtZW50ID0gdGhpcy5vcHRpb25zLm1haW5TY3JpcHRFbGVtZW50IHx8IFwiaGVhZFwiXHJcbiAgdGhpcy5vcHRpb25zLnJlbW92ZVNjcmlwdHNBZnRlclBhcnNpbmcgPSB0aGlzLm9wdGlvbnMucmVtb3ZlU2NyaXB0c0FmdGVyUGFyc2luZyB8fCB0cnVlXHJcbiAgdGhpcy5vcHRpb25zLmxvZ09iamVjdCA9IHRoaXMub3B0aW9ucy5sb2dPYmplY3QgfHwgY29uc29sZVxyXG4gIHRoaXMub3B0aW9ucy5sYXRlc3RDaGFuY2UgPSB0aGlzLm9wdGlvbnMubGF0ZXN0Q2hhbmNlIHx8IG51bGxcclxuICB0aGlzLm9wdGlvbnMuc2VsZWN0b3JzID0gdGhpcy5vcHRpb25zLnNlbGVjdG9ycyB8fCBbXCJ0aXRsZVwiLCBcIi5qcy1QamF4XCJdXHJcbiAgdGhpcy5vcHRpb25zLnN3aXRjaGVzID0gdGhpcy5vcHRpb25zLnN3aXRjaGVzIHx8IHt9XHJcbiAgdGhpcy5vcHRpb25zLnN3aXRjaGVzT3B0aW9ucyA9IHRoaXMub3B0aW9ucy5zd2l0Y2hlc09wdGlvbnMgfHwge31cclxuICB0aGlzLm9wdGlvbnMuaGlzdG9yeSA9IHRoaXMub3B0aW9ucy5oaXN0b3J5IHx8IHRydWVcclxuICB0aGlzLm9wdGlvbnMub25Eb21EaWZmZXJzID0gdGhpcy5vcHRpb25zLm9uRG9tRGlmZmVycyB8fCBmdW5jdGlvbihvbGREb20sIG5ld0RvbSl7XHJcbiAgICByZXR1cm4gdHJ1ZTtcclxuICB9XHJcbiAgdGhpcy5vcHRpb25zLnBqYXhFcnJvckhhbmRsZXIgPSB0aGlzLm9wdGlvbnMucGpheEVycm9ySGFuZGxlciB8fCBmdW5jdGlvbihocmVmLCBvcHRpb25zLCByZXF1ZXN0RGF0YSl7XHJcbiAgICByZXR1cm4gZmFsc2U7XHJcbiAgfVxyXG4gIHRoaXMub3B0aW9ucy5vbkpzb25Eb2N1bWVudCA9IHRoaXMub3B0aW9ucy5vbkpzb25Eb2N1bWVudCB8fCBmdW5jdGlvbihqc29uRG9jdW1lbnQpe1xyXG4gICAgcmV0dXJuIHRydWU7XHJcbiAgfVxyXG4gIHRoaXMub3B0aW9ucy5hbmFseXRpY3MgPSB0aGlzLm9wdGlvbnMuYW5hbHl0aWNzIHx8IGZ1bmN0aW9uKCkge1xyXG4gICAgLy8gb3B0aW9ucy5iYWNrd2FyZCBvciBvcHRpb25zLmZvd2FyZCBjYW4gYmUgdHJ1ZSBvciB1bmRlZmluZWRcclxuICAgIC8vIGJ5IGRlZmF1bHQsIHdlIGRvIHRyYWNrIGJhY2svZm93YXJkIGhpdFxyXG4gICAgLy8gaHR0cHM6Ly9wcm9kdWN0Zm9ydW1zLmdvb2dsZS5jb20vZm9ydW0vIyF0b3BpYy9hbmFseXRpY3MvV1Z3TURqTGhYWWtcclxuICAgIGlmICh3aW5kb3cuX2dhcSkge1xyXG4gICAgICBfZ2FxLnB1c2goW1wiX3RyYWNrUGFnZXZpZXdcIl0pXHJcbiAgICB9XHJcbiAgICBpZiAod2luZG93LmdhKSB7XHJcbiAgICAgIGdhKFwic2VuZFwiLCBcInBhZ2V2aWV3XCIsIHtwYWdlOiBsb2NhdGlvbi5wYXRobmFtZSwgdGl0bGU6IGRvY3VtZW50LnRpdGxlfSlcclxuICAgIH1cclxuICB9XHJcbiAgdGhpcy5vcHRpb25zLnNjcm9sbFRvID0gKHR5cGVvZiB0aGlzLm9wdGlvbnMuc2Nyb2xsVG8gPT09ICd1bmRlZmluZWQnKSA/IDAgOiB0aGlzLm9wdGlvbnMuc2Nyb2xsVG87XHJcbiAgdGhpcy5vcHRpb25zLmNhY2hlQnVzdCA9ICh0eXBlb2YgdGhpcy5vcHRpb25zLmNhY2hlQnVzdCA9PT0gJ3VuZGVmaW5lZCcpID8gdHJ1ZSA6IHRoaXMub3B0aW9ucy5jYWNoZUJ1c3RcclxuICB0aGlzLm9wdGlvbnMuZGVidWcgPSB0aGlzLm9wdGlvbnMuZGVidWcgfHwgZmFsc2VcclxuXHJcbiAgLy8gd2UgY2Fu4oCZdCByZXBsYWNlIGJvZHkub3V0ZXJIVE1MIG9yIGhlYWQub3V0ZXJIVE1MXHJcbiAgLy8gaXQgY3JlYXRlIGEgYnVnIHdoZXJlIG5ldyBib2R5IG9yIG5ldyBoZWFkIGFyZSBjcmVhdGVkIGluIHRoZSBkb21cclxuICAvLyBpZiB5b3Ugc2V0IGhlYWQub3V0ZXJIVE1MLCBhIG5ldyBib2R5IHRhZyBpcyBhcHBlbmRlZCwgc28gdGhlIGRvbSBnZXQgMiBib2R5XHJcbiAgLy8gJiBpdCBicmVhayB0aGUgc3dpdGNoRmFsbGJhY2sgd2hpY2ggcmVwbGFjZSBoZWFkICYgYm9keVxyXG4gIGlmICghdGhpcy5vcHRpb25zLnN3aXRjaGVzLmhlYWQpIHtcclxuICAgIHRoaXMub3B0aW9ucy5zd2l0Y2hlcy5oZWFkID0gdGhpcy5zd2l0Y2hFbGVtZW50c0FsdFxyXG4gIH1cclxuICBpZiAoIXRoaXMub3B0aW9ucy5zd2l0Y2hlcy5ib2R5KSB7XHJcbiAgICB0aGlzLm9wdGlvbnMuc3dpdGNoZXMuYm9keSA9IHRoaXMuc3dpdGNoRWxlbWVudHNBbHRcclxuICB9XHJcbiAgaWYgKHR5cGVvZiBvcHRpb25zLmFuYWx5dGljcyAhPT0gXCJmdW5jdGlvblwiKSB7XHJcbiAgICBvcHRpb25zLmFuYWx5dGljcyA9IGZ1bmN0aW9uKCkge31cclxuICB9XHJcbn1cclxuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihlbCkge1xyXG4gIHRoaXMucGFyc2VET00oZWwgfHwgZG9jdW1lbnQpXHJcbn1cclxuIiwicmVxdWlyZShcIi4uL3BvbHlmaWxscy9GdW5jdGlvbi5wcm90b3R5cGUuYmluZFwiKVxyXG5cclxudmFyIG9mZiA9IHJlcXVpcmUoXCIuLi9ldmVudHMvb2ZmXCIpXHJcbnZhciBjbG9uZSA9IHJlcXVpcmUoXCIuLi9jbG9uZVwiKVxyXG5cclxudmFyIGF0dHJDbGljayA9IFwiZGF0YS1wamF4LWNsaWNrLXN0YXRlXCJcclxuXHJcbnZhciBmb3JtQWN0aW9uID0gZnVuY3Rpb24oZWwsIGV2ZW50KXtcclxuXHJcbiAgdGhpcy5vcHRpb25zLnJlcXVlc3RPcHRpb25zID0ge1xyXG4gICAgcmVxdWVzdFVybCA6IGVsLmdldEF0dHJpYnV0ZSgnYWN0aW9uJykgfHwgd2luZG93LmxvY2F0aW9uLmhyZWYsXHJcbiAgICByZXF1ZXN0TWV0aG9kIDogZWwuZ2V0QXR0cmlidXRlKCdtZXRob2QnKSB8fCAnR0VUJyxcclxuICB9XHJcblxyXG4gIC8vY3JlYXRlIGEgdGVzdGFibGUgdmlydHVhbCBsaW5rIG9mIHRoZSBmb3JtIGFjdGlvblxyXG4gIHZhciB2aXJ0TGlua0VsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhJyk7XHJcbiAgdmlydExpbmtFbGVtZW50LnNldEF0dHJpYnV0ZSgnaHJlZicsIHRoaXMub3B0aW9ucy5yZXF1ZXN0T3B0aW9ucy5yZXF1ZXN0VXJsKTtcclxuXHJcbiAgLy8gSWdub3JlIGV4dGVybmFsIGxpbmtzLlxyXG4gIGlmICh2aXJ0TGlua0VsZW1lbnQucHJvdG9jb2wgIT09IHdpbmRvdy5sb2NhdGlvbi5wcm90b2NvbCB8fCB2aXJ0TGlua0VsZW1lbnQuaG9zdCAhPT0gd2luZG93LmxvY2F0aW9uLmhvc3QpIHtcclxuICAgIGVsLnNldEF0dHJpYnV0ZShhdHRyQ2xpY2ssIFwiZXh0ZXJuYWxcIik7XHJcbiAgICByZXR1cm5cclxuICB9XHJcblxyXG4gIC8vIElnbm9yZSBjbGljayBpZiB3ZSBhcmUgb24gYW4gYW5jaG9yIG9uIHRoZSBzYW1lIHBhZ2VcclxuICBpZiAodmlydExpbmtFbGVtZW50LnBhdGhuYW1lID09PSB3aW5kb3cubG9jYXRpb24ucGF0aG5hbWUgJiYgdmlydExpbmtFbGVtZW50Lmhhc2gubGVuZ3RoID4gMCkge1xyXG4gICAgZWwuc2V0QXR0cmlidXRlKGF0dHJDbGljaywgXCJhbmNob3ItcHJlc2VudFwiKTtcclxuICAgIHJldHVyblxyXG4gIH1cclxuXHJcbiAgLy8gSWdub3JlIGVtcHR5IGFuY2hvciBcImZvby5odG1sI1wiXHJcbiAgaWYgKHZpcnRMaW5rRWxlbWVudC5ocmVmID09PSB3aW5kb3cubG9jYXRpb24uaHJlZi5zcGxpdChcIiNcIilbMF0gKyBcIiNcIikge1xyXG4gICAgZWwuc2V0QXR0cmlidXRlKGF0dHJDbGljaywgXCJhbmNob3ItZW1wdHlcIilcclxuICAgIHJldHVyblxyXG4gIH1cclxuXHJcbiAgLy8gaWYgZGVjbGFyZWQgYXMgYSBmdWxsIHJlbG9hZCwganVzdCBub3JtYWxseSBzdWJtaXQgdGhlIGZvcm1cclxuICBpZiAoIHRoaXMub3B0aW9ucy5jdXJyZW50VXJsRnVsbFJlbG9hZCkge1xyXG4gICAgZWwuc2V0QXR0cmlidXRlKGF0dHJDbGljaywgXCJyZWxvYWRcIik7XHJcbiAgICByZXR1cm47XHJcbiAgfVxyXG5cclxuICBldmVudC5wcmV2ZW50RGVmYXVsdCgpXHJcbiAgdmFyIG5hbWVMaXN0ID0gW107XHJcbiAgdmFyIHBhcmFtT2JqZWN0ID0gW107XHJcbiAgZm9yKHZhciBlbGVtZW50S2V5IGluIGVsLmVsZW1lbnRzKSB7XHJcbiAgICB2YXIgZWxlbWVudCA9IGVsLmVsZW1lbnRzW2VsZW1lbnRLZXldO1xyXG4gICAgaWYgKCEhZWxlbWVudC5uYW1lICYmIGVsZW1lbnQuYXR0cmlidXRlcyAhPT0gdW5kZWZpbmVkICYmIGVsZW1lbnQudGFnTmFtZS50b0xvd2VyQ2FzZSgpICE9PSAnYnV0dG9uJyl7XHJcbiAgICAgIGlmIChcclxuICAgICAgICAoZWxlbWVudC50eXBlICE9PSAnY2hlY2tib3gnICYmIGVsZW1lbnQudHlwZSAhPT0gJ3JhZGlvJykgfHwgZWxlbWVudC5jaGVja2VkXHJcbiAgICAgICkge1xyXG4gICAgICAgIGlmKG5hbWVMaXN0LmluZGV4T2YoZWxlbWVudC5uYW1lKSA9PT0gLTEpe1xyXG4gICAgICAgICAgbmFtZUxpc3QucHVzaChlbGVtZW50Lm5hbWUpO1xyXG4gICAgICAgICAgcGFyYW1PYmplY3QucHVzaCh7IG5hbWU6IGVuY29kZVVSSUNvbXBvbmVudChlbGVtZW50Lm5hbWUpLCB2YWx1ZTogZW5jb2RlVVJJQ29tcG9uZW50KGVsZW1lbnQudmFsdWUpfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuXHJcblxyXG4gIC8vQ3JlYXRpbmcgYSBnZXRTdHJpbmdcclxuICB2YXIgcGFyYW1zU3RyaW5nID0gKHBhcmFtT2JqZWN0Lm1hcChmdW5jdGlvbih2YWx1ZSl7cmV0dXJuIHZhbHVlLm5hbWUrXCI9XCIrdmFsdWUudmFsdWU7fSkpLmpvaW4oJyYnKTtcclxuXHJcbiAgdGhpcy5vcHRpb25zLnJlcXVlc3RPcHRpb25zLnJlcXVlc3RQYXlsb2FkID0gcGFyYW1PYmplY3Q7XHJcbiAgdGhpcy5vcHRpb25zLnJlcXVlc3RPcHRpb25zLnJlcXVlc3RQYXlsb2FkU3RyaW5nID0gcGFyYW1zU3RyaW5nO1xyXG5cclxuICBlbC5zZXRBdHRyaWJ1dGUoYXR0ckNsaWNrLCBcInN1Ym1pdFwiKTtcclxuXHJcbiAgdGhpcy5sb2FkVXJsKHZpcnRMaW5rRWxlbWVudC5ocmVmLCBjbG9uZSh0aGlzLm9wdGlvbnMpKVxyXG5cclxufTtcclxuXHJcbnZhciBpc0RlZmF1bHRQcmV2ZW50ZWQgPSBmdW5jdGlvbihldmVudCkge1xyXG4gIHJldHVybiBldmVudC5kZWZhdWx0UHJldmVudGVkIHx8IGV2ZW50LnJldHVyblZhbHVlID09PSBmYWxzZTtcclxufTtcclxuXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGVsKSB7XHJcbiAgdmFyIHRoYXQgPSB0aGlzXHJcblxyXG4gIG9mZihlbCwgXCJzdWJtaXRcIiwgZnVuY3Rpb24oZXZlbnQpIHtcclxuICAgIGlmIChpc0RlZmF1bHRQcmV2ZW50ZWQoZXZlbnQpKSB7XHJcbiAgICAgIHJldHVyblxyXG4gICAgfVxyXG5cclxuICAgIGZvcm1BY3Rpb24uY2FsbCh0aGF0LCBlbCwgZXZlbnQpXHJcbiAgfSlcclxuXHJcbiAgb2ZmKGVsLCBcImtleXVwXCIsIGZ1bmN0aW9uKGV2ZW50KSB7XHJcbiAgICBpZiAoaXNEZWZhdWx0UHJldmVudGVkKGV2ZW50KSkge1xyXG4gICAgICByZXR1cm5cclxuICAgIH1cclxuXHJcblxyXG4gICAgaWYgKGV2ZW50LmtleUNvZGUgPT0gMTMpIHtcclxuICAgICAgZm9ybUFjdGlvbi5jYWxsKHRoYXQsIGVsLCBldmVudClcclxuICAgIH1cclxuICB9LmJpbmQodGhpcykpXHJcbn1cclxuIiwicmVxdWlyZShcIi4uL3BvbHlmaWxscy9GdW5jdGlvbi5wcm90b3R5cGUuYmluZFwiKVxyXG5cclxudmFyIG9mZiA9IHJlcXVpcmUoXCIuLi9ldmVudHMvb2ZmXCIpXHJcbnZhciBjbG9uZSA9IHJlcXVpcmUoXCIuLi9jbG9uZVwiKVxyXG5cclxudmFyIGF0dHJDbGljayA9IFwiZGF0YS1wamF4LWNsaWNrLXN0YXRlXCJcclxudmFyIGF0dHJLZXkgPSBcImRhdGEtcGpheC1rZXl1cC1zdGF0ZVwiXHJcblxyXG52YXIgbGlua0FjdGlvbiA9IGZ1bmN0aW9uKGVsLCBldmVudCkge1xyXG4gIC8vIERvbuKAmXQgYnJlYWsgYnJvd3NlciBzcGVjaWFsIGJlaGF2aW9yIG9uIGxpbmtzIChsaWtlIHBhZ2UgaW4gbmV3IHdpbmRvdylcclxuICBpZiAoZXZlbnQud2hpY2ggPiAxIHx8IGV2ZW50Lm1ldGFLZXkgfHwgZXZlbnQuY3RybEtleSB8fCBldmVudC5zaGlmdEtleSB8fCBldmVudC5hbHRLZXkpIHtcclxuICAgIGVsLnNldEF0dHJpYnV0ZShhdHRyQ2xpY2ssIFwibW9kaWZpZXJcIilcclxuICAgIHJldHVyblxyXG4gIH1cclxuXHJcbiAgLy8gd2UgZG8gdGVzdCBvbiBocmVmIG5vdyB0byBwcmV2ZW50IHVuZXhwZWN0ZWQgYmVoYXZpb3IgaWYgZm9yIHNvbWUgcmVhc29uXHJcbiAgLy8gdXNlciBoYXZlIGhyZWYgdGhhdCBjYW4gYmUgZHluYW1pY2FsbHkgdXBkYXRlZFxyXG5cclxuICAvLyBJZ25vcmUgZXh0ZXJuYWwgbGlua3MuXHJcbiAgaWYgKGVsLnByb3RvY29sICE9PSB3aW5kb3cubG9jYXRpb24ucHJvdG9jb2wgfHwgZWwuaG9zdCAhPT0gd2luZG93LmxvY2F0aW9uLmhvc3QpIHtcclxuICAgIGVsLnNldEF0dHJpYnV0ZShhdHRyQ2xpY2ssIFwiZXh0ZXJuYWxcIilcclxuICAgIHJldHVyblxyXG4gIH1cclxuXHJcbiAgLy8gSWdub3JlIGNsaWNrIGlmIHdlIGFyZSBvbiBhbiBhbmNob3Igb24gdGhlIHNhbWUgcGFnZVxyXG4gIGlmIChlbC5wYXRobmFtZSA9PT0gd2luZG93LmxvY2F0aW9uLnBhdGhuYW1lICYmIGVsLmhhc2gubGVuZ3RoID4gMCkge1xyXG4gICAgZWwuc2V0QXR0cmlidXRlKGF0dHJDbGljaywgXCJhbmNob3ItcHJlc2VudFwiKVxyXG4gICAgcmV0dXJuXHJcbiAgfVxyXG5cclxuICAvLyBJZ25vcmUgYW5jaG9ycyBvbiB0aGUgc2FtZSBwYWdlIChrZWVwIG5hdGl2ZSBiZWhhdmlvcilcclxuICBpZiAoZWwuaGFzaCAmJiBlbC5ocmVmLnJlcGxhY2UoZWwuaGFzaCwgXCJcIikgPT09IHdpbmRvdy5sb2NhdGlvbi5ocmVmLnJlcGxhY2UobG9jYXRpb24uaGFzaCwgXCJcIikpIHtcclxuICAgIGVsLnNldEF0dHJpYnV0ZShhdHRyQ2xpY2ssIFwiYW5jaG9yXCIpXHJcbiAgICByZXR1cm5cclxuICB9XHJcblxyXG4gIC8vIElnbm9yZSBlbXB0eSBhbmNob3IgXCJmb28uaHRtbCNcIlxyXG4gIGlmIChlbC5ocmVmID09PSB3aW5kb3cubG9jYXRpb24uaHJlZi5zcGxpdChcIiNcIilbMF0gKyBcIiNcIikge1xyXG4gICAgZWwuc2V0QXR0cmlidXRlKGF0dHJDbGljaywgXCJhbmNob3ItZW1wdHlcIilcclxuICAgIHJldHVyblxyXG4gIH1cclxuXHJcbiAgZXZlbnQucHJldmVudERlZmF1bHQoKVxyXG5cclxuICAvLyBkb27igJl0IGRvIFwibm90aGluZ1wiIGlmIHVzZXIgdHJ5IHRvIHJlbG9hZCB0aGUgcGFnZSBieSBjbGlja2luZyB0aGUgc2FtZSBsaW5rIHR3aWNlXHJcbiAgaWYgKFxyXG4gICAgdGhpcy5vcHRpb25zLmN1cnJlbnRVcmxGdWxsUmVsb2FkICYmXHJcbiAgICBlbC5ocmVmID09PSB3aW5kb3cubG9jYXRpb24uaHJlZi5zcGxpdChcIiNcIilbMF1cclxuICApIHtcclxuICAgIGVsLnNldEF0dHJpYnV0ZShhdHRyQ2xpY2ssIFwicmVsb2FkXCIpXHJcbiAgICB0aGlzLnJlbG9hZCgpXHJcbiAgICByZXR1cm5cclxuICB9XHJcbiAgdGhpcy5vcHRpb25zLnJlcXVlc3RPcHRpb25zID0gdGhpcy5vcHRpb25zLnJlcXVlc3RPcHRpb25zIHx8IHt9O1xyXG4gIGVsLnNldEF0dHJpYnV0ZShhdHRyQ2xpY2ssIFwibG9hZFwiKVxyXG4gIHRoaXMubG9hZFVybChlbC5ocmVmLCBjbG9uZSh0aGlzLm9wdGlvbnMpKVxyXG59XHJcblxyXG52YXIgaXNEZWZhdWx0UHJldmVudGVkID0gZnVuY3Rpb24oZXZlbnQpIHtcclxuICByZXR1cm4gZXZlbnQuZGVmYXVsdFByZXZlbnRlZCB8fCBldmVudC5yZXR1cm5WYWx1ZSA9PT0gZmFsc2U7XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oZWwpIHtcclxuICB2YXIgdGhhdCA9IHRoaXNcclxuXHJcbiAgb2ZmKGVsLCBcImNsaWNrXCIsIGZ1bmN0aW9uKGV2ZW50KSB7XHJcbiAgICBpZiAoaXNEZWZhdWx0UHJldmVudGVkKGV2ZW50KSkge1xyXG4gICAgICByZXR1cm5cclxuICAgIH1cclxuXHJcbiAgICBsaW5rQWN0aW9uLmNhbGwodGhhdCwgZWwsIGV2ZW50KVxyXG4gIH0pXHJcblxyXG4gIG9mZihlbCwgXCJrZXl1cFwiLCBmdW5jdGlvbihldmVudCkge1xyXG4gICAgaWYgKGlzRGVmYXVsdFByZXZlbnRlZChldmVudCkpIHtcclxuICAgICAgcmV0dXJuXHJcbiAgICB9XHJcblxyXG4gICAgLy8gRG9u4oCZdCBicmVhayBicm93c2VyIHNwZWNpYWwgYmVoYXZpb3Igb24gbGlua3MgKGxpa2UgcGFnZSBpbiBuZXcgd2luZG93KVxyXG4gICAgaWYgKGV2ZW50LndoaWNoID4gMSB8fCBldmVudC5tZXRhS2V5IHx8IGV2ZW50LmN0cmxLZXkgfHwgZXZlbnQuc2hpZnRLZXkgfHwgZXZlbnQuYWx0S2V5KSB7XHJcbiAgICAgIGVsLnNldEF0dHJpYnV0ZShhdHRyS2V5LCBcIm1vZGlmaWVyXCIpXHJcbiAgICAgIHJldHVyblxyXG4gICAgfVxyXG5cclxuICAgIGlmIChldmVudC5rZXlDb2RlID09IDEzKSB7XHJcbiAgICAgIGxpbmtBY3Rpb24uY2FsbCh0aGF0LCBlbCwgZXZlbnQpXHJcbiAgICB9XHJcbiAgfS5iaW5kKHRoaXMpKVxyXG59XHJcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oKSB7XHJcbiAgd2luZG93LmxvY2F0aW9uLnJlbG9hZCgpXHJcbn1cclxuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihsb2NhdGlvbiwgb3B0aW9ucywgY2FsbGJhY2spIHtcclxuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcclxuICB2YXIgcmVxdWVzdE1ldGhvZCA9IG9wdGlvbnMucmVxdWVzdE1ldGhvZCB8fCBcIkdFVFwiO1xyXG4gIHZhciByZXF1ZXN0UGF5bG9hZCA9IG9wdGlvbnMucmVxdWVzdFBheWxvYWRTdHJpbmcgfHwgbnVsbDtcclxuICB2YXIgcmVxdWVzdCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpXHJcblxyXG4gIHJlcXVlc3Qub25yZWFkeXN0YXRlY2hhbmdlID0gZnVuY3Rpb24oKSB7XHJcbiAgICBpZiAocmVxdWVzdC5yZWFkeVN0YXRlID09PSA0KSB7XHJcbiAgICAgIGlmIChyZXF1ZXN0LnN0YXR1cyA9PT0gMjAwKSB7XHJcbiAgICAgICAgY2FsbGJhY2socmVxdWVzdC5yZXNwb25zZVRleHQsIHJlcXVlc3QpXHJcbiAgICAgIH1cclxuICAgICAgZWxzZSB7XHJcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgcmVxdWVzdClcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLy8gQWRkIGEgdGltZXN0YW1wIGFzIHBhcnQgb2YgdGhlIHF1ZXJ5IHN0cmluZyBpZiBjYWNoZSBidXN0aW5nIGlzIGVuYWJsZWRcclxuICBpZiAodGhpcy5vcHRpb25zLmNhY2hlQnVzdCkge1xyXG4gICAgbG9jYXRpb24gKz0gKCEvWz8mXS8udGVzdChsb2NhdGlvbikgPyBcIj9cIiA6IFwiJlwiKSArIG5ldyBEYXRlKCkuZ2V0VGltZSgpXHJcbiAgfVxyXG5cclxuICByZXF1ZXN0Lm9wZW4ocmVxdWVzdE1ldGhvZC50b1VwcGVyQ2FzZSgpLCBsb2NhdGlvbiwgdHJ1ZSlcclxuICByZXF1ZXN0LnNldFJlcXVlc3RIZWFkZXIoXCJYLVJlcXVlc3RlZC1XaXRoXCIsIFwiWE1MSHR0cFJlcXVlc3RcIilcclxuXHJcbiAgLy8gQWRkIHRoZSByZXF1ZXN0IHBheWxvYWQgaWYgYXZhaWxhYmxlXHJcbiAgaWYgKG9wdGlvbnMucmVxdWVzdFBheWxvYWRTdHJpbmcgIT0gdW5kZWZpbmVkICYmIG9wdGlvbnMucmVxdWVzdFBheWxvYWRTdHJpbmcgIT0gXCJcIikge1xyXG4gICAgLy8gU2VuZCB0aGUgcHJvcGVyIGhlYWRlciBpbmZvcm1hdGlvbiBhbG9uZyB3aXRoIHRoZSByZXF1ZXN0XHJcbiAgICByZXF1ZXN0LnNldFJlcXVlc3RIZWFkZXIoXCJDb250ZW50LXR5cGVcIiwgXCJhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWRcIik7XHJcbiAgfVxyXG5cclxuICByZXF1ZXN0LnNlbmQocmVxdWVzdFBheWxvYWQpXHJcblxyXG4gIHJldHVybiByZXF1ZXN0XHJcbn1cclxuIiwidmFyIGZvckVhY2hFbHMgPSByZXF1aXJlKFwiLi9mb3JlYWNoLWVsc1wiKVxyXG5cclxudmFyIGRlZmF1bHRTd2l0Y2hlcyA9IHJlcXVpcmUoXCIuL3N3aXRjaGVzXCIpXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHN3aXRjaGVzLCBzd2l0Y2hlc09wdGlvbnMsIHNlbGVjdG9ycywgZnJvbUVsLCB0b0VsLCBvcHRpb25zKSB7XHJcbiAgc2VsZWN0b3JzLmZvckVhY2goZnVuY3Rpb24oc2VsZWN0b3IpIHtcclxuICAgIHZhciBuZXdFbHMgPSBmcm9tRWwucXVlcnlTZWxlY3RvckFsbChzZWxlY3RvcilcclxuICAgIHZhciBvbGRFbHMgPSB0b0VsLnF1ZXJ5U2VsZWN0b3JBbGwoc2VsZWN0b3IpXHJcbiAgICBpZiAodGhpcy5sb2cpIHtcclxuICAgICAgdGhpcy5sb2coXCJQamF4IHN3aXRjaFwiLCBzZWxlY3RvciwgbmV3RWxzLCBvbGRFbHMpXHJcbiAgICB9XHJcbiAgICBpZiAobmV3RWxzLmxlbmd0aCAhPT0gb2xkRWxzLmxlbmd0aCkge1xyXG4gICAgICB2YXIgdGhyb3dFcnJvciA9IG9wdGlvbnMub25Eb21EaWZmZXJzKHRvRWwsIGZyb21FbCk7XHJcbiAgICAgIGlmKHRocm93RXJyb3IpIHtcclxuICAgICAgICB0aHJvdyBcIkRPTSBkb2VzbuKAmXQgbG9vayB0aGUgc2FtZSBvbiBuZXcgbG9hZGVkIHBhZ2U6IOKAmVwiICsgc2VsZWN0b3IgKyBcIuKAmSAtIG5ldyBcIiArIG5ld0Vscy5sZW5ndGggKyBcIiwgb2xkIFwiICsgb2xkRWxzLmxlbmd0aDtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGZvckVhY2hFbHMobmV3RWxzLCBmdW5jdGlvbihuZXdFbCwgaSkge1xyXG4gICAgICB2YXIgb2xkRWwgPSBvbGRFbHNbaV1cclxuICAgICAgaWYgKHRoaXMubG9nKSB7XHJcbiAgICAgICAgdGhpcy5sb2coXCJuZXdFbFwiLCBuZXdFbCwgXCJvbGRFbFwiLCBvbGRFbClcclxuICAgICAgfVxyXG4gICAgICBpZiAoc3dpdGNoZXNbc2VsZWN0b3JdKSB7XHJcbiAgICAgICAgc3dpdGNoZXNbc2VsZWN0b3JdLmJpbmQodGhpcykob2xkRWwsIG5ld0VsLCBvcHRpb25zLCBzd2l0Y2hlc09wdGlvbnNbc2VsZWN0b3JdKVxyXG4gICAgICB9XHJcbiAgICAgIGVsc2Uge1xyXG4gICAgICAgIGRlZmF1bHRTd2l0Y2hlcy5vdXRlckhUTUwuYmluZCh0aGlzKShvbGRFbCwgbmV3RWwsIG9wdGlvbnMpXHJcbiAgICAgIH1cclxuICAgIH0sIHRoaXMpXHJcbiAgfSwgdGhpcylcclxufVxyXG4iLCJ2YXIgb24gPSByZXF1aXJlKFwiLi9ldmVudHMvb24uanNcIilcclxuLy8gdmFyIG9mZiA9IHJlcXVpcmUoXCIuL2xpYi9ldmVudHMvb24uanNcIilcclxuLy8gdmFyIHRyaWdnZXIgPSByZXF1aXJlKFwiLi9saWIvZXZlbnRzL3RyaWdnZXIuanNcIilcclxuXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuICBvdXRlckhUTUw6IGZ1bmN0aW9uKG9sZEVsLCBuZXdFbCkge1xyXG4gICAgb2xkRWwub3V0ZXJIVE1MID0gbmV3RWwub3V0ZXJIVE1MXHJcbiAgICB0aGlzLm9uU3dpdGNoKClcclxuICB9LFxyXG5cclxuICBpbm5lckhUTUw6IGZ1bmN0aW9uKG9sZEVsLCBuZXdFbCkge1xyXG4gICAgb2xkRWwuaW5uZXJIVE1MID0gbmV3RWwuaW5uZXJIVE1MXHJcbiAgICBvbGRFbC5jbGFzc05hbWUgPSBuZXdFbC5jbGFzc05hbWVcclxuICAgIHRoaXMub25Td2l0Y2goKVxyXG4gIH0sXHJcblxyXG4gIHNpZGVCeVNpZGU6IGZ1bmN0aW9uKG9sZEVsLCBuZXdFbCwgb3B0aW9ucywgc3dpdGNoT3B0aW9ucykge1xyXG4gICAgdmFyIGZvckVhY2ggPSBBcnJheS5wcm90b3R5cGUuZm9yRWFjaFxyXG4gICAgdmFyIGVsc1RvUmVtb3ZlID0gW11cclxuICAgIHZhciBlbHNUb0FkZCA9IFtdXHJcbiAgICB2YXIgZnJhZ1RvQXBwZW5kID0gZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpXHJcbiAgICAvLyBoZWlnaHQgdHJhbnNpdGlvbiBhcmUgc2hpdHR5IG9uIHNhZmFyaVxyXG4gICAgLy8gc28gY29tbWVudGVkIGZvciBub3cgKHVudGlsIEkgZm91bmQgc29tZXRoaW5nID8pXHJcbiAgICAvLyB2YXIgcmVsZXZhbnRIZWlnaHQgPSAwXHJcbiAgICB2YXIgYW5pbWF0aW9uRXZlbnROYW1lcyA9IFwiYW5pbWF0aW9uZW5kIHdlYmtpdEFuaW1hdGlvbkVuZCBNU0FuaW1hdGlvbkVuZCBvYW5pbWF0aW9uZW5kXCJcclxuICAgIHZhciBhbmltYXRlZEVsc051bWJlciA9IDBcclxuICAgIHZhciBzZXh5QW5pbWF0aW9uRW5kID0gZnVuY3Rpb24oZSkge1xyXG4gICAgICAgICAgaWYgKGUudGFyZ2V0ICE9IGUuY3VycmVudFRhcmdldCkge1xyXG4gICAgICAgICAgICAvLyBlbmQgdHJpZ2dlcmVkIGJ5IGFuIGFuaW1hdGlvbiBvbiBhIGNoaWxkXHJcbiAgICAgICAgICAgIHJldHVyblxyXG4gICAgICAgICAgfVxyXG5cclxuICAgICAgICAgIGFuaW1hdGVkRWxzTnVtYmVyLS1cclxuICAgICAgICAgIGlmIChhbmltYXRlZEVsc051bWJlciA8PSAwICYmIGVsc1RvUmVtb3ZlKSB7XHJcbiAgICAgICAgICAgIGVsc1RvUmVtb3ZlLmZvckVhY2goZnVuY3Rpb24oZWwpIHtcclxuICAgICAgICAgICAgICAvLyBicm93c2luZyBxdWlja2x5IGNhbiBtYWtlIHRoZSBlbFxyXG4gICAgICAgICAgICAgIC8vIGFscmVhZHkgcmVtb3ZlZCBieSBsYXN0IHBhZ2UgdXBkYXRlID9cclxuICAgICAgICAgICAgICBpZiAoZWwucGFyZW50Tm9kZSkge1xyXG4gICAgICAgICAgICAgICAgZWwucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChlbClcclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pXHJcblxyXG4gICAgICAgICAgICBlbHNUb0FkZC5mb3JFYWNoKGZ1bmN0aW9uKGVsKSB7XHJcbiAgICAgICAgICAgICAgZWwuY2xhc3NOYW1lID0gZWwuY2xhc3NOYW1lLnJlcGxhY2UoZWwuZ2V0QXR0cmlidXRlKFwiZGF0YS1wamF4LWNsYXNzZXNcIiksIFwiXCIpXHJcbiAgICAgICAgICAgICAgZWwucmVtb3ZlQXR0cmlidXRlKFwiZGF0YS1wamF4LWNsYXNzZXNcIilcclxuICAgICAgICAgICAgICAvLyBQamF4Lm9mZihlbCwgYW5pbWF0aW9uRXZlbnROYW1lcywgc2V4eUFuaW1hdGlvbkVuZCwgdHJ1ZSlcclxuICAgICAgICAgICAgfSlcclxuXHJcbiAgICAgICAgICAgIGVsc1RvQWRkID0gbnVsbCAvLyBmcmVlIG1lbW9yeVxyXG4gICAgICAgICAgICBlbHNUb1JlbW92ZSA9IG51bGwgLy8gZnJlZSBtZW1vcnlcclxuXHJcbiAgICAgICAgICAgIC8vIGFzc3VtZSB0aGUgaGVpZ2h0IGlzIG5vdyB1c2VsZXNzIChhdm9pZCBidWcgc2luY2UgdGhlcmUgaXMgb3ZlcmZsb3cgaGlkZGVuIG9uIHRoZSBwYXJlbnQpXHJcbiAgICAgICAgICAgIC8vIG9sZEVsLnN0eWxlLmhlaWdodCA9IFwiYXV0b1wiXHJcblxyXG4gICAgICAgICAgICAvLyB0aGlzIGlzIHRvIHRyaWdnZXIgc29tZSByZXBhaW50IChleGFtcGxlOiBwaWN0dXJlZmlsbClcclxuICAgICAgICAgICAgdGhpcy5vblN3aXRjaCgpXHJcbiAgICAgICAgICAgIC8vIFBqYXgudHJpZ2dlcih3aW5kb3csIFwic2Nyb2xsXCIpXHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfS5iaW5kKHRoaXMpXHJcblxyXG4gICAgLy8gRm9yY2UgaGVpZ2h0IHRvIGJlIGFibGUgdG8gdHJpZ2dlciBjc3MgYW5pbWF0aW9uXHJcbiAgICAvLyBoZXJlIHdlIGdldCB0aGUgcmVsZXZhbnQgaGVpZ2h0XHJcbiAgICAvLyBvbGRFbC5wYXJlbnROb2RlLmFwcGVuZENoaWxkKG5ld0VsKVxyXG4gICAgLy8gcmVsZXZhbnRIZWlnaHQgPSBuZXdFbC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS5oZWlnaHRcclxuICAgIC8vIG9sZEVsLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQobmV3RWwpXHJcbiAgICAvLyBvbGRFbC5zdHlsZS5oZWlnaHQgPSBvbGRFbC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS5oZWlnaHQgKyBcInB4XCJcclxuXHJcbiAgICBzd2l0Y2hPcHRpb25zID0gc3dpdGNoT3B0aW9ucyB8fCB7fVxyXG5cclxuICAgIGZvckVhY2guY2FsbChvbGRFbC5jaGlsZE5vZGVzLCBmdW5jdGlvbihlbCkge1xyXG4gICAgICBlbHNUb1JlbW92ZS5wdXNoKGVsKVxyXG4gICAgICBpZiAoZWwuY2xhc3NMaXN0ICYmICFlbC5jbGFzc0xpc3QuY29udGFpbnMoXCJqcy1QamF4LXJlbW92ZVwiKSkge1xyXG4gICAgICAgIC8vIGZvciBmYXN0IHN3aXRjaCwgY2xlYW4gZWxlbWVudCB0aGF0IGp1c3QgaGF2ZSBiZWVuIGFkZGVkLCAmIG5vdCBjbGVhbmVkIHlldC5cclxuICAgICAgICBpZiAoZWwuaGFzQXR0cmlidXRlKFwiZGF0YS1wamF4LWNsYXNzZXNcIikpIHtcclxuICAgICAgICAgIGVsLmNsYXNzTmFtZSA9IGVsLmNsYXNzTmFtZS5yZXBsYWNlKGVsLmdldEF0dHJpYnV0ZShcImRhdGEtcGpheC1jbGFzc2VzXCIpLCBcIlwiKVxyXG4gICAgICAgICAgZWwucmVtb3ZlQXR0cmlidXRlKFwiZGF0YS1wamF4LWNsYXNzZXNcIilcclxuICAgICAgICB9XHJcbiAgICAgICAgZWwuY2xhc3NMaXN0LmFkZChcImpzLVBqYXgtcmVtb3ZlXCIpXHJcbiAgICAgICAgaWYgKHN3aXRjaE9wdGlvbnMuY2FsbGJhY2tzICYmIHN3aXRjaE9wdGlvbnMuY2FsbGJhY2tzLnJlbW92ZUVsZW1lbnQpIHtcclxuICAgICAgICAgIHN3aXRjaE9wdGlvbnMuY2FsbGJhY2tzLnJlbW92ZUVsZW1lbnQoZWwpXHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChzd2l0Y2hPcHRpb25zLmNsYXNzTmFtZXMpIHtcclxuICAgICAgICAgIGVsLmNsYXNzTmFtZSArPSBcIiBcIiArIHN3aXRjaE9wdGlvbnMuY2xhc3NOYW1lcy5yZW1vdmUgKyBcIiBcIiArIChvcHRpb25zLmJhY2t3YXJkID8gc3dpdGNoT3B0aW9ucy5jbGFzc05hbWVzLmJhY2t3YXJkIDogc3dpdGNoT3B0aW9ucy5jbGFzc05hbWVzLmZvcndhcmQpXHJcbiAgICAgICAgfVxyXG4gICAgICAgIGFuaW1hdGVkRWxzTnVtYmVyKytcclxuICAgICAgICBvbihlbCwgYW5pbWF0aW9uRXZlbnROYW1lcywgc2V4eUFuaW1hdGlvbkVuZCwgdHJ1ZSlcclxuICAgICAgfVxyXG4gICAgfSlcclxuXHJcbiAgICBmb3JFYWNoLmNhbGwobmV3RWwuY2hpbGROb2RlcywgZnVuY3Rpb24oZWwpIHtcclxuICAgICAgaWYgKGVsLmNsYXNzTGlzdCkge1xyXG4gICAgICAgIHZhciBhZGRDbGFzc2VzID0gXCJcIlxyXG4gICAgICAgIGlmIChzd2l0Y2hPcHRpb25zLmNsYXNzTmFtZXMpIHtcclxuICAgICAgICAgIGFkZENsYXNzZXMgPSBcIiBqcy1QamF4LWFkZCBcIiArIHN3aXRjaE9wdGlvbnMuY2xhc3NOYW1lcy5hZGQgKyBcIiBcIiArIChvcHRpb25zLmJhY2t3YXJkID8gc3dpdGNoT3B0aW9ucy5jbGFzc05hbWVzLmZvcndhcmQgOiBzd2l0Y2hPcHRpb25zLmNsYXNzTmFtZXMuYmFja3dhcmQpXHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChzd2l0Y2hPcHRpb25zLmNhbGxiYWNrcyAmJiBzd2l0Y2hPcHRpb25zLmNhbGxiYWNrcy5hZGRFbGVtZW50KSB7XHJcbiAgICAgICAgICBzd2l0Y2hPcHRpb25zLmNhbGxiYWNrcy5hZGRFbGVtZW50KGVsKVxyXG4gICAgICAgIH1cclxuICAgICAgICBlbC5jbGFzc05hbWUgKz0gYWRkQ2xhc3Nlc1xyXG4gICAgICAgIGVsLnNldEF0dHJpYnV0ZShcImRhdGEtcGpheC1jbGFzc2VzXCIsIGFkZENsYXNzZXMpXHJcbiAgICAgICAgZWxzVG9BZGQucHVzaChlbClcclxuICAgICAgICBmcmFnVG9BcHBlbmQuYXBwZW5kQ2hpbGQoZWwpXHJcbiAgICAgICAgYW5pbWF0ZWRFbHNOdW1iZXIrK1xyXG4gICAgICAgIG9uKGVsLCBhbmltYXRpb25FdmVudE5hbWVzLCBzZXh5QW5pbWF0aW9uRW5kLCB0cnVlKVxyXG4gICAgICB9XHJcbiAgICB9KVxyXG5cclxuICAgIC8vIHBhc3MgYWxsIGNsYXNzTmFtZSBvZiB0aGUgcGFyZW50XHJcbiAgICBvbGRFbC5jbGFzc05hbWUgPSBuZXdFbC5jbGFzc05hbWVcclxuICAgIG9sZEVsLmFwcGVuZENoaWxkKGZyYWdUb0FwcGVuZClcclxuXHJcbiAgICAvLyBvbGRFbC5zdHlsZS5oZWlnaHQgPSByZWxldmFudEhlaWdodCArIFwicHhcIlxyXG4gIH1cclxufVxyXG4iLCJtb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbigpIHtcclxuICB2YXIgY291bnRlciA9IDBcclxuICByZXR1cm4gZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgaWQgPSAoXCJwamF4XCIgKyAobmV3IERhdGUoKS5nZXRUaW1lKCkpKSArIFwiX1wiICsgY291bnRlclxyXG4gICAgY291bnRlcisrXHJcbiAgICByZXR1cm4gaWRcclxuICB9XHJcbn0pKClcclxuIiwidmFyIGZvckVhY2hFbHMgPSByZXF1aXJlKFwiLi9mb3JlYWNoLWVsc1wiKVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihlbGVtZW50cywgb2xkRWxlbWVudHMpIHtcclxuICAgdGhpcy5sb2coXCJzdHlsZWhlZXRzIG9sZCBlbGVtZW50c1wiLCBvbGRFbGVtZW50cyk7XHJcbiAgIHRoaXMubG9nKFwic3R5bGVoZWV0cyBuZXcgZWxlbWVudHNcIiwgZWxlbWVudHMpO1xyXG4gIHZhciB0b0FycmF5ID0gZnVuY3Rpb24oZW51bWVyYWJsZSl7XHJcbiAgICAgIHZhciBhcnIgPSBbXTtcclxuICAgICAgZm9yKHZhciBpID0gZW51bWVyYWJsZS5sZW5ndGg7IGktLTsgYXJyLnVuc2hpZnQoZW51bWVyYWJsZVtpXSkpO1xyXG4gICAgICByZXR1cm4gYXJyO1xyXG4gIH07XHJcbiAgZm9yRWFjaEVscyhlbGVtZW50cywgZnVuY3Rpb24obmV3RWwsIGkpIHtcclxuICAgIHZhciBvbGRFbGVtZW50c0FycmF5ID0gdG9BcnJheShvbGRFbGVtZW50cyk7XHJcbiAgICB2YXIgcmVzZW1ibGluZ09sZCA9IG9sZEVsZW1lbnRzQXJyYXkucmVkdWNlKGZ1bmN0aW9uKGFjYywgb2xkRWwpe1xyXG4gICAgICBhY2MgPSAoKG9sZEVsLmhyZWYgPT09IG5ld0VsLmhyZWYpID8gb2xkRWwgOiBhY2MpO1xyXG4gICAgICByZXR1cm4gYWNjO1xyXG4gICAgfSwgbnVsbCk7XHJcblxyXG4gICAgaWYocmVzZW1ibGluZ09sZCAhPT0gbnVsbCl7XHJcbiAgICAgIGlmICh0aGlzLmxvZykge1xyXG4gICAgICAgIHRoaXMubG9nKFwib2xkIHN0eWxlc2hlZXQgZm91bmQgbm90IHJlc2V0dGluZ1wiKTtcclxuICAgICAgfVxyXG4gICAgfSBlbHNlIHtcclxuICAgICAgaWYgKHRoaXMubG9nKSB7XHJcbiAgICAgICAgdGhpcy5sb2coXCJuZXcgc3R5bGVzaGVldCA9PiBhZGQgdG8gaGVhZFwiKTtcclxuICAgICAgfVxyXG4gICAgICB2YXIgaGVhZCA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCAnaGVhZCcgKVswXSxcclxuICAgICAgIGxpbmsgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnbGluaycgKTtcclxuICAgICAgICBsaW5rLnNldEF0dHJpYnV0ZSggJ2hyZWYnLCBuZXdFbC5ocmVmICk7XHJcbiAgICAgICAgbGluay5zZXRBdHRyaWJ1dGUoICdyZWwnLCAnc3R5bGVzaGVldCcgKTtcclxuICAgICAgICBsaW5rLnNldEF0dHJpYnV0ZSggJ3R5cGUnLCAndGV4dC9jc3MnICk7XHJcbiAgICAgICAgaGVhZC5hcHBlbmRDaGlsZChsaW5rKTtcclxuICAgIH1cclxuICB9LCB0aGlzKTtcclxuXHJcbn1cclxuIl19
