var Razor;
var Cmd = function (code, type) {
	this.code = code || '';
	this.type = type || 0;
};
extend(Cmd.prototype, {
	type: 0, code: '',
	toString: function () {
		var code = this.code;
		if (this.type === 0) return code;
		if (this.type === 2) return "writeLiteral(\"" + doubleEncode(code) + "\");";
		return 'write(' + code + ');';
	}
});

var _function_template_basic = 'var writer = [], writeLiteral = function(a) { writer.push(a); }, write = function(a){ writeLiteral(html.encode(a)); };\n';
var _function_template = 
	_function_template_basic + 
	'var page = this, model = page.model, viewBag = this.viewBag, html = this.html,\n' + 
	'	isSectionDefined = this.isSectionDefined ? bind(this.isSectionDefined, this) : undefined,\n' +
	'	renderSection = this.renderSection ? bind(this.renderSection, this) : undefined,\n' +
	'	renderBody = this.renderBody ? bind(this.renderBody, this) : undefined,\n' +
	'	_layout = this.layout, layout;\n' +
	'@code\nif(_layout !== layout) { this.layout = layout; }\nreturn writer.join("");\n';

function parse(template) {
	var rdr = new Reader(template),
		level = arguments[1] || 0, mode = arguments[2] || 0,
		cmds = [], helpers = [], sections = [], chunk, peek, block, bracket,
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

					var parsed = parse(block.substr(0, block.length - 1), level + 1, 1).join('\r\n\t'),
						paren = parsed.indexOf('(');
					bracket = parsed.indexOf('{');
					if (paren === -1 || bracket < paren) paren = bracket;
					if (peek === 'h') helpers.push('function ' + parsed.substring(7, bracket) + '{' +
						_function_template_basic + parsed.substr(bracket + 1) + 
						'\nreturn html.raw(writer.join(""));\n}\n');
					else if (peek === 's') sections.push('sections.' + parsed.substr(8, paren - 8) + ' = function () {' + 
						_function_template_basic + parsed.substr(bracket + 1) + 
						'\nreturn writer.join("");\n}\n');
					else cmds.push(parsed + '}');

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
							remain = rdr.readBlock(peek, peek === '[' ? ']' : ')');
							if(peek === '(' && (/\s*function[\s*\(]/).test(remain)) {
								bracket = remain.indexOf('{');
								block += remain.substr(0, bracket);
								block += parse(remain.substr(bracket), level + 1, 1).join('\r\n\t');
							} else {
								block += remain;
							}
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
	return { 
		code: cmds.join('\r\n'), 
		sections: sections, 
		helpers: helpers
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
 
function compile(code, page) {
	var func, parsed = parse(code);
	
	parsed = (Razor.options.strict ? '"use strict";\r\n' : '') +
		_function_template.replace('@code', 
			parsed.helpers.join('\r\n') + '\r\n' + 
			parsed.sections.join('\r\n') + 
			parsed.code
		);
	
	try {
		func = new Function('bind', 'sections', 'undefined', parsed);
	} catch (x) {
		if(Razor.options.onerror(x, parsed) !== false) {
			throw x.message + ': ' + parsed;
		}
	}
	return function execute(model, page1, cb) {
		if(!cb && typeof page1 === 'function') {
			return execute(model, null, page1);
		}
		
		var ctx = extend({ viewBag: {} }, new Razor.BasePage(), page, page1, { model: model }),
			sections = {};
		ctx.html = new HtmlHelper();
		ctx.html.page = ctx;
		ctx.html.model = model;
	
		var result = func.apply(ctx, [bind, sections]);

		if(ctx.layout) {
			var render_layout = function(layout_view){				
				var layout_result = layout_view(null, {
						renderBody: function(){ return htmlString(result); },
						viewBag: ctx.viewBag,
						isSectionDefined: function(name) {
							return typeof sections[name] === 'function';
						},
						renderSection: function(name, required) {
							if(this.isSectionDefined(name)) {
								var temp = htmlString(sections[name]());
								return temp;
								
							} else if(required) {
								throw 'Section "' + name + '" not found.';
							}
						}
					}, cb);	
				if(!cb) return layout_result;
			};
			
			var layout_view = Razor.view(ctx.layout, null, cb ? render_layout : undefined);
			if(!cb) {
				return render_layout(layout_view);
			}
		
		} else if(!cb) {
			return result;
		} else cb(result);
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
	
	if (!template || etag !== etag0 || Razor.options.cacheDisabled) {
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

Razor = {
	utils: {
		extend: extend, bind: bind, Cmd: Cmd
	},
	options: { 
		strict: true, onerror: function(){ }, cacheDisabled: false 
	},
	view: view, compile: compile, parse: parse, findView: null,
	BasePage: function(){ },
	HtmlHelper: HtmlHelper,
	render: function (markup, model, page, cb) {
		var result;
		compile(markup)(model, page, function(html) {
			result = html;
			if(cb) cb(result);			
		}); 
		return result;
	},
	getViewEtag: null,
	views: views, etags: etags
};