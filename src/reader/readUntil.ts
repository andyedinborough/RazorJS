import { read } from './read';
import { Chunk } from './Chunk';
import { Reader } from './Reader';

export function readUntil(rdr: Reader, ...chars: string[]): Chunk | undefined {
  return read(rdr, chars, true);
}
