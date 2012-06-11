/*global window, Array */
/*jshint curly: false, evil: true */
(function (global) {
  'use strict';
  
  if(!Array.prototype.map) {
    Array.prototype.map = function (fn, thisObj) {
      var scope = thisObj || global;
      var a = [];
      for (var i = 0, j = this.length; i < j; ++i) {
        a.push(fn.call(scope, this[i], i, this));
      }
      return a;
    };
  }

  var Razor;
  // <import/>
  
  Razor.findView = function findViewInDocument(id) {
    var script;
    [].slice.call(global.document.getElementsByTagName('script'))
      .some(function (x) {
      return x.type === 'application/x-razor-js' &&
        x.getAttribute('data-view-id') === id &&
        (script = x);
    });
    return script ? script.innerHTML : undefined;
  };

  global.Razor = Razor;
  
})(window);