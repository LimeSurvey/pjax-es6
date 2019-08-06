import "../polyfills/Function.prototype.bind";

import off from "../events/off";
import {
  clone
} from "../utility";

const attrClick = "data-pjax-click-state"

const formAction = function (el, event) {

  this.options.requestOptions = {
    requestUrl: el.getAttribute('action') || window.location.href,
    requestMethod: el.getAttribute('method') || 'GET',
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
  if (this.options.currentUrlFullReload) {
    el.setAttribute(attrClick, "reload");
    return;
  }

  event.preventDefault()
  const nameList = [];
  const paramObject = [];
  for (let elementKey in el.elements) {
    const element = el.elements[elementKey];
    if (!!element.name && element.attributes !== undefined && element.tagName.toLowerCase() !== 'button') {
      if (
        (element.type !== 'checkbox' && element.type !== 'radio') || element.checked
      ) {
        if (nameList.indexOf(element.name) === -1) {
          nameList.push(element.name);
          paramObject.push({
            name: encodeURIComponent(element.name),
            value: encodeURIComponent(element.value)
          });
        }
      }
    }
  }



  //Creating a getString
  const paramsString = (paramObject.map(value => value.name + "=" + value.value)).join('&');

  this.options.requestOptions.requestPayload = paramObject;
  this.options.requestOptions.requestPayloadString = paramsString;

  el.setAttribute(attrClick, "submit");

  this.loadUrl(virtLinkElement.href, clone(this.options))

};

const isDefaultPrevented = function (event) {
  return event.defaultPrevented || event.returnValue === false;
};


export default function () {
  return (el) => {

    off(el, "submit", function (event) {
      if (isDefaultPrevented(event)) {
        return
      }

      formAction.call(this, el, event)
    })

    off(el, "keyup", (event) => {
      if (isDefaultPrevented(event)) {
        return
      }

      if (event.keyCode == 13) {
        formAction.call(this, el, event)
      }
    })
  }
}
