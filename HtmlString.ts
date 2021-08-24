export class HtmlString {
  #value: unknown;

  get isHtmlString(): boolean {
    return true;
  }

  constructor(value: unknown) {
    this.#value = value;
  }
  toString(): string {
    return String(this.#value ?? '');
  }

  static isHtmlString(value: unknown): value is HtmlString {
    const html = value as HtmlString;
    return typeof html === 'object' && html.isHtmlString;
  }
}
