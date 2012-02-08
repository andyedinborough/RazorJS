/*global window */
/*jshint curly: false, evil: true */
var Razor = (function () {
  var rxCode = /@((\{([^\}]*)\})|(([\w.\(\)\[\]]+|("([^"\\]*(\\.[^"\\]*)*)")|('([^'\\]*(\\.[^'\\]*)*)'))*))/g;

  //based on https://gist.github.com/964762
  function extend(a) {
    for (var i = 1, ii = arguments.length; i < ii; i++) {
      var b = arguments[i];
      if (b)
        for (var key in b)
          if (b.hasOwnProperty(key))
            a[key] = b[key];
    }
    return a;
  }

  function template(
    source, // the string source from which the template is compiled
    page0 // the default `with` context of the template (optional)
    ) {
    return function (
        model, // the object called as `this` in the template
        page // the `with` context of this template call (optional)
        ) {
      return source.replace(
            rxCode, // a regexp that finds the interpolated code: "@{<code>}"
            function (
            _, // not used, only positional
            codeWrapped, // the code matched by the interpolation
            __, // positional
            code // the code matched by the interpolation
            ) {
              var context = extend({}, page || page0, { model: model });
              return new Function("with(this)return " + (code || codeWrapped))
                    .call(context);
            });
    };
  }

  return {
    compile: function (markup, page) {
      return template(markup, page);
    },
    render: function (markup, model, page) {
      return this.compile(markup, page)(model);
    }
  };

})(); 