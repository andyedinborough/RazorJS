#RazorJS
Yet another JavaScript implementation of the Razor view engine that aims to be simple and compatible for use both in the browser and in Node--simple enough for templating:

    Razor.compile('hello @model.name')({ name: 'world' })

As well as a Node view-engine:

    http.createServer(function (req, res) {
      res.writeHead(200, {'Content-Type': 'text/html'});
      Razor.view('test')
        .done(function(template) {
          res.end(template({ name: 'Andy' }));
        });
    }).listen(1337, "127.0.0.1");