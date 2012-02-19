var http = require('http'), Razor = require('./Razor');

http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/html'});
  var view = Razor.compile('\
    <!doctype html>\
    <strong>Hello, @model.name!!</strong>\
    ');
  
  res.end(view({ name: 'Andy' }));
}).listen(1337, "127.0.0.1");

console.log('Server running at http://127.0.0.1:1337/');