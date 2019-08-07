import ConsoleShim from '../ConsoleShim';

export default function () {
    console.log("PJAX options", this.options);
    this.options.logObject = new ConsoleShim('PJAX ->', !this.options.debug);    
    return this.options.logObject;
  }

