// js/util.js — math helpers shared by logic and renderer.
window.BS = window.BS || {};

BS.Util = {
  TAU: Math.PI * 2,
  DEG: Math.PI / 180,

  clamp: function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; },
  lerp: function (a, b, t) { return a + (b - a) * t; },
  rand: function (lo, hi) { return lo + Math.random() * (hi - lo); },
  randInt: function (lo, hi) { return Math.floor(BS.Util.rand(lo, hi + 1)); },
  pick: function (arr) { return arr[Math.floor(Math.random() * arr.length)]; },
  dist: function (ax, ay, bx, by) { var dx = bx - ax, dy = by - ay; return Math.sqrt(dx * dx + dy * dy); },

  // normalise angle to (-PI, PI]
  normAngle: function (a) {
    a = a % BS.Util.TAU;
    if (a > Math.PI) a -= BS.Util.TAU;
    if (a <= -Math.PI) a += BS.Util.TAU;
    return a;
  },
  angleTo: function (ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); },
  lerpAngle: function (a, b, t) { return a + BS.Util.normAngle(b - a) * t; },

  // rotate a local ship offset (x forward, y starboard) into world space
  localToWorld: function (ship, lx, ly, heading) {
    var h = heading === undefined ? ship.heading : heading;
    var c = Math.cos(h), s = Math.sin(h);
    var sc = (ship.visual && ship.visual.scale) || 1;
    return { x: ship.pos.x + (lx * c - ly * s) * sc, y: ship.pos.y + (lx * s + ly * c) * sc };
  },

  // seeded PRNG (mulberry32) for deterministic starfields
  seededRandom: function (seed) {
    var t = seed >>> 0;
    return function () {
      t += 0x6D2B79F5;
      var r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  },

  formatTime: function (seconds) {
    var m = Math.floor(seconds / 60), s = Math.floor(seconds % 60);
    return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
  },

  template: function (str, vars) {
    return str.replace(/\{(\w+)\}/g, function (_, k) { return vars[k] !== undefined ? vars[k] : "{" + k + "}"; });
  },

  capitalize: function (s) { return s.charAt(0).toUpperCase() + s.slice(1); },
};
