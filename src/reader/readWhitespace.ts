import { Chunk } from './Chunk';
import { Reader } from './Reader';
import { readWhile } from './readWhile';

export function readWhitespace(rdr: Reader): Chunk | undefined {
  return readWhile(rdr, '\r', '\n', '\t', ' ');
}
