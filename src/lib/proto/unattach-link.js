import "../polyfills/Function.prototype.bind";

import off from "../events/off";
import {
  clone
} from "../utility";


const attrClick = "data-pjax-click-state";
const attrKey = "data-pjax-keyup-state";

const linkAction = function (el, event) {
  // Don’t break browser special behavior on links (like page in new window)
  if (event.which > 1 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    el.setAttribute(attrClick, "modifier");
    return;
  }

  // we do test on href now to prevent unexpected behavior if for some reason
  // user have href that can be dynamically updated

  // Ignore external links.
  if (el.protocol !== window.location.protocol || el.host !== window.location.host) {
    el.setAttribute(attrClick, "external");
    return;
  }

  // Ignore click if we are on an anchor on the same page
  if (el.pathname === window.location.pathname && el.hash.length > 0) {
    el.setAttribute(attrClick, "anchor-present");
    return;
  }

  // Ignore anchors on the same page (keep native behavior)
  if (el.hash && el.href.replace(el.hash, "") === window.location.href.replace(location.hash, "")) {
    el.setAttribute(attrClick, "anchor");
    return;
  }

  // Ignore empty anchor "foo.html#"
  if (el.href === window.location.href.split("#")[0] + "#") {
    el.setAttribute(attrClick, "anchor-empty");
    return;
  }

  event.preventDefault();

  // don’t do "nothing" if user try to reload the page by clicking the same link twice
  if (
    this.options.currentUrlFullReload &&
    el.href === window.location.href.split("#")[0]
  ) {
    el.setAttribute(attrClick, "reload");
    this.reload();
    return;
  }
  this.options.requestOptions = this.options.requestOptions || {};
  el.setAttribute(attrClick, "load");
  this.loadUrl(el.href, clone(this.options));
};

const isDefaultPrevented = function (event) {
  return event.defaultPrevented || event.returnValue === false;
};

export default function () {
  return (el) => {
    off(el, "click", (event) => {
      if (isDefaultPrevented(event)) {
        return;
      }

      linkAction.call(this, el, event);
    });

    off(el, "keyup", (event) => {
      if (isDefaultPrevented(event)) {
        return;
      }

      // Don’t break browser special behavior on links (like page in new window)
      if (event.which > 1 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        el.setAttribute(attrKey, "modifier");
        return;
      }

      if (event.keyCode == 13) {
        linkAction.call(this, el, event);
      }
    });
  };
}
