function ifNative(func) {
	if (func && (func+'').indexOf('[native code]') > -1)
		return func;
}

var proxy = function (func) {
	return function (obj, arg) { return func.apply(obj, [arg]); };
};

var each = proxy(ifNative(Array.prototype.forEach) || function (func, thisObj) {
	var l = this.length, j = l, i, scope = thisObj || global;
	while (j--) func.apply(scope, [this[(i = l - j - 1)], i]);
});

var map = proxy(ifNative(Array.prototype.map) || function (fn, thisObj) {
	var scope = thisObj || global, a = [];
	for (var i = 0, j = this.length; i < j; ++i) {
		a.push(fn.call(scope, this[i], i, this));
	}
	return a;
});

var some = proxy(ifNative(Array.prototype.some) || function (fn, thisObj) {
	var scope = thisObj || global;
	for (var i = 0, j = this.length; i < j; ++i) {
		if (fn.call(scope, this[i], i, this)) {
			return true;
		}
	}
	return false;
});

//Dear IE8: I hate you.
var specialKeys = 'toString valueOf'.split(' ');
var objectKeys = ifNative(Object.keys) || function (a) {
	var ret = [];
	for (var i in a)
		if (a.hasOwnProperty(i))
			ret.push(i);
	each(specialKeys, function (key) {
		if (a[key] !== Object.prototype[key])
			ret.push(key);
	});
	return ret;
};
