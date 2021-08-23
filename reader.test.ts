import 'jest';
import { Reader } from './reader';

it('can read all', () => {
  const rdr = new Reader('test');
  expect(rdr.readAll()).toBe('test');
});

it('can read', () => {
  const rdr = new Reader('test');
  rdr.seek(2);
  expect(rdr.position).toBe(1);
  expect(rdr.read(2)).toBe('st');
  expect(rdr.position).toBe(3);
});

it('can peek', () => {
  const rdr = new Reader('test');
  expect(rdr.peek(2)).toBe('te');
  rdr.seek(2);
  expect(rdr.position).toBe(1);
  expect(rdr.peek(2)).toBe('st');
});

it('can read until eof', () => {
  const rdr = new Reader('test');
  let result = '';
  while (!rdr.eof()) {
    result += rdr.read();
  }
  expect(result).toBe('test');
});
