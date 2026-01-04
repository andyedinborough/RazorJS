import { Reader } from './Reader';
import { readUntil } from './readUntil';

export function readBlock(rdr: Reader, open: string, close: string, numOpen = 0): string {
  const blockChars = [open, close];
  const ret: string[] = [];
  let block;

  while ((block = readUntil(rdr, ...blockChars))) {
    ret.push(block.value);

    if (block.next === open) {
      numOpen++;
    } else if (block.next === close) {
      numOpen--;
    }

    if (numOpen === 0) {
      ret.push(block.next);
      return ret.join('');
    } else ret.push(block.next);
  }

  return ret.join('');
}
