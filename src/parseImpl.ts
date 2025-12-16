import { Mode, ParseContext, NEWLINE, NEWLINETAB, rxValid, rxFunction, rxTagName } from './Razor';
import { functionTemplateBasic } from './functionTemplateBasic';
import { Cmd, CmdType } from './Cmd';
import { Chunk } from './reader/Chunk';
import { last } from './reader/last';
import { readBlock } from './reader/readBlock';
import { Reader } from './reader/Reader';
import { readQuotedUntil } from './reader/readQuotedUntil';
import { readUntil } from './reader/readUntil';
import { readWhitespace } from './reader/readWhitespace';

export function parseImpl(template: string, level: number, mode: Mode, ctx: ParseContext): Cmd[] {
  const rdr = new Reader(template);
  const cmds: Cmd[] = [];
  let chunk: Chunk | undefined, peek: string, block: string | Chunk | undefined, bracket: number;

  function parseCodeBlock() {
    peek = rdr.peek();
    if (peek === '*') readUntil(rdr, '*@');
    else if (peek === '(') {
      block = readBlock(rdr, '(', ')');
      cmds.push(new Cmd(block.slice(1, -1), CmdType.Output));
    } else if (peek === '{') {
      block = readBlock(rdr, '{', '}');
      cmds.push(new Cmd(parseImpl(block.slice(1, -1), level + 1, Mode.Code, ctx).join(NEWLINE)));
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
        block.value = block.value.slice(1);
        cmds.push(new Cmd(block.value, CmdType.Literal));
      }
    } else if (
      (peek === 'i' && rdr.peek(2) === 'if') ||
      (peek === 'd' && rdr.peek(2) === 'do') ||
      (peek === 'f' && rdr.peek(3) === 'for') ||
      (peek === 'f' && rdr.peek(9) === 'functions') ||
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

      const parsed = parseImpl(block.slice(0, -1), level + 1, Mode.Code, ctx).join(NEWLINETAB);
      let paren = parsed.indexOf('(');
      bracket = parsed.indexOf('{');

      if (paren === -1 || bracket < paren) paren = bracket;
      if (peek === 'h')
        ctx.helpers.push(
          `function ${parsed.substring(7, bracket).trim()} {${functionTemplateBasic(ctx.dialect)}${parsed.slice(bracket + 1)}${NEWLINE}return ${
            ctx.dialect.html
          }.raw(writer.join(""));${NEWLINE}}${NEWLINE}`
        );
      else if (peek === 's' && block.slice(0, 6) !== 'switch')
        ctx.sections.push(
          `sections.${parsed.slice(8, paren).trim()} = function () {${functionTemplateBasic(ctx.dialect)}${parsed.slice(
            bracket + 1
          )}${NEWLINE}return writer.join("");${NEWLINE}}${NEWLINE}`
        );
      else if (peek === 'f' && block.slice(0, 9) === 'functions') cmds.push(new Cmd(parsed.slice(parsed.indexOf('{') + 1)));
      else cmds.push(new Cmd(parsed + '}'));
    } else if (peek && chunk && !rxValid.test(last(chunk.value))) {
      let remain: string, match: RegExpMatchArray | null;
      block = '';
      while (!rdr.eof()) {
        remain = rdr.text.slice(rdr.position + 1);
        match = remain.match(rxValid);
        if (!match) break;
        block += rdr.read(match[0].length);
        peek = rdr.peek();
        if (!peek) break;
        if (peek === '[' || peek === '(') {
          remain = readBlock(rdr, peek, peek === '[' ? ']' : ')');
          if (peek === '(' && rxFunction.test(remain)) {
            bracket = remain.indexOf('{');
            block += remain.slice(0, bracket);
            block += parseImpl(remain.slice(bracket), level + 1, Mode.Code, ctx).join(NEWLINETAB);
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
        const tagname = rdr.text.slice(rdr.position + 1, rdr.position + 31).match(rxTagName)?.[0] ?? '';
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
                nestedCount += nested.next[1] === '/' ? -1 : 1;
              }
            }
            block += readQuotedUntil(rdr, '>');
          }
          if (!tagWritten) {
            if (tagname === 'text') {
              block = block.slice(5, -7);
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
