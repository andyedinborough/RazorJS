function extend(a) {
	each(arguments, function (b, i) {
		if (i === 0) return;
		if (b)
			each(objectKeys(b), function (key) {
				a[key] = b[key];
			});
	});
	return a;
}

function returnEmpty(func) {
	var i = func.indexOf('{');
	return func.substr(0, i + 1) + '\r\n' + func.substring(i + 1, func.lastIndexOf('}')) + '; return ""; }';
}

function doubleEncode(txt) {
	return txt
		.split('\\').join('\\\\')
		.split('\r').join('\\r')
		.split('\n').join('\\n')
		.split('"').join('\\"');
}

function htmlString(value) { 
	return { 
		toString: function () { 
			return value; 
		}, 
		isHtmlString: true 
	}; 
}