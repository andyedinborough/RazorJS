export function doubleEncode(txt: string) {
  return txt.split('\\').join('\\\\').split('\r').join('\\r').split('\n').join('\\n').split('"').join('\\"');
}

export class HtmlString {
  #value: unknown;
  constructor(value: unknown) {
    this.#value = value;
  }
  toString() {
    return this.#value;
  }
}

export class HtmlHelper {
  encode(value: HtmlString | string | undefined) {
    if (value === null || value === undefined) value = '';
    if (typeof value === 'object' && 'isHtmlString' in value) return value;
    if (typeof value !== 'string') value = String(value);
    value = value.split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;').split('"').join('&quot;');
    return new HtmlString(value);
  }
  attributeEncode(value: HtmlString | string | undefined) {
    return this.encode(value);
  }
  raw(value: unknown) {
    return new HtmlString(value);
  }
}
