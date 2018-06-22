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
