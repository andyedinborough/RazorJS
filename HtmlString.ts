export class HtmlString {
  #value: unknown;

  get isHtmlString() {
    return true;
  }

  constructor(value: unknown) {
    this.#value = value;
  }
  toString() {
    return this.#value;
  }

  static isHtmlString(value: unknown): value is HtmlString {
    const html = value as HtmlString;
    return typeof html === 'object' && html.isHtmlString;
  }
}
