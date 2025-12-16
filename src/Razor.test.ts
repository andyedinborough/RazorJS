import { it, expect } from 'bun:test';
import { Razor } from './Razor';

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
  const razor = new Razor();
  expect((await razor.render('@{ <a b=@0 c=@1> </a> }')).trim()).toBe('<a b=0 c=1> </a>');
  expect((await razor.render('test\\test')).trim()).toBe('test\\test');
  expect((await razor.render('@if(true) { if(true){ <a @(0>1?0:1) /> } }')).trim()).toBe('<a 1 />');
  expect((await razor.render('@if(true) { if(true){ <a @(0>1?0:1) /> <a> </a> } }')).trim()).toBe('<a 1 /><a> </a>');
  expect(await razor.render('@{ model.items.forEach(function(x){ @x }); }', { items: [0] })).toBe('0');
  expect(await razor.render('test')).toBe('test');
  expect(await razor.render('@@test')).toBe('@test');
  expect(await razor.render('test@test.com')).toBe('test@test.com');
  expect(await razor.render('test@@@(model.test).com', { test: 'test' })).toBe('test@test.com');
  expect(await razor.render('hello @model.name', { name: 'world' })).toBe('hello world');
  expect(await razor.render('hello @model.name[0]', { name: 'world'.split('') })).toBe('hello w');
  expect(await razor.render("hello @model['name']", { name: 'world' })).toBe('hello world');
  expect(
    await razor.render('hello @model.name("world")', {
      name: function (n: unknown) {
        return n;
      },
    })
  ).toBe('hello world');
  expect(await razor.render('te@*FAIL*@st')).toBe('test');
  expect(await razor.render('@if(model.name){ @model.name }', { name: 'test' })).toBe('test');
  expect(await razor.render('@if(!model.name){ @fail(); } else { @model.name; }', { name: 'test' })).toBe('test');
  expect((await razor.render('@if(true){ @:test }')).trim()).toBe('test');
  expect((await razor.render('@helper test(name){ @:Hi @name } @test("bob")')).trim()).toBe('Hi bob');
  expect((await razor.render('@if(true){ <div><div>nested</div></div>  }')).trim()).toBe('<div><div>nested</div></div>');
  expect((await razor.render('@{  }')).trim()).toBe('');
  expect((await razor.render('@switch(model.test){ case 0: <br/> break; }', { test: 0 })).trim()).toBe('<br/>');
  expect((await razor.render('@if(true){ <text>hi</text> }')).trim()).toBe('hi');
  expect((await razor.render('@if(true){ if(false) { @:fail } else { @:win } }')).trim()).toBe('win');
  expect((await razor.render('@if(true){ if(false) { @:fail } else { <div>Hi!</div> if(false) { } <div>Hi!</div> } }')).trim()).toBe('<div>Hi!</div><div>Hi!</div>');

  try {
    await razor.render('@(');
    await razor.render('@{');
  } catch {
    // yolo
  }

  expect((await razor.render('@model.forEach(function(x){ @x })', [0])).trim()).toBe('0');
});

it('outputs html from codeblock, but continues code', async () =>
  expect(
    (
      await new Razor().render(`
@{ 
  // incomplete quote in text
  <p>test's</p>
  var asdfdddf = 'rock'; 
  <p>@asdfdddf</p>
}
`)
    )
      .trim()
      .replace(/[\r\n\s\t]/g, '')
  ).toBe(`<p>test's</p><p>rock</p>`));

it('supports @functions { }', async () => {
  expect(await (await new Razor().render(`@functions { function sayHi(){ @:hi } }\n@sayHi()`)).trim()).toBe('hi');
});
