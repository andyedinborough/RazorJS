import 'jest';
import { Razor } from './razor';

it('can render without code blocks', async () => expect(await new Razor().render('hi')).toBe('hi'));
it('can render code blocks', async () =>
  expect(
    (
      await new Razor().render(`
@{ var test = 'bob';}
hi @test
`)
    ).trim()
  ).toBe('hi bob'));

it('can render <text>', async () =>
  expect(
    (
      await new Razor().render(`
@{ <text>hi bob</text> }
`)
    ).trim()
  ).toBe('hi bob'));

it('can render <text> in if', async () =>
  expect(
    (
      await new Razor().render(`
        @{ var test = 'bob';}
        hi @if(test === 'bob') { <text>bill</text> }
  `)
    ).trim()
  ).toBe('hi bill'));

it('can render if statements', async () =>
  expect(
    (
      await new Razor().render(`
@{ var test = 'bob';}
hi @if(test === 'bob') { @:bill }
`)
    ).trim()
  ).toBe('hi bill'));

it('can render helpers', async () =>
  expect(
    (
      await new Razor().render(`
  @helper name(x){ @:bill }
  hi @name('bill')
  `)
    ).trim()
  ).toBe('hi bill'));

it('renders layouts', async () => {
  const razor = new Razor({
    async findView(id) {
      switch (id) {
        case 'layout':
          return 'begin @renderBody() end';
      }
    },
  });

  const result = await razor.render('@{ layout = "layout"; } test');
  expect(result.replace(/\s+/g, ' ')).toBe('begin test end');
});

it('renders layouts with sections', async () => {
  const razor = new Razor({
    async findView(id) {
      switch (id) {
        case 'layout':
          return 'begin @renderBody() end @renderSection("afterEnd", false)';
      }
    },
  });

  const result = await razor.render('@{ layout = "layout"; } test @section afterEnd(){ @: after }');
  expect(result.replace(/\s+/g, ' ').trim()).toBe('begin test end after');
});

it('does not try to process emails', async () => expect(await new Razor().render('my email is test@test.com')).toBe('my email is test@test.com'));

it('encodes values', async () => {
  const result = await new Razor().render(`
    @{ var test = '<script>alert("fail")</script'; }
    @test
  `);
  expect(result).not.toContain('<script>');
});

it('does not encode raw values', async () => {
  const result = await new Razor().render(`
    @{ var test = '<script>alert("fail")</script'; }
    @html.raw(test)
  `);
  expect(result).toContain('<script>');
});

it('supports async', async () => {
  const result = await new Razor().render(`
    @(await new Promise(resolve => setTimeout(() => resolve('hi'), 10)))
  `);
  expect(result.trim()).toBe('hi');
});

it('supports async w/o parens', async () => {
  const result = await new Razor().render(`
    @await new Promise(resolve => setTimeout(() => resolve('hi'), 10))
  `);
  expect(result.trim()).toBe('hi');
});

it('can change dialect', async () => {
  const razor = new Razor({
    dialect: { layout: 'Layout', renderBody: 'RenderBody' },
    async findView(id) {
      switch (id) {
        case 'asdf':
          return 'begin @RenderBody() end';
      }
    },
  });

  const result = await razor.render('@{ Layout = "asdf"; } test');
  expect(result.replace(/\s+/g, ' ')).toBe('begin test end');
});
