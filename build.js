var rxExport = /(\/+\*?)\s*<export>\s*\*?\/*\s+((.*\s*)+)\s+(\/+\*?)\s*<\/export>(\s*\*\/)?/gi,
  rxImport = /(\/+\*?)\s*<import\s*\/>(\s+\*\/\/)?/gi;
  
function customs(carrier, shipment){
  shipment = (rxExport.execute(shipment)||[])[2] || '';
  return carrier.replace(rxImport, shipment.trim());
}

RegExp.prototype.execute = function(str) {
  this.lastIndex = 0;
  return this.exec(str+''); 
};
  
function test(){
  var carrier = '1\r\n//<import />\r\n4',
    shipment = '4\r\n//<export>\r\n2\r\n3\r\n//</export>\r\n5',
    output = customs(carrier, shipment),
    expected = '1\r\n2\r\n3\r\n4';
  
  if(output !== expected) {
    throw 'import/exports failed. ' + 
      '\r\n\t<expected>' + JSON.stringify(expected) + '</expected>' + 
      '\r\n\t<output>' + JSON.stringify(output) + '</output>';
  }
}
test();

var ext, exts = (process.argv[2] || 'browser,node').split(','),
  fs = require('fs');

while((ext = exts.shift())) {
  var razorJs, razorExtJs,
    razorJsFile = 'Razor.base.js',
    razorExtJsFile = 'Razor.' + ext + '.js',
    uglify = function(orig_code, options) {
      options = options || {mangle:true};
      var jsp = require("uglify-js").parser;
      var pro = require("uglify-js").uglify;

      var ast = jsp.parse(orig_code); // parse code and get the initial AST
      ast = pro.ast_mangle(ast, options); // get a new AST with mangled names
      ast = pro.ast_squeeze(ast, options); // get an AST with compression optimizations
      var final_code = pro.gen_code(ast, options); // compressed code here
      return final_code;
    },
    jshint = require('jshint'),
    razorMinJs,
    Razor, result;

  fs.mkdir('bin');  
  fs.mkdir('bin/' + ext);  
  razorJs = fs.readFileSync(razorJsFile, 'utf8');
  razorExtJs = fs.readFileSync(razorExtJsFile, 'utf8');

  (function(){
    var args = [].slice.call(arguments), arg;
    while((arg = args.shift())){
      if(!jshint.JSHINT(arg.code)){
        var errors = jshint.JSHINT.errors, error;
        while((error = errors.shift())){
          console.warn(arg.file + ' (' + error.line + ',' + error.character + '): ' +
            error.reason + '\r\n\t' + error.evidence);
        }
      }
    }

  })({ code: razorJs, file: razorJsFile}, {code: razorExtJs, file: razorExtJsFile });

  console.log('bin/' + ext + '/Razor.js');
  razorJs = customs(razorExtJs, razorJs);
  fs.writeFileSync('bin/' + ext + '/Razor.js', razorJs);

  console.log('bin/' + ext + '/Razor.min.js');
  razorMinJs = uglify(razorJs);
  fs.writeFileSync('bin/' + ext + '/Razor.min.js', razorMinJs);
}
