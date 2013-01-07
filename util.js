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

var deferred = function Deferred() {
	if (!(this instanceof Deferred)) return new Deferred();
	var dq = [], aq = [], fq = [], state = 0, dfd = this, args,
		process = function (arr, run) {
			var cb;
			while (run && (cb = arr.shift()))
				cb.apply(dfd, args);
		};

	extend(dfd, {
		done: function (cb) {
			if (cb) dq.push(cb);
			process(dq, state === 1);
			process(aq, state !== 0);
			return dfd;
		},
		always: function (cb) {
			aq.push(cb);
			process(aq, state !== 0);
			return dfd;
		},
		fail: function (cb) {
			if (cb) fq.push(cb);
			process(fq, state === -1);
			process(aq, state !== 0);
			return dfd;
		},
		resolve: function () {
			args = arguments;
			if (state === 0) state = 1;
			return dfd.done();
		},
		reject: function () {
			args = arguments;
			if (state === 0) state = -1;
			return dfd.fail();
		}
	});
};

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

function htmlString(value) { return { toString: function () { return value; }, isHtmlString: true }; }