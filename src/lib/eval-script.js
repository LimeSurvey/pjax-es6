import 'promise-polyfill';

export default function (el) {

  const querySelector = this.options.mainScriptElement;
  const code = (el.text || el.textContent || el.innerHTML || "");

  this.log.log("Evaluating Script: ", el);
  if (code.match("document.write")) {
    if (console && this.options.logObject.log) {
      this.options.logObject.log("Script contains document.write. Can’t be executed correctly. Code skipped ", el);
    }
    return false;
  }

  const src = (el.src || "");
  const parent = el.parentNode || document.querySelector(querySelector) || document.documentElement;
  const script = document.createElement("script");

  const promise = new Promise((resolve) => {
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

  this.log.log('ParentElement => ', parent);

  // execute
  parent.appendChild(script);
  parent.removeChild(script);
  // avoid pollution only in head or body tags
  // of if the setting removeScriptsAfterParsing is active
  if ((["head", "body"].indexOf(parent.tagName.toLowerCase()) > 0) || (this.options.removeScriptsAfterParsing === true)) {
      //Removed this because not necessary in our setup
  }

  return promise;
}
