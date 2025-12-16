import { Chunk } from './Chunk';
import { Reader } from './Reader';
import { readQuoted } from './readQuoted';
import { readUntil } from './readUntil';

export function readQuotedUntil(rdr: Reader, ...chars: string[]): Chunk | undefined {
  const result: string[] = [];
  let block: Chunk | undefined;
  chars = ['"', "'", '@*'].concat(chars);

  while ((block = readUntil(rdr, ...chars))) {
    result.push(block.value);
    if (block.next === '"' || block.next === "'") {
      result.push(block.next, readQuoted(rdr, block.next));
    } else if (block.next === '@*') {
      readUntil(rdr, '*@');
    } else break;
  }

  return Chunk.create(result.join(''), block?.next);
}
