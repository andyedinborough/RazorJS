RazorJS
=======

A JavaScript implementation of the Razor view engine that aims to be simple and compatible for use both in the 
browser and in Node--simple enough for templating:

    Razor.compile('hello @model.name')({ name: 'world' }) == 'hello world'

As well as a Node view-engine:

    http.createServer(function (req, res) {
      res.writeHead(200, {'Content-Type': 'text/html'});
      Razor.view('test')
        .done(function(template) {
          res.end(template({ name: 'Andy' }));
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
              <pre class="csharpcode">
<span class="asp">@{</span> 
<span class="rzr"><span class="kwrd">int</span> x = 123;</span> 
<span class="rzr"><span class="kwrd">string</span> y = <span class=
"str">"because."</span>;</span>
<span class="asp">}</span>
</pre>
          </td>
      </tr>

      <tr>
          <td valign="top">Expression (Html Encoded)</td>
          <td valign="top">
              <pre class="csharpcode">
<span class="kwrd">&lt;</span><span class="html">span</span><span class=
"kwrd">&gt;</span><span class="asp">@</span><span class=
"rzr">model.Message</span><span class="kwrd">&lt;/</span><span class=
"html">span</span><span class="kwrd">&gt;</span>
</pre>
          </td>
      </tr>

      <tr>
          <td valign="top">Expression (Unencoded)</td>

          <td valign="top">
              <pre class="csharpcode">
<span class="kwrd">&lt;</span><span class="html">span</span><span class=
"kwrd">&gt;
</span><span class="asp">@</span><span class=
"rzr">Html.Raw(model.Message)</span>
<span class="kwrd">&lt;/</span><span class="html">span</span><span class=
"kwrd">&gt;</span>
</pre>
          </td>
      </tr>

      <tr>
          <td valign="top">Combining Text and markup</td>

          <td valign="top">
              <pre class="csharpcode">
<span class="asp">@</span><span class="rzr"><span class=
"kwrd">foreach</span>(var item <span class="kwrd">in</span> items) {</span>
<span class="kwrd">&lt;</span><span class="html">span</span><span class=
"kwrd">&gt;</span><span class="asp">@</span><span class=
"rzr">item.Prop</span><span class="kwrd">&lt;/</span><span class=
"html">span</span><span class="kwrd">&gt;</span> 
<span class="rzr">}</span>
</pre>
          </td>
      </tr>

      <tr>
          <td valign="top">Mixing code and Plain text</td>

          <td valign="top">
              <pre class="csharpcode">
<span class="asp">@</span><span class="rzr"><span class=
"kwrd">if</span> (foo) {</span>
<span class="kwrd">&lt;</span><span class="html">text</span><span class=
"kwrd">&gt;</span>Plain Text<span class="kwrd">&lt;/</span><span class=
"html">text</span><span class="kwrd">&gt;</span> 
<span class="rzr">}</span>
</pre>
          </td>
      </tr>

      <tr>
          <td valign="top">Mixing code and plain text
          (alternate)</td>

          <td valign="top">
              <pre class="csharpcode">
<span class="asp">@</span><span class="rzr"><span class=
"kwrd">if</span> (foo) {</span>
<span class="asp">@:</span>Plain Text is <span class=
"asp">@</span><span class="rzr">bar</span>
<span class="rzr">}</span>
</pre>
          </td>
      </tr>

      <tr>
          <td valign="top">Email Addresses</td>

          <td valign="top">
              <pre class="csharpcode">
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
              <pre class="csharpcode">
<span class="kwrd">&lt;</span><span class="html">span</span><span class=
"kwrd">&gt;</span>ISBN<span class="asp">@(</span><span class=
"rzr">isbnNumber</span><span class="asp">)</span><span class=
"kwrd">&lt;/</span><span class="html">span</span><span class="kwrd">&gt;</span>
</pre>
          </td>

          <td valign="top">In this case, we need to be
          explicit about the expression by using parentheses.</td>
      </tr>

      <tr>
          <td valign="top">Escaping the @ sign</td>

          <td valign="top">
              <pre class="csharpcode">
<span class="kwrd">&lt;</span><span class="html">span</span><span class=
"kwrd">&gt;</span>In Razor, you use the 
@@foo to display the value 
of foo<span class="kwrd">&lt;/</span><span class="html">span</span><span class=
"kwrd">&gt;</span>
</pre>
          </td>

          <td valign="top">@@ renders a single @ in the
          response.</td>
      </tr>

      <tr>
          <td valign="top">Server side Comment</td>

          <td valign="top">
              <pre class="csharpcode">
<span class="asp">@*</span>
<span class="rem">This is a server side 
multiline comment </span>
<span class="asp">*@</span>
</pre>
          </td>
      </tr>

      <tr>
          <td valign="top">Mixing expressions and text</td>

          <td valign="top">
              <pre class="csharpcode">
Hello <span class="asp">@</span>title. <span class="asp">@</span>name.
</pre>
          </td>
      </tr>
	</tbody>
</table>            

*shamelessly stolen from @haacked (http://haacked.com/archive/2011/01/06/razor-syntax-quick-reference.aspx) and modified for RazorJS*