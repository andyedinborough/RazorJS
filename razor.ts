import { Chunk, last, readBlock, Reader, readQuotedUntil, readUntil, readWhitespace } from './reader';
import { doubleEncode, HtmlHelper } from './HtmlHelper';
import { HtmlString } from './HtmlString';

const html = new HtmlHelper();

const rxValid = /^(?:await\s+)?(?:new\s+)?[a-z0-9._]+/i,
  rxTagName = /^[a-z]+(?::[a-z]+)?/i,
  rxFunction = /\s*function[\s*(]/;

const NEWLINE = '\r\n';
const NEWLINETAB = `${NEWLINE}\t`;

enum CmdType {
  Code = 0,
  Output = 1,
  Literal = 2,
}

class Cmd {
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

function functionTemplateBasic(dialect: RazorDialect) {
  const { html } = dialect;
  return `const writer = [];
function writeLiteral(a) { writer.push(a); }
function write(a){ writeLiteral(${html}.encode(a)); };
`;
}

function functionTemplate(id: string | undefined, code: string, dialect: RazorDialect, locals: string[]) {
  const { model, viewBag, html, isSectionDefined, renderSection, renderBody, layout } = dialect;
  return `return async function ${id?.replace(/\W+/g, '_') ?? 'template'}(page, sections) {
"use strict";
const { 
  model: ${model}, viewBag: ${viewBag}, html: ${html}, 
  isSectionDefined: ${isSectionDefined}, renderSection: ${renderSection}, 
  renderBody: ${renderBody}, layout: _rzr_layout 
} = page;
${locals.length ? `const { ${locals.join(', ')} } = page;` : ''}
${functionTemplateBasic(dialect)}
let ${layout} = _rzr_layout;
${code}
if(_rzr_layout !== ${dialect.layout}) { page.layout = ${dialect.layout}; }
return writer.join("");
}`;
}

enum Mode {
  Text = 0,
  Code = 1,
}

interface ParseContext {
  helpers: string[];
  sections: string[];
  dialect: RazorDialect;
  options: RazorOptions;
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
      block = readUntil(rdr, '\r', '\n', '@', '}');
      while (block?.next === '@' && rdr.peek() === '@') {
        const temp = readUntil(rdr, '\r', '\n', '@', '}');
        if (temp) {
          block.value += temp.value;
          block.next = temp.next;
        }
      }
      rdr.seek(-1);
      if (block) {
        block.value = block.value.substr(1);
        cmds.push(new Cmd(block.value, CmdType.Literal));
      }
    } else if (
      (peek === 'i' && rdr.peek(2) === 'if') ||
      (peek === 'd' && rdr.peek(2) === 'do') ||
      (peek === 'f' && rdr.peek(3) === 'for') ||
      (peek === 'w' && rdr.peek(5) === 'while') ||
      (peek === 'h' && rdr.peek(6) === ctx.dialect.helper) ||
      (peek === 's' && rdr.peek(6) === 'switch') ||
      (peek === 's' && rdr.peek(7) === ctx.dialect.section)
    ) {
      //TODO: trim whitespace before the {
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
          `function ${parsed.substring(7, bracket).trim()} {${functionTemplateBasic(ctx.dialect)}${parsed.substr(bracket + 1)}${NEWLINE}return ${
            ctx.dialect.html
          }.raw(writer.join(""));${NEWLINE}}${NEWLINE}`
        );
      else if (peek === 's' && block.substr(0, 6) !== 'switch')
        ctx.sections.push(
          `sections.${parsed.substr(8, paren - 8).trim()} = function () {${functionTemplateBasic(ctx.dialect)}${parsed.substr(
            bracket + 1
          )}${NEWLINE}return writer.join("");${NEWLINE}}${NEWLINE}`
        );
      else cmds.push(new Cmd(parsed + '}'));
    } else if (peek && chunk && !rxValid.test(last(chunk.value))) {
      let remain: string, match: RegExpMatchArray | null;
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
      if (chunk?.next) cmds.push(new Cmd('@', CmdType.Literal));
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

    do {
      peek = rdr.peek();

      if (mode === Mode.Code && chunk.next === '<') {
        //the longest tagname is 8 chars, reading 30 out to cover it
        let tagWritten = false;
        const tagname = rdr.text.substr(rdr.position + 1, 30).match(rxTagName)?.[0] ?? '';
        if (tagname) {
          cmds.push(new Cmd(chunk.value, 0));
          while (!rdr.eof()) {
            chunk = readUntil(rdr, '@', '>');
            if (chunk?.next === '@') {
              cmds.push(new Cmd((tagWritten ? '' : '<') + chunk.value, CmdType.Literal));
              tagWritten = true;
              parseCodeBlock();
            } else break;
          }
          block = chunk + '';
          if (last(chunk?.value) !== '/') {
            let nestedCount = 1,
              nested: Chunk | undefined;
            while (nestedCount > 0) {
              nested = readUntil(rdr, '</' + tagname, '<' + tagname);
              block += nested;
              if (rdr.eof()) break;
              if (nested) {
                nestedCount += nested.next.substr(1, 1) === '/' ? -1 : 1;
              }
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
          if (chunk1) {
            chunk.value += chunk.next + chunk1.value;
            chunk.next = chunk1.next;
          }
          continue;
        }
      } else if (chunk.value) {
        if (mode === Mode.Text) cmds.push(new Cmd(chunk.value, CmdType.Literal));
        else cmds.push(new Cmd(chunk.value));
      }
      break;
    } while (chunk.value || chunk.next);

    parseCodeBlock();
  }

  if (ctx.options.processCommand) {
    const proc = ctx.options.processCommand;
    return cmds.map((x) => (x.type === CmdType.Code ? new Cmd(proc(x.code), CmdType.Code) : x));
  }
  return cmds;
}

export type View = (model?: unknown, page?: Record<string, unknown>) => Promise<string>;

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
  locals?: string[];
  processCommand?: (cmd: string) => string;
  viewCompiled?: (code: string) => string;
  log?: (msg: string) => void;
}

export class Razor {
  #templates = new Map<string, View>();
  #dialect: RazorDialect;
  #locals: string[];
  #options: RazorOptions;

  constructor(options?: RazorOptions) {
    this.#options = options ?? {};
    this.#dialect = { ...DEFAULT_DIALECT, ...options?.dialect };
    this.#locals = (options?.locals ?? []).filter(Boolean);
  }

  parse(template: string): { code: string; sections: string[]; helpers: string[] } {
    const ctx: ParseContext = { helpers: [], sections: [], dialect: this.#dialect, options: this.#options };
    const cmds = parseImpl(template, 0, Mode.Text, ctx);
    return {
      code: cmds.join(NEWLINE),
      sections: ctx.sections,
      helpers: ctx.helpers,
    };
  }

  compile(code: string, page?: Record<string, unknown>, id?: string): View {
    const parsed = this.parse(code);
    let functionCode = functionTemplate(id, parsed.helpers.join(NEWLINE) + NEWLINE + parsed.sections.join(NEWLINE) + parsed.code, this.#dialect, this.#locals);
    functionCode = this.#options.viewCompiled?.(functionCode) ?? functionCode;

    let func: (page: Record<string, unknown>, sections: Record<string, View>) => Promise<string>;
    try {
      func = new Function('page', 'sections', functionCode)();
    } catch (x) {
      throw new Error(`Unable to compile: ${x}${NEWLINE}${NEWLINE}${functionCode}`);
    }

    return async (model: unknown, page1?: Record<string, unknown>) => {
      const ctx = { layout: '', viewBag: {}, [this.#dialect.html]: html, ...page, ...page1, model },
        sections: Record<string, View> = {};

      let result: string;

      try {
        result = await func(ctx, sections);
      } catch (x) {
        throw new Error(`Unable to execute template: ${x}${NEWLINE}${NEWLINE}${functionCode}`);
      }

      if (ctx.layout) {
        const layoutView = await this.view(ctx.layout);
        if (!layoutView) {
          throw new Error(`Layout ${ctx.layout} not found`);
        }
        const isSectionDefined = (name: string) => typeof sections[name] === 'function';
        result = await layoutView(undefined, {
          ...page1,
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

  async view(id: string, page?: Record<string, unknown>): Promise<View | undefined> {
    const key = '~/' + id;

    let template = this.#templates.get(key);
    if (!template) {
      const script = await this.#options.findView?.(id);
      if (script === undefined) {
        return undefined;
      }
      template = this.compile(script, page, id);
      this.#templates.set(key, template);
    }

    return template;
  }

  async render(markup: string, model?: unknown, page?: Record<string, unknown>): Promise<string> {
    let template = this.#templates.get(markup);
    if (!template) {
      template = this.compile(markup);
      this.#templates.set(markup, template);
    }
    return await template(model, page);
  }
}
