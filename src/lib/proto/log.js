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
