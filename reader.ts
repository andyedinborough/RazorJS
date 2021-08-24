enum Position {
  Begin = 0,
  End = 2,
}

export class Chunk {
  value: string;
  next: string;
  public length: number;
  constructor(value: string, next?: string) {
    this.value = value ?? '';
    this.next = next ?? '';
    this.length = this.value.length + this.next.length;
  }
  toString(): string {
    return this.value + this.next;
  }
  static create(value: string, next?: string): Chunk | undefined {
    if (!value && !next) return undefined;
    return new Chunk(value, next);
  }
}

function read(rdr: Reader, chars: string[], until: boolean) {
  const cache: string[] = [];
  let result = '',
    next = '';
  let l: number | undefined;
  function predicate(chr: string) {
    l = chr.length;
    next = cache[l] || (cache[l] = rdr.peek(l));
    return next === chr;
  }

  while (!rdr.eof()) {
    cache.length = 0;
    if (until === chars.some(predicate)) {
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

export class Reader {
  public text: string;
  public position = -1;
  public length = 0;

  constructor(text: string) {
    this.text = String(text ?? '');
    this.position = -1;
    this.length = this.text.length;
  }

  eof(): boolean {
    return this.position >= this.length;
  }

  read(len = 1): string {
    const value = this.peek(len);
    this.position = Math.min(this.length, this.position + len);
    return value;
  }

  readAll(): string {
    if (this.position >= this.length) return '';
    const value = this.text.substr(this.position + 1);
    this.position = this.length;
    return value;
  }

  peek(len = 1): string {
    if (this.position + 1 >= this.length) return '';
    return this.text.substr(this.position + 1, len);
  }

  seek(offset = 0, pos?: Position): boolean {
    const next = (pos === Position.Begin ? -1 : pos === Position.End ? this.length : this.position) + (offset || 1);
    this.position = Math.max(0, Math.min(this.length, next));
    return this.position === this.length;
  }
}

export function readUntil(rdr: Reader, ...chars: string[]): Chunk | undefined {
  return read(rdr, chars, true);
}

export function readWhile(rdr: Reader, ...chars: string[]): Chunk | undefined {
  return read(rdr, chars, false);
}

export function readWhitespace(rdr: Reader): Chunk | undefined {
  return readWhile(rdr, '\r', '\n', '\t', ' ');
}

export function readQuoted(rdr: Reader, ...quote: string[]): string {
  let result = '',
    block: Chunk | undefined;
  do {
    block = readUntil(rdr, ...quote);
    if (!block) break;
    result += block.value + block.next;
    if (last(block.value) !== '\\') break;
  } while (block);
  return result;
}

export function readQuotedUntil(rdr: Reader, ...chars: string[]): Chunk | undefined {
  let result = '',
    block: Chunk | undefined;
  chars = ['"', "'", '@*'].concat(chars);

  while ((block = readUntil(rdr, ...chars))) {
    result += block.value;
    if (block.next === '"' || block.next === "'") {
      result += block.next + readQuoted(rdr, block.next);
    } else if (block.next === '@*') {
      readUntil(rdr, '*@');
    } else break;
  }

  return Chunk.create(result, block?.next);
}

export function readBlock(rdr: Reader, open: string, close: string, numOpen = 0): string {
  const blockChars = [open, close];
  let ret = '';
  let block;

  while ((block = readUntil(rdr, ...blockChars))) {
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
}

export function last(str = ''): string {
  return str.substr(str.length - 1);
}
