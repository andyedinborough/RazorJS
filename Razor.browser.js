/*global global, Razor */
/*jshint curly: false, evil: true */
(function () {
  'use strict';
  // <export>
  
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
  
  // </export>
})();