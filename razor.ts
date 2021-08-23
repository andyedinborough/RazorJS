import { Chunk, last, readBlock, Reader, readQuotedUntil, readUntil, readWhitespace } from './reader';
import { doubleEncode, HtmlHelper } from './HtmlHelper';
import { HtmlString } from './HtmlString';

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

const rxValid = /^(?:await\s+)?(?:new\s+)?[a-z0-9\._]+/i,
  rxTagName = /^[a-z]+(?:\:[a-z]+)?/i,
  rxFunction = /\s*function[\s*\(]/;

const NEWLINE = '\r\n';
const NEWLINETAB = `${NEWLINE}\t`;

enum CmdType {
  Code = 0,
  Output = 1,
  Literal = 2,
}

class Cmd {
  code: string = '';
  type: number = 0;
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

function functionTemplateBasic(dialect: RazorDialect) {
  const { html } = dialect;
  return `const writer = [];
function writeLiteral(a) { writer.push(a); }
function write(a){ writeLiteral(${html}.encode(a)); };
`;
}

function functionTemplate(code: string, dialect: RazorDialect) {
  const { model, viewBag, html, isSectionDefined, renderSection, renderBody, layout } = dialect;
  return `"use strict";
${functionTemplateBasic(dialect)}
const page = this, { 
  model: ${model}, viewBag: ${viewBag}, html: ${html}, 
  isSectionDefined: ${isSectionDefined}, renderSection: ${renderSection}, 
  renderBody: ${renderBody}, layout: _rzr_layout 
} = page;
let ${layout} = _rzr_layout;
${code}
if(_rzr_layout !== ${dialect.layout}) { this.layout = ${dialect.layout}; }
return writer.join("");`;
}

enum Mode {
  Text = 0,
  Code = 1,
}

interface ParseContext {
  helpers: string[];
  sections: string[];
  dialect: RazorDialect;
}

function parseImpl(template: string, level: number, mode: Mode, ctx: ParseContext): Cmd[] {
  const rdr = new Reader(template);
  const cmds: Cmd[] = [];
  let chunk: Chunk | undefined, peek: string, block: string | Chunk | undefined, bracket: number;

  function parseCodeBlock() {
    peek = rdr.peek();
    if (peek === '*') readUntil(rdr, '*@');
    else if (peek === '(') {
      block = readBlock(rdr, '(', ')');
      cmds.push(new Cmd(block.substr(1, block.length - 2), CmdType.Output));
    } else if (peek === '{') {
      block = readBlock(rdr, '{', '}');
      cmds.push(new Cmd(parseImpl(block.substr(1, block.length - 2), level + 1, Mode.Code, ctx).join(NEWLINE)));
    } else if (peek === ':' && mode === Mode.Code) {
      block = readUntil(rdr, '\n', '@', '}');
      while (block.next === '@' && rdr.peek() === '@') {
        const temp = readUntil(rdr, '\n', '@', '}');
        block.value += temp.value;
        block.next = temp.next;
      }
      rdr.seek(-1);
      block.value = block.value.substr(1);
      cmds.push(new Cmd(block.value, CmdType.Literal));
    } else if (
      (peek === 'i' && rdr.peek(2) === 'if') ||
      (peek === 'd' && rdr.peek(2) === 'do') ||
      (peek === 'f' && rdr.peek(3) === 'for') ||
      (peek === 'w' && rdr.peek(5) === 'while') ||
      (peek === 'h' && rdr.peek(6) === ctx.dialect.helper) ||
      (peek === 's' && rdr.peek(6) === 'switch') ||
      (peek === 's' && rdr.peek(7) === ctx.dialect.section)
    ) {
      block = readBlock(rdr, '{', '}');

      if (peek === 'i') {
        while (!rdr.eof()) {
          const whiteSpace = readWhitespace(rdr);
          if (!whiteSpace) break;
          else if (rdr.peek(4) !== 'else') {
            rdr.seek(-whiteSpace.length);
            break;
          }
          block += whiteSpace + readBlock(rdr, '{', '}');
        }
      }

      const parsed = parseImpl(block.substr(0, block.length - 1), level + 1, Mode.Code, ctx).join(NEWLINETAB);
      let paren = parsed.indexOf('(');
      bracket = parsed.indexOf('{');

      if (paren === -1 || bracket < paren) paren = bracket;
      if (peek === 'h')
        ctx.helpers.push(
          `function ${parsed.substring(7, bracket)} {${functionTemplateBasic(ctx.dialect)}${parsed.substr(bracket + 1)}${NEWLINE}return ${
            ctx.dialect.html
          }.raw(writer.join(""));${NEWLINE}}${NEWLINE}`
        );
      else if (peek === 's' && block.substr(0, 6) != 'switch')
        ctx.sections.push(
          `sections.${parsed.substr(8, paren - 8)} = function () {${functionTemplateBasic(ctx.dialect)}${parsed.substr(
            bracket + 1
          )}${NEWLINE}return writer.join("");${NEWLINE}}${NEWLINE}`
        );
      else cmds.push(new Cmd(parsed + '}'));
    } else if (peek && !rxValid.test(last(chunk.value))) {
      let remain: string, match: RegExpMatchArray;
      block = '';
      while (!rdr.eof()) {
        remain = rdr.text.substr(rdr.position + 1);
        match = remain.match(rxValid);
        if (!match) break;
        block += rdr.read(match[0].length);
        peek = rdr.peek();
        if (!peek) break;
        if (peek === '[' || peek === '(') {
          remain = readBlock(rdr, peek, peek === '[' ? ']' : ')');
          if (peek === '(' && rxFunction.test(remain)) {
            bracket = remain.indexOf('{');
            block += remain.substr(0, bracket);
            block += parseImpl(remain.substr(bracket), level + 1, Mode.Code, ctx).join(NEWLINETAB);
          } else {
            block += remain;
          }
          break;
        }
      }
      if (block) cmds.push(new Cmd(block, CmdType.Output));
    } else if (mode === Mode.Text) {
      if (chunk.next) cmds.push(new Cmd('@', CmdType.Literal));
    }
  }

  while (!rdr.eof()) {
    chunk = mode === Mode.Text ? readUntil(rdr, '@') : readQuotedUntil(rdr, '@', '<');
    if (!chunk) break;
    peek = rdr.peek();
    if (peek === '@' && chunk.next === '@') {
      rdr.read();
      cmds.push(new Cmd(chunk.value + peek, CmdType.Literal));
      continue;
    }

    while (true) {
      peek = rdr.peek();

      if (mode === Mode.Code && chunk.next === '<') {
        //the longest tagname is 8 chars, reading 30 out to cover it
        let tagWritten = false;
        const tagname = rdr.text.substr(rdr.position + 1, 30).match(rxTagName)?.[0] ?? '';
        if (tagname) {
          cmds.push(new Cmd(chunk.value, 0));
          while (!rdr.eof()) {
            chunk = readUntil(rdr, '@', '>');
            if (chunk.next == '@') {
              cmds.push(new Cmd((tagWritten ? '' : '<') + chunk.value, CmdType.Literal));
              tagWritten = true;
              parseCodeBlock();
            } else break;
          }
          block = chunk + '';
          if (last(chunk.value) !== '/') {
            let nestedCount = 1,
              nested: Chunk;
            while (nestedCount > 0) {
              nested = readQuotedUntil(rdr, '</' + tagname, '<' + tagname);
              block += nested;
              if (rdr.eof()) break;
              nestedCount += nested.next.substr(1, 1) === '/' ? -1 : 1;
            }
            block += readQuotedUntil(rdr, '>');
          }
          if (!tagWritten) {
            if (tagname === 'text') {
              block = block.substr(5, block.length - 5 - 7);
            } else block = '<' + block;
          }
          cmds.push(...parseImpl(block, level + 1, Mode.Text, ctx));
        } else {
          const chunk1 = readQuotedUntil(rdr, '@', '<');
          chunk.value += chunk.next + chunk1.value;
          chunk.next = chunk1.next;
          continue;
        }
      } else if (chunk.value) {
        if (mode === Mode.Text) cmds.push(new Cmd(chunk.value, CmdType.Literal));
        else cmds.push(new Cmd(chunk.value));
      }
      break;
    }

    parseCodeBlock();
  }

  return cmds;
}

export type View = (model?: object, page?: object) => Promise<string>;

const DEFAULT_DIALECT = {
  helper: 'helper',
  section: 'section',
  layout: 'layout',
  model: 'model',
  viewBag: 'viewBag',
  html: 'html',
  isSectionDefined: 'isSectionDefined',
  renderSection: 'renderSection',
  renderBody: 'renderBody',
};

type RazorDialect = typeof DEFAULT_DIALECT;

interface RazorOptions {
  findView?: (id: string) => Promise<string | undefined>;
  dialect?: Partial<RazorDialect>;
}

export class Razor {
  #templates = new Map<string, View>();
  #findView: ((id: string) => Promise<string | undefined>) | undefined;
  #dialect: RazorDialect;

  constructor(options?: RazorOptions) {
    this.#findView = options?.findView;
    this.#dialect = { ...DEFAULT_DIALECT, ...options?.dialect };
  }

  parse(template: string) {
    const ctx: ParseContext = { helpers: [], sections: [], dialect: this.#dialect };
    const cmds = parseImpl(template, 0, Mode.Text, ctx);
    return {
      code: cmds.join(NEWLINE),
      sections: ctx.sections,
      helpers: ctx.helpers,
    };
  }

  compile(code: string, page?: object): View {
    const parsed = this.parse(code);
    const functionCode = functionTemplate(parsed.helpers.join(NEWLINE) + NEWLINE + parsed.sections.join(NEWLINE) + parsed.code, this.#dialect);

    let func: Function;
    try {
      func = new AsyncFunction('sections', functionCode);
    } catch (x) {
      throw new Error(`Unable to compile: ${x}${NEWLINE}${NEWLINE}${functionCode}`);
    }

    return async (model: unknown, page1?: object) => {
      const ctx = { layout: '', viewBag: {}, html: new HtmlHelper(), ...page, ...page1, model },
        sections: Record<string, View> = {};

      let result: string = await func.apply(ctx, [sections]);

      if (ctx.layout) {
        const layoutView = await this.view(ctx.layout, page);
        const isSectionDefined = (name: string) => typeof sections[name] === 'function';
        result = await layoutView(undefined, {
          renderBody() {
            return new HtmlString(result);
          },
          viewBag: ctx.viewBag,
          isSectionDefined,
          renderSection(name: string, required?: boolean) {
            if (isSectionDefined(name)) {
              return new HtmlString(sections[name]());
            } else if (required) {
              throw `Section "${name}" not found.`;
            }
          },
        });
      }

      return result;
    };
  }

  async view(id: string, page?: object) {
    const key = '~/' + id;

    let template = this.#templates.get(key);
    if (!template) {
      const script = await this.#findView?.(id);
      template = this.compile(script, page);
      this.#templates.set(key, template);
    }

    return template;
  }

  async render(markup: string, model?: object, page?: object) {
    let template = this.#templates.get(markup);
    if (!template) {
      template = this.compile(markup);
      this.#templates.set(markup, template);
    }
    return await template(model, page);
  }
}
