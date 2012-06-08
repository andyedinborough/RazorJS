/*global global, Razor, deferred */
/*jshint curly: false, evil: true */
(function () {
  'use strict'; 

  // <export>
  
  Razor.findView = function findViewInFileSystem(viewName) {
    var fs = global.require('fs'), dfd = deferred();
    if (viewName.substring(viewName.lastIndexOf('.')) !== '.jshtml')
      viewName += '.jshtml';

    fs.readFile(viewName, 'ascii', function (err, data) {
      if (err) {
        global.console.error("Could not open file: %s", err);
        global.process.exit(1);
      }

      dfd.resolve(data.toString('ascii'));
    });
    return dfd;
  };
  
  // </export>
  
})();