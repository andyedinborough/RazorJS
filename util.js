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