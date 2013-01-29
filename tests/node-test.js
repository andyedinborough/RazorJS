var http = require('http'), Razor = require('../bin/node/Razor.js');

http.createServer(function (req, res) {
  
  Razor.view('test', function(template) {
    template({ name: 'Andy Edinborough' }, function(html){
  		
  		res.writeHead(200, {'Content-Type': 'text/html'});
    	res.end(html);	

    });
  });

}).listen(1337, "127.0.0.1");

console.log('Server running at http://127.0.0.1:1337/');