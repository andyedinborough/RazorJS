var rxExport = /(\/+\*?)\s*<export>\s*\*?\/*\s+((.*\s*)+)\s+(\/+\*?)\s*<\/export>(\s*\*\/\/)?/gi,
  rxImport = /(\/+\*?)\s*<import\s*\/>(\s+\*\/\/)?/gi;
  
function customs(carrier, shipment){
  shipment = rxExport.matches(shipment)[2] || '';
  return carrier.replace(rxImport, shipment.trim());
}

RegExp.prototype.matches = function(str) {
  this.lastIndex = 0;
  return this.exec(str); 
};
  
function test(){
  var carrier = '1\r\n//<import />\r\n3',
    shipment = '4\r\n//<export>\r\n2\r\n//</export>\r\n5',
    output = customs(carrier, shipment),
    expected = '1\r\n2\r\n3';
  
  if(output !== expected) {
    throw 'import/exports failed. ' + 
      '\r\n\t<expected>' + JSON.stringify(expected) + '</expected>' + 
      '\r\n\t<output>' + JSON.stringify(output) + '</output>';
  }
}
test();

var ext = process.argv[2] || 'browser',
  fs = require('fs'),
  razorJs, razorExtJs,
  razorJsFile = 'Razor.base.js',
  razorExtJsFile = 'Razor.' + ext + '.js',
  uglify = require('c:/users/andy/appdata/roaming/npm/node_modules/uglify-js'),
  jshint = require('c:/users/andy/appdata/roaming/npm/node_modules/jshint'),
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

razorJs = customs(razorJs, razorExtJs);
fs.writeFileSync('bin/' + ext + '/Razor.js', razorJs);

razorMinJs = uglify(razorJs);
fs.writeFileSync('bin/' + ext + '/Razor.min.js', razorMinJs);
