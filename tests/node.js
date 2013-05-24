var Razor = require('../bin/node/razor.js');

function parseHtml(html, cb){
	var htmlparser = require('htmlparser'),
		select = require('soupselect').select,
		parser = new htmlparser.Parser(new htmlparser.DefaultHandler(function(err, dom) {
			cb(function(selector) {
				return select(dom, selector);
			});
		}));
	parser.parseComplete(html);
}

exports.node = function(test){
	var equal = test.equal, ok = test.ok;
 	test.expect(2);
	
	Razor.getViewFile = (function(getViewFile){
		return function(){
			var result = getViewFile.apply(this, arguments);
			result = './tests/' + result.replace(/^[\.\/]+/g, '');
			return result;
		};
	})(Razor.getViewFile);

	
	Razor.view('index', function(view){
		view({ name: 'RazorJS' }, function(html){
			
			parseHtml(html, function($){
				equal($('meta').length, 1, '<meta>');
				equal($('strong')[0].children[0].data, 'RazorJS', '<strong>');
				test.done();
			});
			
		});
	});
	
};