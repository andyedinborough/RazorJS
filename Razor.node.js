Razor.findView = function findViewInFileSystem(viewName) {
  var fs = require('fs'), dfd = deferred();
  if (viewName.substring(viewName.lastIndexOf('.')) !== '.jshtml')
    viewName += '.jshtml';

  fs.readFile(viewName, 'ascii', function (err, data) {
    if (err) {
      console.error("Could not open file: %s", err);
      process.exit(1);
    }

    dfd.resolve(data.toString('ascii'));
  });
  return dfd;
};

module.Razor = module.exports.Razor = Razor; 