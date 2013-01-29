var http = require('http'), 
	url = require('url'),
	Razor = require('../bin/node/Razor.js');

http.createServer(function (req, res) {
	var uri = url.parse(req.url),
		path = uri.pathname.substr(1) || 'index';

	Razor.view(path, function(template) {
		if(template) {
			template({ name: 'Andy Edinborough' }, function(html){
				res.writeHead(200, {'Content-Type': 'text/html'});
				res.end(html); 
			});
		} 

		else {
				res.writeHead(404, {'Content-Type': 'text/html'});
				res.end('<h1>Not Found</h1>');            
		}
	});

}).listen(1337, "127.0.0.1");

console.log('Server running at http://127.0.0.1:1337/');