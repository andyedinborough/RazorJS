var wrapper;

extend(Razor, {
  getViewFile: function (viewName) {
    if (!viewName.match(/\w+\.\w+$/i))
      viewName += '.html';
    viewName = './views/' + viewName;
    return viewName;
  },

  findView: function (viewName, cb) {
    var fs = require('fs'), file = Razor.getViewFile(viewName);
    fs.readFile(file, function (err, data) {
      cb(err ? undefined : data.toString('utf-8'));
    });
  },

  precompile: function(code, page) {
    if(!page) page = {}; 
    code = 'var page1 = ' + JSON.stringify(page) + 
      ', func = function(){ ' + Razor.parse(code) + ' }';
    if(!wrapper) wrapper = Razor.compile('');

    code = '(function(){ ' + code + ';\nreturn ' + wrapper + '; })()';
    code = code
      .replace(/(\W)extend(\W)/g, '$1Razor.extend$2')
      .replace(/(\W)basePage(\W)/g, '$1Razor.basePage$2');

    return code;
  }
});

module.Razor = module.exports = Razor; 