/*global module, deferred, console, process, require */
/*jshint curly: false, evil: true */
(function () {
  'use strict'; 

  var Razor;
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

	var Reader = (function () {
		var reader = function (text) {
			this.text = (text || '') + '';
			this.position = -1;
			this.length = this.text.length;
		};

		var Chunk = reader.Chunk = function (value, next) {
			this.value = value || ''; this.next = next || '';
			if(!value && !next) return '';
			this.length = (this.value + this.next).length;
		};
		extend(Chunk.prototype, {
			length: 0,
			toString: function () { return this.value + this.next + ''; }
		});
		Chunk.create = function(value, next) {
			if(!value && !next) return '';
			return new Chunk(value, next);
		};

		function read(rdr, chars, until) {
			var l, cache = [], result = '', next = '';

			function predicate(chr) {
				l = chr.length;
				next = cache[l] || (cache[l] = rdr.peek(l));
				return next === chr;
			}

			while (!rdr.eof()) {
				cache.length = 0;
				if (until === some(chars, predicate)) {
					if (until) {
						rdr.seek(l);
					} else {
						next = last(result);
						result = result.length > 0 ? result.substr(0, result.length - 1) : '';
					}
					return Chunk.create(result, next);
				}

				next = rdr.read();
				if (next) {
					result += next;
				} else break;
			}

			return Chunk.create(result, next);
		}

		extend(reader.prototype, {
			eof: function() {
				return this.position >= this.length;
			},

			read: function (len) {
				var value = this.peek(len);
				this.position = Math.min(this.length, this.position + (len || 1));
				return value;
			},

			readAll: function () {
				if (this.position >= this.length) return undefined;
				var value = this.text.substr(this.position + 1);
				this.position = this.length;
				return value;
			},

			peek: function (len) {
				if ((this.position + 1) >= this.length) return undefined;
				return this.text.substr(this.position + 1, len || 1);
			},

			seek: function (offset, pos) {
				this.position = Math.max(0,
				Math.min(this.length,
					(pos === 0 ? 0 : pos === 2 ? this.length : this.position) +
					(offset || 1)
					)
				);
				return this.position === this.length;
			},

			readUntil: function (chars) {
				if (typeof chars === 'string') chars = [].slice.call(arguments);
				return read(this, chars, true);
			},

			readWhile: function (chars) {
				if (typeof chars === 'string') chars = [].slice.call(arguments);
				return read(this, chars, false);
			}
		});

		return reader;
	})();

	//Reader Extensions
	var rxValid = /^[a-z0-9\._]+/ig, rxTagName = /^[a-z]+(?:\:[a-z]+)?/ig;
	function last(str) {
		return (str = (str || '')).substr(str.length - 1);
	}

	Reader.prototype.readWhitespace = function () {
		return this.readWhile('\r', '\n', '\t', ' ');
	};

	Reader.prototype.readQuoted = function (quote) {
		var result = '', block;
		while (true) {
			block = this.readUntil(quote);
			if (!block) break;
			result += block.value + block.next;
			if (last(block.value) !== '\\')
				break;
		}
		return result;
	};

	Reader.prototype.readQuotedUntil = function (chars) {
		var result = '', block;
		if (typeof chars == 'string') chars = [].slice.call(arguments);
		chars = ['"', "'", '@*'].concat(chars);

		while (!!(block = this.readUntil(chars))) {
			result += block.value;
			if (block.next === '"' || block.next === "'") {
				result += block.next + this.readQuoted(block.next);

			} else if (block.next === '@*') {
				this.readUntil('*@');
			} else break;
		}

		return Reader.Chunk.create(result, block.next);
	};

	Reader.prototype.readBlock = function (open, close, numOpen) {
		var block, blockChars = [open, close], ret = '';
		numOpen = numOpen || 0;

		while (!!(block = this.readUntil(blockChars))) {
			ret += block.value;

			if (block.next === open) {
				numOpen++;
			} else if (block.next === close) {
				numOpen--;
			}

			if (numOpen === 0) {
				ret += block.next;
				return ret;
			} else ret += block.next;
		}

		return ret;
	};

	var Cmd = function (code, type) {
		this.code = code || '';
		this.type = type || 0;
	};
	extend(Cmd.prototype, {
		type: 0, code: '',
		toString: function () {
			var code = this.code;
			if (this.type === 0) return code;
			if (this.type === 2) return "page.writeLiteral(\"" + doubleEncode(code) + "\");";
			return 'page.write(' + code + ');';
		}
	});

	var _function_template = 'var page = this, writer = page.writer, model = page.model, html = page.html;\n#1\n#2\n#0\nreturn writer.join("");';

	function parse(template) {
		var rdr = new Reader(template),
			level = arguments[1] || 0, mode = arguments[2] || 0,
			cmds = [], helpers = [], sections = [], chunk, peek, block,
			parseCodeBlock = function(){				
				peek = rdr.peek();
				if (peek === '*') rdr.readUntil('*@');
					else if (peek === '(') {
						block = rdr.readBlock('(', ')');
						cmds.push(block.substr(1, block.length - 2), 1);

					} else if (peek === '{') {
						block = rdr.readBlock('{', '}');
						cmds.push(parse(block.substr(1, block.length - 2), level + 1, 1).join('\n'));

					} else if (peek === ':' && mode === 1) {
						block = rdr.readUntil('\n', '@', '}');
						while (block.next === '@' && rdr.peek() === '@') {
							var temp = rdr.readUntil('\n', '@', '}');
							block.value += temp.value;
							block.next = temp.next;
						}
						rdr.seek(-1);
						block.value = block.value.substr(1);
						cmds.push(block.value, 2);

					} else if (
							(peek === 'i' && rdr.peek(2) === 'if') ||
							(peek === 'd' && rdr.peek(2) === 'do') ||
							(peek === 'f' && rdr.peek(3) === 'for') ||
							(peek === 'w' && rdr.peek(5) === 'while') ||
							(peek === 'h' && rdr.peek(6) === 'helper') ||
							(peek === 's' && rdr.peek(7) === 'section')
						) {
						block = rdr.readBlock('{', '}');
						if (peek === 'i') {
							while (!rdr.eof()) {
								var whiteSpace = rdr.readWhitespace();
								if (!whiteSpace) break;
								else if (rdr.peek(4) !== 'else') {
									rdr.seek(-whiteSpace.length);
									break;
								}
								block += whiteSpace + rdr.readBlock('{', '}');
							}
						}

						var parsed = parse(block.substr(0, block.length - 1), level + 1, 1).join('\n') + '}';
						if (peek === 'h') helpers.push('function ' + parsed.substr(7));
						else if (peek === 's') sections.push('function _section_' + parsed.substr(8));
						else cmds.push(parsed);

					} else if (peek && !rxValid.test(last(chunk.value))) {
						var remain, match;
						block = ''; 
						while (!rdr.eof()) {
							remain = rdr.text.substr(rdr.position + 1);
							match = remain.match(rxValid);
							if (!match) break;
							block += rdr.read(match[0].length);
							peek = rdr.peek();
							if(!peek) break;
							if (peek === '[' || peek === '(') {
								block += rdr.readBlock(peek, peek === '[' ? ']' : ')');
								break;
							}
						}
						if (block) cmds.push(block, 1);
					} else if (mode === 0) {
						if(chunk.next) cmds.push('@', 2);
					}
			};

		cmds.push = (function (push) {
			return function (code, type) {
				if (typeof code === 'string') code = [code];
				code = map(code, function (x) {
					return typeof x.code !== 'undefined' ? x : new Cmd(x, type);
				});
				push.apply(this, code);
			};
		})(cmds.push);

		while (!rdr.eof()) {
			chunk = mode === 0 ? rdr.readUntil('@') : rdr.readQuotedUntil('@', '<');
			if (!chunk) break;

			while (true) {
				peek = rdr.peek();

				if (peek === '@') chunk.value += rdr.read();

				if (mode === 1 && chunk.next === '<') {
					//the longest tagname is 8 chars, reading 30 out to cover it
					var tag_written, tagname = (rdr.text.substr(rdr.position + 1, 30).match(rxTagName) || 0)[0] || '';
					if (tagname) {
						cmds.push(chunk.value, 0);
						while(!rdr.eof()) {
							chunk = rdr.readUntil('@', '>');
							if(chunk.next == '@') {
								cmds.push('<'+chunk.value, 2);
								tag_written = true;
								parseCodeBlock();
							} else break;
						}
						block = chunk + '';
						if (last(chunk.value) !== '/') {
							var nested_count = 1, nested;
							while(nested_count > 0) {
								nested = rdr.readQuotedUntil(['</'+tagname,'<'+tagname]);
								block += nested;
								if(rdr.eof()) break;
								nested_count += nested.next.substr(1,1) === '/' ? -1 : 1;
							}
							block += rdr.readQuotedUntil('>');
						}
						if(!tag_written) {
							if(tagname === 'text'){
								block = block.substr(5, block.length - 5 - 7);
							} else block = '<' + block;
						} 
						cmds.push(parse(block, level + 1, 0));
					} else {
						var chunk1 = rdr.readQuotedUntil('@', '<');
						chunk.value += chunk.next + chunk1.value;
						chunk.next = chunk1.next;
						continue;
					}

				} else if (chunk.value) {
					if (mode === 0) cmds.push(chunk.value, 2);
					else cmds.push(chunk.value);
				}
				break;
			}

			parseCodeBlock();
		}

		if (level > 0) return cmds;
		template = cmds.join('\r\n');
		template = _function_template
				.replace('#0', template)
				.replace('#1', map(helpers, returnEmpty).join('\r\n'))
				.replace('#2', map(sections, returnEmpty).join('\r\n'));
		return template;
	}

	function returnEmpty(func) {
		var i = func.indexOf('{');
		return func.substr(0, i + 1) + '\r\n' + func.substring(i + 1, func.lastIndexOf('}')) + '; return ""; }';
	}

	function doubleEncode(txt) {
		return txt.split('\r').join('\\r').split('\n').join('\\n').split('"').join('\\"');
	}

	function htmlString(value) { return { toString: function () { return value; }, isHtmlString: true }; }

	var htmlHelper = {
		encode: function (value) {
			if (value === null || value === undefined) value = '';
			if (value.isHtmlString) return value;
			if (typeof value !== 'string') value += '';
			value = value
				.split('&').join('&amp;')
				.split('<').join('&lt;')
				.split('>').join('&gt;')
				.split('"').join('&quot;');
			return htmlHelper.raw(value);
		},
		attributeEncode: function (value) {
			return htmlHelper.encode(value);
		},
		raw: function (value) {
			return htmlString(value);
		},
		renderPartial: function (view, model) {
			return this.raw(Razor.view(view)(model));
		}
	}, basePage = {
		html: htmlHelper,
		write: function (txt){ 
			this.writeLiteral(this.html.encode(txt)); 
		},
		writeLiteral: function(txt){ 
			this.writer.push(txt); 
		}
	};

	function compile(code, page) {
		var func, parsed = parse(code);
		try {
			func = new Function(parsed);
		} catch (x) {
			global.console.error(x.message + ': ' + parsed);
			throw x.message + ': ' + parsed;
		}
		return function (model, page1) {
			var ctx = extend(page1 || {}, basePage, page, { model: model, writer:[] });
			return func.apply(ctx);
		};
	}

	var views = {}, async = false;
	function view(id, page) {
		var template = views['~/' + id];
		if (!template) {
			var result = Razor.findView(id);
			if (!result) return;
			if (typeof result.done === 'function') {
				async = true;
				var dfd = deferred();
				result.done(function (script) {
					if (script) {
						template = views['~/' + id] = Razor.compile(script, page);
					}
					dfd.resolve(template);
				});
				return dfd;
			} else if (result) {
				return views['~/' + id] = Razor.compile(result, page);
			}
		} else if (async) {
			return deferred().resolve(template);
		} else return template;
	}

	Razor = {
		view: view, compile: compile, parse: parse, findView: null,
		basePage: basePage, Cmd: Cmd,
		render: function (markup, model, page) { return compile(markup)(model, page); }
	};
  
  Razor.findView = function findViewInFileSystem(viewName) {
    var fs = require('fs'), dfd = deferred();
    if (viewName.substring(viewName.lastIndexOf('.')) !== '.jshtml')
      viewName += '.jshtml';

    fs.readFile(viewName, 'ascii', function (err, data) {
      if (err) {
        console.error("Could not open file: %s", err);
        process.exit(1);
      }

      dfd.resolve(data.toString('ascii'));
    });
    return dfd;
  };

	module.Razor = module.exports.Razor = Razor;
  
})(module);