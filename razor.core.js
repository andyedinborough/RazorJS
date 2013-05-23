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

var _function_template = '"use strict";\n#3\n' +
	'var page = this, model = page.model, viewBag = this.viewBag, writer = this.writer, html = this.html;\n' + 
	'var isSectionDefined = this.isSectionDefined ? bind(this.isSectionDefined, this) : undefined;\n' +
	'var renderSection = this.renderSection ? bind(this.renderSection, this) : undefined;\n' +
	'var renderBody = this.renderBody ? bind(this.renderBody, this) : undefined;\n' +
	'#1\n#2\n#0\n#4\nreturn writer.join("");';

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

					var parsed = parse(block.substr(0, block.length - 1), level + 1, 1).join('\n') + '}',
						paren = parsed.indexOf('('),
						bracket = parsed.indexOf('{');
					if (paren === -1 || bracket< paren) paren = bracket;
					if (peek === 'h') helpers.push('function ' + parsed.substr(7));
					else if (peek === 's') sections.push('page.sections.' + parsed.substr(8, paren - 8) + ' = function () {' + 
						_function_template
							.replace('#1', '')
							.replace('#2', '')
							.replace('#3', '')
							.replace('#4', '')
							.replace('#5', '')
							.replace('#0', parsed.substr(bracket + 1))
						
						);
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
				var tag_written = false, tagname = (rdr.text.substr(rdr.position + 1, 30).match(rxTagName) || 0)[0] || '';
				if (tagname) {
					cmds.push(chunk.value, 0);
					while(!rdr.eof()) {
						chunk = rdr.readUntil('@', '>');
						if(chunk.next == '@') {
							cmds.push((tag_written ? '' : '<') + chunk.value, 2);
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
			.replace('#2', map(sections, returnEmpty).join('\r\n'))
			.replace('#3', 'var _layout = this.layout, layout;')
			.replace('#4', 'if(_layout !== layout) { this.layout = layout; }');
	return template;
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
	attributeEncode: function (value) {
		return encode(value);
	},
	raw: function (value) {
		return htmlString(value);
	},
	renderPartial: function (view, model, page) {
		return htmlString(Razor.view(view)(model, page || this.page));
	}
});

var basePage = {
	html: new HtmlHelper(),
	sections: {},
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
		func = new Function('bind', 'undefined', parsed);
	} catch (x) {
		global.console.error(x.message + ': ' + parsed);
		throw x.message + ': ' + parsed;
	}
	return function execute(model, page1, cb) {
		if(!cb && typeof page1 === 'function') {
			return execute(model, null, page1);
		}
		
		var ctx = extend({ writer: [], viewBag: {} }, basePage, page, page1, { model: model });
		ctx.html = new HtmlHelper();
		ctx.html.page = ctx;
		ctx.html.model = model;
	
		var result = func.apply(ctx, [bind]);

		if(ctx.layout) {
			var render_layout = function(layout_view){				
				var layout_result = layout_view(null, {
						renderBody: function(){ return htmlString(result); },
						viewBag: ctx.viewBag,
						isSectionDefined: function(name) {
							return typeof ctx.sections[name] === 'function';
						},
						renderSection: function(name, required) {
							if(this.isSectionDefined(name)) {
								console.log(ctx.sections[name]+'');
								var temp = htmlString(ctx.sections[name].apply(ctx, [bind]));
								return temp;
								
							} else if(required) {
								throw 'Section "' + name + '" not found.';
							}
						}
					}, cb);	
				if(!cb) result = layout_result;
			};
			
			var layout_view = Razor.view(ctx.layout, null, cb ? render_layout : undefined);
			if(!cb) {
				render_layout(layout_view);
			}
		}
		
		if(!cb) {
			return result;
		}
	};
}

var views = {}, etags = {};
function view(id, page, cb) {
	if(!cb && typeof page === 'function') {
		return view(id, undefined, page);
	}

	var key = '~/' + id,
		template = views[key], 
		etag0 = etags[key],
		etag = Razor.getViewEtag(id);
	
	if (!template || etag !== etag0 || Razor.cacheDisabled) {
		var done = function(script){
				if (script) {
					template = views[key] = Razor.compile(script, page);
					etags[key] = etag;
				} 
				if (cb) cb(template);
			};
		
		template = Razor.findView(id, cb ? done : null);
		if(!cb) done(template);
		
		return template;

	} else if (cb) {
		cb(template);
	} else return template;
}

var Razor = {
	view: view, compile: compile, parse: parse, findView: null,
	basePage: basePage, Cmd: Cmd, extend: extend, bind: bind,
	render: function (markup, model, page, cb) {
		var result;
		compile(markup)(model, page, function(html) {
			result = html;
			if(cb) cb(result);			
		}); 
		return result;
	},
	getViewEtag: null,
	views: views, etags: etags, cacheDisabled: false
};