import { Position } from './Position';

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
    const value = this.text.slice(this.position + 1);
    this.position = this.length;
    return value;
  }

  peek(len = 1): string {
    if (this.position + 1 >= this.length) return '';
    return this.text.slice(this.position + 1, this.position + 1 + len);
  }

  seek(offset = 0, pos?: Position): boolean {
    const next = (pos === Position.Begin ? -1 : pos === Position.End ? this.length : this.position) + (offset || 1);
    this.position = Math.max(0, Math.min(this.length, next));
    return this.position === this.length;
  }
}
