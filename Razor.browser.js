/*global window, Array */
/*jshint curly: false, evil: true */
(function(global) {
	'use strict';

	if(!Array.prototype.map) {
		Array.prototype.map = function(fn, thisObj) {
			var scope = thisObj || global;
			var a = [];
			for(var i = 0, j = this.length; i < j; ++i) {
				a.push(fn.call(scope, this[i], i, this));
			}
			return a;
		};
	}

	var Razor;
	// <import/>

	var scripts = global.document.getElementsByTagName('script');
	Razor.findView = function findViewInDocument(id) {
		var script;
		for(var i = 0, ii = scripts.length; i<ii; i++){
			script = scripts[i];	
			if(script.type === 'application/x-razor-js' &&
				script.getAttribute('data-view-id') === id) {
					return script.innerHTML;
				}
		}
	};

	global.Razor = Razor;

})(window);