

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
var rxValid = /^[a-z0-9\._]+/i, rxTagName = /^[a-z]+(?:\:[a-z]+)?/i;
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