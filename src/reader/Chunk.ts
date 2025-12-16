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
