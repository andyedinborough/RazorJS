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

it('supports custom locals', async () => {
  const result = await new Razor({ locals: ['hi'] }).render(`@hi`, {}, { hi: 'hi' });
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

it('passes legacy tests', async () => {
  const equal = (a: unknown, b: unknown, because?: string) => expect(a).toBe(b);
  const razor = new Razor();
  equal((await razor.render('@{ <a b=@0 c=@1> </a> }')).trim(), '<a b=0 c=1> </a>', 'multiple code snippets in a tag opener inside a code block');
  equal((await razor.render('test\\test')).trim(), 'test\\test', '\\ needs to be double-encoded');
  equal((await razor.render('@if(true) { if(true){ <a @(0>1?0:1) /> } }')).trim(), '<a 1 />', 'ternary inside tag inside nested if');
  equal((await razor.render('@if(true) { if(true){ <a @(0>1?0:1) /> <a> </a> } }')).trim(), '<a 1 /><a> </a>', 'ternary inside tag inside nested if followed by another tag');
  equal(await razor.render('@{ model.items.forEach(function(x){ @x }); }', { items: [0] }), '0', 'forEach');
  equal(await razor.render('test'), 'test', 'no razor');
  equal(await razor.render('@@test'), '@test', 'escaped @');
  equal(await razor.render('test@test.com'), 'test@test.com', 'email address');
  equal(await razor.render('test@@@(model.test).com', { test: 'test' }), 'test@test.com', 'explicit code');
  equal(await razor.render('hello @model.name', { name: 'world' }), 'hello world', 'model');
  equal(await razor.render('hello @model.name[0]', { name: 'world'.split('') }), 'hello w', 'model w/ indexers');
  equal(await razor.render("hello @model['name']", { name: 'world' }), 'hello world', 'model w/ string indexers');
  equal(
    await razor.render('hello @model.name("world")', {
      name: function (n: unknown) {
        return n;
      },
    }),
    'hello world',
    'model w/ method'
  );
  equal(await razor.render('te@*FAIL*@st'), 'test', 'comment');
  equal(await razor.render('@if(model.name){ @model.name }', { name: 'test' }), 'test', 'if statement');
  equal(await razor.render('@if(!model.name){ @fail(); } else { @model.name; }', { name: 'test' }), 'test', 'if-else statement');
  equal((await razor.render('@if(true){ @:test }')).trim(), 'test', 'text-mode');
  equal((await razor.render('@helper test(name){ @:Hi @name } @test("bob")')).trim(), 'Hi bob', 'helper');
  equal((await razor.render('@if(true){ <div><div>nested</div></div>  }')).trim(), '<div><div>nested</div></div>', 'nested tags inside code');
  equal((await razor.render('@{  }')).trim(), '', 'javascript code block');
  equal((await razor.render('@switch(model.test){ case 0: <br/> break; }', { test: 0 })).trim(), '<br/>', 'switch');
  equal((await razor.render('@if(true){ <text>hi</text> }')).trim(), 'hi', 'using <text/>');
  equal((await razor.render('@if(true){ if(false) { @:fail } else { @:win } }')).trim(), 'win', 'nested if');
  equal((await razor.render('@if(true){ if(false) { @:fail } else { <div>Hi!</div> if(false) { } <div>Hi!</div> } }')).trim(), '<div>Hi!</div><div>Hi!</div>', 'nested if w/ html');

  try {
    await razor.render('@(');
    await razor.render('@{');
  } catch (x) {}

  equal((await razor.render('@model.forEach(function(x){ @x })', [0])).trim(), '0', 'rendering from inside an inlined-function');
});
