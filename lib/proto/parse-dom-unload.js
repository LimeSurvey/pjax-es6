var forEachEls = require("../foreach-els")

var parseElementUnload = require("./parse-element-unload")

module.exports = function(el) {
  forEachEls(this.getElements(el), parseElementUnload, this)
}
