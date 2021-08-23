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

it('crender layouts', async () => {
  const razor = new Razor(async (id) => {
    switch (id) {
      case 'layout':
        return 'begin @renderBody() end';
    }
  });

  const result = await razor.render('@{ layout = "layout"; } test');
  expect(result.replace(/\s+/g, ' ')).toBe('begin test end');
});
