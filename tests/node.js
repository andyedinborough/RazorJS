var Razor = require('../bin/node/razor.js');

exports.node = function(test){
	var equal = test.equal, ok = test.ok;
 
	Razor.getViewFile = (function(getViewFile){
		return function(){
			var result = getViewFile.apply(this, arguments);
			result = './tests/' + result.replace(/^[\.\/]+/g, '');
			return result;
		};
	})(Razor.getViewFile);

	try {
		console.log('\nRESULT: ' + Razor.view('index')({ name: 'RazorJS' }));	
	} catch (x){ 
		var ex = x instanceof Error ? x : new Error(x);
		console.log('\n' + ex + '\n' + ex.stack);
	}
	
	test.done();
};