/*global module:false*/
module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: '<json:package.json>',

    meta: {
      banner: '/*\n  <%= pkg.title || pkg.name %> <%= pkg.version %>' +
      '<%= pkg.homepage ? " <" + pkg.homepage + ">\n" : "" %>' +
      '  Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author.name %>' +
      '\n\n  Released under <%= _.pluck(pkg.licenses, "type").join(", ") %> License\n*/',
      node: {
        pre: '(function(global, undefined){',
        post: '})(module);'
      },
      browser: {
        pre: '(function(global, undefined){',
        post: '})(window);'
      },
      files: [
        'prototypes.js',
        'util.js',
        'reader.js',
        'razor.core.js',
      ]
    },

    lint: {
      files: ['bin/browser/<%= pkg.name %>.js']
    },

    qunit: {
      files: ['tests/index.html']
    },

    concat: {
      node: {
        src: [
          '<banner:meta.banner>', 
          '<banner:meta.node.pre>',
          '<config:meta.files>', 
          'razor.node.js', 
          '<banner:meta.node.post>'
        ],
        dest: 'bin/node/razor.js'
      },
      browser: {
        src: [
          '<banner:meta.banner>', 
          '<banner:meta.browser.pre>',
          '<config:meta.files>', 
          'razor.browser.js', 
          '<banner:meta.browser.post>'
        ],
        dest: 'bin/browser/razor.js'
      }
    },

    min: {
      node: {
        src: ['<banner:meta.banner>', '<config:concat.node.dest>'],
        dest: 'bin/node/razor.min.js'
      },
      browser: {
        src: ['<banner:meta.banner>', '<config:concat.browser.dest>'],
        dest: 'bin/browser/razor.min.js'
      }
    },

    watch: {
      files: '<config:lint.files>',
      tasks: 'lint qunit'
    },

    jshint: {
      options: {
        curly: false,
        boss: true
      },
      globals: { }
    },

    uglify: {}
  });

  grunt.registerTask('default', 'concat lint qunit min');
};
