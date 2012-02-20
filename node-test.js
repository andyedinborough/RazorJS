var http = require('http'), Razor = require('./Razor');

http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/html'});
  Razor.view('test')
    .done(function(template) {
      res.end(template({ name: 'Andy' }));
    });
}).listen(1337, "127.0.0.1");

console.log('Server running at http://127.0.0.1:1337/');