import {forEachEls} from "../utility";

export default function(els, events, listener, useCapture) {
  events = (typeof events === "string" ? events.split(" ") : events);

  events.forEach(function(e) {
    forEachEls(els, function(el) {
      el.addEventListener(e, listener, useCapture);
    });
  });
}
