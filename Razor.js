/*global window */
/*jshint curly: false, evil: true */
var Razor = (function () {
  var Reader = window.Reader = function () {
    'use strict';

    var reader = function (text) {
      this.text = (text || '') + '';
      this.position = -1;
      this.length = this.text.length;
    };

    var chunk = reader.Chunk = function (value, next) {
      if (!this || this.length !== 0) return new reader.Chunk(value, next);
      this.value = value || ''; this.next = next || '';
      this.length = (this.value + this.next).length;
    };
    reader.Chunk.prototype.length = 0;
    reader.Chunk.prototype.toString = function () { return this.value + this.next + ''; };

    reader.prototype.read = function (len) {
      var value = this.peek(len);
      this.position = Math.min(this.length, this.position + (len || 1));
      return value;
    };

    reader.prototype.readAll = function () {
      if (this.position >= this.length) return undefined;
      var value = this.text.substr(this.position + 1);
      this.position = this.length;
      return value;
    };

    reader.prototype.peek = function (len) {
      if ((this.position + 1) >= this.length) return undefined;
      return this.text.substr(this.position + 1, len || 1);
    };

    reader.prototype.seek = function (offset, pos) {
      this.position = Math.max(0,
      Math.min(this.length,
        (pos === 0 ? 0 : pos === 2 ? this.length : this.position) +
        (offset || 1)
        )
      );
      return this.position === this.length;
    };

    function read(rdr, chars, until) {
      var l, cache = [], len = chars.length, result = '', next = '';

      function predicate(chr) {
        l = chr.length;
        next = cache[l] || (cache[l] = rdr.peek(l));
        return next === chr;
      }

      while (true) {
        cache.length = 0;
        if (until === chars.some(predicate)) {
          if (until) {
            rdr.seek(l);
          } else {
            next = last(result);
            result = result.length > 0 ? result.substr(0, result.length - 1) : '';
          }
          return chunk(result, next);
        }

        next = rdr.read();
        if (next) {
          result += next;
        } else break;
      }

      return chunk(result, next);
    }

    reader.prototype.readUntil = function (chars) {
      if (typeof chars === 'string') chars = [].slice.call(arguments);
      return read(this, chars, true);
    };

    reader.prototype.readWhile = function (chars) {
      if (typeof chars === 'string') chars = [].slice.call(arguments);
      return read(this, chars, false);
    };

    return reader;
  } ();

  //Reader Extensions
  var rxValid = /^[a-z0-9\._]+/i;
  function last(str) {
    return (str = (str || ''))[str.length - 1] || '';
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

    while ((block = this.readUntil(chars))) {
      result += block.value;
      if (block.next === '"' || block.next === "'") {
        result += block.next + this.readQuoted(block.next);

      } else if (block.next === '@*') {
        this.readUntil('*@');
      } else break;
    }

    return Reader.Chunk(result, block.next);
  };

  Reader.prototype.readBlock = function (open, close, numOpen) {
    var block, blockChars = [open, close], ret = '';
    numOpen = numOpen || 0;

    while ((block = this.readUntil(blockChars))) {
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

  function parse(template) {
    var rdr = new Reader(template),
      level = arguments[1] || 0, mode = arguments[2] || 0,
      cmds = level > 0 ? [] : ['var writer = []; \r\nfunction write(txt){ writer.push(txt); }\r\nwith(this){'],
      chunk, peek, block;

    while (true) {
      chunk = mode === 0 ? rdr.readUntil('@') : rdr.readQuotedUntil('@', '<');
      if (!chunk || (!chunk.value && !chunk.next)) break;
      peek = rdr.peek();

      if (peek === '@') chunk.value += rdr.read();
      if (chunk.value) {
        if (mode === 0) cmds.push('\twrite("' + doubleEncode(chunk.value) + '");');
        else cmds.push(chunk.value);
      }

      if (mode === 1 && chunk.next === '<') {
        var tagname = rdr.text.substr(rdr.position + 1).match(/^[a-z]+/i);
        if (tagname) {
          chunk = rdr.readUntil('>');
          block = chunk + '';
          if (last(chunk.value) !== '/') {
            block += rdr.readUntil('</' + tagname + '>');
          }
          cmds.push(parse('<' + block, level + 1, 0));
        }
      }

      if (peek === '*') rdr.readUntil('*@');
      else if (peek === '(') {
        block = rdr.readBlock('(', ')');
        cmds.push('\twrite(' + block.substr(1, block.length - 2) + ');');

      } else if (peek === '{') {
        block = rdr.readBlock('{', '}');
        cmds.push(parse(block, level + 1, 1));

      } else if (
          (peek === 'i' && rdr.peek(2) === 'if') ||
          (peek === 'd' && rdr.peek(2) === 'do') ||
          (peek === 'f' && rdr.peek(3) === 'for') ||
          (peek === 'w' && rdr.peek(5) === 'while')
        ) {
        block = rdr.readBlock('{', '}');
        if (peek === 'i') {
          while (true) {
            var whiteSpace = rdr.readWhitespace();
            if (!whiteSpace) break;
            else if (rdr.peek(4) !== 'else') {
              rdr.seek(-whiteSpace.length);
              break;
            }
            block += whiteSpace + rdr.readBlock('{', '}');
          }
        }

        cmds.push(parse(block, level + 1, 1));

      } else if (peek && !rxValid.test(last(chunk.value))) {
        var remain, match, cmd = '';
        while (true) {
          remain = rdr.text.substr(rdr.position + 1);
          match = remain.match(rxValid);
          if (!match) break;
          cmd += rdr.read(match[0].length);
          peek = rdr.peek();
          if (peek === '[' || peek === '(') {
            cmd += rdr.readBlock(peek, peek === '[' ? ']' : ')');
          }
        }
        if (cmd) cmds.push('\twrite(' + cmd + ');');
      } else if (mode === 0 && chunk.next) cmds.push('\twrite("@");');
    }

    return cmds.join('\r\n') + (level > 0 ? '' : '\r\n}\r\nreturn writer.join("");');
  }

  function doubleEncode(txt) {
    return txt.split('\r').join('\\r').split('\n').join('\\n').split('"').join('\\"');
  }

  function extend(a) {
    for (var i = 1, ii = arguments.length; i < ii; i++) {
      var b = arguments[i];
      if (b)
        for (var key in b)
          if (b.hasOwnProperty(key))
            a[key] = b[key];
    }
    return a;
  }

  function compile(code, page) {
    var func, parsed = parse(code);
    console.log(parsed);
    try {
      func = new Function(parsed);
    } catch (x) {
      throw x.message + ': ' + parsed;
    }
    return function (model, page1) {
      var ctx = extend({}, page, page1, { model: model });
      return func.apply(ctx);
    };
  }

  var views = {};
  function view(id, page) {
    var template = views['~/' + id];
    if (!template) {
      var script;
      [ ].slice.call(document.getElementsByTagName('script')).some(function (x) {
        return x.type === 'application/x-razor-js' &&
          x.getAttribute('data-view-id') === id &&
          (script = x);
      });

      if (script) {
        template = views['~/' + id] = Razor.compile(script.innerHTML, page);
      }
    }
    return template;
  }

  return { view: view, compile: compile, parse: parse, render: function (markup, model, page) { return compile(markup, page)(model); } };
})();