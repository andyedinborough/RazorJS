var proxy = function (func) {
	return function (obj, arg) { return func.apply(obj, [arg]); };
},
	each = proxy(Array.prototype.forEach),
	map = proxy(Array.prototype.map),
	some = proxy(Array.prototype.some),
	objectKeys = Object.keys;