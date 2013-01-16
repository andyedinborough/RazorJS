Razor.findView = function findViewInFileSystem(viewName, cb) {
  var fs = require('fs');
  if (!viewName.match(/\w+\.\w+$/i))
    viewName += '.jshtml';
  viewName = './' + viewName;

  var done = function (err, data) {
    if (err) {
      console.error("Could not open file: %s", err);
      process.exit(1);
    }

    if(cb) cb(data.toString('utf-8'));
  };

  if(cb) return void fs.readFile(viewName, done);
  fs.readFileSync(viewName, done);
};

var wrapper;
Razor.precompile = function(code, page) {
  if(!page) page = {}; 
  code = 'var page1 = ' + JSON.stringify(page) + 
    ', func = function(){ ' + Razor.parse(code) + ' }';
  if(!wrapper) wrapper = Razor.compile('');

  code = code
    .replace(/(\W)extend(\W)/, '$1Razor.extend$2')
    .replace(/(\W)basePage(\W)/, '$1Razor.basePage$2');

  code = '(function(){ \n' + code + ' return ' + wrapper + '; })()';
  return code;
};

module.Razor = module.exports = Razor; 