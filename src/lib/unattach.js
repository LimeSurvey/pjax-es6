unattachLink: require("./lib/proto/unattach-link.js"),
unattachForm: require("./lib/proto/unattach-form.js"),

var offAll = function(el){
  off(el, 'click');
  off(el, 'keyup');
}

module.exports = function(el) {
  var that = this

  forEachEls(this.getElements(el), offAll, this)

}
