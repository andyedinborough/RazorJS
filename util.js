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

function encode(value){
	if (value === null || value === undefined) value = '';
	if (value.isHtmlString) return value;
	if (typeof value !== 'string') value += '';
	value = value
		.split('&').join('&amp;')
		.split('<').join('&lt;')
		.split('>').join('&gt;')
		.split('"').join('&quot;');
	return htmlString(value);
}

var HtmlHelper = function(){ };
extend(HtmlHelper.prototype, {
	encode: encode,
	attributeEncode: encode,
	raw: htmlString,
	renderPartial: function (view, model, page) {
		return htmlString(Razor.view(view)(model, page || this.page));
	}
});