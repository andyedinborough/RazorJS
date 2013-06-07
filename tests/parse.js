var Razor = require('../bin/node/razor.js');

exports.parse = function(test){
	var equal = test.equal, ok = test.ok;
	
	equal(Razor.compile('@{ <a b=@0 c=@1> </a> }')().trim(), '<a b=0 c=1> </a>', 'multiple code snippets in a tag opener inside a code block');
	equal(Razor.compile('test\\test')().trim(), 'test\\test', '\\ needs to be double-encoded');

	equal(Razor.compile('@if(true) { if(true){ <a @(0>1?0:1) /> } }')().trim(), '<a 1 />', 'ternary inside tag inside nested if');
	equal(Razor.compile('@if(true) { if(true){ <a @(0>1?0:1) /> <a> </a> } }')().trim(), '<a 1 /><a> </a>', 'ternary inside tag inside nested if followed by another tag');

	equal(Razor.compile('@{ model.items.forEach(function(x){ @x }); }')({ items: [0] }), '0', 'forEach');
	equal(Razor.compile('test')(), 'test', 'no razor');
	equal(Razor.compile('test@test.com')(), 'test@test.com', 'email address');
	equal(Razor.compile('test@@@(model.test).com')({ test: 'test' }), 'test@test.com', 'explicit code');
	equal(Razor.compile('hello @model.name')({ name: 'world' }), 'hello world', 'model');
	equal(Razor.compile('hello @model.name[0]')({ name: 'world'.split('') }), 'hello w', 'model w/ indexers');
	equal(Razor.compile('hello @model[\'name\']')({ name: 'world' }), 'hello world', 'model w/ string indexers');
	equal(Razor.compile('hello @model.name("world")')({ name: function (n) { return n; } }), 'hello world', 'model w/ method');
	equal(Razor.compile('te@*FAIL*@st')(), 'test', 'comment');
	equal(Razor.compile('@if(model.name){ @model.name }')({ name: 'test' }), 'test', 'if statement');
	equal(Razor.compile('@if(!model.name){ @fail(); } else { @model.name; }')({ name: 'test' }), 'test', 'if-else statement');
	equal(Razor.compile('@if(true){ @:test }')().trim(), 'test', 'text-mode');
	equal(Razor.compile('@helper test(name){ @:Hi @name } @test("bob")')().trim(), 'Hi bob', 'helper');
	equal(Razor.compile('@if(true){ <div><div>nested</div></div>  }')().trim(), '<div><div>nested</div></div>', 'nested tags inside code');
	equal(Razor.compile('@{  }')().trim(), '', 'javascript code block');
	equal(Razor.compile('@if(true){ <text>hi</text> }')().trim(), 'hi', 'using <text/>');
	equal(Razor.compile('@if(true){ if(false) { @:fail } else { @:win } }')().trim(), 'win', 'nested if');
	equal(Razor.compile('@if(true){ if(false) { @:fail } else { <div>Hi!</div> if(false) { } <div>Hi!</div> } }')().trim(), '<div>Hi!</div><div>Hi!</div>', 'nested if w/ html');

	try {
		Razor.compile('@(');
		Razor.compile('@{');
	} catch (x) { }
	ok(true, 'Didn\'t crash');
	
	equal(Razor.compile('@model.forEach(function(x){ @x })')([0]).trim(), '0', 'rendering from inside an inlined-function');
	
	test.done();
};