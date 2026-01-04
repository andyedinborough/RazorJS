import { functionTemplateBasic } from './functionTemplateBasic';
import { HtmlHelper } from './HtmlHelper';
import { HtmlString } from './HtmlString';
import { parseImpl } from './parseImpl';
import { RazorDialect, DEFAULT_DIALECT } from './RazorDialect';
import { View } from './View';

const html = new HtmlHelper();

export const rxValid = /^(?:await\s+)?(?:new\s+)?[a-z0-9._]+/i,
  rxTagName = /^[a-z]+(?::[a-z]+)?/i,
  rxFunction = /\s*function[\s*(]/;

export const NEWLINE = '\r\n';
export const NEWLINETAB = `${NEWLINE}\t`;

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

export enum Mode {
  Text = 0,
  Code = 1,
}

export interface ParseContext {
  helpers: string[];
  sections: string[];
  dialect: RazorDialect;
  options: RazorOptions;
}

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
