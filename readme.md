RazorJS
=======

A JavaScript implementation of the Razor view engine that aims to be simple and compatible for use both in the 
browser and in Node--simple enough for templating:

    Razor.compile('hello @model.name')({ name: 'world' }) == 'hello world'

As well as a Node view-engine:

    var http = require('http'), 
      url = require('url'),
      Razor = require('../bin/node/Razor.js');

    http.createServer(function (req, res) {
      var uri = url.parse(req.url),
        path = uri.pathname.substr(1) || 'index';

      Razor.view(path, function(template) {
        if(template) {
          template({ name: 'Andy Edinborough' }, function(html){
            res.writeHead(200, {'Content-Type': 'text/html'});
            res.end(html); 
          });
        } 

        else {
            res.writeHead(404, {'Content-Type': 'text/html'});
            res.end('<h1>Not Found</h1>');            
        }
      });

    }).listen(1337, "127.0.0.1");

Live Demo
---------    
Try RazorJS in your browser now: http://jsbin.com/imihov/latest

Syntax
------

<table>
  <tbody>
      <tr>
          <th valign="top">Description</th>
          <th valign="top">Code</th>
          <th valign="top">Notes</th>
      </tr>

      <tr>
          <td valign="top">Code Block</td>
          <td valign="top">
              <pre>
@{ 
	int x = 123; 
	string y = "because.";
}
</pre>
          </td>
          <td> </td>
      </tr>

      <tr>
          <td valign="top">Expression (Html Encoded)</td>
          <td valign="top">
              <pre>
&lt;span&gt;@model.message&lt;/span&gt;
</pre>
          </td>
          <td> </td>
      </tr>

      <tr>
          <td valign="top">Expression (Unencoded)</td>

          <td valign="top">
              <pre>
&lt;span&gt;
	@html.raw(model.message)
&lt;/span&gt;
</pre>
          </td>
          <td> </td>
      </tr>

      <tr>
          <td valign="top">Combining Text and markup</td>

          <td valign="top">
              <pre>
@@{ 
	model.items.forEach(function(item) {
		&lt;span&gt;@item.Prop&lt;/span&gt; 
	}); 
}
</pre>
          </td>
          <td> </td>
      </tr>

      <tr>
          <td valign="top">Mixing code and Plain text</td>

          <td valign="top">
              <pre>
@if (foo) {
	&lt;text&gt;Plain Text&lt;/text&gt; 
}
</pre>
          </td>
          <td> </td>
      </tr>

      <tr>
          <td valign="top">Mixing code and plain text
          (alternate)</td>

          <td valign="top">
              <pre>
@if (foo) {
	@:Plain Text is @bar
}
</pre>
          </td>
          <td> </td>
      </tr>

      <tr>
          <td valign="top">Email Addresses</td>

          <td valign="top">
              <pre>
Hi test@example.com
</pre>
          </td>

          <td valign="top">Razor recognizes basic email
          format and is smart enough not to treat the @ as a code
          delimiter</td>
      </tr>

      <tr>
          <td valign="top">Explicit Expression</td>

          <td valign="top">
              <pre>
&lt;span&gt;ISBN@(isbnNumber)&lt;/span&gt;
</pre>
          </td>

          <td valign="top">In this case, we need to be
          explicit about the expression by using parentheses.</td>
      </tr>

      <tr>
          <td valign="top">Escaping the @ sign</td>

          <td valign="top">
              <pre>
&lt;span&gt;In Razor, you use the 
@@foo to display the value 
of foo&lt;/span&gt;
</pre>
          </td>

          <td valign="top">@@ renders a single @ in the
          response.</td>
      </tr>

      <tr>
          <td valign="top">Server side Comment</td>

          <td valign="top">
              <pre>
@*
	This is a server side 
	multiline comment 
*@
</pre>
          </td>
          <td> </td>
      </tr>

      <tr>
          <td valign="top">Mixing expressions and text</td>

          <td valign="top">
              <pre>
Hello @title. @name.
</pre>
          </td>
          <td> </td>
      </tr>
	</tbody>
</table>            

*shamelessly stolen from @haacked (http://haacked.com/archive/2011/01/06/razor-syntax-quick-reference.aspx) and modified for RazorJS*