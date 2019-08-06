(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global = global || self, global.pjax = factory());
}(this, function () { 'use strict';

	function createCommonjsModule(fn, module) {
		return module = { exports: {} }, fn(module, module.exports), module.exports;
	}

	var clone = function (obj) {
	  if (null === obj || "object" != typeof obj) {
	    return obj;
	  }

	  var copy = obj.constructor();

	  for (var attr in obj) {
	    if (obj.hasOwnProperty(attr)) {
	      copy[attr] = obj[attr];
	    }
	  }

	  return copy;
	};

	/* global HTMLCollection: true */
	var foreachEls = function (els, fn, context) {
	  if (els instanceof HTMLCollection || els instanceof NodeList || els instanceof Array) {
	    return Array.prototype.forEach.call(els, fn, context);
	  } // assume simple dom element


	  return fn.call(context, els);
	};

	var evalScript = function (el) {
	  var querySelector = this.options.mainScriptElement;
	  var code = el.text || el.textContent || el.innerHTML || "";
	  var src = el.src || "";
	  var parent = el.parentNode || document.querySelector(querySelector) || document.documentElement;
	  var script = document.createElement("script");
	  var promise = null;
	  this.log("Evaluating Script: ", el);

	  if (code.match("document.write")) {
	    if (console && this.options.logObject.log) {
	      this.options.logObject.log("Script contains document.write. Can’t be executed correctly. Code skipped ", el);
	    }

	    return false;
	  }

	  promise = new Promise(function (resolve, reject) {
	    script.type = "text/javascript";

	    if (src != "") {
	      script.src = src;
	      script.addEventListener('load', function () {
	        resolve(src);
	      });
	      script.async = true; // force asynchronous loading of peripheral js
	    }

	    if (code != "") {
	      try {
	        script.appendChild(document.createTextNode(code));
	      } catch (e) {
	        // old IEs have funky script nodes
	        script.text = code;
	      }

	      resolve('text-node');
	    }
	  });
	  this.log('ParentElement => ', parent); // execute

	  parent.appendChild(script);
	  parent.removeChild(script); // avoid pollution only in head or body tags
	  // of if the setting removeScriptsAfterParsing is active

	  if (["head", "body"].indexOf(parent.tagName.toLowerCase()) > 0 || this.options.removeScriptsAfterParsing === true) ;

	  return promise;
	};

	// Finds and executes scripts (used for newly added elements)
	// Needed since innerHTML does not run scripts


	var executeScripts = function (el) {
	  this.log("Executing scripts for ", el);
	  var loadingScripts = [];
	  if (el === undefined) return Promise.resolve();

	  if (el.tagName.toLowerCase() === "script") {
	    evalScript.call(this, el);
	  }

	  foreachEls(el.querySelectorAll("script"), function (script) {
	    if (!script.type || script.type.toLowerCase() === "text/javascript") {
	      // if (script.parentNode) {
	      //   script.parentNode.removeChild(script)
	      // }
	      loadingScripts.push(evalScript.call(this, script));
	    }
	  }, this);
	  return loadingScripts;
	};

	var uniqueid = function () {
	  var counter = 0;
	  return function () {
	    var id = "pjax" + new Date().getTime() + "_" + counter;
	    counter++;
	    return id;
	  };
	}();

	var on = function (els, events, listener, useCapture) {
	  events = typeof events === "string" ? events.split(" ") : events;
	  events.forEach(function (e) {
	    foreachEls(els, function (el) {
	      el.addEventListener(e, listener, useCapture);
	    });
	  });
	};

	var trigger = function (els, events, opts) {
	  events = typeof events === "string" ? events.split(" ") : events;
	  events.forEach(function (e) {
	    var event; // = new CustomEvent(e) // doesn't everywhere yet

	    event = document.createEvent("HTMLEvents");
	    event.initEvent(e, true, true);
	    event.eventName = e;

	    if (opts) {
	      Object.keys(opts).forEach(function (key) {
	        event[key] = opts[key];
	      });
	    }

	    foreachEls(els, function (el) {
	      var domFix = false;

	      if (!el.parentNode && el !== document && el !== window) {
	        // THANKS YOU IE (9/10//11 concerned)
	        // dispatchEvent doesn't work if element is not in the dom
	        domFix = true;
	        document.body.appendChild(el);
	      }

	      el.dispatchEvent(event);

	      if (domFix) {
	        el.parentNode.removeChild(el);
	      }
	    });
	  });
	};

	/* global _gaq: true, ga: true */
	var parseOptions = function (options) {
	  this.options = options;
	  this.options.elements = this.options.elements || "a[href], form[action]", this.options.reRenderCSS = this.options.reRenderCSS || false, this.options.forceRedirectOnFail = this.options.forceRedirectOnFail || false, this.options.scriptloadtimeout = this.options.scriptloadtimeout || 1000, this.options.mainScriptElement = this.options.mainScriptElement || "head";
	  this.options.removeScriptsAfterParsing = this.options.removeScriptsAfterParsing || true;
	  this.options.logObject = this.options.logObject || console;
	  this.options.latestChance = this.options.latestChance || null;
	  this.options.selectors = this.options.selectors || ["title", ".js-Pjax"];
	  this.options.switches = this.options.switches || {};
	  this.options.switchesOptions = this.options.switchesOptions || {};
	  this.options.history = this.options.history || true;

	  this.options.onDomDiffers = this.options.onDomDiffers || function (oldDom, newDom) {
	    return true;
	  };

	  this.options.pjaxErrorHandler = this.options.pjaxErrorHandler || function (href, options, requestData) {
	    return false;
	  };

	  this.options.onJsonDocument = this.options.onJsonDocument || function (jsonDocument) {
	    return true;
	  };

	  this.options.analytics = this.options.analytics || function () {
	    // options.backward or options.foward can be true or undefined
	    // by default, we do track back/foward hit
	    // https://productforums.google.com/forum/#!topic/analytics/WVwMDjLhXYk
	    if (window._gaq) {
	      _gaq.push(["_trackPageview"]);
	    }

	    if (window.ga) {
	      ga("send", "pageview", {
	        page: location.pathname,
	        title: document.title
	      });
	    }
	  };

	  this.options.scrollTo = typeof this.options.scrollTo === 'undefined' ? 0 : this.options.scrollTo;
	  this.options.cacheBust = typeof this.options.cacheBust === 'undefined' ? true : this.options.cacheBust;
	  this.options.debug = this.options.debug || false; // we can’t replace body.outerHTML or head.outerHTML
	  // it create a bug where new body or new head are created in the dom
	  // if you set head.outerHTML, a new body tag is appended, so the dom get 2 body
	  // & it break the switchFallback which replace head & body

	  if (!this.options.switches.head) {
	    this.options.switches.head = this.switchElementsAlt;
	  }

	  if (!this.options.switches.body) {
	    this.options.switches.body = this.switchElementsAlt;
	  }

	  if (typeof options.analytics !== "function") {
	    options.analytics = function () {};
	  }
	};

	var log = function () {
	  if (this.options.debug && this.options.logObject) {
	    if (typeof this.options.logObject.log === "function") {
	      this.options.logObject.log.apply(this.options.logObject, ['PJAX ->', arguments]);
	    } // ie is weird
	    else if (this.options.logObject.log) {
	        this.options.logObject.log(['PJAX ->', arguments]);
	      }
	  }
	};

	var getElements = function (el) {
	  return el.querySelectorAll(this.options.elements);
	};

	var parseElement = function (el) {
	  switch (el.tagName.toLowerCase()) {
	    case "a":
	      // only attach link if el does not already have link attached
	      if (!el.hasAttribute('data-pjax-click-state')) {
	        this.attachLink(el);
	      }

	      break;

	    case "form":
	      // only attach link if el does not already have link attached
	      if (!el.hasAttribute('data-pjax-click-state')) {
	        this.attachForm(el);
	      }

	      break;

	    default:
	      throw "Pjax can only be applied on <a> or <form> submit";
	  }
	};

	var parseDom = function (el) {
	  foreachEls(this.getElements(el), parseElement, this);
	};

	var parseElementUnload = function (el) {
	  switch (el.tagName.toLowerCase()) {
	    case "a":
	      // only attach link if el does not already have link attached
	      if (!el.hasAttribute('data-pjax-click-state')) {
	        this.unattachLink(el);
	      }

	      break;

	    case "form":
	      // only attach link if el does not already have link attached
	      if (!el.hasAttribute('data-pjax-click-state')) {
	        this.unattachForm(el);
	      }

	      break;

	    default:
	      throw "Pjax can only be applied on <a> or <form> submit";
	  }
	};

	var parseDomUnload = function (el) {
	  foreachEls(this.getElements(el), parseElementUnload, this);
	};

	var refresh = function (el) {
	  this.parseDOM(el || document);
	};

	var reload = function () {
	  window.location.reload();
	};

	if (!Function.prototype.bind) {
	  Function.prototype.bind = function (oThis) {
	    if (typeof this !== "function") {
	      // closest thing possible to the ECMAScript 5 internal IsCallable function
	      throw new TypeError("Function.prototype.bind - what is trying to be bound is not callable");
	    }

	    var aArgs = Array.prototype.slice.call(arguments, 1);
	    var that = this;

	    var Fnoop = function () {};

	    var fBound = function () {
	      return that.apply(this instanceof Fnoop && oThis ? this : oThis, aArgs.concat(Array.prototype.slice.call(arguments)));
	    };

	    Fnoop.prototype = this.prototype;
	    fBound.prototype = new Fnoop();
	    return fBound;
	  };
	}

	var attrClick = "data-pjax-click-state";
	var attrKey = "data-pjax-keyup-state";

	var linkAction = function (el, event) {
	  // Don’t break browser special behavior on links (like page in new window)
	  if (event.which > 1 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
	    el.setAttribute(attrClick, "modifier");
	    return;
	  } // we do test on href now to prevent unexpected behavior if for some reason
	  // user have href that can be dynamically updated
	  // Ignore external links.


	  if (el.protocol !== window.location.protocol || el.host !== window.location.host) {
	    el.setAttribute(attrClick, "external");
	    return;
	  } // Ignore click if we are on an anchor on the same page


	  if (el.pathname === window.location.pathname && el.hash.length > 0) {
	    el.setAttribute(attrClick, "anchor-present");
	    return;
	  } // Ignore anchors on the same page (keep native behavior)


	  if (el.hash && el.href.replace(el.hash, "") === window.location.href.replace(location.hash, "")) {
	    el.setAttribute(attrClick, "anchor");
	    return;
	  } // Ignore empty anchor "foo.html#"


	  if (el.href === window.location.href.split("#")[0] + "#") {
	    el.setAttribute(attrClick, "anchor-empty");
	    return;
	  }

	  event.preventDefault(); // don’t do "nothing" if user try to reload the page by clicking the same link twice

	  if (this.options.currentUrlFullReload && el.href === window.location.href.split("#")[0]) {
	    el.setAttribute(attrClick, "reload");
	    this.reload();
	    return;
	  }

	  this.options.requestOptions = this.options.requestOptions || {};
	  el.setAttribute(attrClick, "load");
	  this.loadUrl(el.href, clone(this.options));
	};

	var isDefaultPrevented = function (event) {
	  return event.defaultPrevented || event.returnValue === false;
	};

	var attachLink = function (el) {
	  var that = this;
	  on(el, "click", function (event) {
	    if (isDefaultPrevented(event)) {
	      return;
	    }

	    linkAction.call(that, el, event);
	  });
	  on(el, "keyup", function (event) {
	    if (isDefaultPrevented(event)) {
	      return;
	    } // Don’t break browser special behavior on links (like page in new window)


	    if (event.which > 1 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
	      el.setAttribute(attrKey, "modifier");
	      return;
	    }

	    if (event.keyCode == 13) {
	      linkAction.call(that, el, event);
	    }
	  }.bind(this));
	};

	var attrClick$1 = "data-pjax-submit-state";

	var formAction = function (el, event) {
	  this.options.requestOptions = {
	    requestUrl: el.getAttribute('action') || window.location.href,
	    requestMethod: el.getAttribute('method') || 'GET' //create a testable virtual link of the form action

	  };
	  var virtLinkElement = document.createElement('a');
	  virtLinkElement.setAttribute('href', this.options.requestOptions.requestUrl); // Ignore external links.

	  if (virtLinkElement.protocol !== window.location.protocol || virtLinkElement.host !== window.location.host) {
	    el.setAttribute(attrClick$1, "external");
	    return;
	  } // Ignore click if we are on an anchor on the same page


	  if (virtLinkElement.pathname === window.location.pathname && virtLinkElement.hash.length > 0) {
	    el.setAttribute(attrClick$1, "anchor-present");
	    return;
	  } // Ignore empty anchor "foo.html#"


	  if (virtLinkElement.href === window.location.href.split("#")[0] + "#") {
	    el.setAttribute(attrClick$1, "anchor-empty");
	    return;
	  } // if declared as a full reload, just normally submit the form


	  if (this.options.currentUrlFullReload) {
	    el.setAttribute(attrClick$1, "reload");
	    return;
	  }

	  event.preventDefault();
	  var nameList = [];
	  var paramObject = [];

	  for (var elementKey in el.elements) {
	    var element = el.elements[elementKey];

	    if (!!element.name && element.attributes !== undefined && element.tagName.toLowerCase() !== 'button') {
	      if (element.type !== 'checkbox' && element.type !== 'radio' || element.checked) {
	        if (nameList.indexOf(element.name) === -1) {
	          nameList.push(element.name);

	          if (String(element.nodeName).toLowerCase() === 'select' && element.multiple == true) {
	            var selected = Array.from(element.options).map(function (item, i) {
	              return item.selected ? item.value : null;
	            });
	            paramObject.push({
	              name: encodeURIComponent(element.name),
	              value: selected
	            });
	            return;
	          }

	          paramObject.push({
	            name: encodeURIComponent(element.name),
	            value: encodeURIComponent(element.value)
	          });
	        }
	      }
	    }
	  } //Creating a getString


	  var paramsString = paramObject.map(function (value) {
	    return value.name + "=" + value.value;
	  }).join('&');
	  this.options.requestOptions.requestPayload = paramObject;
	  this.options.requestOptions.requestPayloadString = paramsString;
	  el.setAttribute(attrClick$1, "submit");
	  this.loadUrl(virtLinkElement.href, clone(this.options));
	};

	var isDefaultPrevented$1 = function (event) {
	  return event.defaultPrevented || event.returnValue === false;
	};

	var attachForm = function (el) {
	  var that = this;
	  on(el, "submit", function (event) {
	    if (isDefaultPrevented$1(event)) {
	      return;
	    }

	    formAction.call(that, el, event);
	  });
	};

	var off = function (els, events, listener, useCapture) {
	  events = typeof events === "string" ? events.split(" ") : events;
	  events.forEach(function (e) {
	    foreachEls(els, function (el) {
	      el.removeEventListener(e, listener, useCapture);
	    });
	  });
	};

	var attrClick$2 = "data-pjax-click-state";
	var attrKey$1 = "data-pjax-keyup-state";

	var linkAction$1 = function (el, event) {
	  // Don’t break browser special behavior on links (like page in new window)
	  if (event.which > 1 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
	    el.setAttribute(attrClick$2, "modifier");
	    return;
	  } // we do test on href now to prevent unexpected behavior if for some reason
	  // user have href that can be dynamically updated
	  // Ignore external links.


	  if (el.protocol !== window.location.protocol || el.host !== window.location.host) {
	    el.setAttribute(attrClick$2, "external");
	    return;
	  } // Ignore click if we are on an anchor on the same page


	  if (el.pathname === window.location.pathname && el.hash.length > 0) {
	    el.setAttribute(attrClick$2, "anchor-present");
	    return;
	  } // Ignore anchors on the same page (keep native behavior)


	  if (el.hash && el.href.replace(el.hash, "") === window.location.href.replace(location.hash, "")) {
	    el.setAttribute(attrClick$2, "anchor");
	    return;
	  } // Ignore empty anchor "foo.html#"


	  if (el.href === window.location.href.split("#")[0] + "#") {
	    el.setAttribute(attrClick$2, "anchor-empty");
	    return;
	  }

	  event.preventDefault(); // don’t do "nothing" if user try to reload the page by clicking the same link twice

	  if (this.options.currentUrlFullReload && el.href === window.location.href.split("#")[0]) {
	    el.setAttribute(attrClick$2, "reload");
	    this.reload();
	    return;
	  }

	  this.options.requestOptions = this.options.requestOptions || {};
	  el.setAttribute(attrClick$2, "load");
	  this.loadUrl(el.href, clone(this.options));
	};

	var isDefaultPrevented$2 = function (event) {
	  return event.defaultPrevented || event.returnValue === false;
	};

	var unattachLink = function (el) {
	  var that = this;
	  off(el, "click", function (event) {
	    if (isDefaultPrevented$2(event)) {
	      return;
	    }

	    linkAction$1.call(that, el, event);
	  });
	  off(el, "keyup", function (event) {
	    if (isDefaultPrevented$2(event)) {
	      return;
	    } // Don’t break browser special behavior on links (like page in new window)


	    if (event.which > 1 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
	      el.setAttribute(attrKey$1, "modifier");
	      return;
	    }

	    if (event.keyCode == 13) {
	      linkAction$1.call(that, el, event);
	    }
	  }.bind(this));
	};

	var attrClick$3 = "data-pjax-click-state";

	var formAction$1 = function (el, event) {
	  this.options.requestOptions = {
	    requestUrl: el.getAttribute('action') || window.location.href,
	    requestMethod: el.getAttribute('method') || 'GET' //create a testable virtual link of the form action

	  };
	  var virtLinkElement = document.createElement('a');
	  virtLinkElement.setAttribute('href', this.options.requestOptions.requestUrl); // Ignore external links.

	  if (virtLinkElement.protocol !== window.location.protocol || virtLinkElement.host !== window.location.host) {
	    el.setAttribute(attrClick$3, "external");
	    return;
	  } // Ignore click if we are on an anchor on the same page


	  if (virtLinkElement.pathname === window.location.pathname && virtLinkElement.hash.length > 0) {
	    el.setAttribute(attrClick$3, "anchor-present");
	    return;
	  } // Ignore empty anchor "foo.html#"


	  if (virtLinkElement.href === window.location.href.split("#")[0] + "#") {
	    el.setAttribute(attrClick$3, "anchor-empty");
	    return;
	  } // if declared as a full reload, just normally submit the form


	  if (this.options.currentUrlFullReload) {
	    el.setAttribute(attrClick$3, "reload");
	    return;
	  }

	  event.preventDefault();
	  var nameList = [];
	  var paramObject = [];

	  for (var elementKey in el.elements) {
	    var element = el.elements[elementKey];

	    if (!!element.name && element.attributes !== undefined && element.tagName.toLowerCase() !== 'button') {
	      if (element.type !== 'checkbox' && element.type !== 'radio' || element.checked) {
	        if (nameList.indexOf(element.name) === -1) {
	          nameList.push(element.name);
	          paramObject.push({
	            name: encodeURIComponent(element.name),
	            value: encodeURIComponent(element.value)
	          });
	        }
	      }
	    }
	  } //Creating a getString


	  var paramsString = paramObject.map(function (value) {
	    return value.name + "=" + value.value;
	  }).join('&');
	  this.options.requestOptions.requestPayload = paramObject;
	  this.options.requestOptions.requestPayloadString = paramsString;
	  el.setAttribute(attrClick$3, "submit");
	  this.loadUrl(virtLinkElement.href, clone(this.options));
	};

	var isDefaultPrevented$3 = function (event) {
	  return event.defaultPrevented || event.returnValue === false;
	};

	var unattachForm = function (el) {
	  var that = this;
	  off(el, "submit", function (event) {
	    if (isDefaultPrevented$3(event)) {
	      return;
	    }

	    formAction$1.call(that, el, event);
	  });
	  off(el, "keyup", function (event) {
	    if (isDefaultPrevented$3(event)) {
	      return;
	    }

	    if (event.keyCode == 13) {
	      formAction$1.call(that, el, event);
	    }
	  }.bind(this));
	};

	var updateStylesheets = function (elements, oldElements) {
	  this.log("styleheets old elements", oldElements);
	  this.log("styleheets new elements", elements);

	  var toArray = function (enumerable) {
	    var arr = [];

	    for (var i = enumerable.length; i--; arr.unshift(enumerable[i]));

	    return arr;
	  };

	  foreachEls(elements, function (newEl, i) {
	    var oldElementsArray = toArray(oldElements);
	    var resemblingOld = oldElementsArray.reduce(function (acc, oldEl) {
	      acc = oldEl.href === newEl.href ? oldEl : acc;
	      return acc;
	    }, null);

	    if (resemblingOld !== null) {
	      if (this.log) {
	        this.log("old stylesheet found not resetting");
	      }
	    } else {
	      if (this.log) {
	        this.log("new stylesheet => add to head");
	      }

	      var head = document.getElementsByTagName('head')[0],
	          link = document.createElement('link');
	      link.setAttribute('href', newEl.href);
	      link.setAttribute('rel', 'stylesheet');
	      link.setAttribute('type', 'text/css');
	      head.appendChild(link);
	    }
	  }, this);
	};

	var foreachSelectors = function (selectors, cb, context, DOMcontext) {
	  DOMcontext = DOMcontext || document;
	  selectors.forEach(function (selector) {
	    foreachEls(DOMcontext.querySelectorAll(selector), cb, context);
	  });
	};

	// var off = require("./lib/events/on.js")
	// var trigger = require("./lib/events/trigger.js")


	var switches = {
	  outerHTML: function (oldEl, newEl) {
	    oldEl.outerHTML = newEl.outerHTML;
	    this.onSwitch();
	  },
	  innerHTML: function (oldEl, newEl) {
	    oldEl.innerHTML = newEl.innerHTML;
	    oldEl.className = newEl.className;
	    this.onSwitch();
	  },
	  sideBySide: function (oldEl, newEl, options, switchOptions) {
	    var forEach = Array.prototype.forEach;
	    var elsToRemove = [];
	    var elsToAdd = [];
	    var fragToAppend = document.createDocumentFragment(); // height transition are shitty on safari
	    // so commented for now (until I found something ?)
	    // var relevantHeight = 0

	    var animationEventNames = "animationend webkitAnimationEnd MSAnimationEnd oanimationend";
	    var animatedElsNumber = 0;

	    var sexyAnimationEnd = function (e) {
	      if (e.target != e.currentTarget) {
	        // end triggered by an animation on a child
	        return;
	      }

	      animatedElsNumber--;

	      if (animatedElsNumber <= 0 && elsToRemove) {
	        elsToRemove.forEach(function (el) {
	          // browsing quickly can make the el
	          // already removed by last page update ?
	          if (el.parentNode) {
	            el.parentNode.removeChild(el);
	          }
	        });
	        elsToAdd.forEach(function (el) {
	          el.className = el.className.replace(el.getAttribute("data-pjax-classes"), "");
	          el.removeAttribute("data-pjax-classes"); // Pjax.off(el, animationEventNames, sexyAnimationEnd, true)
	        });
	        elsToAdd = null; // free memory

	        elsToRemove = null; // free memory
	        // assume the height is now useless (avoid bug since there is overflow hidden on the parent)
	        // oldEl.style.height = "auto"
	        // this is to trigger some repaint (example: picturefill)

	        this.onSwitch(); // Pjax.trigger(window, "scroll")
	      }
	    }.bind(this); // Force height to be able to trigger css animation
	    // here we get the relevant height
	    // oldEl.parentNode.appendChild(newEl)
	    // relevantHeight = newEl.getBoundingClientRect().height
	    // oldEl.parentNode.removeChild(newEl)
	    // oldEl.style.height = oldEl.getBoundingClientRect().height + "px"


	    switchOptions = switchOptions || {};
	    forEach.call(oldEl.childNodes, function (el) {
	      elsToRemove.push(el);

	      if (el.classList && !el.classList.contains("js-Pjax-remove")) {
	        // for fast switch, clean element that just have been added, & not cleaned yet.
	        if (el.hasAttribute("data-pjax-classes")) {
	          el.className = el.className.replace(el.getAttribute("data-pjax-classes"), "");
	          el.removeAttribute("data-pjax-classes");
	        }

	        el.classList.add("js-Pjax-remove");

	        if (switchOptions.callbacks && switchOptions.callbacks.removeElement) {
	          switchOptions.callbacks.removeElement(el);
	        }

	        if (switchOptions.classNames) {
	          el.className += " " + switchOptions.classNames.remove + " " + (options.backward ? switchOptions.classNames.backward : switchOptions.classNames.forward);
	        }

	        animatedElsNumber++;
	        on(el, animationEventNames, sexyAnimationEnd, true);
	      }
	    });
	    forEach.call(newEl.childNodes, function (el) {
	      if (el.classList) {
	        var addClasses = "";

	        if (switchOptions.classNames) {
	          addClasses = " js-Pjax-add " + switchOptions.classNames.add + " " + (options.backward ? switchOptions.classNames.forward : switchOptions.classNames.backward);
	        }

	        if (switchOptions.callbacks && switchOptions.callbacks.addElement) {
	          switchOptions.callbacks.addElement(el);
	        }

	        el.className += addClasses;
	        el.setAttribute("data-pjax-classes", addClasses);
	        elsToAdd.push(el);
	        fragToAppend.appendChild(el);
	        animatedElsNumber++;
	        on(el, animationEventNames, sexyAnimationEnd, true);
	      }
	    }); // pass all className of the parent

	    oldEl.className = newEl.className;
	    oldEl.appendChild(fragToAppend); // oldEl.style.height = relevantHeight + "px"
	  }
	};

	var switchesSelectors = function (switches$1, switchesOptions, selectors, fromEl, toEl, options) {
	  selectors.forEach(function (selector) {
	    var newEls = fromEl.querySelectorAll(selector);
	    var oldEls = toEl.querySelectorAll(selector);

	    if (this.log) {
	      this.log("Pjax switch", selector, newEls, oldEls);
	    }

	    if (newEls.length !== oldEls.length) {
	      var throwError = options.onDomDiffers(toEl, fromEl);

	      if (throwError) {
	        throw "DOM doesn’t look the same on new loaded page: ’" + selector + "’ - new " + newEls.length + ", old " + oldEls.length;
	      }
	    }

	    foreachEls(newEls, function (newEl, i) {
	      var oldEl = oldEls[i];

	      if (this.log) {
	        this.log("newEl", newEl, "oldEl", oldEl);
	      }

	      if (switches$1[selector]) {
	        switches$1[selector].bind(this)(oldEl, newEl, options, switchesOptions[selector]);
	      } else {
	        switches.outerHTML.bind(this)(oldEl, newEl, options);
	      }
	    }, this);
	  }, this);
	};

	var request = function (location, options, callback) {
	  options = options || {};
	  var requestMethod = options.requestMethod || "GET";
	  var requestPayload = options.requestPayloadString || null;
	  var request = new XMLHttpRequest();

	  request.onreadystatechange = function () {
	    if (request.readyState === 4) {
	      if (request.status === 200) {
	        callback(request.responseText, request);
	      } else {
	        callback(null, request);
	      }
	    }
	  }; // Add a timestamp as part of the query string if cache busting is enabled


	  if (this.options.cacheBust) {
	    location += (!/[?&]/.test(location) ? "?" : "&") + new Date().getTime();
	  }

	  request.open(requestMethod.toUpperCase(), location, true);
	  request.setRequestHeader("X-Requested-With", "XMLHttpRequest"); // Add the request payload if available

	  if (options.requestPayloadString != undefined && options.requestPayloadString != "") {
	    // Send the proper header information along with the request
	    request.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
	  }

	  request.send(requestPayload);
	  return request;
	};

	var isSupported = function () {
	  // Borrowed wholesale from https://github.com/defunkt/jquery-pjax
	  return window.history && window.history.pushState && window.history.replaceState && // pushState isn’t reliable on iOS until 5.
	  !navigator.userAgent.match(/((iPod|iPhone|iPad).+\bOS\s+[1-4]\D|WebApps\/.+CFNetwork)/);
	};

	var src = createCommonjsModule(function (module) {
	// var off = require("./lib/events/on.js")




	var Pjax = function (options) {
	  this.firstrun = true;

	  var parseOptions$1 = parseOptions;

	  parseOptions$1.apply(this, [options]);
	  this.log("Pjax options", this.options);
	  this.maxUid = this.lastUid = uniqueid();
	  this.parseDOM(document);
	  on(window, "popstate", function (st) {
	    if (st.state) {
	      var opt = clone(this.options);
	      opt.url = st.state.url;
	      opt.title = st.state.title;
	      opt.history = false;
	      opt.requestOptions = {};

	      if (st.state.uid < this.lastUid) {
	        opt.backward = true;
	      } else {
	        opt.forward = true;
	      }

	      this.lastUid = st.state.uid; // @todo implement history cache here, based on uid

	      this.loadUrl(st.state.url, opt);
	    }
	  }.bind(this));
	  return this;
	};

	Pjax.prototype = {
	  log: log,
	  getElements: getElements,
	  parseDOM: parseDom,
	  parseDOMtoUnload: parseDomUnload,
	  refresh: refresh,
	  reload: reload,
	  attachLink: attachLink,
	  attachForm: attachForm,
	  unattachLink: unattachLink,
	  unattachForm: unattachForm,
	  updateStylesheets: updateStylesheets,
	  forEachSelectors: function (cb, context, DOMcontext) {
	    return foreachSelectors.bind(this)(this.options.selectors, cb, context, DOMcontext);
	  },
	  switchSelectors: function (selectors, fromEl, toEl, options) {
	    return switchesSelectors.bind(this)(this.options.switches, this.options.switchesOptions, selectors, fromEl, toEl, options);
	  },
	  // too much problem with the code below
	  // + it’s too dangerous
	  //   switchFallback: function(fromEl, toEl) {
	  //     this.switchSelectors(["head", "body"], fromEl, toEl)
	  //     // execute script when DOM is like it should be
	  //     Pjax.executeScripts(document.querySelector("head"))
	  //     Pjax.executeScripts(document.querySelector("body"))
	  //   }
	  latestChance: function (href) {
	    window.location.href = href;
	    return false;
	  },
	  onSwitch: function () {
	    trigger(window, "resize scroll");
	  },
	  loadContent: function (html, options) {
	    var tmpEl = document.implementation.createHTMLDocument("pjax");
	    var collectForScriptcomplete = [Promise.resolve("basic resolve")]; // parse HTML attributes to copy them
	    // since we are forced to use documentElement.innerHTML (outerHTML can't be used for <html>)

	    var htmlRegex = /<html[^>]+>/gi;
	    var htmlAttribsRegex = /\s?[a-z:]+(?:\=(?:\'|\")[^\'\">]+(?:\'|\"))*/gi;
	    var matches = html.match(htmlRegex);

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

	    jsonContent = null;

	    try {
	      jsonContent = JSON.parse(html);
	    } catch (e) {}

	    tmpEl.documentElement.innerHTML = html;
	    this.log("load content", tmpEl.documentElement.attributes, tmpEl.documentElement.innerHTML.length);

	    if (jsonContent !== null) {
	      this.log("found JSON document", jsonContent);
	      this.options.onJsonDocument.call(this, jsonContent);
	    } // Clear out any focused controls before inserting new page contents.
	    // we clear focus on non form elements


	    if (document.activeElement && !document.activeElement.value) {
	      try {
	        document.activeElement.blur();
	      } catch (e) {}
	    }

	    this.switchSelectors(this.options.selectors, tmpEl, document, options); //reset stylesheets if activated

	    if (this.options.reRenderCSS === true) {
	      this.updateStylesheets.call(this, tmpEl.querySelectorAll('link[rel=stylesheet]'), document.querySelectorAll('link[rel=stylesheet]'));
	    } // FF bug: Won’t autofocus fields that are inserted via JS.
	    // This behavior is incorrect. So if theres no current focus, autofocus
	    // the last field.
	    //
	    // http://www.w3.org/html/wg/drafts/html/master/forms.html


	    var autofocusEl = Array.prototype.slice.call(document.querySelectorAll("[autofocus]")).pop();

	    if (autofocusEl && document.activeElement !== autofocusEl) {
	      autofocusEl.focus();
	    } // execute scripts when DOM have been completely updated


	    this.options.selectors.forEach(function (selector) {
	      foreachEls(document.querySelectorAll(selector), function (el) {
	        collectForScriptcomplete.push.apply(collectForScriptcomplete, executeScripts.call(this, el));
	      }, this);
	    }, this); // }
	    // catch(e) {
	    //   if (this.options.debug) {
	    //     this.log("Pjax switch fail: ", e)
	    //   }
	    //   this.switchFallback(tmpEl, document)
	    // }

	    this.log("waiting for scriptcomplete", collectForScriptcomplete); //Fallback! If something can't be loaded or is not loaded correctly -> just force eventing in error

	    var timeOutScriptEvent = null;
	    timeOutScriptEvent = window.setTimeout(function () {
	      trigger(document, "pjax:scriptcomplete pjax:scripttimeout", options);
	      timeOutScriptEvent = null;
	    }, this.options.scriptloadtimeout);
	    Promise.all(collectForScriptcomplete).then( //resolved
	    function () {
	      if (timeOutScriptEvent !== null) {
	        window.clearTimeout(timeOutScriptEvent);
	        trigger(document, "pjax:scriptcomplete pjax:scriptsuccess", options);
	      }
	    }, function () {
	      if (timeOutScriptEvent !== null) {
	        window.clearTimeout(timeOutScriptEvent);
	        trigger(document, "pjax:scriptcomplete pjax:scripterror", options);
	      }
	    });
	  },
	  doRequest: request,
	  loadUrl: function (href, options) {
	    this.log("load href", href, options);
	    trigger(document, "pjax:send", options); // Do the request

	    this.doRequest(href, options.requestOptions, function (html, requestData) {
	      // Fail if unable to load HTML via AJAX
	      if (html === false || requestData.status !== 200) {
	        trigger(document, "pjax:complete pjax:error", {
	          options: options,
	          requestData: requestData,
	          href: href
	        });
	        return options.pjaxErrorHandler(href, options, requestData);
	      } // Clear out any focused controls before inserting new page contents.


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
	          this.lastUid = this.maxUid = uniqueid();
	          this.firstrun = false;
	          window.history.replaceState({
	            url: window.location.href,
	            title: document.title,
	            uid: this.maxUid
	          }, document.title);
	        } // Update browser history


	        this.lastUid = this.maxUid = uniqueid();
	        window.history.pushState({
	          url: href,
	          title: options.title,
	          uid: this.maxUid
	        }, options.title, href);
	      }

	      this.forEachSelectors(function (el) {
	        this.parseDOM(el);
	      }, this); // Fire Events

	      trigger(document, "pjax:complete pjax:success", options);
	      options.analytics(); // Scroll page to top on new page load

	      if (options.scrollTo !== false) {
	        if (options.scrollTo.length > 1) {
	          window.scrollTo(options.scrollTo[0], options.scrollTo[1]);
	        } else {
	          window.scrollTo(0, options.scrollTo);
	        }
	      }
	    }.bind(this));
	  }
	};
	Pjax.isSupported = isSupported; //arguably could do `if( require("./lib/is-supported.js")()) {` but that might be a little to simple

	if (Pjax.isSupported()) {
	  module.exports = Pjax;
	} // if there isn’t required browser functions, returning stupid api
	else {
	    var stupidPjax = function () {};

	    for (var key in Pjax.prototype) {
	      if (Pjax.prototype.hasOwnProperty(key) && typeof Pjax.prototype[key] === "function") {
	        stupidPjax[key] = stupidPjax;
	      }
	    }

	    module.exports = stupidPjax;
	  }
	});

	return src;

}));
//# sourceMappingURL=pjax.js.map
