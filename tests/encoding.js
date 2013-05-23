var Razor = require('../bin/node/razor.js');
exports.encoding = function(test){	
	var equal = test.equal;
	var encode = Razor.basePage.html.encode;
	
	equal(encode('<test>') + '', '&lt;test&gt;', 'encodes');
	equal(encode(encode('<test>')) + '', '&lt;test&gt;', 'won\'t double-encode');
	equal(Razor.compile('hello @html.raw("<test>")')(), 'hello <test>', 'won\'t encode for html.raw()');
	
	test.done();
};