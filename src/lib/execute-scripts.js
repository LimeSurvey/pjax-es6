import {
  forEachEls
} from "./utility";

import evalScript from "./eval-script";

// Finds and executes scripts (used for newly added elements)
// Needed since innerHTML does not run scripts
export default function () {
  return (el) => {
    this.log.log("Executing scripts for ", el);

    const loadingScripts = [];

    if (el === undefined) return Promise.resolve();

    if (el.tagName.toLowerCase() === "script") {
      evalScript.call(this, el);
    }

    forEachEls(el.querySelectorAll("script"), (script) => {
      if (!script.type || script.type.toLowerCase() === "text/javascript") {
        if (!(script.parentNode && script.parentNode.tagName == 'textarea')) {
            loadingScripts.push(evalScript.call(this, script));
        }
      }
    }, this);

    return loadingScripts;
  };
};
