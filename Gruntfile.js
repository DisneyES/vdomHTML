module.exports = function(grunt) {

  grunt.initConfig({

    config: {
      testPort        : 3000,
      livereloadPort  : 3101,
      moduleName      : 'atresmedia_diff',
      buildFolder     : 'build',
      srcFolder       : 'src',
      testFolder      : 'www-test',
      vendorFolder    : 'vendor',
      node_modulesFolder    : 'node_modules'
    },
    
    pkg: grunt.file.readJSON('package.json'),

    /**
    *  Download bower files [for testing]
    */
    bower : {
      install : {
        options : {
          targetDir : '<%= config.vendorFolder %>',
          layout : 'byComponent',
          verbose: true,
          cleanup: true
        }
      }
    },

    /**
    *  Concat bower files [for testing]
    */
    concat: {
      options: {
        separator: ';',
      },
      dist: {
        files:{
          '<%= config.testFolder %>/public/vendors.js': [
            '<%= config.node_modulesFolder %>/nunjucks/browser/nunjucks-slim.js',
            '<%= config.vendorFolder %>/jquery/jquery.js',
            '<%= config.vendorFolder %>/underscore/underscore.js',
            '<%= config.vendorFolder %>/backbone/backbone.js',
            '<%= config.vendorFolder %>/module_loader/app.js'
          ]
        }
      },
    },

    /**
    *  Compress module file [for production] 
    *  & bower vendors [for testing]
    */
    uglify: {
      vendors: {
        files: {
          '<%= config.testFolder %>/public/vendors.min.js': [
            '<%= config.testFolder %>/public/vendors.js'
          ]
        }
      },
      module: {
        options:{
           // the banner is inserted at the top of the output
           banner: '/*! <%= config.moduleName %> -- Release date:(<%= grunt.template.today("dd-mm-yyyy") %>) */\n'
        },
        files: {
          '<%= config.buildFolder %>/<%= config.moduleName %>.min.js': [
            '<%= config.buildFolder %>/<%= config.moduleName %>.js'
          ],
        }
      }
    },

    /**
    *  Validate JS code
    */
    jshint: {
      files: ['Gruntfile.js', 'src/**/*.js', 'test/**/*.js'],
      options: {
        globals: {
          jQuery: true
        },
        esnext:true
      }
    },

    /**
    *  Watch for changes an live reload
    */
    watch: {
      files: ['<%= jshint.files %>', '<%= config.srcFolder %>/**/*', '<%= config.testFolder %>/**/*'],
      tasks: ['browserify','uglify:module'],
      options: { livereload: '<%= config.livereloadPort %>' }
    },

    /**
    *  Create server [for testing]
    */
    connect: {
      server: {
        options: {
          port: '<%= config.testPort %>',
          hostname: '*',
          livereload:'<%= config.livereloadPort %>',
          open:true,
          base:['<%= config.testFolder %>','./'],
          path: 'http://localhost:<%= config.testPort %>',
          middleware: function(connect, options, middlewares) {
            // inject a custom middleware into the array of default middlewares
            var nunjucks = require('nunjucks');
            var Minifier = require('html-minifier');
            nunjucks.configure('test-views', { autoescape: true, noCache: true });

            middlewares.unshift(function(req, res, next) {
              var request = require('url').parse(req.url, true);
              if (request.pathname !== '/minutoaminuto') return next();
              console.log('request.query', request.query);
              var templateresult = nunjucks.render('minutoaminuto.nunj',{ max: (request.query && request.query.page) ? request.query.page : 1 });
              templateresult = Minifier.minify(templateresult, {
                  removeComments: true,
                  removeCommentsFromCDATA: true,
                  collapseWhitespace: true,
                  collapseBooleanAttributes: true,
                  removeAttributeQuotes: true,
                  removeEmptyAttributes: true
              });
              res.end( templateresult );
            });

            return middlewares;
          },
        }
      }
    },
    
    /**
    *  Create UMD Module with templates [for production]
    */
    browserify: {
      module: {
        options: {
          browserifyOptions: {
            standalone  : '<%= config.moduleName %>',
            debug       : true,
          }
        },
        files:{
          '<%= config.buildFolder %>/<%= config.moduleName %>.js' : [
            '<%= config.srcFolder %>/<%= config.moduleName %>.js'
          ],
        }
      },
    }
  });

  /**
  *  Grunt module tasks
  */
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-browserify');
  grunt.loadNpmTasks('grunt-bower-task');

  /**
  *  Grunt task
  */
  grunt.registerTask('default', ['jshint']);
  grunt.registerTask('build', ['jshint','bower','build_module']);
  grunt.registerTask('build_module', ['concat:dist','browserify','uglify']);
  grunt.registerTask('server', ['build','connect:server','watch']);
  grunt.registerTask('server_module', ['build_module','connect:server','watch']);

};