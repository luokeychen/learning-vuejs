var gulp = require('gulp'),
    $ = require("gulp-load-plugins")(),
    babelify = require('babelify'),
    browserify = require('browserify'),
    html = require('html-browserify'),
    watchify = require('watchify'),
    source = require('vinyl-source-stream'),
    buffer = require('vinyl-buffer'),
    assign = require('lodash.assign'),
    plumber = require('gulp-plumber');

var DEST = "./dist",
    SRC = "./src"

var paths = {
  js: [SRC + "/**/*.js", "!" + SRC + "/**/_*.js"]
};

var customOpts = {
  entries:[SRC + '/app.js'],
  extensions: ['.js'],
  transform: [babelify, html],
  debug: true,
},
opts = assign({}, watchify.args, customOpts),
b = watchify(browserify(opts)),
bundle = function() {
  return b.bundle()
    .on('error',  $.util.log.bind($.util), 'Browserify Error')
    .pipe($.plumber())
    .pipe(source('app.js'))
    .pipe(buffer())
    .pipe(gulp.dest(DEST));
}

gulp.task('browserify', bundle);
b.on('update', bundle);
b.on('log', $.util.log);

gulp.task('watch', function() {
  gulp.watch(paths.js[0], ['browserify']);
});

gulp.task('default', ['watch']);
