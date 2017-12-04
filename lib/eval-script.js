module.exports = function(el) {
  var querySelector = this.options.mainScriptElement;
  var code = (el.text || el.textContent || el.innerHTML || "")
  var src = (el.src || "");
  var parent = el.parentNode || document.querySelector(querySelector) || document.documentElement
  var script = document.createElement("script")
  var promise = null;

  this.log("Evaluating Script: ", el);

  if (code.match("document.write")) {
    if (console && console.log) {
      console.log("Script contains document.write. Can’t be executed correctly. Code skipped ", el)
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
