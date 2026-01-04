import { Chunk } from './Chunk';
import { Reader } from './Reader';
import { last } from './last';
import { readUntil } from './readUntil';

export function readQuoted(rdr: Reader, ...quote: string[]): string {
  const result: string[] = [];
  let block: Chunk | undefined;
  do {
    block = readUntil(rdr, ...quote);
    if (!block) break;
    result.push(block.value, block.next);
    if (last(block.value) !== '\\') break;
  } while (block);
  return result.join('');
}
