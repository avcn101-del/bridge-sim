// js/events.js — tiny publish/subscribe bus. Logic emits, presentation listens.
window.BS = window.BS || {};

BS.Events = (function () {
  var handlers = {};
  return {
    on: function (name, fn) {
      (handlers[name] = handlers[name] || []).push(fn);
      return fn;
    },
    off: function (name, fn) {
      var list = handlers[name];
      if (!list) return;
      var i = list.indexOf(fn);
      if (i >= 0) list.splice(i, 1);
    },
    emit: function (name, payload) {
      var list = handlers[name];
      if (!list) return;
      for (var i = 0; i < list.length; i++) {
        try { list[i](payload); } catch (e) { console.error("Event handler error for " + name, e); }
      }
    },
    clear: function () { handlers = {}; },
  };
})();
