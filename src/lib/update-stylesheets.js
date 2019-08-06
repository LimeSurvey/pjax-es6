import './polyfills/Array.prototype.from';
import {
  forEachEls
} from './utility';
export default function () {
  return (elements, oldElements) => {
    this.log("styleheets old elements", oldElements);
    this.log("styleheets new elements", elements);

    forEachEls(elements, (newEl) => {

      const resemblingOld = Array.from(oldElements).reduce((acc, oldEl) => {
        acc = ((oldEl.href === newEl.href) ? oldEl : acc);
        return acc;
      }, null);

      if (resemblingOld !== null) {
        if (this.log) {
          this.log("old stylesheet found not resetting");
        }
      } else {
        if (this.log) {
          this.log("new stylesheet => add to head");
        }
        const head = document.getElementsByTagName('head')[0];
        const link = document.createElement('link');

        link.setAttribute('href', newEl.href);
        link.setAttribute('rel', 'stylesheet');
        link.setAttribute('type', 'text/css');
        head.appendChild(link);
      }
    });
  }
}
