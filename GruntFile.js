/*global module:false*/
module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    meta: {
      banner: '/*\n  <%= pkg.title || pkg.name %> <%= pkg.version %>' +
      '<%= pkg.homepage ? " <" + pkg.homepage + ">" : "" %>\n' +
      '  Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author.name %>\n' +
      '  Released under <%= _.pluck(pkg.licenses, "type").join(", ") %> License\n*/\n'
    },

    qunit: {
      files: ['tests/index.html']
    },

    concat: {
      node: {				
				options: {
					banner: '<%= meta.banner %>'
				},
        src: [
          'banners/node-pre.js',
          'prototypes.node.js',
          'util.js',
          'reader.js',
          'razor.core.js',
          'razor.node.js', 
          'banners/node-post.js'
        ],
        dest: 'bin/node/razor.js'
      },
      browser: {	
				options: {
					banner: '<%= meta.banner %>'
				},
        src: [
          'banners/node-pre.js',
          'prototypes.js',
          'util.js',
          'reader.js',
          'razor.core.js',
          'razor.browser.js', 
          'banners/node-post.js',
        ],
        dest: 'bin/browser/razor.js'
      }
    },
 
    watch: {
      files: '<config:lint.files>',
      tasks: 'lint qunit'
    },

    jshint: {
      options: {
        curly: false,
        boss: true,
        evil: true,
        browser: true,
        node: true
      },
      globals: { },
      files: ['<%= concat.browser.dest %>', '<%= concat.node.dest %>']
    },

    uglify: {
			options: {
				banner: '<%= meta.banner %>'
			},
      browser: {
        src: ['<%= concat.browser.dest %>'],
        dest: 'bin/browser/razor.min.js'
      }									 
		}
  });

	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-contrib-qunit');
	
  grunt.registerTask('build', ['concat', 'jshint', 'uglify']);
  grunt.registerTask('default', ['concat', 'jshint', 'uglify', 'qunit']);
};
