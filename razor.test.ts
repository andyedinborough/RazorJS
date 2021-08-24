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
  const equal = (a: unknown, b: unknown) => expect(a).toBe(b);
  const razor = new Razor();
  equal((await razor.render('@{ <a b=@0 c=@1> </a> }')).trim(), '<a b=0 c=1> </a>');
  equal((await razor.render('test\\test')).trim(), 'test\\test');
  equal((await razor.render('@if(true) { if(true){ <a @(0>1?0:1) /> } }')).trim(), '<a 1 />');
  equal((await razor.render('@if(true) { if(true){ <a @(0>1?0:1) /> <a> </a> } }')).trim(), '<a 1 /><a> </a>');
  equal(await razor.render('@{ model.items.forEach(function(x){ @x }); }', { items: [0] }), '0');
  equal(await razor.render('test'), 'test');
  equal(await razor.render('@@test'), '@test');
  equal(await razor.render('test@test.com'), 'test@test.com');
  equal(await razor.render('test@@@(model.test).com', { test: 'test' }), 'test@test.com');
  equal(await razor.render('hello @model.name', { name: 'world' }), 'hello world');
  equal(await razor.render('hello @model.name[0]', { name: 'world'.split('') }), 'hello w');
  equal(await razor.render("hello @model['name']", { name: 'world' }), 'hello world');
  equal(
    await razor.render('hello @model.name("world")', {
      name: function (n: unknown) {
        return n;
      },
    }),
    'hello world'
  );
  equal(await razor.render('te@*FAIL*@st'), 'test');
  equal(await razor.render('@if(model.name){ @model.name }', { name: 'test' }), 'test');
  equal(await razor.render('@if(!model.name){ @fail(); } else { @model.name; }', { name: 'test' }), 'test');
  equal((await razor.render('@if(true){ @:test }')).trim(), 'test');
  equal((await razor.render('@helper test(name){ @:Hi @name } @test("bob")')).trim(), 'Hi bob');
  equal((await razor.render('@if(true){ <div><div>nested</div></div>  }')).trim(), '<div><div>nested</div></div>');
  equal((await razor.render('@{  }')).trim(), '');
  equal((await razor.render('@switch(model.test){ case 0: <br/> break; }', { test: 0 })).trim(), '<br/>');
  equal((await razor.render('@if(true){ <text>hi</text> }')).trim(), 'hi');
  equal((await razor.render('@if(true){ if(false) { @:fail } else { @:win } }')).trim(), 'win');
  equal((await razor.render('@if(true){ if(false) { @:fail } else { <div>Hi!</div> if(false) { } <div>Hi!</div> } }')).trim(), '<div>Hi!</div><div>Hi!</div>');

  try {
    await razor.render('@(');
    await razor.render('@{');
  } catch {
    // yolo
  }

  equal((await razor.render('@model.forEach(function(x){ @x })', [0])).trim(), '0');
});

it('outputs html from codeblock, but continues code', async () =>
  expect(
    (
      await new Razor().render(`
@{ 
  <h1>hi</h1>
  var test = 'hi'; 
}<h2>@hi</h2>
`)
    ).trim()
  ).toBe('<h1>hi</h1>'));
