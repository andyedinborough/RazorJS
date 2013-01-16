var http = require('http'), Razor = require('../bin/node/Razor.js');

http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/html'});
  Razor.view('test', function(template) {
      res.end(template({ name: 'Andy <b> test' }));
    });
}).listen(1337, "127.0.0.1");

console.log('Server running at http://127.0.0.1:1337/');