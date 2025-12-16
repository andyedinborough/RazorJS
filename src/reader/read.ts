import { Chunk } from './Chunk';
import { Reader } from './Reader';

export function read(rdr: Reader, chars: string[], until: boolean) {
  const result: string[] = [];
  let next = '';
  let l: number | undefined;

  while (!rdr.eof()) {
    let matched = false;
    for (let i = 0; i < chars.length; i++) {
      const chr = chars[i];
      l = chr.length;
      next = rdr.peek(l);
      if (next === chr) {
        matched = true;
        break;
      }
    }

    if (until === matched) {
      if (until) {
        rdr.seek(l);
      } else {
        const resultStr = result.join('');
        next = resultStr.length > 0 ? resultStr[resultStr.length - 1] : '';
        result.pop();
      }
      return Chunk.create(result.join(''), next);
    }

    next = rdr.read();
    if (next) {
      result.push(next);
    } else break;
  }

  return Chunk.create(result.join(''), next);
}
