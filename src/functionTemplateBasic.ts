import { RazorDialect } from './RazorDialect';

export function functionTemplateBasic(dialect: RazorDialect) {
  const { html } = dialect;
  return `const writer = [];
function writeLiteral(a) { writer.push(a); }
function write(a){ writeLiteral(${html}.encode(a)); };
`;
}
