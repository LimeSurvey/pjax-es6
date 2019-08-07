import ConsoleShim from '../ConsoleShim';

export default function () {

    if (!this.options.debug) {
        this.options.logObject = new ConsoleShim('PJAX ->', true);
    }
    if(!this.options.logObject) {
        this.options.logObject = new ConsoleShim('PJAX ->');
    }

    const Logger = function() {
        if (typeof this.options.logObject.log === "function") {
            this.options.logObject.log.apply(this.options.logObject, ['PJAX ->',...arguments]);
        }
        // ie is weird
        else if (this.options.logObject.log) {
            this.options.logObject.log(['PJAX ->',...arguments]);
        }
    };

    Logger.warn = () => this.options.logObject.warn(['PJAX ->',...arguments]);
    Logger.error = () => this.options.logObject.error(['PJAX ->',...arguments]);

    return Logger;
  }

