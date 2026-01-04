import { doubleEncode } from './HtmlHelper';

export enum CmdType {
  Code = 0,
  Output = 1,
  Literal = 2,
}

export class Cmd {
  code = '';
  type = 0;
  constructor(code: string, type = CmdType.Code) {
    this.code = code;
    this.type = type;
  }
  toString() {
    const { type, code } = this;
    switch (type) {
      case CmdType.Code:
        return code;
      case CmdType.Literal:
        return `writeLiteral("${doubleEncode(code)}");`;
      default:
        return `write(${code});`;
    }
  }
}
