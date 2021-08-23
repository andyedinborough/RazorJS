import { last, readBlock, Reader, readQuotedUntil, readUntil, readWhitespace } from './reader';
import { doubleEncode, HtmlHelper, HtmlString } from './util';

const rxValid = /^[a-z0-9\._]+/i,
  rxTagName = /^[a-z]+(?:\:[a-z]+)?/i;

class Cmd {
  code: string = '';
  type: number = 0;
  constructor(code: string, type = 0) {
    this.code = code;
    this.type = type;
  }
  toString() {
    const code = this.code;
    if (this.type === 0) return code;
    if (this.type === 2) return 'writeLiteral("' + doubleEncode(code) + '");';
    return 'write(' + code + ');';
  }
}

const _function_template_basic = 'var writer = [], writeLiteral = function(a) { writer.push(a); }, write = function(a){ writeLiteral(html.encode(a)); };\n';
const _function_template =
  _function_template_basic +
  'var page = this, model = page.model, viewBag = this.viewBag, html = this.html,\n' +
  '	isSectionDefined = this.isSectionDefined,\n' +
  '	renderSection = this.renderSection,\n' +
  '	renderBody = this.renderBody,\n' +
  '	_layout = this.layout, layout;\n' +
  '@code\nif(_layout !== layout) { this.layout = layout; }\nreturn writer.join("");\n';

interface RazorPage {
  join(separator: string): string;
  code: string;
  sections: View[];
  helpers: View[];
}

function parseImpl(template: string, level: number, mode: number, helpers: string[], sections: string[]): Cmd[] {
  const rdr = new Reader(template);
  const cmds: Cmd[] = [];
  let chunk, peek, block, bracket;

  function parseCodeBlock() {
    peek = rdr.peek();
    if (peek === '*') readUntil(rdr, '*@');
    else if (peek === '(') {
      block = readBlock(rdr, '(', ')');
      cmds.push(new Cmd(block.substr(1, block.length - 2), 1));
    } else if (peek === '{') {
      block = readBlock(rdr, '{', '}');
      cmds.push(new Cmd(parseImpl(block.substr(1, block.length - 2), level + 1, 1, helpers, sections).join('\n')));
    } else if (peek === ':' && mode === 1) {
      block = readUntil(rdr, '\n', '@', '}');
      while (block.next === '@' && rdr.peek() === '@') {
        var temp = readUntil(rdr, '\n', '@', '}');
        block.value += temp.value;
        block.next = temp.next;
      }
      rdr.seek(-1);
      block.value = block.value.substr(1);
      cmds.push(new Cmd(block.value, 2));
    } else if (
      (peek === 'i' && rdr.peek(2) === 'if') ||
      (peek === 'd' && rdr.peek(2) === 'do') ||
      (peek === 'f' && rdr.peek(3) === 'for') ||
      (peek === 'w' && rdr.peek(5) === 'while') ||
      (peek === 'h' && rdr.peek(6) === 'helper') ||
      (peek === 's' && rdr.peek(6) === 'switch') ||
      (peek === 's' && rdr.peek(7) === 'section')
    ) {
      block = readBlock(rdr, '{', '}');

      if (peek === 'i') {
        while (!rdr.eof()) {
          var whiteSpace = readWhitespace(rdr);
          if (!whiteSpace) break;
          else if (rdr.peek(4) !== 'else') {
            rdr.seek(-whiteSpace.length);
            break;
          }
          block += whiteSpace + readBlock(rdr, '{', '}');
        }
      }

      const parsed = parseImpl(block.substr(0, block.length - 1), level + 1, 1, helpers, sections).join('\r\n\t');
      let paren = parsed.indexOf('(');
      bracket = parsed.indexOf('{');

      if (paren === -1 || bracket < paren) paren = bracket;
      if (peek === 'h')
        helpers.push('function ' + parsed.substring(7, bracket) + '{' + _function_template_basic + parsed.substr(bracket + 1) + '\nreturn html.raw(writer.join(""));\n}\n');
      else if (peek === 's' && block.substr(0, 6) != 'switch')
        sections.push('sections.' + parsed.substr(8, paren - 8) + ' = function () {' + _function_template_basic + parsed.substr(bracket + 1) + '\nreturn writer.join("");\n}\n');
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
          if (peek === '(' && /\s*function[\s*\(]/.test(remain)) {
            bracket = remain.indexOf('{');
            block += remain.substr(0, bracket);
            block += parseImpl(remain.substr(bracket), level + 1, 1, helpers, sections).join('\r\n\t');
          } else {
            block += remain;
          }
          break;
        }
      }
      if (block) cmds.push(new Cmd(block, 1));
    } else if (mode === 0) {
      if (chunk.next) cmds.push(new Cmd('@', 2));
    }
  }

  while (!rdr.eof()) {
    chunk = mode === 0 ? readUntil(rdr, '@') : readQuotedUntil(rdr, '@', '<');
    if (!chunk) break;
    peek = rdr.peek();
    if (peek === '@' && chunk.next === '@') {
      rdr.read();
      cmds.push(new Cmd(chunk.value + peek, 2));
      continue;
    }

    while (true) {
      peek = rdr.peek();

      if (mode === 1 && chunk.next === '<') {
        //the longest tagname is 8 chars, reading 30 out to cover it
        var tag_written = false,
          tagname = (rdr.text.substr(rdr.position + 1, 30).match(rxTagName) || 0)[0] || '';
        if (tagname) {
          cmds.push(new Cmd(chunk.value, 0));
          while (!rdr.eof()) {
            chunk = readUntil(rdr, '@', '>');
            if (chunk.next == '@') {
              cmds.push(new Cmd((tag_written ? '' : '<') + chunk.value, 2));
              tag_written = true;
              parseCodeBlock();
            } else break;
          }
          block = chunk + '';
          if (last(chunk.value) !== '/') {
            var nested_count = 1,
              nested;
            while (nested_count > 0) {
              nested = readQuotedUntil(rdr, '</' + tagname, '<' + tagname);
              block += nested;
              if (rdr.eof()) break;
              nested_count += nested.next.substr(1, 1) === '/' ? -1 : 1;
            }
            block += readQuotedUntil(rdr, '>');
          }
          if (!tag_written) {
            if (tagname === 'text') {
              block = block.substr(5, block.length - 5 - 7);
            } else block = '<' + block;
          }
          cmds.push(...parseImpl(block, level + 1, 0, helpers, sections));
        } else {
          const chunk1 = readQuotedUntil(rdr, '@', '<');
          chunk.value += chunk.next + chunk1.value;
          chunk.next = chunk1.next;
          continue;
        }
      } else if (chunk.value) {
        if (mode === 0) cmds.push(new Cmd(chunk.value, 2));
        else cmds.push(chunk.value);
      }
      break;
    }

    parseCodeBlock();
  }

  return cmds;
}

type View = (model?: object, page?: object) => Promise<string>;

export class Razor {
  #templates = new Map<string, View>();
  #findView: ((id: string) => Promise<string | undefined>) | undefined;

  constructor(findView?: (id: string) => Promise<string | undefined>) {
    this.#findView = findView;
  }

  parse(template: string) {
    const helpers: string[] = [];
    const sections: string[] = [];
    const cmds = parseImpl(template, 0, 0, helpers, sections);
    return {
      code: cmds.join('\r\n'),
      sections: sections,
      helpers: helpers,
    };
  }

  compile(code: string, page?: object): View {
    const parsed = this.parse(code);
    const functionCode = '"use strict";\r\n' + _function_template.replace('@code', parsed.helpers.join('\r\n') + '\r\n' + parsed.sections.join('\r\n') + parsed.code);

    const func = new Function('sections', 'html', functionCode);

    return async (model, page1?: object) => {
      const ctx = { layout: '', viewBag: {}, html: new HtmlHelper(), ...page, ...page1, model },
        sections: Record<string, View> = {};

      let result: string = func.apply(ctx, [sections, ctx.html]);

      if (ctx.layout) {
        const layout_view = await this.view(ctx.layout, page);
        result = await layout_view(undefined, {
          renderBody() {
            return new HtmlString(result);
          },
          viewBag: ctx.viewBag,
          isSectionDefined(name: string) {
            return typeof sections[name] === 'function';
          },
          renderSection(name: string, required?: boolean) {
            if (this.isSectionDefined(name)) {
              var temp = new HtmlString(sections[name]());
              return temp;
            } else if (required) {
              throw 'Section "' + name + '" not found.';
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

  render(markup: string, model?: object, page?: object) {
    return this.compile(markup)(model, page);
  }
}
