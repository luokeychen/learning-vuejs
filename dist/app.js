(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        setTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],2:[function(require,module,exports){
/**
 * Service for sending network requests.
 */

var xhr = require('./lib/xhr');
var jsonp = require('./lib/jsonp');
var Promise = require('./lib/promise');

module.exports = function (_) {

    var originUrl = _.url.parse(location.href);
    var jsonType = {'Content-Type': 'application/json;charset=utf-8'};

    function Http(url, options) {

        var promise;

        if (_.isPlainObject(url)) {
            options = url;
            url = '';
        }

        options = _.extend({url: url}, options);
        options = _.extend(true, {},
            Http.options, this.options, options
        );

        if (options.crossOrigin === null) {
            options.crossOrigin = crossOrigin(options.url);
        }

        options.method = options.method.toUpperCase();
        options.headers = _.extend({}, Http.headers.common,
            !options.crossOrigin ? Http.headers.custom : {},
            Http.headers[options.method.toLowerCase()],
            options.headers
        );

        if (_.isPlainObject(options.data) && /^(GET|JSONP)$/i.test(options.method)) {
            _.extend(options.params, options.data);
            delete options.data;
        }

        if (options.emulateHTTP && !options.crossOrigin && /^(PUT|PATCH|DELETE)$/i.test(options.method)) {
            options.headers['X-HTTP-Method-Override'] = options.method;
            options.method = 'POST';
        }

        if (options.emulateJSON && _.isPlainObject(options.data)) {
            options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
            options.data = _.url.params(options.data);
        }

        if (_.isObject(options.data) && /FormData/i.test(options.data.toString())) {
            delete options.headers['Content-Type'];
        }

        if (_.isPlainObject(options.data)) {
            options.data = JSON.stringify(options.data);
        }

        promise = (options.method == 'JSONP' ? jsonp : xhr).call(this.vm, _, options);
        promise = extendPromise(promise.then(transformResponse, transformResponse), this.vm);

        if (options.success) {
            promise = promise.success(options.success);
        }

        if (options.error) {
            promise = promise.error(options.error);
        }

        return promise;
    }

    function extendPromise(promise, vm) {

        promise.success = function (fn) {

            return extendPromise(promise.then(function (response) {
                return fn.call(vm, response.data, response.status, response) || response;
            }), vm);

        };

        promise.error = function (fn) {

            return extendPromise(promise.then(undefined, function (response) {
                return fn.call(vm, response.data, response.status, response) || response;
            }), vm);

        };

        promise.always = function (fn) {

            var cb = function (response) {
                return fn.call(vm, response.data, response.status, response) || response;
            };

            return extendPromise(promise.then(cb, cb), vm);
        };

        return promise;
    }

    function transformResponse(response) {

        try {
            response.data = JSON.parse(response.responseText);
        } catch (e) {
            response.data = response.responseText;
        }

        return response.ok ? response : Promise.reject(response);
    }

    function crossOrigin(url) {

        var requestUrl = _.url.parse(url);

        return (requestUrl.protocol !== originUrl.protocol || requestUrl.host !== originUrl.host);
    }

    Http.options = {
        method: 'get',
        params: {},
        data: '',
        xhr: null,
        jsonp: 'callback',
        beforeSend: null,
        crossOrigin: null,
        emulateHTTP: false,
        emulateJSON: false
    };

    Http.headers = {
        put: jsonType,
        post: jsonType,
        patch: jsonType,
        delete: jsonType,
        common: {'Accept': 'application/json, text/plain, */*'},
        custom: {'X-Requested-With': 'XMLHttpRequest'}
    };

    ['get', 'put', 'post', 'patch', 'delete', 'jsonp'].forEach(function (method) {

        Http[method] = function (url, data, success, options) {

            if (_.isFunction(data)) {
                options = success;
                success = data;
                data = undefined;
            }

            return this(url, _.extend({method: method, data: data, success: success}, options));
        };
    });

    return _.http = Http;
};

},{"./lib/jsonp":4,"./lib/promise":5,"./lib/xhr":7}],3:[function(require,module,exports){
/**
 * Install plugin.
 */

function install(Vue) {

    var _ = require('./lib/util')(Vue);

    Vue.url = require('./url')(_);
    Vue.http = require('./http')(_);
    Vue.resource = require('./resource')(_);

    Object.defineProperties(Vue.prototype, {

        $url: {
            get: function () {
                return this._url || (this._url = _.options(Vue.url, this, this.$options.url));
            }
        },

        $http: {
            get: function () {
                return this._http || (this._http = _.options(Vue.http, this, this.$options.http));
            }
        },

        $resource: {
            get: function () {
                return Vue.resource.bind(this);
            }
        }

    });
}

if (window.Vue) {
    Vue.use(install);
}

module.exports = install;
},{"./http":2,"./lib/util":6,"./resource":8,"./url":9}],4:[function(require,module,exports){
/**
 * JSONP request.
 */

var Promise = require('./promise');

module.exports = function (_, options) {

    var callback = '_jsonp' + Math.random().toString(36).substr(2), response = {}, script, body;

    options.params[options.jsonp] = callback;

    if (_.isFunction(options.beforeSend)) {
        options.beforeSend.call(this, {}, options);
    }

    return new Promise(function (resolve, reject) {

        script = document.createElement('script');
        script.src = _.url(options);
        script.type = 'text/javascript';
        script.async = true;

        window[callback] = function (data) {
            body = data;
        };

        var handler = function (event) {

            delete window[callback];
            document.body.removeChild(script);

            if (event.type === 'load' && !body) {
                event.type = 'error';
            }

            response.ok = event.type !== 'error';
            response.status = response.ok ? 200 : 404;
            response.responseText = body ? body : event.type;

            (response.ok ? resolve : reject)(response);
        };

        script.onload = handler;
        script.onerror = handler;

        document.body.appendChild(script);
    });

};

},{"./promise":5}],5:[function(require,module,exports){
/**
 * Promises/A+ polyfill v1.1.0 (https://github.com/bramstein/promis)
 */

var RESOLVED = 0;
var REJECTED = 1;
var PENDING  = 2;

function Promise(executor) {

    this.state = PENDING;
    this.value = undefined;
    this.deferred = [];

    var promise = this;

    try {
        executor(function (x) {
            promise.resolve(x);
        }, function (r) {
            promise.reject(r);
        });
    } catch (e) {
        promise.reject(e);
    }
}

Promise.reject = function (r) {
    return new Promise(function (resolve, reject) {
        reject(r);
    });
};

Promise.resolve = function (x) {
    return new Promise(function (resolve, reject) {
        resolve(x);
    });
};

Promise.all = function all(iterable) {
    return new Promise(function (resolve, reject) {
        var count = 0,
            result = [];

        if (iterable.length === 0) {
            resolve(result);
        }

        function resolver(i) {
            return function (x) {
                result[i] = x;
                count += 1;

                if (count === iterable.length) {
                    resolve(result);
                }
            };
        }

        for (var i = 0; i < iterable.length; i += 1) {
            iterable[i].then(resolver(i), reject);
        }
    });
};

Promise.race = function race(iterable) {
    return new Promise(function (resolve, reject) {
        for (var i = 0; i < iterable.length; i += 1) {
            iterable[i].then(resolve, reject);
        }
    });
};

var p = Promise.prototype;

p.resolve = function resolve(x) {
    var promise = this;

    if (promise.state === PENDING) {
        if (x === promise) {
            throw new TypeError('Promise settled with itself.');
        }

        var called = false;

        try {
            var then = x && x['then'];

            if (x !== null && typeof x === 'object' && typeof then === 'function') {
                then.call(x, function (x) {
                    if (!called) {
                        promise.resolve(x);
                    }
                    called = true;

                }, function (r) {
                    if (!called) {
                        promise.reject(r);
                    }
                    called = true;
                });
                return;
            }
        } catch (e) {
            if (!called) {
                promise.reject(e);
            }
            return;
        }
        promise.state = RESOLVED;
        promise.value = x;
        promise.notify();
    }
};

p.reject = function reject(reason) {
    var promise = this;

    if (promise.state === PENDING) {
        if (reason === promise) {
            throw new TypeError('Promise settled with itself.');
        }

        promise.state = REJECTED;
        promise.value = reason;
        promise.notify();
    }
};

p.notify = function notify() {
    var promise = this;

    async(function () {
        if (promise.state !== PENDING) {
            while (promise.deferred.length) {
                var deferred = promise.deferred.shift(),
                    onResolved = deferred[0],
                    onRejected = deferred[1],
                    resolve = deferred[2],
                    reject = deferred[3];

                try {
                    if (promise.state === RESOLVED) {
                        if (typeof onResolved === 'function') {
                            resolve(onResolved.call(undefined, promise.value));
                        } else {
                            resolve(promise.value);
                        }
                    } else if (promise.state === REJECTED) {
                        if (typeof onRejected === 'function') {
                            resolve(onRejected.call(undefined, promise.value));
                        } else {
                            reject(promise.value);
                        }
                    }
                } catch (e) {
                    reject(e);
                }
            }
        }
    });
};

p.catch = function (onRejected) {
    return this.then(undefined, onRejected);
};

p.then = function then(onResolved, onRejected) {
    var promise = this;

    return new Promise(function (resolve, reject) {
        promise.deferred.push([onResolved, onRejected, resolve, reject]);
        promise.notify();
    });
};

var queue = [];
var async = function (callback) {
    queue.push(callback);

    if (queue.length === 1) {
        async.async();
    }
};

async.run = function () {
    while (queue.length) {
        queue[0]();
        queue.shift();
    }
};

if (window.MutationObserver) {
    var el = document.createElement('div');
    var mo = new MutationObserver(async.run);

    mo.observe(el, {
        attributes: true
    });

    async.async = function () {
        el.setAttribute("x", 0);
    };
} else {
    async.async = function () {
        setTimeout(async.run);
    };
}

module.exports = window.Promise || Promise;

},{}],6:[function(require,module,exports){
/**
 * Utility functions.
 */

module.exports = function (Vue) {

    var _ = Vue.util.extend({}, Vue.util);

    _.isString = function (value) {
        return typeof value === 'string';
    };

    _.isFunction = function (value) {
        return typeof value === 'function';
    };

    _.options = function (fn, obj, options) {

        options = options || {};

        if (_.isFunction(options)) {
            options = options.call(obj);
        }

        return _.extend(fn.bind({vm: obj, options: options}), fn, {options: options});
    };

    _.each = function (obj, iterator) {

        var i, key;

        if (typeof obj.length == 'number') {
            for (i = 0; i < obj.length; i++) {
                iterator.call(obj[i], obj[i], i);
            }
        } else if (_.isObject(obj)) {
            for (key in obj) {
                if (obj.hasOwnProperty(key)) {
                    iterator.call(obj[key], obj[key], key);
                }
            }
        }

        return obj;
    };

    _.extend = function (target) {

        var array = [], args = array.slice.call(arguments, 1), deep;

        if (typeof target == 'boolean') {
            deep = target;
            target = args.shift();
        }

        args.forEach(function (arg) {
            extend(target, arg, deep);
        });

        return target;
    };

    function extend(target, source, deep) {
        for (var key in source) {
            if (deep && (_.isPlainObject(source[key]) || _.isArray(source[key]))) {
                if (_.isPlainObject(source[key]) && !_.isPlainObject(target[key])) {
                    target[key] = {};
                }
                if (_.isArray(source[key]) && !_.isArray(target[key])) {
                    target[key] = [];
                }
                extend(target[key], source[key], deep);
            } else if (source[key] !== undefined) {
                target[key] = source[key];
            }
        }
    }

    return _;
};

},{}],7:[function(require,module,exports){
/**
 * XMLHttp request.
 */

var Promise = require('./promise');
var XDomain = window.XDomainRequest;

module.exports = function (_, options) {

    var request = new XMLHttpRequest(), promise;

    if (XDomain && options.crossOrigin) {
        request = new XDomainRequest(); options.headers = {};
    }

    if (_.isPlainObject(options.xhr)) {
        _.extend(request, options.xhr);
    }

    if (_.isFunction(options.beforeSend)) {
        options.beforeSend.call(this, request, options);
    }

    promise = new Promise(function (resolve, reject) {

        request.open(options.method, _.url(options), true);

        _.each(options.headers, function (value, header) {
            request.setRequestHeader(header, value);
        });

        var handler = function (event) {

            request.ok = event.type === 'load';

            if (request.ok && request.status) {
                request.ok = request.status >= 200 && request.status < 300;
            }

            (request.ok ? resolve : reject)(request);
        };

        request.onload = handler;
        request.onabort = handler;
        request.onerror = handler;

        request.send(options.data);
    });

    return promise;
};

},{"./promise":5}],8:[function(require,module,exports){
/**
 * Service for interacting with RESTful services.
 */

module.exports = function (_) {

    function Resource(url, params, actions) {

        var self = this, resource = {};

        actions = _.extend({},
            Resource.actions,
            actions
        );

        _.each(actions, function (action, name) {

            action = _.extend(true, {url: url, params: params || {}}, action);

            resource[name] = function () {
                return (self.$http || _.http)(opts(action, arguments));
            };
        });

        return resource;
    }

    function opts(action, args) {

        var options = _.extend({}, action), params = {}, data, success, error;

        switch (args.length) {

            case 4:

                error = args[3];
                success = args[2];

            case 3:
            case 2:

                if (_.isFunction(args[1])) {

                    if (_.isFunction(args[0])) {

                        success = args[0];
                        error = args[1];

                        break;
                    }

                    success = args[1];
                    error = args[2];

                } else {

                    params = args[0];
                    data = args[1];
                    success = args[2];

                    break;
                }

            case 1:

                if (_.isFunction(args[0])) {
                    success = args[0];
                } else if (/^(POST|PUT|PATCH)$/i.test(options.method)) {
                    data = args[0];
                } else {
                    params = args[0];
                }

                break;

            case 0:

                break;

            default:

                throw 'Expected up to 4 arguments [params, data, success, error], got ' + args.length + ' arguments';
        }

        options.data = data;
        options.params = _.extend({}, options.params, params);

        if (success) {
            options.success = success;
        }

        if (error) {
            options.error = error;
        }

        return options;
    }

    Resource.actions = {

        get: {method: 'GET'},
        save: {method: 'POST'},
        query: {method: 'GET'},
        update: {method: 'PUT'},
        remove: {method: 'DELETE'},
        delete: {method: 'DELETE'}

    };

    return _.resource = Resource;
};

},{}],9:[function(require,module,exports){
/**
 * Service for URL templating.
 */

var ie = document.documentMode;
var el = document.createElement('a');

module.exports = function (_) {

    function Url(url, params) {

        var urlParams = {}, queryParams = {}, options = url, query;

        if (!_.isPlainObject(options)) {
            options = {url: url, params: params};
        }

        options = _.extend(true, {},
            Url.options, this.options, options
        );

        url = options.url.replace(/(\/?):([a-z]\w*)/gi, function (match, slash, name) {

            if (options.params[name]) {
                urlParams[name] = true;
                return slash + encodeUriSegment(options.params[name]);
            }

            return '';
        });

        if (_.isString(options.root) && !url.match(/^(https?:)?\//)) {
            url = options.root + '/' + url;
        }

        _.each(options.params, function (value, key) {
            if (!urlParams[key]) {
                queryParams[key] = value;
            }
        });

        query = Url.params(queryParams);

        if (query) {
            url += (url.indexOf('?') == -1 ? '?' : '&') + query;
        }

        return url;
    }

    /**
     * Url options.
     */

    Url.options = {
        url: '',
        root: null,
        params: {}
    };

    /**
     * Encodes a Url parameter string.
     *
     * @param {Object} obj
     */

    Url.params = function (obj) {

        var params = [];

        params.add = function (key, value) {

            if (_.isFunction (value)) {
                value = value();
            }

            if (value === null) {
                value = '';
            }

            this.push(encodeUriSegment(key) + '=' + encodeUriSegment(value));
        };

        serialize(params, obj);

        return params.join('&');
    };

    /**
     * Parse a URL and return its components.
     *
     * @param {String} url
     */

    Url.parse = function (url) {

        if (ie) {
            el.href = url;
            url = el.href;
        }

        el.href = url;

        return {
            href: el.href,
            protocol: el.protocol ? el.protocol.replace(/:$/, '') : '',
            port: el.port,
            host: el.host,
            hostname: el.hostname,
            pathname: el.pathname.charAt(0) === '/' ? el.pathname : '/' + el.pathname,
            search: el.search ? el.search.replace(/^\?/, '') : '',
            hash: el.hash ? el.hash.replace(/^#/, '') : ''
        };
    };

    function serialize(params, obj, scope) {

        var array = _.isArray(obj), plain = _.isPlainObject(obj), hash;

        _.each(obj, function (value, key) {

            hash = _.isObject(value) || _.isArray(value);

            if (scope) {
                key = scope + '[' + (plain || hash ? key : '') + ']';
            }

            if (!scope && array) {
                params.add(value.name, value.value);
            } else if (hash) {
                serialize(params, value, key);
            } else {
                params.add(key, value);
            }
        });
    }

    function encodeUriSegment(value) {

        return encodeUriQuery(value, true).
            replace(/%26/gi, '&').
            replace(/%3D/gi, '=').
            replace(/%2B/gi, '+');
    }

    function encodeUriQuery(value, spaces) {

        return encodeURIComponent(value).
            replace(/%40/gi, '@').
            replace(/%3A/gi, ':').
            replace(/%24/g, '$').
            replace(/%2C/gi, ',').
            replace(/%20/g, (spaces ? '%20' : '+'));
    }

    return _.url = Url;
};

},{}],10:[function(require,module,exports){
var _ = require('../util')

/**
 * Create a child instance that prototypally inherits
 * data on parent. To achieve that we create an intermediate
 * constructor with its prototype pointing to parent.
 *
 * @param {Object} opts
 * @param {Function} [BaseCtor]
 * @return {Vue}
 * @public
 */

exports.$addChild = function (opts, BaseCtor) {
  BaseCtor = BaseCtor || _.Vue
  opts = opts || {}
  var ChildVue
  var parent = this
  // transclusion context
  var context = opts._context || parent
  var inherit = opts.inherit !== undefined
    ? opts.inherit
    : BaseCtor.options.inherit
  if (inherit) {
    var ctors = context._childCtors
    ChildVue = ctors[BaseCtor.cid]
    if (!ChildVue) {
      var optionName = BaseCtor.options.name
      var className = optionName
        ? _.classify(optionName)
        : 'VueComponent'
      ChildVue = new Function(
        'return function ' + className + ' (options) {' +
        'this.constructor = ' + className + ';' +
        'this._init(options) }'
      )()
      ChildVue.options = BaseCtor.options
      ChildVue.linker = BaseCtor.linker
      ChildVue.prototype = context
      ctors[BaseCtor.cid] = ChildVue
    }
  } else {
    ChildVue = BaseCtor
  }
  opts._parent = parent
  opts._root = parent.$root
  var child = new ChildVue(opts)
  return child
}

},{"../util":71}],11:[function(require,module,exports){
var Watcher = require('../watcher')
var Path = require('../parsers/path')
var textParser = require('../parsers/text')
var dirParser = require('../parsers/directive')
var expParser = require('../parsers/expression')
var filterRE = /[^|]\|[^|]/

/**
 * Get the value from an expression on this vm.
 *
 * @param {String} exp
 * @return {*}
 */

exports.$get = function (exp) {
  var res = expParser.parse(exp)
  if (res) {
    try {
      return res.get.call(this, this)
    } catch (e) {}
  }
}

/**
 * Set the value from an expression on this vm.
 * The expression must be a valid left-hand
 * expression in an assignment.
 *
 * @param {String} exp
 * @param {*} val
 */

exports.$set = function (exp, val) {
  var res = expParser.parse(exp, true)
  if (res && res.set) {
    res.set.call(this, this, val)
  }
}

/**
 * Add a property on the VM
 *
 * @param {String} key
 * @param {*} val
 */

exports.$add = function (key, val) {
  this._data.$add(key, val)
}

/**
 * Delete a property on the VM
 *
 * @param {String} key
 */

exports.$delete = function (key) {
  this._data.$delete(key)
}

/**
 * Watch an expression, trigger callback when its
 * value changes.
 *
 * @param {String} exp
 * @param {Function} cb
 * @param {Object} [options]
 *                 - {Boolean} deep
 *                 - {Boolean} immediate
 *                 - {Boolean} user
 * @return {Function} - unwatchFn
 */

exports.$watch = function (exp, cb, options) {
  var vm = this
  var watcher = new Watcher(vm, exp, cb, {
    deep: options && options.deep,
    user: !options || options.user !== false
  })
  if (options && options.immediate) {
    cb.call(vm, watcher.value)
  }
  return function unwatchFn () {
    watcher.teardown()
  }
}

/**
 * Evaluate a text directive, including filters.
 *
 * @param {String} text
 * @return {String}
 */

exports.$eval = function (text) {
  // check for filters.
  if (filterRE.test(text)) {
    var dir = dirParser.parse(text)[0]
    // the filter regex check might give false positive
    // for pipes inside strings, so it's possible that
    // we don't get any filters here
    var val = this.$get(dir.expression)
    return dir.filters
      ? this._applyFilters(val, null, dir.filters)
      : val
  } else {
    // no filter
    return this.$get(text)
  }
}

/**
 * Interpolate a piece of template text.
 *
 * @param {String} text
 * @return {String}
 */

exports.$interpolate = function (text) {
  var tokens = textParser.parse(text)
  var vm = this
  if (tokens) {
    return tokens.length === 1
      ? vm.$eval(tokens[0].value)
      : tokens.map(function (token) {
          return token.tag
            ? vm.$eval(token.value)
            : token.value
        }).join('')
  } else {
    return text
  }
}

/**
 * Log instance data as a plain JS object
 * so that it is easier to inspect in console.
 * This method assumes console is available.
 *
 * @param {String} [path]
 */

exports.$log = function (path) {
  var data = path
    ? Path.get(this._data, path)
    : this._data
  if (data) {
    data = JSON.parse(JSON.stringify(data))
  }
  console.log(data)
}

},{"../parsers/directive":59,"../parsers/expression":60,"../parsers/path":61,"../parsers/text":63,"../watcher":75}],12:[function(require,module,exports){
var _ = require('../util')
var transition = require('../transition')

/**
 * Convenience on-instance nextTick. The callback is
 * auto-bound to the instance, and this avoids component
 * modules having to rely on the global Vue.
 *
 * @param {Function} fn
 */

exports.$nextTick = function (fn) {
  _.nextTick(fn, this)
}

/**
 * Append instance to target
 *
 * @param {Node} target
 * @param {Function} [cb]
 * @param {Boolean} [withTransition] - defaults to true
 */

exports.$appendTo = function (target, cb, withTransition) {
  return insert(
    this, target, cb, withTransition,
    append, transition.append
  )
}

/**
 * Prepend instance to target
 *
 * @param {Node} target
 * @param {Function} [cb]
 * @param {Boolean} [withTransition] - defaults to true
 */

exports.$prependTo = function (target, cb, withTransition) {
  target = query(target)
  if (target.hasChildNodes()) {
    this.$before(target.firstChild, cb, withTransition)
  } else {
    this.$appendTo(target, cb, withTransition)
  }
  return this
}

/**
 * Insert instance before target
 *
 * @param {Node} target
 * @param {Function} [cb]
 * @param {Boolean} [withTransition] - defaults to true
 */

exports.$before = function (target, cb, withTransition) {
  return insert(
    this, target, cb, withTransition,
    before, transition.before
  )
}

/**
 * Insert instance after target
 *
 * @param {Node} target
 * @param {Function} [cb]
 * @param {Boolean} [withTransition] - defaults to true
 */

exports.$after = function (target, cb, withTransition) {
  target = query(target)
  if (target.nextSibling) {
    this.$before(target.nextSibling, cb, withTransition)
  } else {
    this.$appendTo(target.parentNode, cb, withTransition)
  }
  return this
}

/**
 * Remove instance from DOM
 *
 * @param {Function} [cb]
 * @param {Boolean} [withTransition] - defaults to true
 */

exports.$remove = function (cb, withTransition) {
  if (!this.$el.parentNode) {
    return cb && cb()
  }
  var inDoc = this._isAttached && _.inDoc(this.$el)
  // if we are not in document, no need to check
  // for transitions
  if (!inDoc) withTransition = false
  var op
  var self = this
  var realCb = function () {
    if (inDoc) self._callHook('detached')
    if (cb) cb()
  }
  if (
    this._isFragment &&
    !this._blockFragment.hasChildNodes()
  ) {
    op = withTransition === false
      ? append
      : transition.removeThenAppend
    blockOp(this, this._blockFragment, op, realCb)
  } else {
    op = withTransition === false
      ? remove
      : transition.remove
    op(this.$el, this, realCb)
  }
  return this
}

/**
 * Shared DOM insertion function.
 *
 * @param {Vue} vm
 * @param {Element} target
 * @param {Function} [cb]
 * @param {Boolean} [withTransition]
 * @param {Function} op1 - op for non-transition insert
 * @param {Function} op2 - op for transition insert
 * @return vm
 */

function insert (vm, target, cb, withTransition, op1, op2) {
  target = query(target)
  var targetIsDetached = !_.inDoc(target)
  var op = withTransition === false || targetIsDetached
    ? op1
    : op2
  var shouldCallHook =
    !targetIsDetached &&
    !vm._isAttached &&
    !_.inDoc(vm.$el)
  if (vm._isFragment) {
    blockOp(vm, target, op, cb)
  } else {
    op(vm.$el, target, vm, cb)
  }
  if (shouldCallHook) {
    vm._callHook('attached')
  }
  return vm
}

/**
 * Execute a transition operation on a fragment instance,
 * iterating through all its block nodes.
 *
 * @param {Vue} vm
 * @param {Node} target
 * @param {Function} op
 * @param {Function} cb
 */

function blockOp (vm, target, op, cb) {
  var current = vm._fragmentStart
  var end = vm._fragmentEnd
  var next
  while (next !== end) {
    next = current.nextSibling
    op(current, target, vm)
    current = next
  }
  op(end, target, vm, cb)
}

/**
 * Check for selectors
 *
 * @param {String|Element} el
 */

function query (el) {
  return typeof el === 'string'
    ? document.querySelector(el)
    : el
}

/**
 * Append operation that takes a callback.
 *
 * @param {Node} el
 * @param {Node} target
 * @param {Vue} vm - unused
 * @param {Function} [cb]
 */

function append (el, target, vm, cb) {
  target.appendChild(el)
  if (cb) cb()
}

/**
 * InsertBefore operation that takes a callback.
 *
 * @param {Node} el
 * @param {Node} target
 * @param {Vue} vm - unused
 * @param {Function} [cb]
 */

function before (el, target, vm, cb) {
  _.before(el, target)
  if (cb) cb()
}

/**
 * Remove operation that takes a callback.
 *
 * @param {Node} el
 * @param {Vue} vm - unused
 * @param {Function} [cb]
 */

function remove (el, vm, cb) {
  _.remove(el)
  if (cb) cb()
}

},{"../transition":64,"../util":71}],13:[function(require,module,exports){
var _ = require('../util')

/**
 * Listen on the given `event` with `fn`.
 *
 * @param {String} event
 * @param {Function} fn
 */

exports.$on = function (event, fn) {
  (this._events[event] || (this._events[event] = []))
    .push(fn)
  modifyListenerCount(this, event, 1)
  return this
}

/**
 * Adds an `event` listener that will be invoked a single
 * time then automatically removed.
 *
 * @param {String} event
 * @param {Function} fn
 */

exports.$once = function (event, fn) {
  var self = this
  function on () {
    self.$off(event, on)
    fn.apply(this, arguments)
  }
  on.fn = fn
  this.$on(event, on)
  return this
}

/**
 * Remove the given callback for `event` or all
 * registered callbacks.
 *
 * @param {String} event
 * @param {Function} fn
 */

exports.$off = function (event, fn) {
  var cbs
  // all
  if (!arguments.length) {
    if (this.$parent) {
      for (event in this._events) {
        cbs = this._events[event]
        if (cbs) {
          modifyListenerCount(this, event, -cbs.length)
        }
      }
    }
    this._events = {}
    return this
  }
  // specific event
  cbs = this._events[event]
  if (!cbs) {
    return this
  }
  if (arguments.length === 1) {
    modifyListenerCount(this, event, -cbs.length)
    this._events[event] = null
    return this
  }
  // specific handler
  var cb
  var i = cbs.length
  while (i--) {
    cb = cbs[i]
    if (cb === fn || cb.fn === fn) {
      modifyListenerCount(this, event, -1)
      cbs.splice(i, 1)
      break
    }
  }
  return this
}

/**
 * Trigger an event on self.
 *
 * @param {String} event
 */

exports.$emit = function (event) {
  this._eventCancelled = false
  var cbs = this._events[event]
  if (cbs) {
    // avoid leaking arguments:
    // http://jsperf.com/closure-with-arguments
    var i = arguments.length - 1
    var args = new Array(i)
    while (i--) {
      args[i] = arguments[i + 1]
    }
    i = 0
    cbs = cbs.length > 1
      ? _.toArray(cbs)
      : cbs
    for (var l = cbs.length; i < l; i++) {
      if (cbs[i].apply(this, args) === false) {
        this._eventCancelled = true
      }
    }
  }
  return this
}

/**
 * Recursively broadcast an event to all children instances.
 *
 * @param {String} event
 * @param {...*} additional arguments
 */

exports.$broadcast = function (event) {
  // if no child has registered for this event,
  // then there's no need to broadcast.
  if (!this._eventsCount[event]) return
  var children = this.$children
  for (var i = 0, l = children.length; i < l; i++) {
    var child = children[i]
    child.$emit.apply(child, arguments)
    if (!child._eventCancelled) {
      child.$broadcast.apply(child, arguments)
    }
  }
  return this
}

/**
 * Recursively propagate an event up the parent chain.
 *
 * @param {String} event
 * @param {...*} additional arguments
 */

exports.$dispatch = function () {
  var parent = this.$parent
  while (parent) {
    parent.$emit.apply(parent, arguments)
    parent = parent._eventCancelled
      ? null
      : parent.$parent
  }
  return this
}

/**
 * Modify the listener counts on all parents.
 * This bookkeeping allows $broadcast to return early when
 * no child has listened to a certain event.
 *
 * @param {Vue} vm
 * @param {String} event
 * @param {Number} count
 */

var hookRE = /^hook:/
function modifyListenerCount (vm, event, count) {
  var parent = vm.$parent
  // hooks do not get broadcasted so no need
  // to do bookkeeping for them
  if (!parent || !count || hookRE.test(event)) return
  while (parent) {
    parent._eventsCount[event] =
      (parent._eventsCount[event] || 0) + count
    parent = parent.$parent
  }
}

},{"../util":71}],14:[function(require,module,exports){
var _ = require('../util')
var config = require('../config')

/**
 * Expose useful internals
 */

exports.util = _
exports.config = config
exports.nextTick = _.nextTick
exports.compiler = require('../compiler')

exports.parsers = {
  path: require('../parsers/path'),
  text: require('../parsers/text'),
  template: require('../parsers/template'),
  directive: require('../parsers/directive'),
  expression: require('../parsers/expression')
}

/**
 * Each instance constructor, including Vue, has a unique
 * cid. This enables us to create wrapped "child
 * constructors" for prototypal inheritance and cache them.
 */

exports.cid = 0
var cid = 1

/**
 * Class inheritance
 *
 * @param {Object} extendOptions
 */

exports.extend = function (extendOptions) {
  extendOptions = extendOptions || {}
  var Super = this
  var Sub = createClass(
    extendOptions.name ||
    Super.options.name ||
    'VueComponent'
  )
  Sub.prototype = Object.create(Super.prototype)
  Sub.prototype.constructor = Sub
  Sub.cid = cid++
  Sub.options = _.mergeOptions(
    Super.options,
    extendOptions
  )
  Sub['super'] = Super
  // allow further extension
  Sub.extend = Super.extend
  // create asset registers, so extended classes
  // can have their private assets too.
  config._assetTypes.forEach(function (type) {
    Sub[type] = Super[type]
  })
  return Sub
}

/**
 * A function that returns a sub-class constructor with the
 * given name. This gives us much nicer output when
 * logging instances in the console.
 *
 * @param {String} name
 * @return {Function}
 */

function createClass (name) {
  return new Function(
    'return function ' + _.classify(name) +
    ' (options) { this._init(options) }'
  )()
}

/**
 * Plugin system
 *
 * @param {Object} plugin
 */

exports.use = function (plugin) {
  // additional parameters
  var args = _.toArray(arguments, 1)
  args.unshift(this)
  if (typeof plugin.install === 'function') {
    plugin.install.apply(plugin, args)
  } else {
    plugin.apply(null, args)
  }
  return this
}

/**
 * Create asset registration methods with the following
 * signature:
 *
 * @param {String} id
 * @param {*} definition
 */

config._assetTypes.forEach(function (type) {
  exports[type] = function (id, definition) {
    if (!definition) {
      return this.options[type + 's'][id]
    } else {
      if (
        type === 'component' &&
        _.isPlainObject(definition)
      ) {
        definition.name = id
        definition = _.Vue.extend(definition)
      }
      this.options[type + 's'][id] = definition
    }
  }
})

},{"../compiler":20,"../config":22,"../parsers/directive":59,"../parsers/expression":60,"../parsers/path":61,"../parsers/template":62,"../parsers/text":63,"../util":71}],15:[function(require,module,exports){
(function (process){
var _ = require('../util')
var compiler = require('../compiler')

/**
 * Set instance target element and kick off the compilation
 * process. The passed in `el` can be a selector string, an
 * existing Element, or a DocumentFragment (for block
 * instances).
 *
 * @param {Element|DocumentFragment|string} el
 * @public
 */

exports.$mount = function (el) {
  if (this._isCompiled) {
    process.env.NODE_ENV !== 'production' && _.warn(
      '$mount() should be called only once.'
    )
    return
  }
  el = _.query(el)
  if (!el) {
    el = document.createElement('div')
  }
  this._compile(el)
  this._isCompiled = true
  this._callHook('compiled')
  this._initDOMHooks()
  if (_.inDoc(this.$el)) {
    this._callHook('attached')
    ready.call(this)
  } else {
    this.$once('hook:attached', ready)
  }
  return this
}

/**
 * Mark an instance as ready.
 */

function ready () {
  this._isAttached = true
  this._isReady = true
  this._callHook('ready')
}

/**
 * Teardown the instance, simply delegate to the internal
 * _destroy.
 */

exports.$destroy = function (remove, deferCleanup) {
  this._destroy(remove, deferCleanup)
}

/**
 * Partially compile a piece of DOM and return a
 * decompile function.
 *
 * @param {Element|DocumentFragment} el
 * @param {Vue} [host]
 * @return {Function}
 */

exports.$compile = function (el, host) {
  return compiler.compile(el, this.$options, true)(this, el, host)
}

}).call(this,require('_process'))

},{"../compiler":20,"../util":71,"_process":1}],16:[function(require,module,exports){
(function (process){
var _ = require('./util')
var config = require('./config')

// we have two separate queues: one for directive updates
// and one for user watcher registered via $watch().
// we want to guarantee directive updates to be called
// before user watchers so that when user watchers are
// triggered, the DOM would have already been in updated
// state.
var queue = []
var userQueue = []
var has = {}
var circular = {}
var waiting = false
var internalQueueDepleted = false

/**
 * Reset the batcher's state.
 */

function resetBatcherState () {
  queue = []
  userQueue = []
  has = {}
  circular = {}
  waiting = internalQueueDepleted = false
}

/**
 * Flush both queues and run the watchers.
 */

function flushBatcherQueue () {
  runBatcherQueue(queue)
  internalQueueDepleted = true
  runBatcherQueue(userQueue)
  resetBatcherState()
}

/**
 * Run the watchers in a single queue.
 *
 * @param {Array} queue
 */

function runBatcherQueue (queue) {
  // do not cache length because more watchers might be pushed
  // as we run existing watchers
  for (var i = 0; i < queue.length; i++) {
    var watcher = queue[i]
    var id = watcher.id
    has[id] = null
    watcher.run()
    // in dev build, check and stop circular updates.
    if (process.env.NODE_ENV !== 'production' && has[id] != null) {
      circular[id] = (circular[id] || 0) + 1
      if (circular[id] > config._maxUpdateCount) {
        queue.splice(has[id], 1)
        _.warn(
          'You may have an infinite update loop for watcher ' +
          'with expression: ' + watcher.expression
        )
      }
    }
  }
}

/**
 * Push a watcher into the watcher queue.
 * Jobs with duplicate IDs will be skipped unless it's
 * pushed when the queue is being flushed.
 *
 * @param {Watcher} watcher
 *   properties:
 *   - {Number} id
 *   - {Function} run
 */

exports.push = function (watcher) {
  var id = watcher.id
  if (has[id] == null) {
    // if an internal watcher is pushed, but the internal
    // queue is already depleted, we run it immediately.
    if (internalQueueDepleted && !watcher.user) {
      watcher.run()
      return
    }
    // push watcher into appropriate queue
    var q = watcher.user ? userQueue : queue
    has[id] = q.length
    q.push(watcher)
    // queue the flush
    if (!waiting) {
      waiting = true
      _.nextTick(flushBatcherQueue)
    }
  }
}

}).call(this,require('_process'))

},{"./config":22,"./util":71,"_process":1}],17:[function(require,module,exports){
/**
 * A doubly linked list-based Least Recently Used (LRU)
 * cache. Will keep most recently used items while
 * discarding least recently used items when its limit is
 * reached. This is a bare-bone version of
 * Rasmus Andersson's js-lru:
 *
 *   https://github.com/rsms/js-lru
 *
 * @param {Number} limit
 * @constructor
 */

function Cache (limit) {
  this.size = 0
  this.limit = limit
  this.head = this.tail = undefined
  this._keymap = Object.create(null)
}

var p = Cache.prototype

/**
 * Put <value> into the cache associated with <key>.
 * Returns the entry which was removed to make room for
 * the new entry. Otherwise undefined is returned.
 * (i.e. if there was enough room already).
 *
 * @param {String} key
 * @param {*} value
 * @return {Entry|undefined}
 */

p.put = function (key, value) {
  var entry = {
    key: key,
    value: value
  }
  this._keymap[key] = entry
  if (this.tail) {
    this.tail.newer = entry
    entry.older = this.tail
  } else {
    this.head = entry
  }
  this.tail = entry
  if (this.size === this.limit) {
    return this.shift()
  } else {
    this.size++
  }
}

/**
 * Purge the least recently used (oldest) entry from the
 * cache. Returns the removed entry or undefined if the
 * cache was empty.
 */

p.shift = function () {
  var entry = this.head
  if (entry) {
    this.head = this.head.newer
    this.head.older = undefined
    entry.newer = entry.older = undefined
    this._keymap[entry.key] = undefined
  }
  return entry
}

/**
 * Get and register recent use of <key>. Returns the value
 * associated with <key> or undefined if not in cache.
 *
 * @param {String} key
 * @param {Boolean} returnEntry
 * @return {Entry|*}
 */

p.get = function (key, returnEntry) {
  var entry = this._keymap[key]
  if (entry === undefined) return
  if (entry === this.tail) {
    return returnEntry
      ? entry
      : entry.value
  }
  // HEAD--------------TAIL
  //   <.older   .newer>
  //  <--- add direction --
  //   A  B  C  <D>  E
  if (entry.newer) {
    if (entry === this.head) {
      this.head = entry.newer
    }
    entry.newer.older = entry.older // C <-- E.
  }
  if (entry.older) {
    entry.older.newer = entry.newer // C. --> E
  }
  entry.newer = undefined // D --x
  entry.older = this.tail // D. --> E
  if (this.tail) {
    this.tail.newer = entry // E. <-- D
  }
  this.tail = entry
  return returnEntry
    ? entry
    : entry.value
}

module.exports = Cache

},{}],18:[function(require,module,exports){
(function (process){
var _ = require('../util')
var textParser = require('../parsers/text')
var propDef = require('../directives/prop')
var propBindingModes = require('../config')._propBindingModes

// regexes
var identRE = require('../parsers/path').identRE
var dataAttrRE = /^data-/
var settablePathRE = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*|\[[^\[\]]+\])*$/
var literalValueRE = /^(true|false)$|^\d.*/

/**
 * Compile param attributes on a root element and return
 * a props link function.
 *
 * @param {Element|DocumentFragment} el
 * @param {Array} propOptions
 * @return {Function} propsLinkFn
 */

module.exports = function compileProps (el, propOptions) {
  var props = []
  var i = propOptions.length
  var options, name, attr, value, path, prop, literal, single
  while (i--) {
    options = propOptions[i]
    name = options.name
    // props could contain dashes, which will be
    // interpreted as minus calculations by the parser
    // so we need to camelize the path here
    path = _.camelize(name.replace(dataAttrRE, ''))
    if (!identRE.test(path)) {
      process.env.NODE_ENV !== 'production' && _.warn(
        'Invalid prop key: "' + name + '". Prop keys ' +
        'must be valid identifiers.'
      )
      continue
    }
    attr = _.hyphenate(name)
    value = el.getAttribute(attr)
    if (value === null) {
      attr = 'data-' + attr
      value = el.getAttribute(attr)
    }
    // create a prop descriptor
    prop = {
      name: name,
      raw: value,
      path: path,
      options: options,
      mode: propBindingModes.ONE_WAY
    }
    if (value !== null) {
      // important so that this doesn't get compiled
      // again as a normal attribute binding
      el.removeAttribute(attr)
      var tokens = textParser.parse(value)
      if (tokens) {
        prop.dynamic = true
        prop.parentPath = textParser.tokensToExp(tokens)
        // check prop binding type.
        single = tokens.length === 1
        literal = literalValueRE.test(prop.parentPath)
        // one time: {{* prop}}
        if (literal || (single && tokens[0].oneTime)) {
          prop.mode = propBindingModes.ONE_TIME
        } else if (
          !literal &&
          (single && tokens[0].twoWay)
        ) {
          if (settablePathRE.test(prop.parentPath)) {
            prop.mode = propBindingModes.TWO_WAY
          } else {
            process.env.NODE_ENV !== 'production' && _.warn(
              'Cannot bind two-way prop with non-settable ' +
              'parent path: ' + prop.parentPath
            )
          }
        }
        if (
          process.env.NODE_ENV !== 'production' &&
          options.twoWay &&
          prop.mode !== propBindingModes.TWO_WAY
        ) {
          _.warn(
            'Prop "' + name + '" expects a two-way binding type.'
          )
        }
      }
    } else if (options && options.required) {
      process.env.NODE_ENV !== 'production' && _.warn(
        'Missing required prop: ' + name
      )
    }
    props.push(prop)
  }
  return makePropsLinkFn(props)
}

/**
 * Build a function that applies props to a vm.
 *
 * @param {Array} props
 * @return {Function} propsLinkFn
 */

function makePropsLinkFn (props) {
  return function propsLinkFn (vm, el) {
    // store resolved props info
    vm._props = {}
    var i = props.length
    var prop, path, options, value
    while (i--) {
      prop = props[i]
      path = prop.path
      vm._props[path] = prop
      options = prop.options
      if (prop.raw === null) {
        // initialize absent prop
        _.initProp(vm, prop, getDefault(options))
      } else if (prop.dynamic) {
        // dynamic prop
        if (vm._context) {
          if (prop.mode === propBindingModes.ONE_TIME) {
            // one time binding
            value = vm._context.$get(prop.parentPath)
            _.initProp(vm, prop, value)
          } else {
            // dynamic binding
            vm._bindDir('prop', el, prop, propDef)
          }
        } else {
          process.env.NODE_ENV !== 'production' && _.warn(
            'Cannot bind dynamic prop on a root instance' +
            ' with no parent: ' + prop.name + '="' +
            prop.raw + '"'
          )
        }
      } else {
        // literal, cast it and just set once
        var raw = prop.raw
        value = options.type === Boolean && raw === ''
          ? true
          // do not cast emptry string.
          // _.toNumber casts empty string to 0.
          : raw.trim()
            ? _.toBoolean(_.toNumber(raw))
            : raw
        _.initProp(vm, prop, value)
      }
    }
  }
}

/**
 * Get the default value of a prop.
 *
 * @param {Object} options
 * @return {*}
 */

function getDefault (options) {
  // no default, return undefined
  if (!options.hasOwnProperty('default')) {
    // absent boolean value defaults to false
    return options.type === Boolean
      ? false
      : undefined
  }
  var def = options.default
  // warn against non-factory defaults for Object & Array
  if (_.isObject(def)) {
    process.env.NODE_ENV !== 'production' && _.warn(
      'Object/Array as default prop values will be shared ' +
      'across multiple instances. Use a factory function ' +
      'to return the default value instead.'
    )
  }
  // call factory function for non-Function types
  return typeof def === 'function' && options.type !== Function
    ? def()
    : def
}

}).call(this,require('_process'))

},{"../config":22,"../directives/prop":38,"../parsers/path":61,"../parsers/text":63,"../util":71,"_process":1}],19:[function(require,module,exports){
(function (process){
var _ = require('../util')
var compileProps = require('./compile-props')
var config = require('../config')
var textParser = require('../parsers/text')
var dirParser = require('../parsers/directive')
var templateParser = require('../parsers/template')
var resolveAsset = _.resolveAsset
var componentDef = require('../directives/component')

// terminal directives
var terminalDirectives = [
  'repeat',
  'if'
]

/**
 * Compile a template and return a reusable composite link
 * function, which recursively contains more link functions
 * inside. This top level compile function would normally
 * be called on instance root nodes, but can also be used
 * for partial compilation if the partial argument is true.
 *
 * The returned composite link function, when called, will
 * return an unlink function that tearsdown all directives
 * created during the linking phase.
 *
 * @param {Element|DocumentFragment} el
 * @param {Object} options
 * @param {Boolean} partial
 * @return {Function}
 */

exports.compile = function (el, options, partial) {
  // link function for the node itself.
  var nodeLinkFn = partial || !options._asComponent
    ? compileNode(el, options)
    : null
  // link function for the childNodes
  var childLinkFn =
    !(nodeLinkFn && nodeLinkFn.terminal) &&
    el.tagName !== 'SCRIPT' &&
    el.hasChildNodes()
      ? compileNodeList(el.childNodes, options)
      : null

  /**
   * A composite linker function to be called on a already
   * compiled piece of DOM, which instantiates all directive
   * instances.
   *
   * @param {Vue} vm
   * @param {Element|DocumentFragment} el
   * @param {Vue} [host] - host vm of transcluded content
   * @return {Function|undefined}
   */

  return function compositeLinkFn (vm, el, host) {
    // cache childNodes before linking parent, fix #657
    var childNodes = _.toArray(el.childNodes)
    // link
    var dirs = linkAndCapture(function () {
      if (nodeLinkFn) nodeLinkFn(vm, el, host)
      if (childLinkFn) childLinkFn(vm, childNodes, host)
    }, vm)
    return makeUnlinkFn(vm, dirs)
  }
}

/**
 * Apply a linker to a vm/element pair and capture the
 * directives created during the process.
 *
 * @param {Function} linker
 * @param {Vue} vm
 */

function linkAndCapture (linker, vm) {
  var originalDirCount = vm._directives.length
  linker()
  return vm._directives.slice(originalDirCount)
}

/**
 * Linker functions return an unlink function that
 * tearsdown all directives instances generated during
 * the process.
 *
 * We create unlink functions with only the necessary
 * information to avoid retaining additional closures.
 *
 * @param {Vue} vm
 * @param {Array} dirs
 * @param {Vue} [context]
 * @param {Array} [contextDirs]
 * @return {Function}
 */

function makeUnlinkFn (vm, dirs, context, contextDirs) {
  return function unlink (destroying) {
    teardownDirs(vm, dirs, destroying)
    if (context && contextDirs) {
      teardownDirs(context, contextDirs)
    }
  }
}

/**
 * Teardown partial linked directives.
 *
 * @param {Vue} vm
 * @param {Array} dirs
 * @param {Boolean} destroying
 */

function teardownDirs (vm, dirs, destroying) {
  var i = dirs.length
  while (i--) {
    dirs[i]._teardown()
    if (!destroying) {
      vm._directives.$remove(dirs[i])
    }
  }
}

/**
 * Compile link props on an instance.
 *
 * @param {Vue} vm
 * @param {Element} el
 * @param {Object} options
 * @return {Function}
 */

exports.compileAndLinkProps = function (vm, el, props) {
  var propsLinkFn = compileProps(el, props)
  var propDirs = linkAndCapture(function () {
    propsLinkFn(vm, null)
  }, vm)
  return makeUnlinkFn(vm, propDirs)
}

/**
 * Compile the root element of an instance.
 *
 * 1. attrs on context container (context scope)
 * 2. attrs on the component template root node, if
 *    replace:true (child scope)
 *
 * If this is a fragment instance, we only need to compile 1.
 *
 * @param {Vue} vm
 * @param {Element} el
 * @param {Object} options
 * @return {Function}
 */

exports.compileRoot = function (el, options) {
  var containerAttrs = options._containerAttrs
  var replacerAttrs = options._replacerAttrs
  var contextLinkFn, replacerLinkFn

  // only need to compile other attributes for
  // non-fragment instances
  if (el.nodeType !== 11) {
    // for components, container and replacer need to be
    // compiled separately and linked in different scopes.
    if (options._asComponent) {
      // 2. container attributes
      if (containerAttrs) {
        contextLinkFn = compileDirectives(containerAttrs, options)
      }
      if (replacerAttrs) {
        // 3. replacer attributes
        replacerLinkFn = compileDirectives(replacerAttrs, options)
      }
    } else {
      // non-component, just compile as a normal element.
      replacerLinkFn = compileDirectives(el.attributes, options)
    }
  }

  return function rootLinkFn (vm, el) {
    // link context scope dirs
    var context = vm._context
    var contextDirs
    if (context && contextLinkFn) {
      contextDirs = linkAndCapture(function () {
        contextLinkFn(context, el)
      }, context)
    }

    // link self
    var selfDirs = linkAndCapture(function () {
      if (replacerLinkFn) replacerLinkFn(vm, el)
    }, vm)

    // return the unlink function that tearsdown context
    // container directives.
    return makeUnlinkFn(vm, selfDirs, context, contextDirs)
  }
}

/**
 * Compile a node and return a nodeLinkFn based on the
 * node type.
 *
 * @param {Node} node
 * @param {Object} options
 * @return {Function|null}
 */

function compileNode (node, options) {
  var type = node.nodeType
  if (type === 1 && node.tagName !== 'SCRIPT') {
    return compileElement(node, options)
  } else if (type === 3 && config.interpolate && node.data.trim()) {
    return compileTextNode(node, options)
  } else {
    return null
  }
}

/**
 * Compile an element and return a nodeLinkFn.
 *
 * @param {Element} el
 * @param {Object} options
 * @return {Function|null}
 */

function compileElement (el, options) {
  // preprocess textareas.
  // textarea treats its text content as the initial value.
  // just bind it as a v-attr directive for value.
  if (el.tagName === 'TEXTAREA') {
    if (textParser.parse(el.value)) {
      el.setAttribute('value', el.value)
    }
  }
  var linkFn
  var hasAttrs = el.hasAttributes()
  // check terminal directives (repeat & if)
  if (hasAttrs) {
    linkFn = checkTerminalDirectives(el, options)
  }
  // check element directives
  if (!linkFn) {
    linkFn = checkElementDirectives(el, options)
  }
  // check component
  if (!linkFn) {
    linkFn = checkComponent(el, options)
  }
  // normal directives
  if (!linkFn && hasAttrs) {
    linkFn = compileDirectives(el.attributes, options)
  }
  return linkFn
}

/**
 * Compile a textNode and return a nodeLinkFn.
 *
 * @param {TextNode} node
 * @param {Object} options
 * @return {Function|null} textNodeLinkFn
 */

function compileTextNode (node, options) {
  var tokens = textParser.parse(node.data)
  if (!tokens) {
    return null
  }
  var frag = document.createDocumentFragment()
  var el, token
  for (var i = 0, l = tokens.length; i < l; i++) {
    token = tokens[i]
    el = token.tag
      ? processTextToken(token, options)
      : document.createTextNode(token.value)
    frag.appendChild(el)
  }
  return makeTextNodeLinkFn(tokens, frag, options)
}

/**
 * Process a single text token.
 *
 * @param {Object} token
 * @param {Object} options
 * @return {Node}
 */

function processTextToken (token, options) {
  var el
  if (token.oneTime) {
    el = document.createTextNode(token.value)
  } else {
    if (token.html) {
      el = document.createComment('v-html')
      setTokenType('html')
    } else {
      // IE will clean up empty textNodes during
      // frag.cloneNode(true), so we have to give it
      // something here...
      el = document.createTextNode(' ')
      setTokenType('text')
    }
  }
  function setTokenType (type) {
    token.type = type
    token.def = resolveAsset(options, 'directives', type)
    token.descriptor = dirParser.parse(token.value)[0]
  }
  return el
}

/**
 * Build a function that processes a textNode.
 *
 * @param {Array<Object>} tokens
 * @param {DocumentFragment} frag
 */

function makeTextNodeLinkFn (tokens, frag) {
  return function textNodeLinkFn (vm, el) {
    var fragClone = frag.cloneNode(true)
    var childNodes = _.toArray(fragClone.childNodes)
    var token, value, node
    for (var i = 0, l = tokens.length; i < l; i++) {
      token = tokens[i]
      value = token.value
      if (token.tag) {
        node = childNodes[i]
        if (token.oneTime) {
          value = vm.$eval(value)
          if (token.html) {
            _.replace(node, templateParser.parse(value, true))
          } else {
            node.data = value
          }
        } else {
          vm._bindDir(token.type, node,
                      token.descriptor, token.def)
        }
      }
    }
    _.replace(el, fragClone)
  }
}

/**
 * Compile a node list and return a childLinkFn.
 *
 * @param {NodeList} nodeList
 * @param {Object} options
 * @return {Function|undefined}
 */

function compileNodeList (nodeList, options) {
  var linkFns = []
  var nodeLinkFn, childLinkFn, node
  for (var i = 0, l = nodeList.length; i < l; i++) {
    node = nodeList[i]
    nodeLinkFn = compileNode(node, options)
    childLinkFn =
      !(nodeLinkFn && nodeLinkFn.terminal) &&
      node.tagName !== 'SCRIPT' &&
      node.hasChildNodes()
        ? compileNodeList(node.childNodes, options)
        : null
    linkFns.push(nodeLinkFn, childLinkFn)
  }
  return linkFns.length
    ? makeChildLinkFn(linkFns)
    : null
}

/**
 * Make a child link function for a node's childNodes.
 *
 * @param {Array<Function>} linkFns
 * @return {Function} childLinkFn
 */

function makeChildLinkFn (linkFns) {
  return function childLinkFn (vm, nodes, host) {
    var node, nodeLinkFn, childrenLinkFn
    for (var i = 0, n = 0, l = linkFns.length; i < l; n++) {
      node = nodes[n]
      nodeLinkFn = linkFns[i++]
      childrenLinkFn = linkFns[i++]
      // cache childNodes before linking parent, fix #657
      var childNodes = _.toArray(node.childNodes)
      if (nodeLinkFn) {
        nodeLinkFn(vm, node, host)
      }
      if (childrenLinkFn) {
        childrenLinkFn(vm, childNodes, host)
      }
    }
  }
}

/**
 * Check for element directives (custom elements that should
 * be resovled as terminal directives).
 *
 * @param {Element} el
 * @param {Object} options
 */

function checkElementDirectives (el, options) {
  var tag = el.tagName.toLowerCase()
  if (_.commonTagRE.test(tag)) return
  var def = resolveAsset(options, 'elementDirectives', tag)
  if (def) {
    return makeTerminalNodeLinkFn(el, tag, '', options, def)
  }
}

/**
 * Check if an element is a component. If yes, return
 * a component link function.
 *
 * @param {Element} el
 * @param {Object} options
 * @param {Boolean} hasAttrs
 * @return {Function|undefined}
 */

function checkComponent (el, options, hasAttrs) {
  var componentId = _.checkComponent(el, options, hasAttrs)
  if (componentId) {
    var componentLinkFn = function (vm, el, host) {
      vm._bindDir('component', el, {
        expression: componentId
      }, componentDef, host)
    }
    componentLinkFn.terminal = true
    return componentLinkFn
  }
}

/**
 * Check an element for terminal directives in fixed order.
 * If it finds one, return a terminal link function.
 *
 * @param {Element} el
 * @param {Object} options
 * @return {Function} terminalLinkFn
 */

function checkTerminalDirectives (el, options) {
  if (_.attr(el, 'pre') !== null) {
    return skip
  }
  var value, dirName
  for (var i = 0, l = terminalDirectives.length; i < l; i++) {
    dirName = terminalDirectives[i]
    if ((value = _.attr(el, dirName)) !== null) {
      return makeTerminalNodeLinkFn(el, dirName, value, options)
    }
  }
}

function skip () {}
skip.terminal = true

/**
 * Build a node link function for a terminal directive.
 * A terminal link function terminates the current
 * compilation recursion and handles compilation of the
 * subtree in the directive.
 *
 * @param {Element} el
 * @param {String} dirName
 * @param {String} value
 * @param {Object} options
 * @param {Object} [def]
 * @return {Function} terminalLinkFn
 */

function makeTerminalNodeLinkFn (el, dirName, value, options, def) {
  var descriptor = dirParser.parse(value)[0]
  // no need to call resolveAsset since terminal directives
  // are always internal
  def = def || options.directives[dirName]
  var fn = function terminalNodeLinkFn (vm, el, host) {
    vm._bindDir(dirName, el, descriptor, def, host)
  }
  fn.terminal = true
  return fn
}

/**
 * Compile the directives on an element and return a linker.
 *
 * @param {Array|NamedNodeMap} attrs
 * @param {Object} options
 * @return {Function}
 */

function compileDirectives (attrs, options) {
  var i = attrs.length
  var dirs = []
  var attr, name, value, dir, dirName, dirDef
  while (i--) {
    attr = attrs[i]
    name = attr.name
    value = attr.value
    if (name.indexOf(config.prefix) === 0) {
      dirName = name.slice(config.prefix.length)
      dirDef = resolveAsset(options, 'directives', dirName)
      if (process.env.NODE_ENV !== 'production') {
        _.assertAsset(dirDef, 'directive', dirName)
      }
      if (dirDef) {
        dirs.push({
          name: dirName,
          descriptors: dirParser.parse(value),
          def: dirDef
        })
      }
    } else if (config.interpolate) {
      dir = collectAttrDirective(name, value, options)
      if (dir) {
        dirs.push(dir)
      }
    }
  }
  // sort by priority, LOW to HIGH
  if (dirs.length) {
    dirs.sort(directiveComparator)
    return makeNodeLinkFn(dirs)
  }
}

/**
 * Build a link function for all directives on a single node.
 *
 * @param {Array} directives
 * @return {Function} directivesLinkFn
 */

function makeNodeLinkFn (directives) {
  return function nodeLinkFn (vm, el, host) {
    // reverse apply because it's sorted low to high
    var i = directives.length
    var dir, j, k
    while (i--) {
      dir = directives[i]
      if (dir._link) {
        // custom link fn
        dir._link(vm, el)
      } else {
        k = dir.descriptors.length
        for (j = 0; j < k; j++) {
          vm._bindDir(dir.name, el,
            dir.descriptors[j], dir.def, host)
        }
      }
    }
  }
}

/**
 * Check an attribute for potential dynamic bindings,
 * and return a directive object.
 *
 * Special case: class interpolations are translated into
 * v-class instead v-attr, so that it can work with user
 * provided v-class bindings.
 *
 * @param {String} name
 * @param {String} value
 * @param {Object} options
 * @return {Object}
 */

function collectAttrDirective (name, value, options) {
  var tokens = textParser.parse(value)
  var isClass = name === 'class'
  if (tokens) {
    var dirName = isClass ? 'class' : 'attr'
    var def = options.directives[dirName]
    var i = tokens.length
    var allOneTime = true
    while (i--) {
      var token = tokens[i]
      if (token.tag && !token.oneTime) {
        allOneTime = false
      }
    }
    return {
      def: def,
      _link: allOneTime
        ? function (vm, el) {
            el.setAttribute(name, vm.$interpolate(value))
          }
        : function (vm, el) {
            var exp = textParser.tokensToExp(tokens, vm)
            var desc = isClass
              ? dirParser.parse(exp)[0]
              : dirParser.parse(name + ':' + exp)[0]
            if (isClass) {
              desc._rawClass = value
            }
            vm._bindDir(dirName, el, desc, def)
          }
    }
  }
}

/**
 * Directive priority sort comparator
 *
 * @param {Object} a
 * @param {Object} b
 */

function directiveComparator (a, b) {
  a = a.def.priority || 0
  b = b.def.priority || 0
  return a > b ? 1 : -1
}

}).call(this,require('_process'))

},{"../config":22,"../directives/component":27,"../parsers/directive":59,"../parsers/template":62,"../parsers/text":63,"../util":71,"./compile-props":18,"_process":1}],20:[function(require,module,exports){
var _ = require('../util')

_.extend(exports, require('./compile'))
_.extend(exports, require('./transclude'))

},{"../util":71,"./compile":19,"./transclude":21}],21:[function(require,module,exports){
(function (process){
var _ = require('../util')
var config = require('../config')
var templateParser = require('../parsers/template')

/**
 * Process an element or a DocumentFragment based on a
 * instance option object. This allows us to transclude
 * a template node/fragment before the instance is created,
 * so the processed fragment can then be cloned and reused
 * in v-repeat.
 *
 * @param {Element} el
 * @param {Object} options
 * @return {Element|DocumentFragment}
 */

exports.transclude = function (el, options) {
  // extract container attributes to pass them down
  // to compiler, because they need to be compiled in
  // parent scope. we are mutating the options object here
  // assuming the same object will be used for compile
  // right after this.
  if (options) {
    options._containerAttrs = extractAttrs(el)
  }
  // for template tags, what we want is its content as
  // a documentFragment (for fragment instances)
  if (_.isTemplate(el)) {
    el = templateParser.parse(el)
  }
  if (options) {
    if (options._asComponent && !options.template) {
      options.template = '<content></content>'
    }
    if (options.template) {
      options._content = _.extractContent(el)
      el = transcludeTemplate(el, options)
    }
  }
  if (el instanceof DocumentFragment) {
    // anchors for fragment instance
    // passing in `persist: true` to avoid them being
    // discarded by IE during template cloning
    _.prepend(_.createAnchor('v-start', true), el)
    el.appendChild(_.createAnchor('v-end', true))
  }
  return el
}

/**
 * Process the template option.
 * If the replace option is true this will swap the $el.
 *
 * @param {Element} el
 * @param {Object} options
 * @return {Element|DocumentFragment}
 */

function transcludeTemplate (el, options) {
  var template = options.template
  var frag = templateParser.parse(template, true)
  if (frag) {
    var replacer = frag.firstChild
    var tag = replacer.tagName && replacer.tagName.toLowerCase()
    if (options.replace) {
      /* istanbul ignore if */
      if (el === document.body) {
        process.env.NODE_ENV !== 'production' && _.warn(
          'You are mounting an instance with a template to ' +
          '<body>. This will replace <body> entirely. You ' +
          'should probably use `replace: false` here.'
        )
      }
      // there are many cases where the instance must
      // become a fragment instance: basically anything that
      // can create more than 1 root nodes.
      if (
        // multi-children template
        frag.childNodes.length > 1 ||
        // non-element template
        replacer.nodeType !== 1 ||
        // single nested component
        tag === 'component' ||
        _.resolveAsset(options, 'components', tag) ||
        replacer.hasAttribute(config.prefix + 'component') ||
        // element directive
        _.resolveAsset(options, 'elementDirectives', tag) ||
        // repeat block
        replacer.hasAttribute(config.prefix + 'repeat')
      ) {
        return frag
      } else {
        options._replacerAttrs = extractAttrs(replacer)
        mergeAttrs(el, replacer)
        return replacer
      }
    } else {
      el.appendChild(frag)
      return el
    }
  } else {
    process.env.NODE_ENV !== 'production' && _.warn(
      'Invalid template option: ' + template
    )
  }
}

/**
 * Helper to extract a component container's attributes
 * into a plain object array.
 *
 * @param {Element} el
 * @return {Array}
 */

function extractAttrs (el) {
  if (el.nodeType === 1 && el.hasAttributes()) {
    return _.toArray(el.attributes)
  }
}

/**
 * Merge the attributes of two elements, and make sure
 * the class names are merged properly.
 *
 * @param {Element} from
 * @param {Element} to
 */

function mergeAttrs (from, to) {
  var attrs = from.attributes
  var i = attrs.length
  var name, value
  while (i--) {
    name = attrs[i].name
    value = attrs[i].value
    if (!to.hasAttribute(name)) {
      to.setAttribute(name, value)
    } else if (name === 'class') {
      value = to.getAttribute(name) + ' ' + value
      to.setAttribute(name, value)
    }
  }
}

}).call(this,require('_process'))

},{"../config":22,"../parsers/template":62,"../util":71,"_process":1}],22:[function(require,module,exports){
module.exports = {

  /**
   * The prefix to look for when parsing directives.
   *
   * @type {String}
   */

  prefix: 'v-',

  /**
   * Whether to print debug messages.
   * Also enables stack trace for warnings.
   *
   * @type {Boolean}
   */

  debug: false,

  /**
   * Strict mode.
   * Disables asset lookup in the view parent chain.
   */

  strict: false,

  /**
   * Whether to suppress warnings.
   *
   * @type {Boolean}
   */

  silent: false,

  /**
   * Whether allow observer to alter data objects'
   * __proto__.
   *
   * @type {Boolean}
   */

  proto: true,

  /**
   * Whether to parse mustache tags in templates.
   *
   * @type {Boolean}
   */

  interpolate: true,

  /**
   * Whether to use async rendering.
   */

  async: true,

  /**
   * Whether to warn against errors caught when evaluating
   * expressions.
   */

  warnExpressionErrors: true,

  /**
   * Internal flag to indicate the delimiters have been
   * changed.
   *
   * @type {Boolean}
   */

  _delimitersChanged: true,

  /**
   * List of asset types that a component can own.
   *
   * @type {Array}
   */

  _assetTypes: [
    'component',
    'directive',
    'elementDirective',
    'filter',
    'transition',
    'partial'
  ],

  /**
   * prop binding modes
   */

  _propBindingModes: {
    ONE_WAY: 0,
    TWO_WAY: 1,
    ONE_TIME: 2
  },

  /**
   * Max circular updates allowed in a batcher flush cycle.
   */

  _maxUpdateCount: 100

}

/**
 * Interpolation delimiters.
 * We need to mark the changed flag so that the text parser
 * knows it needs to recompile the regex.
 *
 * @type {Array<String>}
 */

var delimiters = ['{{', '}}']
Object.defineProperty(module.exports, 'delimiters', {
  get: function () {
    return delimiters
  },
  set: function (val) {
    delimiters = val
    this._delimitersChanged = true
  }
})

},{}],23:[function(require,module,exports){
(function (process){
var _ = require('./util')
var config = require('./config')
var Watcher = require('./watcher')
var textParser = require('./parsers/text')
var expParser = require('./parsers/expression')

/**
 * A directive links a DOM element with a piece of data,
 * which is the result of evaluating an expression.
 * It registers a watcher with the expression and calls
 * the DOM update function when a change is triggered.
 *
 * @param {String} name
 * @param {Node} el
 * @param {Vue} vm
 * @param {Object} descriptor
 *                 - {String} expression
 *                 - {String} [arg]
 *                 - {Array<Object>} [filters]
 * @param {Object} def - directive definition object
 * @param {Vue|undefined} host - transclusion host target
 * @constructor
 */

function Directive (name, el, vm, descriptor, def, host) {
  // public
  this.name = name
  this.el = el
  this.vm = vm
  // copy descriptor props
  this.raw = descriptor.raw
  this.expression = descriptor.expression
  this.arg = descriptor.arg
  this.filters = descriptor.filters
  // private
  this._descriptor = descriptor
  this._host = host
  this._locked = false
  this._bound = false
  this._listeners = null
  // init
  this._bind(def)
}

/**
 * Initialize the directive, mixin definition properties,
 * setup the watcher, call definition bind() and update()
 * if present.
 *
 * @param {Object} def
 */

Directive.prototype._bind = function (def) {
  if (
    (this.name !== 'cloak' || this.vm._isCompiled) &&
    this.el && this.el.removeAttribute
  ) {
    this.el.removeAttribute(config.prefix + this.name)
  }
  if (typeof def === 'function') {
    this.update = def
  } else {
    _.extend(this, def)
  }
  this._watcherExp = this.expression
  this._checkDynamicLiteral()
  if (this.bind) {
    this.bind()
  }
  if (this._watcherExp &&
      (this.update || this.twoWay) &&
      (!this.isLiteral || this._isDynamicLiteral) &&
      !this._checkStatement()) {
    // wrapped updater for context
    var dir = this
    var update = this._update = this.update
      ? function (val, oldVal) {
          if (!dir._locked) {
            dir.update(val, oldVal)
          }
        }
      : function () {} // noop if no update is provided
    // pre-process hook called before the value is piped
    // through the filters. used in v-repeat.
    var preProcess = this._preProcess
      ? _.bind(this._preProcess, this)
      : null
    var watcher = this._watcher = new Watcher(
      this.vm,
      this._watcherExp,
      update, // callback
      {
        filters: this.filters,
        twoWay: this.twoWay,
        deep: this.deep,
        preProcess: preProcess
      }
    )
    if (this._initValue != null) {
      watcher.set(this._initValue)
    } else if (this.update) {
      this.update(watcher.value)
    }
  }
  this._bound = true
}

/**
 * check if this is a dynamic literal binding.
 *
 * e.g. v-component="{{currentView}}"
 */

Directive.prototype._checkDynamicLiteral = function () {
  var expression = this.expression
  if (expression && this.isLiteral) {
    var tokens = textParser.parse(expression)
    if (tokens) {
      var exp = textParser.tokensToExp(tokens)
      this.expression = this.vm.$get(exp)
      this._watcherExp = exp
      this._isDynamicLiteral = true
    }
  }
}

/**
 * Check if the directive is a function caller
 * and if the expression is a callable one. If both true,
 * we wrap up the expression and use it as the event
 * handler.
 *
 * e.g. v-on="click: a++"
 *
 * @return {Boolean}
 */

Directive.prototype._checkStatement = function () {
  var expression = this.expression
  if (
    expression && this.acceptStatement &&
    !expParser.isSimplePath(expression)
  ) {
    var fn = expParser.parse(expression).get
    var vm = this.vm
    var handler = function () {
      fn.call(vm, vm)
    }
    if (this.filters) {
      handler = vm._applyFilters(handler, null, this.filters)
    }
    this.update(handler)
    return true
  }
}

/**
 * Check for an attribute directive param, e.g. lazy
 *
 * @param {String} name
 * @return {String}
 */

Directive.prototype._checkParam = function (name) {
  var param = this.el.getAttribute(name)
  if (param !== null) {
    this.el.removeAttribute(name)
    param = this.vm.$interpolate(param)
  }
  return param
}

/**
 * Set the corresponding value with the setter.
 * This should only be used in two-way directives
 * e.g. v-model.
 *
 * @param {*} value
 * @public
 */

Directive.prototype.set = function (value) {
  /* istanbul ignore else */
  if (this.twoWay) {
    this._withLock(function () {
      this._watcher.set(value)
    })
  } else if (process.env.NODE_ENV !== 'production') {
    _.warn(
      'Directive.set() can only be used inside twoWay' +
      'directives.'
    )
  }
}

/**
 * Execute a function while preventing that function from
 * triggering updates on this directive instance.
 *
 * @param {Function} fn
 */

Directive.prototype._withLock = function (fn) {
  var self = this
  self._locked = true
  fn.call(self)
  _.nextTick(function () {
    self._locked = false
  })
}

/**
 * Convenience method that attaches a DOM event listener
 * to the directive element and autometically tears it down
 * during unbind.
 *
 * @param {String} event
 * @param {Function} handler
 */

Directive.prototype.on = function (event, handler) {
  _.on(this.el, event, handler)
  ;(this._listeners || (this._listeners = []))
    .push([event, handler])
}

/**
 * Teardown the watcher and call unbind.
 */

Directive.prototype._teardown = function () {
  if (this._bound) {
    this._bound = false
    if (this.unbind) {
      this.unbind()
    }
    if (this._watcher) {
      this._watcher.teardown()
    }
    var listeners = this._listeners
    if (listeners) {
      for (var i = 0; i < listeners.length; i++) {
        _.off(this.el, listeners[i][0], listeners[i][1])
      }
    }
    this.vm = this.el =
    this._watcher = this._listeners = null
  }
}

module.exports = Directive

}).call(this,require('_process'))

},{"./config":22,"./parsers/expression":60,"./parsers/text":63,"./util":71,"./watcher":75,"_process":1}],24:[function(require,module,exports){
// xlink
var xlinkNS = 'http://www.w3.org/1999/xlink'
var xlinkRE = /^xlink:/
var inputProps = {
  value: 1,
  checked: 1,
  selected: 1
}

module.exports = {

  priority: 850,

  update: function (value) {
    if (this.arg) {
      this.setAttr(this.arg, value)
    } else if (typeof value === 'object') {
      this.objectHandler(value)
    }
  },

  objectHandler: function (value) {
    // cache object attrs so that only changed attrs
    // are actually updated.
    var cache = this.cache || (this.cache = {})
    var attr, val
    for (attr in cache) {
      if (!(attr in value)) {
        this.setAttr(attr, null)
        delete cache[attr]
      }
    }
    for (attr in value) {
      val = value[attr]
      if (val !== cache[attr]) {
        cache[attr] = val
        this.setAttr(attr, val)
      }
    }
  },

  setAttr: function (attr, value) {
    if (inputProps[attr] && attr in this.el) {
      if (!this.valueRemoved) {
        this.el.removeAttribute(attr)
        this.valueRemoved = true
      }
      this.el[attr] = value
    } else if (value != null && value !== false) {
      if (xlinkRE.test(attr)) {
        this.el.setAttributeNS(xlinkNS, attr, value)
      } else {
        this.el.setAttribute(attr, value)
      }
    } else {
      this.el.removeAttribute(attr)
    }
  }
}

},{}],25:[function(require,module,exports){
var _ = require('../util')
var addClass = _.addClass
var removeClass = _.removeClass

module.exports = {

  bind: function () {
    // interpolations like class="{{abc}}" are converted
    // to v-class, and we need to remove the raw,
    // uninterpolated className at binding time.
    var raw = this._descriptor._rawClass
    if (raw) {
      this.prevKeys = raw.trim().split(/\s+/)
    }
  },

  update: function (value) {
    if (this.arg) {
      // single toggle
      if (value) {
        addClass(this.el, this.arg)
      } else {
        removeClass(this.el, this.arg)
      }
    } else {
      if (value && typeof value === 'string') {
        this.handleObject(stringToObject(value))
      } else if (_.isPlainObject(value)) {
        this.handleObject(value)
      } else {
        this.cleanup()
      }
    }
  },

  handleObject: function (value) {
    this.cleanup(value)
    var keys = this.prevKeys = Object.keys(value)
    for (var i = 0, l = keys.length; i < l; i++) {
      var key = keys[i]
      if (value[key]) {
        addClass(this.el, key)
      } else {
        removeClass(this.el, key)
      }
    }
  },

  cleanup: function (value) {
    if (this.prevKeys) {
      var i = this.prevKeys.length
      while (i--) {
        var key = this.prevKeys[i]
        if (!value || !value.hasOwnProperty(key)) {
          removeClass(this.el, key)
        }
      }
    }
  }
}

function stringToObject (value) {
  var res = {}
  var keys = value.trim().split(/\s+/)
  var i = keys.length
  while (i--) {
    res[keys[i]] = true
  }
  return res
}

},{"../util":71}],26:[function(require,module,exports){
var config = require('../config')

module.exports = {
  bind: function () {
    var el = this.el
    this.vm.$once('hook:compiled', function () {
      el.removeAttribute(config.prefix + 'cloak')
    })
  }
}

},{"../config":22}],27:[function(require,module,exports){
(function (process){
var _ = require('../util')
var config = require('../config')
var templateParser = require('../parsers/template')

module.exports = {

  isLiteral: true,

  /**
   * Setup. Two possible usages:
   *
   * - static:
   *   v-component="comp"
   *
   * - dynamic:
   *   v-component="{{currentView}}"
   */

  bind: function () {
    if (!this.el.__vue__) {
      // create a ref anchor
      this.anchor = _.createAnchor('v-component')
      _.replace(this.el, this.anchor)
      // check keep-alive options.
      // If yes, instead of destroying the active vm when
      // hiding (v-if) or switching (dynamic literal) it,
      // we simply remove it from the DOM and save it in a
      // cache object, with its constructor id as the key.
      this.keepAlive = this._checkParam('keep-alive') != null
      // wait for event before insertion
      this.waitForEvent = this._checkParam('wait-for')
      // check ref
      this.refID = this._checkParam(config.prefix + 'ref')
      if (this.keepAlive) {
        this.cache = {}
      }
      // check inline-template
      if (this._checkParam('inline-template') !== null) {
        // extract inline template as a DocumentFragment
        this.template = _.extractContent(this.el, true)
      }
      // component resolution related state
      this.pendingComponentCb =
      this.Component = null
      // transition related state
      this.pendingRemovals = 0
      this.pendingRemovalCb = null
      // if static, build right now.
      if (!this._isDynamicLiteral) {
        this.resolveComponent(this.expression, _.bind(this.initStatic, this))
      } else {
        // check dynamic component params
        this.transMode = this._checkParam('transition-mode')
      }
    } else {
      process.env.NODE_ENV !== 'production' && _.warn(
        'cannot mount component "' + this.expression + '" ' +
        'on already mounted element: ' + this.el
      )
    }
  },

  /**
   * Initialize a static component.
   */

  initStatic: function () {
    // wait-for
    var anchor = this.anchor
    var options
    var waitFor = this.waitForEvent
    if (waitFor) {
      options = {
        created: function () {
          this.$once(waitFor, function () {
            this.$before(anchor)
          })
        }
      }
    }
    var child = this.build(options)
    this.setCurrent(child)
    if (!this.waitForEvent) {
      child.$before(anchor)
    }
  },

  /**
   * Public update, called by the watcher in the dynamic
   * literal scenario, e.g. v-component="{{view}}"
   */

  update: function (value) {
    this.setComponent(value)
  },

  /**
   * Switch dynamic components. May resolve the component
   * asynchronously, and perform transition based on
   * specified transition mode. Accepts a few additional
   * arguments specifically for vue-router.
   *
   * The callback is called when the full transition is
   * finished.
   *
   * @param {String} value
   * @param {Function} [cb]
   */

  setComponent: function (value, cb) {
    this.invalidatePending()
    if (!value) {
      // just remove current
      this.unbuild(true)
      this.remove(this.childVM, cb)
      this.unsetCurrent()
    } else {
      this.resolveComponent(value, _.bind(function () {
        this.unbuild(true)
        var options
        var self = this
        var waitFor = this.waitForEvent
        if (waitFor) {
          options = {
            created: function () {
              this.$once(waitFor, function () {
                self.waitingFor = null
                self.transition(this, cb)
              })
            }
          }
        }
        var cached = this.getCached()
        var newComponent = this.build(options)
        if (!waitFor || cached) {
          this.transition(newComponent, cb)
        } else {
          this.waitingFor = newComponent
        }
      }, this))
    }
  },

  /**
   * Resolve the component constructor to use when creating
   * the child vm.
   */

  resolveComponent: function (id, cb) {
    var self = this
    this.pendingComponentCb = _.cancellable(function (Component) {
      self.Component = Component
      cb()
    })
    this.vm._resolveComponent(id, this.pendingComponentCb)
  },

  /**
   * When the component changes or unbinds before an async
   * constructor is resolved, we need to invalidate its
   * pending callback.
   */

  invalidatePending: function () {
    if (this.pendingComponentCb) {
      this.pendingComponentCb.cancel()
      this.pendingComponentCb = null
    }
  },

  /**
   * Instantiate/insert a new child vm.
   * If keep alive and has cached instance, insert that
   * instance; otherwise build a new one and cache it.
   *
   * @param {Object} [extraOptions]
   * @return {Vue} - the created instance
   */

  build: function (extraOptions) {
    var cached = this.getCached()
    if (cached) {
      return cached
    }
    if (this.Component) {
      // default options
      var options = {
        el: templateParser.clone(this.el),
        template: this.template,
        // if no inline-template, then the compiled
        // linker can be cached for better performance.
        _linkerCachable: !this.template,
        _asComponent: true,
        _isRouterView: this._isRouterView,
        _context: this.vm
      }
      // extra options
      if (extraOptions) {
        _.extend(options, extraOptions)
      }
      var parent = this._host || this.vm
      var child = parent.$addChild(options, this.Component)
      if (this.keepAlive) {
        this.cache[this.Component.cid] = child
      }
      return child
    }
  },

  /**
   * Try to get a cached instance of the current component.
   *
   * @return {Vue|undefined}
   */

  getCached: function () {
    return this.keepAlive && this.cache[this.Component.cid]
  },

  /**
   * Teardown the current child, but defers cleanup so
   * that we can separate the destroy and removal steps.
   *
   * @param {Boolean} defer
   */

  unbuild: function (defer) {
    if (this.waitingFor) {
      this.waitingFor.$destroy()
      this.waitingFor = null
    }
    var child = this.childVM
    if (!child || this.keepAlive) {
      return
    }
    // the sole purpose of `deferCleanup` is so that we can
    // "deactivate" the vm right now and perform DOM removal
    // later.
    child.$destroy(false, defer)
  },

  /**
   * Remove current destroyed child and manually do
   * the cleanup after removal.
   *
   * @param {Function} cb
   */

  remove: function (child, cb) {
    var keepAlive = this.keepAlive
    if (child) {
      // we may have a component switch when a previous
      // component is still being transitioned out.
      // we want to trigger only one lastest insertion cb
      // when the existing transition finishes. (#1119)
      this.pendingRemovals++
      this.pendingRemovalCb = cb
      var self = this
      child.$remove(function () {
        self.pendingRemovals--
        if (!keepAlive) child._cleanup()
        if (!self.pendingRemovals && self.pendingRemovalCb) {
          self.pendingRemovalCb()
          self.pendingRemovalCb = null
        }
      })
    } else if (cb) {
      cb()
    }
  },

  /**
   * Actually swap the components, depending on the
   * transition mode. Defaults to simultaneous.
   *
   * @param {Vue} target
   * @param {Function} [cb]
   */

  transition: function (target, cb) {
    var self = this
    var current = this.childVM
    this.setCurrent(target)
    switch (self.transMode) {
      case 'in-out':
        target.$before(self.anchor, function () {
          self.remove(current, cb)
        })
        break
      case 'out-in':
        self.remove(current, function () {
          target.$before(self.anchor, cb)
        })
        break
      default:
        self.remove(current)
        target.$before(self.anchor, cb)
    }
  },

  /**
   * Set childVM and parent ref
   */

  setCurrent: function (child) {
    this.unsetCurrent()
    this.childVM = child
    var refID = child._refID || this.refID
    if (refID) {
      this.vm.$[refID] = child
    }
  },

  /**
   * Unset childVM and parent ref
   */

  unsetCurrent: function () {
    var child = this.childVM
    this.childVM = null
    var refID = (child && child._refID) || this.refID
    if (refID) {
      this.vm.$[refID] = null
    }
  },

  /**
   * Unbind.
   */

  unbind: function () {
    this.invalidatePending()
    // Do not defer cleanup when unbinding
    this.unbuild()
    this.unsetCurrent()
    // destroy all keep-alive cached instances
    if (this.cache) {
      for (var key in this.cache) {
        this.cache[key].$destroy()
      }
      this.cache = null
    }
  }
}

}).call(this,require('_process'))

},{"../config":22,"../parsers/template":62,"../util":71,"_process":1}],28:[function(require,module,exports){
module.exports = {

  isLiteral: true,

  bind: function () {
    this.vm.$$[this.expression] = this.el
  },

  unbind: function () {
    delete this.vm.$$[this.expression]
  }
}

},{}],29:[function(require,module,exports){
var _ = require('../util')
var templateParser = require('../parsers/template')

module.exports = {

  bind: function () {
    // a comment node means this is a binding for
    // {{{ inline unescaped html }}}
    if (this.el.nodeType === 8) {
      // hold nodes
      this.nodes = []
      // replace the placeholder with proper anchor
      this.anchor = _.createAnchor('v-html')
      _.replace(this.el, this.anchor)
    }
  },

  update: function (value) {
    value = _.toString(value)
    if (this.nodes) {
      this.swap(value)
    } else {
      this.el.innerHTML = value
    }
  },

  swap: function (value) {
    // remove old nodes
    var i = this.nodes.length
    while (i--) {
      _.remove(this.nodes[i])
    }
    // convert new value to a fragment
    // do not attempt to retrieve from id selector
    var frag = templateParser.parse(value, true, true)
    // save a reference to these nodes so we can remove later
    this.nodes = _.toArray(frag.childNodes)
    _.before(frag, this.anchor)
  }
}

},{"../parsers/template":62,"../util":71}],30:[function(require,module,exports){
(function (process){
var _ = require('../util')
var compiler = require('../compiler')
var templateParser = require('../parsers/template')
var transition = require('../transition')
var Cache = require('../cache')
var cache = new Cache(1000)

module.exports = {

  bind: function () {
    var el = this.el
    if (!el.__vue__) {
      this.start = _.createAnchor('v-if-start')
      this.end = _.createAnchor('v-if-end')
      _.replace(el, this.end)
      _.before(this.start, this.end)
      if (_.isTemplate(el)) {
        this.template = templateParser.parse(el, true)
      } else {
        this.template = document.createDocumentFragment()
        this.template.appendChild(templateParser.clone(el))
      }
      // compile the nested partial
      var cacheId = (this.vm.constructor.cid || '') + el.outerHTML
      this.linker = cache.get(cacheId)
      if (!this.linker) {
        this.linker = compiler.compile(
          this.template,
          this.vm.$options,
          true // partial
        )
        cache.put(cacheId, this.linker)
      }
    } else {
      process.env.NODE_ENV !== 'production' && _.warn(
        'v-if="' + this.expression + '" cannot be ' +
        'used on an instance root element.'
      )
      this.invalid = true
    }
  },

  update: function (value) {
    if (this.invalid) return
    if (value) {
      // avoid duplicate compiles, since update() can be
      // called with different truthy values
      if (!this.unlink) {
        this.link(
          templateParser.clone(this.template),
          this.linker
        )
      }
    } else {
      this.teardown()
    }
  },

  link: function (frag, linker) {
    var vm = this.vm
    this.unlink = linker(vm, frag, this._host /* important */)
    transition.blockAppend(frag, this.end, vm)
    // call attached for all the child components created
    // during the compilation
    if (_.inDoc(vm.$el)) {
      var children = this.getContainedComponents()
      if (children) children.forEach(callAttach)
    }
  },

  teardown: function () {
    if (!this.unlink) return
    // collect children beforehand
    var children
    if (_.inDoc(this.vm.$el)) {
      children = this.getContainedComponents()
    }
    transition.blockRemove(this.start, this.end, this.vm)
    if (children) children.forEach(callDetach)
    this.unlink()
    this.unlink = null
  },

  getContainedComponents: function () {
    var vm = this._host || this.vm
    var start = this.start.nextSibling
    var end = this.end

    function contains (c) {
      var cur = start
      var next
      while (next !== end) {
        next = cur.nextSibling
        if (
          cur === c.$el ||
          cur.contains && cur.contains(c.$el)
        ) {
          return true
        }
        cur = next
      }
      return false
    }

    return vm.$children.length &&
      vm.$children.filter(contains)
  },

  unbind: function () {
    if (this.unlink) this.unlink()
  }

}

function callAttach (child) {
  if (!child._isAttached) {
    child._callHook('attached')
  }
}

function callDetach (child) {
  if (child._isAttached) {
    child._callHook('detached')
  }
}

}).call(this,require('_process'))

},{"../cache":17,"../compiler":20,"../parsers/template":62,"../transition":64,"../util":71,"_process":1}],31:[function(require,module,exports){
// manipulation directives
exports.text = require('./text')
exports.html = require('./html')
exports.attr = require('./attr')
exports.show = require('./show')
exports['class'] = require('./class')
exports.el = require('./el')
exports.ref = require('./ref')
exports.cloak = require('./cloak')
exports.style = require('./style')
exports.transition = require('./transition')

// event listener directives
exports.on = require('./on')
exports.model = require('./model')

// logic control directives
exports.repeat = require('./repeat')
exports['if'] = require('./if')

// internal directives that should not be used directly
// but we still want to expose them for advanced usage.
exports._component = require('./component')
exports._prop = require('./prop')

},{"./attr":24,"./class":25,"./cloak":26,"./component":27,"./el":28,"./html":29,"./if":30,"./model":33,"./on":37,"./prop":38,"./ref":39,"./repeat":40,"./show":41,"./style":42,"./text":43,"./transition":44}],32:[function(require,module,exports){
var _ = require('../../util')

module.exports = {

  bind: function () {
    var self = this
    var el = this.el
    var trueExp = this._checkParam('true-exp')
    var falseExp = this._checkParam('false-exp')

    this._matchValue = function (value) {
      if (trueExp !== null) {
        return _.looseEqual(value, self.vm.$eval(trueExp))
      } else {
        return !!value
      }
    }

    function getValue () {
      var val = el.checked
      if (val && trueExp !== null) {
        val = self.vm.$eval(trueExp)
      }
      if (!val && falseExp !== null) {
        val = self.vm.$eval(falseExp)
      }
      return val
    }

    this.on('change', function () {
      self.set(getValue())
    })

    if (el.checked) {
      this._initValue = getValue()
    }
  },

  update: function (value) {
    this.el.checked = this._matchValue(value)
  }
}

},{"../../util":71}],33:[function(require,module,exports){
(function (process){
var _ = require('../../util')

var handlers = {
  text: require('./text'),
  radio: require('./radio'),
  select: require('./select'),
  checkbox: require('./checkbox')
}

module.exports = {

  priority: 800,
  twoWay: true,
  handlers: handlers,

  /**
   * Possible elements:
   *   <select>
   *   <textarea>
   *   <input type="*">
   *     - text
   *     - checkbox
   *     - radio
   *     - number
   *     - TODO: more types may be supplied as a plugin
   */

  bind: function () {
    // friendly warning...
    this.checkFilters()
    if (this.hasRead && !this.hasWrite) {
      process.env.NODE_ENV !== 'production' && _.warn(
        'It seems you are using a read-only filter with ' +
        'v-model. You might want to use a two-way filter ' +
        'to ensure correct behavior.'
      )
    }
    var el = this.el
    var tag = el.tagName
    var handler
    if (tag === 'INPUT') {
      handler = handlers[el.type] || handlers.text
    } else if (tag === 'SELECT') {
      handler = handlers.select
    } else if (tag === 'TEXTAREA') {
      handler = handlers.text
    } else {
      process.env.NODE_ENV !== 'production' && _.warn(
        'v-model does not support element type: ' + tag
      )
      return
    }
    el.__v_model = this
    handler.bind.call(this)
    this.update = handler.update
    this._unbind = handler.unbind
  },

  /**
   * Check read/write filter stats.
   */

  checkFilters: function () {
    var filters = this.filters
    if (!filters) return
    var i = filters.length
    while (i--) {
      var filter = _.resolveAsset(this.vm.$options, 'filters', filters[i].name)
      if (typeof filter === 'function' || filter.read) {
        this.hasRead = true
      }
      if (filter.write) {
        this.hasWrite = true
      }
    }
  },

  unbind: function () {
    this.el.__v_model = null
    this._unbind && this._unbind()
  }
}

}).call(this,require('_process'))

},{"../../util":71,"./checkbox":32,"./radio":34,"./select":35,"./text":36,"_process":1}],34:[function(require,module,exports){
var _ = require('../../util')

module.exports = {

  bind: function () {
    var self = this
    var el = this.el
    var number = this._checkParam('number') != null
    var expression = this._checkParam('exp')

    this.getValue = function () {
      var val = el.value
      if (number) {
        val = _.toNumber(val)
      } else if (expression !== null) {
        val = self.vm.$eval(expression)
      }
      return val
    }

    this.on('change', function () {
      self.set(self.getValue())
    })

    if (el.checked) {
      this._initValue = this.getValue()
    }
  },

  update: function (value) {
    this.el.checked = _.looseEqual(value, this.getValue())
  }
}

},{"../../util":71}],35:[function(require,module,exports){
(function (process){
var _ = require('../../util')
var Watcher = require('../../watcher')
var dirParser = require('../../parsers/directive')

module.exports = {

  bind: function () {
    var self = this
    var el = this.el

    // method to force update DOM using latest value.
    this.forceUpdate = function () {
      if (self._watcher) {
        self.update(self._watcher.get())
      }
    }

    // check options param
    var optionsParam = this._checkParam('options')
    if (optionsParam) {
      initOptions.call(this, optionsParam)
    }
    this.number = this._checkParam('number') != null
    this.multiple = el.hasAttribute('multiple')

    // attach listener
    this.on('change', function () {
      var value = getValue(el, self.multiple)
      value = self.number
        ? _.isArray(value)
          ? value.map(_.toNumber)
          : _.toNumber(value)
        : value
      self.set(value)
    })

    // check initial value (inline selected attribute)
    checkInitialValue.call(this)

    // All major browsers except Firefox resets
    // selectedIndex with value -1 to 0 when the element
    // is appended to a new parent, therefore we have to
    // force a DOM update whenever that happens...
    this.vm.$on('hook:attached', this.forceUpdate)
  },

  update: function (value) {
    var el = this.el
    el.selectedIndex = -1
    if (value == null) {
      if (this.defaultOption) {
        this.defaultOption.selected = true
      }
      return
    }
    var multi = this.multiple && _.isArray(value)
    var options = el.options
    var i = options.length
    var op, val
    while (i--) {
      op = options[i]
      val = op.hasOwnProperty('_value')
        ? op._value
        : op.value
      /* eslint-disable eqeqeq */
      op.selected = multi
        ? indexOf(value, val) > -1
        : _.looseEqual(value, val)
      /* eslint-enable eqeqeq */
    }
  },

  unbind: function () {
    this.vm.$off('hook:attached', this.forceUpdate)
    if (this.optionWatcher) {
      this.optionWatcher.teardown()
    }
  }
}

/**
 * Initialize the option list from the param.
 *
 * @param {String} expression
 */

function initOptions (expression) {
  var self = this
  var el = self.el
  var defaultOption = self.defaultOption = self.el.options[0]
  var descriptor = dirParser.parse(expression)[0]
  function optionUpdateWatcher (value) {
    if (_.isArray(value)) {
      // clear old options.
      // cannot reset innerHTML here because IE family get
      // confused during compilation.
      var i = el.options.length
      while (i--) {
        var option = el.options[i]
        if (option !== defaultOption) {
          var parentNode = option.parentNode
          if (parentNode === el) {
            parentNode.removeChild(option)
          } else {
            el.removeChild(parentNode)
            i = el.options.length
          }
        }
      }
      buildOptions(el, value)
      self.forceUpdate()
    } else {
      process.env.NODE_ENV !== 'production' && _.warn(
        'Invalid options value for v-model: ' + value
      )
    }
  }
  this.optionWatcher = new Watcher(
    this.vm,
    descriptor.expression,
    optionUpdateWatcher,
    {
      deep: true,
      filters: descriptor.filters
    }
  )
  // update with initial value
  optionUpdateWatcher(this.optionWatcher.value)
}

/**
 * Build up option elements. IE9 doesn't create options
 * when setting innerHTML on <select> elements, so we have
 * to use DOM API here.
 *
 * @param {Element} parent - a <select> or an <optgroup>
 * @param {Array} options
 */

function buildOptions (parent, options) {
  var op, el
  for (var i = 0, l = options.length; i < l; i++) {
    op = options[i]
    if (!op.options) {
      el = document.createElement('option')
      if (typeof op === 'string') {
        el.text = el.value = op
      } else {
        if (op.value != null && !_.isObject(op.value)) {
          el.value = op.value
        }
        // object values gets serialized when set as value,
        // so we store the raw value as a different property
        el._value = op.value
        el.text = op.text || ''
        if (op.disabled) {
          el.disabled = true
        }
      }
    } else {
      el = document.createElement('optgroup')
      el.label = op.label
      buildOptions(el, op.options)
    }
    parent.appendChild(el)
  }
}

/**
 * Check the initial value for selected options.
 */

function checkInitialValue () {
  var initValue
  var options = this.el.options
  for (var i = 0, l = options.length; i < l; i++) {
    if (options[i].hasAttribute('selected')) {
      if (this.multiple) {
        (initValue || (initValue = []))
          .push(options[i].value)
      } else {
        initValue = options[i].value
      }
    }
  }
  if (typeof initValue !== 'undefined') {
    this._initValue = this.number
      ? _.toNumber(initValue)
      : initValue
  }
}

/**
 * Get select value
 *
 * @param {SelectElement} el
 * @param {Boolean} multi
 * @return {Array|*}
 */

function getValue (el, multi) {
  var res = multi ? [] : null
  var op, val
  for (var i = 0, l = el.options.length; i < l; i++) {
    op = el.options[i]
    if (op.selected) {
      val = op.hasOwnProperty('_value')
        ? op._value
        : op.value
      if (multi) {
        res.push(val)
      } else {
        return val
      }
    }
  }
  return res
}

/**
 * Native Array.indexOf uses strict equal, but in this
 * case we need to match string/numbers with custom equal.
 *
 * @param {Array} arr
 * @param {*} val
 */

function indexOf (arr, val) {
  var i = arr.length
  while (i--) {
    if (_.looseEqual(arr[i], val)) {
      return i
    }
  }
  return -1
}

}).call(this,require('_process'))

},{"../../parsers/directive":59,"../../util":71,"../../watcher":75,"_process":1}],36:[function(require,module,exports){
var _ = require('../../util')

module.exports = {

  bind: function () {
    var self = this
    var el = this.el
    var isRange = el.type === 'range'

    // check params
    // - lazy: update model on "change" instead of "input"
    var lazy = this._checkParam('lazy') != null
    // - number: cast value into number when updating model.
    var number = this._checkParam('number') != null
    // - debounce: debounce the input listener
    var debounce = parseInt(this._checkParam('debounce'), 10)

    // handle composition events.
    //   http://blog.evanyou.me/2014/01/03/composition-event/
    // skip this for Android because it handles composition
    // events quite differently. Android doesn't trigger
    // composition events for language input methods e.g.
    // Chinese, but instead triggers them for spelling
    // suggestions... (see Discussion/#162)
    var composing = false
    if (!_.isAndroid && !isRange) {
      this.on('compositionstart', function () {
        composing = true
      })
      this.on('compositionend', function () {
        composing = false
        // in IE11 the "compositionend" event fires AFTER
        // the "input" event, so the input handler is blocked
        // at the end... have to call it here.
        self.listener()
      })
    }

    // prevent messing with the input when user is typing,
    // and force update on blur.
    this.focused = false
    if (!isRange) {
      this.on('focus', function () {
        self.focused = true
      })
      this.on('blur', function () {
        self.focused = false
        self.listener()
      })
    }

    // Now attach the main listener
    this.listener = function () {
      if (composing) return
      var val = number || isRange
        ? _.toNumber(el.value)
        : el.value
      self.set(val)
      // force update on next tick to avoid lock & same value
      // also only update when user is not typing
      _.nextTick(function () {
        if (self._bound && !self.focused) {
          self.update(self._watcher.value)
        }
      })
    }
    if (debounce) {
      this.listener = _.debounce(this.listener, debounce)
    }

    // Support jQuery events, since jQuery.trigger() doesn't
    // trigger native events in some cases and some plugins
    // rely on $.trigger()
    //
    // We want to make sure if a listener is attached using
    // jQuery, it is also removed with jQuery, that's why
    // we do the check for each directive instance and
    // store that check result on itself. This also allows
    // easier test coverage control by unsetting the global
    // jQuery variable in tests.
    this.hasjQuery = typeof jQuery === 'function'
    if (this.hasjQuery) {
      jQuery(el).on('change', this.listener)
      if (!lazy) {
        jQuery(el).on('input', this.listener)
      }
    } else {
      this.on('change', this.listener)
      if (!lazy) {
        this.on('input', this.listener)
      }
    }

    // IE9 doesn't fire input event on backspace/del/cut
    if (!lazy && _.isIE9) {
      this.on('cut', function () {
        _.nextTick(self.listener)
      })
      this.on('keyup', function (e) {
        if (e.keyCode === 46 || e.keyCode === 8) {
          self.listener()
        }
      })
    }

    // set initial value if present
    if (
      el.hasAttribute('value') ||
      (el.tagName === 'TEXTAREA' && el.value.trim())
    ) {
      this._initValue = number
        ? _.toNumber(el.value)
        : el.value
    }
  },

  update: function (value) {
    this.el.value = _.toString(value)
  },

  unbind: function () {
    var el = this.el
    if (this.hasjQuery) {
      jQuery(el).off('change', this.listener)
      jQuery(el).off('input', this.listener)
    }
  }
}

},{"../../util":71}],37:[function(require,module,exports){
(function (process){
var _ = require('../util')

module.exports = {

  acceptStatement: true,
  priority: 700,

  bind: function () {
    // deal with iframes
    if (
      this.el.tagName === 'IFRAME' &&
      this.arg !== 'load'
    ) {
      var self = this
      this.iframeBind = function () {
        _.on(self.el.contentWindow, self.arg, self.handler)
      }
      this.on('load', this.iframeBind)
    }
  },

  update: function (handler) {
    if (typeof handler !== 'function') {
      process.env.NODE_ENV !== 'production' && _.warn(
        'Directive v-on="' + this.arg + ': ' +
        this.expression + '" expects a function value, ' +
        'got ' + handler
      )
      return
    }
    this.reset()
    var vm = this.vm
    this.handler = function (e) {
      e.targetVM = vm
      vm.$event = e
      var res = handler(e)
      vm.$event = null
      return res
    }
    if (this.iframeBind) {
      this.iframeBind()
    } else {
      _.on(this.el, this.arg, this.handler)
    }
  },

  reset: function () {
    var el = this.iframeBind
      ? this.el.contentWindow
      : this.el
    if (this.handler) {
      _.off(el, this.arg, this.handler)
    }
  },

  unbind: function () {
    this.reset()
  }
}

}).call(this,require('_process'))

},{"../util":71,"_process":1}],38:[function(require,module,exports){
// NOTE: the prop internal directive is compiled and linked
// during _initScope(), before the created hook is called.
// The purpose is to make the initial prop values available
// inside `created` hooks and `data` functions.

var _ = require('../util')
var Watcher = require('../watcher')
var bindingModes = require('../config')._propBindingModes

module.exports = {

  bind: function () {

    var child = this.vm
    var parent = child._context
    // passed in from compiler directly
    var prop = this._descriptor
    var childKey = prop.path
    var parentKey = prop.parentPath

    this.parentWatcher = new Watcher(
      parent,
      parentKey,
      function (val) {
        if (_.assertProp(prop, val)) {
          child[childKey] = val
        }
      }, { sync: true }
    )

    // set the child initial value.
    var value = this.parentWatcher.value
    if (childKey === '$data') {
      child._data = value
    } else {
      _.initProp(child, prop, value)
    }

    // setup two-way binding
    if (prop.mode === bindingModes.TWO_WAY) {
      // important: defer the child watcher creation until
      // the created hook (after data observation)
      var self = this
      child.$once('hook:created', function () {
        self.childWatcher = new Watcher(
          child,
          childKey,
          function (val) {
            parent.$set(parentKey, val)
          }, { sync: true }
        )
      })
    }
  },

  unbind: function () {
    this.parentWatcher.teardown()
    if (this.childWatcher) {
      this.childWatcher.teardown()
    }
  }
}

},{"../config":22,"../util":71,"../watcher":75}],39:[function(require,module,exports){
(function (process){
var _ = require('../util')

module.exports = {

  isLiteral: true,

  bind: function () {
    var vm = this.el.__vue__
    if (!vm) {
      process.env.NODE_ENV !== 'production' && _.warn(
        'v-ref should only be used on a component root element.'
      )
      return
    }
    // If we get here, it means this is a `v-ref` on a
    // child, because parent scope `v-ref` is stripped in
    // `v-component` already. So we just record our own ref
    // here - it will overwrite parent ref in `v-component`,
    // if any.
    vm._refID = this.expression
  }
}

}).call(this,require('_process'))

},{"../util":71,"_process":1}],40:[function(require,module,exports){
(function (process){
var _ = require('../util')
var config = require('../config')
var isObject = _.isObject
var isPlainObject = _.isPlainObject
var textParser = require('../parsers/text')
var expParser = require('../parsers/expression')
var templateParser = require('../parsers/template')
var compiler = require('../compiler')
var uid = 0

// async component resolution states
var UNRESOLVED = 0
var PENDING = 1
var RESOLVED = 2
var ABORTED = 3

module.exports = {

  /**
   * Setup.
   */

  bind: function () {

    // some helpful tips...
    /* istanbul ignore if */
    if (
      process.env.NODE_ENV !== 'production' &&
      this.el.tagName === 'OPTION' &&
      this.el.parentNode && this.el.parentNode.__v_model
    ) {
      _.warn(
        'Don\'t use v-repeat for v-model options; ' +
        'use the `options` param instead: ' +
        'http://vuejs.org/guide/forms.html#Dynamic_Select_Options'
      )
    }

    // support for item in array syntax
    var inMatch = this.expression.match(/(.*) in (.*)/)
    if (inMatch) {
      this.arg = inMatch[1]
      this._watcherExp = inMatch[2]
    }
    // uid as a cache identifier
    this.id = '__v_repeat_' + (++uid)

    // setup anchor nodes
    this.start = _.createAnchor('v-repeat-start')
    this.end = _.createAnchor('v-repeat-end')
    _.replace(this.el, this.end)
    _.before(this.start, this.end)

    // check if this is a block repeat
    this.template = _.isTemplate(this.el)
      ? templateParser.parse(this.el, true)
      : this.el

    // check for trackby param
    this.idKey = this._checkParam('track-by')
    // check for transition stagger
    var stagger = +this._checkParam('stagger')
    this.enterStagger = +this._checkParam('enter-stagger') || stagger
    this.leaveStagger = +this._checkParam('leave-stagger') || stagger

    // check for v-ref/v-el
    this.refID = this._checkParam(config.prefix + 'ref')
    this.elID = this._checkParam(config.prefix + 'el')

    // check other directives that need to be handled
    // at v-repeat level
    this.checkIf()
    this.checkComponent()

    // create cache object
    this.cache = Object.create(null)
  },

  /**
   * Warn against v-if usage.
   */

  checkIf: function () {
    if (_.attr(this.el, 'if') !== null) {
      process.env.NODE_ENV !== 'production' && _.warn(
        'Don\'t use v-if with v-repeat. ' +
        'Use v-show or the "filterBy" filter instead.'
      )
    }
  },

  /**
   * Check the component constructor to use for repeated
   * instances. If static we resolve it now, otherwise it
   * needs to be resolved at build time with actual data.
   */

  checkComponent: function () {
    this.componentState = UNRESOLVED
    var options = this.vm.$options
    var id = _.checkComponent(this.el, options)
    if (!id) {
      // default constructor
      this.Component = _.Vue
      // inline repeats should inherit
      this.inline = true
      // important: transclude with no options, just
      // to ensure block start and block end
      this.template = compiler.transclude(this.template)
      var copy = _.extend({}, options)
      copy._asComponent = false
      this._linkFn = compiler.compile(this.template, copy)
    } else {
      this.Component = null
      this.asComponent = true
      // check inline-template
      if (this._checkParam('inline-template') !== null) {
        // extract inline template as a DocumentFragment
        this.inlineTemplate = _.extractContent(this.el, true)
      }
      var tokens = textParser.parse(id)
      if (tokens) {
        // dynamic component to be resolved later
        var componentExp = textParser.tokensToExp(tokens)
        this.componentGetter = expParser.parse(componentExp).get
      } else {
        // static
        this.componentId = id
        this.pendingData = null
      }
    }
  },

  resolveComponent: function () {
    this.componentState = PENDING
    this.vm._resolveComponent(this.componentId, _.bind(function (Component) {
      if (this.componentState === ABORTED) {
        return
      }
      this.Component = Component
      this.componentState = RESOLVED
      this.realUpdate(this.pendingData)
      this.pendingData = null
    }, this))
  },

  /**
   * Resolve a dynamic component to use for an instance.
   * The tricky part here is that there could be dynamic
   * components depending on instance data.
   *
   * @param {Object} data
   * @param {Object} meta
   * @return {Function}
   */

  resolveDynamicComponent: function (data, meta) {
    // create a temporary context object and copy data
    // and meta properties onto it.
    // use _.define to avoid accidentally overwriting scope
    // properties.
    var context = Object.create(this.vm)
    var key
    for (key in data) {
      _.define(context, key, data[key])
    }
    for (key in meta) {
      _.define(context, key, meta[key])
    }
    var id = this.componentGetter.call(context, context)
    var Component = _.resolveAsset(this.vm.$options, 'components', id)
    if (process.env.NODE_ENV !== 'production') {
      _.assertAsset(Component, 'component', id)
    }
    if (!Component.options) {
      process.env.NODE_ENV !== 'production' && _.warn(
        'Async resolution is not supported for v-repeat ' +
        '+ dynamic component. (component: ' + id + ')'
      )
      return _.Vue
    }
    return Component
  },

  /**
   * Update.
   * This is called whenever the Array mutates. If we have
   * a component, we might need to wait for it to resolve
   * asynchronously.
   *
   * @param {Array|Number|String} data
   */

  update: function (data) {
    if (process.env.NODE_ENV !== 'production' && !_.isArray(data)) {
      _.warn(
        'v-repeat pre-converts Objects into Arrays, and ' +
        'v-repeat filters should always return Arrays.'
      )
    }
    if (this.componentId) {
      var state = this.componentState
      if (state === UNRESOLVED) {
        this.pendingData = data
        // once resolved, it will call realUpdate
        this.resolveComponent()
      } else if (state === PENDING) {
        this.pendingData = data
      } else if (state === RESOLVED) {
        this.realUpdate(data)
      }
    } else {
      this.realUpdate(data)
    }
  },

  /**
   * The real update that actually modifies the DOM.
   *
   * @param {Array|Number|String} data
   */

  realUpdate: function (data) {
    this.vms = this.diff(data, this.vms)
    // update v-ref
    if (this.refID) {
      this.vm.$[this.refID] = this.converted
        ? toRefObject(this.vms)
        : this.vms
    }
    if (this.elID) {
      this.vm.$$[this.elID] = this.vms.map(function (vm) {
        return vm.$el
      })
    }
  },

  /**
   * Diff, based on new data and old data, determine the
   * minimum amount of DOM manipulations needed to make the
   * DOM reflect the new data Array.
   *
   * The algorithm diffs the new data Array by storing a
   * hidden reference to an owner vm instance on previously
   * seen data. This allows us to achieve O(n) which is
   * better than a levenshtein distance based algorithm,
   * which is O(m * n).
   *
   * @param {Array} data
   * @param {Array} oldVms
   * @return {Array}
   */

  diff: function (data, oldVms) {
    var idKey = this.idKey
    var converted = this.converted
    var start = this.start
    var end = this.end
    var inDoc = _.inDoc(start)
    var alias = this.arg
    var init = !oldVms
    var vms = new Array(data.length)
    var obj, raw, vm, i, l, primitive
    // First pass, go through the new Array and fill up
    // the new vms array. If a piece of data has a cached
    // instance for it, we reuse it. Otherwise build a new
    // instance.
    for (i = 0, l = data.length; i < l; i++) {
      obj = data[i]
      raw = converted ? obj.$value : obj
      primitive = !isObject(raw)
      vm = !init && this.getVm(raw, i, converted ? obj.$key : null)
      if (vm) { // reusable instance

        if (process.env.NODE_ENV !== 'production' && vm._reused) {
          _.warn(
            'Duplicate objects found in v-repeat="' + this.expression + '": ' +
            JSON.stringify(raw)
          )
        }

        vm._reused = true
        vm.$index = i // update $index
        // update data for track-by or object repeat,
        // since in these two cases the data is replaced
        // rather than mutated.
        if (idKey || converted || primitive) {
          if (alias) {
            vm[alias] = raw
          } else if (_.isPlainObject(raw)) {
            vm.$data = raw
          } else {
            vm.$value = raw
          }
        }
      } else { // new instance
        vm = this.build(obj, i, true)
        vm._reused = false
      }
      vms[i] = vm
      // insert if this is first run
      if (init) {
        vm.$before(end)
      }
    }
    // if this is the first run, we're done.
    if (init) {
      return vms
    }
    // Second pass, go through the old vm instances and
    // destroy those who are not reused (and remove them
    // from cache)
    var removalIndex = 0
    var totalRemoved = oldVms.length - vms.length
    for (i = 0, l = oldVms.length; i < l; i++) {
      vm = oldVms[i]
      if (!vm._reused) {
        this.uncacheVm(vm)
        vm.$destroy(false, true) // defer cleanup until removal
        this.remove(vm, removalIndex++, totalRemoved, inDoc)
      }
    }
    // final pass, move/insert new instances into the
    // right place.
    var targetPrev, prevEl, currentPrev
    var insertionIndex = 0
    for (i = 0, l = vms.length; i < l; i++) {
      vm = vms[i]
      // this is the vm that we should be after
      targetPrev = vms[i - 1]
      prevEl = targetPrev
        ? targetPrev._staggerCb
          ? targetPrev._staggerAnchor
          : targetPrev._fragmentEnd || targetPrev.$el
        : start
      if (vm._reused && !vm._staggerCb) {
        currentPrev = findPrevVm(vm, start, this.id)
        if (currentPrev !== targetPrev) {
          this.move(vm, prevEl)
        }
      } else {
        // new instance, or still in stagger.
        // insert with updated stagger index.
        this.insert(vm, insertionIndex++, prevEl, inDoc)
      }
      vm._reused = false
    }
    return vms
  },

  /**
   * Build a new instance and cache it.
   *
   * @param {Object} data
   * @param {Number} index
   * @param {Boolean} needCache
   */

  build: function (data, index, needCache) {
    var meta = { $index: index }
    if (this.converted) {
      meta.$key = data.$key
    }
    var raw = this.converted ? data.$value : data
    var alias = this.arg
    if (alias) {
      data = {}
      data[alias] = raw
    } else if (!isPlainObject(raw)) {
      // non-object values
      data = {}
      meta.$value = raw
    } else {
      // default
      data = raw
    }
    // resolve constructor
    var Component = this.Component || this.resolveDynamicComponent(data, meta)
    var parent = this._host || this.vm
    var vm = parent.$addChild({
      el: templateParser.clone(this.template),
      data: data,
      inherit: this.inline,
      template: this.inlineTemplate,
      // repeater meta, e.g. $index, $key
      _meta: meta,
      // mark this as an inline-repeat instance
      _repeat: this.inline,
      // is this a component?
      _asComponent: this.asComponent,
      // linker cachable if no inline-template
      _linkerCachable: !this.inlineTemplate && Component !== _.Vue,
      // pre-compiled linker for simple repeats
      _linkFn: this._linkFn,
      // identifier, shows that this vm belongs to this collection
      _repeatId: this.id,
      // transclusion content owner
      _context: this.vm
    }, Component)
    // cache instance
    if (needCache) {
      this.cacheVm(raw, vm, index, this.converted ? meta.$key : null)
    }
    // sync back changes for two-way bindings of primitive values
    var dir = this
    if (this.rawType === 'object' && isPrimitive(raw)) {
      vm.$watch(alias || '$value', function (val) {
        if (dir.filters) {
          process.env.NODE_ENV !== 'production' && _.warn(
            'You seem to be mutating the $value reference of ' +
            'a v-repeat instance (likely through v-model) ' +
            'and filtering the v-repeat at the same time. ' +
            'This will not work properly with an Array of ' +
            'primitive values. Please use an Array of ' +
            'Objects instead.'
          )
        }
        dir._withLock(function () {
          if (dir.converted) {
            dir.rawValue[vm.$key] = val
          } else {
            dir.rawValue.$set(vm.$index, val)
          }
        })
      })
    }
    return vm
  },

  /**
   * Unbind, teardown everything
   */

  unbind: function () {
    this.componentState = ABORTED
    if (this.refID) {
      this.vm.$[this.refID] = null
    }
    if (this.vms) {
      var i = this.vms.length
      var vm
      while (i--) {
        vm = this.vms[i]
        this.uncacheVm(vm)
        vm.$destroy()
      }
    }
  },

  /**
   * Cache a vm instance based on its data.
   *
   * If the data is an object, we save the vm's reference on
   * the data object as a hidden property. Otherwise we
   * cache them in an object and for each primitive value
   * there is an array in case there are duplicates.
   *
   * @param {Object} data
   * @param {Vue} vm
   * @param {Number} index
   * @param {String} [key]
   */

  cacheVm: function (data, vm, index, key) {
    var idKey = this.idKey
    var cache = this.cache
    var primitive = !isObject(data)
    var id
    if (key || idKey || primitive) {
      id = idKey
        ? idKey === '$index'
          ? index
          : data[idKey]
        : (key || index)
      if (!cache[id]) {
        cache[id] = vm
      } else if (!primitive && idKey !== '$index') {
        process.env.NODE_ENV !== 'production' && _.warn(
          'Duplicate objects with the same track-by key in v-repeat: ' + id
        )
      }
    } else {
      id = this.id
      if (data.hasOwnProperty(id)) {
        if (data[id] === null) {
          data[id] = vm
        } else {
          process.env.NODE_ENV !== 'production' && _.warn(
            'Duplicate objects found in v-repeat="' + this.expression + '": ' +
            JSON.stringify(data)
          )
        }
      } else {
        _.define(data, id, vm)
      }
    }
    vm._raw = data
  },

  /**
   * Try to get a cached instance from a piece of data.
   *
   * @param {Object} data
   * @param {Number} index
   * @param {String} [key]
   * @return {Vue|undefined}
   */

  getVm: function (data, index, key) {
    var idKey = this.idKey
    var primitive = !isObject(data)
    if (key || idKey || primitive) {
      var id = idKey
        ? idKey === '$index'
          ? index
          : data[idKey]
        : (key || index)
      return this.cache[id]
    } else {
      return data[this.id]
    }
  },

  /**
   * Delete a cached vm instance.
   *
   * @param {Vue} vm
   */

  uncacheVm: function (vm) {
    var data = vm._raw
    var idKey = this.idKey
    var index = vm.$index
    // fix #948: avoid accidentally fall through to
    // a parent repeater which happens to have $key.
    var key = vm.hasOwnProperty('$key') && vm.$key
    var primitive = !isObject(data)
    if (idKey || key || primitive) {
      var id = idKey
        ? idKey === '$index'
          ? index
          : data[idKey]
        : (key || index)
      this.cache[id] = null
    } else {
      data[this.id] = null
      vm._raw = null
    }
  },

  /**
   * Insert an instance.
   *
   * @param {Vue} vm
   * @param {Number} index
   * @param {Node} prevEl
   * @param {Boolean} inDoc
   */

  insert: function (vm, index, prevEl, inDoc) {
    if (vm._staggerCb) {
      vm._staggerCb.cancel()
      vm._staggerCb = null
    }
    var staggerAmount = this.getStagger(vm, index, null, 'enter')
    if (inDoc && staggerAmount) {
      // create an anchor and insert it synchronously,
      // so that we can resolve the correct order without
      // worrying about some elements not inserted yet
      var anchor = vm._staggerAnchor
      if (!anchor) {
        anchor = vm._staggerAnchor = _.createAnchor('stagger-anchor')
        anchor.__vue__ = vm
      }
      _.after(anchor, prevEl)
      var op = vm._staggerCb = _.cancellable(function () {
        vm._staggerCb = null
        vm.$before(anchor)
        _.remove(anchor)
      })
      setTimeout(op, staggerAmount)
    } else {
      vm.$after(prevEl)
    }
  },

  /**
   * Move an already inserted instance.
   *
   * @param {Vue} vm
   * @param {Node} prevEl
   */

  move: function (vm, prevEl) {
    vm.$after(prevEl, null, false)
  },

  /**
   * Remove an instance.
   *
   * @param {Vue} vm
   * @param {Number} index
   * @param {Boolean} inDoc
   */

  remove: function (vm, index, total, inDoc) {
    if (vm._staggerCb) {
      vm._staggerCb.cancel()
      vm._staggerCb = null
      // it's not possible for the same vm to be removed
      // twice, so if we have a pending stagger callback,
      // it means this vm is queued for enter but removed
      // before its transition started. Since it is already
      // destroyed, we can just leave it in detached state.
      return
    }
    var staggerAmount = this.getStagger(vm, index, total, 'leave')
    if (inDoc && staggerAmount) {
      var op = vm._staggerCb = _.cancellable(function () {
        vm._staggerCb = null
        remove()
      })
      setTimeout(op, staggerAmount)
    } else {
      remove()
    }
    function remove () {
      vm.$remove(function () {
        vm._cleanup()
      })
    }
  },

  /**
   * Get the stagger amount for an insertion/removal.
   *
   * @param {Vue} vm
   * @param {Number} index
   * @param {String} type
   * @param {Number} total
   */

  getStagger: function (vm, index, total, type) {
    type = type + 'Stagger'
    var transition = vm.$el.__v_trans
    var hooks = transition && transition.hooks
    var hook = hooks && (hooks[type] || hooks.stagger)
    return hook
      ? hook.call(vm, index, total)
      : index * this[type]
  },

  /**
   * Pre-process the value before piping it through the
   * filters, and convert non-Array objects to arrays.
   *
   * This function will be bound to this directive instance
   * and passed into the watcher.
   *
   * @param {*} value
   * @return {Array}
   * @private
   */

  _preProcess: function (value) {
    // regardless of type, store the un-filtered raw value.
    this.rawValue = value
    var type = this.rawType = typeof value
    if (!isPlainObject(value)) {
      this.converted = false
      if (type === 'number') {
        value = range(value)
      } else if (type === 'string') {
        value = _.toArray(value)
      }
      return value || []
    } else {
      // convert plain object to array.
      var keys = Object.keys(value)
      var i = keys.length
      var res = new Array(i)
      var key
      while (i--) {
        key = keys[i]
        res[i] = {
          $key: key,
          $value: value[key]
        }
      }
      this.converted = true
      return res
    }
  }
}

/**
 * Helper to find the previous element that is an instance
 * root node. This is necessary because a destroyed vm's
 * element could still be lingering in the DOM before its
 * leaving transition finishes, but its __vue__ reference
 * should have been removed so we can skip them.
 *
 * If this is a block repeat, we want to make sure we only
 * return vm that is bound to this v-repeat. (see #929)
 *
 * @param {Vue} vm
 * @param {Comment|Text} anchor
 * @return {Vue}
 */

function findPrevVm (vm, anchor, id) {
  var el = vm.$el.previousSibling
  /* istanbul ignore if */
  if (!el) return
  while (
    (!el.__vue__ || el.__vue__.$options._repeatId !== id) &&
    el !== anchor
  ) {
    el = el.previousSibling
  }
  return el.__vue__
}

/**
 * Create a range array from given number.
 *
 * @param {Number} n
 * @return {Array}
 */

function range (n) {
  var i = -1
  var ret = new Array(n)
  while (++i < n) {
    ret[i] = i
  }
  return ret
}

/**
 * Convert a vms array to an object ref for v-ref on an
 * Object value.
 *
 * @param {Array} vms
 * @return {Object}
 */

function toRefObject (vms) {
  var ref = {}
  for (var i = 0, l = vms.length; i < l; i++) {
    ref[vms[i].$key] = vms[i]
  }
  return ref
}

/**
 * Check if a value is a primitive one:
 * String, Number, Boolean, null or undefined.
 *
 * @param {*} value
 * @return {Boolean}
 */

function isPrimitive (value) {
  var type = typeof value
  return value == null ||
    type === 'string' ||
    type === 'number' ||
    type === 'boolean'
}

}).call(this,require('_process'))

},{"../compiler":20,"../config":22,"../parsers/expression":60,"../parsers/template":62,"../parsers/text":63,"../util":71,"_process":1}],41:[function(require,module,exports){
var transition = require('../transition')

module.exports = function (value) {
  var el = this.el
  transition.apply(el, value ? 1 : -1, function () {
    el.style.display = value ? '' : 'none'
  }, this.vm)
}

},{"../transition":64}],42:[function(require,module,exports){
var _ = require('../util')
var prefixes = ['-webkit-', '-moz-', '-ms-']
var camelPrefixes = ['Webkit', 'Moz', 'ms']
var importantRE = /!important;?$/
var camelRE = /([a-z])([A-Z])/g
var testEl = null
var propCache = {}

module.exports = {

  deep: true,

  update: function (value) {
    if (this.arg) {
      this.setProp(this.arg, value)
    } else {
      if (typeof value === 'object') {
        this.objectHandler(value)
      } else {
        this.el.style.cssText = value
      }
    }
  },

  objectHandler: function (value) {
    // cache object styles so that only changed props
    // are actually updated.
    var cache = this.cache || (this.cache = {})
    var prop, val
    for (prop in cache) {
      if (!(prop in value)) {
        this.setProp(prop, null)
        delete cache[prop]
      }
    }
    for (prop in value) {
      val = value[prop]
      if (val !== cache[prop]) {
        cache[prop] = val
        this.setProp(prop, val)
      }
    }
  },

  setProp: function (prop, value) {
    prop = normalize(prop)
    if (!prop) return // unsupported prop
    // cast possible numbers/booleans into strings
    if (value != null) value += ''
    if (value) {
      var isImportant = importantRE.test(value)
        ? 'important'
        : ''
      if (isImportant) {
        value = value.replace(importantRE, '').trim()
      }
      this.el.style.setProperty(prop, value, isImportant)
    } else {
      this.el.style.removeProperty(prop)
    }
  }

}

/**
 * Normalize a CSS property name.
 * - cache result
 * - auto prefix
 * - camelCase -> dash-case
 *
 * @param {String} prop
 * @return {String}
 */

function normalize (prop) {
  if (propCache[prop]) {
    return propCache[prop]
  }
  var res = prefix(prop)
  propCache[prop] = propCache[res] = res
  return res
}

/**
 * Auto detect the appropriate prefix for a CSS property.
 * https://gist.github.com/paulirish/523692
 *
 * @param {String} prop
 * @return {String}
 */

function prefix (prop) {
  prop = prop.replace(camelRE, '$1-$2').toLowerCase()
  var camel = _.camelize(prop)
  var upper = camel.charAt(0).toUpperCase() + camel.slice(1)
  if (!testEl) {
    testEl = document.createElement('div')
  }
  if (camel in testEl.style) {
    return prop
  }
  var i = prefixes.length
  var prefixed
  while (i--) {
    prefixed = camelPrefixes[i] + upper
    if (prefixed in testEl.style) {
      return prefixes[i] + prop
    }
  }
}

},{"../util":71}],43:[function(require,module,exports){
var _ = require('../util')

module.exports = {

  bind: function () {
    this.attr = this.el.nodeType === 3
      ? 'data'
      : 'textContent'
  },

  update: function (value) {
    this.el[this.attr] = _.toString(value)
  }
}

},{"../util":71}],44:[function(require,module,exports){
var _ = require('../util')
var Transition = require('../transition/transition')

module.exports = {

  priority: 1000,
  isLiteral: true,

  bind: function () {
    if (!this._isDynamicLiteral) {
      this.update(this.expression)
    }
  },

  update: function (id, oldId) {
    var el = this.el
    var vm = this.el.__vue__ || this.vm
    var hooks = _.resolveAsset(vm.$options, 'transitions', id)
    id = id || 'v'
    el.__v_trans = new Transition(el, id, hooks, vm)
    if (oldId) {
      _.removeClass(el, oldId + '-transition')
    }
    _.addClass(el, id + '-transition')
  }
}

},{"../transition/transition":66,"../util":71}],45:[function(require,module,exports){
var _ = require('../util')
var clone = require('../parsers/template').clone

// This is the elementDirective that handles <content>
// transclusions. It relies on the raw content of an
// instance being stored as `$options._content` during
// the transclude phase.

module.exports = {

  bind: function () {
    var vm = this.vm
    var host = vm
    // we need find the content context, which is the
    // closest non-inline-repeater instance.
    while (host.$options._repeat) {
      host = host.$parent
    }
    var raw = host.$options._content
    var content
    if (!raw) {
      this.fallback()
      return
    }
    var context = host._context
    var selector = this._checkParam('select')
    if (!selector) {
      // Default content
      var self = this
      var compileDefaultContent = function () {
        self.compile(
          extractFragment(raw.childNodes, raw, true),
          context,
          vm
        )
      }
      if (!host._isCompiled) {
        // defer until the end of instance compilation,
        // because the default outlet must wait until all
        // other possible outlets with selectors have picked
        // out their contents.
        host.$once('hook:compiled', compileDefaultContent)
      } else {
        compileDefaultContent()
      }
    } else {
      // select content
      var nodes = raw.querySelectorAll(selector)
      if (nodes.length) {
        content = extractFragment(nodes, raw)
        if (content.hasChildNodes()) {
          this.compile(content, context, vm)
        } else {
          this.fallback()
        }
      } else {
        this.fallback()
      }
    }
  },

  fallback: function () {
    this.compile(_.extractContent(this.el, true), this.vm)
  },

  compile: function (content, context, host) {
    if (content && context) {
      this.unlink = context.$compile(content, host)
    }
    if (content) {
      _.replace(this.el, content)
    } else {
      _.remove(this.el)
    }
  },

  unbind: function () {
    if (this.unlink) {
      this.unlink()
    }
  }
}

/**
 * Extract qualified content nodes from a node list.
 *
 * @param {NodeList} nodes
 * @param {Element} parent
 * @param {Boolean} main
 * @return {DocumentFragment}
 */

function extractFragment (nodes, parent, main) {
  var frag = document.createDocumentFragment()
  for (var i = 0, l = nodes.length; i < l; i++) {
    var node = nodes[i]
    // if this is the main outlet, we want to skip all
    // previously selected nodes;
    // otherwise, we want to mark the node as selected.
    // clone the node so the original raw content remains
    // intact. this ensures proper re-compilation in cases
    // where the outlet is inside a conditional block
    if (main && !node.__v_selected) {
      frag.appendChild(clone(node))
    } else if (!main && node.parentNode === parent) {
      node.__v_selected = true
      frag.appendChild(clone(node))
    }
  }
  return frag
}

},{"../parsers/template":62,"../util":71}],46:[function(require,module,exports){
exports.content = require('./content')
exports.partial = require('./partial')

},{"./content":45,"./partial":47}],47:[function(require,module,exports){
(function (process){
var _ = require('../util')
var templateParser = require('../parsers/template')
var textParser = require('../parsers/text')
var compiler = require('../compiler')
var Cache = require('../cache')
var cache = new Cache(1000)

// v-partial reuses logic from v-if
var vIf = require('../directives/if')

module.exports = {

  link: vIf.link,
  teardown: vIf.teardown,
  getContainedComponents: vIf.getContainedComponents,

  bind: function () {
    var el = this.el
    this.start = _.createAnchor('v-partial-start')
    this.end = _.createAnchor('v-partial-end')
    _.replace(el, this.end)
    _.before(this.start, this.end)
    var id = el.getAttribute('name')
    var tokens = textParser.parse(id)
    if (tokens) {
      // dynamic partial
      this.setupDynamic(tokens)
    } else {
      // static partial
      this.insert(id)
    }
  },

  setupDynamic: function (tokens) {
    var self = this
    var exp = textParser.tokensToExp(tokens)
    this.unwatch = this.vm.$watch(exp, function (value) {
      self.teardown()
      self.insert(value)
    }, {
      immediate: true,
      user: false
    })
  },

  insert: function (id) {
    var partial = _.resolveAsset(this.vm.$options, 'partials', id)
    if (process.env.NODE_ENV !== 'production') {
      _.assertAsset(partial, 'partial', id)
    }
    if (partial) {
      var frag = templateParser.parse(partial, true)
      // cache partials based on constructor id.
      var cacheId = (this.vm.constructor.cid || '') + partial
      var linker = this.compile(frag, cacheId)
      // this is provided by v-if
      this.link(frag, linker)
    }
  },

  compile: function (frag, cacheId) {
    var hit = cache.get(cacheId)
    if (hit) return hit
    var linker = compiler.compile(frag, this.vm.$options, true)
    cache.put(cacheId, linker)
    return linker
  },

  unbind: function () {
    if (this.unlink) this.unlink()
    if (this.unwatch) this.unwatch()
  }
}

}).call(this,require('_process'))

},{"../cache":17,"../compiler":20,"../directives/if":30,"../parsers/template":62,"../parsers/text":63,"../util":71,"_process":1}],48:[function(require,module,exports){
var _ = require('../util')
var Path = require('../parsers/path')

/**
 * Filter filter for v-repeat
 *
 * @param {String} searchKey
 * @param {String} [delimiter]
 * @param {String} dataKey
 */

exports.filterBy = function (arr, search, delimiter /* ...dataKeys */) {
  if (search == null) {
    return arr
  }
  if (typeof search === 'function') {
    return arr.filter(search)
  }
  // cast to lowercase string
  search = ('' + search).toLowerCase()
  // allow optional `in` delimiter
  // because why not
  var n = delimiter === 'in' ? 3 : 2
  // extract and flatten keys
  var keys = _.toArray(arguments, n).reduce(function (prev, cur) {
    return prev.concat(cur)
  }, [])
  return arr.filter(function (item) {
    return keys.length
      ? keys.some(function (key) {
          return contains(Path.get(item, key), search)
        })
      : contains(item, search)
  })
}

/**
 * Filter filter for v-repeat
 *
 * @param {String} sortKey
 * @param {String} reverse
 */

exports.orderBy = function (arr, sortKey, reverse) {
  if (!sortKey) {
    return arr
  }
  var order = 1
  if (arguments.length > 2) {
    if (reverse === '-1') {
      order = -1
    } else {
      order = reverse ? -1 : 1
    }
  }
  // sort on a copy to avoid mutating original array
  return arr.slice().sort(function (a, b) {
    if (sortKey !== '$key' && sortKey !== '$value') {
      if (a && '$value' in a) a = a.$value
      if (b && '$value' in b) b = b.$value
    }
    a = _.isObject(a) ? Path.get(a, sortKey) : a
    b = _.isObject(b) ? Path.get(b, sortKey) : b
    return a === b ? 0 : a > b ? order : -order
  })
}

/**
 * String contain helper
 *
 * @param {*} val
 * @param {String} search
 */

function contains (val, search) {
  if (_.isPlainObject(val)) {
    for (var key in val) {
      if (contains(val[key], search)) {
        return true
      }
    }
  } else if (_.isArray(val)) {
    var i = val.length
    while (i--) {
      if (contains(val[i], search)) {
        return true
      }
    }
  } else if (val != null) {
    return val.toString().toLowerCase().indexOf(search) > -1
  }
}

},{"../parsers/path":61,"../util":71}],49:[function(require,module,exports){
var _ = require('../util')

/**
 * Stringify value.
 *
 * @param {Number} indent
 */

exports.json = {
  read: function (value, indent) {
    return typeof value === 'string'
      ? value
      : JSON.stringify(value, null, Number(indent) || 2)
  },
  write: function (value) {
    try {
      return JSON.parse(value)
    } catch (e) {
      return value
    }
  }
}

/**
 * 'abc' => 'Abc'
 */

exports.capitalize = function (value) {
  if (!value && value !== 0) return ''
  value = value.toString()
  return value.charAt(0).toUpperCase() + value.slice(1)
}

/**
 * 'abc' => 'ABC'
 */

exports.uppercase = function (value) {
  return (value || value === 0)
    ? value.toString().toUpperCase()
    : ''
}

/**
 * 'AbC' => 'abc'
 */

exports.lowercase = function (value) {
  return (value || value === 0)
    ? value.toString().toLowerCase()
    : ''
}

/**
 * 12345 => $12,345.00
 *
 * @param {String} sign
 */

var digitsRE = /(\d{3})(?=\d)/g
exports.currency = function (value, currency) {
  value = parseFloat(value)
  if (!isFinite(value) || (!value && value !== 0)) return ''
  currency = currency != null ? currency : '$'
  var stringified = Math.abs(value).toFixed(2)
  var _int = stringified.slice(0, -3)
  var i = _int.length % 3
  var head = i > 0
    ? (_int.slice(0, i) + (_int.length > 3 ? ',' : ''))
    : ''
  var _float = stringified.slice(-3)
  var sign = value < 0 ? '-' : ''
  return currency + sign + head +
    _int.slice(i).replace(digitsRE, '$1,') +
    _float
}

/**
 * 'item' => 'items'
 *
 * @params
 *  an array of strings corresponding to
 *  the single, double, triple ... forms of the word to
 *  be pluralized. When the number to be pluralized
 *  exceeds the length of the args, it will use the last
 *  entry in the array.
 *
 *  e.g. ['single', 'double', 'triple', 'multiple']
 */

exports.pluralize = function (value) {
  var args = _.toArray(arguments, 1)
  return args.length > 1
    ? (args[value % 10 - 1] || args[args.length - 1])
    : (args[0] + (value === 1 ? '' : 's'))
}

/**
 * A special filter that takes a handler function,
 * wraps it so it only gets triggered on specific
 * keypresses. v-on only.
 *
 * @param {String} key
 */

var keyCodes = {
  esc: 27,
  tab: 9,
  enter: 13,
  space: 32,
  'delete': 46,
  up: 38,
  left: 37,
  right: 39,
  down: 40
}

exports.key = function (handler, key) {
  if (!handler) return
  var code = keyCodes[key]
  if (!code) {
    code = parseInt(key, 10)
  }
  return function (e) {
    if (e.keyCode === code) {
      return handler.call(this, e)
    }
  }
}

// expose keycode hash
exports.key.keyCodes = keyCodes

exports.debounce = function (handler, delay) {
  if (!handler) return
  if (!delay) {
    delay = 300
  }
  return _.debounce(handler, delay)
}

/**
 * Install special array filters
 */

_.extend(exports, require('./array-filters'))

},{"../util":71,"./array-filters":48}],50:[function(require,module,exports){
var _ = require('../util')
var Directive = require('../directive')
var compiler = require('../compiler')

/**
 * Transclude, compile and link element.
 *
 * If a pre-compiled linker is available, that means the
 * passed in element will be pre-transcluded and compiled
 * as well - all we need to do is to call the linker.
 *
 * Otherwise we need to call transclude/compile/link here.
 *
 * @param {Element} el
 * @return {Element}
 */

exports._compile = function (el) {
  var options = this.$options
  var host = this._host
  if (options._linkFn) {
    // pre-transcluded with linker, just use it
    this._initElement(el)
    this._unlinkFn = options._linkFn(this, el, host)
  } else {
    // transclude and init element
    // transclude can potentially replace original
    // so we need to keep reference; this step also injects
    // the template and caches the original attributes
    // on the container node and replacer node.
    var original = el
    el = compiler.transclude(el, options)
    this._initElement(el)

    // root is always compiled per-instance, because
    // container attrs and props can be different every time.
    var rootLinker = compiler.compileRoot(el, options)

    // compile and link the rest
    var contentLinkFn
    var ctor = this.constructor
    // component compilation can be cached
    // as long as it's not using inline-template
    if (options._linkerCachable) {
      contentLinkFn = ctor.linker
      if (!contentLinkFn) {
        contentLinkFn = ctor.linker = compiler.compile(el, options)
      }
    }

    // link phase
    var rootUnlinkFn = rootLinker(this, el)
    var contentUnlinkFn = contentLinkFn
      ? contentLinkFn(this, el)
      : compiler.compile(el, options)(this, el, host)

    // register composite unlink function
    // to be called during instance destruction
    this._unlinkFn = function () {
      rootUnlinkFn()
      // passing destroying: true to avoid searching and
      // splicing the directives
      contentUnlinkFn(true)
    }

    // finally replace original
    if (options.replace) {
      _.replace(original, el)
    }
  }
  return el
}

/**
 * Initialize instance element. Called in the public
 * $mount() method.
 *
 * @param {Element} el
 */

exports._initElement = function (el) {
  if (el instanceof DocumentFragment) {
    this._isFragment = true
    this.$el = this._fragmentStart = el.firstChild
    this._fragmentEnd = el.lastChild
    // set persisted text anchors to empty
    if (this._fragmentStart.nodeType === 3) {
      this._fragmentStart.data = this._fragmentEnd.data = ''
    }
    this._blockFragment = el
  } else {
    this.$el = el
  }
  this.$el.__vue__ = this
  this._callHook('beforeCompile')
}

/**
 * Create and bind a directive to an element.
 *
 * @param {String} name - directive name
 * @param {Node} node   - target node
 * @param {Object} desc - parsed directive descriptor
 * @param {Object} def  - directive definition object
 * @param {Vue|undefined} host - transclusion host component
 */

exports._bindDir = function (name, node, desc, def, host) {
  this._directives.push(
    new Directive(name, node, this, desc, def, host)
  )
}

/**
 * Teardown an instance, unobserves the data, unbind all the
 * directives, turn off all the event listeners, etc.
 *
 * @param {Boolean} remove - whether to remove the DOM node.
 * @param {Boolean} deferCleanup - if true, defer cleanup to
 *                                 be called later
 */

exports._destroy = function (remove, deferCleanup) {
  if (this._isBeingDestroyed) {
    return
  }
  this._callHook('beforeDestroy')
  this._isBeingDestroyed = true
  var i
  // remove self from parent. only necessary
  // if parent is not being destroyed as well.
  var parent = this.$parent
  if (parent && !parent._isBeingDestroyed) {
    parent.$children.$remove(this)
  }
  // destroy all children.
  i = this.$children.length
  while (i--) {
    this.$children[i].$destroy()
  }
  // teardown props
  if (this._propsUnlinkFn) {
    this._propsUnlinkFn()
  }
  // teardown all directives. this also tearsdown all
  // directive-owned watchers.
  if (this._unlinkFn) {
    this._unlinkFn()
  }
  i = this._watchers.length
  while (i--) {
    this._watchers[i].teardown()
  }
  // remove reference to self on $el
  if (this.$el) {
    this.$el.__vue__ = null
  }
  // remove DOM element
  var self = this
  if (remove && this.$el) {
    this.$remove(function () {
      self._cleanup()
    })
  } else if (!deferCleanup) {
    this._cleanup()
  }
}

/**
 * Clean up to ensure garbage collection.
 * This is called after the leave transition if there
 * is any.
 */

exports._cleanup = function () {
  // remove reference from data ob
  // frozen object may not have observer.
  if (this._data.__ob__) {
    this._data.__ob__.removeVm(this)
  }
  // Clean up references to private properties and other
  // instances. preserve reference to _data so that proxy
  // accessors still work. The only potential side effect
  // here is that mutating the instance after it's destroyed
  // may affect the state of other components that are still
  // observing the same object, but that seems to be a
  // reasonable responsibility for the user rather than
  // always throwing an error on them.
  this.$el =
  this.$parent =
  this.$root =
  this.$children =
  this._watchers =
  this._directives = null
  // call the last hook...
  this._isDestroyed = true
  this._callHook('destroyed')
  // turn off all instance listeners.
  this.$off()
}

},{"../compiler":20,"../directive":23,"../util":71}],51:[function(require,module,exports){
(function (process){
var _ = require('../util')
var inDoc = _.inDoc

/**
 * Setup the instance's option events & watchers.
 * If the value is a string, we pull it from the
 * instance's methods by name.
 */

exports._initEvents = function () {
  var options = this.$options
  registerCallbacks(this, '$on', options.events)
  registerCallbacks(this, '$watch', options.watch)
}

/**
 * Register callbacks for option events and watchers.
 *
 * @param {Vue} vm
 * @param {String} action
 * @param {Object} hash
 */

function registerCallbacks (vm, action, hash) {
  if (!hash) return
  var handlers, key, i, j
  for (key in hash) {
    handlers = hash[key]
    if (_.isArray(handlers)) {
      for (i = 0, j = handlers.length; i < j; i++) {
        register(vm, action, key, handlers[i])
      }
    } else {
      register(vm, action, key, handlers)
    }
  }
}

/**
 * Helper to register an event/watch callback.
 *
 * @param {Vue} vm
 * @param {String} action
 * @param {String} key
 * @param {Function|String|Object} handler
 * @param {Object} [options]
 */

function register (vm, action, key, handler, options) {
  var type = typeof handler
  if (type === 'function') {
    vm[action](key, handler, options)
  } else if (type === 'string') {
    var methods = vm.$options.methods
    var method = methods && methods[handler]
    if (method) {
      vm[action](key, method, options)
    } else {
      process.env.NODE_ENV !== 'production' && _.warn(
        'Unknown method: "' + handler + '" when ' +
        'registering callback for ' + action +
        ': "' + key + '".'
      )
    }
  } else if (handler && type === 'object') {
    register(vm, action, key, handler.handler, handler)
  }
}

/**
 * Setup recursive attached/detached calls
 */

exports._initDOMHooks = function () {
  this.$on('hook:attached', onAttached)
  this.$on('hook:detached', onDetached)
}

/**
 * Callback to recursively call attached hook on children
 */

function onAttached () {
  if (!this._isAttached) {
    this._isAttached = true
    this.$children.forEach(callAttach)
  }
}

/**
 * Iterator to call attached hook
 *
 * @param {Vue} child
 */

function callAttach (child) {
  if (!child._isAttached && inDoc(child.$el)) {
    child._callHook('attached')
  }
}

/**
 * Callback to recursively call detached hook on children
 */

function onDetached () {
  if (this._isAttached) {
    this._isAttached = false
    this.$children.forEach(callDetach)
  }
}

/**
 * Iterator to call detached hook
 *
 * @param {Vue} child
 */

function callDetach (child) {
  if (child._isAttached && !inDoc(child.$el)) {
    child._callHook('detached')
  }
}

/**
 * Trigger all handlers for a hook
 *
 * @param {String} hook
 */

exports._callHook = function (hook) {
  var handlers = this.$options[hook]
  if (handlers) {
    for (var i = 0, j = handlers.length; i < j; i++) {
      handlers[i].call(this)
    }
  }
  this.$emit('hook:' + hook)
}

}).call(this,require('_process'))

},{"../util":71,"_process":1}],52:[function(require,module,exports){
var mergeOptions = require('../util').mergeOptions

/**
 * The main init sequence. This is called for every
 * instance, including ones that are created from extended
 * constructors.
 *
 * @param {Object} options - this options object should be
 *                           the result of merging class
 *                           options and the options passed
 *                           in to the constructor.
 */

exports._init = function (options) {

  options = options || {}

  this.$el = null
  this.$parent = options._parent
  this.$root = options._root || this
  this.$children = []
  this.$ = {}           // child vm references
  this.$$ = {}          // element references
  this._watchers = []   // all watchers as an array
  this._directives = [] // all directives
  this._childCtors = {} // inherit:true constructors

  // a flag to avoid this being observed
  this._isVue = true

  // events bookkeeping
  this._events = {}            // registered callbacks
  this._eventsCount = {}       // for $broadcast optimization
  this._eventCancelled = false // for event cancellation

  // fragment instance properties
  this._isFragment = false
  this._fragmentStart =    // @type {CommentNode}
  this._fragmentEnd = null // @type {CommentNode}

  // lifecycle state
  this._isCompiled =
  this._isDestroyed =
  this._isReady =
  this._isAttached =
  this._isBeingDestroyed = false
  this._unlinkFn = null

  // context: the scope in which the component was used,
  // and the scope in which props and contents of this
  // instance should be compiled in.
  this._context =
    options._context ||
    options._parent

  // push self into parent / transclusion host
  if (this.$parent) {
    this.$parent.$children.push(this)
  }

  // props used in v-repeat diffing
  this._reused = false
  this._staggerOp = null

  // merge options.
  options = this.$options = mergeOptions(
    this.constructor.options,
    options,
    this
  )

  // initialize data as empty object.
  // it will be filled up in _initScope().
  this._data = {}

  // initialize data observation and scope inheritance.
  this._initScope()

  // setup event system and option events.
  this._initEvents()

  // call created hook
  this._callHook('created')

  // if `el` option is passed, start compilation.
  if (options.el) {
    this.$mount(options.el)
  }
}

},{"../util":71}],53:[function(require,module,exports){
(function (process){
var _ = require('../util')

/**
 * Apply a list of filter (descriptors) to a value.
 * Using plain for loops here because this will be called in
 * the getter of any watcher with filters so it is very
 * performance sensitive.
 *
 * @param {*} value
 * @param {*} [oldValue]
 * @param {Array} filters
 * @param {Boolean} write
 * @return {*}
 */

exports._applyFilters = function (value, oldValue, filters, write) {
  var filter, fn, args, arg, offset, i, l, j, k
  for (i = 0, l = filters.length; i < l; i++) {
    filter = filters[i]
    fn = _.resolveAsset(this.$options, 'filters', filter.name)
    if (process.env.NODE_ENV !== 'production') {
      _.assertAsset(fn, 'filter', filter.name)
    }
    if (!fn) continue
    fn = write ? fn.write : (fn.read || fn)
    if (typeof fn !== 'function') continue
    args = write ? [value, oldValue] : [value]
    offset = write ? 2 : 1
    if (filter.args) {
      for (j = 0, k = filter.args.length; j < k; j++) {
        arg = filter.args[j]
        args[j + offset] = arg.dynamic
          ? this.$get(arg.value)
          : arg.value
      }
    }
    value = fn.apply(this, args)
  }
  return value
}

/**
 * Resolve a component, depending on whether the component
 * is defined normally or using an async factory function.
 * Resolves synchronously if already resolved, otherwise
 * resolves asynchronously and caches the resolved
 * constructor on the factory.
 *
 * @param {String} id
 * @param {Function} cb
 */

exports._resolveComponent = function (id, cb) {
  var factory = _.resolveAsset(this.$options, 'components', id)
  if (process.env.NODE_ENV !== 'production') {
    _.assertAsset(factory, 'component', id)
  }
  if (!factory) {
    return
  }
  // async component factory
  if (!factory.options) {
    if (factory.resolved) {
      // cached
      cb(factory.resolved)
    } else if (factory.requested) {
      // pool callbacks
      factory.pendingCallbacks.push(cb)
    } else {
      factory.requested = true
      var cbs = factory.pendingCallbacks = [cb]
      factory(function resolve (res) {
        if (_.isPlainObject(res)) {
          res = _.Vue.extend(res)
        }
        // cache resolved
        factory.resolved = res
        // invoke callbacks
        for (var i = 0, l = cbs.length; i < l; i++) {
          cbs[i](res)
        }
      }, function reject (reason) {
        process.env.NODE_ENV !== 'production' && _.warn(
          'Failed to resolve async component: ' + id + '. ' +
          (reason ? '\nReason: ' + reason : '')
        )
      })
    }
  } else {
    // normal component
    cb(factory)
  }
}

}).call(this,require('_process'))

},{"../util":71,"_process":1}],54:[function(require,module,exports){
(function (process){
var _ = require('../util')
var compiler = require('../compiler')
var Observer = require('../observer')
var Dep = require('../observer/dep')
var Watcher = require('../watcher')

/**
 * Setup the scope of an instance, which contains:
 * - observed data
 * - computed properties
 * - user methods
 * - meta properties
 */

exports._initScope = function () {
  this._initProps()
  this._initMeta()
  this._initMethods()
  this._initData()
  this._initComputed()
}

/**
 * Initialize props.
 */

exports._initProps = function () {
  var options = this.$options
  var el = options.el
  var props = options.props
  if (props && !el) {
    process.env.NODE_ENV !== 'production' && _.warn(
      'Props will not be compiled if no `el` option is ' +
      'provided at instantiation.'
    )
  }
  // make sure to convert string selectors into element now
  el = options.el = _.query(el)
  this._propsUnlinkFn = el && el.nodeType === 1 && props
    ? compiler.compileAndLinkProps(
        this, el, props
      )
    : null
}

/**
 * Initialize the data.
 */

exports._initData = function () {
  var propsData = this._data
  var optionsDataFn = this.$options.data
  var optionsData = optionsDataFn && optionsDataFn()
  if (optionsData) {
    this._data = optionsData
    for (var prop in propsData) {
      if (
        this._props[prop].raw !== null ||
        !optionsData.hasOwnProperty(prop)
      ) {
        optionsData.$set(prop, propsData[prop])
      }
    }
  }
  var data = this._data
  // proxy data on instance
  var keys = Object.keys(data)
  var i, key
  i = keys.length
  while (i--) {
    key = keys[i]
    if (!_.isReserved(key)) {
      this._proxy(key)
    }
  }
  // observe data
  Observer.create(data, this)
}

/**
 * Swap the isntance's $data. Called in $data's setter.
 *
 * @param {Object} newData
 */

exports._setData = function (newData) {
  newData = newData || {}
  var oldData = this._data
  this._data = newData
  var keys, key, i
  // copy props.
  // this should only happen during a v-repeat of component
  // that also happens to have compiled props.
  var props = this.$options.props
  if (props) {
    i = props.length
    while (i--) {
      key = props[i].name
      if (key !== '$data' && !newData.hasOwnProperty(key)) {
        newData.$set(key, oldData[key])
      }
    }
  }
  // unproxy keys not present in new data
  keys = Object.keys(oldData)
  i = keys.length
  while (i--) {
    key = keys[i]
    if (!_.isReserved(key) && !(key in newData)) {
      this._unproxy(key)
    }
  }
  // proxy keys not already proxied,
  // and trigger change for changed values
  keys = Object.keys(newData)
  i = keys.length
  while (i--) {
    key = keys[i]
    if (!this.hasOwnProperty(key) && !_.isReserved(key)) {
      // new property
      this._proxy(key)
    }
  }
  oldData.__ob__.removeVm(this)
  Observer.create(newData, this)
  this._digest()
}

/**
 * Proxy a property, so that
 * vm.prop === vm._data.prop
 *
 * @param {String} key
 */

exports._proxy = function (key) {
  // need to store ref to self here
  // because these getter/setters might
  // be called by child instances!
  var self = this
  Object.defineProperty(self, key, {
    configurable: true,
    enumerable: true,
    get: function proxyGetter () {
      return self._data[key]
    },
    set: function proxySetter (val) {
      self._data[key] = val
    }
  })
}

/**
 * Unproxy a property.
 *
 * @param {String} key
 */

exports._unproxy = function (key) {
  delete this[key]
}

/**
 * Force update on every watcher in scope.
 */

exports._digest = function () {
  var i = this._watchers.length
  while (i--) {
    this._watchers[i].update(true) // shallow updates
  }
  var children = this.$children
  i = children.length
  while (i--) {
    var child = children[i]
    if (child.$options.inherit) {
      child._digest()
    }
  }
}

/**
 * Setup computed properties. They are essentially
 * special getter/setters
 */

function noop () {}
exports._initComputed = function () {
  var computed = this.$options.computed
  if (computed) {
    for (var key in computed) {
      var userDef = computed[key]
      var def = {
        enumerable: true,
        configurable: true
      }
      if (typeof userDef === 'function') {
        def.get = makeComputedGetter(userDef, this)
        def.set = noop
      } else {
        def.get = userDef.get
          ? userDef.cache !== false
            ? makeComputedGetter(userDef.get, this)
            : _.bind(userDef.get, this)
          : noop
        def.set = userDef.set
          ? _.bind(userDef.set, this)
          : noop
      }
      Object.defineProperty(this, key, def)
    }
  }
}

function makeComputedGetter (getter, owner) {
  var watcher = new Watcher(owner, getter, null, {
    lazy: true
  })
  return function computedGetter () {
    if (watcher.dirty) {
      watcher.evaluate()
    }
    if (Dep.target) {
      watcher.depend()
    }
    return watcher.value
  }
}

/**
 * Setup instance methods. Methods must be bound to the
 * instance since they might be called by children
 * inheriting them.
 */

exports._initMethods = function () {
  var methods = this.$options.methods
  if (methods) {
    for (var key in methods) {
      this[key] = _.bind(methods[key], this)
    }
  }
}

/**
 * Initialize meta information like $index, $key & $value.
 */

exports._initMeta = function () {
  var metas = this.$options._meta
  if (metas) {
    for (var key in metas) {
      this._defineMeta(key, metas[key])
    }
  }
}

/**
 * Define a meta property, e.g $index, $key, $value
 * which only exists on the vm instance but not in $data.
 *
 * @param {String} key
 * @param {*} value
 */

exports._defineMeta = function (key, value) {
  var dep = new Dep()
  Object.defineProperty(this, key, {
    get: function metaGetter () {
      if (Dep.target) {
        dep.depend()
      }
      return value
    },
    set: function metaSetter (val) {
      if (val !== value) {
        value = val
        dep.notify()
      }
    }
  })
}

}).call(this,require('_process'))

},{"../compiler":20,"../observer":57,"../observer/dep":56,"../util":71,"../watcher":75,"_process":1}],55:[function(require,module,exports){
var _ = require('../util')
var arrayProto = Array.prototype
var arrayMethods = Object.create(arrayProto)

/**
 * Intercept mutating methods and emit events
 */

;[
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]
.forEach(function (method) {
  // cache original method
  var original = arrayProto[method]
  _.define(arrayMethods, method, function mutator () {
    // avoid leaking arguments:
    // http://jsperf.com/closure-with-arguments
    var i = arguments.length
    var args = new Array(i)
    while (i--) {
      args[i] = arguments[i]
    }
    var result = original.apply(this, args)
    var ob = this.__ob__
    var inserted, removed
    switch (method) {
      case 'push':
        inserted = args
        break
      case 'unshift':
        inserted = args
        break
      case 'splice':
        inserted = args.slice(2)
        removed = result
        break
      case 'pop':
      case 'shift':
        removed = [result]
        break
    }
    if (inserted) ob.observeArray(inserted)
    if (removed) ob.unobserveArray(removed)
    // notify change
    ob.notify()
    return result
  })
})

/**
 * Swap the element at the given index with a new value
 * and emits corresponding event.
 *
 * @param {Number} index
 * @param {*} val
 * @return {*} - replaced element
 */

_.define(
  arrayProto,
  '$set',
  function $set (index, val) {
    if (index >= this.length) {
      this.length = index + 1
    }
    return this.splice(index, 1, val)[0]
  }
)

/**
 * Convenience method to remove the element at given index.
 *
 * @param {Number} index
 * @param {*} val
 */

_.define(
  arrayProto,
  '$remove',
  function $remove (index) {
    /* istanbul ignore if */
    if (!this.length) return
    if (typeof index !== 'number') {
      index = _.indexOf(this, index)
    }
    if (index > -1) {
      return this.splice(index, 1)
    }
  }
)

module.exports = arrayMethods

},{"../util":71}],56:[function(require,module,exports){
var _ = require('../util')

/**
 * A dep is an observable that can have multiple
 * directives subscribing to it.
 *
 * @constructor
 */

function Dep () {
  this.subs = []
}

// the current target watcher being evaluated.
// this is globally unique because there could be only one
// watcher being evaluated at any time.
Dep.target = null

/**
 * Add a directive subscriber.
 *
 * @param {Directive} sub
 */

Dep.prototype.addSub = function (sub) {
  this.subs.push(sub)
}

/**
 * Remove a directive subscriber.
 *
 * @param {Directive} sub
 */

Dep.prototype.removeSub = function (sub) {
  this.subs.$remove(sub)
}

/**
 * Add self as a dependency to the target watcher.
 */

Dep.prototype.depend = function () {
  Dep.target.addDep(this)
}

/**
 * Notify all subscribers of a new value.
 */

Dep.prototype.notify = function () {
  // stablize the subscriber list first
  var subs = _.toArray(this.subs)
  for (var i = 0, l = subs.length; i < l; i++) {
    subs[i].update()
  }
}

module.exports = Dep

},{"../util":71}],57:[function(require,module,exports){
var _ = require('../util')
var config = require('../config')
var Dep = require('./dep')
var arrayMethods = require('./array')
var arrayKeys = Object.getOwnPropertyNames(arrayMethods)
require('./object')

/**
 * Observer class that are attached to each observed
 * object. Once attached, the observer converts target
 * object's property keys into getter/setters that
 * collect dependencies and dispatches updates.
 *
 * @param {Array|Object} value
 * @constructor
 */

function Observer (value) {
  this.value = value
  this.dep = new Dep()
  _.define(value, '__ob__', this)
  if (_.isArray(value)) {
    var augment = config.proto && _.hasProto
      ? protoAugment
      : copyAugment
    augment(value, arrayMethods, arrayKeys)
    this.observeArray(value)
  } else {
    this.walk(value)
  }
}

// Static methods

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 *
 * @param {*} value
 * @param {Vue} [vm]
 * @return {Observer|undefined}
 * @static
 */

Observer.create = function (value, vm) {
  var ob
  if (
    value &&
    value.hasOwnProperty('__ob__') &&
    value.__ob__ instanceof Observer
  ) {
    ob = value.__ob__
  } else if (
    (_.isArray(value) || _.isPlainObject(value)) &&
    !Object.isFrozen(value) &&
    !value._isVue
  ) {
    ob = new Observer(value)
  }
  if (ob && vm) {
    ob.addVm(vm)
  }
  return ob
}

// Instance methods

/**
 * Walk through each property and convert them into
 * getter/setters. This method should only be called when
 * value type is Object. Properties prefixed with `$` or `_`
 * and accessor properties are ignored.
 *
 * @param {Object} obj
 */

Observer.prototype.walk = function (obj) {
  var keys = Object.keys(obj)
  var i = keys.length
  while (i--) {
    this.convert(keys[i], obj[keys[i]])
  }
}

/**
 * Try to carete an observer for a child value,
 * and if value is array, link dep to the array.
 *
 * @param {*} val
 * @return {Dep|undefined}
 */

Observer.prototype.observe = function (val) {
  return Observer.create(val)
}

/**
 * Observe a list of Array items.
 *
 * @param {Array} items
 */

Observer.prototype.observeArray = function (items) {
  var i = items.length
  while (i--) {
    var ob = this.observe(items[i])
    if (ob) {
      (ob.parents || (ob.parents = [])).push(this)
    }
  }
}

/**
 * Remove self from the parent list of removed objects.
 *
 * @param {Array} items
 */

Observer.prototype.unobserveArray = function (items) {
  var i = items.length
  while (i--) {
    var ob = items[i] && items[i].__ob__
    if (ob) {
      ob.parents.$remove(this)
    }
  }
}

/**
 * Notify self dependency, and also parent Array dependency
 * if any.
 */

Observer.prototype.notify = function () {
  this.dep.notify()
  var parents = this.parents
  if (parents) {
    var i = parents.length
    while (i--) {
      parents[i].notify()
    }
  }
}

/**
 * Convert a property into getter/setter so we can emit
 * the events when the property is accessed/changed.
 *
 * @param {String} key
 * @param {*} val
 */

Observer.prototype.convert = function (key, val) {
  var ob = this
  var childOb = ob.observe(val)
  var dep = new Dep()
  Object.defineProperty(ob.value, key, {
    enumerable: true,
    configurable: true,
    get: function () {
      if (Dep.target) {
        dep.depend()
        if (childOb) {
          childOb.dep.depend()
        }
      }
      return val
    },
    set: function (newVal) {
      if (newVal === val) return
      val = newVal
      childOb = ob.observe(newVal)
      dep.notify()
    }
  })
}

/**
 * Add an owner vm, so that when $add/$delete mutations
 * happen we can notify owner vms to proxy the keys and
 * digest the watchers. This is only called when the object
 * is observed as an instance's root $data.
 *
 * @param {Vue} vm
 */

Observer.prototype.addVm = function (vm) {
  (this.vms || (this.vms = [])).push(vm)
}

/**
 * Remove an owner vm. This is called when the object is
 * swapped out as an instance's $data object.
 *
 * @param {Vue} vm
 */

Observer.prototype.removeVm = function (vm) {
  this.vms.$remove(vm)
}

// helpers

/**
 * Augment an target Object or Array by intercepting
 * the prototype chain using __proto__
 *
 * @param {Object|Array} target
 * @param {Object} proto
 */

function protoAugment (target, src) {
  target.__proto__ = src
}

/**
 * Augment an target Object or Array by defining
 * hidden properties.
 *
 * @param {Object|Array} target
 * @param {Object} proto
 */

function copyAugment (target, src, keys) {
  var i = keys.length
  var key
  while (i--) {
    key = keys[i]
    _.define(target, key, src[key])
  }
}

module.exports = Observer

},{"../config":22,"../util":71,"./array":55,"./dep":56,"./object":58}],58:[function(require,module,exports){
var _ = require('../util')
var objProto = Object.prototype

/**
 * Add a new property to an observed object
 * and emits corresponding event
 *
 * @param {String} key
 * @param {*} val
 * @public
 */

_.define(
  objProto,
  '$add',
  function $add (key, val) {
    if (this.hasOwnProperty(key)) return
    var ob = this.__ob__
    if (!ob || _.isReserved(key)) {
      this[key] = val
      return
    }
    ob.convert(key, val)
    ob.notify()
    if (ob.vms) {
      var i = ob.vms.length
      while (i--) {
        var vm = ob.vms[i]
        vm._proxy(key)
        vm._digest()
      }
    }
  }
)

/**
 * Set a property on an observed object, calling add to
 * ensure the property is observed.
 *
 * @param {String} key
 * @param {*} val
 * @public
 */

_.define(
  objProto,
  '$set',
  function $set (key, val) {
    this.$add(key, val)
    this[key] = val
  }
)

/**
 * Deletes a property from an observed object
 * and emits corresponding event
 *
 * @param {String} key
 * @public
 */

_.define(
  objProto,
  '$delete',
  function $delete (key) {
    if (!this.hasOwnProperty(key)) return
    delete this[key]
    var ob = this.__ob__
    if (!ob || _.isReserved(key)) {
      return
    }
    ob.notify()
    if (ob.vms) {
      var i = ob.vms.length
      while (i--) {
        var vm = ob.vms[i]
        vm._unproxy(key)
        vm._digest()
      }
    }
  }
)

},{"../util":71}],59:[function(require,module,exports){
var _ = require('../util')
var Cache = require('../cache')
var cache = new Cache(1000)
var argRE = /^[^\{\?]+$|^'[^']*'$|^"[^"]*"$/
var filterTokenRE = /[^\s'"]+|'[^']*'|"[^"]*"/g
var reservedArgRE = /^in$|^-?\d+/

/**
 * Parser state
 */

var str
var c, i, l
var inSingle
var inDouble
var curly
var square
var paren
var begin
var argIndex
var dirs
var dir
var lastFilterIndex
var arg

/**
 * Push a directive object into the result Array
 */

function pushDir () {
  dir.raw = str.slice(begin, i).trim()
  if (dir.expression === undefined) {
    dir.expression = str.slice(argIndex, i).trim()
  } else if (lastFilterIndex !== begin) {
    pushFilter()
  }
  if (i === 0 || dir.expression) {
    dirs.push(dir)
  }
}

/**
 * Push a filter to the current directive object
 */

function pushFilter () {
  var exp = str.slice(lastFilterIndex, i).trim()
  var filter
  if (exp) {
    filter = {}
    var tokens = exp.match(filterTokenRE)
    filter.name = tokens[0]
    if (tokens.length > 1) {
      filter.args = tokens.slice(1).map(processFilterArg)
    }
  }
  if (filter) {
    (dir.filters = dir.filters || []).push(filter)
  }
  lastFilterIndex = i + 1
}

/**
 * Check if an argument is dynamic and strip quotes.
 *
 * @param {String} arg
 * @return {Object}
 */

function processFilterArg (arg) {
  var stripped = reservedArgRE.test(arg)
    ? arg
    : _.stripQuotes(arg)
  var dynamic = stripped === false
  return {
    value: dynamic ? arg : stripped,
    dynamic: dynamic
  }
}

/**
 * Parse a directive string into an Array of AST-like
 * objects representing directives.
 *
 * Example:
 *
 * "click: a = a + 1 | uppercase" will yield:
 * {
 *   arg: 'click',
 *   expression: 'a = a + 1',
 *   filters: [
 *     { name: 'uppercase', args: null }
 *   ]
 * }
 *
 * @param {String} str
 * @return {Array<Object>}
 */

exports.parse = function (s) {

  var hit = cache.get(s)
  if (hit) {
    return hit
  }

  // reset parser state
  str = s
  inSingle = inDouble = false
  curly = square = paren = begin = argIndex = 0
  lastFilterIndex = 0
  dirs = []
  dir = {}
  arg = null

  for (i = 0, l = str.length; i < l; i++) {
    c = str.charCodeAt(i)
    if (inSingle) {
      // check single quote
      if (c === 0x27) inSingle = !inSingle
    } else if (inDouble) {
      // check double quote
      if (c === 0x22) inDouble = !inDouble
    } else if (
      c === 0x2C && // comma
      !paren && !curly && !square
    ) {
      // reached the end of a directive
      pushDir()
      // reset & skip the comma
      dir = {}
      begin = argIndex = lastFilterIndex = i + 1
    } else if (
      c === 0x3A && // colon
      !dir.expression &&
      !dir.arg
    ) {
      // argument
      arg = str.slice(begin, i).trim()
      // test for valid argument here
      // since we may have caught stuff like first half of
      // an object literal or a ternary expression.
      if (argRE.test(arg)) {
        argIndex = i + 1
        dir.arg = _.stripQuotes(arg) || arg
      }
    } else if (
      c === 0x7C && // pipe
      str.charCodeAt(i + 1) !== 0x7C &&
      str.charCodeAt(i - 1) !== 0x7C
    ) {
      if (dir.expression === undefined) {
        // first filter, end of expression
        lastFilterIndex = i + 1
        dir.expression = str.slice(argIndex, i).trim()
      } else {
        // already has filter
        pushFilter()
      }
    } else {
      switch (c) {
        case 0x22: inDouble = true; break // "
        case 0x27: inSingle = true; break // '
        case 0x28: paren++; break         // (
        case 0x29: paren--; break         // )
        case 0x5B: square++; break        // [
        case 0x5D: square--; break        // ]
        case 0x7B: curly++; break         // {
        case 0x7D: curly--; break         // }
      }
    }
  }

  if (i === 0 || begin !== i) {
    pushDir()
  }

  cache.put(s, dirs)
  return dirs
}

},{"../cache":17,"../util":71}],60:[function(require,module,exports){
(function (process){
var _ = require('../util')
var Path = require('./path')
var Cache = require('../cache')
var expressionCache = new Cache(1000)

var allowedKeywords =
  'Math,Date,this,true,false,null,undefined,Infinity,NaN,' +
  'isNaN,isFinite,decodeURI,decodeURIComponent,encodeURI,' +
  'encodeURIComponent,parseInt,parseFloat'
var allowedKeywordsRE =
  new RegExp('^(' + allowedKeywords.replace(/,/g, '\\b|') + '\\b)')

// keywords that don't make sense inside expressions
var improperKeywords =
  'break,case,class,catch,const,continue,debugger,default,' +
  'delete,do,else,export,extends,finally,for,function,if,' +
  'import,in,instanceof,let,return,super,switch,throw,try,' +
  'var,while,with,yield,enum,await,implements,package,' +
  'proctected,static,interface,private,public'
var improperKeywordsRE =
  new RegExp('^(' + improperKeywords.replace(/,/g, '\\b|') + '\\b)')

var wsRE = /\s/g
var newlineRE = /\n/g
var saveRE = /[\{,]\s*[\w\$_]+\s*:|('[^']*'|"[^"]*")|new |typeof |void /g
var restoreRE = /"(\d+)"/g
var pathTestRE = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*|\['.*?'\]|\[".*?"\]|\[\d+\]|\[[A-Za-z_$][\w$]*\])*$/
var pathReplaceRE = /[^\w$\.]([A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*|\['.*?'\]|\[".*?"\])*)/g
var booleanLiteralRE = /^(true|false)$/

/**
 * Save / Rewrite / Restore
 *
 * When rewriting paths found in an expression, it is
 * possible for the same letter sequences to be found in
 * strings and Object literal property keys. Therefore we
 * remove and store these parts in a temporary array, and
 * restore them after the path rewrite.
 */

var saved = []

/**
 * Save replacer
 *
 * The save regex can match two possible cases:
 * 1. An opening object literal
 * 2. A string
 * If matched as a plain string, we need to escape its
 * newlines, since the string needs to be preserved when
 * generating the function body.
 *
 * @param {String} str
 * @param {String} isString - str if matched as a string
 * @return {String} - placeholder with index
 */

function save (str, isString) {
  var i = saved.length
  saved[i] = isString
    ? str.replace(newlineRE, '\\n')
    : str
  return '"' + i + '"'
}

/**
 * Path rewrite replacer
 *
 * @param {String} raw
 * @return {String}
 */

function rewrite (raw) {
  var c = raw.charAt(0)
  var path = raw.slice(1)
  if (allowedKeywordsRE.test(path)) {
    return raw
  } else {
    path = path.indexOf('"') > -1
      ? path.replace(restoreRE, restore)
      : path
    return c + 'scope.' + path
  }
}

/**
 * Restore replacer
 *
 * @param {String} str
 * @param {String} i - matched save index
 * @return {String}
 */

function restore (str, i) {
  return saved[i]
}

/**
 * Rewrite an expression, prefixing all path accessors with
 * `scope.` and generate getter/setter functions.
 *
 * @param {String} exp
 * @param {Boolean} needSet
 * @return {Function}
 */

function compileExpFns (exp, needSet) {
  if (improperKeywordsRE.test(exp)) {
    process.env.NODE_ENV !== 'production' && _.warn(
      'Avoid using reserved keywords in expression: ' + exp
    )
  }
  // reset state
  saved.length = 0
  // save strings and object literal keys
  var body = exp
    .replace(saveRE, save)
    .replace(wsRE, '')
  // rewrite all paths
  // pad 1 space here becaue the regex matches 1 extra char
  body = (' ' + body)
    .replace(pathReplaceRE, rewrite)
    .replace(restoreRE, restore)
  var getter = makeGetter(body)
  if (getter) {
    return {
      get: getter,
      body: body,
      set: needSet
        ? makeSetter(body)
        : null
    }
  }
}

/**
 * Compile getter setters for a simple path.
 *
 * @param {String} exp
 * @return {Function}
 */

function compilePathFns (exp) {
  var getter, path
  if (exp.indexOf('[') < 0) {
    // really simple path
    path = exp.split('.')
    path.raw = exp
    getter = Path.compileGetter(path)
  } else {
    // do the real parsing
    path = Path.parse(exp)
    getter = path.get
  }
  return {
    get: getter,
    // always generate setter for simple paths
    set: function (obj, val) {
      Path.set(obj, path, val)
    }
  }
}

/**
 * Build a getter function. Requires eval.
 *
 * We isolate the try/catch so it doesn't affect the
 * optimization of the parse function when it is not called.
 *
 * @param {String} body
 * @return {Function|undefined}
 */

function makeGetter (body) {
  try {
    return new Function('scope', 'return ' + body + ';')
  } catch (e) {
    process.env.NODE_ENV !== 'production' && _.warn(
      'Invalid expression. ' +
      'Generated function body: ' + body
    )
  }
}

/**
 * Build a setter function.
 *
 * This is only needed in rare situations like "a[b]" where
 * a settable path requires dynamic evaluation.
 *
 * This setter function may throw error when called if the
 * expression body is not a valid left-hand expression in
 * assignment.
 *
 * @param {String} body
 * @return {Function|undefined}
 */

function makeSetter (body) {
  try {
    return new Function('scope', 'value', body + '=value;')
  } catch (e) {
    process.env.NODE_ENV !== 'production' && _.warn(
      'Invalid setter function body: ' + body
    )
  }
}

/**
 * Check for setter existence on a cache hit.
 *
 * @param {Function} hit
 */

function checkSetter (hit) {
  if (!hit.set) {
    hit.set = makeSetter(hit.body)
  }
}

/**
 * Parse an expression into re-written getter/setters.
 *
 * @param {String} exp
 * @param {Boolean} needSet
 * @return {Function}
 */

exports.parse = function (exp, needSet) {
  exp = exp.trim()
  // try cache
  var hit = expressionCache.get(exp)
  if (hit) {
    if (needSet) {
      checkSetter(hit)
    }
    return hit
  }
  // we do a simple path check to optimize for them.
  // the check fails valid paths with unusal whitespaces,
  // but that's too rare and we don't care.
  // also skip boolean literals and paths that start with
  // global "Math"
  var res = exports.isSimplePath(exp)
    ? compilePathFns(exp)
    : compileExpFns(exp, needSet)
  expressionCache.put(exp, res)
  return res
}

/**
 * Check if an expression is a simple path.
 *
 * @param {String} exp
 * @return {Boolean}
 */

exports.isSimplePath = function (exp) {
  return pathTestRE.test(exp) &&
    // don't treat true/false as paths
    !booleanLiteralRE.test(exp) &&
    // Math constants e.g. Math.PI, Math.E etc.
    exp.slice(0, 5) !== 'Math.'
}

}).call(this,require('_process'))

},{"../cache":17,"../util":71,"./path":61,"_process":1}],61:[function(require,module,exports){
(function (process){
var _ = require('../util')
var Cache = require('../cache')
var pathCache = new Cache(1000)
var identRE = exports.identRE = /^[$_a-zA-Z]+[\w$]*$/

// actions
var APPEND = 0
var PUSH = 1

// states
var BEFORE_PATH = 0
var IN_PATH = 1
var BEFORE_IDENT = 2
var IN_IDENT = 3
var BEFORE_ELEMENT = 4
var AFTER_ZERO = 5
var IN_INDEX = 6
var IN_SINGLE_QUOTE = 7
var IN_DOUBLE_QUOTE = 8
var IN_SUB_PATH = 9
var AFTER_ELEMENT = 10
var AFTER_PATH = 11
var ERROR = 12

var pathStateMachine = []

pathStateMachine[BEFORE_PATH] = {
  'ws': [BEFORE_PATH],
  'ident': [IN_IDENT, APPEND],
  '[': [BEFORE_ELEMENT],
  'eof': [AFTER_PATH]
}

pathStateMachine[IN_PATH] = {
  'ws': [IN_PATH],
  '.': [BEFORE_IDENT],
  '[': [BEFORE_ELEMENT],
  'eof': [AFTER_PATH]
}

pathStateMachine[BEFORE_IDENT] = {
  'ws': [BEFORE_IDENT],
  'ident': [IN_IDENT, APPEND]
}

pathStateMachine[IN_IDENT] = {
  'ident': [IN_IDENT, APPEND],
  '0': [IN_IDENT, APPEND],
  'number': [IN_IDENT, APPEND],
  'ws': [IN_PATH, PUSH],
  '.': [BEFORE_IDENT, PUSH],
  '[': [BEFORE_ELEMENT, PUSH],
  'eof': [AFTER_PATH, PUSH]
}

pathStateMachine[BEFORE_ELEMENT] = {
  'ws': [BEFORE_ELEMENT],
  '0': [AFTER_ZERO, APPEND],
  'number': [IN_INDEX, APPEND],
  "'": [IN_SINGLE_QUOTE, APPEND, ''],
  '"': [IN_DOUBLE_QUOTE, APPEND, ''],
  'ident': [IN_SUB_PATH, APPEND, '*']
}

pathStateMachine[AFTER_ZERO] = {
  'ws': [AFTER_ELEMENT, PUSH],
  ']': [IN_PATH, PUSH]
}

pathStateMachine[IN_INDEX] = {
  '0': [IN_INDEX, APPEND],
  'number': [IN_INDEX, APPEND],
  'ws': [AFTER_ELEMENT],
  ']': [IN_PATH, PUSH]
}

pathStateMachine[IN_SINGLE_QUOTE] = {
  "'": [AFTER_ELEMENT],
  'eof': ERROR,
  'else': [IN_SINGLE_QUOTE, APPEND]
}

pathStateMachine[IN_DOUBLE_QUOTE] = {
  '"': [AFTER_ELEMENT],
  'eof': ERROR,
  'else': [IN_DOUBLE_QUOTE, APPEND]
}

pathStateMachine[IN_SUB_PATH] = {
  'ident': [IN_SUB_PATH, APPEND],
  '0': [IN_SUB_PATH, APPEND],
  'number': [IN_SUB_PATH, APPEND],
  'ws': [AFTER_ELEMENT],
  ']': [IN_PATH, PUSH]
}

pathStateMachine[AFTER_ELEMENT] = {
  'ws': [AFTER_ELEMENT],
  ']': [IN_PATH, PUSH]
}

/**
 * Determine the type of a character in a keypath.
 *
 * @param {Char} ch
 * @return {String} type
 */

function getPathCharType (ch) {
  if (ch === undefined) {
    return 'eof'
  }

  var code = ch.charCodeAt(0)

  switch (code) {
    case 0x5B: // [
    case 0x5D: // ]
    case 0x2E: // .
    case 0x22: // "
    case 0x27: // '
    case 0x30: // 0
      return ch

    case 0x5F: // _
    case 0x24: // $
      return 'ident'

    case 0x20: // Space
    case 0x09: // Tab
    case 0x0A: // Newline
    case 0x0D: // Return
    case 0xA0:  // No-break space
    case 0xFEFF:  // Byte Order Mark
    case 0x2028:  // Line Separator
    case 0x2029:  // Paragraph Separator
      return 'ws'
  }

  // a-z, A-Z
  if (
    (code >= 0x61 && code <= 0x7A) ||
    (code >= 0x41 && code <= 0x5A)
  ) {
    return 'ident'
  }

  // 1-9
  if (code >= 0x31 && code <= 0x39) {
    return 'number'
  }

  return 'else'
}

/**
 * Parse a string path into an array of segments
 * Todo implement cache
 *
 * @param {String} path
 * @return {Array|undefined}
 */

function parsePath (path) {
  var keys = []
  var index = -1
  var mode = BEFORE_PATH
  var c, newChar, key, type, transition, action, typeMap

  var actions = []
  actions[PUSH] = function () {
    if (key === undefined) {
      return
    }
    keys.push(key)
    key = undefined
  }
  actions[APPEND] = function () {
    if (key === undefined) {
      key = newChar
    } else {
      key += newChar
    }
  }

  function maybeUnescapeQuote () {
    var nextChar = path[index + 1]
    if ((mode === IN_SINGLE_QUOTE && nextChar === "'") ||
        (mode === IN_DOUBLE_QUOTE && nextChar === '"')) {
      index++
      newChar = nextChar
      actions[APPEND]()
      return true
    }
  }

  while (mode != null) {
    index++
    c = path[index]

    if (c === '\\' && maybeUnescapeQuote()) {
      continue
    }

    type = getPathCharType(c)
    typeMap = pathStateMachine[mode]
    transition = typeMap[type] || typeMap['else'] || ERROR

    if (transition === ERROR) {
      return // parse error
    }

    mode = transition[0]
    action = actions[transition[1]]
    if (action) {
      newChar = transition[2]
      newChar = newChar === undefined
        ? c
        : newChar === '*'
          ? newChar + c
          : newChar
      action()
    }

    if (mode === AFTER_PATH) {
      keys.raw = path
      return keys
    }
  }
}

/**
 * Format a accessor segment based on its type.
 *
 * @param {String} key
 * @return {Boolean}
 */

function formatAccessor (key) {
  if (identRE.test(key)) { // identifier
    return '.' + key
  } else if (+key === key >>> 0) { // bracket index
    return '[' + key + ']'
  } else if (key.charAt(0) === '*') {
    return '[o' + formatAccessor(key.slice(1)) + ']'
  } else { // bracket string
    return '["' + key.replace(/"/g, '\\"') + '"]'
  }
}

/**
 * Compiles a getter function with a fixed path.
 * The fixed path getter supresses errors.
 *
 * @param {Array} path
 * @return {Function}
 */

exports.compileGetter = function (path) {
  var body = 'return o' + path.map(formatAccessor).join('')
  return new Function('o', body)
}

/**
 * External parse that check for a cache hit first
 *
 * @param {String} path
 * @return {Array|undefined}
 */

exports.parse = function (path) {
  var hit = pathCache.get(path)
  if (!hit) {
    hit = parsePath(path)
    if (hit) {
      hit.get = exports.compileGetter(hit)
      pathCache.put(path, hit)
    }
  }
  return hit
}

/**
 * Get from an object from a path string
 *
 * @param {Object} obj
 * @param {String} path
 */

exports.get = function (obj, path) {
  path = exports.parse(path)
  if (path) {
    return path.get(obj)
  }
}

/**
 * Set on an object from a path
 *
 * @param {Object} obj
 * @param {String | Array} path
 * @param {*} val
 */

exports.set = function (obj, path, val) {
  var original = obj
  if (typeof path === 'string') {
    path = exports.parse(path)
  }
  if (!path || !_.isObject(obj)) {
    return false
  }
  var last, key
  for (var i = 0, l = path.length; i < l; i++) {
    last = obj
    key = path[i]
    if (key.charAt(0) === '*') {
      key = original[key.slice(1)]
    }
    if (i < l - 1) {
      obj = obj[key]
      if (!_.isObject(obj)) {
        warnNonExistent(path)
        obj = {}
        last.$add(key, obj)
      }
    } else {
      if (_.isArray(obj)) {
        obj.$set(key, val)
      } else if (key in obj) {
        obj[key] = val
      } else {
        warnNonExistent(path)
        obj.$add(key, val)
      }
    }
  }
  return true
}

function warnNonExistent (path) {
  process.env.NODE_ENV !== 'production' && _.warn(
    'You are setting a non-existent path "' + path.raw + '" ' +
    'on a vm instance. Consider pre-initializing the property ' +
    'with the "data" option for more reliable reactivity ' +
    'and better performance.'
  )
}

}).call(this,require('_process'))

},{"../cache":17,"../util":71,"_process":1}],62:[function(require,module,exports){
var _ = require('../util')
var Cache = require('../cache')
var templateCache = new Cache(1000)
var idSelectorCache = new Cache(1000)

var map = {
  _default: [0, '', ''],
  legend: [1, '<fieldset>', '</fieldset>'],
  tr: [2, '<table><tbody>', '</tbody></table>'],
  col: [
    2,
    '<table><tbody></tbody><colgroup>',
    '</colgroup></table>'
  ]
}

map.td =
map.th = [
  3,
  '<table><tbody><tr>',
  '</tr></tbody></table>'
]

map.option =
map.optgroup = [
  1,
  '<select multiple="multiple">',
  '</select>'
]

map.thead =
map.tbody =
map.colgroup =
map.caption =
map.tfoot = [1, '<table>', '</table>']

map.g =
map.defs =
map.symbol =
map.use =
map.image =
map.text =
map.circle =
map.ellipse =
map.line =
map.path =
map.polygon =
map.polyline =
map.rect = [
  1,
  '<svg ' +
    'xmlns="http://www.w3.org/2000/svg" ' +
    'xmlns:xlink="http://www.w3.org/1999/xlink" ' +
    'xmlns:ev="http://www.w3.org/2001/xml-events"' +
    'version="1.1">',
  '</svg>'
]

/**
 * Check if a node is a supported template node with a
 * DocumentFragment content.
 *
 * @param {Node} node
 * @return {Boolean}
 */

function isRealTemplate (node) {
  return _.isTemplate(node) &&
    node.content instanceof DocumentFragment
}

var tagRE = /<([\w:]+)/
var entityRE = /&\w+;/

/**
 * Convert a string template to a DocumentFragment.
 * Determines correct wrapping by tag types. Wrapping
 * strategy found in jQuery & component/domify.
 *
 * @param {String} templateString
 * @return {DocumentFragment}
 */

function stringToFragment (templateString) {
  // try a cache hit first
  var hit = templateCache.get(templateString)
  if (hit) {
    return hit
  }

  var frag = document.createDocumentFragment()
  var tagMatch = templateString.match(tagRE)
  var entityMatch = entityRE.test(templateString)

  if (!tagMatch && !entityMatch) {
    // text only, return a single text node.
    frag.appendChild(
      document.createTextNode(templateString)
    )
  } else {

    var tag = tagMatch && tagMatch[1]
    var wrap = map[tag] || map._default
    var depth = wrap[0]
    var prefix = wrap[1]
    var suffix = wrap[2]
    var node = document.createElement('div')

    node.innerHTML = prefix + templateString.trim() + suffix
    while (depth--) {
      node = node.lastChild
    }

    var child
    /* eslint-disable no-cond-assign */
    while (child = node.firstChild) {
    /* eslint-enable no-cond-assign */
      frag.appendChild(child)
    }
  }

  templateCache.put(templateString, frag)
  return frag
}

/**
 * Convert a template node to a DocumentFragment.
 *
 * @param {Node} node
 * @return {DocumentFragment}
 */

function nodeToFragment (node) {
  // if its a template tag and the browser supports it,
  // its content is already a document fragment.
  if (isRealTemplate(node)) {
    _.trimNode(node.content)
    return node.content
  }
  // script template
  if (node.tagName === 'SCRIPT') {
    return stringToFragment(node.textContent)
  }
  // normal node, clone it to avoid mutating the original
  var clone = exports.clone(node)
  var frag = document.createDocumentFragment()
  var child
  /* eslint-disable no-cond-assign */
  while (child = clone.firstChild) {
  /* eslint-enable no-cond-assign */
    frag.appendChild(child)
  }
  _.trimNode(frag)
  return frag
}

// Test for the presence of the Safari template cloning bug
// https://bugs.webkit.org/show_bug.cgi?id=137755
var hasBrokenTemplate = _.inBrowser
  ? (function () {
      var a = document.createElement('div')
      a.innerHTML = '<template>1</template>'
      return !a.cloneNode(true).firstChild.innerHTML
    })()
  : false

// Test for IE10/11 textarea placeholder clone bug
var hasTextareaCloneBug = _.inBrowser
  ? (function () {
      var t = document.createElement('textarea')
      t.placeholder = 't'
      return t.cloneNode(true).value === 't'
    })()
  : false

/**
 * 1. Deal with Safari cloning nested <template> bug by
 *    manually cloning all template instances.
 * 2. Deal with IE10/11 textarea placeholder bug by setting
 *    the correct value after cloning.
 *
 * @param {Element|DocumentFragment} node
 * @return {Element|DocumentFragment}
 */

exports.clone = function (node) {
  if (!node.querySelectorAll) {
    return node.cloneNode()
  }
  var res = node.cloneNode(true)
  var i, original, cloned
  /* istanbul ignore if */
  if (hasBrokenTemplate) {
    var clone = res
    if (isRealTemplate(node)) {
      node = node.content
      clone = res.content
    }
    original = node.querySelectorAll('template')
    if (original.length) {
      cloned = clone.querySelectorAll('template')
      i = cloned.length
      while (i--) {
        cloned[i].parentNode.replaceChild(
          exports.clone(original[i]),
          cloned[i]
        )
      }
    }
  }
  /* istanbul ignore if */
  if (hasTextareaCloneBug) {
    if (node.tagName === 'TEXTAREA') {
      res.value = node.value
    } else {
      original = node.querySelectorAll('textarea')
      if (original.length) {
        cloned = res.querySelectorAll('textarea')
        i = cloned.length
        while (i--) {
          cloned[i].value = original[i].value
        }
      }
    }
  }
  return res
}

/**
 * Process the template option and normalizes it into a
 * a DocumentFragment that can be used as a partial or a
 * instance template.
 *
 * @param {*} template
 *    Possible values include:
 *    - DocumentFragment object
 *    - Node object of type Template
 *    - id selector: '#some-template-id'
 *    - template string: '<div><span>{{msg}}</span></div>'
 * @param {Boolean} clone
 * @param {Boolean} noSelector
 * @return {DocumentFragment|undefined}
 */

exports.parse = function (template, clone, noSelector) {
  var node, frag

  // if the template is already a document fragment,
  // do nothing
  if (template instanceof DocumentFragment) {
    _.trimNode(template)
    return clone
      ? exports.clone(template)
      : template
  }

  if (typeof template === 'string') {
    // id selector
    if (!noSelector && template.charAt(0) === '#') {
      // id selector can be cached too
      frag = idSelectorCache.get(template)
      if (!frag) {
        node = document.getElementById(template.slice(1))
        if (node) {
          frag = nodeToFragment(node)
          // save selector to cache
          idSelectorCache.put(template, frag)
        }
      }
    } else {
      // normal string template
      frag = stringToFragment(template)
    }
  } else if (template.nodeType) {
    // a direct node
    frag = nodeToFragment(template)
  }

  return frag && clone
    ? exports.clone(frag)
    : frag
}

},{"../cache":17,"../util":71}],63:[function(require,module,exports){
var Cache = require('../cache')
var config = require('../config')
var dirParser = require('./directive')
var regexEscapeRE = /[-.*+?^${}()|[\]\/\\]/g
var cache, tagRE, htmlRE, firstChar, lastChar

/**
 * Escape a string so it can be used in a RegExp
 * constructor.
 *
 * @param {String} str
 */

function escapeRegex (str) {
  return str.replace(regexEscapeRE, '\\$&')
}

/**
 * Compile the interpolation tag regex.
 *
 * @return {RegExp}
 */

function compileRegex () {
  config._delimitersChanged = false
  var open = config.delimiters[0]
  var close = config.delimiters[1]
  firstChar = open.charAt(0)
  lastChar = close.charAt(close.length - 1)
  var firstCharRE = escapeRegex(firstChar)
  var lastCharRE = escapeRegex(lastChar)
  var openRE = escapeRegex(open)
  var closeRE = escapeRegex(close)
  tagRE = new RegExp(
    firstCharRE + '?' + openRE +
    '(.+?)' +
    closeRE + lastCharRE + '?',
    'g'
  )
  htmlRE = new RegExp(
    '^' + firstCharRE + openRE +
    '.*' +
    closeRE + lastCharRE + '$'
  )
  // reset cache
  cache = new Cache(1000)
}

/**
 * Parse a template text string into an array of tokens.
 *
 * @param {String} text
 * @return {Array<Object> | null}
 *               - {String} type
 *               - {String} value
 *               - {Boolean} [html]
 *               - {Boolean} [oneTime]
 */

exports.parse = function (text) {
  if (config._delimitersChanged) {
    compileRegex()
  }
  var hit = cache.get(text)
  if (hit) {
    return hit
  }
  text = text.replace(/\n/g, '')
  if (!tagRE.test(text)) {
    return null
  }
  var tokens = []
  var lastIndex = tagRE.lastIndex = 0
  var match, index, value, first, oneTime, twoWay
  /* eslint-disable no-cond-assign */
  while (match = tagRE.exec(text)) {
  /* eslint-enable no-cond-assign */
    index = match.index
    // push text token
    if (index > lastIndex) {
      tokens.push({
        value: text.slice(lastIndex, index)
      })
    }
    // tag token
    first = match[1].charCodeAt(0)
    oneTime = first === 42 // *
    twoWay = first === 64  // @
    value = oneTime || twoWay
      ? match[1].slice(1)
      : match[1]
    tokens.push({
      tag: true,
      value: value.trim(),
      html: htmlRE.test(match[0]),
      oneTime: oneTime,
      twoWay: twoWay
    })
    lastIndex = index + match[0].length
  }
  if (lastIndex < text.length) {
    tokens.push({
      value: text.slice(lastIndex)
    })
  }
  cache.put(text, tokens)
  return tokens
}

/**
 * Format a list of tokens into an expression.
 * e.g. tokens parsed from 'a {{b}} c' can be serialized
 * into one single expression as '"a " + b + " c"'.
 *
 * @param {Array} tokens
 * @param {Vue} [vm]
 * @return {String}
 */

exports.tokensToExp = function (tokens, vm) {
  return tokens.length > 1
    ? tokens.map(function (token) {
        return formatToken(token, vm)
      }).join('+')
    : formatToken(tokens[0], vm, true)
}

/**
 * Format a single token.
 *
 * @param {Object} token
 * @param {Vue} [vm]
 * @param {Boolean} single
 * @return {String}
 */

function formatToken (token, vm, single) {
  return token.tag
    ? vm && token.oneTime
      ? '"' + vm.$eval(token.value) + '"'
      : inlineFilters(token.value, single)
    : '"' + token.value + '"'
}

/**
 * For an attribute with multiple interpolation tags,
 * e.g. attr="some-{{thing | filter}}", in order to combine
 * the whole thing into a single watchable expression, we
 * have to inline those filters. This function does exactly
 * that. This is a bit hacky but it avoids heavy changes
 * to directive parser and watcher mechanism.
 *
 * @param {String} exp
 * @param {Boolean} single
 * @return {String}
 */

var filterRE = /[^|]\|[^|]/
function inlineFilters (exp, single) {
  if (!filterRE.test(exp)) {
    return single
      ? exp
      : '(' + exp + ')'
  } else {
    var dir = dirParser.parse(exp)[0]
    if (!dir.filters) {
      return '(' + exp + ')'
    } else {
      return 'this._applyFilters(' +
        dir.expression + // value
        ',null,' +       // oldValue (null for read)
        JSON.stringify(dir.filters) + // filter descriptors
        ',false)'        // write?
    }
  }
}

},{"../cache":17,"../config":22,"./directive":59}],64:[function(require,module,exports){
var _ = require('../util')

/**
 * Append with transition.
 *
 * @param {Element} el
 * @param {Element} target
 * @param {Vue} vm
 * @param {Function} [cb]
 */

exports.append = function (el, target, vm, cb) {
  apply(el, 1, function () {
    target.appendChild(el)
  }, vm, cb)
}

/**
 * InsertBefore with transition.
 *
 * @param {Element} el
 * @param {Element} target
 * @param {Vue} vm
 * @param {Function} [cb]
 */

exports.before = function (el, target, vm, cb) {
  apply(el, 1, function () {
    _.before(el, target)
  }, vm, cb)
}

/**
 * Remove with transition.
 *
 * @param {Element} el
 * @param {Vue} vm
 * @param {Function} [cb]
 */

exports.remove = function (el, vm, cb) {
  apply(el, -1, function () {
    _.remove(el)
  }, vm, cb)
}

/**
 * Remove by appending to another parent with transition.
 * This is only used in block operations.
 *
 * @param {Element} el
 * @param {Element} target
 * @param {Vue} vm
 * @param {Function} [cb]
 */

exports.removeThenAppend = function (el, target, vm, cb) {
  apply(el, -1, function () {
    target.appendChild(el)
  }, vm, cb)
}

/**
 * Append the childNodes of a fragment to target.
 *
 * @param {DocumentFragment} block
 * @param {Node} target
 * @param {Vue} vm
 */

exports.blockAppend = function (block, target, vm) {
  var nodes = _.toArray(block.childNodes)
  for (var i = 0, l = nodes.length; i < l; i++) {
    exports.before(nodes[i], target, vm)
  }
}

/**
 * Remove a block of nodes between two edge nodes.
 *
 * @param {Node} start
 * @param {Node} end
 * @param {Vue} vm
 */

exports.blockRemove = function (start, end, vm) {
  var node = start.nextSibling
  var next
  while (node !== end) {
    next = node.nextSibling
    exports.remove(node, vm)
    node = next
  }
}

/**
 * Apply transitions with an operation callback.
 *
 * @param {Element} el
 * @param {Number} direction
 *                  1: enter
 *                 -1: leave
 * @param {Function} op - the actual DOM operation
 * @param {Vue} vm
 * @param {Function} [cb]
 */

var apply = exports.apply = function (el, direction, op, vm, cb) {
  var transition = el.__v_trans
  if (
    !transition ||
    // skip if there are no js hooks and CSS transition is
    // not supported
    (!transition.hooks && !_.transitionEndEvent) ||
    // skip transitions for initial compile
    !vm._isCompiled ||
    // if the vm is being manipulated by a parent directive
    // during the parent's compilation phase, skip the
    // animation.
    (vm.$parent && !vm.$parent._isCompiled)
  ) {
    op()
    if (cb) cb()
    return
  }
  var action = direction > 0 ? 'enter' : 'leave'
  transition[action](op, cb)
}

},{"../util":71}],65:[function(require,module,exports){
var _ = require('../util')
var queue = []
var queued = false

/**
 * Push a job into the queue.
 *
 * @param {Function} job
 */

exports.push = function (job) {
  queue.push(job)
  if (!queued) {
    queued = true
    _.nextTick(flush)
  }
}

/**
 * Flush the queue, and do one forced reflow before
 * triggering transitions.
 */

function flush () {
  // Force layout
  var f = document.documentElement.offsetHeight
  for (var i = 0; i < queue.length; i++) {
    queue[i]()
  }
  queue = []
  queued = false
  // dummy return, so js linters don't complain about
  // unused variable f
  return f
}

},{"../util":71}],66:[function(require,module,exports){
var _ = require('../util')
var queue = require('./queue')
var addClass = _.addClass
var removeClass = _.removeClass
var transitionEndEvent = _.transitionEndEvent
var animationEndEvent = _.animationEndEvent
var transDurationProp = _.transitionProp + 'Duration'
var animDurationProp = _.animationProp + 'Duration'

var TYPE_TRANSITION = 1
var TYPE_ANIMATION = 2

var uid = 0

/**
 * A Transition object that encapsulates the state and logic
 * of the transition.
 *
 * @param {Element} el
 * @param {String} id
 * @param {Object} hooks
 * @param {Vue} vm
 */

function Transition (el, id, hooks, vm) {
  this.id = uid++
  this.el = el
  this.enterClass = id + '-enter'
  this.leaveClass = id + '-leave'
  this.hooks = hooks
  this.vm = vm
  // async state
  this.pendingCssEvent =
  this.pendingCssCb =
  this.cancel =
  this.pendingJsCb =
  this.op =
  this.cb = null
  this.justEntered = false
  this.entered = this.left = false
  this.typeCache = {}
  // bind
  var self = this
  ;['enterNextTick', 'enterDone', 'leaveNextTick', 'leaveDone']
    .forEach(function (m) {
      self[m] = _.bind(self[m], self)
    })
}

var p = Transition.prototype

/**
 * Start an entering transition.
 *
 * 1. enter transition triggered
 * 2. call beforeEnter hook
 * 3. add enter class
 * 4. insert/show element
 * 5. call enter hook (with possible explicit js callback)
 * 6. reflow
 * 7. based on transition type:
 *    - transition:
 *        remove class now, wait for transitionend,
 *        then done if there's no explicit js callback.
 *    - animation:
 *        wait for animationend, remove class,
 *        then done if there's no explicit js callback.
 *    - no css transition:
 *        done now if there's no explicit js callback.
 * 8. wait for either done or js callback, then call
 *    afterEnter hook.
 *
 * @param {Function} op - insert/show the element
 * @param {Function} [cb]
 */

p.enter = function (op, cb) {
  this.cancelPending()
  this.callHook('beforeEnter')
  this.cb = cb
  addClass(this.el, this.enterClass)
  op()
  this.entered = false
  this.callHookWithCb('enter')
  if (this.entered) {
    return // user called done synchronously.
  }
  this.cancel = this.hooks && this.hooks.enterCancelled
  queue.push(this.enterNextTick)
}

/**
 * The "nextTick" phase of an entering transition, which is
 * to be pushed into a queue and executed after a reflow so
 * that removing the class can trigger a CSS transition.
 */

p.enterNextTick = function () {
  this.justEntered = true
  _.nextTick(function () {
    this.justEntered = false
  }, this)
  var enterDone = this.enterDone
  var type = this.getCssTransitionType(this.enterClass)
  if (!this.pendingJsCb) {
    if (type === TYPE_TRANSITION) {
      // trigger transition by removing enter class now
      removeClass(this.el, this.enterClass)
      this.setupCssCb(transitionEndEvent, enterDone)
    } else if (type === TYPE_ANIMATION) {
      this.setupCssCb(animationEndEvent, enterDone)
    } else {
      enterDone()
    }
  } else if (type === TYPE_TRANSITION) {
    removeClass(this.el, this.enterClass)
  }
}

/**
 * The "cleanup" phase of an entering transition.
 */

p.enterDone = function () {
  this.entered = true
  this.cancel = this.pendingJsCb = null
  removeClass(this.el, this.enterClass)
  this.callHook('afterEnter')
  if (this.cb) this.cb()
}

/**
 * Start a leaving transition.
 *
 * 1. leave transition triggered.
 * 2. call beforeLeave hook
 * 3. add leave class (trigger css transition)
 * 4. call leave hook (with possible explicit js callback)
 * 5. reflow if no explicit js callback is provided
 * 6. based on transition type:
 *    - transition or animation:
 *        wait for end event, remove class, then done if
 *        there's no explicit js callback.
 *    - no css transition:
 *        done if there's no explicit js callback.
 * 7. wait for either done or js callback, then call
 *    afterLeave hook.
 *
 * @param {Function} op - remove/hide the element
 * @param {Function} [cb]
 */

p.leave = function (op, cb) {
  this.cancelPending()
  this.callHook('beforeLeave')
  this.op = op
  this.cb = cb
  addClass(this.el, this.leaveClass)
  this.left = false
  this.callHookWithCb('leave')
  if (this.left) {
    return // user called done synchronously.
  }
  this.cancel = this.hooks && this.hooks.leaveCancelled
  // only need to handle leaveDone if
  // 1. the transition is already done (synchronously called
  //    by the user, which causes this.op set to null)
  // 2. there's no explicit js callback
  if (this.op && !this.pendingJsCb) {
    // if a CSS transition leaves immediately after enter,
    // the transitionend event never fires. therefore we
    // detect such cases and end the leave immediately.
    if (this.justEntered) {
      this.leaveDone()
    } else {
      queue.push(this.leaveNextTick)
    }
  }
}

/**
 * The "nextTick" phase of a leaving transition.
 */

p.leaveNextTick = function () {
  var type = this.getCssTransitionType(this.leaveClass)
  if (type) {
    var event = type === TYPE_TRANSITION
      ? transitionEndEvent
      : animationEndEvent
    this.setupCssCb(event, this.leaveDone)
  } else {
    this.leaveDone()
  }
}

/**
 * The "cleanup" phase of a leaving transition.
 */

p.leaveDone = function () {
  this.left = true
  this.cancel = this.pendingJsCb = null
  this.op()
  removeClass(this.el, this.leaveClass)
  this.callHook('afterLeave')
  if (this.cb) this.cb()
  this.op = null
}

/**
 * Cancel any pending callbacks from a previously running
 * but not finished transition.
 */

p.cancelPending = function () {
  this.op = this.cb = null
  var hasPending = false
  if (this.pendingCssCb) {
    hasPending = true
    _.off(this.el, this.pendingCssEvent, this.pendingCssCb)
    this.pendingCssEvent = this.pendingCssCb = null
  }
  if (this.pendingJsCb) {
    hasPending = true
    this.pendingJsCb.cancel()
    this.pendingJsCb = null
  }
  if (hasPending) {
    removeClass(this.el, this.enterClass)
    removeClass(this.el, this.leaveClass)
  }
  if (this.cancel) {
    this.cancel.call(this.vm, this.el)
    this.cancel = null
  }
}

/**
 * Call a user-provided synchronous hook function.
 *
 * @param {String} type
 */

p.callHook = function (type) {
  if (this.hooks && this.hooks[type]) {
    this.hooks[type].call(this.vm, this.el)
  }
}

/**
 * Call a user-provided, potentially-async hook function.
 * We check for the length of arguments to see if the hook
 * expects a `done` callback. If true, the transition's end
 * will be determined by when the user calls that callback;
 * otherwise, the end is determined by the CSS transition or
 * animation.
 *
 * @param {String} type
 */

p.callHookWithCb = function (type) {
  var hook = this.hooks && this.hooks[type]
  if (hook) {
    if (hook.length > 1) {
      this.pendingJsCb = _.cancellable(this[type + 'Done'])
    }
    hook.call(this.vm, this.el, this.pendingJsCb)
  }
}

/**
 * Get an element's transition type based on the
 * calculated styles.
 *
 * @param {String} className
 * @return {Number}
 */

p.getCssTransitionType = function (className) {
  /* istanbul ignore if */
  if (
    !transitionEndEvent ||
    // skip CSS transitions if page is not visible -
    // this solves the issue of transitionend events not
    // firing until the page is visible again.
    // pageVisibility API is supported in IE10+, same as
    // CSS transitions.
    document.hidden ||
    // explicit js-only transition
    (this.hooks && this.hooks.css === false)
  ) {
    return
  }
  var type = this.typeCache[className]
  if (type) return type
  var inlineStyles = this.el.style
  var computedStyles = window.getComputedStyle(this.el)
  var transDuration =
    inlineStyles[transDurationProp] ||
    computedStyles[transDurationProp]
  if (transDuration && transDuration !== '0s') {
    type = TYPE_TRANSITION
  } else {
    var animDuration =
      inlineStyles[animDurationProp] ||
      computedStyles[animDurationProp]
    if (animDuration && animDuration !== '0s') {
      type = TYPE_ANIMATION
    }
  }
  if (type) {
    this.typeCache[className] = type
  }
  return type
}

/**
 * Setup a CSS transitionend/animationend callback.
 *
 * @param {String} event
 * @param {Function} cb
 */

p.setupCssCb = function (event, cb) {
  this.pendingCssEvent = event
  var self = this
  var el = this.el
  var onEnd = this.pendingCssCb = function (e) {
    if (e.target === el) {
      _.off(el, event, onEnd)
      self.pendingCssEvent = self.pendingCssCb = null
      if (!self.pendingJsCb && cb) {
        cb()
      }
    }
  }
  _.on(el, event, onEnd)
}

module.exports = Transition

},{"../util":71,"./queue":65}],67:[function(require,module,exports){
(function (process){
var _ = require('./index')

/**
 * Check if an element is a component, if yes return its
 * component id.
 *
 * @param {Element} el
 * @param {Object} options
 * @return {String|undefined}
 */

exports.commonTagRE = /^(div|p|span|img|a|br|ul|ol|li|h1|h2|h3|h4|h5|code|pre)$/
exports.checkComponent = function (el, options) {
  var tag = el.tagName.toLowerCase()
  if (tag === 'component') {
    // dynamic syntax
    var exp = el.getAttribute('is')
    el.removeAttribute('is')
    return exp
  } else if (
    !exports.commonTagRE.test(tag) &&
    _.resolveAsset(options, 'components', tag)
  ) {
    return tag
  /* eslint-disable no-cond-assign */
  } else if (tag = _.attr(el, 'component')) {
  /* eslint-enable no-cond-assign */
    return tag
  }
}

/**
 * Set a prop's initial value on a vm and its data object.
 * The vm may have inherit:true so we need to make sure
 * we don't accidentally overwrite parent value.
 *
 * @param {Vue} vm
 * @param {Object} prop
 * @param {*} value
 */

exports.initProp = function (vm, prop, value) {
  if (exports.assertProp(prop, value)) {
    var key = prop.path
    if (key in vm) {
      _.define(vm, key, value, true)
    } else {
      vm[key] = value
    }
    vm._data[key] = value
  }
}

/**
 * Assert whether a prop is valid.
 *
 * @param {Object} prop
 * @param {*} value
 */

exports.assertProp = function (prop, value) {
  // if a prop is not provided and is not required,
  // skip the check.
  if (prop.raw === null && !prop.required) {
    return true
  }
  var options = prop.options
  var type = options.type
  var valid = true
  var expectedType
  if (type) {
    if (type === String) {
      expectedType = 'string'
      valid = typeof value === expectedType
    } else if (type === Number) {
      expectedType = 'number'
      valid = typeof value === 'number'
    } else if (type === Boolean) {
      expectedType = 'boolean'
      valid = typeof value === 'boolean'
    } else if (type === Function) {
      expectedType = 'function'
      valid = typeof value === 'function'
    } else if (type === Object) {
      expectedType = 'object'
      valid = _.isPlainObject(value)
    } else if (type === Array) {
      expectedType = 'array'
      valid = _.isArray(value)
    } else {
      valid = value instanceof type
    }
  }
  if (!valid) {
    process.env.NODE_ENV !== 'production' && _.warn(
      'Invalid prop: type check failed for ' +
      prop.path + '="' + prop.raw + '".' +
      ' Expected ' + formatType(expectedType) +
      ', got ' + formatValue(value) + '.'
    )
    return false
  }
  var validator = options.validator
  if (validator) {
    if (!validator.call(null, value)) {
      process.env.NODE_ENV !== 'production' && _.warn(
        'Invalid prop: custom validator check failed for ' +
        prop.path + '="' + prop.raw + '"'
      )
      return false
    }
  }
  return true
}

function formatType (val) {
  return val
    ? val.charAt(0).toUpperCase() + val.slice(1)
    : 'custom type'
}

function formatValue (val) {
  return Object.prototype.toString.call(val).slice(8, -1)
}

}).call(this,require('_process'))

},{"./index":71,"_process":1}],68:[function(require,module,exports){
(function (process){
/**
 * Enable debug utilities.
 */

if (process.env.NODE_ENV !== 'production') {

  var config = require('../config')
  var hasConsole = typeof console !== 'undefined'

  /**
   * Log a message.
   *
   * @param {String} msg
   */

  exports.log = function (msg) {
    if (hasConsole && config.debug) {
      console.log('[Vue info]: ' + msg)
    }
  }

  /**
   * We've got a problem here.
   *
   * @param {String} msg
   */

  exports.warn = function (msg, e) {
    if (hasConsole && (!config.silent || config.debug)) {
      console.warn('[Vue warn]: ' + msg)
      /* istanbul ignore if */
      if (config.debug) {
        console.warn((e || new Error('Warning Stack Trace')).stack)
      }
    }
  }

  /**
   * Assert asset exists
   */

  exports.assertAsset = function (val, type, id) {
    /* istanbul ignore if */
    if (type === 'directive') {
      if (id === 'with') {
        exports.warn(
          'v-with has been deprecated in ^0.12.0. ' +
          'Use props instead.'
        )
        return
      }
      if (id === 'events') {
        exports.warn(
          'v-events has been deprecated in ^0.12.0. ' +
          'Pass down methods as callback props instead.'
        )
        return
      }
    }
    if (!val) {
      exports.warn('Failed to resolve ' + type + ': ' + id)
    }
  }
}

}).call(this,require('_process'))

},{"../config":22,"_process":1}],69:[function(require,module,exports){
(function (process){
var _ = require('./index')
var config = require('../config')

/**
 * Query an element selector if it's not an element already.
 *
 * @param {String|Element} el
 * @return {Element}
 */

exports.query = function (el) {
  if (typeof el === 'string') {
    var selector = el
    el = document.querySelector(el)
    if (!el) {
      process.env.NODE_ENV !== 'production' && _.warn(
        'Cannot find element: ' + selector
      )
    }
  }
  return el
}

/**
 * Check if a node is in the document.
 * Note: document.documentElement.contains should work here
 * but always returns false for comment nodes in phantomjs,
 * making unit tests difficult. This is fixed byy doing the
 * contains() check on the node's parentNode instead of
 * the node itself.
 *
 * @param {Node} node
 * @return {Boolean}
 */

exports.inDoc = function (node) {
  var doc = document.documentElement
  var parent = node && node.parentNode
  return doc === node ||
    doc === parent ||
    !!(parent && parent.nodeType === 1 && (doc.contains(parent)))
}

/**
 * Extract an attribute from a node.
 *
 * @param {Node} node
 * @param {String} attr
 */

exports.attr = function (node, attr) {
  attr = config.prefix + attr
  var val = node.getAttribute(attr)
  if (val !== null) {
    node.removeAttribute(attr)
  }
  return val
}

/**
 * Insert el before target
 *
 * @param {Element} el
 * @param {Element} target
 */

exports.before = function (el, target) {
  target.parentNode.insertBefore(el, target)
}

/**
 * Insert el after target
 *
 * @param {Element} el
 * @param {Element} target
 */

exports.after = function (el, target) {
  if (target.nextSibling) {
    exports.before(el, target.nextSibling)
  } else {
    target.parentNode.appendChild(el)
  }
}

/**
 * Remove el from DOM
 *
 * @param {Element} el
 */

exports.remove = function (el) {
  el.parentNode.removeChild(el)
}

/**
 * Prepend el to target
 *
 * @param {Element} el
 * @param {Element} target
 */

exports.prepend = function (el, target) {
  if (target.firstChild) {
    exports.before(el, target.firstChild)
  } else {
    target.appendChild(el)
  }
}

/**
 * Replace target with el
 *
 * @param {Element} target
 * @param {Element} el
 */

exports.replace = function (target, el) {
  var parent = target.parentNode
  if (parent) {
    parent.replaceChild(el, target)
  }
}

/**
 * Add event listener shorthand.
 *
 * @param {Element} el
 * @param {String} event
 * @param {Function} cb
 */

exports.on = function (el, event, cb) {
  el.addEventListener(event, cb)
}

/**
 * Remove event listener shorthand.
 *
 * @param {Element} el
 * @param {String} event
 * @param {Function} cb
 */

exports.off = function (el, event, cb) {
  el.removeEventListener(event, cb)
}

/**
 * Add class with compatibility for IE & SVG
 *
 * @param {Element} el
 * @param {Strong} cls
 */

exports.addClass = function (el, cls) {
  if (el.classList) {
    el.classList.add(cls)
  } else {
    var cur = ' ' + (el.getAttribute('class') || '') + ' '
    if (cur.indexOf(' ' + cls + ' ') < 0) {
      el.setAttribute('class', (cur + cls).trim())
    }
  }
}

/**
 * Remove class with compatibility for IE & SVG
 *
 * @param {Element} el
 * @param {Strong} cls
 */

exports.removeClass = function (el, cls) {
  if (el.classList) {
    el.classList.remove(cls)
  } else {
    var cur = ' ' + (el.getAttribute('class') || '') + ' '
    var tar = ' ' + cls + ' '
    while (cur.indexOf(tar) >= 0) {
      cur = cur.replace(tar, ' ')
    }
    el.setAttribute('class', cur.trim())
  }
}

/**
 * Extract raw content inside an element into a temporary
 * container div
 *
 * @param {Element} el
 * @param {Boolean} asFragment
 * @return {Element}
 */

exports.extractContent = function (el, asFragment) {
  var child
  var rawContent
  /* istanbul ignore if */
  if (
    exports.isTemplate(el) &&
    el.content instanceof DocumentFragment
  ) {
    el = el.content
  }
  if (el.hasChildNodes()) {
    exports.trimNode(el)
    rawContent = asFragment
      ? document.createDocumentFragment()
      : document.createElement('div')
    /* eslint-disable no-cond-assign */
    while (child = el.firstChild) {
    /* eslint-enable no-cond-assign */
      rawContent.appendChild(child)
    }
  }
  return rawContent
}

/**
 * Trim possible empty head/tail textNodes inside a parent.
 *
 * @param {Node} node
 */

exports.trimNode = function (node) {
  trim(node, node.firstChild)
  trim(node, node.lastChild)
}

function trim (parent, node) {
  if (node && node.nodeType === 3 && !node.data.trim()) {
    parent.removeChild(node)
  }
}

/**
 * Check if an element is a template tag.
 * Note if the template appears inside an SVG its tagName
 * will be in lowercase.
 *
 * @param {Element} el
 */

exports.isTemplate = function (el) {
  return el.tagName &&
    el.tagName.toLowerCase() === 'template'
}

/**
 * Create an "anchor" for performing dom insertion/removals.
 * This is used in a number of scenarios:
 * - fragment instance
 * - v-html
 * - v-if
 * - component
 * - repeat
 *
 * @param {String} content
 * @param {Boolean} persist - IE trashes empty textNodes on
 *                            cloneNode(true), so in certain
 *                            cases the anchor needs to be
 *                            non-empty to be persisted in
 *                            templates.
 * @return {Comment|Text}
 */

exports.createAnchor = function (content, persist) {
  return config.debug
    ? document.createComment(content)
    : document.createTextNode(persist ? ' ' : '')
}

}).call(this,require('_process'))

},{"../config":22,"./index":71,"_process":1}],70:[function(require,module,exports){
// can we use __proto__?
exports.hasProto = '__proto__' in {}

// Browser environment sniffing
var inBrowser = exports.inBrowser =
  typeof window !== 'undefined' &&
  Object.prototype.toString.call(window) !== '[object Object]'

exports.isIE9 =
  inBrowser &&
  navigator.userAgent.toLowerCase().indexOf('msie 9.0') > 0

exports.isAndroid =
  inBrowser &&
  navigator.userAgent.toLowerCase().indexOf('android') > 0

// Transition property/event sniffing
if (inBrowser && !exports.isIE9) {
  var isWebkitTrans =
    window.ontransitionend === undefined &&
    window.onwebkittransitionend !== undefined
  var isWebkitAnim =
    window.onanimationend === undefined &&
    window.onwebkitanimationend !== undefined
  exports.transitionProp = isWebkitTrans
    ? 'WebkitTransition'
    : 'transition'
  exports.transitionEndEvent = isWebkitTrans
    ? 'webkitTransitionEnd'
    : 'transitionend'
  exports.animationProp = isWebkitAnim
    ? 'WebkitAnimation'
    : 'animation'
  exports.animationEndEvent = isWebkitAnim
    ? 'webkitAnimationEnd'
    : 'animationend'
}

/**
 * Defer a task to execute it asynchronously. Ideally this
 * should be executed as a microtask, so we leverage
 * MutationObserver if it's available, and fallback to
 * setTimeout(0).
 *
 * @param {Function} cb
 * @param {Object} ctx
 */

exports.nextTick = (function () {
  var callbacks = []
  var pending = false
  var timerFunc
  function nextTickHandler () {
    pending = false
    var copies = callbacks.slice(0)
    callbacks = []
    for (var i = 0; i < copies.length; i++) {
      copies[i]()
    }
  }
  /* istanbul ignore if */
  if (typeof MutationObserver !== 'undefined') {
    var counter = 1
    var observer = new MutationObserver(nextTickHandler)
    var textNode = document.createTextNode(counter)
    observer.observe(textNode, {
      characterData: true
    })
    timerFunc = function () {
      counter = (counter + 1) % 2
      textNode.data = counter
    }
  } else {
    timerFunc = setTimeout
  }
  return function (cb, ctx) {
    var func = ctx
      ? function () { cb.call(ctx) }
      : cb
    callbacks.push(func)
    if (pending) return
    pending = true
    timerFunc(nextTickHandler, 0)
  }
})()

},{}],71:[function(require,module,exports){
var lang = require('./lang')
var extend = lang.extend

extend(exports, lang)
extend(exports, require('./env'))
extend(exports, require('./dom'))
extend(exports, require('./options'))
extend(exports, require('./component'))
extend(exports, require('./debug'))

},{"./component":67,"./debug":68,"./dom":69,"./env":70,"./lang":72,"./options":73}],72:[function(require,module,exports){
/**
 * Check if a string starts with $ or _
 *
 * @param {String} str
 * @return {Boolean}
 */

exports.isReserved = function (str) {
  var c = (str + '').charCodeAt(0)
  return c === 0x24 || c === 0x5F
}

/**
 * Guard text output, make sure undefined outputs
 * empty string
 *
 * @param {*} value
 * @return {String}
 */

exports.toString = function (value) {
  return value == null
    ? ''
    : value.toString()
}

/**
 * Check and convert possible numeric strings to numbers
 * before setting back to data
 *
 * @param {*} value
 * @return {*|Number}
 */

exports.toNumber = function (value) {
  if (typeof value !== 'string') {
    return value
  } else {
    var parsed = Number(value)
    return isNaN(parsed)
      ? value
      : parsed
  }
}

/**
 * Convert string boolean literals into real booleans.
 *
 * @param {*} value
 * @return {*|Boolean}
 */

exports.toBoolean = function (value) {
  return value === 'true'
    ? true
    : value === 'false'
      ? false
      : value
}

/**
 * Strip quotes from a string
 *
 * @param {String} str
 * @return {String | false}
 */

exports.stripQuotes = function (str) {
  var a = str.charCodeAt(0)
  var b = str.charCodeAt(str.length - 1)
  return a === b && (a === 0x22 || a === 0x27)
    ? str.slice(1, -1)
    : false
}

/**
 * Camelize a hyphen-delmited string.
 *
 * @param {String} str
 * @return {String}
 */

exports.camelize = function (str) {
  return str.replace(/-(\w)/g, toUpper)
}

function toUpper (_, c) {
  return c ? c.toUpperCase() : ''
}

/**
 * Hyphenate a camelCase string.
 *
 * @param {String} str
 * @return {String}
 */

exports.hyphenate = function (str) {
  return str
    .replace(/([a-z\d])([A-Z])/g, '$1-$2')
    .toLowerCase()
}

/**
 * Converts hyphen/underscore/slash delimitered names into
 * camelized classNames.
 *
 * e.g. my-component => MyComponent
 *      some_else    => SomeElse
 *      some/comp    => SomeComp
 *
 * @param {String} str
 * @return {String}
 */

var classifyRE = /(?:^|[-_\/])(\w)/g
exports.classify = function (str) {
  return str.replace(classifyRE, toUpper)
}

/**
 * Simple bind, faster than native
 *
 * @param {Function} fn
 * @param {Object} ctx
 * @return {Function}
 */

exports.bind = function (fn, ctx) {
  return function (a) {
    var l = arguments.length
    return l
      ? l > 1
        ? fn.apply(ctx, arguments)
        : fn.call(ctx, a)
      : fn.call(ctx)
  }
}

/**
 * Convert an Array-like object to a real Array.
 *
 * @param {Array-like} list
 * @param {Number} [start] - start index
 * @return {Array}
 */

exports.toArray = function (list, start) {
  start = start || 0
  var i = list.length - start
  var ret = new Array(i)
  while (i--) {
    ret[i] = list[i + start]
  }
  return ret
}

/**
 * Mix properties into target object.
 *
 * @param {Object} to
 * @param {Object} from
 */

exports.extend = function (to, from) {
  for (var key in from) {
    to[key] = from[key]
  }
  return to
}

/**
 * Quick object check - this is primarily used to tell
 * Objects from primitive values when we know the value
 * is a JSON-compliant type.
 *
 * @param {*} obj
 * @return {Boolean}
 */

exports.isObject = function (obj) {
  return obj !== null && typeof obj === 'object'
}

/**
 * Strict object type check. Only returns true
 * for plain JavaScript objects.
 *
 * @param {*} obj
 * @return {Boolean}
 */

var toString = Object.prototype.toString
var OBJECT_STRING = '[object Object]'
exports.isPlainObject = function (obj) {
  return toString.call(obj) === OBJECT_STRING
}

/**
 * Array type check.
 *
 * @param {*} obj
 * @return {Boolean}
 */

exports.isArray = Array.isArray

/**
 * Define a non-enumerable property
 *
 * @param {Object} obj
 * @param {String} key
 * @param {*} val
 * @param {Boolean} [enumerable]
 */

exports.define = function (obj, key, val, enumerable) {
  Object.defineProperty(obj, key, {
    value: val,
    enumerable: !!enumerable,
    writable: true,
    configurable: true
  })
}

/**
 * Debounce a function so it only gets called after the
 * input stops arriving after the given wait period.
 *
 * @param {Function} func
 * @param {Number} wait
 * @return {Function} - the debounced function
 */

exports.debounce = function (func, wait) {
  var timeout, args, context, timestamp, result
  var later = function () {
    var last = Date.now() - timestamp
    if (last < wait && last >= 0) {
      timeout = setTimeout(later, wait - last)
    } else {
      timeout = null
      result = func.apply(context, args)
      if (!timeout) context = args = null
    }
  }
  return function () {
    context = this
    args = arguments
    timestamp = Date.now()
    if (!timeout) {
      timeout = setTimeout(later, wait)
    }
    return result
  }
}

/**
 * Manual indexOf because it's slightly faster than
 * native.
 *
 * @param {Array} arr
 * @param {*} obj
 */

exports.indexOf = function (arr, obj) {
  var i = arr.length
  while (i--) {
    if (arr[i] === obj) return i
  }
  return -1
}

/**
 * Make a cancellable version of an async callback.
 *
 * @param {Function} fn
 * @return {Function}
 */

exports.cancellable = function (fn) {
  var cb = function () {
    if (!cb.cancelled) {
      return fn.apply(this, arguments)
    }
  }
  cb.cancel = function () {
    cb.cancelled = true
  }
  return cb
}

/**
 * Check if two values are loosely equal - that is,
 * if they are plain objects, do they have the same shape?
 *
 * @param {*} a
 * @param {*} b
 * @return {Boolean}
 */

exports.looseEqual = function (a, b) {
  /* eslint-disable eqeqeq */
  return a == b || (
    exports.isObject(a) && exports.isObject(b)
      ? JSON.stringify(a) === JSON.stringify(b)
      : false
  )
  /* eslint-enable eqeqeq */
}

},{}],73:[function(require,module,exports){
(function (process){
var _ = require('./index')
var config = require('../config')
var extend = _.extend

/**
 * Option overwriting strategies are functions that handle
 * how to merge a parent option value and a child option
 * value into the final value.
 *
 * All strategy functions follow the same signature:
 *
 * @param {*} parentVal
 * @param {*} childVal
 * @param {Vue} [vm]
 */

var strats = Object.create(null)

/**
 * Helper that recursively merges two data objects together.
 */

function mergeData (to, from) {
  var key, toVal, fromVal
  for (key in from) {
    toVal = to[key]
    fromVal = from[key]
    if (!to.hasOwnProperty(key)) {
      to.$add(key, fromVal)
    } else if (_.isObject(toVal) && _.isObject(fromVal)) {
      mergeData(toVal, fromVal)
    }
  }
  return to
}

/**
 * Data
 */

strats.data = function (parentVal, childVal, vm) {
  if (!vm) {
    // in a Vue.extend merge, both should be functions
    if (!childVal) {
      return parentVal
    }
    if (typeof childVal !== 'function') {
      process.env.NODE_ENV !== 'production' && _.warn(
        'The "data" option should be a function ' +
        'that returns a per-instance value in component ' +
        'definitions.'
      )
      return parentVal
    }
    if (!parentVal) {
      return childVal
    }
    // when parentVal & childVal are both present,
    // we need to return a function that returns the
    // merged result of both functions... no need to
    // check if parentVal is a function here because
    // it has to be a function to pass previous merges.
    return function mergedDataFn () {
      return mergeData(
        childVal.call(this),
        parentVal.call(this)
      )
    }
  } else if (parentVal || childVal) {
    return function mergedInstanceDataFn () {
      // instance merge
      var instanceData = typeof childVal === 'function'
        ? childVal.call(vm)
        : childVal
      var defaultData = typeof parentVal === 'function'
        ? parentVal.call(vm)
        : undefined
      if (instanceData) {
        return mergeData(instanceData, defaultData)
      } else {
        return defaultData
      }
    }
  }
}

/**
 * El
 */

strats.el = function (parentVal, childVal, vm) {
  if (!vm && childVal && typeof childVal !== 'function') {
    process.env.NODE_ENV !== 'production' && _.warn(
      'The "el" option should be a function ' +
      'that returns a per-instance value in component ' +
      'definitions.'
    )
    return
  }
  var ret = childVal || parentVal
  // invoke the element factory if this is instance merge
  return vm && typeof ret === 'function'
    ? ret.call(vm)
    : ret
}

/**
 * Hooks and param attributes are merged as arrays.
 */

strats.created =
strats.ready =
strats.attached =
strats.detached =
strats.beforeCompile =
strats.compiled =
strats.beforeDestroy =
strats.destroyed =
strats.props = function (parentVal, childVal) {
  return childVal
    ? parentVal
      ? parentVal.concat(childVal)
      : _.isArray(childVal)
        ? childVal
        : [childVal]
    : parentVal
}

/**
 * 0.11 deprecation warning
 */

strats.paramAttributes = function () {
  /* istanbul ignore next */
  process.env.NODE_ENV !== 'production' && _.warn(
    '"paramAttributes" option has been deprecated in 0.12. ' +
    'Use "props" instead.'
  )
}

/**
 * Assets
 *
 * When a vm is present (instance creation), we need to do
 * a three-way merge between constructor options, instance
 * options and parent options.
 */

function mergeAssets (parentVal, childVal) {
  var res = Object.create(parentVal)
  return childVal
    ? extend(res, guardArrayAssets(childVal))
    : res
}

config._assetTypes.forEach(function (type) {
  strats[type + 's'] = mergeAssets
})

/**
 * Events & Watchers.
 *
 * Events & watchers hashes should not overwrite one
 * another, so we merge them as arrays.
 */

strats.watch =
strats.events = function (parentVal, childVal) {
  if (!childVal) return parentVal
  if (!parentVal) return childVal
  var ret = {}
  extend(ret, parentVal)
  for (var key in childVal) {
    var parent = ret[key]
    var child = childVal[key]
    if (parent && !_.isArray(parent)) {
      parent = [parent]
    }
    ret[key] = parent
      ? parent.concat(child)
      : [child]
  }
  return ret
}

/**
 * Other object hashes.
 */

strats.methods =
strats.computed = function (parentVal, childVal) {
  if (!childVal) return parentVal
  if (!parentVal) return childVal
  var ret = Object.create(parentVal)
  extend(ret, childVal)
  return ret
}

/**
 * Default strategy.
 */

var defaultStrat = function (parentVal, childVal) {
  return childVal === undefined
    ? parentVal
    : childVal
}

/**
 * Make sure component options get converted to actual
 * constructors.
 *
 * @param {Object} options
 */

function guardComponents (options) {
  if (options.components) {
    var components = options.components =
      guardArrayAssets(options.components)
    var def
    var ids = Object.keys(components)
    for (var i = 0, l = ids.length; i < l; i++) {
      var key = ids[i]
      if (_.commonTagRE.test(key)) {
        process.env.NODE_ENV !== 'production' && _.warn(
          'Do not use built-in HTML elements as component ' +
          'id: ' + key
        )
        continue
      }
      def = components[key]
      if (_.isPlainObject(def)) {
        def.id = def.id || key
        components[key] = def._Ctor || (def._Ctor = _.Vue.extend(def))
      }
    }
  }
}

/**
 * Ensure all props option syntax are normalized into the
 * Object-based format.
 *
 * @param {Object} options
 */

function guardProps (options) {
  var props = options.props
  if (_.isPlainObject(props)) {
    options.props = Object.keys(props).map(function (key) {
      var val = props[key]
      if (!_.isPlainObject(val)) {
        val = { type: val }
      }
      val.name = key
      return val
    })
  } else if (_.isArray(props)) {
    options.props = props.map(function (prop) {
      return typeof prop === 'string'
        ? { name: prop }
        : prop
    })
  }
}

/**
 * Guard an Array-format assets option and converted it
 * into the key-value Object format.
 *
 * @param {Object|Array} assets
 * @return {Object}
 */

function guardArrayAssets (assets) {
  if (_.isArray(assets)) {
    var res = {}
    var i = assets.length
    var asset
    while (i--) {
      asset = assets[i]
      var id = asset.id || (asset.options && asset.options.id)
      if (!id) {
        process.env.NODE_ENV !== 'production' && _.warn(
          'Array-syntax assets must provide an id field.'
        )
      } else {
        res[id] = asset
      }
    }
    return res
  }
  return assets
}

/**
 * Merge two option objects into a new one.
 * Core utility used in both instantiation and inheritance.
 *
 * @param {Object} parent
 * @param {Object} child
 * @param {Vue} [vm] - if vm is present, indicates this is
 *                     an instantiation merge.
 */

exports.mergeOptions = function merge (parent, child, vm) {
  guardComponents(child)
  guardProps(child)
  var options = {}
  var key
  if (child.mixins) {
    for (var i = 0, l = child.mixins.length; i < l; i++) {
      parent = merge(parent, child.mixins[i], vm)
    }
  }
  for (key in parent) {
    mergeField(key)
  }
  for (key in child) {
    if (!(parent.hasOwnProperty(key))) {
      mergeField(key)
    }
  }
  function mergeField (key) {
    var strat = strats[key] || defaultStrat
    options[key] = strat(parent[key], child[key], vm, key)
  }
  return options
}

/**
 * Resolve an asset.
 * This function is used because child instances need access
 * to assets defined in its ancestor chain.
 *
 * @param {Object} options
 * @param {String} type
 * @param {String} id
 * @return {Object|Function}
 */

exports.resolveAsset = function resolve (options, type, id) {
  var camelizedId = _.camelize(id)
  var pascalizedId = camelizedId.charAt(0).toUpperCase() + camelizedId.slice(1)
  var assets = options[type]
  var asset = assets[id] || assets[camelizedId] || assets[pascalizedId]
  while (
    !asset &&
    options._parent &&
    (!config.strict || options._repeat)
  ) {
    options = (options._context || options._parent).$options
    assets = options[type]
    asset = assets[id] || assets[camelizedId] || assets[pascalizedId]
  }
  return asset
}

}).call(this,require('_process'))

},{"../config":22,"./index":71,"_process":1}],74:[function(require,module,exports){
var _ = require('./util')
var extend = _.extend

/**
 * The exposed Vue constructor.
 *
 * API conventions:
 * - public API methods/properties are prefiexed with `$`
 * - internal methods/properties are prefixed with `_`
 * - non-prefixed properties are assumed to be proxied user
 *   data.
 *
 * @constructor
 * @param {Object} [options]
 * @public
 */

function Vue (options) {
  this._init(options)
}

/**
 * Mixin global API
 */

extend(Vue, require('./api/global'))

/**
 * Vue and every constructor that extends Vue has an
 * associated options object, which can be accessed during
 * compilation steps as `this.constructor.options`.
 *
 * These can be seen as the default options of every
 * Vue instance.
 */

Vue.options = {
  replace: true,
  directives: require('./directives'),
  elementDirectives: require('./element-directives'),
  filters: require('./filters'),
  transitions: {},
  components: {},
  partials: {}
}

/**
 * Build up the prototype
 */

var p = Vue.prototype

/**
 * $data has a setter which does a bunch of
 * teardown/setup work
 */

Object.defineProperty(p, '$data', {
  get: function () {
    return this._data
  },
  set: function (newData) {
    if (newData !== this._data) {
      this._setData(newData)
    }
  }
})

/**
 * Mixin internal instance methods
 */

extend(p, require('./instance/init'))
extend(p, require('./instance/events'))
extend(p, require('./instance/scope'))
extend(p, require('./instance/compile'))
extend(p, require('./instance/misc'))

/**
 * Mixin public API methods
 */

extend(p, require('./api/data'))
extend(p, require('./api/dom'))
extend(p, require('./api/events'))
extend(p, require('./api/child'))
extend(p, require('./api/lifecycle'))

module.exports = _.Vue = Vue

},{"./api/child":10,"./api/data":11,"./api/dom":12,"./api/events":13,"./api/global":14,"./api/lifecycle":15,"./directives":31,"./element-directives":46,"./filters":49,"./instance/compile":50,"./instance/events":51,"./instance/init":52,"./instance/misc":53,"./instance/scope":54,"./util":71}],75:[function(require,module,exports){
(function (process){
var _ = require('./util')
var config = require('./config')
var Dep = require('./observer/dep')
var expParser = require('./parsers/expression')
var batcher = require('./batcher')
var uid = 0

/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 *
 * @param {Vue} vm
 * @param {String} expression
 * @param {Function} cb
 * @param {Object} options
 *                 - {Array} filters
 *                 - {Boolean} twoWay
 *                 - {Boolean} deep
 *                 - {Boolean} user
 *                 - {Boolean} sync
 *                 - {Boolean} lazy
 *                 - {Function} [preProcess]
 * @constructor
 */

function Watcher (vm, expOrFn, cb, options) {
  // mix in options
  if (options) {
    _.extend(this, options)
  }
  var isFn = typeof expOrFn === 'function'
  this.vm = vm
  vm._watchers.push(this)
  this.expression = isFn ? expOrFn.toString() : expOrFn
  this.cb = cb
  this.id = ++uid // uid for batching
  this.active = true
  this.dirty = this.lazy // for lazy watchers
  this.deps = []
  this.newDeps = null
  this.prevError = null // for async error stacks
  // parse expression for getter/setter
  if (isFn) {
    this.getter = expOrFn
    this.setter = undefined
  } else {
    var res = expParser.parse(expOrFn, this.twoWay)
    this.getter = res.get
    this.setter = res.set
  }
  this.value = this.lazy
    ? undefined
    : this.get()
  // state for avoiding false triggers for deep and Array
  // watchers during vm._digest()
  this.queued = this.shallow = false
}

/**
 * Add a dependency to this directive.
 *
 * @param {Dep} dep
 */

Watcher.prototype.addDep = function (dep) {
  var newDeps = this.newDeps
  var old = this.deps
  if (_.indexOf(newDeps, dep) < 0) {
    newDeps.push(dep)
    var i = _.indexOf(old, dep)
    if (i < 0) {
      dep.addSub(this)
    } else {
      old[i] = null
    }
  }
}

/**
 * Evaluate the getter, and re-collect dependencies.
 */

Watcher.prototype.get = function () {
  this.beforeGet()
  var vm = this.vm
  var value
  try {
    value = this.getter.call(vm, vm)
  } catch (e) {
    if (
      process.env.NODE_ENV !== 'production' &&
      config.warnExpressionErrors
    ) {
      _.warn(
        'Error when evaluating expression "' +
        this.expression + '". ' +
        (config.debug
          ? ''
          : 'Turn on debug mode to see stack trace.'
        ), e
      )
    }
  }
  // "touch" every property so they are all tracked as
  // dependencies for deep watching
  if (this.deep) {
    traverse(value)
  }
  if (this.preProcess) {
    value = this.preProcess(value)
  }
  if (this.filters) {
    value = vm._applyFilters(value, null, this.filters, false)
  }
  this.afterGet()
  return value
}

/**
 * Set the corresponding value with the setter.
 *
 * @param {*} value
 */

Watcher.prototype.set = function (value) {
  var vm = this.vm
  if (this.filters) {
    value = vm._applyFilters(
      value, this.value, this.filters, true)
  }
  try {
    this.setter.call(vm, vm, value)
  } catch (e) {
    if (
      process.env.NODE_ENV !== 'production' &&
      config.warnExpressionErrors
    ) {
      _.warn(
        'Error when evaluating setter "' +
        this.expression + '"', e
      )
    }
  }
}

/**
 * Prepare for dependency collection.
 */

Watcher.prototype.beforeGet = function () {
  Dep.target = this
  this.newDeps = []
}

/**
 * Clean up for dependency collection.
 */

Watcher.prototype.afterGet = function () {
  Dep.target = null
  var i = this.deps.length
  while (i--) {
    var dep = this.deps[i]
    if (dep) {
      dep.removeSub(this)
    }
  }
  this.deps = this.newDeps
  this.newDeps = null
}

/**
 * Subscriber interface.
 * Will be called when a dependency changes.
 *
 * @param {Boolean} shallow
 */

Watcher.prototype.update = function (shallow) {
  if (this.lazy) {
    this.dirty = true
  } else if (this.sync || !config.async) {
    this.run()
  } else {
    // if queued, only overwrite shallow with non-shallow,
    // but not the other way around.
    this.shallow = this.queued
      ? shallow
        ? this.shallow
        : false
      : !!shallow
    this.queued = true
    // record before-push error stack in debug mode
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.debug) {
      this.prevError = new Error('[vue] async stack trace')
    }
    batcher.push(this)
  }
}

/**
 * Batcher job interface.
 * Will be called by the batcher.
 */

Watcher.prototype.run = function () {
  if (this.active) {
    var value = this.get()
    if (
      value !== this.value ||
      // Deep watchers and Array watchers should fire even
      // when the value is the same, because the value may
      // have mutated; but only do so if this is a
      // non-shallow update (caused by a vm digest).
      ((_.isArray(value) || this.deep) && !this.shallow)
    ) {
      // set new value
      var oldValue = this.value
      this.value = value
      // in debug + async mode, when a watcher callbacks
      // throws, we also throw the saved before-push error
      // so the full cross-tick stack trace is available.
      var prevError = this.prevError
      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' &&
          config.debug && prevError) {
        this.prevError = null
        try {
          this.cb.call(this.vm, value, oldValue)
        } catch (e) {
          _.nextTick(function () {
            throw prevError
          }, 0)
          throw e
        }
      } else {
        this.cb.call(this.vm, value, oldValue)
      }
    }
    this.queued = this.shallow = false
  }
}

/**
 * Evaluate the value of the watcher.
 * This only gets called for lazy watchers.
 */

Watcher.prototype.evaluate = function () {
  // avoid overwriting another watcher that is being
  // collected.
  var current = Dep.target
  this.value = this.get()
  this.dirty = false
  Dep.target = current
}

/**
 * Depend on all deps collected by this watcher.
 */

Watcher.prototype.depend = function () {
  var i = this.deps.length
  while (i--) {
    this.deps[i].depend()
  }
}

/**
 * Remove self from all dependencies' subcriber list.
 */

Watcher.prototype.teardown = function () {
  if (this.active) {
    // remove self from vm's watcher list
    // we can skip this if the vm if being destroyed
    // which can improve teardown performance.
    if (!this.vm._isBeingDestroyed) {
      this.vm._watchers.$remove(this)
    }
    var i = this.deps.length
    while (i--) {
      this.deps[i].removeSub(this)
    }
    this.active = false
    this.vm = this.cb = this.value = null
  }
}

/**
 * Recrusively traverse an object to evoke all converted
 * getters, so that every nested property inside the object
 * is collected as a "deep" dependency.
 *
 * @param {Object} obj
 */

function traverse (obj) {
  var key, val, i
  for (key in obj) {
    val = obj[key]
    if (_.isArray(val)) {
      i = val.length
      while (i--) traverse(val[i])
    } else if (_.isObject(val)) {
      traverse(val)
    }
  }
}

module.exports = Watcher

}).call(this,require('_process'))

},{"./batcher":16,"./config":22,"./observer/dep":56,"./parsers/expression":60,"./util":71,"_process":1}],76:[function(require,module,exports){
'use strict';

var Vue = require('vue');
Vue.use(require('vue-resource'));
var carComponent = require('./views/car-component.html');

Vue.component('car-component', {
  template: carComponent,

  props: ['catalogCar'],

  data: function data() {
    return {
      toggle: false
    };
  },

  methods: {
    accordion: function accordion() {
      this.toggle = !this.toggle;
      event.preventDefault();
    }
  }
});

var vm = new Vue({
  el: '#vue-app',

  data: {
    catalogCar: {},
    toggle: false
  },

  ready: function ready() {
    var url = 'http://www.carsensorlab.net/webapi/V2/catalogSearch/?output=json&brand=' + encodeURIComponent('ランボルギーニ');
    this.$http.jsonp(url, function (data, status, request) {
      this.$set('catalogCar', data.catalogCar);
    }).error(function (data, status, request) {
      console.error(status);
    });
  }
});

// console.warn('http://jp.vuejs.org/api/directives.html#v-attr');

},{"./views/car-component.html":77,"vue":74,"vue-resource":3}],77:[function(require,module,exports){
module.exports = "<div><h2>{{item.model}} <small>/ {{item.brand}}</small></h2><div class=\"media\"><div class=\"media__img\"><img src=\"{{item.imageFrontUrl}}\" alt=\"\" width=\"180\" height=\"135\" /></div><div class=\"media__body\"><p v-if=\"item.comment\">{{item.comment}}</p> <a href=\"#\" v-on=\"click: accordion\">詳細スペック</a><table v-show=\"toggle\"><tr><th>排気量</th><td>{{item.engineCapacity}}cc</td></tr><tr><th>車体サイズ</th><td>{{item.bodySize}}</td></tr><tr><th>生産期間</th><td>{{item.productionPeriod}}</td></tr></table></div></div></div>";

},{}]},{},[76])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvcHJvY2Vzcy9icm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL3Z1ZS1yZXNvdXJjZS9zcmMvaHR0cC5qcyIsIm5vZGVfbW9kdWxlcy92dWUtcmVzb3VyY2Uvc3JjL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3Z1ZS1yZXNvdXJjZS9zcmMvbGliL2pzb25wLmpzIiwibm9kZV9tb2R1bGVzL3Z1ZS1yZXNvdXJjZS9zcmMvbGliL3Byb21pc2UuanMiLCJub2RlX21vZHVsZXMvdnVlLXJlc291cmNlL3NyYy9saWIvdXRpbC5qcyIsIm5vZGVfbW9kdWxlcy92dWUtcmVzb3VyY2Uvc3JjL2xpYi94aHIuanMiLCJub2RlX21vZHVsZXMvdnVlLXJlc291cmNlL3NyYy9yZXNvdXJjZS5qcyIsIm5vZGVfbW9kdWxlcy92dWUtcmVzb3VyY2Uvc3JjL3VybC5qcyIsIm5vZGVfbW9kdWxlcy92dWUvc3JjL2FwaS9jaGlsZC5qcyIsIm5vZGVfbW9kdWxlcy92dWUvc3JjL2FwaS9kYXRhLmpzIiwibm9kZV9tb2R1bGVzL3Z1ZS9zcmMvYXBpL2RvbS5qcyIsIm5vZGVfbW9kdWxlcy92dWUvc3JjL2FwaS9ldmVudHMuanMiLCJub2RlX21vZHVsZXMvdnVlL3NyYy9hcGkvZ2xvYmFsLmpzIiwibm9kZV9tb2R1bGVzL3Z1ZS9zcmMvYXBpL2xpZmVjeWNsZS5qcyIsIm5vZGVfbW9kdWxlcy92dWUvc3JjL2JhdGNoZXIuanMiLCJub2RlX21vZHVsZXMvdnVlL3NyYy9jYWNoZS5qcyIsIm5vZGVfbW9kdWxlcy92dWUvc3JjL2NvbXBpbGVyL2NvbXBpbGUtcHJvcHMuanMiLCJub2RlX21vZHVsZXMvdnVlL3NyYy9jb21waWxlci9jb21waWxlLmpzIiwibm9kZV9tb2R1bGVzL3Z1ZS9zcmMvY29tcGlsZXIvaW5kZXguanMiLCJub2RlX21vZHVsZXMvdnVlL3NyYy9jb21waWxlci90cmFuc2NsdWRlLmpzIiwibm9kZV9tb2R1bGVzL3Z1ZS9zcmMvY29uZmlnLmpzIiwibm9kZV9tb2R1bGVzL3Z1ZS9zcmMvZGlyZWN0aXZlLmpzIiwibm9kZV9tb2R1bGVzL3Z1ZS9zcmMvZGlyZWN0aXZlcy9hdHRyLmpzIiwibm9kZV9tb2R1bGVzL3Z1ZS9zcmMvZGlyZWN0aXZlcy9jbGFzcy5qcyIsIm5vZGVfbW9kdWxlcy92dWUvc3JjL2RpcmVjdGl2ZXMvY2xvYWsuanMiLCJub2RlX21vZHVsZXMvdnVlL3NyYy9kaXJlY3RpdmVzL2NvbXBvbmVudC5qcyIsIm5vZGVfbW9kdWxlcy92dWUvc3JjL2RpcmVjdGl2ZXMvZWwuanMiLCJub2RlX21vZHVsZXMvdnVlL3NyYy9kaXJlY3RpdmVzL2h0bWwuanMiLCJub2RlX21vZHVsZXMvdnVlL3NyYy9kaXJlY3RpdmVzL2lmLmpzIiwibm9kZV9tb2R1bGVzL3Z1ZS9zcmMvZGlyZWN0aXZlcy9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy92dWUvc3JjL2RpcmVjdGl2ZXMvbW9kZWwvY2hlY2tib3guanMiLCJub2RlX21vZHVsZXMvdnVlL3NyYy9kaXJlY3RpdmVzL21vZGVsL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3Z1ZS9zcmMvZGlyZWN0aXZlcy9tb2RlbC9yYWRpby5qcyIsIm5vZGVfbW9kdWxlcy92dWUvc3JjL2RpcmVjdGl2ZXMvbW9kZWwvc2VsZWN0LmpzIiwibm9kZV9tb2R1bGVzL3Z1ZS9zcmMvZGlyZWN0aXZlcy9tb2RlbC90ZXh0LmpzIiwibm9kZV9tb2R1bGVzL3Z1ZS9zcmMvZGlyZWN0aXZlcy9vbi5qcyIsIm5vZGVfbW9kdWxlcy92dWUvc3JjL2RpcmVjdGl2ZXMvcHJvcC5qcyIsIm5vZGVfbW9kdWxlcy92dWUvc3JjL2RpcmVjdGl2ZXMvcmVmLmpzIiwibm9kZV9tb2R1bGVzL3Z1ZS9zcmMvZGlyZWN0aXZlcy9yZXBlYXQuanMiLCJub2RlX21vZHVsZXMvdnVlL3NyYy9kaXJlY3RpdmVzL3Nob3cuanMiLCJub2RlX21vZHVsZXMvdnVlL3NyYy9kaXJlY3RpdmVzL3N0eWxlLmpzIiwibm9kZV9tb2R1bGVzL3Z1ZS9zcmMvZGlyZWN0aXZlcy90ZXh0LmpzIiwibm9kZV9tb2R1bGVzL3Z1ZS9zcmMvZGlyZWN0aXZlcy90cmFuc2l0aW9uLmpzIiwibm9kZV9tb2R1bGVzL3Z1ZS9zcmMvZWxlbWVudC1kaXJlY3RpdmVzL2NvbnRlbnQuanMiLCJub2RlX21vZHVsZXMvdnVlL3NyYy9lbGVtZW50LWRpcmVjdGl2ZXMvaW5kZXguanMiLCJub2RlX21vZHVsZXMvdnVlL3NyYy9lbGVtZW50LWRpcmVjdGl2ZXMvcGFydGlhbC5qcyIsIm5vZGVfbW9kdWxlcy92dWUvc3JjL2ZpbHRlcnMvYXJyYXktZmlsdGVycy5qcyIsIm5vZGVfbW9kdWxlcy92dWUvc3JjL2ZpbHRlcnMvaW5kZXguanMiLCJub2RlX21vZHVsZXMvdnVlL3NyYy9pbnN0YW5jZS9jb21waWxlLmpzIiwibm9kZV9tb2R1bGVzL3Z1ZS9zcmMvaW5zdGFuY2UvZXZlbnRzLmpzIiwibm9kZV9tb2R1bGVzL3Z1ZS9zcmMvaW5zdGFuY2UvaW5pdC5qcyIsIm5vZGVfbW9kdWxlcy92dWUvc3JjL2luc3RhbmNlL21pc2MuanMiLCJub2RlX21vZHVsZXMvdnVlL3NyYy9pbnN0YW5jZS9zY29wZS5qcyIsIm5vZGVfbW9kdWxlcy92dWUvc3JjL29ic2VydmVyL2FycmF5LmpzIiwibm9kZV9tb2R1bGVzL3Z1ZS9zcmMvb2JzZXJ2ZXIvZGVwLmpzIiwibm9kZV9tb2R1bGVzL3Z1ZS9zcmMvb2JzZXJ2ZXIvaW5kZXguanMiLCJub2RlX21vZHVsZXMvdnVlL3NyYy9vYnNlcnZlci9vYmplY3QuanMiLCJub2RlX21vZHVsZXMvdnVlL3NyYy9wYXJzZXJzL2RpcmVjdGl2ZS5qcyIsIm5vZGVfbW9kdWxlcy92dWUvc3JjL3BhcnNlcnMvZXhwcmVzc2lvbi5qcyIsIm5vZGVfbW9kdWxlcy92dWUvc3JjL3BhcnNlcnMvcGF0aC5qcyIsIm5vZGVfbW9kdWxlcy92dWUvc3JjL3BhcnNlcnMvdGVtcGxhdGUuanMiLCJub2RlX21vZHVsZXMvdnVlL3NyYy9wYXJzZXJzL3RleHQuanMiLCJub2RlX21vZHVsZXMvdnVlL3NyYy90cmFuc2l0aW9uL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3Z1ZS9zcmMvdHJhbnNpdGlvbi9xdWV1ZS5qcyIsIm5vZGVfbW9kdWxlcy92dWUvc3JjL3RyYW5zaXRpb24vdHJhbnNpdGlvbi5qcyIsIm5vZGVfbW9kdWxlcy92dWUvc3JjL3V0aWwvY29tcG9uZW50LmpzIiwibm9kZV9tb2R1bGVzL3Z1ZS9zcmMvdXRpbC9kZWJ1Zy5qcyIsIm5vZGVfbW9kdWxlcy92dWUvc3JjL3V0aWwvZG9tLmpzIiwibm9kZV9tb2R1bGVzL3Z1ZS9zcmMvdXRpbC9lbnYuanMiLCJub2RlX21vZHVsZXMvdnVlL3NyYy91dGlsL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3Z1ZS9zcmMvdXRpbC9sYW5nLmpzIiwibm9kZV9tb2R1bGVzL3Z1ZS9zcmMvdXRpbC9vcHRpb25zLmpzIiwibm9kZV9tb2R1bGVzL3Z1ZS9zcmMvdnVlLmpzIiwibm9kZV9tb2R1bGVzL3Z1ZS9zcmMvd2F0Y2hlci5qcyIsIi9Vc2Vycy8wMTAwOTc0OC9TdHVkeS9hc2cvbGVhcm5pbmctdnVlanMvc3JjL2FwcC5qcyIsInNyYy92aWV3cy9jYXItY29tcG9uZW50Lmh0bWwiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0dBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbE9BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3ZIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDcEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ2xHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNoSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDdkxBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ2xuQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNoSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDNUhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ1ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ3hWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNaQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUN4Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDN0hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDMUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNsRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ2pDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUM1T0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNoSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDM0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDOURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDdEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ2x3QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0dBO0FBQ0E7QUFDQTs7O0FDRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ3pFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUN4TUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzNJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3pGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUM3RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUMxUkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFPQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDcExBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQ3hRQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzVWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxUkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaElBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNyVkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUM1SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUNoRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDaFJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3RUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ3JXQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3pGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7Ozs7QUN6VEEsSUFBSSxHQUFHLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ3pCLEdBQUcsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUM7QUFDakMsSUFBSSxZQUFZLEdBQUcsT0FBTyxDQUFDLDRCQUE0QixDQUFDLENBQUM7O0FBRXpELEdBQUcsQ0FBQyxTQUFTLENBQUMsZUFBZSxFQUFFO0FBQzdCLFVBQVEsRUFBRSxZQUFZOztBQUV0QixPQUFLLEVBQUUsQ0FBQyxZQUFZLENBQUM7O0FBRXJCLE1BQUksRUFBQSxnQkFBRztBQUNMLFdBQU87QUFDTCxZQUFNLEVBQUUsS0FBSztLQUNkLENBQUE7R0FDRjs7QUFFRCxTQUFPLEVBQUU7QUFDUCxhQUFTLEVBQUEscUJBQUc7QUFDVixVQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQztBQUMzQixXQUFLLENBQUMsY0FBYyxFQUFFLENBQUM7S0FDeEI7R0FDRjtDQUNGLENBQUMsQ0FBQzs7QUFFSCxJQUFJLEVBQUUsR0FBRyxJQUFJLEdBQUcsQ0FBQztBQUNmLElBQUUsRUFBRSxVQUFVOztBQUVkLE1BQUksRUFBRTtBQUNKLGNBQVUsRUFBRSxFQUFFO0FBQ2QsVUFBTSxFQUFFLEtBQUs7R0FDZDs7QUFFRCxPQUFLLEVBQUEsaUJBQUc7QUFDTixRQUFJLEdBQUcsR0FBRyx5RUFBeUUsR0FBRyxrQkFBa0IsQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUNwSCxRQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsVUFBVSxJQUFJLEVBQUUsTUFBTSxFQUFFLE9BQU8sRUFBRTtBQUNyRCxVQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7S0FDMUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxVQUFVLElBQUksRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFO0FBQ3hDLGFBQU8sQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7S0FDdkIsQ0FBQyxDQUFDO0dBQ0o7Q0FDRixDQUFDLENBQUM7Ozs7O0FDdkNIO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLy8gc2hpbSBmb3IgdXNpbmcgcHJvY2VzcyBpbiBicm93c2VyXG5cbnZhciBwcm9jZXNzID0gbW9kdWxlLmV4cG9ydHMgPSB7fTtcbnZhciBxdWV1ZSA9IFtdO1xudmFyIGRyYWluaW5nID0gZmFsc2U7XG52YXIgY3VycmVudFF1ZXVlO1xudmFyIHF1ZXVlSW5kZXggPSAtMTtcblxuZnVuY3Rpb24gY2xlYW5VcE5leHRUaWNrKCkge1xuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgaWYgKGN1cnJlbnRRdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgcXVldWUgPSBjdXJyZW50UXVldWUuY29uY2F0KHF1ZXVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgfVxuICAgIGlmIChxdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgZHJhaW5RdWV1ZSgpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZHJhaW5RdWV1ZSgpIHtcbiAgICBpZiAoZHJhaW5pbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgdGltZW91dCA9IHNldFRpbWVvdXQoY2xlYW5VcE5leHRUaWNrKTtcbiAgICBkcmFpbmluZyA9IHRydWU7XG5cbiAgICB2YXIgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIHdoaWxlKGxlbikge1xuICAgICAgICBjdXJyZW50UXVldWUgPSBxdWV1ZTtcbiAgICAgICAgcXVldWUgPSBbXTtcbiAgICAgICAgd2hpbGUgKCsrcXVldWVJbmRleCA8IGxlbikge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRRdWV1ZSkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRRdWV1ZVtxdWV1ZUluZGV4XS5ydW4oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgICAgIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB9XG4gICAgY3VycmVudFF1ZXVlID0gbnVsbDtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGNsZWFyVGltZW91dCh0aW1lb3V0KTtcbn1cblxucHJvY2Vzcy5uZXh0VGljayA9IGZ1bmN0aW9uIChmdW4pIHtcbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoIC0gMSk7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBxdWV1ZS5wdXNoKG5ldyBJdGVtKGZ1biwgYXJncykpO1xuICAgIGlmIChxdWV1ZS5sZW5ndGggPT09IDEgJiYgIWRyYWluaW5nKSB7XG4gICAgICAgIHNldFRpbWVvdXQoZHJhaW5RdWV1ZSwgMCk7XG4gICAgfVxufTtcblxuLy8gdjggbGlrZXMgcHJlZGljdGlibGUgb2JqZWN0c1xuZnVuY3Rpb24gSXRlbShmdW4sIGFycmF5KSB7XG4gICAgdGhpcy5mdW4gPSBmdW47XG4gICAgdGhpcy5hcnJheSA9IGFycmF5O1xufVxuSXRlbS5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuZnVuLmFwcGx5KG51bGwsIHRoaXMuYXJyYXkpO1xufTtcbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xucHJvY2Vzcy52ZXJzaW9uID0gJyc7IC8vIGVtcHR5IHN0cmluZyB0byBhdm9pZCByZWdleHAgaXNzdWVzXG5wcm9jZXNzLnZlcnNpb25zID0ge307XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG5wcm9jZXNzLmN3ZCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuICcvJyB9O1xucHJvY2Vzcy5jaGRpciA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuY2hkaXIgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcbnByb2Nlc3MudW1hc2sgPSBmdW5jdGlvbigpIHsgcmV0dXJuIDA7IH07XG4iLCIvKipcbiAqIFNlcnZpY2UgZm9yIHNlbmRpbmcgbmV0d29yayByZXF1ZXN0cy5cbiAqL1xuXG52YXIgeGhyID0gcmVxdWlyZSgnLi9saWIveGhyJyk7XG52YXIganNvbnAgPSByZXF1aXJlKCcuL2xpYi9qc29ucCcpO1xudmFyIFByb21pc2UgPSByZXF1aXJlKCcuL2xpYi9wcm9taXNlJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKF8pIHtcblxuICAgIHZhciBvcmlnaW5VcmwgPSBfLnVybC5wYXJzZShsb2NhdGlvbi5ocmVmKTtcbiAgICB2YXIganNvblR5cGUgPSB7J0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uO2NoYXJzZXQ9dXRmLTgnfTtcblxuICAgIGZ1bmN0aW9uIEh0dHAodXJsLCBvcHRpb25zKSB7XG5cbiAgICAgICAgdmFyIHByb21pc2U7XG5cbiAgICAgICAgaWYgKF8uaXNQbGFpbk9iamVjdCh1cmwpKSB7XG4gICAgICAgICAgICBvcHRpb25zID0gdXJsO1xuICAgICAgICAgICAgdXJsID0gJyc7XG4gICAgICAgIH1cblxuICAgICAgICBvcHRpb25zID0gXy5leHRlbmQoe3VybDogdXJsfSwgb3B0aW9ucyk7XG4gICAgICAgIG9wdGlvbnMgPSBfLmV4dGVuZCh0cnVlLCB7fSxcbiAgICAgICAgICAgIEh0dHAub3B0aW9ucywgdGhpcy5vcHRpb25zLCBvcHRpb25zXG4gICAgICAgICk7XG5cbiAgICAgICAgaWYgKG9wdGlvbnMuY3Jvc3NPcmlnaW4gPT09IG51bGwpIHtcbiAgICAgICAgICAgIG9wdGlvbnMuY3Jvc3NPcmlnaW4gPSBjcm9zc09yaWdpbihvcHRpb25zLnVybCk7XG4gICAgICAgIH1cblxuICAgICAgICBvcHRpb25zLm1ldGhvZCA9IG9wdGlvbnMubWV0aG9kLnRvVXBwZXJDYXNlKCk7XG4gICAgICAgIG9wdGlvbnMuaGVhZGVycyA9IF8uZXh0ZW5kKHt9LCBIdHRwLmhlYWRlcnMuY29tbW9uLFxuICAgICAgICAgICAgIW9wdGlvbnMuY3Jvc3NPcmlnaW4gPyBIdHRwLmhlYWRlcnMuY3VzdG9tIDoge30sXG4gICAgICAgICAgICBIdHRwLmhlYWRlcnNbb3B0aW9ucy5tZXRob2QudG9Mb3dlckNhc2UoKV0sXG4gICAgICAgICAgICBvcHRpb25zLmhlYWRlcnNcbiAgICAgICAgKTtcblxuICAgICAgICBpZiAoXy5pc1BsYWluT2JqZWN0KG9wdGlvbnMuZGF0YSkgJiYgL14oR0VUfEpTT05QKSQvaS50ZXN0KG9wdGlvbnMubWV0aG9kKSkge1xuICAgICAgICAgICAgXy5leHRlbmQob3B0aW9ucy5wYXJhbXMsIG9wdGlvbnMuZGF0YSk7XG4gICAgICAgICAgICBkZWxldGUgb3B0aW9ucy5kYXRhO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdGlvbnMuZW11bGF0ZUhUVFAgJiYgIW9wdGlvbnMuY3Jvc3NPcmlnaW4gJiYgL14oUFVUfFBBVENIfERFTEVURSkkL2kudGVzdChvcHRpb25zLm1ldGhvZCkpIHtcbiAgICAgICAgICAgIG9wdGlvbnMuaGVhZGVyc1snWC1IVFRQLU1ldGhvZC1PdmVycmlkZSddID0gb3B0aW9ucy5tZXRob2Q7XG4gICAgICAgICAgICBvcHRpb25zLm1ldGhvZCA9ICdQT1NUJztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zLmVtdWxhdGVKU09OICYmIF8uaXNQbGFpbk9iamVjdChvcHRpb25zLmRhdGEpKSB7XG4gICAgICAgICAgICBvcHRpb25zLmhlYWRlcnNbJ0NvbnRlbnQtVHlwZSddID0gJ2FwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZCc7XG4gICAgICAgICAgICBvcHRpb25zLmRhdGEgPSBfLnVybC5wYXJhbXMob3B0aW9ucy5kYXRhKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChfLmlzT2JqZWN0KG9wdGlvbnMuZGF0YSkgJiYgL0Zvcm1EYXRhL2kudGVzdChvcHRpb25zLmRhdGEudG9TdHJpbmcoKSkpIHtcbiAgICAgICAgICAgIGRlbGV0ZSBvcHRpb25zLmhlYWRlcnNbJ0NvbnRlbnQtVHlwZSddO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKF8uaXNQbGFpbk9iamVjdChvcHRpb25zLmRhdGEpKSB7XG4gICAgICAgICAgICBvcHRpb25zLmRhdGEgPSBKU09OLnN0cmluZ2lmeShvcHRpb25zLmRhdGEpO1xuICAgICAgICB9XG5cbiAgICAgICAgcHJvbWlzZSA9IChvcHRpb25zLm1ldGhvZCA9PSAnSlNPTlAnID8ganNvbnAgOiB4aHIpLmNhbGwodGhpcy52bSwgXywgb3B0aW9ucyk7XG4gICAgICAgIHByb21pc2UgPSBleHRlbmRQcm9taXNlKHByb21pc2UudGhlbih0cmFuc2Zvcm1SZXNwb25zZSwgdHJhbnNmb3JtUmVzcG9uc2UpLCB0aGlzLnZtKTtcblxuICAgICAgICBpZiAob3B0aW9ucy5zdWNjZXNzKSB7XG4gICAgICAgICAgICBwcm9taXNlID0gcHJvbWlzZS5zdWNjZXNzKG9wdGlvbnMuc3VjY2Vzcyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy5lcnJvcikge1xuICAgICAgICAgICAgcHJvbWlzZSA9IHByb21pc2UuZXJyb3Iob3B0aW9ucy5lcnJvcik7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcHJvbWlzZTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBleHRlbmRQcm9taXNlKHByb21pc2UsIHZtKSB7XG5cbiAgICAgICAgcHJvbWlzZS5zdWNjZXNzID0gZnVuY3Rpb24gKGZuKSB7XG5cbiAgICAgICAgICAgIHJldHVybiBleHRlbmRQcm9taXNlKHByb21pc2UudGhlbihmdW5jdGlvbiAocmVzcG9uc2UpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZm4uY2FsbCh2bSwgcmVzcG9uc2UuZGF0YSwgcmVzcG9uc2Uuc3RhdHVzLCByZXNwb25zZSkgfHwgcmVzcG9uc2U7XG4gICAgICAgICAgICB9KSwgdm0pO1xuXG4gICAgICAgIH07XG5cbiAgICAgICAgcHJvbWlzZS5lcnJvciA9IGZ1bmN0aW9uIChmbikge1xuXG4gICAgICAgICAgICByZXR1cm4gZXh0ZW5kUHJvbWlzZShwcm9taXNlLnRoZW4odW5kZWZpbmVkLCBmdW5jdGlvbiAocmVzcG9uc2UpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZm4uY2FsbCh2bSwgcmVzcG9uc2UuZGF0YSwgcmVzcG9uc2Uuc3RhdHVzLCByZXNwb25zZSkgfHwgcmVzcG9uc2U7XG4gICAgICAgICAgICB9KSwgdm0pO1xuXG4gICAgICAgIH07XG5cbiAgICAgICAgcHJvbWlzZS5hbHdheXMgPSBmdW5jdGlvbiAoZm4pIHtcblxuICAgICAgICAgICAgdmFyIGNiID0gZnVuY3Rpb24gKHJlc3BvbnNlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZuLmNhbGwodm0sIHJlc3BvbnNlLmRhdGEsIHJlc3BvbnNlLnN0YXR1cywgcmVzcG9uc2UpIHx8IHJlc3BvbnNlO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgcmV0dXJuIGV4dGVuZFByb21pc2UocHJvbWlzZS50aGVuKGNiLCBjYiksIHZtKTtcbiAgICAgICAgfTtcblxuICAgICAgICByZXR1cm4gcHJvbWlzZTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiB0cmFuc2Zvcm1SZXNwb25zZShyZXNwb25zZSkge1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICByZXNwb25zZS5kYXRhID0gSlNPTi5wYXJzZShyZXNwb25zZS5yZXNwb25zZVRleHQpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICByZXNwb25zZS5kYXRhID0gcmVzcG9uc2UucmVzcG9uc2VUZXh0O1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlc3BvbnNlLm9rID8gcmVzcG9uc2UgOiBQcm9taXNlLnJlamVjdChyZXNwb25zZSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY3Jvc3NPcmlnaW4odXJsKSB7XG5cbiAgICAgICAgdmFyIHJlcXVlc3RVcmwgPSBfLnVybC5wYXJzZSh1cmwpO1xuXG4gICAgICAgIHJldHVybiAocmVxdWVzdFVybC5wcm90b2NvbCAhPT0gb3JpZ2luVXJsLnByb3RvY29sIHx8IHJlcXVlc3RVcmwuaG9zdCAhPT0gb3JpZ2luVXJsLmhvc3QpO1xuICAgIH1cblxuICAgIEh0dHAub3B0aW9ucyA9IHtcbiAgICAgICAgbWV0aG9kOiAnZ2V0JyxcbiAgICAgICAgcGFyYW1zOiB7fSxcbiAgICAgICAgZGF0YTogJycsXG4gICAgICAgIHhocjogbnVsbCxcbiAgICAgICAganNvbnA6ICdjYWxsYmFjaycsXG4gICAgICAgIGJlZm9yZVNlbmQ6IG51bGwsXG4gICAgICAgIGNyb3NzT3JpZ2luOiBudWxsLFxuICAgICAgICBlbXVsYXRlSFRUUDogZmFsc2UsXG4gICAgICAgIGVtdWxhdGVKU09OOiBmYWxzZVxuICAgIH07XG5cbiAgICBIdHRwLmhlYWRlcnMgPSB7XG4gICAgICAgIHB1dDoganNvblR5cGUsXG4gICAgICAgIHBvc3Q6IGpzb25UeXBlLFxuICAgICAgICBwYXRjaDoganNvblR5cGUsXG4gICAgICAgIGRlbGV0ZToganNvblR5cGUsXG4gICAgICAgIGNvbW1vbjogeydBY2NlcHQnOiAnYXBwbGljYXRpb24vanNvbiwgdGV4dC9wbGFpbiwgKi8qJ30sXG4gICAgICAgIGN1c3RvbTogeydYLVJlcXVlc3RlZC1XaXRoJzogJ1hNTEh0dHBSZXF1ZXN0J31cbiAgICB9O1xuXG4gICAgWydnZXQnLCAncHV0JywgJ3Bvc3QnLCAncGF0Y2gnLCAnZGVsZXRlJywgJ2pzb25wJ10uZm9yRWFjaChmdW5jdGlvbiAobWV0aG9kKSB7XG5cbiAgICAgICAgSHR0cFttZXRob2RdID0gZnVuY3Rpb24gKHVybCwgZGF0YSwgc3VjY2Vzcywgb3B0aW9ucykge1xuXG4gICAgICAgICAgICBpZiAoXy5pc0Z1bmN0aW9uKGRhdGEpKSB7XG4gICAgICAgICAgICAgICAgb3B0aW9ucyA9IHN1Y2Nlc3M7XG4gICAgICAgICAgICAgICAgc3VjY2VzcyA9IGRhdGE7XG4gICAgICAgICAgICAgICAgZGF0YSA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHRoaXModXJsLCBfLmV4dGVuZCh7bWV0aG9kOiBtZXRob2QsIGRhdGE6IGRhdGEsIHN1Y2Nlc3M6IHN1Y2Nlc3N9LCBvcHRpb25zKSk7XG4gICAgICAgIH07XG4gICAgfSk7XG5cbiAgICByZXR1cm4gXy5odHRwID0gSHR0cDtcbn07XG4iLCIvKipcbiAqIEluc3RhbGwgcGx1Z2luLlxuICovXG5cbmZ1bmN0aW9uIGluc3RhbGwoVnVlKSB7XG5cbiAgICB2YXIgXyA9IHJlcXVpcmUoJy4vbGliL3V0aWwnKShWdWUpO1xuXG4gICAgVnVlLnVybCA9IHJlcXVpcmUoJy4vdXJsJykoXyk7XG4gICAgVnVlLmh0dHAgPSByZXF1aXJlKCcuL2h0dHAnKShfKTtcbiAgICBWdWUucmVzb3VyY2UgPSByZXF1aXJlKCcuL3Jlc291cmNlJykoXyk7XG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyhWdWUucHJvdG90eXBlLCB7XG5cbiAgICAgICAgJHVybDoge1xuICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3VybCB8fCAodGhpcy5fdXJsID0gXy5vcHRpb25zKFZ1ZS51cmwsIHRoaXMsIHRoaXMuJG9wdGlvbnMudXJsKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG5cbiAgICAgICAgJGh0dHA6IHtcbiAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9odHRwIHx8ICh0aGlzLl9odHRwID0gXy5vcHRpb25zKFZ1ZS5odHRwLCB0aGlzLCB0aGlzLiRvcHRpb25zLmh0dHApKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcblxuICAgICAgICAkcmVzb3VyY2U6IHtcbiAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBWdWUucmVzb3VyY2UuYmluZCh0aGlzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgfSk7XG59XG5cbmlmICh3aW5kb3cuVnVlKSB7XG4gICAgVnVlLnVzZShpbnN0YWxsKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBpbnN0YWxsOyIsIi8qKlxuICogSlNPTlAgcmVxdWVzdC5cbiAqL1xuXG52YXIgUHJvbWlzZSA9IHJlcXVpcmUoJy4vcHJvbWlzZScpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChfLCBvcHRpb25zKSB7XG5cbiAgICB2YXIgY2FsbGJhY2sgPSAnX2pzb25wJyArIE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnN1YnN0cigyKSwgcmVzcG9uc2UgPSB7fSwgc2NyaXB0LCBib2R5O1xuXG4gICAgb3B0aW9ucy5wYXJhbXNbb3B0aW9ucy5qc29ucF0gPSBjYWxsYmFjaztcblxuICAgIGlmIChfLmlzRnVuY3Rpb24ob3B0aW9ucy5iZWZvcmVTZW5kKSkge1xuICAgICAgICBvcHRpb25zLmJlZm9yZVNlbmQuY2FsbCh0aGlzLCB7fSwgb3B0aW9ucyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcblxuICAgICAgICBzY3JpcHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzY3JpcHQnKTtcbiAgICAgICAgc2NyaXB0LnNyYyA9IF8udXJsKG9wdGlvbnMpO1xuICAgICAgICBzY3JpcHQudHlwZSA9ICd0ZXh0L2phdmFzY3JpcHQnO1xuICAgICAgICBzY3JpcHQuYXN5bmMgPSB0cnVlO1xuXG4gICAgICAgIHdpbmRvd1tjYWxsYmFja10gPSBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICAgICAgYm9keSA9IGRhdGE7XG4gICAgICAgIH07XG5cbiAgICAgICAgdmFyIGhhbmRsZXIgPSBmdW5jdGlvbiAoZXZlbnQpIHtcblxuICAgICAgICAgICAgZGVsZXRlIHdpbmRvd1tjYWxsYmFja107XG4gICAgICAgICAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKHNjcmlwdCk7XG5cbiAgICAgICAgICAgIGlmIChldmVudC50eXBlID09PSAnbG9hZCcgJiYgIWJvZHkpIHtcbiAgICAgICAgICAgICAgICBldmVudC50eXBlID0gJ2Vycm9yJztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmVzcG9uc2Uub2sgPSBldmVudC50eXBlICE9PSAnZXJyb3InO1xuICAgICAgICAgICAgcmVzcG9uc2Uuc3RhdHVzID0gcmVzcG9uc2Uub2sgPyAyMDAgOiA0MDQ7XG4gICAgICAgICAgICByZXNwb25zZS5yZXNwb25zZVRleHQgPSBib2R5ID8gYm9keSA6IGV2ZW50LnR5cGU7XG5cbiAgICAgICAgICAgIChyZXNwb25zZS5vayA/IHJlc29sdmUgOiByZWplY3QpKHJlc3BvbnNlKTtcbiAgICAgICAgfTtcblxuICAgICAgICBzY3JpcHQub25sb2FkID0gaGFuZGxlcjtcbiAgICAgICAgc2NyaXB0Lm9uZXJyb3IgPSBoYW5kbGVyO1xuXG4gICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoc2NyaXB0KTtcbiAgICB9KTtcblxufTtcbiIsIi8qKlxuICogUHJvbWlzZXMvQSsgcG9seWZpbGwgdjEuMS4wIChodHRwczovL2dpdGh1Yi5jb20vYnJhbXN0ZWluL3Byb21pcylcbiAqL1xuXG52YXIgUkVTT0xWRUQgPSAwO1xudmFyIFJFSkVDVEVEID0gMTtcbnZhciBQRU5ESU5HICA9IDI7XG5cbmZ1bmN0aW9uIFByb21pc2UoZXhlY3V0b3IpIHtcblxuICAgIHRoaXMuc3RhdGUgPSBQRU5ESU5HO1xuICAgIHRoaXMudmFsdWUgPSB1bmRlZmluZWQ7XG4gICAgdGhpcy5kZWZlcnJlZCA9IFtdO1xuXG4gICAgdmFyIHByb21pc2UgPSB0aGlzO1xuXG4gICAgdHJ5IHtcbiAgICAgICAgZXhlY3V0b3IoZnVuY3Rpb24gKHgpIHtcbiAgICAgICAgICAgIHByb21pc2UucmVzb2x2ZSh4KTtcbiAgICAgICAgfSwgZnVuY3Rpb24gKHIpIHtcbiAgICAgICAgICAgIHByb21pc2UucmVqZWN0KHIpO1xuICAgICAgICB9KTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHByb21pc2UucmVqZWN0KGUpO1xuICAgIH1cbn1cblxuUHJvbWlzZS5yZWplY3QgPSBmdW5jdGlvbiAocikge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgIHJlamVjdChyKTtcbiAgICB9KTtcbn07XG5cblByb21pc2UucmVzb2x2ZSA9IGZ1bmN0aW9uICh4KSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgcmVzb2x2ZSh4KTtcbiAgICB9KTtcbn07XG5cblByb21pc2UuYWxsID0gZnVuY3Rpb24gYWxsKGl0ZXJhYmxlKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgdmFyIGNvdW50ID0gMCxcbiAgICAgICAgICAgIHJlc3VsdCA9IFtdO1xuXG4gICAgICAgIGlmIChpdGVyYWJsZS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIHJlc29sdmUocmVzdWx0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIHJlc29sdmVyKGkpIHtcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbiAoeCkge1xuICAgICAgICAgICAgICAgIHJlc3VsdFtpXSA9IHg7XG4gICAgICAgICAgICAgICAgY291bnQgKz0gMTtcblxuICAgICAgICAgICAgICAgIGlmIChjb3VudCA9PT0gaXRlcmFibGUubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUocmVzdWx0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBpdGVyYWJsZS5sZW5ndGg7IGkgKz0gMSkge1xuICAgICAgICAgICAgaXRlcmFibGVbaV0udGhlbihyZXNvbHZlcihpKSwgcmVqZWN0KTtcbiAgICAgICAgfVxuICAgIH0pO1xufTtcblxuUHJvbWlzZS5yYWNlID0gZnVuY3Rpb24gcmFjZShpdGVyYWJsZSkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgaXRlcmFibGUubGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgICAgICAgIGl0ZXJhYmxlW2ldLnRoZW4ocmVzb2x2ZSwgcmVqZWN0KTtcbiAgICAgICAgfVxuICAgIH0pO1xufTtcblxudmFyIHAgPSBQcm9taXNlLnByb3RvdHlwZTtcblxucC5yZXNvbHZlID0gZnVuY3Rpb24gcmVzb2x2ZSh4KSB7XG4gICAgdmFyIHByb21pc2UgPSB0aGlzO1xuXG4gICAgaWYgKHByb21pc2Uuc3RhdGUgPT09IFBFTkRJTkcpIHtcbiAgICAgICAgaWYgKHggPT09IHByb21pc2UpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1Byb21pc2Ugc2V0dGxlZCB3aXRoIGl0c2VsZi4nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBjYWxsZWQgPSBmYWxzZTtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgdmFyIHRoZW4gPSB4ICYmIHhbJ3RoZW4nXTtcblxuICAgICAgICAgICAgaWYgKHggIT09IG51bGwgJiYgdHlwZW9mIHggPT09ICdvYmplY3QnICYmIHR5cGVvZiB0aGVuID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgdGhlbi5jYWxsKHgsIGZ1bmN0aW9uICh4KSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghY2FsbGVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9taXNlLnJlc29sdmUoeCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgY2FsbGVkID0gdHJ1ZTtcblxuICAgICAgICAgICAgICAgIH0sIGZ1bmN0aW9uIChyKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghY2FsbGVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9taXNlLnJlamVjdChyKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBjYWxsZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgaWYgKCFjYWxsZWQpIHtcbiAgICAgICAgICAgICAgICBwcm9taXNlLnJlamVjdChlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBwcm9taXNlLnN0YXRlID0gUkVTT0xWRUQ7XG4gICAgICAgIHByb21pc2UudmFsdWUgPSB4O1xuICAgICAgICBwcm9taXNlLm5vdGlmeSgpO1xuICAgIH1cbn07XG5cbnAucmVqZWN0ID0gZnVuY3Rpb24gcmVqZWN0KHJlYXNvbikge1xuICAgIHZhciBwcm9taXNlID0gdGhpcztcblxuICAgIGlmIChwcm9taXNlLnN0YXRlID09PSBQRU5ESU5HKSB7XG4gICAgICAgIGlmIChyZWFzb24gPT09IHByb21pc2UpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1Byb21pc2Ugc2V0dGxlZCB3aXRoIGl0c2VsZi4nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHByb21pc2Uuc3RhdGUgPSBSRUpFQ1RFRDtcbiAgICAgICAgcHJvbWlzZS52YWx1ZSA9IHJlYXNvbjtcbiAgICAgICAgcHJvbWlzZS5ub3RpZnkoKTtcbiAgICB9XG59O1xuXG5wLm5vdGlmeSA9IGZ1bmN0aW9uIG5vdGlmeSgpIHtcbiAgICB2YXIgcHJvbWlzZSA9IHRoaXM7XG5cbiAgICBhc3luYyhmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmIChwcm9taXNlLnN0YXRlICE9PSBQRU5ESU5HKSB7XG4gICAgICAgICAgICB3aGlsZSAocHJvbWlzZS5kZWZlcnJlZC5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICB2YXIgZGVmZXJyZWQgPSBwcm9taXNlLmRlZmVycmVkLnNoaWZ0KCksXG4gICAgICAgICAgICAgICAgICAgIG9uUmVzb2x2ZWQgPSBkZWZlcnJlZFswXSxcbiAgICAgICAgICAgICAgICAgICAgb25SZWplY3RlZCA9IGRlZmVycmVkWzFdLFxuICAgICAgICAgICAgICAgICAgICByZXNvbHZlID0gZGVmZXJyZWRbMl0sXG4gICAgICAgICAgICAgICAgICAgIHJlamVjdCA9IGRlZmVycmVkWzNdO1xuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHByb21pc2Uuc3RhdGUgPT09IFJFU09MVkVEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIG9uUmVzb2x2ZWQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKG9uUmVzb2x2ZWQuY2FsbCh1bmRlZmluZWQsIHByb21pc2UudmFsdWUpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShwcm9taXNlLnZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChwcm9taXNlLnN0YXRlID09PSBSRUpFQ1RFRCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBvblJlamVjdGVkID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShvblJlamVjdGVkLmNhbGwodW5kZWZpbmVkLCBwcm9taXNlLnZhbHVlKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChwcm9taXNlLnZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xufTtcblxucC5jYXRjaCA9IGZ1bmN0aW9uIChvblJlamVjdGVkKSB7XG4gICAgcmV0dXJuIHRoaXMudGhlbih1bmRlZmluZWQsIG9uUmVqZWN0ZWQpO1xufTtcblxucC50aGVuID0gZnVuY3Rpb24gdGhlbihvblJlc29sdmVkLCBvblJlamVjdGVkKSB7XG4gICAgdmFyIHByb21pc2UgPSB0aGlzO1xuXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgcHJvbWlzZS5kZWZlcnJlZC5wdXNoKFtvblJlc29sdmVkLCBvblJlamVjdGVkLCByZXNvbHZlLCByZWplY3RdKTtcbiAgICAgICAgcHJvbWlzZS5ub3RpZnkoKTtcbiAgICB9KTtcbn07XG5cbnZhciBxdWV1ZSA9IFtdO1xudmFyIGFzeW5jID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgcXVldWUucHVzaChjYWxsYmFjayk7XG5cbiAgICBpZiAocXVldWUubGVuZ3RoID09PSAxKSB7XG4gICAgICAgIGFzeW5jLmFzeW5jKCk7XG4gICAgfVxufTtcblxuYXN5bmMucnVuID0gZnVuY3Rpb24gKCkge1xuICAgIHdoaWxlIChxdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgcXVldWVbMF0oKTtcbiAgICAgICAgcXVldWUuc2hpZnQoKTtcbiAgICB9XG59O1xuXG5pZiAod2luZG93Lk11dGF0aW9uT2JzZXJ2ZXIpIHtcbiAgICB2YXIgZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICB2YXIgbW8gPSBuZXcgTXV0YXRpb25PYnNlcnZlcihhc3luYy5ydW4pO1xuXG4gICAgbW8ub2JzZXJ2ZShlbCwge1xuICAgICAgICBhdHRyaWJ1dGVzOiB0cnVlXG4gICAgfSk7XG5cbiAgICBhc3luYy5hc3luYyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZWwuc2V0QXR0cmlidXRlKFwieFwiLCAwKTtcbiAgICB9O1xufSBlbHNlIHtcbiAgICBhc3luYy5hc3luYyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgc2V0VGltZW91dChhc3luYy5ydW4pO1xuICAgIH07XG59XG5cbm1vZHVsZS5leHBvcnRzID0gd2luZG93LlByb21pc2UgfHwgUHJvbWlzZTtcbiIsIi8qKlxuICogVXRpbGl0eSBmdW5jdGlvbnMuXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoVnVlKSB7XG5cbiAgICB2YXIgXyA9IFZ1ZS51dGlsLmV4dGVuZCh7fSwgVnVlLnV0aWwpO1xuXG4gICAgXy5pc1N0cmluZyA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJztcbiAgICB9O1xuXG4gICAgXy5pc0Z1bmN0aW9uID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbic7XG4gICAgfTtcblxuICAgIF8ub3B0aW9ucyA9IGZ1bmN0aW9uIChmbiwgb2JqLCBvcHRpb25zKSB7XG5cbiAgICAgICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cbiAgICAgICAgaWYgKF8uaXNGdW5jdGlvbihvcHRpb25zKSkge1xuICAgICAgICAgICAgb3B0aW9ucyA9IG9wdGlvbnMuY2FsbChvYmopO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIF8uZXh0ZW5kKGZuLmJpbmQoe3ZtOiBvYmosIG9wdGlvbnM6IG9wdGlvbnN9KSwgZm4sIHtvcHRpb25zOiBvcHRpb25zfSk7XG4gICAgfTtcblxuICAgIF8uZWFjaCA9IGZ1bmN0aW9uIChvYmosIGl0ZXJhdG9yKSB7XG5cbiAgICAgICAgdmFyIGksIGtleTtcblxuICAgICAgICBpZiAodHlwZW9mIG9iai5sZW5ndGggPT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBvYmoubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpdGVyYXRvci5jYWxsKG9ialtpXSwgb2JqW2ldLCBpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChfLmlzT2JqZWN0KG9iaikpIHtcbiAgICAgICAgICAgIGZvciAoa2V5IGluIG9iaikge1xuICAgICAgICAgICAgICAgIGlmIChvYmouaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgICAgICAgICBpdGVyYXRvci5jYWxsKG9ialtrZXldLCBvYmpba2V5XSwga2V5KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gb2JqO1xuICAgIH07XG5cbiAgICBfLmV4dGVuZCA9IGZ1bmN0aW9uICh0YXJnZXQpIHtcblxuICAgICAgICB2YXIgYXJyYXkgPSBbXSwgYXJncyA9IGFycmF5LnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSwgZGVlcDtcblxuICAgICAgICBpZiAodHlwZW9mIHRhcmdldCA9PSAnYm9vbGVhbicpIHtcbiAgICAgICAgICAgIGRlZXAgPSB0YXJnZXQ7XG4gICAgICAgICAgICB0YXJnZXQgPSBhcmdzLnNoaWZ0KCk7XG4gICAgICAgIH1cblxuICAgICAgICBhcmdzLmZvckVhY2goZnVuY3Rpb24gKGFyZykge1xuICAgICAgICAgICAgZXh0ZW5kKHRhcmdldCwgYXJnLCBkZWVwKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIHRhcmdldDtcbiAgICB9O1xuXG4gICAgZnVuY3Rpb24gZXh0ZW5kKHRhcmdldCwgc291cmNlLCBkZWVwKSB7XG4gICAgICAgIGZvciAodmFyIGtleSBpbiBzb3VyY2UpIHtcbiAgICAgICAgICAgIGlmIChkZWVwICYmIChfLmlzUGxhaW5PYmplY3Qoc291cmNlW2tleV0pIHx8IF8uaXNBcnJheShzb3VyY2Vba2V5XSkpKSB7XG4gICAgICAgICAgICAgICAgaWYgKF8uaXNQbGFpbk9iamVjdChzb3VyY2Vba2V5XSkgJiYgIV8uaXNQbGFpbk9iamVjdCh0YXJnZXRba2V5XSkpIHtcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0W2tleV0gPSB7fTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKF8uaXNBcnJheShzb3VyY2Vba2V5XSkgJiYgIV8uaXNBcnJheSh0YXJnZXRba2V5XSkpIHtcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0W2tleV0gPSBbXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZXh0ZW5kKHRhcmdldFtrZXldLCBzb3VyY2Vba2V5XSwgZGVlcCk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHNvdXJjZVtrZXldICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICB0YXJnZXRba2V5XSA9IHNvdXJjZVtrZXldO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIF87XG59O1xuIiwiLyoqXG4gKiBYTUxIdHRwIHJlcXVlc3QuXG4gKi9cblxudmFyIFByb21pc2UgPSByZXF1aXJlKCcuL3Byb21pc2UnKTtcbnZhciBYRG9tYWluID0gd2luZG93LlhEb21haW5SZXF1ZXN0O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChfLCBvcHRpb25zKSB7XG5cbiAgICB2YXIgcmVxdWVzdCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpLCBwcm9taXNlO1xuXG4gICAgaWYgKFhEb21haW4gJiYgb3B0aW9ucy5jcm9zc09yaWdpbikge1xuICAgICAgICByZXF1ZXN0ID0gbmV3IFhEb21haW5SZXF1ZXN0KCk7IG9wdGlvbnMuaGVhZGVycyA9IHt9O1xuICAgIH1cblxuICAgIGlmIChfLmlzUGxhaW5PYmplY3Qob3B0aW9ucy54aHIpKSB7XG4gICAgICAgIF8uZXh0ZW5kKHJlcXVlc3QsIG9wdGlvbnMueGhyKTtcbiAgICB9XG5cbiAgICBpZiAoXy5pc0Z1bmN0aW9uKG9wdGlvbnMuYmVmb3JlU2VuZCkpIHtcbiAgICAgICAgb3B0aW9ucy5iZWZvcmVTZW5kLmNhbGwodGhpcywgcmVxdWVzdCwgb3B0aW9ucyk7XG4gICAgfVxuXG4gICAgcHJvbWlzZSA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcblxuICAgICAgICByZXF1ZXN0Lm9wZW4ob3B0aW9ucy5tZXRob2QsIF8udXJsKG9wdGlvbnMpLCB0cnVlKTtcblxuICAgICAgICBfLmVhY2gob3B0aW9ucy5oZWFkZXJzLCBmdW5jdGlvbiAodmFsdWUsIGhlYWRlcikge1xuICAgICAgICAgICAgcmVxdWVzdC5zZXRSZXF1ZXN0SGVhZGVyKGhlYWRlciwgdmFsdWUpO1xuICAgICAgICB9KTtcblxuICAgICAgICB2YXIgaGFuZGxlciA9IGZ1bmN0aW9uIChldmVudCkge1xuXG4gICAgICAgICAgICByZXF1ZXN0Lm9rID0gZXZlbnQudHlwZSA9PT0gJ2xvYWQnO1xuXG4gICAgICAgICAgICBpZiAocmVxdWVzdC5vayAmJiByZXF1ZXN0LnN0YXR1cykge1xuICAgICAgICAgICAgICAgIHJlcXVlc3Qub2sgPSByZXF1ZXN0LnN0YXR1cyA+PSAyMDAgJiYgcmVxdWVzdC5zdGF0dXMgPCAzMDA7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIChyZXF1ZXN0Lm9rID8gcmVzb2x2ZSA6IHJlamVjdCkocmVxdWVzdCk7XG4gICAgICAgIH07XG5cbiAgICAgICAgcmVxdWVzdC5vbmxvYWQgPSBoYW5kbGVyO1xuICAgICAgICByZXF1ZXN0Lm9uYWJvcnQgPSBoYW5kbGVyO1xuICAgICAgICByZXF1ZXN0Lm9uZXJyb3IgPSBoYW5kbGVyO1xuXG4gICAgICAgIHJlcXVlc3Quc2VuZChvcHRpb25zLmRhdGEpO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIHByb21pc2U7XG59O1xuIiwiLyoqXG4gKiBTZXJ2aWNlIGZvciBpbnRlcmFjdGluZyB3aXRoIFJFU1RmdWwgc2VydmljZXMuXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoXykge1xuXG4gICAgZnVuY3Rpb24gUmVzb3VyY2UodXJsLCBwYXJhbXMsIGFjdGlvbnMpIHtcblxuICAgICAgICB2YXIgc2VsZiA9IHRoaXMsIHJlc291cmNlID0ge307XG5cbiAgICAgICAgYWN0aW9ucyA9IF8uZXh0ZW5kKHt9LFxuICAgICAgICAgICAgUmVzb3VyY2UuYWN0aW9ucyxcbiAgICAgICAgICAgIGFjdGlvbnNcbiAgICAgICAgKTtcblxuICAgICAgICBfLmVhY2goYWN0aW9ucywgZnVuY3Rpb24gKGFjdGlvbiwgbmFtZSkge1xuXG4gICAgICAgICAgICBhY3Rpb24gPSBfLmV4dGVuZCh0cnVlLCB7dXJsOiB1cmwsIHBhcmFtczogcGFyYW1zIHx8IHt9fSwgYWN0aW9uKTtcblxuICAgICAgICAgICAgcmVzb3VyY2VbbmFtZV0gPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIChzZWxmLiRodHRwIHx8IF8uaHR0cCkob3B0cyhhY3Rpb24sIGFyZ3VtZW50cykpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIHJlc291cmNlO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIG9wdHMoYWN0aW9uLCBhcmdzKSB7XG5cbiAgICAgICAgdmFyIG9wdGlvbnMgPSBfLmV4dGVuZCh7fSwgYWN0aW9uKSwgcGFyYW1zID0ge30sIGRhdGEsIHN1Y2Nlc3MsIGVycm9yO1xuXG4gICAgICAgIHN3aXRjaCAoYXJncy5sZW5ndGgpIHtcblxuICAgICAgICAgICAgY2FzZSA0OlxuXG4gICAgICAgICAgICAgICAgZXJyb3IgPSBhcmdzWzNdO1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3MgPSBhcmdzWzJdO1xuXG4gICAgICAgICAgICBjYXNlIDM6XG4gICAgICAgICAgICBjYXNlIDI6XG5cbiAgICAgICAgICAgICAgICBpZiAoXy5pc0Z1bmN0aW9uKGFyZ3NbMV0pKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKF8uaXNGdW5jdGlvbihhcmdzWzBdKSkge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBzdWNjZXNzID0gYXJnc1swXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVycm9yID0gYXJnc1sxXTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzID0gYXJnc1sxXTtcbiAgICAgICAgICAgICAgICAgICAgZXJyb3IgPSBhcmdzWzJdO1xuXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgICAgICAgICBwYXJhbXMgPSBhcmdzWzBdO1xuICAgICAgICAgICAgICAgICAgICBkYXRhID0gYXJnc1sxXTtcbiAgICAgICAgICAgICAgICAgICAgc3VjY2VzcyA9IGFyZ3NbMl07XG5cbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjYXNlIDE6XG5cbiAgICAgICAgICAgICAgICBpZiAoXy5pc0Z1bmN0aW9uKGFyZ3NbMF0pKSB7XG4gICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3MgPSBhcmdzWzBdO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoL14oUE9TVHxQVVR8UEFUQ0gpJC9pLnRlc3Qob3B0aW9ucy5tZXRob2QpKSB7XG4gICAgICAgICAgICAgICAgICAgIGRhdGEgPSBhcmdzWzBdO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHBhcmFtcyA9IGFyZ3NbMF07XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgMDpcblxuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBkZWZhdWx0OlxuXG4gICAgICAgICAgICAgICAgdGhyb3cgJ0V4cGVjdGVkIHVwIHRvIDQgYXJndW1lbnRzIFtwYXJhbXMsIGRhdGEsIHN1Y2Nlc3MsIGVycm9yXSwgZ290ICcgKyBhcmdzLmxlbmd0aCArICcgYXJndW1lbnRzJztcbiAgICAgICAgfVxuXG4gICAgICAgIG9wdGlvbnMuZGF0YSA9IGRhdGE7XG4gICAgICAgIG9wdGlvbnMucGFyYW1zID0gXy5leHRlbmQoe30sIG9wdGlvbnMucGFyYW1zLCBwYXJhbXMpO1xuXG4gICAgICAgIGlmIChzdWNjZXNzKSB7XG4gICAgICAgICAgICBvcHRpb25zLnN1Y2Nlc3MgPSBzdWNjZXNzO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgICBvcHRpb25zLmVycm9yID0gZXJyb3I7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gb3B0aW9ucztcbiAgICB9XG5cbiAgICBSZXNvdXJjZS5hY3Rpb25zID0ge1xuXG4gICAgICAgIGdldDoge21ldGhvZDogJ0dFVCd9LFxuICAgICAgICBzYXZlOiB7bWV0aG9kOiAnUE9TVCd9LFxuICAgICAgICBxdWVyeToge21ldGhvZDogJ0dFVCd9LFxuICAgICAgICB1cGRhdGU6IHttZXRob2Q6ICdQVVQnfSxcbiAgICAgICAgcmVtb3ZlOiB7bWV0aG9kOiAnREVMRVRFJ30sXG4gICAgICAgIGRlbGV0ZToge21ldGhvZDogJ0RFTEVURSd9XG5cbiAgICB9O1xuXG4gICAgcmV0dXJuIF8ucmVzb3VyY2UgPSBSZXNvdXJjZTtcbn07XG4iLCIvKipcbiAqIFNlcnZpY2UgZm9yIFVSTCB0ZW1wbGF0aW5nLlxuICovXG5cbnZhciBpZSA9IGRvY3VtZW50LmRvY3VtZW50TW9kZTtcbnZhciBlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoXykge1xuXG4gICAgZnVuY3Rpb24gVXJsKHVybCwgcGFyYW1zKSB7XG5cbiAgICAgICAgdmFyIHVybFBhcmFtcyA9IHt9LCBxdWVyeVBhcmFtcyA9IHt9LCBvcHRpb25zID0gdXJsLCBxdWVyeTtcblxuICAgICAgICBpZiAoIV8uaXNQbGFpbk9iamVjdChvcHRpb25zKSkge1xuICAgICAgICAgICAgb3B0aW9ucyA9IHt1cmw6IHVybCwgcGFyYW1zOiBwYXJhbXN9O1xuICAgICAgICB9XG5cbiAgICAgICAgb3B0aW9ucyA9IF8uZXh0ZW5kKHRydWUsIHt9LFxuICAgICAgICAgICAgVXJsLm9wdGlvbnMsIHRoaXMub3B0aW9ucywgb3B0aW9uc1xuICAgICAgICApO1xuXG4gICAgICAgIHVybCA9IG9wdGlvbnMudXJsLnJlcGxhY2UoLyhcXC8/KTooW2Etel1cXHcqKS9naSwgZnVuY3Rpb24gKG1hdGNoLCBzbGFzaCwgbmFtZSkge1xuXG4gICAgICAgICAgICBpZiAob3B0aW9ucy5wYXJhbXNbbmFtZV0pIHtcbiAgICAgICAgICAgICAgICB1cmxQYXJhbXNbbmFtZV0gPSB0cnVlO1xuICAgICAgICAgICAgICAgIHJldHVybiBzbGFzaCArIGVuY29kZVVyaVNlZ21lbnQob3B0aW9ucy5wYXJhbXNbbmFtZV0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gJyc7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmIChfLmlzU3RyaW5nKG9wdGlvbnMucm9vdCkgJiYgIXVybC5tYXRjaCgvXihodHRwcz86KT9cXC8vKSkge1xuICAgICAgICAgICAgdXJsID0gb3B0aW9ucy5yb290ICsgJy8nICsgdXJsO1xuICAgICAgICB9XG5cbiAgICAgICAgXy5lYWNoKG9wdGlvbnMucGFyYW1zLCBmdW5jdGlvbiAodmFsdWUsIGtleSkge1xuICAgICAgICAgICAgaWYgKCF1cmxQYXJhbXNba2V5XSkge1xuICAgICAgICAgICAgICAgIHF1ZXJ5UGFyYW1zW2tleV0gPSB2YWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgcXVlcnkgPSBVcmwucGFyYW1zKHF1ZXJ5UGFyYW1zKTtcblxuICAgICAgICBpZiAocXVlcnkpIHtcbiAgICAgICAgICAgIHVybCArPSAodXJsLmluZGV4T2YoJz8nKSA9PSAtMSA/ICc/JyA6ICcmJykgKyBxdWVyeTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB1cmw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVXJsIG9wdGlvbnMuXG4gICAgICovXG5cbiAgICBVcmwub3B0aW9ucyA9IHtcbiAgICAgICAgdXJsOiAnJyxcbiAgICAgICAgcm9vdDogbnVsbCxcbiAgICAgICAgcGFyYW1zOiB7fVxuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBFbmNvZGVzIGEgVXJsIHBhcmFtZXRlciBzdHJpbmcuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb2JqXG4gICAgICovXG5cbiAgICBVcmwucGFyYW1zID0gZnVuY3Rpb24gKG9iaikge1xuXG4gICAgICAgIHZhciBwYXJhbXMgPSBbXTtcblxuICAgICAgICBwYXJhbXMuYWRkID0gZnVuY3Rpb24gKGtleSwgdmFsdWUpIHtcblxuICAgICAgICAgICAgaWYgKF8uaXNGdW5jdGlvbiAodmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgdmFsdWUgPSB2YWx1ZSgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodmFsdWUgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICB2YWx1ZSA9ICcnO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnB1c2goZW5jb2RlVXJpU2VnbWVudChrZXkpICsgJz0nICsgZW5jb2RlVXJpU2VnbWVudCh2YWx1ZSkpO1xuICAgICAgICB9O1xuXG4gICAgICAgIHNlcmlhbGl6ZShwYXJhbXMsIG9iaik7XG5cbiAgICAgICAgcmV0dXJuIHBhcmFtcy5qb2luKCcmJyk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFBhcnNlIGEgVVJMIGFuZCByZXR1cm4gaXRzIGNvbXBvbmVudHMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gdXJsXG4gICAgICovXG5cbiAgICBVcmwucGFyc2UgPSBmdW5jdGlvbiAodXJsKSB7XG5cbiAgICAgICAgaWYgKGllKSB7XG4gICAgICAgICAgICBlbC5ocmVmID0gdXJsO1xuICAgICAgICAgICAgdXJsID0gZWwuaHJlZjtcbiAgICAgICAgfVxuXG4gICAgICAgIGVsLmhyZWYgPSB1cmw7XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGhyZWY6IGVsLmhyZWYsXG4gICAgICAgICAgICBwcm90b2NvbDogZWwucHJvdG9jb2wgPyBlbC5wcm90b2NvbC5yZXBsYWNlKC86JC8sICcnKSA6ICcnLFxuICAgICAgICAgICAgcG9ydDogZWwucG9ydCxcbiAgICAgICAgICAgIGhvc3Q6IGVsLmhvc3QsXG4gICAgICAgICAgICBob3N0bmFtZTogZWwuaG9zdG5hbWUsXG4gICAgICAgICAgICBwYXRobmFtZTogZWwucGF0aG5hbWUuY2hhckF0KDApID09PSAnLycgPyBlbC5wYXRobmFtZSA6ICcvJyArIGVsLnBhdGhuYW1lLFxuICAgICAgICAgICAgc2VhcmNoOiBlbC5zZWFyY2ggPyBlbC5zZWFyY2gucmVwbGFjZSgvXlxcPy8sICcnKSA6ICcnLFxuICAgICAgICAgICAgaGFzaDogZWwuaGFzaCA/IGVsLmhhc2gucmVwbGFjZSgvXiMvLCAnJykgOiAnJ1xuICAgICAgICB9O1xuICAgIH07XG5cbiAgICBmdW5jdGlvbiBzZXJpYWxpemUocGFyYW1zLCBvYmosIHNjb3BlKSB7XG5cbiAgICAgICAgdmFyIGFycmF5ID0gXy5pc0FycmF5KG9iaiksIHBsYWluID0gXy5pc1BsYWluT2JqZWN0KG9iaiksIGhhc2g7XG5cbiAgICAgICAgXy5lYWNoKG9iaiwgZnVuY3Rpb24gKHZhbHVlLCBrZXkpIHtcblxuICAgICAgICAgICAgaGFzaCA9IF8uaXNPYmplY3QodmFsdWUpIHx8IF8uaXNBcnJheSh2YWx1ZSk7XG5cbiAgICAgICAgICAgIGlmIChzY29wZSkge1xuICAgICAgICAgICAgICAgIGtleSA9IHNjb3BlICsgJ1snICsgKHBsYWluIHx8IGhhc2ggPyBrZXkgOiAnJykgKyAnXSc7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghc2NvcGUgJiYgYXJyYXkpIHtcbiAgICAgICAgICAgICAgICBwYXJhbXMuYWRkKHZhbHVlLm5hbWUsIHZhbHVlLnZhbHVlKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoaGFzaCkge1xuICAgICAgICAgICAgICAgIHNlcmlhbGl6ZShwYXJhbXMsIHZhbHVlLCBrZXkpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwYXJhbXMuYWRkKGtleSwgdmFsdWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBlbmNvZGVVcmlTZWdtZW50KHZhbHVlKSB7XG5cbiAgICAgICAgcmV0dXJuIGVuY29kZVVyaVF1ZXJ5KHZhbHVlLCB0cnVlKS5cbiAgICAgICAgICAgIHJlcGxhY2UoLyUyNi9naSwgJyYnKS5cbiAgICAgICAgICAgIHJlcGxhY2UoLyUzRC9naSwgJz0nKS5cbiAgICAgICAgICAgIHJlcGxhY2UoLyUyQi9naSwgJysnKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBlbmNvZGVVcmlRdWVyeSh2YWx1ZSwgc3BhY2VzKSB7XG5cbiAgICAgICAgcmV0dXJuIGVuY29kZVVSSUNvbXBvbmVudCh2YWx1ZSkuXG4gICAgICAgICAgICByZXBsYWNlKC8lNDAvZ2ksICdAJykuXG4gICAgICAgICAgICByZXBsYWNlKC8lM0EvZ2ksICc6JykuXG4gICAgICAgICAgICByZXBsYWNlKC8lMjQvZywgJyQnKS5cbiAgICAgICAgICAgIHJlcGxhY2UoLyUyQy9naSwgJywnKS5cbiAgICAgICAgICAgIHJlcGxhY2UoLyUyMC9nLCAoc3BhY2VzID8gJyUyMCcgOiAnKycpKTtcbiAgICB9XG5cbiAgICByZXR1cm4gXy51cmwgPSBVcmw7XG59O1xuIiwidmFyIF8gPSByZXF1aXJlKCcuLi91dGlsJylcblxuLyoqXG4gKiBDcmVhdGUgYSBjaGlsZCBpbnN0YW5jZSB0aGF0IHByb3RvdHlwYWxseSBpbmhlcml0c1xuICogZGF0YSBvbiBwYXJlbnQuIFRvIGFjaGlldmUgdGhhdCB3ZSBjcmVhdGUgYW4gaW50ZXJtZWRpYXRlXG4gKiBjb25zdHJ1Y3RvciB3aXRoIGl0cyBwcm90b3R5cGUgcG9pbnRpbmcgdG8gcGFyZW50LlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBbQmFzZUN0b3JdXG4gKiBAcmV0dXJuIHtWdWV9XG4gKiBAcHVibGljXG4gKi9cblxuZXhwb3J0cy4kYWRkQ2hpbGQgPSBmdW5jdGlvbiAob3B0cywgQmFzZUN0b3IpIHtcbiAgQmFzZUN0b3IgPSBCYXNlQ3RvciB8fCBfLlZ1ZVxuICBvcHRzID0gb3B0cyB8fCB7fVxuICB2YXIgQ2hpbGRWdWVcbiAgdmFyIHBhcmVudCA9IHRoaXNcbiAgLy8gdHJhbnNjbHVzaW9uIGNvbnRleHRcbiAgdmFyIGNvbnRleHQgPSBvcHRzLl9jb250ZXh0IHx8IHBhcmVudFxuICB2YXIgaW5oZXJpdCA9IG9wdHMuaW5oZXJpdCAhPT0gdW5kZWZpbmVkXG4gICAgPyBvcHRzLmluaGVyaXRcbiAgICA6IEJhc2VDdG9yLm9wdGlvbnMuaW5oZXJpdFxuICBpZiAoaW5oZXJpdCkge1xuICAgIHZhciBjdG9ycyA9IGNvbnRleHQuX2NoaWxkQ3RvcnNcbiAgICBDaGlsZFZ1ZSA9IGN0b3JzW0Jhc2VDdG9yLmNpZF1cbiAgICBpZiAoIUNoaWxkVnVlKSB7XG4gICAgICB2YXIgb3B0aW9uTmFtZSA9IEJhc2VDdG9yLm9wdGlvbnMubmFtZVxuICAgICAgdmFyIGNsYXNzTmFtZSA9IG9wdGlvbk5hbWVcbiAgICAgICAgPyBfLmNsYXNzaWZ5KG9wdGlvbk5hbWUpXG4gICAgICAgIDogJ1Z1ZUNvbXBvbmVudCdcbiAgICAgIENoaWxkVnVlID0gbmV3IEZ1bmN0aW9uKFxuICAgICAgICAncmV0dXJuIGZ1bmN0aW9uICcgKyBjbGFzc05hbWUgKyAnIChvcHRpb25zKSB7JyArXG4gICAgICAgICd0aGlzLmNvbnN0cnVjdG9yID0gJyArIGNsYXNzTmFtZSArICc7JyArXG4gICAgICAgICd0aGlzLl9pbml0KG9wdGlvbnMpIH0nXG4gICAgICApKClcbiAgICAgIENoaWxkVnVlLm9wdGlvbnMgPSBCYXNlQ3Rvci5vcHRpb25zXG4gICAgICBDaGlsZFZ1ZS5saW5rZXIgPSBCYXNlQ3Rvci5saW5rZXJcbiAgICAgIENoaWxkVnVlLnByb3RvdHlwZSA9IGNvbnRleHRcbiAgICAgIGN0b3JzW0Jhc2VDdG9yLmNpZF0gPSBDaGlsZFZ1ZVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBDaGlsZFZ1ZSA9IEJhc2VDdG9yXG4gIH1cbiAgb3B0cy5fcGFyZW50ID0gcGFyZW50XG4gIG9wdHMuX3Jvb3QgPSBwYXJlbnQuJHJvb3RcbiAgdmFyIGNoaWxkID0gbmV3IENoaWxkVnVlKG9wdHMpXG4gIHJldHVybiBjaGlsZFxufVxuIiwidmFyIFdhdGNoZXIgPSByZXF1aXJlKCcuLi93YXRjaGVyJylcbnZhciBQYXRoID0gcmVxdWlyZSgnLi4vcGFyc2Vycy9wYXRoJylcbnZhciB0ZXh0UGFyc2VyID0gcmVxdWlyZSgnLi4vcGFyc2Vycy90ZXh0JylcbnZhciBkaXJQYXJzZXIgPSByZXF1aXJlKCcuLi9wYXJzZXJzL2RpcmVjdGl2ZScpXG52YXIgZXhwUGFyc2VyID0gcmVxdWlyZSgnLi4vcGFyc2Vycy9leHByZXNzaW9uJylcbnZhciBmaWx0ZXJSRSA9IC9bXnxdXFx8W158XS9cblxuLyoqXG4gKiBHZXQgdGhlIHZhbHVlIGZyb20gYW4gZXhwcmVzc2lvbiBvbiB0aGlzIHZtLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBleHBcbiAqIEByZXR1cm4geyp9XG4gKi9cblxuZXhwb3J0cy4kZ2V0ID0gZnVuY3Rpb24gKGV4cCkge1xuICB2YXIgcmVzID0gZXhwUGFyc2VyLnBhcnNlKGV4cClcbiAgaWYgKHJlcykge1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gcmVzLmdldC5jYWxsKHRoaXMsIHRoaXMpXG4gICAgfSBjYXRjaCAoZSkge31cbiAgfVxufVxuXG4vKipcbiAqIFNldCB0aGUgdmFsdWUgZnJvbSBhbiBleHByZXNzaW9uIG9uIHRoaXMgdm0uXG4gKiBUaGUgZXhwcmVzc2lvbiBtdXN0IGJlIGEgdmFsaWQgbGVmdC1oYW5kXG4gKiBleHByZXNzaW9uIGluIGFuIGFzc2lnbm1lbnQuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGV4cFxuICogQHBhcmFtIHsqfSB2YWxcbiAqL1xuXG5leHBvcnRzLiRzZXQgPSBmdW5jdGlvbiAoZXhwLCB2YWwpIHtcbiAgdmFyIHJlcyA9IGV4cFBhcnNlci5wYXJzZShleHAsIHRydWUpXG4gIGlmIChyZXMgJiYgcmVzLnNldCkge1xuICAgIHJlcy5zZXQuY2FsbCh0aGlzLCB0aGlzLCB2YWwpXG4gIH1cbn1cblxuLyoqXG4gKiBBZGQgYSBwcm9wZXJ0eSBvbiB0aGUgVk1cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30ga2V5XG4gKiBAcGFyYW0geyp9IHZhbFxuICovXG5cbmV4cG9ydHMuJGFkZCA9IGZ1bmN0aW9uIChrZXksIHZhbCkge1xuICB0aGlzLl9kYXRhLiRhZGQoa2V5LCB2YWwpXG59XG5cbi8qKlxuICogRGVsZXRlIGEgcHJvcGVydHkgb24gdGhlIFZNXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGtleVxuICovXG5cbmV4cG9ydHMuJGRlbGV0ZSA9IGZ1bmN0aW9uIChrZXkpIHtcbiAgdGhpcy5fZGF0YS4kZGVsZXRlKGtleSlcbn1cblxuLyoqXG4gKiBXYXRjaCBhbiBleHByZXNzaW9uLCB0cmlnZ2VyIGNhbGxiYWNrIHdoZW4gaXRzXG4gKiB2YWx1ZSBjaGFuZ2VzLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBleHBcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNiXG4gKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdXG4gKiAgICAgICAgICAgICAgICAgLSB7Qm9vbGVhbn0gZGVlcFxuICogICAgICAgICAgICAgICAgIC0ge0Jvb2xlYW59IGltbWVkaWF0ZVxuICogICAgICAgICAgICAgICAgIC0ge0Jvb2xlYW59IHVzZXJcbiAqIEByZXR1cm4ge0Z1bmN0aW9ufSAtIHVud2F0Y2hGblxuICovXG5cbmV4cG9ydHMuJHdhdGNoID0gZnVuY3Rpb24gKGV4cCwgY2IsIG9wdGlvbnMpIHtcbiAgdmFyIHZtID0gdGhpc1xuICB2YXIgd2F0Y2hlciA9IG5ldyBXYXRjaGVyKHZtLCBleHAsIGNiLCB7XG4gICAgZGVlcDogb3B0aW9ucyAmJiBvcHRpb25zLmRlZXAsXG4gICAgdXNlcjogIW9wdGlvbnMgfHwgb3B0aW9ucy51c2VyICE9PSBmYWxzZVxuICB9KVxuICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLmltbWVkaWF0ZSkge1xuICAgIGNiLmNhbGwodm0sIHdhdGNoZXIudmFsdWUpXG4gIH1cbiAgcmV0dXJuIGZ1bmN0aW9uIHVud2F0Y2hGbiAoKSB7XG4gICAgd2F0Y2hlci50ZWFyZG93bigpXG4gIH1cbn1cblxuLyoqXG4gKiBFdmFsdWF0ZSBhIHRleHQgZGlyZWN0aXZlLCBpbmNsdWRpbmcgZmlsdGVycy5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gdGV4dFxuICogQHJldHVybiB7U3RyaW5nfVxuICovXG5cbmV4cG9ydHMuJGV2YWwgPSBmdW5jdGlvbiAodGV4dCkge1xuICAvLyBjaGVjayBmb3IgZmlsdGVycy5cbiAgaWYgKGZpbHRlclJFLnRlc3QodGV4dCkpIHtcbiAgICB2YXIgZGlyID0gZGlyUGFyc2VyLnBhcnNlKHRleHQpWzBdXG4gICAgLy8gdGhlIGZpbHRlciByZWdleCBjaGVjayBtaWdodCBnaXZlIGZhbHNlIHBvc2l0aXZlXG4gICAgLy8gZm9yIHBpcGVzIGluc2lkZSBzdHJpbmdzLCBzbyBpdCdzIHBvc3NpYmxlIHRoYXRcbiAgICAvLyB3ZSBkb24ndCBnZXQgYW55IGZpbHRlcnMgaGVyZVxuICAgIHZhciB2YWwgPSB0aGlzLiRnZXQoZGlyLmV4cHJlc3Npb24pXG4gICAgcmV0dXJuIGRpci5maWx0ZXJzXG4gICAgICA/IHRoaXMuX2FwcGx5RmlsdGVycyh2YWwsIG51bGwsIGRpci5maWx0ZXJzKVxuICAgICAgOiB2YWxcbiAgfSBlbHNlIHtcbiAgICAvLyBubyBmaWx0ZXJcbiAgICByZXR1cm4gdGhpcy4kZ2V0KHRleHQpXG4gIH1cbn1cblxuLyoqXG4gKiBJbnRlcnBvbGF0ZSBhIHBpZWNlIG9mIHRlbXBsYXRlIHRleHQuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHRleHRcbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqL1xuXG5leHBvcnRzLiRpbnRlcnBvbGF0ZSA9IGZ1bmN0aW9uICh0ZXh0KSB7XG4gIHZhciB0b2tlbnMgPSB0ZXh0UGFyc2VyLnBhcnNlKHRleHQpXG4gIHZhciB2bSA9IHRoaXNcbiAgaWYgKHRva2Vucykge1xuICAgIHJldHVybiB0b2tlbnMubGVuZ3RoID09PSAxXG4gICAgICA/IHZtLiRldmFsKHRva2Vuc1swXS52YWx1ZSlcbiAgICAgIDogdG9rZW5zLm1hcChmdW5jdGlvbiAodG9rZW4pIHtcbiAgICAgICAgICByZXR1cm4gdG9rZW4udGFnXG4gICAgICAgICAgICA/IHZtLiRldmFsKHRva2VuLnZhbHVlKVxuICAgICAgICAgICAgOiB0b2tlbi52YWx1ZVxuICAgICAgICB9KS5qb2luKCcnKVxuICB9IGVsc2Uge1xuICAgIHJldHVybiB0ZXh0XG4gIH1cbn1cblxuLyoqXG4gKiBMb2cgaW5zdGFuY2UgZGF0YSBhcyBhIHBsYWluIEpTIG9iamVjdFxuICogc28gdGhhdCBpdCBpcyBlYXNpZXIgdG8gaW5zcGVjdCBpbiBjb25zb2xlLlxuICogVGhpcyBtZXRob2QgYXNzdW1lcyBjb25zb2xlIGlzIGF2YWlsYWJsZS5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gW3BhdGhdXG4gKi9cblxuZXhwb3J0cy4kbG9nID0gZnVuY3Rpb24gKHBhdGgpIHtcbiAgdmFyIGRhdGEgPSBwYXRoXG4gICAgPyBQYXRoLmdldCh0aGlzLl9kYXRhLCBwYXRoKVxuICAgIDogdGhpcy5fZGF0YVxuICBpZiAoZGF0YSkge1xuICAgIGRhdGEgPSBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KGRhdGEpKVxuICB9XG4gIGNvbnNvbGUubG9nKGRhdGEpXG59XG4iLCJ2YXIgXyA9IHJlcXVpcmUoJy4uL3V0aWwnKVxudmFyIHRyYW5zaXRpb24gPSByZXF1aXJlKCcuLi90cmFuc2l0aW9uJylcblxuLyoqXG4gKiBDb252ZW5pZW5jZSBvbi1pbnN0YW5jZSBuZXh0VGljay4gVGhlIGNhbGxiYWNrIGlzXG4gKiBhdXRvLWJvdW5kIHRvIHRoZSBpbnN0YW5jZSwgYW5kIHRoaXMgYXZvaWRzIGNvbXBvbmVudFxuICogbW9kdWxlcyBoYXZpbmcgdG8gcmVseSBvbiB0aGUgZ2xvYmFsIFZ1ZS5cbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmblxuICovXG5cbmV4cG9ydHMuJG5leHRUaWNrID0gZnVuY3Rpb24gKGZuKSB7XG4gIF8ubmV4dFRpY2soZm4sIHRoaXMpXG59XG5cbi8qKlxuICogQXBwZW5kIGluc3RhbmNlIHRvIHRhcmdldFxuICpcbiAqIEBwYXJhbSB7Tm9kZX0gdGFyZ2V0XG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2JdXG4gKiBAcGFyYW0ge0Jvb2xlYW59IFt3aXRoVHJhbnNpdGlvbl0gLSBkZWZhdWx0cyB0byB0cnVlXG4gKi9cblxuZXhwb3J0cy4kYXBwZW5kVG8gPSBmdW5jdGlvbiAodGFyZ2V0LCBjYiwgd2l0aFRyYW5zaXRpb24pIHtcbiAgcmV0dXJuIGluc2VydChcbiAgICB0aGlzLCB0YXJnZXQsIGNiLCB3aXRoVHJhbnNpdGlvbixcbiAgICBhcHBlbmQsIHRyYW5zaXRpb24uYXBwZW5kXG4gIClcbn1cblxuLyoqXG4gKiBQcmVwZW5kIGluc3RhbmNlIHRvIHRhcmdldFxuICpcbiAqIEBwYXJhbSB7Tm9kZX0gdGFyZ2V0XG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2JdXG4gKiBAcGFyYW0ge0Jvb2xlYW59IFt3aXRoVHJhbnNpdGlvbl0gLSBkZWZhdWx0cyB0byB0cnVlXG4gKi9cblxuZXhwb3J0cy4kcHJlcGVuZFRvID0gZnVuY3Rpb24gKHRhcmdldCwgY2IsIHdpdGhUcmFuc2l0aW9uKSB7XG4gIHRhcmdldCA9IHF1ZXJ5KHRhcmdldClcbiAgaWYgKHRhcmdldC5oYXNDaGlsZE5vZGVzKCkpIHtcbiAgICB0aGlzLiRiZWZvcmUodGFyZ2V0LmZpcnN0Q2hpbGQsIGNiLCB3aXRoVHJhbnNpdGlvbilcbiAgfSBlbHNlIHtcbiAgICB0aGlzLiRhcHBlbmRUbyh0YXJnZXQsIGNiLCB3aXRoVHJhbnNpdGlvbilcbiAgfVxuICByZXR1cm4gdGhpc1xufVxuXG4vKipcbiAqIEluc2VydCBpbnN0YW5jZSBiZWZvcmUgdGFyZ2V0XG4gKlxuICogQHBhcmFtIHtOb2RlfSB0YXJnZXRcbiAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYl1cbiAqIEBwYXJhbSB7Qm9vbGVhbn0gW3dpdGhUcmFuc2l0aW9uXSAtIGRlZmF1bHRzIHRvIHRydWVcbiAqL1xuXG5leHBvcnRzLiRiZWZvcmUgPSBmdW5jdGlvbiAodGFyZ2V0LCBjYiwgd2l0aFRyYW5zaXRpb24pIHtcbiAgcmV0dXJuIGluc2VydChcbiAgICB0aGlzLCB0YXJnZXQsIGNiLCB3aXRoVHJhbnNpdGlvbixcbiAgICBiZWZvcmUsIHRyYW5zaXRpb24uYmVmb3JlXG4gIClcbn1cblxuLyoqXG4gKiBJbnNlcnQgaW5zdGFuY2UgYWZ0ZXIgdGFyZ2V0XG4gKlxuICogQHBhcmFtIHtOb2RlfSB0YXJnZXRcbiAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYl1cbiAqIEBwYXJhbSB7Qm9vbGVhbn0gW3dpdGhUcmFuc2l0aW9uXSAtIGRlZmF1bHRzIHRvIHRydWVcbiAqL1xuXG5leHBvcnRzLiRhZnRlciA9IGZ1bmN0aW9uICh0YXJnZXQsIGNiLCB3aXRoVHJhbnNpdGlvbikge1xuICB0YXJnZXQgPSBxdWVyeSh0YXJnZXQpXG4gIGlmICh0YXJnZXQubmV4dFNpYmxpbmcpIHtcbiAgICB0aGlzLiRiZWZvcmUodGFyZ2V0Lm5leHRTaWJsaW5nLCBjYiwgd2l0aFRyYW5zaXRpb24pXG4gIH0gZWxzZSB7XG4gICAgdGhpcy4kYXBwZW5kVG8odGFyZ2V0LnBhcmVudE5vZGUsIGNiLCB3aXRoVHJhbnNpdGlvbilcbiAgfVxuICByZXR1cm4gdGhpc1xufVxuXG4vKipcbiAqIFJlbW92ZSBpbnN0YW5jZSBmcm9tIERPTVxuICpcbiAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYl1cbiAqIEBwYXJhbSB7Qm9vbGVhbn0gW3dpdGhUcmFuc2l0aW9uXSAtIGRlZmF1bHRzIHRvIHRydWVcbiAqL1xuXG5leHBvcnRzLiRyZW1vdmUgPSBmdW5jdGlvbiAoY2IsIHdpdGhUcmFuc2l0aW9uKSB7XG4gIGlmICghdGhpcy4kZWwucGFyZW50Tm9kZSkge1xuICAgIHJldHVybiBjYiAmJiBjYigpXG4gIH1cbiAgdmFyIGluRG9jID0gdGhpcy5faXNBdHRhY2hlZCAmJiBfLmluRG9jKHRoaXMuJGVsKVxuICAvLyBpZiB3ZSBhcmUgbm90IGluIGRvY3VtZW50LCBubyBuZWVkIHRvIGNoZWNrXG4gIC8vIGZvciB0cmFuc2l0aW9uc1xuICBpZiAoIWluRG9jKSB3aXRoVHJhbnNpdGlvbiA9IGZhbHNlXG4gIHZhciBvcFxuICB2YXIgc2VsZiA9IHRoaXNcbiAgdmFyIHJlYWxDYiA9IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAoaW5Eb2MpIHNlbGYuX2NhbGxIb29rKCdkZXRhY2hlZCcpXG4gICAgaWYgKGNiKSBjYigpXG4gIH1cbiAgaWYgKFxuICAgIHRoaXMuX2lzRnJhZ21lbnQgJiZcbiAgICAhdGhpcy5fYmxvY2tGcmFnbWVudC5oYXNDaGlsZE5vZGVzKClcbiAgKSB7XG4gICAgb3AgPSB3aXRoVHJhbnNpdGlvbiA9PT0gZmFsc2VcbiAgICAgID8gYXBwZW5kXG4gICAgICA6IHRyYW5zaXRpb24ucmVtb3ZlVGhlbkFwcGVuZFxuICAgIGJsb2NrT3AodGhpcywgdGhpcy5fYmxvY2tGcmFnbWVudCwgb3AsIHJlYWxDYilcbiAgfSBlbHNlIHtcbiAgICBvcCA9IHdpdGhUcmFuc2l0aW9uID09PSBmYWxzZVxuICAgICAgPyByZW1vdmVcbiAgICAgIDogdHJhbnNpdGlvbi5yZW1vdmVcbiAgICBvcCh0aGlzLiRlbCwgdGhpcywgcmVhbENiKVxuICB9XG4gIHJldHVybiB0aGlzXG59XG5cbi8qKlxuICogU2hhcmVkIERPTSBpbnNlcnRpb24gZnVuY3Rpb24uXG4gKlxuICogQHBhcmFtIHtWdWV9IHZtXG4gKiBAcGFyYW0ge0VsZW1lbnR9IHRhcmdldFxuICogQHBhcmFtIHtGdW5jdGlvbn0gW2NiXVxuICogQHBhcmFtIHtCb29sZWFufSBbd2l0aFRyYW5zaXRpb25dXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBvcDEgLSBvcCBmb3Igbm9uLXRyYW5zaXRpb24gaW5zZXJ0XG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBvcDIgLSBvcCBmb3IgdHJhbnNpdGlvbiBpbnNlcnRcbiAqIEByZXR1cm4gdm1cbiAqL1xuXG5mdW5jdGlvbiBpbnNlcnQgKHZtLCB0YXJnZXQsIGNiLCB3aXRoVHJhbnNpdGlvbiwgb3AxLCBvcDIpIHtcbiAgdGFyZ2V0ID0gcXVlcnkodGFyZ2V0KVxuICB2YXIgdGFyZ2V0SXNEZXRhY2hlZCA9ICFfLmluRG9jKHRhcmdldClcbiAgdmFyIG9wID0gd2l0aFRyYW5zaXRpb24gPT09IGZhbHNlIHx8IHRhcmdldElzRGV0YWNoZWRcbiAgICA/IG9wMVxuICAgIDogb3AyXG4gIHZhciBzaG91bGRDYWxsSG9vayA9XG4gICAgIXRhcmdldElzRGV0YWNoZWQgJiZcbiAgICAhdm0uX2lzQXR0YWNoZWQgJiZcbiAgICAhXy5pbkRvYyh2bS4kZWwpXG4gIGlmICh2bS5faXNGcmFnbWVudCkge1xuICAgIGJsb2NrT3Aodm0sIHRhcmdldCwgb3AsIGNiKVxuICB9IGVsc2Uge1xuICAgIG9wKHZtLiRlbCwgdGFyZ2V0LCB2bSwgY2IpXG4gIH1cbiAgaWYgKHNob3VsZENhbGxIb29rKSB7XG4gICAgdm0uX2NhbGxIb29rKCdhdHRhY2hlZCcpXG4gIH1cbiAgcmV0dXJuIHZtXG59XG5cbi8qKlxuICogRXhlY3V0ZSBhIHRyYW5zaXRpb24gb3BlcmF0aW9uIG9uIGEgZnJhZ21lbnQgaW5zdGFuY2UsXG4gKiBpdGVyYXRpbmcgdGhyb3VnaCBhbGwgaXRzIGJsb2NrIG5vZGVzLlxuICpcbiAqIEBwYXJhbSB7VnVlfSB2bVxuICogQHBhcmFtIHtOb2RlfSB0YXJnZXRcbiAqIEBwYXJhbSB7RnVuY3Rpb259IG9wXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYlxuICovXG5cbmZ1bmN0aW9uIGJsb2NrT3AgKHZtLCB0YXJnZXQsIG9wLCBjYikge1xuICB2YXIgY3VycmVudCA9IHZtLl9mcmFnbWVudFN0YXJ0XG4gIHZhciBlbmQgPSB2bS5fZnJhZ21lbnRFbmRcbiAgdmFyIG5leHRcbiAgd2hpbGUgKG5leHQgIT09IGVuZCkge1xuICAgIG5leHQgPSBjdXJyZW50Lm5leHRTaWJsaW5nXG4gICAgb3AoY3VycmVudCwgdGFyZ2V0LCB2bSlcbiAgICBjdXJyZW50ID0gbmV4dFxuICB9XG4gIG9wKGVuZCwgdGFyZ2V0LCB2bSwgY2IpXG59XG5cbi8qKlxuICogQ2hlY2sgZm9yIHNlbGVjdG9yc1xuICpcbiAqIEBwYXJhbSB7U3RyaW5nfEVsZW1lbnR9IGVsXG4gKi9cblxuZnVuY3Rpb24gcXVlcnkgKGVsKSB7XG4gIHJldHVybiB0eXBlb2YgZWwgPT09ICdzdHJpbmcnXG4gICAgPyBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGVsKVxuICAgIDogZWxcbn1cblxuLyoqXG4gKiBBcHBlbmQgb3BlcmF0aW9uIHRoYXQgdGFrZXMgYSBjYWxsYmFjay5cbiAqXG4gKiBAcGFyYW0ge05vZGV9IGVsXG4gKiBAcGFyYW0ge05vZGV9IHRhcmdldFxuICogQHBhcmFtIHtWdWV9IHZtIC0gdW51c2VkXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2JdXG4gKi9cblxuZnVuY3Rpb24gYXBwZW5kIChlbCwgdGFyZ2V0LCB2bSwgY2IpIHtcbiAgdGFyZ2V0LmFwcGVuZENoaWxkKGVsKVxuICBpZiAoY2IpIGNiKClcbn1cblxuLyoqXG4gKiBJbnNlcnRCZWZvcmUgb3BlcmF0aW9uIHRoYXQgdGFrZXMgYSBjYWxsYmFjay5cbiAqXG4gKiBAcGFyYW0ge05vZGV9IGVsXG4gKiBAcGFyYW0ge05vZGV9IHRhcmdldFxuICogQHBhcmFtIHtWdWV9IHZtIC0gdW51c2VkXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2JdXG4gKi9cblxuZnVuY3Rpb24gYmVmb3JlIChlbCwgdGFyZ2V0LCB2bSwgY2IpIHtcbiAgXy5iZWZvcmUoZWwsIHRhcmdldClcbiAgaWYgKGNiKSBjYigpXG59XG5cbi8qKlxuICogUmVtb3ZlIG9wZXJhdGlvbiB0aGF0IHRha2VzIGEgY2FsbGJhY2suXG4gKlxuICogQHBhcmFtIHtOb2RlfSBlbFxuICogQHBhcmFtIHtWdWV9IHZtIC0gdW51c2VkXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2JdXG4gKi9cblxuZnVuY3Rpb24gcmVtb3ZlIChlbCwgdm0sIGNiKSB7XG4gIF8ucmVtb3ZlKGVsKVxuICBpZiAoY2IpIGNiKClcbn1cbiIsInZhciBfID0gcmVxdWlyZSgnLi4vdXRpbCcpXG5cbi8qKlxuICogTGlzdGVuIG9uIHRoZSBnaXZlbiBgZXZlbnRgIHdpdGggYGZuYC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gZXZlbnRcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZuXG4gKi9cblxuZXhwb3J0cy4kb24gPSBmdW5jdGlvbiAoZXZlbnQsIGZuKSB7XG4gICh0aGlzLl9ldmVudHNbZXZlbnRdIHx8ICh0aGlzLl9ldmVudHNbZXZlbnRdID0gW10pKVxuICAgIC5wdXNoKGZuKVxuICBtb2RpZnlMaXN0ZW5lckNvdW50KHRoaXMsIGV2ZW50LCAxKVxuICByZXR1cm4gdGhpc1xufVxuXG4vKipcbiAqIEFkZHMgYW4gYGV2ZW50YCBsaXN0ZW5lciB0aGF0IHdpbGwgYmUgaW52b2tlZCBhIHNpbmdsZVxuICogdGltZSB0aGVuIGF1dG9tYXRpY2FsbHkgcmVtb3ZlZC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gZXZlbnRcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZuXG4gKi9cblxuZXhwb3J0cy4kb25jZSA9IGZ1bmN0aW9uIChldmVudCwgZm4pIHtcbiAgdmFyIHNlbGYgPSB0aGlzXG4gIGZ1bmN0aW9uIG9uICgpIHtcbiAgICBzZWxmLiRvZmYoZXZlbnQsIG9uKVxuICAgIGZuLmFwcGx5KHRoaXMsIGFyZ3VtZW50cylcbiAgfVxuICBvbi5mbiA9IGZuXG4gIHRoaXMuJG9uKGV2ZW50LCBvbilcbiAgcmV0dXJuIHRoaXNcbn1cblxuLyoqXG4gKiBSZW1vdmUgdGhlIGdpdmVuIGNhbGxiYWNrIGZvciBgZXZlbnRgIG9yIGFsbFxuICogcmVnaXN0ZXJlZCBjYWxsYmFja3MuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50XG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmblxuICovXG5cbmV4cG9ydHMuJG9mZiA9IGZ1bmN0aW9uIChldmVudCwgZm4pIHtcbiAgdmFyIGNic1xuICAvLyBhbGxcbiAgaWYgKCFhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgaWYgKHRoaXMuJHBhcmVudCkge1xuICAgICAgZm9yIChldmVudCBpbiB0aGlzLl9ldmVudHMpIHtcbiAgICAgICAgY2JzID0gdGhpcy5fZXZlbnRzW2V2ZW50XVxuICAgICAgICBpZiAoY2JzKSB7XG4gICAgICAgICAgbW9kaWZ5TGlzdGVuZXJDb3VudCh0aGlzLCBldmVudCwgLWNicy5sZW5ndGgpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5fZXZlbnRzID0ge31cbiAgICByZXR1cm4gdGhpc1xuICB9XG4gIC8vIHNwZWNpZmljIGV2ZW50XG4gIGNicyA9IHRoaXMuX2V2ZW50c1tldmVudF1cbiAgaWYgKCFjYnMpIHtcbiAgICByZXR1cm4gdGhpc1xuICB9XG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAxKSB7XG4gICAgbW9kaWZ5TGlzdGVuZXJDb3VudCh0aGlzLCBldmVudCwgLWNicy5sZW5ndGgpXG4gICAgdGhpcy5fZXZlbnRzW2V2ZW50XSA9IG51bGxcbiAgICByZXR1cm4gdGhpc1xuICB9XG4gIC8vIHNwZWNpZmljIGhhbmRsZXJcbiAgdmFyIGNiXG4gIHZhciBpID0gY2JzLmxlbmd0aFxuICB3aGlsZSAoaS0tKSB7XG4gICAgY2IgPSBjYnNbaV1cbiAgICBpZiAoY2IgPT09IGZuIHx8IGNiLmZuID09PSBmbikge1xuICAgICAgbW9kaWZ5TGlzdGVuZXJDb3VudCh0aGlzLCBldmVudCwgLTEpXG4gICAgICBjYnMuc3BsaWNlKGksIDEpXG4gICAgICBicmVha1xuICAgIH1cbiAgfVxuICByZXR1cm4gdGhpc1xufVxuXG4vKipcbiAqIFRyaWdnZXIgYW4gZXZlbnQgb24gc2VsZi5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gZXZlbnRcbiAqL1xuXG5leHBvcnRzLiRlbWl0ID0gZnVuY3Rpb24gKGV2ZW50KSB7XG4gIHRoaXMuX2V2ZW50Q2FuY2VsbGVkID0gZmFsc2VcbiAgdmFyIGNicyA9IHRoaXMuX2V2ZW50c1tldmVudF1cbiAgaWYgKGNicykge1xuICAgIC8vIGF2b2lkIGxlYWtpbmcgYXJndW1lbnRzOlxuICAgIC8vIGh0dHA6Ly9qc3BlcmYuY29tL2Nsb3N1cmUtd2l0aC1hcmd1bWVudHNcbiAgICB2YXIgaSA9IGFyZ3VtZW50cy5sZW5ndGggLSAxXG4gICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkoaSlcbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICBhcmdzW2ldID0gYXJndW1lbnRzW2kgKyAxXVxuICAgIH1cbiAgICBpID0gMFxuICAgIGNicyA9IGNicy5sZW5ndGggPiAxXG4gICAgICA/IF8udG9BcnJheShjYnMpXG4gICAgICA6IGNic1xuICAgIGZvciAodmFyIGwgPSBjYnMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICBpZiAoY2JzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpID09PSBmYWxzZSkge1xuICAgICAgICB0aGlzLl9ldmVudENhbmNlbGxlZCA9IHRydWVcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIHRoaXNcbn1cblxuLyoqXG4gKiBSZWN1cnNpdmVseSBicm9hZGNhc3QgYW4gZXZlbnQgdG8gYWxsIGNoaWxkcmVuIGluc3RhbmNlcy5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gZXZlbnRcbiAqIEBwYXJhbSB7Li4uKn0gYWRkaXRpb25hbCBhcmd1bWVudHNcbiAqL1xuXG5leHBvcnRzLiRicm9hZGNhc3QgPSBmdW5jdGlvbiAoZXZlbnQpIHtcbiAgLy8gaWYgbm8gY2hpbGQgaGFzIHJlZ2lzdGVyZWQgZm9yIHRoaXMgZXZlbnQsXG4gIC8vIHRoZW4gdGhlcmUncyBubyBuZWVkIHRvIGJyb2FkY2FzdC5cbiAgaWYgKCF0aGlzLl9ldmVudHNDb3VudFtldmVudF0pIHJldHVyblxuICB2YXIgY2hpbGRyZW4gPSB0aGlzLiRjaGlsZHJlblxuICBmb3IgKHZhciBpID0gMCwgbCA9IGNoaWxkcmVuLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgIHZhciBjaGlsZCA9IGNoaWxkcmVuW2ldXG4gICAgY2hpbGQuJGVtaXQuYXBwbHkoY2hpbGQsIGFyZ3VtZW50cylcbiAgICBpZiAoIWNoaWxkLl9ldmVudENhbmNlbGxlZCkge1xuICAgICAgY2hpbGQuJGJyb2FkY2FzdC5hcHBseShjaGlsZCwgYXJndW1lbnRzKVxuICAgIH1cbiAgfVxuICByZXR1cm4gdGhpc1xufVxuXG4vKipcbiAqIFJlY3Vyc2l2ZWx5IHByb3BhZ2F0ZSBhbiBldmVudCB1cCB0aGUgcGFyZW50IGNoYWluLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBldmVudFxuICogQHBhcmFtIHsuLi4qfSBhZGRpdGlvbmFsIGFyZ3VtZW50c1xuICovXG5cbmV4cG9ydHMuJGRpc3BhdGNoID0gZnVuY3Rpb24gKCkge1xuICB2YXIgcGFyZW50ID0gdGhpcy4kcGFyZW50XG4gIHdoaWxlIChwYXJlbnQpIHtcbiAgICBwYXJlbnQuJGVtaXQuYXBwbHkocGFyZW50LCBhcmd1bWVudHMpXG4gICAgcGFyZW50ID0gcGFyZW50Ll9ldmVudENhbmNlbGxlZFxuICAgICAgPyBudWxsXG4gICAgICA6IHBhcmVudC4kcGFyZW50XG4gIH1cbiAgcmV0dXJuIHRoaXNcbn1cblxuLyoqXG4gKiBNb2RpZnkgdGhlIGxpc3RlbmVyIGNvdW50cyBvbiBhbGwgcGFyZW50cy5cbiAqIFRoaXMgYm9va2tlZXBpbmcgYWxsb3dzICRicm9hZGNhc3QgdG8gcmV0dXJuIGVhcmx5IHdoZW5cbiAqIG5vIGNoaWxkIGhhcyBsaXN0ZW5lZCB0byBhIGNlcnRhaW4gZXZlbnQuXG4gKlxuICogQHBhcmFtIHtWdWV9IHZtXG4gKiBAcGFyYW0ge1N0cmluZ30gZXZlbnRcbiAqIEBwYXJhbSB7TnVtYmVyfSBjb3VudFxuICovXG5cbnZhciBob29rUkUgPSAvXmhvb2s6L1xuZnVuY3Rpb24gbW9kaWZ5TGlzdGVuZXJDb3VudCAodm0sIGV2ZW50LCBjb3VudCkge1xuICB2YXIgcGFyZW50ID0gdm0uJHBhcmVudFxuICAvLyBob29rcyBkbyBub3QgZ2V0IGJyb2FkY2FzdGVkIHNvIG5vIG5lZWRcbiAgLy8gdG8gZG8gYm9va2tlZXBpbmcgZm9yIHRoZW1cbiAgaWYgKCFwYXJlbnQgfHwgIWNvdW50IHx8IGhvb2tSRS50ZXN0KGV2ZW50KSkgcmV0dXJuXG4gIHdoaWxlIChwYXJlbnQpIHtcbiAgICBwYXJlbnQuX2V2ZW50c0NvdW50W2V2ZW50XSA9XG4gICAgICAocGFyZW50Ll9ldmVudHNDb3VudFtldmVudF0gfHwgMCkgKyBjb3VudFxuICAgIHBhcmVudCA9IHBhcmVudC4kcGFyZW50XG4gIH1cbn1cbiIsInZhciBfID0gcmVxdWlyZSgnLi4vdXRpbCcpXG52YXIgY29uZmlnID0gcmVxdWlyZSgnLi4vY29uZmlnJylcblxuLyoqXG4gKiBFeHBvc2UgdXNlZnVsIGludGVybmFsc1xuICovXG5cbmV4cG9ydHMudXRpbCA9IF9cbmV4cG9ydHMuY29uZmlnID0gY29uZmlnXG5leHBvcnRzLm5leHRUaWNrID0gXy5uZXh0VGlja1xuZXhwb3J0cy5jb21waWxlciA9IHJlcXVpcmUoJy4uL2NvbXBpbGVyJylcblxuZXhwb3J0cy5wYXJzZXJzID0ge1xuICBwYXRoOiByZXF1aXJlKCcuLi9wYXJzZXJzL3BhdGgnKSxcbiAgdGV4dDogcmVxdWlyZSgnLi4vcGFyc2Vycy90ZXh0JyksXG4gIHRlbXBsYXRlOiByZXF1aXJlKCcuLi9wYXJzZXJzL3RlbXBsYXRlJyksXG4gIGRpcmVjdGl2ZTogcmVxdWlyZSgnLi4vcGFyc2Vycy9kaXJlY3RpdmUnKSxcbiAgZXhwcmVzc2lvbjogcmVxdWlyZSgnLi4vcGFyc2Vycy9leHByZXNzaW9uJylcbn1cblxuLyoqXG4gKiBFYWNoIGluc3RhbmNlIGNvbnN0cnVjdG9yLCBpbmNsdWRpbmcgVnVlLCBoYXMgYSB1bmlxdWVcbiAqIGNpZC4gVGhpcyBlbmFibGVzIHVzIHRvIGNyZWF0ZSB3cmFwcGVkIFwiY2hpbGRcbiAqIGNvbnN0cnVjdG9yc1wiIGZvciBwcm90b3R5cGFsIGluaGVyaXRhbmNlIGFuZCBjYWNoZSB0aGVtLlxuICovXG5cbmV4cG9ydHMuY2lkID0gMFxudmFyIGNpZCA9IDFcblxuLyoqXG4gKiBDbGFzcyBpbmhlcml0YW5jZVxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBleHRlbmRPcHRpb25zXG4gKi9cblxuZXhwb3J0cy5leHRlbmQgPSBmdW5jdGlvbiAoZXh0ZW5kT3B0aW9ucykge1xuICBleHRlbmRPcHRpb25zID0gZXh0ZW5kT3B0aW9ucyB8fCB7fVxuICB2YXIgU3VwZXIgPSB0aGlzXG4gIHZhciBTdWIgPSBjcmVhdGVDbGFzcyhcbiAgICBleHRlbmRPcHRpb25zLm5hbWUgfHxcbiAgICBTdXBlci5vcHRpb25zLm5hbWUgfHxcbiAgICAnVnVlQ29tcG9uZW50J1xuICApXG4gIFN1Yi5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKFN1cGVyLnByb3RvdHlwZSlcbiAgU3ViLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IFN1YlxuICBTdWIuY2lkID0gY2lkKytcbiAgU3ViLm9wdGlvbnMgPSBfLm1lcmdlT3B0aW9ucyhcbiAgICBTdXBlci5vcHRpb25zLFxuICAgIGV4dGVuZE9wdGlvbnNcbiAgKVxuICBTdWJbJ3N1cGVyJ10gPSBTdXBlclxuICAvLyBhbGxvdyBmdXJ0aGVyIGV4dGVuc2lvblxuICBTdWIuZXh0ZW5kID0gU3VwZXIuZXh0ZW5kXG4gIC8vIGNyZWF0ZSBhc3NldCByZWdpc3RlcnMsIHNvIGV4dGVuZGVkIGNsYXNzZXNcbiAgLy8gY2FuIGhhdmUgdGhlaXIgcHJpdmF0ZSBhc3NldHMgdG9vLlxuICBjb25maWcuX2Fzc2V0VHlwZXMuZm9yRWFjaChmdW5jdGlvbiAodHlwZSkge1xuICAgIFN1Ylt0eXBlXSA9IFN1cGVyW3R5cGVdXG4gIH0pXG4gIHJldHVybiBTdWJcbn1cblxuLyoqXG4gKiBBIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyBhIHN1Yi1jbGFzcyBjb25zdHJ1Y3RvciB3aXRoIHRoZVxuICogZ2l2ZW4gbmFtZS4gVGhpcyBnaXZlcyB1cyBtdWNoIG5pY2VyIG91dHB1dCB3aGVuXG4gKiBsb2dnaW5nIGluc3RhbmNlcyBpbiB0aGUgY29uc29sZS5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZVxuICogQHJldHVybiB7RnVuY3Rpb259XG4gKi9cblxuZnVuY3Rpb24gY3JlYXRlQ2xhc3MgKG5hbWUpIHtcbiAgcmV0dXJuIG5ldyBGdW5jdGlvbihcbiAgICAncmV0dXJuIGZ1bmN0aW9uICcgKyBfLmNsYXNzaWZ5KG5hbWUpICtcbiAgICAnIChvcHRpb25zKSB7IHRoaXMuX2luaXQob3B0aW9ucykgfSdcbiAgKSgpXG59XG5cbi8qKlxuICogUGx1Z2luIHN5c3RlbVxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBwbHVnaW5cbiAqL1xuXG5leHBvcnRzLnVzZSA9IGZ1bmN0aW9uIChwbHVnaW4pIHtcbiAgLy8gYWRkaXRpb25hbCBwYXJhbWV0ZXJzXG4gIHZhciBhcmdzID0gXy50b0FycmF5KGFyZ3VtZW50cywgMSlcbiAgYXJncy51bnNoaWZ0KHRoaXMpXG4gIGlmICh0eXBlb2YgcGx1Z2luLmluc3RhbGwgPT09ICdmdW5jdGlvbicpIHtcbiAgICBwbHVnaW4uaW5zdGFsbC5hcHBseShwbHVnaW4sIGFyZ3MpXG4gIH0gZWxzZSB7XG4gICAgcGx1Z2luLmFwcGx5KG51bGwsIGFyZ3MpXG4gIH1cbiAgcmV0dXJuIHRoaXNcbn1cblxuLyoqXG4gKiBDcmVhdGUgYXNzZXQgcmVnaXN0cmF0aW9uIG1ldGhvZHMgd2l0aCB0aGUgZm9sbG93aW5nXG4gKiBzaWduYXR1cmU6XG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGlkXG4gKiBAcGFyYW0geyp9IGRlZmluaXRpb25cbiAqL1xuXG5jb25maWcuX2Fzc2V0VHlwZXMuZm9yRWFjaChmdW5jdGlvbiAodHlwZSkge1xuICBleHBvcnRzW3R5cGVdID0gZnVuY3Rpb24gKGlkLCBkZWZpbml0aW9uKSB7XG4gICAgaWYgKCFkZWZpbml0aW9uKSB7XG4gICAgICByZXR1cm4gdGhpcy5vcHRpb25zW3R5cGUgKyAncyddW2lkXVxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoXG4gICAgICAgIHR5cGUgPT09ICdjb21wb25lbnQnICYmXG4gICAgICAgIF8uaXNQbGFpbk9iamVjdChkZWZpbml0aW9uKVxuICAgICAgKSB7XG4gICAgICAgIGRlZmluaXRpb24ubmFtZSA9IGlkXG4gICAgICAgIGRlZmluaXRpb24gPSBfLlZ1ZS5leHRlbmQoZGVmaW5pdGlvbilcbiAgICAgIH1cbiAgICAgIHRoaXMub3B0aW9uc1t0eXBlICsgJ3MnXVtpZF0gPSBkZWZpbml0aW9uXG4gICAgfVxuICB9XG59KVxuIiwidmFyIF8gPSByZXF1aXJlKCcuLi91dGlsJylcbnZhciBjb21waWxlciA9IHJlcXVpcmUoJy4uL2NvbXBpbGVyJylcblxuLyoqXG4gKiBTZXQgaW5zdGFuY2UgdGFyZ2V0IGVsZW1lbnQgYW5kIGtpY2sgb2ZmIHRoZSBjb21waWxhdGlvblxuICogcHJvY2Vzcy4gVGhlIHBhc3NlZCBpbiBgZWxgIGNhbiBiZSBhIHNlbGVjdG9yIHN0cmluZywgYW5cbiAqIGV4aXN0aW5nIEVsZW1lbnQsIG9yIGEgRG9jdW1lbnRGcmFnbWVudCAoZm9yIGJsb2NrXG4gKiBpbnN0YW5jZXMpLlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudHxEb2N1bWVudEZyYWdtZW50fHN0cmluZ30gZWxcbiAqIEBwdWJsaWNcbiAqL1xuXG5leHBvcnRzLiRtb3VudCA9IGZ1bmN0aW9uIChlbCkge1xuICBpZiAodGhpcy5faXNDb21waWxlZCkge1xuICAgIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgJiYgXy53YXJuKFxuICAgICAgJyRtb3VudCgpIHNob3VsZCBiZSBjYWxsZWQgb25seSBvbmNlLidcbiAgICApXG4gICAgcmV0dXJuXG4gIH1cbiAgZWwgPSBfLnF1ZXJ5KGVsKVxuICBpZiAoIWVsKSB7XG4gICAgZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKVxuICB9XG4gIHRoaXMuX2NvbXBpbGUoZWwpXG4gIHRoaXMuX2lzQ29tcGlsZWQgPSB0cnVlXG4gIHRoaXMuX2NhbGxIb29rKCdjb21waWxlZCcpXG4gIHRoaXMuX2luaXRET01Ib29rcygpXG4gIGlmIChfLmluRG9jKHRoaXMuJGVsKSkge1xuICAgIHRoaXMuX2NhbGxIb29rKCdhdHRhY2hlZCcpXG4gICAgcmVhZHkuY2FsbCh0aGlzKVxuICB9IGVsc2Uge1xuICAgIHRoaXMuJG9uY2UoJ2hvb2s6YXR0YWNoZWQnLCByZWFkeSlcbiAgfVxuICByZXR1cm4gdGhpc1xufVxuXG4vKipcbiAqIE1hcmsgYW4gaW5zdGFuY2UgYXMgcmVhZHkuXG4gKi9cblxuZnVuY3Rpb24gcmVhZHkgKCkge1xuICB0aGlzLl9pc0F0dGFjaGVkID0gdHJ1ZVxuICB0aGlzLl9pc1JlYWR5ID0gdHJ1ZVxuICB0aGlzLl9jYWxsSG9vaygncmVhZHknKVxufVxuXG4vKipcbiAqIFRlYXJkb3duIHRoZSBpbnN0YW5jZSwgc2ltcGx5IGRlbGVnYXRlIHRvIHRoZSBpbnRlcm5hbFxuICogX2Rlc3Ryb3kuXG4gKi9cblxuZXhwb3J0cy4kZGVzdHJveSA9IGZ1bmN0aW9uIChyZW1vdmUsIGRlZmVyQ2xlYW51cCkge1xuICB0aGlzLl9kZXN0cm95KHJlbW92ZSwgZGVmZXJDbGVhbnVwKVxufVxuXG4vKipcbiAqIFBhcnRpYWxseSBjb21waWxlIGEgcGllY2Ugb2YgRE9NIGFuZCByZXR1cm4gYVxuICogZGVjb21waWxlIGZ1bmN0aW9uLlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudHxEb2N1bWVudEZyYWdtZW50fSBlbFxuICogQHBhcmFtIHtWdWV9IFtob3N0XVxuICogQHJldHVybiB7RnVuY3Rpb259XG4gKi9cblxuZXhwb3J0cy4kY29tcGlsZSA9IGZ1bmN0aW9uIChlbCwgaG9zdCkge1xuICByZXR1cm4gY29tcGlsZXIuY29tcGlsZShlbCwgdGhpcy4kb3B0aW9ucywgdHJ1ZSkodGhpcywgZWwsIGhvc3QpXG59XG4iLCJ2YXIgXyA9IHJlcXVpcmUoJy4vdXRpbCcpXG52YXIgY29uZmlnID0gcmVxdWlyZSgnLi9jb25maWcnKVxuXG4vLyB3ZSBoYXZlIHR3byBzZXBhcmF0ZSBxdWV1ZXM6IG9uZSBmb3IgZGlyZWN0aXZlIHVwZGF0ZXNcbi8vIGFuZCBvbmUgZm9yIHVzZXIgd2F0Y2hlciByZWdpc3RlcmVkIHZpYSAkd2F0Y2goKS5cbi8vIHdlIHdhbnQgdG8gZ3VhcmFudGVlIGRpcmVjdGl2ZSB1cGRhdGVzIHRvIGJlIGNhbGxlZFxuLy8gYmVmb3JlIHVzZXIgd2F0Y2hlcnMgc28gdGhhdCB3aGVuIHVzZXIgd2F0Y2hlcnMgYXJlXG4vLyB0cmlnZ2VyZWQsIHRoZSBET00gd291bGQgaGF2ZSBhbHJlYWR5IGJlZW4gaW4gdXBkYXRlZFxuLy8gc3RhdGUuXG52YXIgcXVldWUgPSBbXVxudmFyIHVzZXJRdWV1ZSA9IFtdXG52YXIgaGFzID0ge31cbnZhciBjaXJjdWxhciA9IHt9XG52YXIgd2FpdGluZyA9IGZhbHNlXG52YXIgaW50ZXJuYWxRdWV1ZURlcGxldGVkID0gZmFsc2VcblxuLyoqXG4gKiBSZXNldCB0aGUgYmF0Y2hlcidzIHN0YXRlLlxuICovXG5cbmZ1bmN0aW9uIHJlc2V0QmF0Y2hlclN0YXRlICgpIHtcbiAgcXVldWUgPSBbXVxuICB1c2VyUXVldWUgPSBbXVxuICBoYXMgPSB7fVxuICBjaXJjdWxhciA9IHt9XG4gIHdhaXRpbmcgPSBpbnRlcm5hbFF1ZXVlRGVwbGV0ZWQgPSBmYWxzZVxufVxuXG4vKipcbiAqIEZsdXNoIGJvdGggcXVldWVzIGFuZCBydW4gdGhlIHdhdGNoZXJzLlxuICovXG5cbmZ1bmN0aW9uIGZsdXNoQmF0Y2hlclF1ZXVlICgpIHtcbiAgcnVuQmF0Y2hlclF1ZXVlKHF1ZXVlKVxuICBpbnRlcm5hbFF1ZXVlRGVwbGV0ZWQgPSB0cnVlXG4gIHJ1bkJhdGNoZXJRdWV1ZSh1c2VyUXVldWUpXG4gIHJlc2V0QmF0Y2hlclN0YXRlKClcbn1cblxuLyoqXG4gKiBSdW4gdGhlIHdhdGNoZXJzIGluIGEgc2luZ2xlIHF1ZXVlLlxuICpcbiAqIEBwYXJhbSB7QXJyYXl9IHF1ZXVlXG4gKi9cblxuZnVuY3Rpb24gcnVuQmF0Y2hlclF1ZXVlIChxdWV1ZSkge1xuICAvLyBkbyBub3QgY2FjaGUgbGVuZ3RoIGJlY2F1c2UgbW9yZSB3YXRjaGVycyBtaWdodCBiZSBwdXNoZWRcbiAgLy8gYXMgd2UgcnVuIGV4aXN0aW5nIHdhdGNoZXJzXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgcXVldWUubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgd2F0Y2hlciA9IHF1ZXVlW2ldXG4gICAgdmFyIGlkID0gd2F0Y2hlci5pZFxuICAgIGhhc1tpZF0gPSBudWxsXG4gICAgd2F0Y2hlci5ydW4oKVxuICAgIC8vIGluIGRldiBidWlsZCwgY2hlY2sgYW5kIHN0b3AgY2lyY3VsYXIgdXBkYXRlcy5cbiAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiBoYXNbaWRdICE9IG51bGwpIHtcbiAgICAgIGNpcmN1bGFyW2lkXSA9IChjaXJjdWxhcltpZF0gfHwgMCkgKyAxXG4gICAgICBpZiAoY2lyY3VsYXJbaWRdID4gY29uZmlnLl9tYXhVcGRhdGVDb3VudCkge1xuICAgICAgICBxdWV1ZS5zcGxpY2UoaGFzW2lkXSwgMSlcbiAgICAgICAgXy53YXJuKFxuICAgICAgICAgICdZb3UgbWF5IGhhdmUgYW4gaW5maW5pdGUgdXBkYXRlIGxvb3AgZm9yIHdhdGNoZXIgJyArXG4gICAgICAgICAgJ3dpdGggZXhwcmVzc2lvbjogJyArIHdhdGNoZXIuZXhwcmVzc2lvblxuICAgICAgICApXG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogUHVzaCBhIHdhdGNoZXIgaW50byB0aGUgd2F0Y2hlciBxdWV1ZS5cbiAqIEpvYnMgd2l0aCBkdXBsaWNhdGUgSURzIHdpbGwgYmUgc2tpcHBlZCB1bmxlc3MgaXQnc1xuICogcHVzaGVkIHdoZW4gdGhlIHF1ZXVlIGlzIGJlaW5nIGZsdXNoZWQuXG4gKlxuICogQHBhcmFtIHtXYXRjaGVyfSB3YXRjaGVyXG4gKiAgIHByb3BlcnRpZXM6XG4gKiAgIC0ge051bWJlcn0gaWRcbiAqICAgLSB7RnVuY3Rpb259IHJ1blxuICovXG5cbmV4cG9ydHMucHVzaCA9IGZ1bmN0aW9uICh3YXRjaGVyKSB7XG4gIHZhciBpZCA9IHdhdGNoZXIuaWRcbiAgaWYgKGhhc1tpZF0gPT0gbnVsbCkge1xuICAgIC8vIGlmIGFuIGludGVybmFsIHdhdGNoZXIgaXMgcHVzaGVkLCBidXQgdGhlIGludGVybmFsXG4gICAgLy8gcXVldWUgaXMgYWxyZWFkeSBkZXBsZXRlZCwgd2UgcnVuIGl0IGltbWVkaWF0ZWx5LlxuICAgIGlmIChpbnRlcm5hbFF1ZXVlRGVwbGV0ZWQgJiYgIXdhdGNoZXIudXNlcikge1xuICAgICAgd2F0Y2hlci5ydW4oKVxuICAgICAgcmV0dXJuXG4gICAgfVxuICAgIC8vIHB1c2ggd2F0Y2hlciBpbnRvIGFwcHJvcHJpYXRlIHF1ZXVlXG4gICAgdmFyIHEgPSB3YXRjaGVyLnVzZXIgPyB1c2VyUXVldWUgOiBxdWV1ZVxuICAgIGhhc1tpZF0gPSBxLmxlbmd0aFxuICAgIHEucHVzaCh3YXRjaGVyKVxuICAgIC8vIHF1ZXVlIHRoZSBmbHVzaFxuICAgIGlmICghd2FpdGluZykge1xuICAgICAgd2FpdGluZyA9IHRydWVcbiAgICAgIF8ubmV4dFRpY2soZmx1c2hCYXRjaGVyUXVldWUpXG4gICAgfVxuICB9XG59XG4iLCIvKipcbiAqIEEgZG91Ymx5IGxpbmtlZCBsaXN0LWJhc2VkIExlYXN0IFJlY2VudGx5IFVzZWQgKExSVSlcbiAqIGNhY2hlLiBXaWxsIGtlZXAgbW9zdCByZWNlbnRseSB1c2VkIGl0ZW1zIHdoaWxlXG4gKiBkaXNjYXJkaW5nIGxlYXN0IHJlY2VudGx5IHVzZWQgaXRlbXMgd2hlbiBpdHMgbGltaXQgaXNcbiAqIHJlYWNoZWQuIFRoaXMgaXMgYSBiYXJlLWJvbmUgdmVyc2lvbiBvZlxuICogUmFzbXVzIEFuZGVyc3NvbidzIGpzLWxydTpcbiAqXG4gKiAgIGh0dHBzOi8vZ2l0aHViLmNvbS9yc21zL2pzLWxydVxuICpcbiAqIEBwYXJhbSB7TnVtYmVyfSBsaW1pdFxuICogQGNvbnN0cnVjdG9yXG4gKi9cblxuZnVuY3Rpb24gQ2FjaGUgKGxpbWl0KSB7XG4gIHRoaXMuc2l6ZSA9IDBcbiAgdGhpcy5saW1pdCA9IGxpbWl0XG4gIHRoaXMuaGVhZCA9IHRoaXMudGFpbCA9IHVuZGVmaW5lZFxuICB0aGlzLl9rZXltYXAgPSBPYmplY3QuY3JlYXRlKG51bGwpXG59XG5cbnZhciBwID0gQ2FjaGUucHJvdG90eXBlXG5cbi8qKlxuICogUHV0IDx2YWx1ZT4gaW50byB0aGUgY2FjaGUgYXNzb2NpYXRlZCB3aXRoIDxrZXk+LlxuICogUmV0dXJucyB0aGUgZW50cnkgd2hpY2ggd2FzIHJlbW92ZWQgdG8gbWFrZSByb29tIGZvclxuICogdGhlIG5ldyBlbnRyeS4gT3RoZXJ3aXNlIHVuZGVmaW5lZCBpcyByZXR1cm5lZC5cbiAqIChpLmUuIGlmIHRoZXJlIHdhcyBlbm91Z2ggcm9vbSBhbHJlYWR5KS5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30ga2V5XG4gKiBAcGFyYW0geyp9IHZhbHVlXG4gKiBAcmV0dXJuIHtFbnRyeXx1bmRlZmluZWR9XG4gKi9cblxucC5wdXQgPSBmdW5jdGlvbiAoa2V5LCB2YWx1ZSkge1xuICB2YXIgZW50cnkgPSB7XG4gICAga2V5OiBrZXksXG4gICAgdmFsdWU6IHZhbHVlXG4gIH1cbiAgdGhpcy5fa2V5bWFwW2tleV0gPSBlbnRyeVxuICBpZiAodGhpcy50YWlsKSB7XG4gICAgdGhpcy50YWlsLm5ld2VyID0gZW50cnlcbiAgICBlbnRyeS5vbGRlciA9IHRoaXMudGFpbFxuICB9IGVsc2Uge1xuICAgIHRoaXMuaGVhZCA9IGVudHJ5XG4gIH1cbiAgdGhpcy50YWlsID0gZW50cnlcbiAgaWYgKHRoaXMuc2l6ZSA9PT0gdGhpcy5saW1pdCkge1xuICAgIHJldHVybiB0aGlzLnNoaWZ0KClcbiAgfSBlbHNlIHtcbiAgICB0aGlzLnNpemUrK1xuICB9XG59XG5cbi8qKlxuICogUHVyZ2UgdGhlIGxlYXN0IHJlY2VudGx5IHVzZWQgKG9sZGVzdCkgZW50cnkgZnJvbSB0aGVcbiAqIGNhY2hlLiBSZXR1cm5zIHRoZSByZW1vdmVkIGVudHJ5IG9yIHVuZGVmaW5lZCBpZiB0aGVcbiAqIGNhY2hlIHdhcyBlbXB0eS5cbiAqL1xuXG5wLnNoaWZ0ID0gZnVuY3Rpb24gKCkge1xuICB2YXIgZW50cnkgPSB0aGlzLmhlYWRcbiAgaWYgKGVudHJ5KSB7XG4gICAgdGhpcy5oZWFkID0gdGhpcy5oZWFkLm5ld2VyXG4gICAgdGhpcy5oZWFkLm9sZGVyID0gdW5kZWZpbmVkXG4gICAgZW50cnkubmV3ZXIgPSBlbnRyeS5vbGRlciA9IHVuZGVmaW5lZFxuICAgIHRoaXMuX2tleW1hcFtlbnRyeS5rZXldID0gdW5kZWZpbmVkXG4gIH1cbiAgcmV0dXJuIGVudHJ5XG59XG5cbi8qKlxuICogR2V0IGFuZCByZWdpc3RlciByZWNlbnQgdXNlIG9mIDxrZXk+LiBSZXR1cm5zIHRoZSB2YWx1ZVxuICogYXNzb2NpYXRlZCB3aXRoIDxrZXk+IG9yIHVuZGVmaW5lZCBpZiBub3QgaW4gY2FjaGUuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGtleVxuICogQHBhcmFtIHtCb29sZWFufSByZXR1cm5FbnRyeVxuICogQHJldHVybiB7RW50cnl8Kn1cbiAqL1xuXG5wLmdldCA9IGZ1bmN0aW9uIChrZXksIHJldHVybkVudHJ5KSB7XG4gIHZhciBlbnRyeSA9IHRoaXMuX2tleW1hcFtrZXldXG4gIGlmIChlbnRyeSA9PT0gdW5kZWZpbmVkKSByZXR1cm5cbiAgaWYgKGVudHJ5ID09PSB0aGlzLnRhaWwpIHtcbiAgICByZXR1cm4gcmV0dXJuRW50cnlcbiAgICAgID8gZW50cnlcbiAgICAgIDogZW50cnkudmFsdWVcbiAgfVxuICAvLyBIRUFELS0tLS0tLS0tLS0tLS1UQUlMXG4gIC8vICAgPC5vbGRlciAgIC5uZXdlcj5cbiAgLy8gIDwtLS0gYWRkIGRpcmVjdGlvbiAtLVxuICAvLyAgIEEgIEIgIEMgIDxEPiAgRVxuICBpZiAoZW50cnkubmV3ZXIpIHtcbiAgICBpZiAoZW50cnkgPT09IHRoaXMuaGVhZCkge1xuICAgICAgdGhpcy5oZWFkID0gZW50cnkubmV3ZXJcbiAgICB9XG4gICAgZW50cnkubmV3ZXIub2xkZXIgPSBlbnRyeS5vbGRlciAvLyBDIDwtLSBFLlxuICB9XG4gIGlmIChlbnRyeS5vbGRlcikge1xuICAgIGVudHJ5Lm9sZGVyLm5ld2VyID0gZW50cnkubmV3ZXIgLy8gQy4gLS0+IEVcbiAgfVxuICBlbnRyeS5uZXdlciA9IHVuZGVmaW5lZCAvLyBEIC0teFxuICBlbnRyeS5vbGRlciA9IHRoaXMudGFpbCAvLyBELiAtLT4gRVxuICBpZiAodGhpcy50YWlsKSB7XG4gICAgdGhpcy50YWlsLm5ld2VyID0gZW50cnkgLy8gRS4gPC0tIERcbiAgfVxuICB0aGlzLnRhaWwgPSBlbnRyeVxuICByZXR1cm4gcmV0dXJuRW50cnlcbiAgICA/IGVudHJ5XG4gICAgOiBlbnRyeS52YWx1ZVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IENhY2hlXG4iLCJ2YXIgXyA9IHJlcXVpcmUoJy4uL3V0aWwnKVxudmFyIHRleHRQYXJzZXIgPSByZXF1aXJlKCcuLi9wYXJzZXJzL3RleHQnKVxudmFyIHByb3BEZWYgPSByZXF1aXJlKCcuLi9kaXJlY3RpdmVzL3Byb3AnKVxudmFyIHByb3BCaW5kaW5nTW9kZXMgPSByZXF1aXJlKCcuLi9jb25maWcnKS5fcHJvcEJpbmRpbmdNb2Rlc1xuXG4vLyByZWdleGVzXG52YXIgaWRlbnRSRSA9IHJlcXVpcmUoJy4uL3BhcnNlcnMvcGF0aCcpLmlkZW50UkVcbnZhciBkYXRhQXR0clJFID0gL15kYXRhLS9cbnZhciBzZXR0YWJsZVBhdGhSRSA9IC9eW0EtWmEtel8kXVtcXHckXSooXFwuW0EtWmEtel8kXVtcXHckXSp8XFxbW15cXFtcXF1dK1xcXSkqJC9cbnZhciBsaXRlcmFsVmFsdWVSRSA9IC9eKHRydWV8ZmFsc2UpJHxeXFxkLiovXG5cbi8qKlxuICogQ29tcGlsZSBwYXJhbSBhdHRyaWJ1dGVzIG9uIGEgcm9vdCBlbGVtZW50IGFuZCByZXR1cm5cbiAqIGEgcHJvcHMgbGluayBmdW5jdGlvbi5cbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR8RG9jdW1lbnRGcmFnbWVudH0gZWxcbiAqIEBwYXJhbSB7QXJyYXl9IHByb3BPcHRpb25zXG4gKiBAcmV0dXJuIHtGdW5jdGlvbn0gcHJvcHNMaW5rRm5cbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGNvbXBpbGVQcm9wcyAoZWwsIHByb3BPcHRpb25zKSB7XG4gIHZhciBwcm9wcyA9IFtdXG4gIHZhciBpID0gcHJvcE9wdGlvbnMubGVuZ3RoXG4gIHZhciBvcHRpb25zLCBuYW1lLCBhdHRyLCB2YWx1ZSwgcGF0aCwgcHJvcCwgbGl0ZXJhbCwgc2luZ2xlXG4gIHdoaWxlIChpLS0pIHtcbiAgICBvcHRpb25zID0gcHJvcE9wdGlvbnNbaV1cbiAgICBuYW1lID0gb3B0aW9ucy5uYW1lXG4gICAgLy8gcHJvcHMgY291bGQgY29udGFpbiBkYXNoZXMsIHdoaWNoIHdpbGwgYmVcbiAgICAvLyBpbnRlcnByZXRlZCBhcyBtaW51cyBjYWxjdWxhdGlvbnMgYnkgdGhlIHBhcnNlclxuICAgIC8vIHNvIHdlIG5lZWQgdG8gY2FtZWxpemUgdGhlIHBhdGggaGVyZVxuICAgIHBhdGggPSBfLmNhbWVsaXplKG5hbWUucmVwbGFjZShkYXRhQXR0clJFLCAnJykpXG4gICAgaWYgKCFpZGVudFJFLnRlc3QocGF0aCkpIHtcbiAgICAgIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgJiYgXy53YXJuKFxuICAgICAgICAnSW52YWxpZCBwcm9wIGtleTogXCInICsgbmFtZSArICdcIi4gUHJvcCBrZXlzICcgK1xuICAgICAgICAnbXVzdCBiZSB2YWxpZCBpZGVudGlmaWVycy4nXG4gICAgICApXG4gICAgICBjb250aW51ZVxuICAgIH1cbiAgICBhdHRyID0gXy5oeXBoZW5hdGUobmFtZSlcbiAgICB2YWx1ZSA9IGVsLmdldEF0dHJpYnV0ZShhdHRyKVxuICAgIGlmICh2YWx1ZSA9PT0gbnVsbCkge1xuICAgICAgYXR0ciA9ICdkYXRhLScgKyBhdHRyXG4gICAgICB2YWx1ZSA9IGVsLmdldEF0dHJpYnV0ZShhdHRyKVxuICAgIH1cbiAgICAvLyBjcmVhdGUgYSBwcm9wIGRlc2NyaXB0b3JcbiAgICBwcm9wID0ge1xuICAgICAgbmFtZTogbmFtZSxcbiAgICAgIHJhdzogdmFsdWUsXG4gICAgICBwYXRoOiBwYXRoLFxuICAgICAgb3B0aW9uczogb3B0aW9ucyxcbiAgICAgIG1vZGU6IHByb3BCaW5kaW5nTW9kZXMuT05FX1dBWVxuICAgIH1cbiAgICBpZiAodmFsdWUgIT09IG51bGwpIHtcbiAgICAgIC8vIGltcG9ydGFudCBzbyB0aGF0IHRoaXMgZG9lc24ndCBnZXQgY29tcGlsZWRcbiAgICAgIC8vIGFnYWluIGFzIGEgbm9ybWFsIGF0dHJpYnV0ZSBiaW5kaW5nXG4gICAgICBlbC5yZW1vdmVBdHRyaWJ1dGUoYXR0cilcbiAgICAgIHZhciB0b2tlbnMgPSB0ZXh0UGFyc2VyLnBhcnNlKHZhbHVlKVxuICAgICAgaWYgKHRva2Vucykge1xuICAgICAgICBwcm9wLmR5bmFtaWMgPSB0cnVlXG4gICAgICAgIHByb3AucGFyZW50UGF0aCA9IHRleHRQYXJzZXIudG9rZW5zVG9FeHAodG9rZW5zKVxuICAgICAgICAvLyBjaGVjayBwcm9wIGJpbmRpbmcgdHlwZS5cbiAgICAgICAgc2luZ2xlID0gdG9rZW5zLmxlbmd0aCA9PT0gMVxuICAgICAgICBsaXRlcmFsID0gbGl0ZXJhbFZhbHVlUkUudGVzdChwcm9wLnBhcmVudFBhdGgpXG4gICAgICAgIC8vIG9uZSB0aW1lOiB7eyogcHJvcH19XG4gICAgICAgIGlmIChsaXRlcmFsIHx8IChzaW5nbGUgJiYgdG9rZW5zWzBdLm9uZVRpbWUpKSB7XG4gICAgICAgICAgcHJvcC5tb2RlID0gcHJvcEJpbmRpbmdNb2Rlcy5PTkVfVElNRVxuICAgICAgICB9IGVsc2UgaWYgKFxuICAgICAgICAgICFsaXRlcmFsICYmXG4gICAgICAgICAgKHNpbmdsZSAmJiB0b2tlbnNbMF0udHdvV2F5KVxuICAgICAgICApIHtcbiAgICAgICAgICBpZiAoc2V0dGFibGVQYXRoUkUudGVzdChwcm9wLnBhcmVudFBhdGgpKSB7XG4gICAgICAgICAgICBwcm9wLm1vZGUgPSBwcm9wQmluZGluZ01vZGVzLlRXT19XQVlcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiBfLndhcm4oXG4gICAgICAgICAgICAgICdDYW5ub3QgYmluZCB0d28td2F5IHByb3Agd2l0aCBub24tc2V0dGFibGUgJyArXG4gICAgICAgICAgICAgICdwYXJlbnQgcGF0aDogJyArIHByb3AucGFyZW50UGF0aFxuICAgICAgICAgICAgKVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoXG4gICAgICAgICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJlxuICAgICAgICAgIG9wdGlvbnMudHdvV2F5ICYmXG4gICAgICAgICAgcHJvcC5tb2RlICE9PSBwcm9wQmluZGluZ01vZGVzLlRXT19XQVlcbiAgICAgICAgKSB7XG4gICAgICAgICAgXy53YXJuKFxuICAgICAgICAgICAgJ1Byb3AgXCInICsgbmFtZSArICdcIiBleHBlY3RzIGEgdHdvLXdheSBiaW5kaW5nIHR5cGUuJ1xuICAgICAgICAgIClcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAob3B0aW9ucyAmJiBvcHRpb25zLnJlcXVpcmVkKSB7XG4gICAgICBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nICYmIF8ud2FybihcbiAgICAgICAgJ01pc3NpbmcgcmVxdWlyZWQgcHJvcDogJyArIG5hbWVcbiAgICAgIClcbiAgICB9XG4gICAgcHJvcHMucHVzaChwcm9wKVxuICB9XG4gIHJldHVybiBtYWtlUHJvcHNMaW5rRm4ocHJvcHMpXG59XG5cbi8qKlxuICogQnVpbGQgYSBmdW5jdGlvbiB0aGF0IGFwcGxpZXMgcHJvcHMgdG8gYSB2bS5cbiAqXG4gKiBAcGFyYW0ge0FycmF5fSBwcm9wc1xuICogQHJldHVybiB7RnVuY3Rpb259IHByb3BzTGlua0ZuXG4gKi9cblxuZnVuY3Rpb24gbWFrZVByb3BzTGlua0ZuIChwcm9wcykge1xuICByZXR1cm4gZnVuY3Rpb24gcHJvcHNMaW5rRm4gKHZtLCBlbCkge1xuICAgIC8vIHN0b3JlIHJlc29sdmVkIHByb3BzIGluZm9cbiAgICB2bS5fcHJvcHMgPSB7fVxuICAgIHZhciBpID0gcHJvcHMubGVuZ3RoXG4gICAgdmFyIHByb3AsIHBhdGgsIG9wdGlvbnMsIHZhbHVlXG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgcHJvcCA9IHByb3BzW2ldXG4gICAgICBwYXRoID0gcHJvcC5wYXRoXG4gICAgICB2bS5fcHJvcHNbcGF0aF0gPSBwcm9wXG4gICAgICBvcHRpb25zID0gcHJvcC5vcHRpb25zXG4gICAgICBpZiAocHJvcC5yYXcgPT09IG51bGwpIHtcbiAgICAgICAgLy8gaW5pdGlhbGl6ZSBhYnNlbnQgcHJvcFxuICAgICAgICBfLmluaXRQcm9wKHZtLCBwcm9wLCBnZXREZWZhdWx0KG9wdGlvbnMpKVxuICAgICAgfSBlbHNlIGlmIChwcm9wLmR5bmFtaWMpIHtcbiAgICAgICAgLy8gZHluYW1pYyBwcm9wXG4gICAgICAgIGlmICh2bS5fY29udGV4dCkge1xuICAgICAgICAgIGlmIChwcm9wLm1vZGUgPT09IHByb3BCaW5kaW5nTW9kZXMuT05FX1RJTUUpIHtcbiAgICAgICAgICAgIC8vIG9uZSB0aW1lIGJpbmRpbmdcbiAgICAgICAgICAgIHZhbHVlID0gdm0uX2NvbnRleHQuJGdldChwcm9wLnBhcmVudFBhdGgpXG4gICAgICAgICAgICBfLmluaXRQcm9wKHZtLCBwcm9wLCB2YWx1ZSlcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gZHluYW1pYyBiaW5kaW5nXG4gICAgICAgICAgICB2bS5fYmluZERpcigncHJvcCcsIGVsLCBwcm9wLCBwcm9wRGVmKVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nICYmIF8ud2FybihcbiAgICAgICAgICAgICdDYW5ub3QgYmluZCBkeW5hbWljIHByb3Agb24gYSByb290IGluc3RhbmNlJyArXG4gICAgICAgICAgICAnIHdpdGggbm8gcGFyZW50OiAnICsgcHJvcC5uYW1lICsgJz1cIicgK1xuICAgICAgICAgICAgcHJvcC5yYXcgKyAnXCInXG4gICAgICAgICAgKVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBsaXRlcmFsLCBjYXN0IGl0IGFuZCBqdXN0IHNldCBvbmNlXG4gICAgICAgIHZhciByYXcgPSBwcm9wLnJhd1xuICAgICAgICB2YWx1ZSA9IG9wdGlvbnMudHlwZSA9PT0gQm9vbGVhbiAmJiByYXcgPT09ICcnXG4gICAgICAgICAgPyB0cnVlXG4gICAgICAgICAgLy8gZG8gbm90IGNhc3QgZW1wdHJ5IHN0cmluZy5cbiAgICAgICAgICAvLyBfLnRvTnVtYmVyIGNhc3RzIGVtcHR5IHN0cmluZyB0byAwLlxuICAgICAgICAgIDogcmF3LnRyaW0oKVxuICAgICAgICAgICAgPyBfLnRvQm9vbGVhbihfLnRvTnVtYmVyKHJhdykpXG4gICAgICAgICAgICA6IHJhd1xuICAgICAgICBfLmluaXRQcm9wKHZtLCBwcm9wLCB2YWx1ZSlcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBHZXQgdGhlIGRlZmF1bHQgdmFsdWUgb2YgYSBwcm9wLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKiBAcmV0dXJuIHsqfVxuICovXG5cbmZ1bmN0aW9uIGdldERlZmF1bHQgKG9wdGlvbnMpIHtcbiAgLy8gbm8gZGVmYXVsdCwgcmV0dXJuIHVuZGVmaW5lZFxuICBpZiAoIW9wdGlvbnMuaGFzT3duUHJvcGVydHkoJ2RlZmF1bHQnKSkge1xuICAgIC8vIGFic2VudCBib29sZWFuIHZhbHVlIGRlZmF1bHRzIHRvIGZhbHNlXG4gICAgcmV0dXJuIG9wdGlvbnMudHlwZSA9PT0gQm9vbGVhblxuICAgICAgPyBmYWxzZVxuICAgICAgOiB1bmRlZmluZWRcbiAgfVxuICB2YXIgZGVmID0gb3B0aW9ucy5kZWZhdWx0XG4gIC8vIHdhcm4gYWdhaW5zdCBub24tZmFjdG9yeSBkZWZhdWx0cyBmb3IgT2JqZWN0ICYgQXJyYXlcbiAgaWYgKF8uaXNPYmplY3QoZGVmKSkge1xuICAgIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgJiYgXy53YXJuKFxuICAgICAgJ09iamVjdC9BcnJheSBhcyBkZWZhdWx0IHByb3AgdmFsdWVzIHdpbGwgYmUgc2hhcmVkICcgK1xuICAgICAgJ2Fjcm9zcyBtdWx0aXBsZSBpbnN0YW5jZXMuIFVzZSBhIGZhY3RvcnkgZnVuY3Rpb24gJyArXG4gICAgICAndG8gcmV0dXJuIHRoZSBkZWZhdWx0IHZhbHVlIGluc3RlYWQuJ1xuICAgIClcbiAgfVxuICAvLyBjYWxsIGZhY3RvcnkgZnVuY3Rpb24gZm9yIG5vbi1GdW5jdGlvbiB0eXBlc1xuICByZXR1cm4gdHlwZW9mIGRlZiA9PT0gJ2Z1bmN0aW9uJyAmJiBvcHRpb25zLnR5cGUgIT09IEZ1bmN0aW9uXG4gICAgPyBkZWYoKVxuICAgIDogZGVmXG59XG4iLCJ2YXIgXyA9IHJlcXVpcmUoJy4uL3V0aWwnKVxudmFyIGNvbXBpbGVQcm9wcyA9IHJlcXVpcmUoJy4vY29tcGlsZS1wcm9wcycpXG52YXIgY29uZmlnID0gcmVxdWlyZSgnLi4vY29uZmlnJylcbnZhciB0ZXh0UGFyc2VyID0gcmVxdWlyZSgnLi4vcGFyc2Vycy90ZXh0JylcbnZhciBkaXJQYXJzZXIgPSByZXF1aXJlKCcuLi9wYXJzZXJzL2RpcmVjdGl2ZScpXG52YXIgdGVtcGxhdGVQYXJzZXIgPSByZXF1aXJlKCcuLi9wYXJzZXJzL3RlbXBsYXRlJylcbnZhciByZXNvbHZlQXNzZXQgPSBfLnJlc29sdmVBc3NldFxudmFyIGNvbXBvbmVudERlZiA9IHJlcXVpcmUoJy4uL2RpcmVjdGl2ZXMvY29tcG9uZW50JylcblxuLy8gdGVybWluYWwgZGlyZWN0aXZlc1xudmFyIHRlcm1pbmFsRGlyZWN0aXZlcyA9IFtcbiAgJ3JlcGVhdCcsXG4gICdpZidcbl1cblxuLyoqXG4gKiBDb21waWxlIGEgdGVtcGxhdGUgYW5kIHJldHVybiBhIHJldXNhYmxlIGNvbXBvc2l0ZSBsaW5rXG4gKiBmdW5jdGlvbiwgd2hpY2ggcmVjdXJzaXZlbHkgY29udGFpbnMgbW9yZSBsaW5rIGZ1bmN0aW9uc1xuICogaW5zaWRlLiBUaGlzIHRvcCBsZXZlbCBjb21waWxlIGZ1bmN0aW9uIHdvdWxkIG5vcm1hbGx5XG4gKiBiZSBjYWxsZWQgb24gaW5zdGFuY2Ugcm9vdCBub2RlcywgYnV0IGNhbiBhbHNvIGJlIHVzZWRcbiAqIGZvciBwYXJ0aWFsIGNvbXBpbGF0aW9uIGlmIHRoZSBwYXJ0aWFsIGFyZ3VtZW50IGlzIHRydWUuXG4gKlxuICogVGhlIHJldHVybmVkIGNvbXBvc2l0ZSBsaW5rIGZ1bmN0aW9uLCB3aGVuIGNhbGxlZCwgd2lsbFxuICogcmV0dXJuIGFuIHVubGluayBmdW5jdGlvbiB0aGF0IHRlYXJzZG93biBhbGwgZGlyZWN0aXZlc1xuICogY3JlYXRlZCBkdXJpbmcgdGhlIGxpbmtpbmcgcGhhc2UuXG4gKlxuICogQHBhcmFtIHtFbGVtZW50fERvY3VtZW50RnJhZ21lbnR9IGVsXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICogQHBhcmFtIHtCb29sZWFufSBwYXJ0aWFsXG4gKiBAcmV0dXJuIHtGdW5jdGlvbn1cbiAqL1xuXG5leHBvcnRzLmNvbXBpbGUgPSBmdW5jdGlvbiAoZWwsIG9wdGlvbnMsIHBhcnRpYWwpIHtcbiAgLy8gbGluayBmdW5jdGlvbiBmb3IgdGhlIG5vZGUgaXRzZWxmLlxuICB2YXIgbm9kZUxpbmtGbiA9IHBhcnRpYWwgfHwgIW9wdGlvbnMuX2FzQ29tcG9uZW50XG4gICAgPyBjb21waWxlTm9kZShlbCwgb3B0aW9ucylcbiAgICA6IG51bGxcbiAgLy8gbGluayBmdW5jdGlvbiBmb3IgdGhlIGNoaWxkTm9kZXNcbiAgdmFyIGNoaWxkTGlua0ZuID1cbiAgICAhKG5vZGVMaW5rRm4gJiYgbm9kZUxpbmtGbi50ZXJtaW5hbCkgJiZcbiAgICBlbC50YWdOYW1lICE9PSAnU0NSSVBUJyAmJlxuICAgIGVsLmhhc0NoaWxkTm9kZXMoKVxuICAgICAgPyBjb21waWxlTm9kZUxpc3QoZWwuY2hpbGROb2Rlcywgb3B0aW9ucylcbiAgICAgIDogbnVsbFxuXG4gIC8qKlxuICAgKiBBIGNvbXBvc2l0ZSBsaW5rZXIgZnVuY3Rpb24gdG8gYmUgY2FsbGVkIG9uIGEgYWxyZWFkeVxuICAgKiBjb21waWxlZCBwaWVjZSBvZiBET00sIHdoaWNoIGluc3RhbnRpYXRlcyBhbGwgZGlyZWN0aXZlXG4gICAqIGluc3RhbmNlcy5cbiAgICpcbiAgICogQHBhcmFtIHtWdWV9IHZtXG4gICAqIEBwYXJhbSB7RWxlbWVudHxEb2N1bWVudEZyYWdtZW50fSBlbFxuICAgKiBAcGFyYW0ge1Z1ZX0gW2hvc3RdIC0gaG9zdCB2bSBvZiB0cmFuc2NsdWRlZCBjb250ZW50XG4gICAqIEByZXR1cm4ge0Z1bmN0aW9ufHVuZGVmaW5lZH1cbiAgICovXG5cbiAgcmV0dXJuIGZ1bmN0aW9uIGNvbXBvc2l0ZUxpbmtGbiAodm0sIGVsLCBob3N0KSB7XG4gICAgLy8gY2FjaGUgY2hpbGROb2RlcyBiZWZvcmUgbGlua2luZyBwYXJlbnQsIGZpeCAjNjU3XG4gICAgdmFyIGNoaWxkTm9kZXMgPSBfLnRvQXJyYXkoZWwuY2hpbGROb2RlcylcbiAgICAvLyBsaW5rXG4gICAgdmFyIGRpcnMgPSBsaW5rQW5kQ2FwdHVyZShmdW5jdGlvbiAoKSB7XG4gICAgICBpZiAobm9kZUxpbmtGbikgbm9kZUxpbmtGbih2bSwgZWwsIGhvc3QpXG4gICAgICBpZiAoY2hpbGRMaW5rRm4pIGNoaWxkTGlua0ZuKHZtLCBjaGlsZE5vZGVzLCBob3N0KVxuICAgIH0sIHZtKVxuICAgIHJldHVybiBtYWtlVW5saW5rRm4odm0sIGRpcnMpXG4gIH1cbn1cblxuLyoqXG4gKiBBcHBseSBhIGxpbmtlciB0byBhIHZtL2VsZW1lbnQgcGFpciBhbmQgY2FwdHVyZSB0aGVcbiAqIGRpcmVjdGl2ZXMgY3JlYXRlZCBkdXJpbmcgdGhlIHByb2Nlc3MuXG4gKlxuICogQHBhcmFtIHtGdW5jdGlvbn0gbGlua2VyXG4gKiBAcGFyYW0ge1Z1ZX0gdm1cbiAqL1xuXG5mdW5jdGlvbiBsaW5rQW5kQ2FwdHVyZSAobGlua2VyLCB2bSkge1xuICB2YXIgb3JpZ2luYWxEaXJDb3VudCA9IHZtLl9kaXJlY3RpdmVzLmxlbmd0aFxuICBsaW5rZXIoKVxuICByZXR1cm4gdm0uX2RpcmVjdGl2ZXMuc2xpY2Uob3JpZ2luYWxEaXJDb3VudClcbn1cblxuLyoqXG4gKiBMaW5rZXIgZnVuY3Rpb25zIHJldHVybiBhbiB1bmxpbmsgZnVuY3Rpb24gdGhhdFxuICogdGVhcnNkb3duIGFsbCBkaXJlY3RpdmVzIGluc3RhbmNlcyBnZW5lcmF0ZWQgZHVyaW5nXG4gKiB0aGUgcHJvY2Vzcy5cbiAqXG4gKiBXZSBjcmVhdGUgdW5saW5rIGZ1bmN0aW9ucyB3aXRoIG9ubHkgdGhlIG5lY2Vzc2FyeVxuICogaW5mb3JtYXRpb24gdG8gYXZvaWQgcmV0YWluaW5nIGFkZGl0aW9uYWwgY2xvc3VyZXMuXG4gKlxuICogQHBhcmFtIHtWdWV9IHZtXG4gKiBAcGFyYW0ge0FycmF5fSBkaXJzXG4gKiBAcGFyYW0ge1Z1ZX0gW2NvbnRleHRdXG4gKiBAcGFyYW0ge0FycmF5fSBbY29udGV4dERpcnNdXG4gKiBAcmV0dXJuIHtGdW5jdGlvbn1cbiAqL1xuXG5mdW5jdGlvbiBtYWtlVW5saW5rRm4gKHZtLCBkaXJzLCBjb250ZXh0LCBjb250ZXh0RGlycykge1xuICByZXR1cm4gZnVuY3Rpb24gdW5saW5rIChkZXN0cm95aW5nKSB7XG4gICAgdGVhcmRvd25EaXJzKHZtLCBkaXJzLCBkZXN0cm95aW5nKVxuICAgIGlmIChjb250ZXh0ICYmIGNvbnRleHREaXJzKSB7XG4gICAgICB0ZWFyZG93bkRpcnMoY29udGV4dCwgY29udGV4dERpcnMpXG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogVGVhcmRvd24gcGFydGlhbCBsaW5rZWQgZGlyZWN0aXZlcy5cbiAqXG4gKiBAcGFyYW0ge1Z1ZX0gdm1cbiAqIEBwYXJhbSB7QXJyYXl9IGRpcnNcbiAqIEBwYXJhbSB7Qm9vbGVhbn0gZGVzdHJveWluZ1xuICovXG5cbmZ1bmN0aW9uIHRlYXJkb3duRGlycyAodm0sIGRpcnMsIGRlc3Ryb3lpbmcpIHtcbiAgdmFyIGkgPSBkaXJzLmxlbmd0aFxuICB3aGlsZSAoaS0tKSB7XG4gICAgZGlyc1tpXS5fdGVhcmRvd24oKVxuICAgIGlmICghZGVzdHJveWluZykge1xuICAgICAgdm0uX2RpcmVjdGl2ZXMuJHJlbW92ZShkaXJzW2ldKVxuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIENvbXBpbGUgbGluayBwcm9wcyBvbiBhbiBpbnN0YW5jZS5cbiAqXG4gKiBAcGFyYW0ge1Z1ZX0gdm1cbiAqIEBwYXJhbSB7RWxlbWVudH0gZWxcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKiBAcmV0dXJuIHtGdW5jdGlvbn1cbiAqL1xuXG5leHBvcnRzLmNvbXBpbGVBbmRMaW5rUHJvcHMgPSBmdW5jdGlvbiAodm0sIGVsLCBwcm9wcykge1xuICB2YXIgcHJvcHNMaW5rRm4gPSBjb21waWxlUHJvcHMoZWwsIHByb3BzKVxuICB2YXIgcHJvcERpcnMgPSBsaW5rQW5kQ2FwdHVyZShmdW5jdGlvbiAoKSB7XG4gICAgcHJvcHNMaW5rRm4odm0sIG51bGwpXG4gIH0sIHZtKVxuICByZXR1cm4gbWFrZVVubGlua0ZuKHZtLCBwcm9wRGlycylcbn1cblxuLyoqXG4gKiBDb21waWxlIHRoZSByb290IGVsZW1lbnQgb2YgYW4gaW5zdGFuY2UuXG4gKlxuICogMS4gYXR0cnMgb24gY29udGV4dCBjb250YWluZXIgKGNvbnRleHQgc2NvcGUpXG4gKiAyLiBhdHRycyBvbiB0aGUgY29tcG9uZW50IHRlbXBsYXRlIHJvb3Qgbm9kZSwgaWZcbiAqICAgIHJlcGxhY2U6dHJ1ZSAoY2hpbGQgc2NvcGUpXG4gKlxuICogSWYgdGhpcyBpcyBhIGZyYWdtZW50IGluc3RhbmNlLCB3ZSBvbmx5IG5lZWQgdG8gY29tcGlsZSAxLlxuICpcbiAqIEBwYXJhbSB7VnVlfSB2bVxuICogQHBhcmFtIHtFbGVtZW50fSBlbFxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuICovXG5cbmV4cG9ydHMuY29tcGlsZVJvb3QgPSBmdW5jdGlvbiAoZWwsIG9wdGlvbnMpIHtcbiAgdmFyIGNvbnRhaW5lckF0dHJzID0gb3B0aW9ucy5fY29udGFpbmVyQXR0cnNcbiAgdmFyIHJlcGxhY2VyQXR0cnMgPSBvcHRpb25zLl9yZXBsYWNlckF0dHJzXG4gIHZhciBjb250ZXh0TGlua0ZuLCByZXBsYWNlckxpbmtGblxuXG4gIC8vIG9ubHkgbmVlZCB0byBjb21waWxlIG90aGVyIGF0dHJpYnV0ZXMgZm9yXG4gIC8vIG5vbi1mcmFnbWVudCBpbnN0YW5jZXNcbiAgaWYgKGVsLm5vZGVUeXBlICE9PSAxMSkge1xuICAgIC8vIGZvciBjb21wb25lbnRzLCBjb250YWluZXIgYW5kIHJlcGxhY2VyIG5lZWQgdG8gYmVcbiAgICAvLyBjb21waWxlZCBzZXBhcmF0ZWx5IGFuZCBsaW5rZWQgaW4gZGlmZmVyZW50IHNjb3Blcy5cbiAgICBpZiAob3B0aW9ucy5fYXNDb21wb25lbnQpIHtcbiAgICAgIC8vIDIuIGNvbnRhaW5lciBhdHRyaWJ1dGVzXG4gICAgICBpZiAoY29udGFpbmVyQXR0cnMpIHtcbiAgICAgICAgY29udGV4dExpbmtGbiA9IGNvbXBpbGVEaXJlY3RpdmVzKGNvbnRhaW5lckF0dHJzLCBvcHRpb25zKVxuICAgICAgfVxuICAgICAgaWYgKHJlcGxhY2VyQXR0cnMpIHtcbiAgICAgICAgLy8gMy4gcmVwbGFjZXIgYXR0cmlidXRlc1xuICAgICAgICByZXBsYWNlckxpbmtGbiA9IGNvbXBpbGVEaXJlY3RpdmVzKHJlcGxhY2VyQXR0cnMsIG9wdGlvbnMpXG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIG5vbi1jb21wb25lbnQsIGp1c3QgY29tcGlsZSBhcyBhIG5vcm1hbCBlbGVtZW50LlxuICAgICAgcmVwbGFjZXJMaW5rRm4gPSBjb21waWxlRGlyZWN0aXZlcyhlbC5hdHRyaWJ1dGVzLCBvcHRpb25zKVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBmdW5jdGlvbiByb290TGlua0ZuICh2bSwgZWwpIHtcbiAgICAvLyBsaW5rIGNvbnRleHQgc2NvcGUgZGlyc1xuICAgIHZhciBjb250ZXh0ID0gdm0uX2NvbnRleHRcbiAgICB2YXIgY29udGV4dERpcnNcbiAgICBpZiAoY29udGV4dCAmJiBjb250ZXh0TGlua0ZuKSB7XG4gICAgICBjb250ZXh0RGlycyA9IGxpbmtBbmRDYXB0dXJlKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgY29udGV4dExpbmtGbihjb250ZXh0LCBlbClcbiAgICAgIH0sIGNvbnRleHQpXG4gICAgfVxuXG4gICAgLy8gbGluayBzZWxmXG4gICAgdmFyIHNlbGZEaXJzID0gbGlua0FuZENhcHR1cmUoZnVuY3Rpb24gKCkge1xuICAgICAgaWYgKHJlcGxhY2VyTGlua0ZuKSByZXBsYWNlckxpbmtGbih2bSwgZWwpXG4gICAgfSwgdm0pXG5cbiAgICAvLyByZXR1cm4gdGhlIHVubGluayBmdW5jdGlvbiB0aGF0IHRlYXJzZG93biBjb250ZXh0XG4gICAgLy8gY29udGFpbmVyIGRpcmVjdGl2ZXMuXG4gICAgcmV0dXJuIG1ha2VVbmxpbmtGbih2bSwgc2VsZkRpcnMsIGNvbnRleHQsIGNvbnRleHREaXJzKVxuICB9XG59XG5cbi8qKlxuICogQ29tcGlsZSBhIG5vZGUgYW5kIHJldHVybiBhIG5vZGVMaW5rRm4gYmFzZWQgb24gdGhlXG4gKiBub2RlIHR5cGUuXG4gKlxuICogQHBhcmFtIHtOb2RlfSBub2RlXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICogQHJldHVybiB7RnVuY3Rpb258bnVsbH1cbiAqL1xuXG5mdW5jdGlvbiBjb21waWxlTm9kZSAobm9kZSwgb3B0aW9ucykge1xuICB2YXIgdHlwZSA9IG5vZGUubm9kZVR5cGVcbiAgaWYgKHR5cGUgPT09IDEgJiYgbm9kZS50YWdOYW1lICE9PSAnU0NSSVBUJykge1xuICAgIHJldHVybiBjb21waWxlRWxlbWVudChub2RlLCBvcHRpb25zKVxuICB9IGVsc2UgaWYgKHR5cGUgPT09IDMgJiYgY29uZmlnLmludGVycG9sYXRlICYmIG5vZGUuZGF0YS50cmltKCkpIHtcbiAgICByZXR1cm4gY29tcGlsZVRleHROb2RlKG5vZGUsIG9wdGlvbnMpXG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIG51bGxcbiAgfVxufVxuXG4vKipcbiAqIENvbXBpbGUgYW4gZWxlbWVudCBhbmQgcmV0dXJuIGEgbm9kZUxpbmtGbi5cbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IGVsXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICogQHJldHVybiB7RnVuY3Rpb258bnVsbH1cbiAqL1xuXG5mdW5jdGlvbiBjb21waWxlRWxlbWVudCAoZWwsIG9wdGlvbnMpIHtcbiAgLy8gcHJlcHJvY2VzcyB0ZXh0YXJlYXMuXG4gIC8vIHRleHRhcmVhIHRyZWF0cyBpdHMgdGV4dCBjb250ZW50IGFzIHRoZSBpbml0aWFsIHZhbHVlLlxuICAvLyBqdXN0IGJpbmQgaXQgYXMgYSB2LWF0dHIgZGlyZWN0aXZlIGZvciB2YWx1ZS5cbiAgaWYgKGVsLnRhZ05hbWUgPT09ICdURVhUQVJFQScpIHtcbiAgICBpZiAodGV4dFBhcnNlci5wYXJzZShlbC52YWx1ZSkpIHtcbiAgICAgIGVsLnNldEF0dHJpYnV0ZSgndmFsdWUnLCBlbC52YWx1ZSlcbiAgICB9XG4gIH1cbiAgdmFyIGxpbmtGblxuICB2YXIgaGFzQXR0cnMgPSBlbC5oYXNBdHRyaWJ1dGVzKClcbiAgLy8gY2hlY2sgdGVybWluYWwgZGlyZWN0aXZlcyAocmVwZWF0ICYgaWYpXG4gIGlmIChoYXNBdHRycykge1xuICAgIGxpbmtGbiA9IGNoZWNrVGVybWluYWxEaXJlY3RpdmVzKGVsLCBvcHRpb25zKVxuICB9XG4gIC8vIGNoZWNrIGVsZW1lbnQgZGlyZWN0aXZlc1xuICBpZiAoIWxpbmtGbikge1xuICAgIGxpbmtGbiA9IGNoZWNrRWxlbWVudERpcmVjdGl2ZXMoZWwsIG9wdGlvbnMpXG4gIH1cbiAgLy8gY2hlY2sgY29tcG9uZW50XG4gIGlmICghbGlua0ZuKSB7XG4gICAgbGlua0ZuID0gY2hlY2tDb21wb25lbnQoZWwsIG9wdGlvbnMpXG4gIH1cbiAgLy8gbm9ybWFsIGRpcmVjdGl2ZXNcbiAgaWYgKCFsaW5rRm4gJiYgaGFzQXR0cnMpIHtcbiAgICBsaW5rRm4gPSBjb21waWxlRGlyZWN0aXZlcyhlbC5hdHRyaWJ1dGVzLCBvcHRpb25zKVxuICB9XG4gIHJldHVybiBsaW5rRm5cbn1cblxuLyoqXG4gKiBDb21waWxlIGEgdGV4dE5vZGUgYW5kIHJldHVybiBhIG5vZGVMaW5rRm4uXG4gKlxuICogQHBhcmFtIHtUZXh0Tm9kZX0gbm9kZVxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAqIEByZXR1cm4ge0Z1bmN0aW9ufG51bGx9IHRleHROb2RlTGlua0ZuXG4gKi9cblxuZnVuY3Rpb24gY29tcGlsZVRleHROb2RlIChub2RlLCBvcHRpb25zKSB7XG4gIHZhciB0b2tlbnMgPSB0ZXh0UGFyc2VyLnBhcnNlKG5vZGUuZGF0YSlcbiAgaWYgKCF0b2tlbnMpIHtcbiAgICByZXR1cm4gbnVsbFxuICB9XG4gIHZhciBmcmFnID0gZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpXG4gIHZhciBlbCwgdG9rZW5cbiAgZm9yICh2YXIgaSA9IDAsIGwgPSB0b2tlbnMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgdG9rZW4gPSB0b2tlbnNbaV1cbiAgICBlbCA9IHRva2VuLnRhZ1xuICAgICAgPyBwcm9jZXNzVGV4dFRva2VuKHRva2VuLCBvcHRpb25zKVxuICAgICAgOiBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSh0b2tlbi52YWx1ZSlcbiAgICBmcmFnLmFwcGVuZENoaWxkKGVsKVxuICB9XG4gIHJldHVybiBtYWtlVGV4dE5vZGVMaW5rRm4odG9rZW5zLCBmcmFnLCBvcHRpb25zKVxufVxuXG4vKipcbiAqIFByb2Nlc3MgYSBzaW5nbGUgdGV4dCB0b2tlbi5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdG9rZW5cbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKiBAcmV0dXJuIHtOb2RlfVxuICovXG5cbmZ1bmN0aW9uIHByb2Nlc3NUZXh0VG9rZW4gKHRva2VuLCBvcHRpb25zKSB7XG4gIHZhciBlbFxuICBpZiAodG9rZW4ub25lVGltZSkge1xuICAgIGVsID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUodG9rZW4udmFsdWUpXG4gIH0gZWxzZSB7XG4gICAgaWYgKHRva2VuLmh0bWwpIHtcbiAgICAgIGVsID0gZG9jdW1lbnQuY3JlYXRlQ29tbWVudCgndi1odG1sJylcbiAgICAgIHNldFRva2VuVHlwZSgnaHRtbCcpXG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIElFIHdpbGwgY2xlYW4gdXAgZW1wdHkgdGV4dE5vZGVzIGR1cmluZ1xuICAgICAgLy8gZnJhZy5jbG9uZU5vZGUodHJ1ZSksIHNvIHdlIGhhdmUgdG8gZ2l2ZSBpdFxuICAgICAgLy8gc29tZXRoaW5nIGhlcmUuLi5cbiAgICAgIGVsID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoJyAnKVxuICAgICAgc2V0VG9rZW5UeXBlKCd0ZXh0JylcbiAgICB9XG4gIH1cbiAgZnVuY3Rpb24gc2V0VG9rZW5UeXBlICh0eXBlKSB7XG4gICAgdG9rZW4udHlwZSA9IHR5cGVcbiAgICB0b2tlbi5kZWYgPSByZXNvbHZlQXNzZXQob3B0aW9ucywgJ2RpcmVjdGl2ZXMnLCB0eXBlKVxuICAgIHRva2VuLmRlc2NyaXB0b3IgPSBkaXJQYXJzZXIucGFyc2UodG9rZW4udmFsdWUpWzBdXG4gIH1cbiAgcmV0dXJuIGVsXG59XG5cbi8qKlxuICogQnVpbGQgYSBmdW5jdGlvbiB0aGF0IHByb2Nlc3NlcyBhIHRleHROb2RlLlxuICpcbiAqIEBwYXJhbSB7QXJyYXk8T2JqZWN0Pn0gdG9rZW5zXG4gKiBAcGFyYW0ge0RvY3VtZW50RnJhZ21lbnR9IGZyYWdcbiAqL1xuXG5mdW5jdGlvbiBtYWtlVGV4dE5vZGVMaW5rRm4gKHRva2VucywgZnJhZykge1xuICByZXR1cm4gZnVuY3Rpb24gdGV4dE5vZGVMaW5rRm4gKHZtLCBlbCkge1xuICAgIHZhciBmcmFnQ2xvbmUgPSBmcmFnLmNsb25lTm9kZSh0cnVlKVxuICAgIHZhciBjaGlsZE5vZGVzID0gXy50b0FycmF5KGZyYWdDbG9uZS5jaGlsZE5vZGVzKVxuICAgIHZhciB0b2tlbiwgdmFsdWUsIG5vZGVcbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IHRva2Vucy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgIHRva2VuID0gdG9rZW5zW2ldXG4gICAgICB2YWx1ZSA9IHRva2VuLnZhbHVlXG4gICAgICBpZiAodG9rZW4udGFnKSB7XG4gICAgICAgIG5vZGUgPSBjaGlsZE5vZGVzW2ldXG4gICAgICAgIGlmICh0b2tlbi5vbmVUaW1lKSB7XG4gICAgICAgICAgdmFsdWUgPSB2bS4kZXZhbCh2YWx1ZSlcbiAgICAgICAgICBpZiAodG9rZW4uaHRtbCkge1xuICAgICAgICAgICAgXy5yZXBsYWNlKG5vZGUsIHRlbXBsYXRlUGFyc2VyLnBhcnNlKHZhbHVlLCB0cnVlKSlcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbm9kZS5kYXRhID0gdmFsdWVcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdm0uX2JpbmREaXIodG9rZW4udHlwZSwgbm9kZSxcbiAgICAgICAgICAgICAgICAgICAgICB0b2tlbi5kZXNjcmlwdG9yLCB0b2tlbi5kZWYpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgXy5yZXBsYWNlKGVsLCBmcmFnQ2xvbmUpXG4gIH1cbn1cblxuLyoqXG4gKiBDb21waWxlIGEgbm9kZSBsaXN0IGFuZCByZXR1cm4gYSBjaGlsZExpbmtGbi5cbiAqXG4gKiBAcGFyYW0ge05vZGVMaXN0fSBub2RlTGlzdFxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAqIEByZXR1cm4ge0Z1bmN0aW9ufHVuZGVmaW5lZH1cbiAqL1xuXG5mdW5jdGlvbiBjb21waWxlTm9kZUxpc3QgKG5vZGVMaXN0LCBvcHRpb25zKSB7XG4gIHZhciBsaW5rRm5zID0gW11cbiAgdmFyIG5vZGVMaW5rRm4sIGNoaWxkTGlua0ZuLCBub2RlXG4gIGZvciAodmFyIGkgPSAwLCBsID0gbm9kZUxpc3QubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgbm9kZSA9IG5vZGVMaXN0W2ldXG4gICAgbm9kZUxpbmtGbiA9IGNvbXBpbGVOb2RlKG5vZGUsIG9wdGlvbnMpXG4gICAgY2hpbGRMaW5rRm4gPVxuICAgICAgIShub2RlTGlua0ZuICYmIG5vZGVMaW5rRm4udGVybWluYWwpICYmXG4gICAgICBub2RlLnRhZ05hbWUgIT09ICdTQ1JJUFQnICYmXG4gICAgICBub2RlLmhhc0NoaWxkTm9kZXMoKVxuICAgICAgICA/IGNvbXBpbGVOb2RlTGlzdChub2RlLmNoaWxkTm9kZXMsIG9wdGlvbnMpXG4gICAgICAgIDogbnVsbFxuICAgIGxpbmtGbnMucHVzaChub2RlTGlua0ZuLCBjaGlsZExpbmtGbilcbiAgfVxuICByZXR1cm4gbGlua0Zucy5sZW5ndGhcbiAgICA/IG1ha2VDaGlsZExpbmtGbihsaW5rRm5zKVxuICAgIDogbnVsbFxufVxuXG4vKipcbiAqIE1ha2UgYSBjaGlsZCBsaW5rIGZ1bmN0aW9uIGZvciBhIG5vZGUncyBjaGlsZE5vZGVzLlxuICpcbiAqIEBwYXJhbSB7QXJyYXk8RnVuY3Rpb24+fSBsaW5rRm5zXG4gKiBAcmV0dXJuIHtGdW5jdGlvbn0gY2hpbGRMaW5rRm5cbiAqL1xuXG5mdW5jdGlvbiBtYWtlQ2hpbGRMaW5rRm4gKGxpbmtGbnMpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIGNoaWxkTGlua0ZuICh2bSwgbm9kZXMsIGhvc3QpIHtcbiAgICB2YXIgbm9kZSwgbm9kZUxpbmtGbiwgY2hpbGRyZW5MaW5rRm5cbiAgICBmb3IgKHZhciBpID0gMCwgbiA9IDAsIGwgPSBsaW5rRm5zLmxlbmd0aDsgaSA8IGw7IG4rKykge1xuICAgICAgbm9kZSA9IG5vZGVzW25dXG4gICAgICBub2RlTGlua0ZuID0gbGlua0Zuc1tpKytdXG4gICAgICBjaGlsZHJlbkxpbmtGbiA9IGxpbmtGbnNbaSsrXVxuICAgICAgLy8gY2FjaGUgY2hpbGROb2RlcyBiZWZvcmUgbGlua2luZyBwYXJlbnQsIGZpeCAjNjU3XG4gICAgICB2YXIgY2hpbGROb2RlcyA9IF8udG9BcnJheShub2RlLmNoaWxkTm9kZXMpXG4gICAgICBpZiAobm9kZUxpbmtGbikge1xuICAgICAgICBub2RlTGlua0ZuKHZtLCBub2RlLCBob3N0KVxuICAgICAgfVxuICAgICAgaWYgKGNoaWxkcmVuTGlua0ZuKSB7XG4gICAgICAgIGNoaWxkcmVuTGlua0ZuKHZtLCBjaGlsZE5vZGVzLCBob3N0KVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIENoZWNrIGZvciBlbGVtZW50IGRpcmVjdGl2ZXMgKGN1c3RvbSBlbGVtZW50cyB0aGF0IHNob3VsZFxuICogYmUgcmVzb3ZsZWQgYXMgdGVybWluYWwgZGlyZWN0aXZlcykuXG4gKlxuICogQHBhcmFtIHtFbGVtZW50fSBlbFxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAqL1xuXG5mdW5jdGlvbiBjaGVja0VsZW1lbnREaXJlY3RpdmVzIChlbCwgb3B0aW9ucykge1xuICB2YXIgdGFnID0gZWwudGFnTmFtZS50b0xvd2VyQ2FzZSgpXG4gIGlmIChfLmNvbW1vblRhZ1JFLnRlc3QodGFnKSkgcmV0dXJuXG4gIHZhciBkZWYgPSByZXNvbHZlQXNzZXQob3B0aW9ucywgJ2VsZW1lbnREaXJlY3RpdmVzJywgdGFnKVxuICBpZiAoZGVmKSB7XG4gICAgcmV0dXJuIG1ha2VUZXJtaW5hbE5vZGVMaW5rRm4oZWwsIHRhZywgJycsIG9wdGlvbnMsIGRlZilcbiAgfVxufVxuXG4vKipcbiAqIENoZWNrIGlmIGFuIGVsZW1lbnQgaXMgYSBjb21wb25lbnQuIElmIHllcywgcmV0dXJuXG4gKiBhIGNvbXBvbmVudCBsaW5rIGZ1bmN0aW9uLlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gZWxcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKiBAcGFyYW0ge0Jvb2xlYW59IGhhc0F0dHJzXG4gKiBAcmV0dXJuIHtGdW5jdGlvbnx1bmRlZmluZWR9XG4gKi9cblxuZnVuY3Rpb24gY2hlY2tDb21wb25lbnQgKGVsLCBvcHRpb25zLCBoYXNBdHRycykge1xuICB2YXIgY29tcG9uZW50SWQgPSBfLmNoZWNrQ29tcG9uZW50KGVsLCBvcHRpb25zLCBoYXNBdHRycylcbiAgaWYgKGNvbXBvbmVudElkKSB7XG4gICAgdmFyIGNvbXBvbmVudExpbmtGbiA9IGZ1bmN0aW9uICh2bSwgZWwsIGhvc3QpIHtcbiAgICAgIHZtLl9iaW5kRGlyKCdjb21wb25lbnQnLCBlbCwge1xuICAgICAgICBleHByZXNzaW9uOiBjb21wb25lbnRJZFxuICAgICAgfSwgY29tcG9uZW50RGVmLCBob3N0KVxuICAgIH1cbiAgICBjb21wb25lbnRMaW5rRm4udGVybWluYWwgPSB0cnVlXG4gICAgcmV0dXJuIGNvbXBvbmVudExpbmtGblxuICB9XG59XG5cbi8qKlxuICogQ2hlY2sgYW4gZWxlbWVudCBmb3IgdGVybWluYWwgZGlyZWN0aXZlcyBpbiBmaXhlZCBvcmRlci5cbiAqIElmIGl0IGZpbmRzIG9uZSwgcmV0dXJuIGEgdGVybWluYWwgbGluayBmdW5jdGlvbi5cbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IGVsXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICogQHJldHVybiB7RnVuY3Rpb259IHRlcm1pbmFsTGlua0ZuXG4gKi9cblxuZnVuY3Rpb24gY2hlY2tUZXJtaW5hbERpcmVjdGl2ZXMgKGVsLCBvcHRpb25zKSB7XG4gIGlmIChfLmF0dHIoZWwsICdwcmUnKSAhPT0gbnVsbCkge1xuICAgIHJldHVybiBza2lwXG4gIH1cbiAgdmFyIHZhbHVlLCBkaXJOYW1lXG4gIGZvciAodmFyIGkgPSAwLCBsID0gdGVybWluYWxEaXJlY3RpdmVzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgIGRpck5hbWUgPSB0ZXJtaW5hbERpcmVjdGl2ZXNbaV1cbiAgICBpZiAoKHZhbHVlID0gXy5hdHRyKGVsLCBkaXJOYW1lKSkgIT09IG51bGwpIHtcbiAgICAgIHJldHVybiBtYWtlVGVybWluYWxOb2RlTGlua0ZuKGVsLCBkaXJOYW1lLCB2YWx1ZSwgb3B0aW9ucylcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gc2tpcCAoKSB7fVxuc2tpcC50ZXJtaW5hbCA9IHRydWVcblxuLyoqXG4gKiBCdWlsZCBhIG5vZGUgbGluayBmdW5jdGlvbiBmb3IgYSB0ZXJtaW5hbCBkaXJlY3RpdmUuXG4gKiBBIHRlcm1pbmFsIGxpbmsgZnVuY3Rpb24gdGVybWluYXRlcyB0aGUgY3VycmVudFxuICogY29tcGlsYXRpb24gcmVjdXJzaW9uIGFuZCBoYW5kbGVzIGNvbXBpbGF0aW9uIG9mIHRoZVxuICogc3VidHJlZSBpbiB0aGUgZGlyZWN0aXZlLlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gZWxcbiAqIEBwYXJhbSB7U3RyaW5nfSBkaXJOYW1lXG4gKiBAcGFyYW0ge1N0cmluZ30gdmFsdWVcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKiBAcGFyYW0ge09iamVjdH0gW2RlZl1cbiAqIEByZXR1cm4ge0Z1bmN0aW9ufSB0ZXJtaW5hbExpbmtGblxuICovXG5cbmZ1bmN0aW9uIG1ha2VUZXJtaW5hbE5vZGVMaW5rRm4gKGVsLCBkaXJOYW1lLCB2YWx1ZSwgb3B0aW9ucywgZGVmKSB7XG4gIHZhciBkZXNjcmlwdG9yID0gZGlyUGFyc2VyLnBhcnNlKHZhbHVlKVswXVxuICAvLyBubyBuZWVkIHRvIGNhbGwgcmVzb2x2ZUFzc2V0IHNpbmNlIHRlcm1pbmFsIGRpcmVjdGl2ZXNcbiAgLy8gYXJlIGFsd2F5cyBpbnRlcm5hbFxuICBkZWYgPSBkZWYgfHwgb3B0aW9ucy5kaXJlY3RpdmVzW2Rpck5hbWVdXG4gIHZhciBmbiA9IGZ1bmN0aW9uIHRlcm1pbmFsTm9kZUxpbmtGbiAodm0sIGVsLCBob3N0KSB7XG4gICAgdm0uX2JpbmREaXIoZGlyTmFtZSwgZWwsIGRlc2NyaXB0b3IsIGRlZiwgaG9zdClcbiAgfVxuICBmbi50ZXJtaW5hbCA9IHRydWVcbiAgcmV0dXJuIGZuXG59XG5cbi8qKlxuICogQ29tcGlsZSB0aGUgZGlyZWN0aXZlcyBvbiBhbiBlbGVtZW50IGFuZCByZXR1cm4gYSBsaW5rZXIuXG4gKlxuICogQHBhcmFtIHtBcnJheXxOYW1lZE5vZGVNYXB9IGF0dHJzXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICogQHJldHVybiB7RnVuY3Rpb259XG4gKi9cblxuZnVuY3Rpb24gY29tcGlsZURpcmVjdGl2ZXMgKGF0dHJzLCBvcHRpb25zKSB7XG4gIHZhciBpID0gYXR0cnMubGVuZ3RoXG4gIHZhciBkaXJzID0gW11cbiAgdmFyIGF0dHIsIG5hbWUsIHZhbHVlLCBkaXIsIGRpck5hbWUsIGRpckRlZlxuICB3aGlsZSAoaS0tKSB7XG4gICAgYXR0ciA9IGF0dHJzW2ldXG4gICAgbmFtZSA9IGF0dHIubmFtZVxuICAgIHZhbHVlID0gYXR0ci52YWx1ZVxuICAgIGlmIChuYW1lLmluZGV4T2YoY29uZmlnLnByZWZpeCkgPT09IDApIHtcbiAgICAgIGRpck5hbWUgPSBuYW1lLnNsaWNlKGNvbmZpZy5wcmVmaXgubGVuZ3RoKVxuICAgICAgZGlyRGVmID0gcmVzb2x2ZUFzc2V0KG9wdGlvbnMsICdkaXJlY3RpdmVzJywgZGlyTmFtZSlcbiAgICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgICAgIF8uYXNzZXJ0QXNzZXQoZGlyRGVmLCAnZGlyZWN0aXZlJywgZGlyTmFtZSlcbiAgICAgIH1cbiAgICAgIGlmIChkaXJEZWYpIHtcbiAgICAgICAgZGlycy5wdXNoKHtcbiAgICAgICAgICBuYW1lOiBkaXJOYW1lLFxuICAgICAgICAgIGRlc2NyaXB0b3JzOiBkaXJQYXJzZXIucGFyc2UodmFsdWUpLFxuICAgICAgICAgIGRlZjogZGlyRGVmXG4gICAgICAgIH0pXG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChjb25maWcuaW50ZXJwb2xhdGUpIHtcbiAgICAgIGRpciA9IGNvbGxlY3RBdHRyRGlyZWN0aXZlKG5hbWUsIHZhbHVlLCBvcHRpb25zKVxuICAgICAgaWYgKGRpcikge1xuICAgICAgICBkaXJzLnB1c2goZGlyKVxuICAgICAgfVxuICAgIH1cbiAgfVxuICAvLyBzb3J0IGJ5IHByaW9yaXR5LCBMT1cgdG8gSElHSFxuICBpZiAoZGlycy5sZW5ndGgpIHtcbiAgICBkaXJzLnNvcnQoZGlyZWN0aXZlQ29tcGFyYXRvcilcbiAgICByZXR1cm4gbWFrZU5vZGVMaW5rRm4oZGlycylcbiAgfVxufVxuXG4vKipcbiAqIEJ1aWxkIGEgbGluayBmdW5jdGlvbiBmb3IgYWxsIGRpcmVjdGl2ZXMgb24gYSBzaW5nbGUgbm9kZS5cbiAqXG4gKiBAcGFyYW0ge0FycmF5fSBkaXJlY3RpdmVzXG4gKiBAcmV0dXJuIHtGdW5jdGlvbn0gZGlyZWN0aXZlc0xpbmtGblxuICovXG5cbmZ1bmN0aW9uIG1ha2VOb2RlTGlua0ZuIChkaXJlY3RpdmVzKSB7XG4gIHJldHVybiBmdW5jdGlvbiBub2RlTGlua0ZuICh2bSwgZWwsIGhvc3QpIHtcbiAgICAvLyByZXZlcnNlIGFwcGx5IGJlY2F1c2UgaXQncyBzb3J0ZWQgbG93IHRvIGhpZ2hcbiAgICB2YXIgaSA9IGRpcmVjdGl2ZXMubGVuZ3RoXG4gICAgdmFyIGRpciwgaiwga1xuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIGRpciA9IGRpcmVjdGl2ZXNbaV1cbiAgICAgIGlmIChkaXIuX2xpbmspIHtcbiAgICAgICAgLy8gY3VzdG9tIGxpbmsgZm5cbiAgICAgICAgZGlyLl9saW5rKHZtLCBlbClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGsgPSBkaXIuZGVzY3JpcHRvcnMubGVuZ3RoXG4gICAgICAgIGZvciAoaiA9IDA7IGogPCBrOyBqKyspIHtcbiAgICAgICAgICB2bS5fYmluZERpcihkaXIubmFtZSwgZWwsXG4gICAgICAgICAgICBkaXIuZGVzY3JpcHRvcnNbal0sIGRpci5kZWYsIGhvc3QpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBDaGVjayBhbiBhdHRyaWJ1dGUgZm9yIHBvdGVudGlhbCBkeW5hbWljIGJpbmRpbmdzLFxuICogYW5kIHJldHVybiBhIGRpcmVjdGl2ZSBvYmplY3QuXG4gKlxuICogU3BlY2lhbCBjYXNlOiBjbGFzcyBpbnRlcnBvbGF0aW9ucyBhcmUgdHJhbnNsYXRlZCBpbnRvXG4gKiB2LWNsYXNzIGluc3RlYWQgdi1hdHRyLCBzbyB0aGF0IGl0IGNhbiB3b3JrIHdpdGggdXNlclxuICogcHJvdmlkZWQgdi1jbGFzcyBiaW5kaW5ncy5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZVxuICogQHBhcmFtIHtTdHJpbmd9IHZhbHVlXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICogQHJldHVybiB7T2JqZWN0fVxuICovXG5cbmZ1bmN0aW9uIGNvbGxlY3RBdHRyRGlyZWN0aXZlIChuYW1lLCB2YWx1ZSwgb3B0aW9ucykge1xuICB2YXIgdG9rZW5zID0gdGV4dFBhcnNlci5wYXJzZSh2YWx1ZSlcbiAgdmFyIGlzQ2xhc3MgPSBuYW1lID09PSAnY2xhc3MnXG4gIGlmICh0b2tlbnMpIHtcbiAgICB2YXIgZGlyTmFtZSA9IGlzQ2xhc3MgPyAnY2xhc3MnIDogJ2F0dHInXG4gICAgdmFyIGRlZiA9IG9wdGlvbnMuZGlyZWN0aXZlc1tkaXJOYW1lXVxuICAgIHZhciBpID0gdG9rZW5zLmxlbmd0aFxuICAgIHZhciBhbGxPbmVUaW1lID0gdHJ1ZVxuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIHZhciB0b2tlbiA9IHRva2Vuc1tpXVxuICAgICAgaWYgKHRva2VuLnRhZyAmJiAhdG9rZW4ub25lVGltZSkge1xuICAgICAgICBhbGxPbmVUaW1lID0gZmFsc2VcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIGRlZjogZGVmLFxuICAgICAgX2xpbms6IGFsbE9uZVRpbWVcbiAgICAgICAgPyBmdW5jdGlvbiAodm0sIGVsKSB7XG4gICAgICAgICAgICBlbC5zZXRBdHRyaWJ1dGUobmFtZSwgdm0uJGludGVycG9sYXRlKHZhbHVlKSlcbiAgICAgICAgICB9XG4gICAgICAgIDogZnVuY3Rpb24gKHZtLCBlbCkge1xuICAgICAgICAgICAgdmFyIGV4cCA9IHRleHRQYXJzZXIudG9rZW5zVG9FeHAodG9rZW5zLCB2bSlcbiAgICAgICAgICAgIHZhciBkZXNjID0gaXNDbGFzc1xuICAgICAgICAgICAgICA/IGRpclBhcnNlci5wYXJzZShleHApWzBdXG4gICAgICAgICAgICAgIDogZGlyUGFyc2VyLnBhcnNlKG5hbWUgKyAnOicgKyBleHApWzBdXG4gICAgICAgICAgICBpZiAoaXNDbGFzcykge1xuICAgICAgICAgICAgICBkZXNjLl9yYXdDbGFzcyA9IHZhbHVlXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2bS5fYmluZERpcihkaXJOYW1lLCBlbCwgZGVzYywgZGVmKVxuICAgICAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBEaXJlY3RpdmUgcHJpb3JpdHkgc29ydCBjb21wYXJhdG9yXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IGFcbiAqIEBwYXJhbSB7T2JqZWN0fSBiXG4gKi9cblxuZnVuY3Rpb24gZGlyZWN0aXZlQ29tcGFyYXRvciAoYSwgYikge1xuICBhID0gYS5kZWYucHJpb3JpdHkgfHwgMFxuICBiID0gYi5kZWYucHJpb3JpdHkgfHwgMFxuICByZXR1cm4gYSA+IGIgPyAxIDogLTFcbn1cbiIsInZhciBfID0gcmVxdWlyZSgnLi4vdXRpbCcpXG5cbl8uZXh0ZW5kKGV4cG9ydHMsIHJlcXVpcmUoJy4vY29tcGlsZScpKVxuXy5leHRlbmQoZXhwb3J0cywgcmVxdWlyZSgnLi90cmFuc2NsdWRlJykpXG4iLCJ2YXIgXyA9IHJlcXVpcmUoJy4uL3V0aWwnKVxudmFyIGNvbmZpZyA9IHJlcXVpcmUoJy4uL2NvbmZpZycpXG52YXIgdGVtcGxhdGVQYXJzZXIgPSByZXF1aXJlKCcuLi9wYXJzZXJzL3RlbXBsYXRlJylcblxuLyoqXG4gKiBQcm9jZXNzIGFuIGVsZW1lbnQgb3IgYSBEb2N1bWVudEZyYWdtZW50IGJhc2VkIG9uIGFcbiAqIGluc3RhbmNlIG9wdGlvbiBvYmplY3QuIFRoaXMgYWxsb3dzIHVzIHRvIHRyYW5zY2x1ZGVcbiAqIGEgdGVtcGxhdGUgbm9kZS9mcmFnbWVudCBiZWZvcmUgdGhlIGluc3RhbmNlIGlzIGNyZWF0ZWQsXG4gKiBzbyB0aGUgcHJvY2Vzc2VkIGZyYWdtZW50IGNhbiB0aGVuIGJlIGNsb25lZCBhbmQgcmV1c2VkXG4gKiBpbiB2LXJlcGVhdC5cbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IGVsXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICogQHJldHVybiB7RWxlbWVudHxEb2N1bWVudEZyYWdtZW50fVxuICovXG5cbmV4cG9ydHMudHJhbnNjbHVkZSA9IGZ1bmN0aW9uIChlbCwgb3B0aW9ucykge1xuICAvLyBleHRyYWN0IGNvbnRhaW5lciBhdHRyaWJ1dGVzIHRvIHBhc3MgdGhlbSBkb3duXG4gIC8vIHRvIGNvbXBpbGVyLCBiZWNhdXNlIHRoZXkgbmVlZCB0byBiZSBjb21waWxlZCBpblxuICAvLyBwYXJlbnQgc2NvcGUuIHdlIGFyZSBtdXRhdGluZyB0aGUgb3B0aW9ucyBvYmplY3QgaGVyZVxuICAvLyBhc3N1bWluZyB0aGUgc2FtZSBvYmplY3Qgd2lsbCBiZSB1c2VkIGZvciBjb21waWxlXG4gIC8vIHJpZ2h0IGFmdGVyIHRoaXMuXG4gIGlmIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy5fY29udGFpbmVyQXR0cnMgPSBleHRyYWN0QXR0cnMoZWwpXG4gIH1cbiAgLy8gZm9yIHRlbXBsYXRlIHRhZ3MsIHdoYXQgd2Ugd2FudCBpcyBpdHMgY29udGVudCBhc1xuICAvLyBhIGRvY3VtZW50RnJhZ21lbnQgKGZvciBmcmFnbWVudCBpbnN0YW5jZXMpXG4gIGlmIChfLmlzVGVtcGxhdGUoZWwpKSB7XG4gICAgZWwgPSB0ZW1wbGF0ZVBhcnNlci5wYXJzZShlbClcbiAgfVxuICBpZiAob3B0aW9ucykge1xuICAgIGlmIChvcHRpb25zLl9hc0NvbXBvbmVudCAmJiAhb3B0aW9ucy50ZW1wbGF0ZSkge1xuICAgICAgb3B0aW9ucy50ZW1wbGF0ZSA9ICc8Y29udGVudD48L2NvbnRlbnQ+J1xuICAgIH1cbiAgICBpZiAob3B0aW9ucy50ZW1wbGF0ZSkge1xuICAgICAgb3B0aW9ucy5fY29udGVudCA9IF8uZXh0cmFjdENvbnRlbnQoZWwpXG4gICAgICBlbCA9IHRyYW5zY2x1ZGVUZW1wbGF0ZShlbCwgb3B0aW9ucylcbiAgICB9XG4gIH1cbiAgaWYgKGVsIGluc3RhbmNlb2YgRG9jdW1lbnRGcmFnbWVudCkge1xuICAgIC8vIGFuY2hvcnMgZm9yIGZyYWdtZW50IGluc3RhbmNlXG4gICAgLy8gcGFzc2luZyBpbiBgcGVyc2lzdDogdHJ1ZWAgdG8gYXZvaWQgdGhlbSBiZWluZ1xuICAgIC8vIGRpc2NhcmRlZCBieSBJRSBkdXJpbmcgdGVtcGxhdGUgY2xvbmluZ1xuICAgIF8ucHJlcGVuZChfLmNyZWF0ZUFuY2hvcigndi1zdGFydCcsIHRydWUpLCBlbClcbiAgICBlbC5hcHBlbmRDaGlsZChfLmNyZWF0ZUFuY2hvcigndi1lbmQnLCB0cnVlKSlcbiAgfVxuICByZXR1cm4gZWxcbn1cblxuLyoqXG4gKiBQcm9jZXNzIHRoZSB0ZW1wbGF0ZSBvcHRpb24uXG4gKiBJZiB0aGUgcmVwbGFjZSBvcHRpb24gaXMgdHJ1ZSB0aGlzIHdpbGwgc3dhcCB0aGUgJGVsLlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gZWxcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKiBAcmV0dXJuIHtFbGVtZW50fERvY3VtZW50RnJhZ21lbnR9XG4gKi9cblxuZnVuY3Rpb24gdHJhbnNjbHVkZVRlbXBsYXRlIChlbCwgb3B0aW9ucykge1xuICB2YXIgdGVtcGxhdGUgPSBvcHRpb25zLnRlbXBsYXRlXG4gIHZhciBmcmFnID0gdGVtcGxhdGVQYXJzZXIucGFyc2UodGVtcGxhdGUsIHRydWUpXG4gIGlmIChmcmFnKSB7XG4gICAgdmFyIHJlcGxhY2VyID0gZnJhZy5maXJzdENoaWxkXG4gICAgdmFyIHRhZyA9IHJlcGxhY2VyLnRhZ05hbWUgJiYgcmVwbGFjZXIudGFnTmFtZS50b0xvd2VyQ2FzZSgpXG4gICAgaWYgKG9wdGlvbnMucmVwbGFjZSkge1xuICAgICAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gICAgICBpZiAoZWwgPT09IGRvY3VtZW50LmJvZHkpIHtcbiAgICAgICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiBfLndhcm4oXG4gICAgICAgICAgJ1lvdSBhcmUgbW91bnRpbmcgYW4gaW5zdGFuY2Ugd2l0aCBhIHRlbXBsYXRlIHRvICcgK1xuICAgICAgICAgICc8Ym9keT4uIFRoaXMgd2lsbCByZXBsYWNlIDxib2R5PiBlbnRpcmVseS4gWW91ICcgK1xuICAgICAgICAgICdzaG91bGQgcHJvYmFibHkgdXNlIGByZXBsYWNlOiBmYWxzZWAgaGVyZS4nXG4gICAgICAgIClcbiAgICAgIH1cbiAgICAgIC8vIHRoZXJlIGFyZSBtYW55IGNhc2VzIHdoZXJlIHRoZSBpbnN0YW5jZSBtdXN0XG4gICAgICAvLyBiZWNvbWUgYSBmcmFnbWVudCBpbnN0YW5jZTogYmFzaWNhbGx5IGFueXRoaW5nIHRoYXRcbiAgICAgIC8vIGNhbiBjcmVhdGUgbW9yZSB0aGFuIDEgcm9vdCBub2Rlcy5cbiAgICAgIGlmIChcbiAgICAgICAgLy8gbXVsdGktY2hpbGRyZW4gdGVtcGxhdGVcbiAgICAgICAgZnJhZy5jaGlsZE5vZGVzLmxlbmd0aCA+IDEgfHxcbiAgICAgICAgLy8gbm9uLWVsZW1lbnQgdGVtcGxhdGVcbiAgICAgICAgcmVwbGFjZXIubm9kZVR5cGUgIT09IDEgfHxcbiAgICAgICAgLy8gc2luZ2xlIG5lc3RlZCBjb21wb25lbnRcbiAgICAgICAgdGFnID09PSAnY29tcG9uZW50JyB8fFxuICAgICAgICBfLnJlc29sdmVBc3NldChvcHRpb25zLCAnY29tcG9uZW50cycsIHRhZykgfHxcbiAgICAgICAgcmVwbGFjZXIuaGFzQXR0cmlidXRlKGNvbmZpZy5wcmVmaXggKyAnY29tcG9uZW50JykgfHxcbiAgICAgICAgLy8gZWxlbWVudCBkaXJlY3RpdmVcbiAgICAgICAgXy5yZXNvbHZlQXNzZXQob3B0aW9ucywgJ2VsZW1lbnREaXJlY3RpdmVzJywgdGFnKSB8fFxuICAgICAgICAvLyByZXBlYXQgYmxvY2tcbiAgICAgICAgcmVwbGFjZXIuaGFzQXR0cmlidXRlKGNvbmZpZy5wcmVmaXggKyAncmVwZWF0JylcbiAgICAgICkge1xuICAgICAgICByZXR1cm4gZnJhZ1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb3B0aW9ucy5fcmVwbGFjZXJBdHRycyA9IGV4dHJhY3RBdHRycyhyZXBsYWNlcilcbiAgICAgICAgbWVyZ2VBdHRycyhlbCwgcmVwbGFjZXIpXG4gICAgICAgIHJldHVybiByZXBsYWNlclxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBlbC5hcHBlbmRDaGlsZChmcmFnKVxuICAgICAgcmV0dXJuIGVsXG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgJiYgXy53YXJuKFxuICAgICAgJ0ludmFsaWQgdGVtcGxhdGUgb3B0aW9uOiAnICsgdGVtcGxhdGVcbiAgICApXG4gIH1cbn1cblxuLyoqXG4gKiBIZWxwZXIgdG8gZXh0cmFjdCBhIGNvbXBvbmVudCBjb250YWluZXIncyBhdHRyaWJ1dGVzXG4gKiBpbnRvIGEgcGxhaW4gb2JqZWN0IGFycmF5LlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gZWxcbiAqIEByZXR1cm4ge0FycmF5fVxuICovXG5cbmZ1bmN0aW9uIGV4dHJhY3RBdHRycyAoZWwpIHtcbiAgaWYgKGVsLm5vZGVUeXBlID09PSAxICYmIGVsLmhhc0F0dHJpYnV0ZXMoKSkge1xuICAgIHJldHVybiBfLnRvQXJyYXkoZWwuYXR0cmlidXRlcylcbiAgfVxufVxuXG4vKipcbiAqIE1lcmdlIHRoZSBhdHRyaWJ1dGVzIG9mIHR3byBlbGVtZW50cywgYW5kIG1ha2Ugc3VyZVxuICogdGhlIGNsYXNzIG5hbWVzIGFyZSBtZXJnZWQgcHJvcGVybHkuXG4gKlxuICogQHBhcmFtIHtFbGVtZW50fSBmcm9tXG4gKiBAcGFyYW0ge0VsZW1lbnR9IHRvXG4gKi9cblxuZnVuY3Rpb24gbWVyZ2VBdHRycyAoZnJvbSwgdG8pIHtcbiAgdmFyIGF0dHJzID0gZnJvbS5hdHRyaWJ1dGVzXG4gIHZhciBpID0gYXR0cnMubGVuZ3RoXG4gIHZhciBuYW1lLCB2YWx1ZVxuICB3aGlsZSAoaS0tKSB7XG4gICAgbmFtZSA9IGF0dHJzW2ldLm5hbWVcbiAgICB2YWx1ZSA9IGF0dHJzW2ldLnZhbHVlXG4gICAgaWYgKCF0by5oYXNBdHRyaWJ1dGUobmFtZSkpIHtcbiAgICAgIHRvLnNldEF0dHJpYnV0ZShuYW1lLCB2YWx1ZSlcbiAgICB9IGVsc2UgaWYgKG5hbWUgPT09ICdjbGFzcycpIHtcbiAgICAgIHZhbHVlID0gdG8uZ2V0QXR0cmlidXRlKG5hbWUpICsgJyAnICsgdmFsdWVcbiAgICAgIHRvLnNldEF0dHJpYnV0ZShuYW1lLCB2YWx1ZSlcbiAgICB9XG4gIH1cbn1cbiIsIm1vZHVsZS5leHBvcnRzID0ge1xuXG4gIC8qKlxuICAgKiBUaGUgcHJlZml4IHRvIGxvb2sgZm9yIHdoZW4gcGFyc2luZyBkaXJlY3RpdmVzLlxuICAgKlxuICAgKiBAdHlwZSB7U3RyaW5nfVxuICAgKi9cblxuICBwcmVmaXg6ICd2LScsXG5cbiAgLyoqXG4gICAqIFdoZXRoZXIgdG8gcHJpbnQgZGVidWcgbWVzc2FnZXMuXG4gICAqIEFsc28gZW5hYmxlcyBzdGFjayB0cmFjZSBmb3Igd2FybmluZ3MuXG4gICAqXG4gICAqIEB0eXBlIHtCb29sZWFufVxuICAgKi9cblxuICBkZWJ1ZzogZmFsc2UsXG5cbiAgLyoqXG4gICAqIFN0cmljdCBtb2RlLlxuICAgKiBEaXNhYmxlcyBhc3NldCBsb29rdXAgaW4gdGhlIHZpZXcgcGFyZW50IGNoYWluLlxuICAgKi9cblxuICBzdHJpY3Q6IGZhbHNlLFxuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRvIHN1cHByZXNzIHdhcm5pbmdzLlxuICAgKlxuICAgKiBAdHlwZSB7Qm9vbGVhbn1cbiAgICovXG5cbiAgc2lsZW50OiBmYWxzZSxcblxuICAvKipcbiAgICogV2hldGhlciBhbGxvdyBvYnNlcnZlciB0byBhbHRlciBkYXRhIG9iamVjdHMnXG4gICAqIF9fcHJvdG9fXy5cbiAgICpcbiAgICogQHR5cGUge0Jvb2xlYW59XG4gICAqL1xuXG4gIHByb3RvOiB0cnVlLFxuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRvIHBhcnNlIG11c3RhY2hlIHRhZ3MgaW4gdGVtcGxhdGVzLlxuICAgKlxuICAgKiBAdHlwZSB7Qm9vbGVhbn1cbiAgICovXG5cbiAgaW50ZXJwb2xhdGU6IHRydWUsXG5cbiAgLyoqXG4gICAqIFdoZXRoZXIgdG8gdXNlIGFzeW5jIHJlbmRlcmluZy5cbiAgICovXG5cbiAgYXN5bmM6IHRydWUsXG5cbiAgLyoqXG4gICAqIFdoZXRoZXIgdG8gd2FybiBhZ2FpbnN0IGVycm9ycyBjYXVnaHQgd2hlbiBldmFsdWF0aW5nXG4gICAqIGV4cHJlc3Npb25zLlxuICAgKi9cblxuICB3YXJuRXhwcmVzc2lvbkVycm9yczogdHJ1ZSxcblxuICAvKipcbiAgICogSW50ZXJuYWwgZmxhZyB0byBpbmRpY2F0ZSB0aGUgZGVsaW1pdGVycyBoYXZlIGJlZW5cbiAgICogY2hhbmdlZC5cbiAgICpcbiAgICogQHR5cGUge0Jvb2xlYW59XG4gICAqL1xuXG4gIF9kZWxpbWl0ZXJzQ2hhbmdlZDogdHJ1ZSxcblxuICAvKipcbiAgICogTGlzdCBvZiBhc3NldCB0eXBlcyB0aGF0IGEgY29tcG9uZW50IGNhbiBvd24uXG4gICAqXG4gICAqIEB0eXBlIHtBcnJheX1cbiAgICovXG5cbiAgX2Fzc2V0VHlwZXM6IFtcbiAgICAnY29tcG9uZW50JyxcbiAgICAnZGlyZWN0aXZlJyxcbiAgICAnZWxlbWVudERpcmVjdGl2ZScsXG4gICAgJ2ZpbHRlcicsXG4gICAgJ3RyYW5zaXRpb24nLFxuICAgICdwYXJ0aWFsJ1xuICBdLFxuXG4gIC8qKlxuICAgKiBwcm9wIGJpbmRpbmcgbW9kZXNcbiAgICovXG5cbiAgX3Byb3BCaW5kaW5nTW9kZXM6IHtcbiAgICBPTkVfV0FZOiAwLFxuICAgIFRXT19XQVk6IDEsXG4gICAgT05FX1RJTUU6IDJcbiAgfSxcblxuICAvKipcbiAgICogTWF4IGNpcmN1bGFyIHVwZGF0ZXMgYWxsb3dlZCBpbiBhIGJhdGNoZXIgZmx1c2ggY3ljbGUuXG4gICAqL1xuXG4gIF9tYXhVcGRhdGVDb3VudDogMTAwXG5cbn1cblxuLyoqXG4gKiBJbnRlcnBvbGF0aW9uIGRlbGltaXRlcnMuXG4gKiBXZSBuZWVkIHRvIG1hcmsgdGhlIGNoYW5nZWQgZmxhZyBzbyB0aGF0IHRoZSB0ZXh0IHBhcnNlclxuICoga25vd3MgaXQgbmVlZHMgdG8gcmVjb21waWxlIHRoZSByZWdleC5cbiAqXG4gKiBAdHlwZSB7QXJyYXk8U3RyaW5nPn1cbiAqL1xuXG52YXIgZGVsaW1pdGVycyA9IFsne3snLCAnfX0nXVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KG1vZHVsZS5leHBvcnRzLCAnZGVsaW1pdGVycycsIHtcbiAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIGRlbGltaXRlcnNcbiAgfSxcbiAgc2V0OiBmdW5jdGlvbiAodmFsKSB7XG4gICAgZGVsaW1pdGVycyA9IHZhbFxuICAgIHRoaXMuX2RlbGltaXRlcnNDaGFuZ2VkID0gdHJ1ZVxuICB9XG59KVxuIiwidmFyIF8gPSByZXF1aXJlKCcuL3V0aWwnKVxudmFyIGNvbmZpZyA9IHJlcXVpcmUoJy4vY29uZmlnJylcbnZhciBXYXRjaGVyID0gcmVxdWlyZSgnLi93YXRjaGVyJylcbnZhciB0ZXh0UGFyc2VyID0gcmVxdWlyZSgnLi9wYXJzZXJzL3RleHQnKVxudmFyIGV4cFBhcnNlciA9IHJlcXVpcmUoJy4vcGFyc2Vycy9leHByZXNzaW9uJylcblxuLyoqXG4gKiBBIGRpcmVjdGl2ZSBsaW5rcyBhIERPTSBlbGVtZW50IHdpdGggYSBwaWVjZSBvZiBkYXRhLFxuICogd2hpY2ggaXMgdGhlIHJlc3VsdCBvZiBldmFsdWF0aW5nIGFuIGV4cHJlc3Npb24uXG4gKiBJdCByZWdpc3RlcnMgYSB3YXRjaGVyIHdpdGggdGhlIGV4cHJlc3Npb24gYW5kIGNhbGxzXG4gKiB0aGUgRE9NIHVwZGF0ZSBmdW5jdGlvbiB3aGVuIGEgY2hhbmdlIGlzIHRyaWdnZXJlZC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZVxuICogQHBhcmFtIHtOb2RlfSBlbFxuICogQHBhcmFtIHtWdWV9IHZtXG4gKiBAcGFyYW0ge09iamVjdH0gZGVzY3JpcHRvclxuICogICAgICAgICAgICAgICAgIC0ge1N0cmluZ30gZXhwcmVzc2lvblxuICogICAgICAgICAgICAgICAgIC0ge1N0cmluZ30gW2FyZ11cbiAqICAgICAgICAgICAgICAgICAtIHtBcnJheTxPYmplY3Q+fSBbZmlsdGVyc11cbiAqIEBwYXJhbSB7T2JqZWN0fSBkZWYgLSBkaXJlY3RpdmUgZGVmaW5pdGlvbiBvYmplY3RcbiAqIEBwYXJhbSB7VnVlfHVuZGVmaW5lZH0gaG9zdCAtIHRyYW5zY2x1c2lvbiBob3N0IHRhcmdldFxuICogQGNvbnN0cnVjdG9yXG4gKi9cblxuZnVuY3Rpb24gRGlyZWN0aXZlIChuYW1lLCBlbCwgdm0sIGRlc2NyaXB0b3IsIGRlZiwgaG9zdCkge1xuICAvLyBwdWJsaWNcbiAgdGhpcy5uYW1lID0gbmFtZVxuICB0aGlzLmVsID0gZWxcbiAgdGhpcy52bSA9IHZtXG4gIC8vIGNvcHkgZGVzY3JpcHRvciBwcm9wc1xuICB0aGlzLnJhdyA9IGRlc2NyaXB0b3IucmF3XG4gIHRoaXMuZXhwcmVzc2lvbiA9IGRlc2NyaXB0b3IuZXhwcmVzc2lvblxuICB0aGlzLmFyZyA9IGRlc2NyaXB0b3IuYXJnXG4gIHRoaXMuZmlsdGVycyA9IGRlc2NyaXB0b3IuZmlsdGVyc1xuICAvLyBwcml2YXRlXG4gIHRoaXMuX2Rlc2NyaXB0b3IgPSBkZXNjcmlwdG9yXG4gIHRoaXMuX2hvc3QgPSBob3N0XG4gIHRoaXMuX2xvY2tlZCA9IGZhbHNlXG4gIHRoaXMuX2JvdW5kID0gZmFsc2VcbiAgdGhpcy5fbGlzdGVuZXJzID0gbnVsbFxuICAvLyBpbml0XG4gIHRoaXMuX2JpbmQoZGVmKVxufVxuXG4vKipcbiAqIEluaXRpYWxpemUgdGhlIGRpcmVjdGl2ZSwgbWl4aW4gZGVmaW5pdGlvbiBwcm9wZXJ0aWVzLFxuICogc2V0dXAgdGhlIHdhdGNoZXIsIGNhbGwgZGVmaW5pdGlvbiBiaW5kKCkgYW5kIHVwZGF0ZSgpXG4gKiBpZiBwcmVzZW50LlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBkZWZcbiAqL1xuXG5EaXJlY3RpdmUucHJvdG90eXBlLl9iaW5kID0gZnVuY3Rpb24gKGRlZikge1xuICBpZiAoXG4gICAgKHRoaXMubmFtZSAhPT0gJ2Nsb2FrJyB8fCB0aGlzLnZtLl9pc0NvbXBpbGVkKSAmJlxuICAgIHRoaXMuZWwgJiYgdGhpcy5lbC5yZW1vdmVBdHRyaWJ1dGVcbiAgKSB7XG4gICAgdGhpcy5lbC5yZW1vdmVBdHRyaWJ1dGUoY29uZmlnLnByZWZpeCArIHRoaXMubmFtZSlcbiAgfVxuICBpZiAodHlwZW9mIGRlZiA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIHRoaXMudXBkYXRlID0gZGVmXG4gIH0gZWxzZSB7XG4gICAgXy5leHRlbmQodGhpcywgZGVmKVxuICB9XG4gIHRoaXMuX3dhdGNoZXJFeHAgPSB0aGlzLmV4cHJlc3Npb25cbiAgdGhpcy5fY2hlY2tEeW5hbWljTGl0ZXJhbCgpXG4gIGlmICh0aGlzLmJpbmQpIHtcbiAgICB0aGlzLmJpbmQoKVxuICB9XG4gIGlmICh0aGlzLl93YXRjaGVyRXhwICYmXG4gICAgICAodGhpcy51cGRhdGUgfHwgdGhpcy50d29XYXkpICYmXG4gICAgICAoIXRoaXMuaXNMaXRlcmFsIHx8IHRoaXMuX2lzRHluYW1pY0xpdGVyYWwpICYmXG4gICAgICAhdGhpcy5fY2hlY2tTdGF0ZW1lbnQoKSkge1xuICAgIC8vIHdyYXBwZWQgdXBkYXRlciBmb3IgY29udGV4dFxuICAgIHZhciBkaXIgPSB0aGlzXG4gICAgdmFyIHVwZGF0ZSA9IHRoaXMuX3VwZGF0ZSA9IHRoaXMudXBkYXRlXG4gICAgICA/IGZ1bmN0aW9uICh2YWwsIG9sZFZhbCkge1xuICAgICAgICAgIGlmICghZGlyLl9sb2NrZWQpIHtcbiAgICAgICAgICAgIGRpci51cGRhdGUodmFsLCBvbGRWYWwpXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICA6IGZ1bmN0aW9uICgpIHt9IC8vIG5vb3AgaWYgbm8gdXBkYXRlIGlzIHByb3ZpZGVkXG4gICAgLy8gcHJlLXByb2Nlc3MgaG9vayBjYWxsZWQgYmVmb3JlIHRoZSB2YWx1ZSBpcyBwaXBlZFxuICAgIC8vIHRocm91Z2ggdGhlIGZpbHRlcnMuIHVzZWQgaW4gdi1yZXBlYXQuXG4gICAgdmFyIHByZVByb2Nlc3MgPSB0aGlzLl9wcmVQcm9jZXNzXG4gICAgICA/IF8uYmluZCh0aGlzLl9wcmVQcm9jZXNzLCB0aGlzKVxuICAgICAgOiBudWxsXG4gICAgdmFyIHdhdGNoZXIgPSB0aGlzLl93YXRjaGVyID0gbmV3IFdhdGNoZXIoXG4gICAgICB0aGlzLnZtLFxuICAgICAgdGhpcy5fd2F0Y2hlckV4cCxcbiAgICAgIHVwZGF0ZSwgLy8gY2FsbGJhY2tcbiAgICAgIHtcbiAgICAgICAgZmlsdGVyczogdGhpcy5maWx0ZXJzLFxuICAgICAgICB0d29XYXk6IHRoaXMudHdvV2F5LFxuICAgICAgICBkZWVwOiB0aGlzLmRlZXAsXG4gICAgICAgIHByZVByb2Nlc3M6IHByZVByb2Nlc3NcbiAgICAgIH1cbiAgICApXG4gICAgaWYgKHRoaXMuX2luaXRWYWx1ZSAhPSBudWxsKSB7XG4gICAgICB3YXRjaGVyLnNldCh0aGlzLl9pbml0VmFsdWUpXG4gICAgfSBlbHNlIGlmICh0aGlzLnVwZGF0ZSkge1xuICAgICAgdGhpcy51cGRhdGUod2F0Y2hlci52YWx1ZSlcbiAgICB9XG4gIH1cbiAgdGhpcy5fYm91bmQgPSB0cnVlXG59XG5cbi8qKlxuICogY2hlY2sgaWYgdGhpcyBpcyBhIGR5bmFtaWMgbGl0ZXJhbCBiaW5kaW5nLlxuICpcbiAqIGUuZy4gdi1jb21wb25lbnQ9XCJ7e2N1cnJlbnRWaWV3fX1cIlxuICovXG5cbkRpcmVjdGl2ZS5wcm90b3R5cGUuX2NoZWNrRHluYW1pY0xpdGVyYWwgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBleHByZXNzaW9uID0gdGhpcy5leHByZXNzaW9uXG4gIGlmIChleHByZXNzaW9uICYmIHRoaXMuaXNMaXRlcmFsKSB7XG4gICAgdmFyIHRva2VucyA9IHRleHRQYXJzZXIucGFyc2UoZXhwcmVzc2lvbilcbiAgICBpZiAodG9rZW5zKSB7XG4gICAgICB2YXIgZXhwID0gdGV4dFBhcnNlci50b2tlbnNUb0V4cCh0b2tlbnMpXG4gICAgICB0aGlzLmV4cHJlc3Npb24gPSB0aGlzLnZtLiRnZXQoZXhwKVxuICAgICAgdGhpcy5fd2F0Y2hlckV4cCA9IGV4cFxuICAgICAgdGhpcy5faXNEeW5hbWljTGl0ZXJhbCA9IHRydWVcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBDaGVjayBpZiB0aGUgZGlyZWN0aXZlIGlzIGEgZnVuY3Rpb24gY2FsbGVyXG4gKiBhbmQgaWYgdGhlIGV4cHJlc3Npb24gaXMgYSBjYWxsYWJsZSBvbmUuIElmIGJvdGggdHJ1ZSxcbiAqIHdlIHdyYXAgdXAgdGhlIGV4cHJlc3Npb24gYW5kIHVzZSBpdCBhcyB0aGUgZXZlbnRcbiAqIGhhbmRsZXIuXG4gKlxuICogZS5nLiB2LW9uPVwiY2xpY2s6IGErK1wiXG4gKlxuICogQHJldHVybiB7Qm9vbGVhbn1cbiAqL1xuXG5EaXJlY3RpdmUucHJvdG90eXBlLl9jaGVja1N0YXRlbWVudCA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIGV4cHJlc3Npb24gPSB0aGlzLmV4cHJlc3Npb25cbiAgaWYgKFxuICAgIGV4cHJlc3Npb24gJiYgdGhpcy5hY2NlcHRTdGF0ZW1lbnQgJiZcbiAgICAhZXhwUGFyc2VyLmlzU2ltcGxlUGF0aChleHByZXNzaW9uKVxuICApIHtcbiAgICB2YXIgZm4gPSBleHBQYXJzZXIucGFyc2UoZXhwcmVzc2lvbikuZ2V0XG4gICAgdmFyIHZtID0gdGhpcy52bVxuICAgIHZhciBoYW5kbGVyID0gZnVuY3Rpb24gKCkge1xuICAgICAgZm4uY2FsbCh2bSwgdm0pXG4gICAgfVxuICAgIGlmICh0aGlzLmZpbHRlcnMpIHtcbiAgICAgIGhhbmRsZXIgPSB2bS5fYXBwbHlGaWx0ZXJzKGhhbmRsZXIsIG51bGwsIHRoaXMuZmlsdGVycylcbiAgICB9XG4gICAgdGhpcy51cGRhdGUoaGFuZGxlcilcbiAgICByZXR1cm4gdHJ1ZVxuICB9XG59XG5cbi8qKlxuICogQ2hlY2sgZm9yIGFuIGF0dHJpYnV0ZSBkaXJlY3RpdmUgcGFyYW0sIGUuZy4gbGF6eVxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKi9cblxuRGlyZWN0aXZlLnByb3RvdHlwZS5fY2hlY2tQYXJhbSA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gIHZhciBwYXJhbSA9IHRoaXMuZWwuZ2V0QXR0cmlidXRlKG5hbWUpXG4gIGlmIChwYXJhbSAhPT0gbnVsbCkge1xuICAgIHRoaXMuZWwucmVtb3ZlQXR0cmlidXRlKG5hbWUpXG4gICAgcGFyYW0gPSB0aGlzLnZtLiRpbnRlcnBvbGF0ZShwYXJhbSlcbiAgfVxuICByZXR1cm4gcGFyYW1cbn1cblxuLyoqXG4gKiBTZXQgdGhlIGNvcnJlc3BvbmRpbmcgdmFsdWUgd2l0aCB0aGUgc2V0dGVyLlxuICogVGhpcyBzaG91bGQgb25seSBiZSB1c2VkIGluIHR3by13YXkgZGlyZWN0aXZlc1xuICogZS5nLiB2LW1vZGVsLlxuICpcbiAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAqIEBwdWJsaWNcbiAqL1xuXG5EaXJlY3RpdmUucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAvKiBpc3RhbmJ1bCBpZ25vcmUgZWxzZSAqL1xuICBpZiAodGhpcy50d29XYXkpIHtcbiAgICB0aGlzLl93aXRoTG9jayhmdW5jdGlvbiAoKSB7XG4gICAgICB0aGlzLl93YXRjaGVyLnNldCh2YWx1ZSlcbiAgICB9KVxuICB9IGVsc2UgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgICBfLndhcm4oXG4gICAgICAnRGlyZWN0aXZlLnNldCgpIGNhbiBvbmx5IGJlIHVzZWQgaW5zaWRlIHR3b1dheScgK1xuICAgICAgJ2RpcmVjdGl2ZXMuJ1xuICAgIClcbiAgfVxufVxuXG4vKipcbiAqIEV4ZWN1dGUgYSBmdW5jdGlvbiB3aGlsZSBwcmV2ZW50aW5nIHRoYXQgZnVuY3Rpb24gZnJvbVxuICogdHJpZ2dlcmluZyB1cGRhdGVzIG9uIHRoaXMgZGlyZWN0aXZlIGluc3RhbmNlLlxuICpcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZuXG4gKi9cblxuRGlyZWN0aXZlLnByb3RvdHlwZS5fd2l0aExvY2sgPSBmdW5jdGlvbiAoZm4pIHtcbiAgdmFyIHNlbGYgPSB0aGlzXG4gIHNlbGYuX2xvY2tlZCA9IHRydWVcbiAgZm4uY2FsbChzZWxmKVxuICBfLm5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICBzZWxmLl9sb2NrZWQgPSBmYWxzZVxuICB9KVxufVxuXG4vKipcbiAqIENvbnZlbmllbmNlIG1ldGhvZCB0aGF0IGF0dGFjaGVzIGEgRE9NIGV2ZW50IGxpc3RlbmVyXG4gKiB0byB0aGUgZGlyZWN0aXZlIGVsZW1lbnQgYW5kIGF1dG9tZXRpY2FsbHkgdGVhcnMgaXQgZG93blxuICogZHVyaW5nIHVuYmluZC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gZXZlbnRcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGhhbmRsZXJcbiAqL1xuXG5EaXJlY3RpdmUucHJvdG90eXBlLm9uID0gZnVuY3Rpb24gKGV2ZW50LCBoYW5kbGVyKSB7XG4gIF8ub24odGhpcy5lbCwgZXZlbnQsIGhhbmRsZXIpXG4gIDsodGhpcy5fbGlzdGVuZXJzIHx8ICh0aGlzLl9saXN0ZW5lcnMgPSBbXSkpXG4gICAgLnB1c2goW2V2ZW50LCBoYW5kbGVyXSlcbn1cblxuLyoqXG4gKiBUZWFyZG93biB0aGUgd2F0Y2hlciBhbmQgY2FsbCB1bmJpbmQuXG4gKi9cblxuRGlyZWN0aXZlLnByb3RvdHlwZS5fdGVhcmRvd24gPSBmdW5jdGlvbiAoKSB7XG4gIGlmICh0aGlzLl9ib3VuZCkge1xuICAgIHRoaXMuX2JvdW5kID0gZmFsc2VcbiAgICBpZiAodGhpcy51bmJpbmQpIHtcbiAgICAgIHRoaXMudW5iaW5kKClcbiAgICB9XG4gICAgaWYgKHRoaXMuX3dhdGNoZXIpIHtcbiAgICAgIHRoaXMuX3dhdGNoZXIudGVhcmRvd24oKVxuICAgIH1cbiAgICB2YXIgbGlzdGVuZXJzID0gdGhpcy5fbGlzdGVuZXJzXG4gICAgaWYgKGxpc3RlbmVycykge1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsaXN0ZW5lcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgXy5vZmYodGhpcy5lbCwgbGlzdGVuZXJzW2ldWzBdLCBsaXN0ZW5lcnNbaV1bMV0pXG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMudm0gPSB0aGlzLmVsID1cbiAgICB0aGlzLl93YXRjaGVyID0gdGhpcy5fbGlzdGVuZXJzID0gbnVsbFxuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gRGlyZWN0aXZlXG4iLCIvLyB4bGlua1xudmFyIHhsaW5rTlMgPSAnaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluaydcbnZhciB4bGlua1JFID0gL154bGluazovXG52YXIgaW5wdXRQcm9wcyA9IHtcbiAgdmFsdWU6IDEsXG4gIGNoZWNrZWQ6IDEsXG4gIHNlbGVjdGVkOiAxXG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuXG4gIHByaW9yaXR5OiA4NTAsXG5cbiAgdXBkYXRlOiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICBpZiAodGhpcy5hcmcpIHtcbiAgICAgIHRoaXMuc2V0QXR0cih0aGlzLmFyZywgdmFsdWUpXG4gICAgfSBlbHNlIGlmICh0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnKSB7XG4gICAgICB0aGlzLm9iamVjdEhhbmRsZXIodmFsdWUpXG4gICAgfVxuICB9LFxuXG4gIG9iamVjdEhhbmRsZXI6IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgIC8vIGNhY2hlIG9iamVjdCBhdHRycyBzbyB0aGF0IG9ubHkgY2hhbmdlZCBhdHRyc1xuICAgIC8vIGFyZSBhY3R1YWxseSB1cGRhdGVkLlxuICAgIHZhciBjYWNoZSA9IHRoaXMuY2FjaGUgfHwgKHRoaXMuY2FjaGUgPSB7fSlcbiAgICB2YXIgYXR0ciwgdmFsXG4gICAgZm9yIChhdHRyIGluIGNhY2hlKSB7XG4gICAgICBpZiAoIShhdHRyIGluIHZhbHVlKSkge1xuICAgICAgICB0aGlzLnNldEF0dHIoYXR0ciwgbnVsbClcbiAgICAgICAgZGVsZXRlIGNhY2hlW2F0dHJdXG4gICAgICB9XG4gICAgfVxuICAgIGZvciAoYXR0ciBpbiB2YWx1ZSkge1xuICAgICAgdmFsID0gdmFsdWVbYXR0cl1cbiAgICAgIGlmICh2YWwgIT09IGNhY2hlW2F0dHJdKSB7XG4gICAgICAgIGNhY2hlW2F0dHJdID0gdmFsXG4gICAgICAgIHRoaXMuc2V0QXR0cihhdHRyLCB2YWwpXG4gICAgICB9XG4gICAgfVxuICB9LFxuXG4gIHNldEF0dHI6IGZ1bmN0aW9uIChhdHRyLCB2YWx1ZSkge1xuICAgIGlmIChpbnB1dFByb3BzW2F0dHJdICYmIGF0dHIgaW4gdGhpcy5lbCkge1xuICAgICAgaWYgKCF0aGlzLnZhbHVlUmVtb3ZlZCkge1xuICAgICAgICB0aGlzLmVsLnJlbW92ZUF0dHJpYnV0ZShhdHRyKVxuICAgICAgICB0aGlzLnZhbHVlUmVtb3ZlZCA9IHRydWVcbiAgICAgIH1cbiAgICAgIHRoaXMuZWxbYXR0cl0gPSB2YWx1ZVxuICAgIH0gZWxzZSBpZiAodmFsdWUgIT0gbnVsbCAmJiB2YWx1ZSAhPT0gZmFsc2UpIHtcbiAgICAgIGlmICh4bGlua1JFLnRlc3QoYXR0cikpIHtcbiAgICAgICAgdGhpcy5lbC5zZXRBdHRyaWJ1dGVOUyh4bGlua05TLCBhdHRyLCB2YWx1ZSlcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuZWwuc2V0QXR0cmlidXRlKGF0dHIsIHZhbHVlKVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmVsLnJlbW92ZUF0dHJpYnV0ZShhdHRyKVxuICAgIH1cbiAgfVxufVxuIiwidmFyIF8gPSByZXF1aXJlKCcuLi91dGlsJylcbnZhciBhZGRDbGFzcyA9IF8uYWRkQ2xhc3NcbnZhciByZW1vdmVDbGFzcyA9IF8ucmVtb3ZlQ2xhc3NcblxubW9kdWxlLmV4cG9ydHMgPSB7XG5cbiAgYmluZDogZnVuY3Rpb24gKCkge1xuICAgIC8vIGludGVycG9sYXRpb25zIGxpa2UgY2xhc3M9XCJ7e2FiY319XCIgYXJlIGNvbnZlcnRlZFxuICAgIC8vIHRvIHYtY2xhc3MsIGFuZCB3ZSBuZWVkIHRvIHJlbW92ZSB0aGUgcmF3LFxuICAgIC8vIHVuaW50ZXJwb2xhdGVkIGNsYXNzTmFtZSBhdCBiaW5kaW5nIHRpbWUuXG4gICAgdmFyIHJhdyA9IHRoaXMuX2Rlc2NyaXB0b3IuX3Jhd0NsYXNzXG4gICAgaWYgKHJhdykge1xuICAgICAgdGhpcy5wcmV2S2V5cyA9IHJhdy50cmltKCkuc3BsaXQoL1xccysvKVxuICAgIH1cbiAgfSxcblxuICB1cGRhdGU6IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgIGlmICh0aGlzLmFyZykge1xuICAgICAgLy8gc2luZ2xlIHRvZ2dsZVxuICAgICAgaWYgKHZhbHVlKSB7XG4gICAgICAgIGFkZENsYXNzKHRoaXMuZWwsIHRoaXMuYXJnKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVtb3ZlQ2xhc3ModGhpcy5lbCwgdGhpcy5hcmcpXG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICh2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHRoaXMuaGFuZGxlT2JqZWN0KHN0cmluZ1RvT2JqZWN0KHZhbHVlKSlcbiAgICAgIH0gZWxzZSBpZiAoXy5pc1BsYWluT2JqZWN0KHZhbHVlKSkge1xuICAgICAgICB0aGlzLmhhbmRsZU9iamVjdCh2YWx1ZSlcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuY2xlYW51cCgpXG4gICAgICB9XG4gICAgfVxuICB9LFxuXG4gIGhhbmRsZU9iamVjdDogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgdGhpcy5jbGVhbnVwKHZhbHVlKVxuICAgIHZhciBrZXlzID0gdGhpcy5wcmV2S2V5cyA9IE9iamVjdC5rZXlzKHZhbHVlKVxuICAgIGZvciAodmFyIGkgPSAwLCBsID0ga2V5cy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgIHZhciBrZXkgPSBrZXlzW2ldXG4gICAgICBpZiAodmFsdWVba2V5XSkge1xuICAgICAgICBhZGRDbGFzcyh0aGlzLmVsLCBrZXkpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZW1vdmVDbGFzcyh0aGlzLmVsLCBrZXkpXG4gICAgICB9XG4gICAgfVxuICB9LFxuXG4gIGNsZWFudXA6IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgIGlmICh0aGlzLnByZXZLZXlzKSB7XG4gICAgICB2YXIgaSA9IHRoaXMucHJldktleXMubGVuZ3RoXG4gICAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgIHZhciBrZXkgPSB0aGlzLnByZXZLZXlzW2ldXG4gICAgICAgIGlmICghdmFsdWUgfHwgIXZhbHVlLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICByZW1vdmVDbGFzcyh0aGlzLmVsLCBrZXkpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gc3RyaW5nVG9PYmplY3QgKHZhbHVlKSB7XG4gIHZhciByZXMgPSB7fVxuICB2YXIga2V5cyA9IHZhbHVlLnRyaW0oKS5zcGxpdCgvXFxzKy8pXG4gIHZhciBpID0ga2V5cy5sZW5ndGhcbiAgd2hpbGUgKGktLSkge1xuICAgIHJlc1trZXlzW2ldXSA9IHRydWVcbiAgfVxuICByZXR1cm4gcmVzXG59XG4iLCJ2YXIgY29uZmlnID0gcmVxdWlyZSgnLi4vY29uZmlnJylcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIGJpbmQ6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgZWwgPSB0aGlzLmVsXG4gICAgdGhpcy52bS4kb25jZSgnaG9vazpjb21waWxlZCcsIGZ1bmN0aW9uICgpIHtcbiAgICAgIGVsLnJlbW92ZUF0dHJpYnV0ZShjb25maWcucHJlZml4ICsgJ2Nsb2FrJylcbiAgICB9KVxuICB9XG59XG4iLCJ2YXIgXyA9IHJlcXVpcmUoJy4uL3V0aWwnKVxudmFyIGNvbmZpZyA9IHJlcXVpcmUoJy4uL2NvbmZpZycpXG52YXIgdGVtcGxhdGVQYXJzZXIgPSByZXF1aXJlKCcuLi9wYXJzZXJzL3RlbXBsYXRlJylcblxubW9kdWxlLmV4cG9ydHMgPSB7XG5cbiAgaXNMaXRlcmFsOiB0cnVlLFxuXG4gIC8qKlxuICAgKiBTZXR1cC4gVHdvIHBvc3NpYmxlIHVzYWdlczpcbiAgICpcbiAgICogLSBzdGF0aWM6XG4gICAqICAgdi1jb21wb25lbnQ9XCJjb21wXCJcbiAgICpcbiAgICogLSBkeW5hbWljOlxuICAgKiAgIHYtY29tcG9uZW50PVwie3tjdXJyZW50Vmlld319XCJcbiAgICovXG5cbiAgYmluZDogZnVuY3Rpb24gKCkge1xuICAgIGlmICghdGhpcy5lbC5fX3Z1ZV9fKSB7XG4gICAgICAvLyBjcmVhdGUgYSByZWYgYW5jaG9yXG4gICAgICB0aGlzLmFuY2hvciA9IF8uY3JlYXRlQW5jaG9yKCd2LWNvbXBvbmVudCcpXG4gICAgICBfLnJlcGxhY2UodGhpcy5lbCwgdGhpcy5hbmNob3IpXG4gICAgICAvLyBjaGVjayBrZWVwLWFsaXZlIG9wdGlvbnMuXG4gICAgICAvLyBJZiB5ZXMsIGluc3RlYWQgb2YgZGVzdHJveWluZyB0aGUgYWN0aXZlIHZtIHdoZW5cbiAgICAgIC8vIGhpZGluZyAodi1pZikgb3Igc3dpdGNoaW5nIChkeW5hbWljIGxpdGVyYWwpIGl0LFxuICAgICAgLy8gd2Ugc2ltcGx5IHJlbW92ZSBpdCBmcm9tIHRoZSBET00gYW5kIHNhdmUgaXQgaW4gYVxuICAgICAgLy8gY2FjaGUgb2JqZWN0LCB3aXRoIGl0cyBjb25zdHJ1Y3RvciBpZCBhcyB0aGUga2V5LlxuICAgICAgdGhpcy5rZWVwQWxpdmUgPSB0aGlzLl9jaGVja1BhcmFtKCdrZWVwLWFsaXZlJykgIT0gbnVsbFxuICAgICAgLy8gd2FpdCBmb3IgZXZlbnQgYmVmb3JlIGluc2VydGlvblxuICAgICAgdGhpcy53YWl0Rm9yRXZlbnQgPSB0aGlzLl9jaGVja1BhcmFtKCd3YWl0LWZvcicpXG4gICAgICAvLyBjaGVjayByZWZcbiAgICAgIHRoaXMucmVmSUQgPSB0aGlzLl9jaGVja1BhcmFtKGNvbmZpZy5wcmVmaXggKyAncmVmJylcbiAgICAgIGlmICh0aGlzLmtlZXBBbGl2ZSkge1xuICAgICAgICB0aGlzLmNhY2hlID0ge31cbiAgICAgIH1cbiAgICAgIC8vIGNoZWNrIGlubGluZS10ZW1wbGF0ZVxuICAgICAgaWYgKHRoaXMuX2NoZWNrUGFyYW0oJ2lubGluZS10ZW1wbGF0ZScpICE9PSBudWxsKSB7XG4gICAgICAgIC8vIGV4dHJhY3QgaW5saW5lIHRlbXBsYXRlIGFzIGEgRG9jdW1lbnRGcmFnbWVudFxuICAgICAgICB0aGlzLnRlbXBsYXRlID0gXy5leHRyYWN0Q29udGVudCh0aGlzLmVsLCB0cnVlKVxuICAgICAgfVxuICAgICAgLy8gY29tcG9uZW50IHJlc29sdXRpb24gcmVsYXRlZCBzdGF0ZVxuICAgICAgdGhpcy5wZW5kaW5nQ29tcG9uZW50Q2IgPVxuICAgICAgdGhpcy5Db21wb25lbnQgPSBudWxsXG4gICAgICAvLyB0cmFuc2l0aW9uIHJlbGF0ZWQgc3RhdGVcbiAgICAgIHRoaXMucGVuZGluZ1JlbW92YWxzID0gMFxuICAgICAgdGhpcy5wZW5kaW5nUmVtb3ZhbENiID0gbnVsbFxuICAgICAgLy8gaWYgc3RhdGljLCBidWlsZCByaWdodCBub3cuXG4gICAgICBpZiAoIXRoaXMuX2lzRHluYW1pY0xpdGVyYWwpIHtcbiAgICAgICAgdGhpcy5yZXNvbHZlQ29tcG9uZW50KHRoaXMuZXhwcmVzc2lvbiwgXy5iaW5kKHRoaXMuaW5pdFN0YXRpYywgdGhpcykpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBjaGVjayBkeW5hbWljIGNvbXBvbmVudCBwYXJhbXNcbiAgICAgICAgdGhpcy50cmFuc01vZGUgPSB0aGlzLl9jaGVja1BhcmFtKCd0cmFuc2l0aW9uLW1vZGUnKVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nICYmIF8ud2FybihcbiAgICAgICAgJ2Nhbm5vdCBtb3VudCBjb21wb25lbnQgXCInICsgdGhpcy5leHByZXNzaW9uICsgJ1wiICcgK1xuICAgICAgICAnb24gYWxyZWFkeSBtb3VudGVkIGVsZW1lbnQ6ICcgKyB0aGlzLmVsXG4gICAgICApXG4gICAgfVxuICB9LFxuXG4gIC8qKlxuICAgKiBJbml0aWFsaXplIGEgc3RhdGljIGNvbXBvbmVudC5cbiAgICovXG5cbiAgaW5pdFN0YXRpYzogZnVuY3Rpb24gKCkge1xuICAgIC8vIHdhaXQtZm9yXG4gICAgdmFyIGFuY2hvciA9IHRoaXMuYW5jaG9yXG4gICAgdmFyIG9wdGlvbnNcbiAgICB2YXIgd2FpdEZvciA9IHRoaXMud2FpdEZvckV2ZW50XG4gICAgaWYgKHdhaXRGb3IpIHtcbiAgICAgIG9wdGlvbnMgPSB7XG4gICAgICAgIGNyZWF0ZWQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICB0aGlzLiRvbmNlKHdhaXRGb3IsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHRoaXMuJGJlZm9yZShhbmNob3IpXG4gICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB2YXIgY2hpbGQgPSB0aGlzLmJ1aWxkKG9wdGlvbnMpXG4gICAgdGhpcy5zZXRDdXJyZW50KGNoaWxkKVxuICAgIGlmICghdGhpcy53YWl0Rm9yRXZlbnQpIHtcbiAgICAgIGNoaWxkLiRiZWZvcmUoYW5jaG9yKVxuICAgIH1cbiAgfSxcblxuICAvKipcbiAgICogUHVibGljIHVwZGF0ZSwgY2FsbGVkIGJ5IHRoZSB3YXRjaGVyIGluIHRoZSBkeW5hbWljXG4gICAqIGxpdGVyYWwgc2NlbmFyaW8sIGUuZy4gdi1jb21wb25lbnQ9XCJ7e3ZpZXd9fVwiXG4gICAqL1xuXG4gIHVwZGF0ZTogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgdGhpcy5zZXRDb21wb25lbnQodmFsdWUpXG4gIH0sXG5cbiAgLyoqXG4gICAqIFN3aXRjaCBkeW5hbWljIGNvbXBvbmVudHMuIE1heSByZXNvbHZlIHRoZSBjb21wb25lbnRcbiAgICogYXN5bmNocm9ub3VzbHksIGFuZCBwZXJmb3JtIHRyYW5zaXRpb24gYmFzZWQgb25cbiAgICogc3BlY2lmaWVkIHRyYW5zaXRpb24gbW9kZS4gQWNjZXB0cyBhIGZldyBhZGRpdGlvbmFsXG4gICAqIGFyZ3VtZW50cyBzcGVjaWZpY2FsbHkgZm9yIHZ1ZS1yb3V0ZXIuXG4gICAqXG4gICAqIFRoZSBjYWxsYmFjayBpcyBjYWxsZWQgd2hlbiB0aGUgZnVsbCB0cmFuc2l0aW9uIGlzXG4gICAqIGZpbmlzaGVkLlxuICAgKlxuICAgKiBAcGFyYW0ge1N0cmluZ30gdmFsdWVcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NiXVxuICAgKi9cblxuICBzZXRDb21wb25lbnQ6IGZ1bmN0aW9uICh2YWx1ZSwgY2IpIHtcbiAgICB0aGlzLmludmFsaWRhdGVQZW5kaW5nKClcbiAgICBpZiAoIXZhbHVlKSB7XG4gICAgICAvLyBqdXN0IHJlbW92ZSBjdXJyZW50XG4gICAgICB0aGlzLnVuYnVpbGQodHJ1ZSlcbiAgICAgIHRoaXMucmVtb3ZlKHRoaXMuY2hpbGRWTSwgY2IpXG4gICAgICB0aGlzLnVuc2V0Q3VycmVudCgpXG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMucmVzb2x2ZUNvbXBvbmVudCh2YWx1ZSwgXy5iaW5kKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy51bmJ1aWxkKHRydWUpXG4gICAgICAgIHZhciBvcHRpb25zXG4gICAgICAgIHZhciBzZWxmID0gdGhpc1xuICAgICAgICB2YXIgd2FpdEZvciA9IHRoaXMud2FpdEZvckV2ZW50XG4gICAgICAgIGlmICh3YWl0Rm9yKSB7XG4gICAgICAgICAgb3B0aW9ucyA9IHtcbiAgICAgICAgICAgIGNyZWF0ZWQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgdGhpcy4kb25jZSh3YWl0Rm9yLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgc2VsZi53YWl0aW5nRm9yID0gbnVsbFxuICAgICAgICAgICAgICAgIHNlbGYudHJhbnNpdGlvbih0aGlzLCBjYilcbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGNhY2hlZCA9IHRoaXMuZ2V0Q2FjaGVkKClcbiAgICAgICAgdmFyIG5ld0NvbXBvbmVudCA9IHRoaXMuYnVpbGQob3B0aW9ucylcbiAgICAgICAgaWYgKCF3YWl0Rm9yIHx8IGNhY2hlZCkge1xuICAgICAgICAgIHRoaXMudHJhbnNpdGlvbihuZXdDb21wb25lbnQsIGNiKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMud2FpdGluZ0ZvciA9IG5ld0NvbXBvbmVudFxuICAgICAgICB9XG4gICAgICB9LCB0aGlzKSlcbiAgICB9XG4gIH0sXG5cbiAgLyoqXG4gICAqIFJlc29sdmUgdGhlIGNvbXBvbmVudCBjb25zdHJ1Y3RvciB0byB1c2Ugd2hlbiBjcmVhdGluZ1xuICAgKiB0aGUgY2hpbGQgdm0uXG4gICAqL1xuXG4gIHJlc29sdmVDb21wb25lbnQ6IGZ1bmN0aW9uIChpZCwgY2IpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXNcbiAgICB0aGlzLnBlbmRpbmdDb21wb25lbnRDYiA9IF8uY2FuY2VsbGFibGUoZnVuY3Rpb24gKENvbXBvbmVudCkge1xuICAgICAgc2VsZi5Db21wb25lbnQgPSBDb21wb25lbnRcbiAgICAgIGNiKClcbiAgICB9KVxuICAgIHRoaXMudm0uX3Jlc29sdmVDb21wb25lbnQoaWQsIHRoaXMucGVuZGluZ0NvbXBvbmVudENiKVxuICB9LFxuXG4gIC8qKlxuICAgKiBXaGVuIHRoZSBjb21wb25lbnQgY2hhbmdlcyBvciB1bmJpbmRzIGJlZm9yZSBhbiBhc3luY1xuICAgKiBjb25zdHJ1Y3RvciBpcyByZXNvbHZlZCwgd2UgbmVlZCB0byBpbnZhbGlkYXRlIGl0c1xuICAgKiBwZW5kaW5nIGNhbGxiYWNrLlxuICAgKi9cblxuICBpbnZhbGlkYXRlUGVuZGluZzogZnVuY3Rpb24gKCkge1xuICAgIGlmICh0aGlzLnBlbmRpbmdDb21wb25lbnRDYikge1xuICAgICAgdGhpcy5wZW5kaW5nQ29tcG9uZW50Q2IuY2FuY2VsKClcbiAgICAgIHRoaXMucGVuZGluZ0NvbXBvbmVudENiID0gbnVsbFxuICAgIH1cbiAgfSxcblxuICAvKipcbiAgICogSW5zdGFudGlhdGUvaW5zZXJ0IGEgbmV3IGNoaWxkIHZtLlxuICAgKiBJZiBrZWVwIGFsaXZlIGFuZCBoYXMgY2FjaGVkIGluc3RhbmNlLCBpbnNlcnQgdGhhdFxuICAgKiBpbnN0YW5jZTsgb3RoZXJ3aXNlIGJ1aWxkIGEgbmV3IG9uZSBhbmQgY2FjaGUgaXQuXG4gICAqXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbZXh0cmFPcHRpb25zXVxuICAgKiBAcmV0dXJuIHtWdWV9IC0gdGhlIGNyZWF0ZWQgaW5zdGFuY2VcbiAgICovXG5cbiAgYnVpbGQ6IGZ1bmN0aW9uIChleHRyYU9wdGlvbnMpIHtcbiAgICB2YXIgY2FjaGVkID0gdGhpcy5nZXRDYWNoZWQoKVxuICAgIGlmIChjYWNoZWQpIHtcbiAgICAgIHJldHVybiBjYWNoZWRcbiAgICB9XG4gICAgaWYgKHRoaXMuQ29tcG9uZW50KSB7XG4gICAgICAvLyBkZWZhdWx0IG9wdGlvbnNcbiAgICAgIHZhciBvcHRpb25zID0ge1xuICAgICAgICBlbDogdGVtcGxhdGVQYXJzZXIuY2xvbmUodGhpcy5lbCksXG4gICAgICAgIHRlbXBsYXRlOiB0aGlzLnRlbXBsYXRlLFxuICAgICAgICAvLyBpZiBubyBpbmxpbmUtdGVtcGxhdGUsIHRoZW4gdGhlIGNvbXBpbGVkXG4gICAgICAgIC8vIGxpbmtlciBjYW4gYmUgY2FjaGVkIGZvciBiZXR0ZXIgcGVyZm9ybWFuY2UuXG4gICAgICAgIF9saW5rZXJDYWNoYWJsZTogIXRoaXMudGVtcGxhdGUsXG4gICAgICAgIF9hc0NvbXBvbmVudDogdHJ1ZSxcbiAgICAgICAgX2lzUm91dGVyVmlldzogdGhpcy5faXNSb3V0ZXJWaWV3LFxuICAgICAgICBfY29udGV4dDogdGhpcy52bVxuICAgICAgfVxuICAgICAgLy8gZXh0cmEgb3B0aW9uc1xuICAgICAgaWYgKGV4dHJhT3B0aW9ucykge1xuICAgICAgICBfLmV4dGVuZChvcHRpb25zLCBleHRyYU9wdGlvbnMpXG4gICAgICB9XG4gICAgICB2YXIgcGFyZW50ID0gdGhpcy5faG9zdCB8fCB0aGlzLnZtXG4gICAgICB2YXIgY2hpbGQgPSBwYXJlbnQuJGFkZENoaWxkKG9wdGlvbnMsIHRoaXMuQ29tcG9uZW50KVxuICAgICAgaWYgKHRoaXMua2VlcEFsaXZlKSB7XG4gICAgICAgIHRoaXMuY2FjaGVbdGhpcy5Db21wb25lbnQuY2lkXSA9IGNoaWxkXG4gICAgICB9XG4gICAgICByZXR1cm4gY2hpbGRcbiAgICB9XG4gIH0sXG5cbiAgLyoqXG4gICAqIFRyeSB0byBnZXQgYSBjYWNoZWQgaW5zdGFuY2Ugb2YgdGhlIGN1cnJlbnQgY29tcG9uZW50LlxuICAgKlxuICAgKiBAcmV0dXJuIHtWdWV8dW5kZWZpbmVkfVxuICAgKi9cblxuICBnZXRDYWNoZWQ6IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5rZWVwQWxpdmUgJiYgdGhpcy5jYWNoZVt0aGlzLkNvbXBvbmVudC5jaWRdXG4gIH0sXG5cbiAgLyoqXG4gICAqIFRlYXJkb3duIHRoZSBjdXJyZW50IGNoaWxkLCBidXQgZGVmZXJzIGNsZWFudXAgc29cbiAgICogdGhhdCB3ZSBjYW4gc2VwYXJhdGUgdGhlIGRlc3Ryb3kgYW5kIHJlbW92YWwgc3RlcHMuXG4gICAqXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gZGVmZXJcbiAgICovXG5cbiAgdW5idWlsZDogZnVuY3Rpb24gKGRlZmVyKSB7XG4gICAgaWYgKHRoaXMud2FpdGluZ0Zvcikge1xuICAgICAgdGhpcy53YWl0aW5nRm9yLiRkZXN0cm95KClcbiAgICAgIHRoaXMud2FpdGluZ0ZvciA9IG51bGxcbiAgICB9XG4gICAgdmFyIGNoaWxkID0gdGhpcy5jaGlsZFZNXG4gICAgaWYgKCFjaGlsZCB8fCB0aGlzLmtlZXBBbGl2ZSkge1xuICAgICAgcmV0dXJuXG4gICAgfVxuICAgIC8vIHRoZSBzb2xlIHB1cnBvc2Ugb2YgYGRlZmVyQ2xlYW51cGAgaXMgc28gdGhhdCB3ZSBjYW5cbiAgICAvLyBcImRlYWN0aXZhdGVcIiB0aGUgdm0gcmlnaHQgbm93IGFuZCBwZXJmb3JtIERPTSByZW1vdmFsXG4gICAgLy8gbGF0ZXIuXG4gICAgY2hpbGQuJGRlc3Ryb3koZmFsc2UsIGRlZmVyKVxuICB9LFxuXG4gIC8qKlxuICAgKiBSZW1vdmUgY3VycmVudCBkZXN0cm95ZWQgY2hpbGQgYW5kIG1hbnVhbGx5IGRvXG4gICAqIHRoZSBjbGVhbnVwIGFmdGVyIHJlbW92YWwuXG4gICAqXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGNiXG4gICAqL1xuXG4gIHJlbW92ZTogZnVuY3Rpb24gKGNoaWxkLCBjYikge1xuICAgIHZhciBrZWVwQWxpdmUgPSB0aGlzLmtlZXBBbGl2ZVxuICAgIGlmIChjaGlsZCkge1xuICAgICAgLy8gd2UgbWF5IGhhdmUgYSBjb21wb25lbnQgc3dpdGNoIHdoZW4gYSBwcmV2aW91c1xuICAgICAgLy8gY29tcG9uZW50IGlzIHN0aWxsIGJlaW5nIHRyYW5zaXRpb25lZCBvdXQuXG4gICAgICAvLyB3ZSB3YW50IHRvIHRyaWdnZXIgb25seSBvbmUgbGFzdGVzdCBpbnNlcnRpb24gY2JcbiAgICAgIC8vIHdoZW4gdGhlIGV4aXN0aW5nIHRyYW5zaXRpb24gZmluaXNoZXMuICgjMTExOSlcbiAgICAgIHRoaXMucGVuZGluZ1JlbW92YWxzKytcbiAgICAgIHRoaXMucGVuZGluZ1JlbW92YWxDYiA9IGNiXG4gICAgICB2YXIgc2VsZiA9IHRoaXNcbiAgICAgIGNoaWxkLiRyZW1vdmUoZnVuY3Rpb24gKCkge1xuICAgICAgICBzZWxmLnBlbmRpbmdSZW1vdmFscy0tXG4gICAgICAgIGlmICgha2VlcEFsaXZlKSBjaGlsZC5fY2xlYW51cCgpXG4gICAgICAgIGlmICghc2VsZi5wZW5kaW5nUmVtb3ZhbHMgJiYgc2VsZi5wZW5kaW5nUmVtb3ZhbENiKSB7XG4gICAgICAgICAgc2VsZi5wZW5kaW5nUmVtb3ZhbENiKClcbiAgICAgICAgICBzZWxmLnBlbmRpbmdSZW1vdmFsQ2IgPSBudWxsXG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgfSBlbHNlIGlmIChjYikge1xuICAgICAgY2IoKVxuICAgIH1cbiAgfSxcblxuICAvKipcbiAgICogQWN0dWFsbHkgc3dhcCB0aGUgY29tcG9uZW50cywgZGVwZW5kaW5nIG9uIHRoZVxuICAgKiB0cmFuc2l0aW9uIG1vZGUuIERlZmF1bHRzIHRvIHNpbXVsdGFuZW91cy5cbiAgICpcbiAgICogQHBhcmFtIHtWdWV9IHRhcmdldFxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2JdXG4gICAqL1xuXG4gIHRyYW5zaXRpb246IGZ1bmN0aW9uICh0YXJnZXQsIGNiKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzXG4gICAgdmFyIGN1cnJlbnQgPSB0aGlzLmNoaWxkVk1cbiAgICB0aGlzLnNldEN1cnJlbnQodGFyZ2V0KVxuICAgIHN3aXRjaCAoc2VsZi50cmFuc01vZGUpIHtcbiAgICAgIGNhc2UgJ2luLW91dCc6XG4gICAgICAgIHRhcmdldC4kYmVmb3JlKHNlbGYuYW5jaG9yLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgc2VsZi5yZW1vdmUoY3VycmVudCwgY2IpXG4gICAgICAgIH0pXG4gICAgICAgIGJyZWFrXG4gICAgICBjYXNlICdvdXQtaW4nOlxuICAgICAgICBzZWxmLnJlbW92ZShjdXJyZW50LCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgdGFyZ2V0LiRiZWZvcmUoc2VsZi5hbmNob3IsIGNiKVxuICAgICAgICB9KVxuICAgICAgICBicmVha1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgc2VsZi5yZW1vdmUoY3VycmVudClcbiAgICAgICAgdGFyZ2V0LiRiZWZvcmUoc2VsZi5hbmNob3IsIGNiKVxuICAgIH1cbiAgfSxcblxuICAvKipcbiAgICogU2V0IGNoaWxkVk0gYW5kIHBhcmVudCByZWZcbiAgICovXG5cbiAgc2V0Q3VycmVudDogZnVuY3Rpb24gKGNoaWxkKSB7XG4gICAgdGhpcy51bnNldEN1cnJlbnQoKVxuICAgIHRoaXMuY2hpbGRWTSA9IGNoaWxkXG4gICAgdmFyIHJlZklEID0gY2hpbGQuX3JlZklEIHx8IHRoaXMucmVmSURcbiAgICBpZiAocmVmSUQpIHtcbiAgICAgIHRoaXMudm0uJFtyZWZJRF0gPSBjaGlsZFxuICAgIH1cbiAgfSxcblxuICAvKipcbiAgICogVW5zZXQgY2hpbGRWTSBhbmQgcGFyZW50IHJlZlxuICAgKi9cblxuICB1bnNldEN1cnJlbnQ6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgY2hpbGQgPSB0aGlzLmNoaWxkVk1cbiAgICB0aGlzLmNoaWxkVk0gPSBudWxsXG4gICAgdmFyIHJlZklEID0gKGNoaWxkICYmIGNoaWxkLl9yZWZJRCkgfHwgdGhpcy5yZWZJRFxuICAgIGlmIChyZWZJRCkge1xuICAgICAgdGhpcy52bS4kW3JlZklEXSA9IG51bGxcbiAgICB9XG4gIH0sXG5cbiAgLyoqXG4gICAqIFVuYmluZC5cbiAgICovXG5cbiAgdW5iaW5kOiBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5pbnZhbGlkYXRlUGVuZGluZygpXG4gICAgLy8gRG8gbm90IGRlZmVyIGNsZWFudXAgd2hlbiB1bmJpbmRpbmdcbiAgICB0aGlzLnVuYnVpbGQoKVxuICAgIHRoaXMudW5zZXRDdXJyZW50KClcbiAgICAvLyBkZXN0cm95IGFsbCBrZWVwLWFsaXZlIGNhY2hlZCBpbnN0YW5jZXNcbiAgICBpZiAodGhpcy5jYWNoZSkge1xuICAgICAgZm9yICh2YXIga2V5IGluIHRoaXMuY2FjaGUpIHtcbiAgICAgICAgdGhpcy5jYWNoZVtrZXldLiRkZXN0cm95KClcbiAgICAgIH1cbiAgICAgIHRoaXMuY2FjaGUgPSBudWxsXG4gICAgfVxuICB9XG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHtcblxuICBpc0xpdGVyYWw6IHRydWUsXG5cbiAgYmluZDogZnVuY3Rpb24gKCkge1xuICAgIHRoaXMudm0uJCRbdGhpcy5leHByZXNzaW9uXSA9IHRoaXMuZWxcbiAgfSxcblxuICB1bmJpbmQ6IGZ1bmN0aW9uICgpIHtcbiAgICBkZWxldGUgdGhpcy52bS4kJFt0aGlzLmV4cHJlc3Npb25dXG4gIH1cbn1cbiIsInZhciBfID0gcmVxdWlyZSgnLi4vdXRpbCcpXG52YXIgdGVtcGxhdGVQYXJzZXIgPSByZXF1aXJlKCcuLi9wYXJzZXJzL3RlbXBsYXRlJylcblxubW9kdWxlLmV4cG9ydHMgPSB7XG5cbiAgYmluZDogZnVuY3Rpb24gKCkge1xuICAgIC8vIGEgY29tbWVudCBub2RlIG1lYW5zIHRoaXMgaXMgYSBiaW5kaW5nIGZvclxuICAgIC8vIHt7eyBpbmxpbmUgdW5lc2NhcGVkIGh0bWwgfX19XG4gICAgaWYgKHRoaXMuZWwubm9kZVR5cGUgPT09IDgpIHtcbiAgICAgIC8vIGhvbGQgbm9kZXNcbiAgICAgIHRoaXMubm9kZXMgPSBbXVxuICAgICAgLy8gcmVwbGFjZSB0aGUgcGxhY2Vob2xkZXIgd2l0aCBwcm9wZXIgYW5jaG9yXG4gICAgICB0aGlzLmFuY2hvciA9IF8uY3JlYXRlQW5jaG9yKCd2LWh0bWwnKVxuICAgICAgXy5yZXBsYWNlKHRoaXMuZWwsIHRoaXMuYW5jaG9yKVxuICAgIH1cbiAgfSxcblxuICB1cGRhdGU6IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgIHZhbHVlID0gXy50b1N0cmluZyh2YWx1ZSlcbiAgICBpZiAodGhpcy5ub2Rlcykge1xuICAgICAgdGhpcy5zd2FwKHZhbHVlKVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmVsLmlubmVySFRNTCA9IHZhbHVlXG4gICAgfVxuICB9LFxuXG4gIHN3YXA6IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgIC8vIHJlbW92ZSBvbGQgbm9kZXNcbiAgICB2YXIgaSA9IHRoaXMubm9kZXMubGVuZ3RoXG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgXy5yZW1vdmUodGhpcy5ub2Rlc1tpXSlcbiAgICB9XG4gICAgLy8gY29udmVydCBuZXcgdmFsdWUgdG8gYSBmcmFnbWVudFxuICAgIC8vIGRvIG5vdCBhdHRlbXB0IHRvIHJldHJpZXZlIGZyb20gaWQgc2VsZWN0b3JcbiAgICB2YXIgZnJhZyA9IHRlbXBsYXRlUGFyc2VyLnBhcnNlKHZhbHVlLCB0cnVlLCB0cnVlKVxuICAgIC8vIHNhdmUgYSByZWZlcmVuY2UgdG8gdGhlc2Ugbm9kZXMgc28gd2UgY2FuIHJlbW92ZSBsYXRlclxuICAgIHRoaXMubm9kZXMgPSBfLnRvQXJyYXkoZnJhZy5jaGlsZE5vZGVzKVxuICAgIF8uYmVmb3JlKGZyYWcsIHRoaXMuYW5jaG9yKVxuICB9XG59XG4iLCJ2YXIgXyA9IHJlcXVpcmUoJy4uL3V0aWwnKVxudmFyIGNvbXBpbGVyID0gcmVxdWlyZSgnLi4vY29tcGlsZXInKVxudmFyIHRlbXBsYXRlUGFyc2VyID0gcmVxdWlyZSgnLi4vcGFyc2Vycy90ZW1wbGF0ZScpXG52YXIgdHJhbnNpdGlvbiA9IHJlcXVpcmUoJy4uL3RyYW5zaXRpb24nKVxudmFyIENhY2hlID0gcmVxdWlyZSgnLi4vY2FjaGUnKVxudmFyIGNhY2hlID0gbmV3IENhY2hlKDEwMDApXG5cbm1vZHVsZS5leHBvcnRzID0ge1xuXG4gIGJpbmQ6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgZWwgPSB0aGlzLmVsXG4gICAgaWYgKCFlbC5fX3Z1ZV9fKSB7XG4gICAgICB0aGlzLnN0YXJ0ID0gXy5jcmVhdGVBbmNob3IoJ3YtaWYtc3RhcnQnKVxuICAgICAgdGhpcy5lbmQgPSBfLmNyZWF0ZUFuY2hvcigndi1pZi1lbmQnKVxuICAgICAgXy5yZXBsYWNlKGVsLCB0aGlzLmVuZClcbiAgICAgIF8uYmVmb3JlKHRoaXMuc3RhcnQsIHRoaXMuZW5kKVxuICAgICAgaWYgKF8uaXNUZW1wbGF0ZShlbCkpIHtcbiAgICAgICAgdGhpcy50ZW1wbGF0ZSA9IHRlbXBsYXRlUGFyc2VyLnBhcnNlKGVsLCB0cnVlKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy50ZW1wbGF0ZSA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKVxuICAgICAgICB0aGlzLnRlbXBsYXRlLmFwcGVuZENoaWxkKHRlbXBsYXRlUGFyc2VyLmNsb25lKGVsKSlcbiAgICAgIH1cbiAgICAgIC8vIGNvbXBpbGUgdGhlIG5lc3RlZCBwYXJ0aWFsXG4gICAgICB2YXIgY2FjaGVJZCA9ICh0aGlzLnZtLmNvbnN0cnVjdG9yLmNpZCB8fCAnJykgKyBlbC5vdXRlckhUTUxcbiAgICAgIHRoaXMubGlua2VyID0gY2FjaGUuZ2V0KGNhY2hlSWQpXG4gICAgICBpZiAoIXRoaXMubGlua2VyKSB7XG4gICAgICAgIHRoaXMubGlua2VyID0gY29tcGlsZXIuY29tcGlsZShcbiAgICAgICAgICB0aGlzLnRlbXBsYXRlLFxuICAgICAgICAgIHRoaXMudm0uJG9wdGlvbnMsXG4gICAgICAgICAgdHJ1ZSAvLyBwYXJ0aWFsXG4gICAgICAgIClcbiAgICAgICAgY2FjaGUucHV0KGNhY2hlSWQsIHRoaXMubGlua2VyKVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nICYmIF8ud2FybihcbiAgICAgICAgJ3YtaWY9XCInICsgdGhpcy5leHByZXNzaW9uICsgJ1wiIGNhbm5vdCBiZSAnICtcbiAgICAgICAgJ3VzZWQgb24gYW4gaW5zdGFuY2Ugcm9vdCBlbGVtZW50LidcbiAgICAgIClcbiAgICAgIHRoaXMuaW52YWxpZCA9IHRydWVcbiAgICB9XG4gIH0sXG5cbiAgdXBkYXRlOiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICBpZiAodGhpcy5pbnZhbGlkKSByZXR1cm5cbiAgICBpZiAodmFsdWUpIHtcbiAgICAgIC8vIGF2b2lkIGR1cGxpY2F0ZSBjb21waWxlcywgc2luY2UgdXBkYXRlKCkgY2FuIGJlXG4gICAgICAvLyBjYWxsZWQgd2l0aCBkaWZmZXJlbnQgdHJ1dGh5IHZhbHVlc1xuICAgICAgaWYgKCF0aGlzLnVubGluaykge1xuICAgICAgICB0aGlzLmxpbmsoXG4gICAgICAgICAgdGVtcGxhdGVQYXJzZXIuY2xvbmUodGhpcy50ZW1wbGF0ZSksXG4gICAgICAgICAgdGhpcy5saW5rZXJcbiAgICAgICAgKVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnRlYXJkb3duKClcbiAgICB9XG4gIH0sXG5cbiAgbGluazogZnVuY3Rpb24gKGZyYWcsIGxpbmtlcikge1xuICAgIHZhciB2bSA9IHRoaXMudm1cbiAgICB0aGlzLnVubGluayA9IGxpbmtlcih2bSwgZnJhZywgdGhpcy5faG9zdCAvKiBpbXBvcnRhbnQgKi8pXG4gICAgdHJhbnNpdGlvbi5ibG9ja0FwcGVuZChmcmFnLCB0aGlzLmVuZCwgdm0pXG4gICAgLy8gY2FsbCBhdHRhY2hlZCBmb3IgYWxsIHRoZSBjaGlsZCBjb21wb25lbnRzIGNyZWF0ZWRcbiAgICAvLyBkdXJpbmcgdGhlIGNvbXBpbGF0aW9uXG4gICAgaWYgKF8uaW5Eb2Modm0uJGVsKSkge1xuICAgICAgdmFyIGNoaWxkcmVuID0gdGhpcy5nZXRDb250YWluZWRDb21wb25lbnRzKClcbiAgICAgIGlmIChjaGlsZHJlbikgY2hpbGRyZW4uZm9yRWFjaChjYWxsQXR0YWNoKVxuICAgIH1cbiAgfSxcblxuICB0ZWFyZG93bjogZnVuY3Rpb24gKCkge1xuICAgIGlmICghdGhpcy51bmxpbmspIHJldHVyblxuICAgIC8vIGNvbGxlY3QgY2hpbGRyZW4gYmVmb3JlaGFuZFxuICAgIHZhciBjaGlsZHJlblxuICAgIGlmIChfLmluRG9jKHRoaXMudm0uJGVsKSkge1xuICAgICAgY2hpbGRyZW4gPSB0aGlzLmdldENvbnRhaW5lZENvbXBvbmVudHMoKVxuICAgIH1cbiAgICB0cmFuc2l0aW9uLmJsb2NrUmVtb3ZlKHRoaXMuc3RhcnQsIHRoaXMuZW5kLCB0aGlzLnZtKVxuICAgIGlmIChjaGlsZHJlbikgY2hpbGRyZW4uZm9yRWFjaChjYWxsRGV0YWNoKVxuICAgIHRoaXMudW5saW5rKClcbiAgICB0aGlzLnVubGluayA9IG51bGxcbiAgfSxcblxuICBnZXRDb250YWluZWRDb21wb25lbnRzOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHZtID0gdGhpcy5faG9zdCB8fCB0aGlzLnZtXG4gICAgdmFyIHN0YXJ0ID0gdGhpcy5zdGFydC5uZXh0U2libGluZ1xuICAgIHZhciBlbmQgPSB0aGlzLmVuZFxuXG4gICAgZnVuY3Rpb24gY29udGFpbnMgKGMpIHtcbiAgICAgIHZhciBjdXIgPSBzdGFydFxuICAgICAgdmFyIG5leHRcbiAgICAgIHdoaWxlIChuZXh0ICE9PSBlbmQpIHtcbiAgICAgICAgbmV4dCA9IGN1ci5uZXh0U2libGluZ1xuICAgICAgICBpZiAoXG4gICAgICAgICAgY3VyID09PSBjLiRlbCB8fFxuICAgICAgICAgIGN1ci5jb250YWlucyAmJiBjdXIuY29udGFpbnMoYy4kZWwpXG4gICAgICAgICkge1xuICAgICAgICAgIHJldHVybiB0cnVlXG4gICAgICAgIH1cbiAgICAgICAgY3VyID0gbmV4dFxuICAgICAgfVxuICAgICAgcmV0dXJuIGZhbHNlXG4gICAgfVxuXG4gICAgcmV0dXJuIHZtLiRjaGlsZHJlbi5sZW5ndGggJiZcbiAgICAgIHZtLiRjaGlsZHJlbi5maWx0ZXIoY29udGFpbnMpXG4gIH0sXG5cbiAgdW5iaW5kOiBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKHRoaXMudW5saW5rKSB0aGlzLnVubGluaygpXG4gIH1cblxufVxuXG5mdW5jdGlvbiBjYWxsQXR0YWNoIChjaGlsZCkge1xuICBpZiAoIWNoaWxkLl9pc0F0dGFjaGVkKSB7XG4gICAgY2hpbGQuX2NhbGxIb29rKCdhdHRhY2hlZCcpXG4gIH1cbn1cblxuZnVuY3Rpb24gY2FsbERldGFjaCAoY2hpbGQpIHtcbiAgaWYgKGNoaWxkLl9pc0F0dGFjaGVkKSB7XG4gICAgY2hpbGQuX2NhbGxIb29rKCdkZXRhY2hlZCcpXG4gIH1cbn1cbiIsIi8vIG1hbmlwdWxhdGlvbiBkaXJlY3RpdmVzXG5leHBvcnRzLnRleHQgPSByZXF1aXJlKCcuL3RleHQnKVxuZXhwb3J0cy5odG1sID0gcmVxdWlyZSgnLi9odG1sJylcbmV4cG9ydHMuYXR0ciA9IHJlcXVpcmUoJy4vYXR0cicpXG5leHBvcnRzLnNob3cgPSByZXF1aXJlKCcuL3Nob3cnKVxuZXhwb3J0c1snY2xhc3MnXSA9IHJlcXVpcmUoJy4vY2xhc3MnKVxuZXhwb3J0cy5lbCA9IHJlcXVpcmUoJy4vZWwnKVxuZXhwb3J0cy5yZWYgPSByZXF1aXJlKCcuL3JlZicpXG5leHBvcnRzLmNsb2FrID0gcmVxdWlyZSgnLi9jbG9haycpXG5leHBvcnRzLnN0eWxlID0gcmVxdWlyZSgnLi9zdHlsZScpXG5leHBvcnRzLnRyYW5zaXRpb24gPSByZXF1aXJlKCcuL3RyYW5zaXRpb24nKVxuXG4vLyBldmVudCBsaXN0ZW5lciBkaXJlY3RpdmVzXG5leHBvcnRzLm9uID0gcmVxdWlyZSgnLi9vbicpXG5leHBvcnRzLm1vZGVsID0gcmVxdWlyZSgnLi9tb2RlbCcpXG5cbi8vIGxvZ2ljIGNvbnRyb2wgZGlyZWN0aXZlc1xuZXhwb3J0cy5yZXBlYXQgPSByZXF1aXJlKCcuL3JlcGVhdCcpXG5leHBvcnRzWydpZiddID0gcmVxdWlyZSgnLi9pZicpXG5cbi8vIGludGVybmFsIGRpcmVjdGl2ZXMgdGhhdCBzaG91bGQgbm90IGJlIHVzZWQgZGlyZWN0bHlcbi8vIGJ1dCB3ZSBzdGlsbCB3YW50IHRvIGV4cG9zZSB0aGVtIGZvciBhZHZhbmNlZCB1c2FnZS5cbmV4cG9ydHMuX2NvbXBvbmVudCA9IHJlcXVpcmUoJy4vY29tcG9uZW50JylcbmV4cG9ydHMuX3Byb3AgPSByZXF1aXJlKCcuL3Byb3AnKVxuIiwidmFyIF8gPSByZXF1aXJlKCcuLi8uLi91dGlsJylcblxubW9kdWxlLmV4cG9ydHMgPSB7XG5cbiAgYmluZDogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpc1xuICAgIHZhciBlbCA9IHRoaXMuZWxcbiAgICB2YXIgdHJ1ZUV4cCA9IHRoaXMuX2NoZWNrUGFyYW0oJ3RydWUtZXhwJylcbiAgICB2YXIgZmFsc2VFeHAgPSB0aGlzLl9jaGVja1BhcmFtKCdmYWxzZS1leHAnKVxuXG4gICAgdGhpcy5fbWF0Y2hWYWx1ZSA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgaWYgKHRydWVFeHAgIT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIF8ubG9vc2VFcXVhbCh2YWx1ZSwgc2VsZi52bS4kZXZhbCh0cnVlRXhwKSlcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiAhIXZhbHVlXG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZ2V0VmFsdWUgKCkge1xuICAgICAgdmFyIHZhbCA9IGVsLmNoZWNrZWRcbiAgICAgIGlmICh2YWwgJiYgdHJ1ZUV4cCAhPT0gbnVsbCkge1xuICAgICAgICB2YWwgPSBzZWxmLnZtLiRldmFsKHRydWVFeHApXG4gICAgICB9XG4gICAgICBpZiAoIXZhbCAmJiBmYWxzZUV4cCAhPT0gbnVsbCkge1xuICAgICAgICB2YWwgPSBzZWxmLnZtLiRldmFsKGZhbHNlRXhwKVxuICAgICAgfVxuICAgICAgcmV0dXJuIHZhbFxuICAgIH1cblxuICAgIHRoaXMub24oJ2NoYW5nZScsIGZ1bmN0aW9uICgpIHtcbiAgICAgIHNlbGYuc2V0KGdldFZhbHVlKCkpXG4gICAgfSlcblxuICAgIGlmIChlbC5jaGVja2VkKSB7XG4gICAgICB0aGlzLl9pbml0VmFsdWUgPSBnZXRWYWx1ZSgpXG4gICAgfVxuICB9LFxuXG4gIHVwZGF0ZTogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgdGhpcy5lbC5jaGVja2VkID0gdGhpcy5fbWF0Y2hWYWx1ZSh2YWx1ZSlcbiAgfVxufVxuIiwidmFyIF8gPSByZXF1aXJlKCcuLi8uLi91dGlsJylcblxudmFyIGhhbmRsZXJzID0ge1xuICB0ZXh0OiByZXF1aXJlKCcuL3RleHQnKSxcbiAgcmFkaW86IHJlcXVpcmUoJy4vcmFkaW8nKSxcbiAgc2VsZWN0OiByZXF1aXJlKCcuL3NlbGVjdCcpLFxuICBjaGVja2JveDogcmVxdWlyZSgnLi9jaGVja2JveCcpXG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuXG4gIHByaW9yaXR5OiA4MDAsXG4gIHR3b1dheTogdHJ1ZSxcbiAgaGFuZGxlcnM6IGhhbmRsZXJzLFxuXG4gIC8qKlxuICAgKiBQb3NzaWJsZSBlbGVtZW50czpcbiAgICogICA8c2VsZWN0PlxuICAgKiAgIDx0ZXh0YXJlYT5cbiAgICogICA8aW5wdXQgdHlwZT1cIipcIj5cbiAgICogICAgIC0gdGV4dFxuICAgKiAgICAgLSBjaGVja2JveFxuICAgKiAgICAgLSByYWRpb1xuICAgKiAgICAgLSBudW1iZXJcbiAgICogICAgIC0gVE9ETzogbW9yZSB0eXBlcyBtYXkgYmUgc3VwcGxpZWQgYXMgYSBwbHVnaW5cbiAgICovXG5cbiAgYmluZDogZnVuY3Rpb24gKCkge1xuICAgIC8vIGZyaWVuZGx5IHdhcm5pbmcuLi5cbiAgICB0aGlzLmNoZWNrRmlsdGVycygpXG4gICAgaWYgKHRoaXMuaGFzUmVhZCAmJiAhdGhpcy5oYXNXcml0ZSkge1xuICAgICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiBfLndhcm4oXG4gICAgICAgICdJdCBzZWVtcyB5b3UgYXJlIHVzaW5nIGEgcmVhZC1vbmx5IGZpbHRlciB3aXRoICcgK1xuICAgICAgICAndi1tb2RlbC4gWW91IG1pZ2h0IHdhbnQgdG8gdXNlIGEgdHdvLXdheSBmaWx0ZXIgJyArXG4gICAgICAgICd0byBlbnN1cmUgY29ycmVjdCBiZWhhdmlvci4nXG4gICAgICApXG4gICAgfVxuICAgIHZhciBlbCA9IHRoaXMuZWxcbiAgICB2YXIgdGFnID0gZWwudGFnTmFtZVxuICAgIHZhciBoYW5kbGVyXG4gICAgaWYgKHRhZyA9PT0gJ0lOUFVUJykge1xuICAgICAgaGFuZGxlciA9IGhhbmRsZXJzW2VsLnR5cGVdIHx8IGhhbmRsZXJzLnRleHRcbiAgICB9IGVsc2UgaWYgKHRhZyA9PT0gJ1NFTEVDVCcpIHtcbiAgICAgIGhhbmRsZXIgPSBoYW5kbGVycy5zZWxlY3RcbiAgICB9IGVsc2UgaWYgKHRhZyA9PT0gJ1RFWFRBUkVBJykge1xuICAgICAgaGFuZGxlciA9IGhhbmRsZXJzLnRleHRcbiAgICB9IGVsc2Uge1xuICAgICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiBfLndhcm4oXG4gICAgICAgICd2LW1vZGVsIGRvZXMgbm90IHN1cHBvcnQgZWxlbWVudCB0eXBlOiAnICsgdGFnXG4gICAgICApXG4gICAgICByZXR1cm5cbiAgICB9XG4gICAgZWwuX192X21vZGVsID0gdGhpc1xuICAgIGhhbmRsZXIuYmluZC5jYWxsKHRoaXMpXG4gICAgdGhpcy51cGRhdGUgPSBoYW5kbGVyLnVwZGF0ZVxuICAgIHRoaXMuX3VuYmluZCA9IGhhbmRsZXIudW5iaW5kXG4gIH0sXG5cbiAgLyoqXG4gICAqIENoZWNrIHJlYWQvd3JpdGUgZmlsdGVyIHN0YXRzLlxuICAgKi9cblxuICBjaGVja0ZpbHRlcnM6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgZmlsdGVycyA9IHRoaXMuZmlsdGVyc1xuICAgIGlmICghZmlsdGVycykgcmV0dXJuXG4gICAgdmFyIGkgPSBmaWx0ZXJzLmxlbmd0aFxuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIHZhciBmaWx0ZXIgPSBfLnJlc29sdmVBc3NldCh0aGlzLnZtLiRvcHRpb25zLCAnZmlsdGVycycsIGZpbHRlcnNbaV0ubmFtZSlcbiAgICAgIGlmICh0eXBlb2YgZmlsdGVyID09PSAnZnVuY3Rpb24nIHx8IGZpbHRlci5yZWFkKSB7XG4gICAgICAgIHRoaXMuaGFzUmVhZCA9IHRydWVcbiAgICAgIH1cbiAgICAgIGlmIChmaWx0ZXIud3JpdGUpIHtcbiAgICAgICAgdGhpcy5oYXNXcml0ZSA9IHRydWVcbiAgICAgIH1cbiAgICB9XG4gIH0sXG5cbiAgdW5iaW5kOiBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5lbC5fX3ZfbW9kZWwgPSBudWxsXG4gICAgdGhpcy5fdW5iaW5kICYmIHRoaXMuX3VuYmluZCgpXG4gIH1cbn1cbiIsInZhciBfID0gcmVxdWlyZSgnLi4vLi4vdXRpbCcpXG5cbm1vZHVsZS5leHBvcnRzID0ge1xuXG4gIGJpbmQ6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXNcbiAgICB2YXIgZWwgPSB0aGlzLmVsXG4gICAgdmFyIG51bWJlciA9IHRoaXMuX2NoZWNrUGFyYW0oJ251bWJlcicpICE9IG51bGxcbiAgICB2YXIgZXhwcmVzc2lvbiA9IHRoaXMuX2NoZWNrUGFyYW0oJ2V4cCcpXG5cbiAgICB0aGlzLmdldFZhbHVlID0gZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIHZhbCA9IGVsLnZhbHVlXG4gICAgICBpZiAobnVtYmVyKSB7XG4gICAgICAgIHZhbCA9IF8udG9OdW1iZXIodmFsKVxuICAgICAgfSBlbHNlIGlmIChleHByZXNzaW9uICE9PSBudWxsKSB7XG4gICAgICAgIHZhbCA9IHNlbGYudm0uJGV2YWwoZXhwcmVzc2lvbilcbiAgICAgIH1cbiAgICAgIHJldHVybiB2YWxcbiAgICB9XG5cbiAgICB0aGlzLm9uKCdjaGFuZ2UnLCBmdW5jdGlvbiAoKSB7XG4gICAgICBzZWxmLnNldChzZWxmLmdldFZhbHVlKCkpXG4gICAgfSlcblxuICAgIGlmIChlbC5jaGVja2VkKSB7XG4gICAgICB0aGlzLl9pbml0VmFsdWUgPSB0aGlzLmdldFZhbHVlKClcbiAgICB9XG4gIH0sXG5cbiAgdXBkYXRlOiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICB0aGlzLmVsLmNoZWNrZWQgPSBfLmxvb3NlRXF1YWwodmFsdWUsIHRoaXMuZ2V0VmFsdWUoKSlcbiAgfVxufVxuIiwidmFyIF8gPSByZXF1aXJlKCcuLi8uLi91dGlsJylcbnZhciBXYXRjaGVyID0gcmVxdWlyZSgnLi4vLi4vd2F0Y2hlcicpXG52YXIgZGlyUGFyc2VyID0gcmVxdWlyZSgnLi4vLi4vcGFyc2Vycy9kaXJlY3RpdmUnKVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcblxuICBiaW5kOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzXG4gICAgdmFyIGVsID0gdGhpcy5lbFxuXG4gICAgLy8gbWV0aG9kIHRvIGZvcmNlIHVwZGF0ZSBET00gdXNpbmcgbGF0ZXN0IHZhbHVlLlxuICAgIHRoaXMuZm9yY2VVcGRhdGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICBpZiAoc2VsZi5fd2F0Y2hlcikge1xuICAgICAgICBzZWxmLnVwZGF0ZShzZWxmLl93YXRjaGVyLmdldCgpKVxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIGNoZWNrIG9wdGlvbnMgcGFyYW1cbiAgICB2YXIgb3B0aW9uc1BhcmFtID0gdGhpcy5fY2hlY2tQYXJhbSgnb3B0aW9ucycpXG4gICAgaWYgKG9wdGlvbnNQYXJhbSkge1xuICAgICAgaW5pdE9wdGlvbnMuY2FsbCh0aGlzLCBvcHRpb25zUGFyYW0pXG4gICAgfVxuICAgIHRoaXMubnVtYmVyID0gdGhpcy5fY2hlY2tQYXJhbSgnbnVtYmVyJykgIT0gbnVsbFxuICAgIHRoaXMubXVsdGlwbGUgPSBlbC5oYXNBdHRyaWJ1dGUoJ211bHRpcGxlJylcblxuICAgIC8vIGF0dGFjaCBsaXN0ZW5lclxuICAgIHRoaXMub24oJ2NoYW5nZScsIGZ1bmN0aW9uICgpIHtcbiAgICAgIHZhciB2YWx1ZSA9IGdldFZhbHVlKGVsLCBzZWxmLm11bHRpcGxlKVxuICAgICAgdmFsdWUgPSBzZWxmLm51bWJlclxuICAgICAgICA/IF8uaXNBcnJheSh2YWx1ZSlcbiAgICAgICAgICA/IHZhbHVlLm1hcChfLnRvTnVtYmVyKVxuICAgICAgICAgIDogXy50b051bWJlcih2YWx1ZSlcbiAgICAgICAgOiB2YWx1ZVxuICAgICAgc2VsZi5zZXQodmFsdWUpXG4gICAgfSlcblxuICAgIC8vIGNoZWNrIGluaXRpYWwgdmFsdWUgKGlubGluZSBzZWxlY3RlZCBhdHRyaWJ1dGUpXG4gICAgY2hlY2tJbml0aWFsVmFsdWUuY2FsbCh0aGlzKVxuXG4gICAgLy8gQWxsIG1ham9yIGJyb3dzZXJzIGV4Y2VwdCBGaXJlZm94IHJlc2V0c1xuICAgIC8vIHNlbGVjdGVkSW5kZXggd2l0aCB2YWx1ZSAtMSB0byAwIHdoZW4gdGhlIGVsZW1lbnRcbiAgICAvLyBpcyBhcHBlbmRlZCB0byBhIG5ldyBwYXJlbnQsIHRoZXJlZm9yZSB3ZSBoYXZlIHRvXG4gICAgLy8gZm9yY2UgYSBET00gdXBkYXRlIHdoZW5ldmVyIHRoYXQgaGFwcGVucy4uLlxuICAgIHRoaXMudm0uJG9uKCdob29rOmF0dGFjaGVkJywgdGhpcy5mb3JjZVVwZGF0ZSlcbiAgfSxcblxuICB1cGRhdGU6IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgIHZhciBlbCA9IHRoaXMuZWxcbiAgICBlbC5zZWxlY3RlZEluZGV4ID0gLTFcbiAgICBpZiAodmFsdWUgPT0gbnVsbCkge1xuICAgICAgaWYgKHRoaXMuZGVmYXVsdE9wdGlvbikge1xuICAgICAgICB0aGlzLmRlZmF1bHRPcHRpb24uc2VsZWN0ZWQgPSB0cnVlXG4gICAgICB9XG4gICAgICByZXR1cm5cbiAgICB9XG4gICAgdmFyIG11bHRpID0gdGhpcy5tdWx0aXBsZSAmJiBfLmlzQXJyYXkodmFsdWUpXG4gICAgdmFyIG9wdGlvbnMgPSBlbC5vcHRpb25zXG4gICAgdmFyIGkgPSBvcHRpb25zLmxlbmd0aFxuICAgIHZhciBvcCwgdmFsXG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgb3AgPSBvcHRpb25zW2ldXG4gICAgICB2YWwgPSBvcC5oYXNPd25Qcm9wZXJ0eSgnX3ZhbHVlJylcbiAgICAgICAgPyBvcC5fdmFsdWVcbiAgICAgICAgOiBvcC52YWx1ZVxuICAgICAgLyogZXNsaW50LWRpc2FibGUgZXFlcWVxICovXG4gICAgICBvcC5zZWxlY3RlZCA9IG11bHRpXG4gICAgICAgID8gaW5kZXhPZih2YWx1ZSwgdmFsKSA+IC0xXG4gICAgICAgIDogXy5sb29zZUVxdWFsKHZhbHVlLCB2YWwpXG4gICAgICAvKiBlc2xpbnQtZW5hYmxlIGVxZXFlcSAqL1xuICAgIH1cbiAgfSxcblxuICB1bmJpbmQ6IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLnZtLiRvZmYoJ2hvb2s6YXR0YWNoZWQnLCB0aGlzLmZvcmNlVXBkYXRlKVxuICAgIGlmICh0aGlzLm9wdGlvbldhdGNoZXIpIHtcbiAgICAgIHRoaXMub3B0aW9uV2F0Y2hlci50ZWFyZG93bigpXG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogSW5pdGlhbGl6ZSB0aGUgb3B0aW9uIGxpc3QgZnJvbSB0aGUgcGFyYW0uXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGV4cHJlc3Npb25cbiAqL1xuXG5mdW5jdGlvbiBpbml0T3B0aW9ucyAoZXhwcmVzc2lvbikge1xuICB2YXIgc2VsZiA9IHRoaXNcbiAgdmFyIGVsID0gc2VsZi5lbFxuICB2YXIgZGVmYXVsdE9wdGlvbiA9IHNlbGYuZGVmYXVsdE9wdGlvbiA9IHNlbGYuZWwub3B0aW9uc1swXVxuICB2YXIgZGVzY3JpcHRvciA9IGRpclBhcnNlci5wYXJzZShleHByZXNzaW9uKVswXVxuICBmdW5jdGlvbiBvcHRpb25VcGRhdGVXYXRjaGVyICh2YWx1ZSkge1xuICAgIGlmIChfLmlzQXJyYXkodmFsdWUpKSB7XG4gICAgICAvLyBjbGVhciBvbGQgb3B0aW9ucy5cbiAgICAgIC8vIGNhbm5vdCByZXNldCBpbm5lckhUTUwgaGVyZSBiZWNhdXNlIElFIGZhbWlseSBnZXRcbiAgICAgIC8vIGNvbmZ1c2VkIGR1cmluZyBjb21waWxhdGlvbi5cbiAgICAgIHZhciBpID0gZWwub3B0aW9ucy5sZW5ndGhcbiAgICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgdmFyIG9wdGlvbiA9IGVsLm9wdGlvbnNbaV1cbiAgICAgICAgaWYgKG9wdGlvbiAhPT0gZGVmYXVsdE9wdGlvbikge1xuICAgICAgICAgIHZhciBwYXJlbnROb2RlID0gb3B0aW9uLnBhcmVudE5vZGVcbiAgICAgICAgICBpZiAocGFyZW50Tm9kZSA9PT0gZWwpIHtcbiAgICAgICAgICAgIHBhcmVudE5vZGUucmVtb3ZlQ2hpbGQob3B0aW9uKVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBlbC5yZW1vdmVDaGlsZChwYXJlbnROb2RlKVxuICAgICAgICAgICAgaSA9IGVsLm9wdGlvbnMubGVuZ3RoXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBidWlsZE9wdGlvbnMoZWwsIHZhbHVlKVxuICAgICAgc2VsZi5mb3JjZVVwZGF0ZSgpXG4gICAgfSBlbHNlIHtcbiAgICAgIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgJiYgXy53YXJuKFxuICAgICAgICAnSW52YWxpZCBvcHRpb25zIHZhbHVlIGZvciB2LW1vZGVsOiAnICsgdmFsdWVcbiAgICAgIClcbiAgICB9XG4gIH1cbiAgdGhpcy5vcHRpb25XYXRjaGVyID0gbmV3IFdhdGNoZXIoXG4gICAgdGhpcy52bSxcbiAgICBkZXNjcmlwdG9yLmV4cHJlc3Npb24sXG4gICAgb3B0aW9uVXBkYXRlV2F0Y2hlcixcbiAgICB7XG4gICAgICBkZWVwOiB0cnVlLFxuICAgICAgZmlsdGVyczogZGVzY3JpcHRvci5maWx0ZXJzXG4gICAgfVxuICApXG4gIC8vIHVwZGF0ZSB3aXRoIGluaXRpYWwgdmFsdWVcbiAgb3B0aW9uVXBkYXRlV2F0Y2hlcih0aGlzLm9wdGlvbldhdGNoZXIudmFsdWUpXG59XG5cbi8qKlxuICogQnVpbGQgdXAgb3B0aW9uIGVsZW1lbnRzLiBJRTkgZG9lc24ndCBjcmVhdGUgb3B0aW9uc1xuICogd2hlbiBzZXR0aW5nIGlubmVySFRNTCBvbiA8c2VsZWN0PiBlbGVtZW50cywgc28gd2UgaGF2ZVxuICogdG8gdXNlIERPTSBBUEkgaGVyZS5cbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IHBhcmVudCAtIGEgPHNlbGVjdD4gb3IgYW4gPG9wdGdyb3VwPlxuICogQHBhcmFtIHtBcnJheX0gb3B0aW9uc1xuICovXG5cbmZ1bmN0aW9uIGJ1aWxkT3B0aW9ucyAocGFyZW50LCBvcHRpb25zKSB7XG4gIHZhciBvcCwgZWxcbiAgZm9yICh2YXIgaSA9IDAsIGwgPSBvcHRpb25zLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgIG9wID0gb3B0aW9uc1tpXVxuICAgIGlmICghb3Aub3B0aW9ucykge1xuICAgICAgZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdvcHRpb24nKVxuICAgICAgaWYgKHR5cGVvZiBvcCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgZWwudGV4dCA9IGVsLnZhbHVlID0gb3BcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChvcC52YWx1ZSAhPSBudWxsICYmICFfLmlzT2JqZWN0KG9wLnZhbHVlKSkge1xuICAgICAgICAgIGVsLnZhbHVlID0gb3AudmFsdWVcbiAgICAgICAgfVxuICAgICAgICAvLyBvYmplY3QgdmFsdWVzIGdldHMgc2VyaWFsaXplZCB3aGVuIHNldCBhcyB2YWx1ZSxcbiAgICAgICAgLy8gc28gd2Ugc3RvcmUgdGhlIHJhdyB2YWx1ZSBhcyBhIGRpZmZlcmVudCBwcm9wZXJ0eVxuICAgICAgICBlbC5fdmFsdWUgPSBvcC52YWx1ZVxuICAgICAgICBlbC50ZXh0ID0gb3AudGV4dCB8fCAnJ1xuICAgICAgICBpZiAob3AuZGlzYWJsZWQpIHtcbiAgICAgICAgICBlbC5kaXNhYmxlZCA9IHRydWVcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ29wdGdyb3VwJylcbiAgICAgIGVsLmxhYmVsID0gb3AubGFiZWxcbiAgICAgIGJ1aWxkT3B0aW9ucyhlbCwgb3Aub3B0aW9ucylcbiAgICB9XG4gICAgcGFyZW50LmFwcGVuZENoaWxkKGVsKVxuICB9XG59XG5cbi8qKlxuICogQ2hlY2sgdGhlIGluaXRpYWwgdmFsdWUgZm9yIHNlbGVjdGVkIG9wdGlvbnMuXG4gKi9cblxuZnVuY3Rpb24gY2hlY2tJbml0aWFsVmFsdWUgKCkge1xuICB2YXIgaW5pdFZhbHVlXG4gIHZhciBvcHRpb25zID0gdGhpcy5lbC5vcHRpb25zXG4gIGZvciAodmFyIGkgPSAwLCBsID0gb3B0aW9ucy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICBpZiAob3B0aW9uc1tpXS5oYXNBdHRyaWJ1dGUoJ3NlbGVjdGVkJykpIHtcbiAgICAgIGlmICh0aGlzLm11bHRpcGxlKSB7XG4gICAgICAgIChpbml0VmFsdWUgfHwgKGluaXRWYWx1ZSA9IFtdKSlcbiAgICAgICAgICAucHVzaChvcHRpb25zW2ldLnZhbHVlKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaW5pdFZhbHVlID0gb3B0aW9uc1tpXS52YWx1ZVxuICAgICAgfVxuICAgIH1cbiAgfVxuICBpZiAodHlwZW9mIGluaXRWYWx1ZSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICB0aGlzLl9pbml0VmFsdWUgPSB0aGlzLm51bWJlclxuICAgICAgPyBfLnRvTnVtYmVyKGluaXRWYWx1ZSlcbiAgICAgIDogaW5pdFZhbHVlXG4gIH1cbn1cblxuLyoqXG4gKiBHZXQgc2VsZWN0IHZhbHVlXG4gKlxuICogQHBhcmFtIHtTZWxlY3RFbGVtZW50fSBlbFxuICogQHBhcmFtIHtCb29sZWFufSBtdWx0aVxuICogQHJldHVybiB7QXJyYXl8Kn1cbiAqL1xuXG5mdW5jdGlvbiBnZXRWYWx1ZSAoZWwsIG11bHRpKSB7XG4gIHZhciByZXMgPSBtdWx0aSA/IFtdIDogbnVsbFxuICB2YXIgb3AsIHZhbFxuICBmb3IgKHZhciBpID0gMCwgbCA9IGVsLm9wdGlvbnMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgb3AgPSBlbC5vcHRpb25zW2ldXG4gICAgaWYgKG9wLnNlbGVjdGVkKSB7XG4gICAgICB2YWwgPSBvcC5oYXNPd25Qcm9wZXJ0eSgnX3ZhbHVlJylcbiAgICAgICAgPyBvcC5fdmFsdWVcbiAgICAgICAgOiBvcC52YWx1ZVxuICAgICAgaWYgKG11bHRpKSB7XG4gICAgICAgIHJlcy5wdXNoKHZhbClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB2YWxcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIHJlc1xufVxuXG4vKipcbiAqIE5hdGl2ZSBBcnJheS5pbmRleE9mIHVzZXMgc3RyaWN0IGVxdWFsLCBidXQgaW4gdGhpc1xuICogY2FzZSB3ZSBuZWVkIHRvIG1hdGNoIHN0cmluZy9udW1iZXJzIHdpdGggY3VzdG9tIGVxdWFsLlxuICpcbiAqIEBwYXJhbSB7QXJyYXl9IGFyclxuICogQHBhcmFtIHsqfSB2YWxcbiAqL1xuXG5mdW5jdGlvbiBpbmRleE9mIChhcnIsIHZhbCkge1xuICB2YXIgaSA9IGFyci5sZW5ndGhcbiAgd2hpbGUgKGktLSkge1xuICAgIGlmIChfLmxvb3NlRXF1YWwoYXJyW2ldLCB2YWwpKSB7XG4gICAgICByZXR1cm4gaVxuICAgIH1cbiAgfVxuICByZXR1cm4gLTFcbn1cbiIsInZhciBfID0gcmVxdWlyZSgnLi4vLi4vdXRpbCcpXG5cbm1vZHVsZS5leHBvcnRzID0ge1xuXG4gIGJpbmQ6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXNcbiAgICB2YXIgZWwgPSB0aGlzLmVsXG4gICAgdmFyIGlzUmFuZ2UgPSBlbC50eXBlID09PSAncmFuZ2UnXG5cbiAgICAvLyBjaGVjayBwYXJhbXNcbiAgICAvLyAtIGxhenk6IHVwZGF0ZSBtb2RlbCBvbiBcImNoYW5nZVwiIGluc3RlYWQgb2YgXCJpbnB1dFwiXG4gICAgdmFyIGxhenkgPSB0aGlzLl9jaGVja1BhcmFtKCdsYXp5JykgIT0gbnVsbFxuICAgIC8vIC0gbnVtYmVyOiBjYXN0IHZhbHVlIGludG8gbnVtYmVyIHdoZW4gdXBkYXRpbmcgbW9kZWwuXG4gICAgdmFyIG51bWJlciA9IHRoaXMuX2NoZWNrUGFyYW0oJ251bWJlcicpICE9IG51bGxcbiAgICAvLyAtIGRlYm91bmNlOiBkZWJvdW5jZSB0aGUgaW5wdXQgbGlzdGVuZXJcbiAgICB2YXIgZGVib3VuY2UgPSBwYXJzZUludCh0aGlzLl9jaGVja1BhcmFtKCdkZWJvdW5jZScpLCAxMClcblxuICAgIC8vIGhhbmRsZSBjb21wb3NpdGlvbiBldmVudHMuXG4gICAgLy8gICBodHRwOi8vYmxvZy5ldmFueW91Lm1lLzIwMTQvMDEvMDMvY29tcG9zaXRpb24tZXZlbnQvXG4gICAgLy8gc2tpcCB0aGlzIGZvciBBbmRyb2lkIGJlY2F1c2UgaXQgaGFuZGxlcyBjb21wb3NpdGlvblxuICAgIC8vIGV2ZW50cyBxdWl0ZSBkaWZmZXJlbnRseS4gQW5kcm9pZCBkb2Vzbid0IHRyaWdnZXJcbiAgICAvLyBjb21wb3NpdGlvbiBldmVudHMgZm9yIGxhbmd1YWdlIGlucHV0IG1ldGhvZHMgZS5nLlxuICAgIC8vIENoaW5lc2UsIGJ1dCBpbnN0ZWFkIHRyaWdnZXJzIHRoZW0gZm9yIHNwZWxsaW5nXG4gICAgLy8gc3VnZ2VzdGlvbnMuLi4gKHNlZSBEaXNjdXNzaW9uLyMxNjIpXG4gICAgdmFyIGNvbXBvc2luZyA9IGZhbHNlXG4gICAgaWYgKCFfLmlzQW5kcm9pZCAmJiAhaXNSYW5nZSkge1xuICAgICAgdGhpcy5vbignY29tcG9zaXRpb25zdGFydCcsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgY29tcG9zaW5nID0gdHJ1ZVxuICAgICAgfSlcbiAgICAgIHRoaXMub24oJ2NvbXBvc2l0aW9uZW5kJywgZnVuY3Rpb24gKCkge1xuICAgICAgICBjb21wb3NpbmcgPSBmYWxzZVxuICAgICAgICAvLyBpbiBJRTExIHRoZSBcImNvbXBvc2l0aW9uZW5kXCIgZXZlbnQgZmlyZXMgQUZURVJcbiAgICAgICAgLy8gdGhlIFwiaW5wdXRcIiBldmVudCwgc28gdGhlIGlucHV0IGhhbmRsZXIgaXMgYmxvY2tlZFxuICAgICAgICAvLyBhdCB0aGUgZW5kLi4uIGhhdmUgdG8gY2FsbCBpdCBoZXJlLlxuICAgICAgICBzZWxmLmxpc3RlbmVyKClcbiAgICAgIH0pXG4gICAgfVxuXG4gICAgLy8gcHJldmVudCBtZXNzaW5nIHdpdGggdGhlIGlucHV0IHdoZW4gdXNlciBpcyB0eXBpbmcsXG4gICAgLy8gYW5kIGZvcmNlIHVwZGF0ZSBvbiBibHVyLlxuICAgIHRoaXMuZm9jdXNlZCA9IGZhbHNlXG4gICAgaWYgKCFpc1JhbmdlKSB7XG4gICAgICB0aGlzLm9uKCdmb2N1cycsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgc2VsZi5mb2N1c2VkID0gdHJ1ZVxuICAgICAgfSlcbiAgICAgIHRoaXMub24oJ2JsdXInLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHNlbGYuZm9jdXNlZCA9IGZhbHNlXG4gICAgICAgIHNlbGYubGlzdGVuZXIoKVxuICAgICAgfSlcbiAgICB9XG5cbiAgICAvLyBOb3cgYXR0YWNoIHRoZSBtYWluIGxpc3RlbmVyXG4gICAgdGhpcy5saXN0ZW5lciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIGlmIChjb21wb3NpbmcpIHJldHVyblxuICAgICAgdmFyIHZhbCA9IG51bWJlciB8fCBpc1JhbmdlXG4gICAgICAgID8gXy50b051bWJlcihlbC52YWx1ZSlcbiAgICAgICAgOiBlbC52YWx1ZVxuICAgICAgc2VsZi5zZXQodmFsKVxuICAgICAgLy8gZm9yY2UgdXBkYXRlIG9uIG5leHQgdGljayB0byBhdm9pZCBsb2NrICYgc2FtZSB2YWx1ZVxuICAgICAgLy8gYWxzbyBvbmx5IHVwZGF0ZSB3aGVuIHVzZXIgaXMgbm90IHR5cGluZ1xuICAgICAgXy5uZXh0VGljayhmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmIChzZWxmLl9ib3VuZCAmJiAhc2VsZi5mb2N1c2VkKSB7XG4gICAgICAgICAgc2VsZi51cGRhdGUoc2VsZi5fd2F0Y2hlci52YWx1ZSlcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICB9XG4gICAgaWYgKGRlYm91bmNlKSB7XG4gICAgICB0aGlzLmxpc3RlbmVyID0gXy5kZWJvdW5jZSh0aGlzLmxpc3RlbmVyLCBkZWJvdW5jZSlcbiAgICB9XG5cbiAgICAvLyBTdXBwb3J0IGpRdWVyeSBldmVudHMsIHNpbmNlIGpRdWVyeS50cmlnZ2VyKCkgZG9lc24ndFxuICAgIC8vIHRyaWdnZXIgbmF0aXZlIGV2ZW50cyBpbiBzb21lIGNhc2VzIGFuZCBzb21lIHBsdWdpbnNcbiAgICAvLyByZWx5IG9uICQudHJpZ2dlcigpXG4gICAgLy9cbiAgICAvLyBXZSB3YW50IHRvIG1ha2Ugc3VyZSBpZiBhIGxpc3RlbmVyIGlzIGF0dGFjaGVkIHVzaW5nXG4gICAgLy8galF1ZXJ5LCBpdCBpcyBhbHNvIHJlbW92ZWQgd2l0aCBqUXVlcnksIHRoYXQncyB3aHlcbiAgICAvLyB3ZSBkbyB0aGUgY2hlY2sgZm9yIGVhY2ggZGlyZWN0aXZlIGluc3RhbmNlIGFuZFxuICAgIC8vIHN0b3JlIHRoYXQgY2hlY2sgcmVzdWx0IG9uIGl0c2VsZi4gVGhpcyBhbHNvIGFsbG93c1xuICAgIC8vIGVhc2llciB0ZXN0IGNvdmVyYWdlIGNvbnRyb2wgYnkgdW5zZXR0aW5nIHRoZSBnbG9iYWxcbiAgICAvLyBqUXVlcnkgdmFyaWFibGUgaW4gdGVzdHMuXG4gICAgdGhpcy5oYXNqUXVlcnkgPSB0eXBlb2YgalF1ZXJ5ID09PSAnZnVuY3Rpb24nXG4gICAgaWYgKHRoaXMuaGFzalF1ZXJ5KSB7XG4gICAgICBqUXVlcnkoZWwpLm9uKCdjaGFuZ2UnLCB0aGlzLmxpc3RlbmVyKVxuICAgICAgaWYgKCFsYXp5KSB7XG4gICAgICAgIGpRdWVyeShlbCkub24oJ2lucHV0JywgdGhpcy5saXN0ZW5lcilcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5vbignY2hhbmdlJywgdGhpcy5saXN0ZW5lcilcbiAgICAgIGlmICghbGF6eSkge1xuICAgICAgICB0aGlzLm9uKCdpbnB1dCcsIHRoaXMubGlzdGVuZXIpXG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gSUU5IGRvZXNuJ3QgZmlyZSBpbnB1dCBldmVudCBvbiBiYWNrc3BhY2UvZGVsL2N1dFxuICAgIGlmICghbGF6eSAmJiBfLmlzSUU5KSB7XG4gICAgICB0aGlzLm9uKCdjdXQnLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIF8ubmV4dFRpY2soc2VsZi5saXN0ZW5lcilcbiAgICAgIH0pXG4gICAgICB0aGlzLm9uKCdrZXl1cCcsIGZ1bmN0aW9uIChlKSB7XG4gICAgICAgIGlmIChlLmtleUNvZGUgPT09IDQ2IHx8IGUua2V5Q29kZSA9PT0gOCkge1xuICAgICAgICAgIHNlbGYubGlzdGVuZXIoKVxuICAgICAgICB9XG4gICAgICB9KVxuICAgIH1cblxuICAgIC8vIHNldCBpbml0aWFsIHZhbHVlIGlmIHByZXNlbnRcbiAgICBpZiAoXG4gICAgICBlbC5oYXNBdHRyaWJ1dGUoJ3ZhbHVlJykgfHxcbiAgICAgIChlbC50YWdOYW1lID09PSAnVEVYVEFSRUEnICYmIGVsLnZhbHVlLnRyaW0oKSlcbiAgICApIHtcbiAgICAgIHRoaXMuX2luaXRWYWx1ZSA9IG51bWJlclxuICAgICAgICA/IF8udG9OdW1iZXIoZWwudmFsdWUpXG4gICAgICAgIDogZWwudmFsdWVcbiAgICB9XG4gIH0sXG5cbiAgdXBkYXRlOiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICB0aGlzLmVsLnZhbHVlID0gXy50b1N0cmluZyh2YWx1ZSlcbiAgfSxcblxuICB1bmJpbmQ6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgZWwgPSB0aGlzLmVsXG4gICAgaWYgKHRoaXMuaGFzalF1ZXJ5KSB7XG4gICAgICBqUXVlcnkoZWwpLm9mZignY2hhbmdlJywgdGhpcy5saXN0ZW5lcilcbiAgICAgIGpRdWVyeShlbCkub2ZmKCdpbnB1dCcsIHRoaXMubGlzdGVuZXIpXG4gICAgfVxuICB9XG59XG4iLCJ2YXIgXyA9IHJlcXVpcmUoJy4uL3V0aWwnKVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcblxuICBhY2NlcHRTdGF0ZW1lbnQ6IHRydWUsXG4gIHByaW9yaXR5OiA3MDAsXG5cbiAgYmluZDogZnVuY3Rpb24gKCkge1xuICAgIC8vIGRlYWwgd2l0aCBpZnJhbWVzXG4gICAgaWYgKFxuICAgICAgdGhpcy5lbC50YWdOYW1lID09PSAnSUZSQU1FJyAmJlxuICAgICAgdGhpcy5hcmcgIT09ICdsb2FkJ1xuICAgICkge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzXG4gICAgICB0aGlzLmlmcmFtZUJpbmQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIF8ub24oc2VsZi5lbC5jb250ZW50V2luZG93LCBzZWxmLmFyZywgc2VsZi5oYW5kbGVyKVxuICAgICAgfVxuICAgICAgdGhpcy5vbignbG9hZCcsIHRoaXMuaWZyYW1lQmluZClcbiAgICB9XG4gIH0sXG5cbiAgdXBkYXRlOiBmdW5jdGlvbiAoaGFuZGxlcikge1xuICAgIGlmICh0eXBlb2YgaGFuZGxlciAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiBfLndhcm4oXG4gICAgICAgICdEaXJlY3RpdmUgdi1vbj1cIicgKyB0aGlzLmFyZyArICc6ICcgK1xuICAgICAgICB0aGlzLmV4cHJlc3Npb24gKyAnXCIgZXhwZWN0cyBhIGZ1bmN0aW9uIHZhbHVlLCAnICtcbiAgICAgICAgJ2dvdCAnICsgaGFuZGxlclxuICAgICAgKVxuICAgICAgcmV0dXJuXG4gICAgfVxuICAgIHRoaXMucmVzZXQoKVxuICAgIHZhciB2bSA9IHRoaXMudm1cbiAgICB0aGlzLmhhbmRsZXIgPSBmdW5jdGlvbiAoZSkge1xuICAgICAgZS50YXJnZXRWTSA9IHZtXG4gICAgICB2bS4kZXZlbnQgPSBlXG4gICAgICB2YXIgcmVzID0gaGFuZGxlcihlKVxuICAgICAgdm0uJGV2ZW50ID0gbnVsbFxuICAgICAgcmV0dXJuIHJlc1xuICAgIH1cbiAgICBpZiAodGhpcy5pZnJhbWVCaW5kKSB7XG4gICAgICB0aGlzLmlmcmFtZUJpbmQoKVxuICAgIH0gZWxzZSB7XG4gICAgICBfLm9uKHRoaXMuZWwsIHRoaXMuYXJnLCB0aGlzLmhhbmRsZXIpXG4gICAgfVxuICB9LFxuXG4gIHJlc2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGVsID0gdGhpcy5pZnJhbWVCaW5kXG4gICAgICA/IHRoaXMuZWwuY29udGVudFdpbmRvd1xuICAgICAgOiB0aGlzLmVsXG4gICAgaWYgKHRoaXMuaGFuZGxlcikge1xuICAgICAgXy5vZmYoZWwsIHRoaXMuYXJnLCB0aGlzLmhhbmRsZXIpXG4gICAgfVxuICB9LFxuXG4gIHVuYmluZDogZnVuY3Rpb24gKCkge1xuICAgIHRoaXMucmVzZXQoKVxuICB9XG59XG4iLCIvLyBOT1RFOiB0aGUgcHJvcCBpbnRlcm5hbCBkaXJlY3RpdmUgaXMgY29tcGlsZWQgYW5kIGxpbmtlZFxuLy8gZHVyaW5nIF9pbml0U2NvcGUoKSwgYmVmb3JlIHRoZSBjcmVhdGVkIGhvb2sgaXMgY2FsbGVkLlxuLy8gVGhlIHB1cnBvc2UgaXMgdG8gbWFrZSB0aGUgaW5pdGlhbCBwcm9wIHZhbHVlcyBhdmFpbGFibGVcbi8vIGluc2lkZSBgY3JlYXRlZGAgaG9va3MgYW5kIGBkYXRhYCBmdW5jdGlvbnMuXG5cbnZhciBfID0gcmVxdWlyZSgnLi4vdXRpbCcpXG52YXIgV2F0Y2hlciA9IHJlcXVpcmUoJy4uL3dhdGNoZXInKVxudmFyIGJpbmRpbmdNb2RlcyA9IHJlcXVpcmUoJy4uL2NvbmZpZycpLl9wcm9wQmluZGluZ01vZGVzXG5cbm1vZHVsZS5leHBvcnRzID0ge1xuXG4gIGJpbmQ6IGZ1bmN0aW9uICgpIHtcblxuICAgIHZhciBjaGlsZCA9IHRoaXMudm1cbiAgICB2YXIgcGFyZW50ID0gY2hpbGQuX2NvbnRleHRcbiAgICAvLyBwYXNzZWQgaW4gZnJvbSBjb21waWxlciBkaXJlY3RseVxuICAgIHZhciBwcm9wID0gdGhpcy5fZGVzY3JpcHRvclxuICAgIHZhciBjaGlsZEtleSA9IHByb3AucGF0aFxuICAgIHZhciBwYXJlbnRLZXkgPSBwcm9wLnBhcmVudFBhdGhcblxuICAgIHRoaXMucGFyZW50V2F0Y2hlciA9IG5ldyBXYXRjaGVyKFxuICAgICAgcGFyZW50LFxuICAgICAgcGFyZW50S2V5LFxuICAgICAgZnVuY3Rpb24gKHZhbCkge1xuICAgICAgICBpZiAoXy5hc3NlcnRQcm9wKHByb3AsIHZhbCkpIHtcbiAgICAgICAgICBjaGlsZFtjaGlsZEtleV0gPSB2YWxcbiAgICAgICAgfVxuICAgICAgfSwgeyBzeW5jOiB0cnVlIH1cbiAgICApXG5cbiAgICAvLyBzZXQgdGhlIGNoaWxkIGluaXRpYWwgdmFsdWUuXG4gICAgdmFyIHZhbHVlID0gdGhpcy5wYXJlbnRXYXRjaGVyLnZhbHVlXG4gICAgaWYgKGNoaWxkS2V5ID09PSAnJGRhdGEnKSB7XG4gICAgICBjaGlsZC5fZGF0YSA9IHZhbHVlXG4gICAgfSBlbHNlIHtcbiAgICAgIF8uaW5pdFByb3AoY2hpbGQsIHByb3AsIHZhbHVlKVxuICAgIH1cblxuICAgIC8vIHNldHVwIHR3by13YXkgYmluZGluZ1xuICAgIGlmIChwcm9wLm1vZGUgPT09IGJpbmRpbmdNb2Rlcy5UV09fV0FZKSB7XG4gICAgICAvLyBpbXBvcnRhbnQ6IGRlZmVyIHRoZSBjaGlsZCB3YXRjaGVyIGNyZWF0aW9uIHVudGlsXG4gICAgICAvLyB0aGUgY3JlYXRlZCBob29rIChhZnRlciBkYXRhIG9ic2VydmF0aW9uKVxuICAgICAgdmFyIHNlbGYgPSB0aGlzXG4gICAgICBjaGlsZC4kb25jZSgnaG9vazpjcmVhdGVkJywgZnVuY3Rpb24gKCkge1xuICAgICAgICBzZWxmLmNoaWxkV2F0Y2hlciA9IG5ldyBXYXRjaGVyKFxuICAgICAgICAgIGNoaWxkLFxuICAgICAgICAgIGNoaWxkS2V5LFxuICAgICAgICAgIGZ1bmN0aW9uICh2YWwpIHtcbiAgICAgICAgICAgIHBhcmVudC4kc2V0KHBhcmVudEtleSwgdmFsKVxuICAgICAgICAgIH0sIHsgc3luYzogdHJ1ZSB9XG4gICAgICAgIClcbiAgICAgIH0pXG4gICAgfVxuICB9LFxuXG4gIHVuYmluZDogZnVuY3Rpb24gKCkge1xuICAgIHRoaXMucGFyZW50V2F0Y2hlci50ZWFyZG93bigpXG4gICAgaWYgKHRoaXMuY2hpbGRXYXRjaGVyKSB7XG4gICAgICB0aGlzLmNoaWxkV2F0Y2hlci50ZWFyZG93bigpXG4gICAgfVxuICB9XG59XG4iLCJ2YXIgXyA9IHJlcXVpcmUoJy4uL3V0aWwnKVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcblxuICBpc0xpdGVyYWw6IHRydWUsXG5cbiAgYmluZDogZnVuY3Rpb24gKCkge1xuICAgIHZhciB2bSA9IHRoaXMuZWwuX192dWVfX1xuICAgIGlmICghdm0pIHtcbiAgICAgIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgJiYgXy53YXJuKFxuICAgICAgICAndi1yZWYgc2hvdWxkIG9ubHkgYmUgdXNlZCBvbiBhIGNvbXBvbmVudCByb290IGVsZW1lbnQuJ1xuICAgICAgKVxuICAgICAgcmV0dXJuXG4gICAgfVxuICAgIC8vIElmIHdlIGdldCBoZXJlLCBpdCBtZWFucyB0aGlzIGlzIGEgYHYtcmVmYCBvbiBhXG4gICAgLy8gY2hpbGQsIGJlY2F1c2UgcGFyZW50IHNjb3BlIGB2LXJlZmAgaXMgc3RyaXBwZWQgaW5cbiAgICAvLyBgdi1jb21wb25lbnRgIGFscmVhZHkuIFNvIHdlIGp1c3QgcmVjb3JkIG91ciBvd24gcmVmXG4gICAgLy8gaGVyZSAtIGl0IHdpbGwgb3ZlcndyaXRlIHBhcmVudCByZWYgaW4gYHYtY29tcG9uZW50YCxcbiAgICAvLyBpZiBhbnkuXG4gICAgdm0uX3JlZklEID0gdGhpcy5leHByZXNzaW9uXG4gIH1cbn1cbiIsInZhciBfID0gcmVxdWlyZSgnLi4vdXRpbCcpXG52YXIgY29uZmlnID0gcmVxdWlyZSgnLi4vY29uZmlnJylcbnZhciBpc09iamVjdCA9IF8uaXNPYmplY3RcbnZhciBpc1BsYWluT2JqZWN0ID0gXy5pc1BsYWluT2JqZWN0XG52YXIgdGV4dFBhcnNlciA9IHJlcXVpcmUoJy4uL3BhcnNlcnMvdGV4dCcpXG52YXIgZXhwUGFyc2VyID0gcmVxdWlyZSgnLi4vcGFyc2Vycy9leHByZXNzaW9uJylcbnZhciB0ZW1wbGF0ZVBhcnNlciA9IHJlcXVpcmUoJy4uL3BhcnNlcnMvdGVtcGxhdGUnKVxudmFyIGNvbXBpbGVyID0gcmVxdWlyZSgnLi4vY29tcGlsZXInKVxudmFyIHVpZCA9IDBcblxuLy8gYXN5bmMgY29tcG9uZW50IHJlc29sdXRpb24gc3RhdGVzXG52YXIgVU5SRVNPTFZFRCA9IDBcbnZhciBQRU5ESU5HID0gMVxudmFyIFJFU09MVkVEID0gMlxudmFyIEFCT1JURUQgPSAzXG5cbm1vZHVsZS5leHBvcnRzID0ge1xuXG4gIC8qKlxuICAgKiBTZXR1cC5cbiAgICovXG5cbiAgYmluZDogZnVuY3Rpb24gKCkge1xuXG4gICAgLy8gc29tZSBoZWxwZnVsIHRpcHMuLi5cbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICBpZiAoXG4gICAgICBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nICYmXG4gICAgICB0aGlzLmVsLnRhZ05hbWUgPT09ICdPUFRJT04nICYmXG4gICAgICB0aGlzLmVsLnBhcmVudE5vZGUgJiYgdGhpcy5lbC5wYXJlbnROb2RlLl9fdl9tb2RlbFxuICAgICkge1xuICAgICAgXy53YXJuKFxuICAgICAgICAnRG9uXFwndCB1c2Ugdi1yZXBlYXQgZm9yIHYtbW9kZWwgb3B0aW9uczsgJyArXG4gICAgICAgICd1c2UgdGhlIGBvcHRpb25zYCBwYXJhbSBpbnN0ZWFkOiAnICtcbiAgICAgICAgJ2h0dHA6Ly92dWVqcy5vcmcvZ3VpZGUvZm9ybXMuaHRtbCNEeW5hbWljX1NlbGVjdF9PcHRpb25zJ1xuICAgICAgKVxuICAgIH1cblxuICAgIC8vIHN1cHBvcnQgZm9yIGl0ZW0gaW4gYXJyYXkgc3ludGF4XG4gICAgdmFyIGluTWF0Y2ggPSB0aGlzLmV4cHJlc3Npb24ubWF0Y2goLyguKikgaW4gKC4qKS8pXG4gICAgaWYgKGluTWF0Y2gpIHtcbiAgICAgIHRoaXMuYXJnID0gaW5NYXRjaFsxXVxuICAgICAgdGhpcy5fd2F0Y2hlckV4cCA9IGluTWF0Y2hbMl1cbiAgICB9XG4gICAgLy8gdWlkIGFzIGEgY2FjaGUgaWRlbnRpZmllclxuICAgIHRoaXMuaWQgPSAnX192X3JlcGVhdF8nICsgKCsrdWlkKVxuXG4gICAgLy8gc2V0dXAgYW5jaG9yIG5vZGVzXG4gICAgdGhpcy5zdGFydCA9IF8uY3JlYXRlQW5jaG9yKCd2LXJlcGVhdC1zdGFydCcpXG4gICAgdGhpcy5lbmQgPSBfLmNyZWF0ZUFuY2hvcigndi1yZXBlYXQtZW5kJylcbiAgICBfLnJlcGxhY2UodGhpcy5lbCwgdGhpcy5lbmQpXG4gICAgXy5iZWZvcmUodGhpcy5zdGFydCwgdGhpcy5lbmQpXG5cbiAgICAvLyBjaGVjayBpZiB0aGlzIGlzIGEgYmxvY2sgcmVwZWF0XG4gICAgdGhpcy50ZW1wbGF0ZSA9IF8uaXNUZW1wbGF0ZSh0aGlzLmVsKVxuICAgICAgPyB0ZW1wbGF0ZVBhcnNlci5wYXJzZSh0aGlzLmVsLCB0cnVlKVxuICAgICAgOiB0aGlzLmVsXG5cbiAgICAvLyBjaGVjayBmb3IgdHJhY2tieSBwYXJhbVxuICAgIHRoaXMuaWRLZXkgPSB0aGlzLl9jaGVja1BhcmFtKCd0cmFjay1ieScpXG4gICAgLy8gY2hlY2sgZm9yIHRyYW5zaXRpb24gc3RhZ2dlclxuICAgIHZhciBzdGFnZ2VyID0gK3RoaXMuX2NoZWNrUGFyYW0oJ3N0YWdnZXInKVxuICAgIHRoaXMuZW50ZXJTdGFnZ2VyID0gK3RoaXMuX2NoZWNrUGFyYW0oJ2VudGVyLXN0YWdnZXInKSB8fCBzdGFnZ2VyXG4gICAgdGhpcy5sZWF2ZVN0YWdnZXIgPSArdGhpcy5fY2hlY2tQYXJhbSgnbGVhdmUtc3RhZ2dlcicpIHx8IHN0YWdnZXJcblxuICAgIC8vIGNoZWNrIGZvciB2LXJlZi92LWVsXG4gICAgdGhpcy5yZWZJRCA9IHRoaXMuX2NoZWNrUGFyYW0oY29uZmlnLnByZWZpeCArICdyZWYnKVxuICAgIHRoaXMuZWxJRCA9IHRoaXMuX2NoZWNrUGFyYW0oY29uZmlnLnByZWZpeCArICdlbCcpXG5cbiAgICAvLyBjaGVjayBvdGhlciBkaXJlY3RpdmVzIHRoYXQgbmVlZCB0byBiZSBoYW5kbGVkXG4gICAgLy8gYXQgdi1yZXBlYXQgbGV2ZWxcbiAgICB0aGlzLmNoZWNrSWYoKVxuICAgIHRoaXMuY2hlY2tDb21wb25lbnQoKVxuXG4gICAgLy8gY3JlYXRlIGNhY2hlIG9iamVjdFxuICAgIHRoaXMuY2FjaGUgPSBPYmplY3QuY3JlYXRlKG51bGwpXG4gIH0sXG5cbiAgLyoqXG4gICAqIFdhcm4gYWdhaW5zdCB2LWlmIHVzYWdlLlxuICAgKi9cblxuICBjaGVja0lmOiBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKF8uYXR0cih0aGlzLmVsLCAnaWYnKSAhPT0gbnVsbCkge1xuICAgICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiBfLndhcm4oXG4gICAgICAgICdEb25cXCd0IHVzZSB2LWlmIHdpdGggdi1yZXBlYXQuICcgK1xuICAgICAgICAnVXNlIHYtc2hvdyBvciB0aGUgXCJmaWx0ZXJCeVwiIGZpbHRlciBpbnN0ZWFkLidcbiAgICAgIClcbiAgICB9XG4gIH0sXG5cbiAgLyoqXG4gICAqIENoZWNrIHRoZSBjb21wb25lbnQgY29uc3RydWN0b3IgdG8gdXNlIGZvciByZXBlYXRlZFxuICAgKiBpbnN0YW5jZXMuIElmIHN0YXRpYyB3ZSByZXNvbHZlIGl0IG5vdywgb3RoZXJ3aXNlIGl0XG4gICAqIG5lZWRzIHRvIGJlIHJlc29sdmVkIGF0IGJ1aWxkIHRpbWUgd2l0aCBhY3R1YWwgZGF0YS5cbiAgICovXG5cbiAgY2hlY2tDb21wb25lbnQ6IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmNvbXBvbmVudFN0YXRlID0gVU5SRVNPTFZFRFxuICAgIHZhciBvcHRpb25zID0gdGhpcy52bS4kb3B0aW9uc1xuICAgIHZhciBpZCA9IF8uY2hlY2tDb21wb25lbnQodGhpcy5lbCwgb3B0aW9ucylcbiAgICBpZiAoIWlkKSB7XG4gICAgICAvLyBkZWZhdWx0IGNvbnN0cnVjdG9yXG4gICAgICB0aGlzLkNvbXBvbmVudCA9IF8uVnVlXG4gICAgICAvLyBpbmxpbmUgcmVwZWF0cyBzaG91bGQgaW5oZXJpdFxuICAgICAgdGhpcy5pbmxpbmUgPSB0cnVlXG4gICAgICAvLyBpbXBvcnRhbnQ6IHRyYW5zY2x1ZGUgd2l0aCBubyBvcHRpb25zLCBqdXN0XG4gICAgICAvLyB0byBlbnN1cmUgYmxvY2sgc3RhcnQgYW5kIGJsb2NrIGVuZFxuICAgICAgdGhpcy50ZW1wbGF0ZSA9IGNvbXBpbGVyLnRyYW5zY2x1ZGUodGhpcy50ZW1wbGF0ZSlcbiAgICAgIHZhciBjb3B5ID0gXy5leHRlbmQoe30sIG9wdGlvbnMpXG4gICAgICBjb3B5Ll9hc0NvbXBvbmVudCA9IGZhbHNlXG4gICAgICB0aGlzLl9saW5rRm4gPSBjb21waWxlci5jb21waWxlKHRoaXMudGVtcGxhdGUsIGNvcHkpXG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuQ29tcG9uZW50ID0gbnVsbFxuICAgICAgdGhpcy5hc0NvbXBvbmVudCA9IHRydWVcbiAgICAgIC8vIGNoZWNrIGlubGluZS10ZW1wbGF0ZVxuICAgICAgaWYgKHRoaXMuX2NoZWNrUGFyYW0oJ2lubGluZS10ZW1wbGF0ZScpICE9PSBudWxsKSB7XG4gICAgICAgIC8vIGV4dHJhY3QgaW5saW5lIHRlbXBsYXRlIGFzIGEgRG9jdW1lbnRGcmFnbWVudFxuICAgICAgICB0aGlzLmlubGluZVRlbXBsYXRlID0gXy5leHRyYWN0Q29udGVudCh0aGlzLmVsLCB0cnVlKVxuICAgICAgfVxuICAgICAgdmFyIHRva2VucyA9IHRleHRQYXJzZXIucGFyc2UoaWQpXG4gICAgICBpZiAodG9rZW5zKSB7XG4gICAgICAgIC8vIGR5bmFtaWMgY29tcG9uZW50IHRvIGJlIHJlc29sdmVkIGxhdGVyXG4gICAgICAgIHZhciBjb21wb25lbnRFeHAgPSB0ZXh0UGFyc2VyLnRva2Vuc1RvRXhwKHRva2VucylcbiAgICAgICAgdGhpcy5jb21wb25lbnRHZXR0ZXIgPSBleHBQYXJzZXIucGFyc2UoY29tcG9uZW50RXhwKS5nZXRcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIHN0YXRpY1xuICAgICAgICB0aGlzLmNvbXBvbmVudElkID0gaWRcbiAgICAgICAgdGhpcy5wZW5kaW5nRGF0YSA9IG51bGxcbiAgICAgIH1cbiAgICB9XG4gIH0sXG5cbiAgcmVzb2x2ZUNvbXBvbmVudDogZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuY29tcG9uZW50U3RhdGUgPSBQRU5ESU5HXG4gICAgdGhpcy52bS5fcmVzb2x2ZUNvbXBvbmVudCh0aGlzLmNvbXBvbmVudElkLCBfLmJpbmQoZnVuY3Rpb24gKENvbXBvbmVudCkge1xuICAgICAgaWYgKHRoaXMuY29tcG9uZW50U3RhdGUgPT09IEFCT1JURUQpIHtcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG4gICAgICB0aGlzLkNvbXBvbmVudCA9IENvbXBvbmVudFxuICAgICAgdGhpcy5jb21wb25lbnRTdGF0ZSA9IFJFU09MVkVEXG4gICAgICB0aGlzLnJlYWxVcGRhdGUodGhpcy5wZW5kaW5nRGF0YSlcbiAgICAgIHRoaXMucGVuZGluZ0RhdGEgPSBudWxsXG4gICAgfSwgdGhpcykpXG4gIH0sXG5cbiAgLyoqXG4gICAqIFJlc29sdmUgYSBkeW5hbWljIGNvbXBvbmVudCB0byB1c2UgZm9yIGFuIGluc3RhbmNlLlxuICAgKiBUaGUgdHJpY2t5IHBhcnQgaGVyZSBpcyB0aGF0IHRoZXJlIGNvdWxkIGJlIGR5bmFtaWNcbiAgICogY29tcG9uZW50cyBkZXBlbmRpbmcgb24gaW5zdGFuY2UgZGF0YS5cbiAgICpcbiAgICogQHBhcmFtIHtPYmplY3R9IGRhdGFcbiAgICogQHBhcmFtIHtPYmplY3R9IG1ldGFcbiAgICogQHJldHVybiB7RnVuY3Rpb259XG4gICAqL1xuXG4gIHJlc29sdmVEeW5hbWljQ29tcG9uZW50OiBmdW5jdGlvbiAoZGF0YSwgbWV0YSkge1xuICAgIC8vIGNyZWF0ZSBhIHRlbXBvcmFyeSBjb250ZXh0IG9iamVjdCBhbmQgY29weSBkYXRhXG4gICAgLy8gYW5kIG1ldGEgcHJvcGVydGllcyBvbnRvIGl0LlxuICAgIC8vIHVzZSBfLmRlZmluZSB0byBhdm9pZCBhY2NpZGVudGFsbHkgb3ZlcndyaXRpbmcgc2NvcGVcbiAgICAvLyBwcm9wZXJ0aWVzLlxuICAgIHZhciBjb250ZXh0ID0gT2JqZWN0LmNyZWF0ZSh0aGlzLnZtKVxuICAgIHZhciBrZXlcbiAgICBmb3IgKGtleSBpbiBkYXRhKSB7XG4gICAgICBfLmRlZmluZShjb250ZXh0LCBrZXksIGRhdGFba2V5XSlcbiAgICB9XG4gICAgZm9yIChrZXkgaW4gbWV0YSkge1xuICAgICAgXy5kZWZpbmUoY29udGV4dCwga2V5LCBtZXRhW2tleV0pXG4gICAgfVxuICAgIHZhciBpZCA9IHRoaXMuY29tcG9uZW50R2V0dGVyLmNhbGwoY29udGV4dCwgY29udGV4dClcbiAgICB2YXIgQ29tcG9uZW50ID0gXy5yZXNvbHZlQXNzZXQodGhpcy52bS4kb3B0aW9ucywgJ2NvbXBvbmVudHMnLCBpZClcbiAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgICAgXy5hc3NlcnRBc3NldChDb21wb25lbnQsICdjb21wb25lbnQnLCBpZClcbiAgICB9XG4gICAgaWYgKCFDb21wb25lbnQub3B0aW9ucykge1xuICAgICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiBfLndhcm4oXG4gICAgICAgICdBc3luYyByZXNvbHV0aW9uIGlzIG5vdCBzdXBwb3J0ZWQgZm9yIHYtcmVwZWF0ICcgK1xuICAgICAgICAnKyBkeW5hbWljIGNvbXBvbmVudC4gKGNvbXBvbmVudDogJyArIGlkICsgJyknXG4gICAgICApXG4gICAgICByZXR1cm4gXy5WdWVcbiAgICB9XG4gICAgcmV0dXJuIENvbXBvbmVudFxuICB9LFxuXG4gIC8qKlxuICAgKiBVcGRhdGUuXG4gICAqIFRoaXMgaXMgY2FsbGVkIHdoZW5ldmVyIHRoZSBBcnJheSBtdXRhdGVzLiBJZiB3ZSBoYXZlXG4gICAqIGEgY29tcG9uZW50LCB3ZSBtaWdodCBuZWVkIHRvIHdhaXQgZm9yIGl0IHRvIHJlc29sdmVcbiAgICogYXN5bmNocm9ub3VzbHkuXG4gICAqXG4gICAqIEBwYXJhbSB7QXJyYXl8TnVtYmVyfFN0cmluZ30gZGF0YVxuICAgKi9cblxuICB1cGRhdGU6IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgJiYgIV8uaXNBcnJheShkYXRhKSkge1xuICAgICAgXy53YXJuKFxuICAgICAgICAndi1yZXBlYXQgcHJlLWNvbnZlcnRzIE9iamVjdHMgaW50byBBcnJheXMsIGFuZCAnICtcbiAgICAgICAgJ3YtcmVwZWF0IGZpbHRlcnMgc2hvdWxkIGFsd2F5cyByZXR1cm4gQXJyYXlzLidcbiAgICAgIClcbiAgICB9XG4gICAgaWYgKHRoaXMuY29tcG9uZW50SWQpIHtcbiAgICAgIHZhciBzdGF0ZSA9IHRoaXMuY29tcG9uZW50U3RhdGVcbiAgICAgIGlmIChzdGF0ZSA9PT0gVU5SRVNPTFZFRCkge1xuICAgICAgICB0aGlzLnBlbmRpbmdEYXRhID0gZGF0YVxuICAgICAgICAvLyBvbmNlIHJlc29sdmVkLCBpdCB3aWxsIGNhbGwgcmVhbFVwZGF0ZVxuICAgICAgICB0aGlzLnJlc29sdmVDb21wb25lbnQoKVxuICAgICAgfSBlbHNlIGlmIChzdGF0ZSA9PT0gUEVORElORykge1xuICAgICAgICB0aGlzLnBlbmRpbmdEYXRhID0gZGF0YVxuICAgICAgfSBlbHNlIGlmIChzdGF0ZSA9PT0gUkVTT0xWRUQpIHtcbiAgICAgICAgdGhpcy5yZWFsVXBkYXRlKGRhdGEpXG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMucmVhbFVwZGF0ZShkYXRhKVxuICAgIH1cbiAgfSxcblxuICAvKipcbiAgICogVGhlIHJlYWwgdXBkYXRlIHRoYXQgYWN0dWFsbHkgbW9kaWZpZXMgdGhlIERPTS5cbiAgICpcbiAgICogQHBhcmFtIHtBcnJheXxOdW1iZXJ8U3RyaW5nfSBkYXRhXG4gICAqL1xuXG4gIHJlYWxVcGRhdGU6IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgdGhpcy52bXMgPSB0aGlzLmRpZmYoZGF0YSwgdGhpcy52bXMpXG4gICAgLy8gdXBkYXRlIHYtcmVmXG4gICAgaWYgKHRoaXMucmVmSUQpIHtcbiAgICAgIHRoaXMudm0uJFt0aGlzLnJlZklEXSA9IHRoaXMuY29udmVydGVkXG4gICAgICAgID8gdG9SZWZPYmplY3QodGhpcy52bXMpXG4gICAgICAgIDogdGhpcy52bXNcbiAgICB9XG4gICAgaWYgKHRoaXMuZWxJRCkge1xuICAgICAgdGhpcy52bS4kJFt0aGlzLmVsSURdID0gdGhpcy52bXMubWFwKGZ1bmN0aW9uICh2bSkge1xuICAgICAgICByZXR1cm4gdm0uJGVsXG4gICAgICB9KVxuICAgIH1cbiAgfSxcblxuICAvKipcbiAgICogRGlmZiwgYmFzZWQgb24gbmV3IGRhdGEgYW5kIG9sZCBkYXRhLCBkZXRlcm1pbmUgdGhlXG4gICAqIG1pbmltdW0gYW1vdW50IG9mIERPTSBtYW5pcHVsYXRpb25zIG5lZWRlZCB0byBtYWtlIHRoZVxuICAgKiBET00gcmVmbGVjdCB0aGUgbmV3IGRhdGEgQXJyYXkuXG4gICAqXG4gICAqIFRoZSBhbGdvcml0aG0gZGlmZnMgdGhlIG5ldyBkYXRhIEFycmF5IGJ5IHN0b3JpbmcgYVxuICAgKiBoaWRkZW4gcmVmZXJlbmNlIHRvIGFuIG93bmVyIHZtIGluc3RhbmNlIG9uIHByZXZpb3VzbHlcbiAgICogc2VlbiBkYXRhLiBUaGlzIGFsbG93cyB1cyB0byBhY2hpZXZlIE8obikgd2hpY2ggaXNcbiAgICogYmV0dGVyIHRoYW4gYSBsZXZlbnNodGVpbiBkaXN0YW5jZSBiYXNlZCBhbGdvcml0aG0sXG4gICAqIHdoaWNoIGlzIE8obSAqIG4pLlxuICAgKlxuICAgKiBAcGFyYW0ge0FycmF5fSBkYXRhXG4gICAqIEBwYXJhbSB7QXJyYXl9IG9sZFZtc1xuICAgKiBAcmV0dXJuIHtBcnJheX1cbiAgICovXG5cbiAgZGlmZjogZnVuY3Rpb24gKGRhdGEsIG9sZFZtcykge1xuICAgIHZhciBpZEtleSA9IHRoaXMuaWRLZXlcbiAgICB2YXIgY29udmVydGVkID0gdGhpcy5jb252ZXJ0ZWRcbiAgICB2YXIgc3RhcnQgPSB0aGlzLnN0YXJ0XG4gICAgdmFyIGVuZCA9IHRoaXMuZW5kXG4gICAgdmFyIGluRG9jID0gXy5pbkRvYyhzdGFydClcbiAgICB2YXIgYWxpYXMgPSB0aGlzLmFyZ1xuICAgIHZhciBpbml0ID0gIW9sZFZtc1xuICAgIHZhciB2bXMgPSBuZXcgQXJyYXkoZGF0YS5sZW5ndGgpXG4gICAgdmFyIG9iaiwgcmF3LCB2bSwgaSwgbCwgcHJpbWl0aXZlXG4gICAgLy8gRmlyc3QgcGFzcywgZ28gdGhyb3VnaCB0aGUgbmV3IEFycmF5IGFuZCBmaWxsIHVwXG4gICAgLy8gdGhlIG5ldyB2bXMgYXJyYXkuIElmIGEgcGllY2Ugb2YgZGF0YSBoYXMgYSBjYWNoZWRcbiAgICAvLyBpbnN0YW5jZSBmb3IgaXQsIHdlIHJldXNlIGl0LiBPdGhlcndpc2UgYnVpbGQgYSBuZXdcbiAgICAvLyBpbnN0YW5jZS5cbiAgICBmb3IgKGkgPSAwLCBsID0gZGF0YS5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgIG9iaiA9IGRhdGFbaV1cbiAgICAgIHJhdyA9IGNvbnZlcnRlZCA/IG9iai4kdmFsdWUgOiBvYmpcbiAgICAgIHByaW1pdGl2ZSA9ICFpc09iamVjdChyYXcpXG4gICAgICB2bSA9ICFpbml0ICYmIHRoaXMuZ2V0Vm0ocmF3LCBpLCBjb252ZXJ0ZWQgPyBvYmouJGtleSA6IG51bGwpXG4gICAgICBpZiAodm0pIHsgLy8gcmV1c2FibGUgaW5zdGFuY2VcblxuICAgICAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiB2bS5fcmV1c2VkKSB7XG4gICAgICAgICAgXy53YXJuKFxuICAgICAgICAgICAgJ0R1cGxpY2F0ZSBvYmplY3RzIGZvdW5kIGluIHYtcmVwZWF0PVwiJyArIHRoaXMuZXhwcmVzc2lvbiArICdcIjogJyArXG4gICAgICAgICAgICBKU09OLnN0cmluZ2lmeShyYXcpXG4gICAgICAgICAgKVxuICAgICAgICB9XG5cbiAgICAgICAgdm0uX3JldXNlZCA9IHRydWVcbiAgICAgICAgdm0uJGluZGV4ID0gaSAvLyB1cGRhdGUgJGluZGV4XG4gICAgICAgIC8vIHVwZGF0ZSBkYXRhIGZvciB0cmFjay1ieSBvciBvYmplY3QgcmVwZWF0LFxuICAgICAgICAvLyBzaW5jZSBpbiB0aGVzZSB0d28gY2FzZXMgdGhlIGRhdGEgaXMgcmVwbGFjZWRcbiAgICAgICAgLy8gcmF0aGVyIHRoYW4gbXV0YXRlZC5cbiAgICAgICAgaWYgKGlkS2V5IHx8IGNvbnZlcnRlZCB8fCBwcmltaXRpdmUpIHtcbiAgICAgICAgICBpZiAoYWxpYXMpIHtcbiAgICAgICAgICAgIHZtW2FsaWFzXSA9IHJhd1xuICAgICAgICAgIH0gZWxzZSBpZiAoXy5pc1BsYWluT2JqZWN0KHJhdykpIHtcbiAgICAgICAgICAgIHZtLiRkYXRhID0gcmF3XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHZtLiR2YWx1ZSA9IHJhd1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHsgLy8gbmV3IGluc3RhbmNlXG4gICAgICAgIHZtID0gdGhpcy5idWlsZChvYmosIGksIHRydWUpXG4gICAgICAgIHZtLl9yZXVzZWQgPSBmYWxzZVxuICAgICAgfVxuICAgICAgdm1zW2ldID0gdm1cbiAgICAgIC8vIGluc2VydCBpZiB0aGlzIGlzIGZpcnN0IHJ1blxuICAgICAgaWYgKGluaXQpIHtcbiAgICAgICAgdm0uJGJlZm9yZShlbmQpXG4gICAgICB9XG4gICAgfVxuICAgIC8vIGlmIHRoaXMgaXMgdGhlIGZpcnN0IHJ1biwgd2UncmUgZG9uZS5cbiAgICBpZiAoaW5pdCkge1xuICAgICAgcmV0dXJuIHZtc1xuICAgIH1cbiAgICAvLyBTZWNvbmQgcGFzcywgZ28gdGhyb3VnaCB0aGUgb2xkIHZtIGluc3RhbmNlcyBhbmRcbiAgICAvLyBkZXN0cm95IHRob3NlIHdobyBhcmUgbm90IHJldXNlZCAoYW5kIHJlbW92ZSB0aGVtXG4gICAgLy8gZnJvbSBjYWNoZSlcbiAgICB2YXIgcmVtb3ZhbEluZGV4ID0gMFxuICAgIHZhciB0b3RhbFJlbW92ZWQgPSBvbGRWbXMubGVuZ3RoIC0gdm1zLmxlbmd0aFxuICAgIGZvciAoaSA9IDAsIGwgPSBvbGRWbXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICB2bSA9IG9sZFZtc1tpXVxuICAgICAgaWYgKCF2bS5fcmV1c2VkKSB7XG4gICAgICAgIHRoaXMudW5jYWNoZVZtKHZtKVxuICAgICAgICB2bS4kZGVzdHJveShmYWxzZSwgdHJ1ZSkgLy8gZGVmZXIgY2xlYW51cCB1bnRpbCByZW1vdmFsXG4gICAgICAgIHRoaXMucmVtb3ZlKHZtLCByZW1vdmFsSW5kZXgrKywgdG90YWxSZW1vdmVkLCBpbkRvYylcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gZmluYWwgcGFzcywgbW92ZS9pbnNlcnQgbmV3IGluc3RhbmNlcyBpbnRvIHRoZVxuICAgIC8vIHJpZ2h0IHBsYWNlLlxuICAgIHZhciB0YXJnZXRQcmV2LCBwcmV2RWwsIGN1cnJlbnRQcmV2XG4gICAgdmFyIGluc2VydGlvbkluZGV4ID0gMFxuICAgIGZvciAoaSA9IDAsIGwgPSB2bXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICB2bSA9IHZtc1tpXVxuICAgICAgLy8gdGhpcyBpcyB0aGUgdm0gdGhhdCB3ZSBzaG91bGQgYmUgYWZ0ZXJcbiAgICAgIHRhcmdldFByZXYgPSB2bXNbaSAtIDFdXG4gICAgICBwcmV2RWwgPSB0YXJnZXRQcmV2XG4gICAgICAgID8gdGFyZ2V0UHJldi5fc3RhZ2dlckNiXG4gICAgICAgICAgPyB0YXJnZXRQcmV2Ll9zdGFnZ2VyQW5jaG9yXG4gICAgICAgICAgOiB0YXJnZXRQcmV2Ll9mcmFnbWVudEVuZCB8fCB0YXJnZXRQcmV2LiRlbFxuICAgICAgICA6IHN0YXJ0XG4gICAgICBpZiAodm0uX3JldXNlZCAmJiAhdm0uX3N0YWdnZXJDYikge1xuICAgICAgICBjdXJyZW50UHJldiA9IGZpbmRQcmV2Vm0odm0sIHN0YXJ0LCB0aGlzLmlkKVxuICAgICAgICBpZiAoY3VycmVudFByZXYgIT09IHRhcmdldFByZXYpIHtcbiAgICAgICAgICB0aGlzLm1vdmUodm0sIHByZXZFbClcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gbmV3IGluc3RhbmNlLCBvciBzdGlsbCBpbiBzdGFnZ2VyLlxuICAgICAgICAvLyBpbnNlcnQgd2l0aCB1cGRhdGVkIHN0YWdnZXIgaW5kZXguXG4gICAgICAgIHRoaXMuaW5zZXJ0KHZtLCBpbnNlcnRpb25JbmRleCsrLCBwcmV2RWwsIGluRG9jKVxuICAgICAgfVxuICAgICAgdm0uX3JldXNlZCA9IGZhbHNlXG4gICAgfVxuICAgIHJldHVybiB2bXNcbiAgfSxcblxuICAvKipcbiAgICogQnVpbGQgYSBuZXcgaW5zdGFuY2UgYW5kIGNhY2hlIGl0LlxuICAgKlxuICAgKiBAcGFyYW0ge09iamVjdH0gZGF0YVxuICAgKiBAcGFyYW0ge051bWJlcn0gaW5kZXhcbiAgICogQHBhcmFtIHtCb29sZWFufSBuZWVkQ2FjaGVcbiAgICovXG5cbiAgYnVpbGQ6IGZ1bmN0aW9uIChkYXRhLCBpbmRleCwgbmVlZENhY2hlKSB7XG4gICAgdmFyIG1ldGEgPSB7ICRpbmRleDogaW5kZXggfVxuICAgIGlmICh0aGlzLmNvbnZlcnRlZCkge1xuICAgICAgbWV0YS4ka2V5ID0gZGF0YS4ka2V5XG4gICAgfVxuICAgIHZhciByYXcgPSB0aGlzLmNvbnZlcnRlZCA/IGRhdGEuJHZhbHVlIDogZGF0YVxuICAgIHZhciBhbGlhcyA9IHRoaXMuYXJnXG4gICAgaWYgKGFsaWFzKSB7XG4gICAgICBkYXRhID0ge31cbiAgICAgIGRhdGFbYWxpYXNdID0gcmF3XG4gICAgfSBlbHNlIGlmICghaXNQbGFpbk9iamVjdChyYXcpKSB7XG4gICAgICAvLyBub24tb2JqZWN0IHZhbHVlc1xuICAgICAgZGF0YSA9IHt9XG4gICAgICBtZXRhLiR2YWx1ZSA9IHJhd1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBkZWZhdWx0XG4gICAgICBkYXRhID0gcmF3XG4gICAgfVxuICAgIC8vIHJlc29sdmUgY29uc3RydWN0b3JcbiAgICB2YXIgQ29tcG9uZW50ID0gdGhpcy5Db21wb25lbnQgfHwgdGhpcy5yZXNvbHZlRHluYW1pY0NvbXBvbmVudChkYXRhLCBtZXRhKVxuICAgIHZhciBwYXJlbnQgPSB0aGlzLl9ob3N0IHx8IHRoaXMudm1cbiAgICB2YXIgdm0gPSBwYXJlbnQuJGFkZENoaWxkKHtcbiAgICAgIGVsOiB0ZW1wbGF0ZVBhcnNlci5jbG9uZSh0aGlzLnRlbXBsYXRlKSxcbiAgICAgIGRhdGE6IGRhdGEsXG4gICAgICBpbmhlcml0OiB0aGlzLmlubGluZSxcbiAgICAgIHRlbXBsYXRlOiB0aGlzLmlubGluZVRlbXBsYXRlLFxuICAgICAgLy8gcmVwZWF0ZXIgbWV0YSwgZS5nLiAkaW5kZXgsICRrZXlcbiAgICAgIF9tZXRhOiBtZXRhLFxuICAgICAgLy8gbWFyayB0aGlzIGFzIGFuIGlubGluZS1yZXBlYXQgaW5zdGFuY2VcbiAgICAgIF9yZXBlYXQ6IHRoaXMuaW5saW5lLFxuICAgICAgLy8gaXMgdGhpcyBhIGNvbXBvbmVudD9cbiAgICAgIF9hc0NvbXBvbmVudDogdGhpcy5hc0NvbXBvbmVudCxcbiAgICAgIC8vIGxpbmtlciBjYWNoYWJsZSBpZiBubyBpbmxpbmUtdGVtcGxhdGVcbiAgICAgIF9saW5rZXJDYWNoYWJsZTogIXRoaXMuaW5saW5lVGVtcGxhdGUgJiYgQ29tcG9uZW50ICE9PSBfLlZ1ZSxcbiAgICAgIC8vIHByZS1jb21waWxlZCBsaW5rZXIgZm9yIHNpbXBsZSByZXBlYXRzXG4gICAgICBfbGlua0ZuOiB0aGlzLl9saW5rRm4sXG4gICAgICAvLyBpZGVudGlmaWVyLCBzaG93cyB0aGF0IHRoaXMgdm0gYmVsb25ncyB0byB0aGlzIGNvbGxlY3Rpb25cbiAgICAgIF9yZXBlYXRJZDogdGhpcy5pZCxcbiAgICAgIC8vIHRyYW5zY2x1c2lvbiBjb250ZW50IG93bmVyXG4gICAgICBfY29udGV4dDogdGhpcy52bVxuICAgIH0sIENvbXBvbmVudClcbiAgICAvLyBjYWNoZSBpbnN0YW5jZVxuICAgIGlmIChuZWVkQ2FjaGUpIHtcbiAgICAgIHRoaXMuY2FjaGVWbShyYXcsIHZtLCBpbmRleCwgdGhpcy5jb252ZXJ0ZWQgPyBtZXRhLiRrZXkgOiBudWxsKVxuICAgIH1cbiAgICAvLyBzeW5jIGJhY2sgY2hhbmdlcyBmb3IgdHdvLXdheSBiaW5kaW5ncyBvZiBwcmltaXRpdmUgdmFsdWVzXG4gICAgdmFyIGRpciA9IHRoaXNcbiAgICBpZiAodGhpcy5yYXdUeXBlID09PSAnb2JqZWN0JyAmJiBpc1ByaW1pdGl2ZShyYXcpKSB7XG4gICAgICB2bS4kd2F0Y2goYWxpYXMgfHwgJyR2YWx1ZScsIGZ1bmN0aW9uICh2YWwpIHtcbiAgICAgICAgaWYgKGRpci5maWx0ZXJzKSB7XG4gICAgICAgICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiBfLndhcm4oXG4gICAgICAgICAgICAnWW91IHNlZW0gdG8gYmUgbXV0YXRpbmcgdGhlICR2YWx1ZSByZWZlcmVuY2Ugb2YgJyArXG4gICAgICAgICAgICAnYSB2LXJlcGVhdCBpbnN0YW5jZSAobGlrZWx5IHRocm91Z2ggdi1tb2RlbCkgJyArXG4gICAgICAgICAgICAnYW5kIGZpbHRlcmluZyB0aGUgdi1yZXBlYXQgYXQgdGhlIHNhbWUgdGltZS4gJyArXG4gICAgICAgICAgICAnVGhpcyB3aWxsIG5vdCB3b3JrIHByb3Blcmx5IHdpdGggYW4gQXJyYXkgb2YgJyArXG4gICAgICAgICAgICAncHJpbWl0aXZlIHZhbHVlcy4gUGxlYXNlIHVzZSBhbiBBcnJheSBvZiAnICtcbiAgICAgICAgICAgICdPYmplY3RzIGluc3RlYWQuJ1xuICAgICAgICAgIClcbiAgICAgICAgfVxuICAgICAgICBkaXIuX3dpdGhMb2NrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICBpZiAoZGlyLmNvbnZlcnRlZCkge1xuICAgICAgICAgICAgZGlyLnJhd1ZhbHVlW3ZtLiRrZXldID0gdmFsXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGRpci5yYXdWYWx1ZS4kc2V0KHZtLiRpbmRleCwgdmFsKVxuICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICAgIH0pXG4gICAgfVxuICAgIHJldHVybiB2bVxuICB9LFxuXG4gIC8qKlxuICAgKiBVbmJpbmQsIHRlYXJkb3duIGV2ZXJ5dGhpbmdcbiAgICovXG5cbiAgdW5iaW5kOiBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5jb21wb25lbnRTdGF0ZSA9IEFCT1JURURcbiAgICBpZiAodGhpcy5yZWZJRCkge1xuICAgICAgdGhpcy52bS4kW3RoaXMucmVmSURdID0gbnVsbFxuICAgIH1cbiAgICBpZiAodGhpcy52bXMpIHtcbiAgICAgIHZhciBpID0gdGhpcy52bXMubGVuZ3RoXG4gICAgICB2YXIgdm1cbiAgICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgdm0gPSB0aGlzLnZtc1tpXVxuICAgICAgICB0aGlzLnVuY2FjaGVWbSh2bSlcbiAgICAgICAgdm0uJGRlc3Ryb3koKVxuICAgICAgfVxuICAgIH1cbiAgfSxcblxuICAvKipcbiAgICogQ2FjaGUgYSB2bSBpbnN0YW5jZSBiYXNlZCBvbiBpdHMgZGF0YS5cbiAgICpcbiAgICogSWYgdGhlIGRhdGEgaXMgYW4gb2JqZWN0LCB3ZSBzYXZlIHRoZSB2bSdzIHJlZmVyZW5jZSBvblxuICAgKiB0aGUgZGF0YSBvYmplY3QgYXMgYSBoaWRkZW4gcHJvcGVydHkuIE90aGVyd2lzZSB3ZVxuICAgKiBjYWNoZSB0aGVtIGluIGFuIG9iamVjdCBhbmQgZm9yIGVhY2ggcHJpbWl0aXZlIHZhbHVlXG4gICAqIHRoZXJlIGlzIGFuIGFycmF5IGluIGNhc2UgdGhlcmUgYXJlIGR1cGxpY2F0ZXMuXG4gICAqXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBkYXRhXG4gICAqIEBwYXJhbSB7VnVlfSB2bVxuICAgKiBAcGFyYW0ge051bWJlcn0gaW5kZXhcbiAgICogQHBhcmFtIHtTdHJpbmd9IFtrZXldXG4gICAqL1xuXG4gIGNhY2hlVm06IGZ1bmN0aW9uIChkYXRhLCB2bSwgaW5kZXgsIGtleSkge1xuICAgIHZhciBpZEtleSA9IHRoaXMuaWRLZXlcbiAgICB2YXIgY2FjaGUgPSB0aGlzLmNhY2hlXG4gICAgdmFyIHByaW1pdGl2ZSA9ICFpc09iamVjdChkYXRhKVxuICAgIHZhciBpZFxuICAgIGlmIChrZXkgfHwgaWRLZXkgfHwgcHJpbWl0aXZlKSB7XG4gICAgICBpZCA9IGlkS2V5XG4gICAgICAgID8gaWRLZXkgPT09ICckaW5kZXgnXG4gICAgICAgICAgPyBpbmRleFxuICAgICAgICAgIDogZGF0YVtpZEtleV1cbiAgICAgICAgOiAoa2V5IHx8IGluZGV4KVxuICAgICAgaWYgKCFjYWNoZVtpZF0pIHtcbiAgICAgICAgY2FjaGVbaWRdID0gdm1cbiAgICAgIH0gZWxzZSBpZiAoIXByaW1pdGl2ZSAmJiBpZEtleSAhPT0gJyRpbmRleCcpIHtcbiAgICAgICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiBfLndhcm4oXG4gICAgICAgICAgJ0R1cGxpY2F0ZSBvYmplY3RzIHdpdGggdGhlIHNhbWUgdHJhY2stYnkga2V5IGluIHYtcmVwZWF0OiAnICsgaWRcbiAgICAgICAgKVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBpZCA9IHRoaXMuaWRcbiAgICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KGlkKSkge1xuICAgICAgICBpZiAoZGF0YVtpZF0gPT09IG51bGwpIHtcbiAgICAgICAgICBkYXRhW2lkXSA9IHZtXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiBfLndhcm4oXG4gICAgICAgICAgICAnRHVwbGljYXRlIG9iamVjdHMgZm91bmQgaW4gdi1yZXBlYXQ9XCInICsgdGhpcy5leHByZXNzaW9uICsgJ1wiOiAnICtcbiAgICAgICAgICAgIEpTT04uc3RyaW5naWZ5KGRhdGEpXG4gICAgICAgICAgKVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBfLmRlZmluZShkYXRhLCBpZCwgdm0pXG4gICAgICB9XG4gICAgfVxuICAgIHZtLl9yYXcgPSBkYXRhXG4gIH0sXG5cbiAgLyoqXG4gICAqIFRyeSB0byBnZXQgYSBjYWNoZWQgaW5zdGFuY2UgZnJvbSBhIHBpZWNlIG9mIGRhdGEuXG4gICAqXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBkYXRhXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBpbmRleFxuICAgKiBAcGFyYW0ge1N0cmluZ30gW2tleV1cbiAgICogQHJldHVybiB7VnVlfHVuZGVmaW5lZH1cbiAgICovXG5cbiAgZ2V0Vm06IGZ1bmN0aW9uIChkYXRhLCBpbmRleCwga2V5KSB7XG4gICAgdmFyIGlkS2V5ID0gdGhpcy5pZEtleVxuICAgIHZhciBwcmltaXRpdmUgPSAhaXNPYmplY3QoZGF0YSlcbiAgICBpZiAoa2V5IHx8IGlkS2V5IHx8IHByaW1pdGl2ZSkge1xuICAgICAgdmFyIGlkID0gaWRLZXlcbiAgICAgICAgPyBpZEtleSA9PT0gJyRpbmRleCdcbiAgICAgICAgICA/IGluZGV4XG4gICAgICAgICAgOiBkYXRhW2lkS2V5XVxuICAgICAgICA6IChrZXkgfHwgaW5kZXgpXG4gICAgICByZXR1cm4gdGhpcy5jYWNoZVtpZF1cbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGRhdGFbdGhpcy5pZF1cbiAgICB9XG4gIH0sXG5cbiAgLyoqXG4gICAqIERlbGV0ZSBhIGNhY2hlZCB2bSBpbnN0YW5jZS5cbiAgICpcbiAgICogQHBhcmFtIHtWdWV9IHZtXG4gICAqL1xuXG4gIHVuY2FjaGVWbTogZnVuY3Rpb24gKHZtKSB7XG4gICAgdmFyIGRhdGEgPSB2bS5fcmF3XG4gICAgdmFyIGlkS2V5ID0gdGhpcy5pZEtleVxuICAgIHZhciBpbmRleCA9IHZtLiRpbmRleFxuICAgIC8vIGZpeCAjOTQ4OiBhdm9pZCBhY2NpZGVudGFsbHkgZmFsbCB0aHJvdWdoIHRvXG4gICAgLy8gYSBwYXJlbnQgcmVwZWF0ZXIgd2hpY2ggaGFwcGVucyB0byBoYXZlICRrZXkuXG4gICAgdmFyIGtleSA9IHZtLmhhc093blByb3BlcnR5KCcka2V5JykgJiYgdm0uJGtleVxuICAgIHZhciBwcmltaXRpdmUgPSAhaXNPYmplY3QoZGF0YSlcbiAgICBpZiAoaWRLZXkgfHwga2V5IHx8IHByaW1pdGl2ZSkge1xuICAgICAgdmFyIGlkID0gaWRLZXlcbiAgICAgICAgPyBpZEtleSA9PT0gJyRpbmRleCdcbiAgICAgICAgICA/IGluZGV4XG4gICAgICAgICAgOiBkYXRhW2lkS2V5XVxuICAgICAgICA6IChrZXkgfHwgaW5kZXgpXG4gICAgICB0aGlzLmNhY2hlW2lkXSA9IG51bGxcbiAgICB9IGVsc2Uge1xuICAgICAgZGF0YVt0aGlzLmlkXSA9IG51bGxcbiAgICAgIHZtLl9yYXcgPSBudWxsXG4gICAgfVxuICB9LFxuXG4gIC8qKlxuICAgKiBJbnNlcnQgYW4gaW5zdGFuY2UuXG4gICAqXG4gICAqIEBwYXJhbSB7VnVlfSB2bVxuICAgKiBAcGFyYW0ge051bWJlcn0gaW5kZXhcbiAgICogQHBhcmFtIHtOb2RlfSBwcmV2RWxcbiAgICogQHBhcmFtIHtCb29sZWFufSBpbkRvY1xuICAgKi9cblxuICBpbnNlcnQ6IGZ1bmN0aW9uICh2bSwgaW5kZXgsIHByZXZFbCwgaW5Eb2MpIHtcbiAgICBpZiAodm0uX3N0YWdnZXJDYikge1xuICAgICAgdm0uX3N0YWdnZXJDYi5jYW5jZWwoKVxuICAgICAgdm0uX3N0YWdnZXJDYiA9IG51bGxcbiAgICB9XG4gICAgdmFyIHN0YWdnZXJBbW91bnQgPSB0aGlzLmdldFN0YWdnZXIodm0sIGluZGV4LCBudWxsLCAnZW50ZXInKVxuICAgIGlmIChpbkRvYyAmJiBzdGFnZ2VyQW1vdW50KSB7XG4gICAgICAvLyBjcmVhdGUgYW4gYW5jaG9yIGFuZCBpbnNlcnQgaXQgc3luY2hyb25vdXNseSxcbiAgICAgIC8vIHNvIHRoYXQgd2UgY2FuIHJlc29sdmUgdGhlIGNvcnJlY3Qgb3JkZXIgd2l0aG91dFxuICAgICAgLy8gd29ycnlpbmcgYWJvdXQgc29tZSBlbGVtZW50cyBub3QgaW5zZXJ0ZWQgeWV0XG4gICAgICB2YXIgYW5jaG9yID0gdm0uX3N0YWdnZXJBbmNob3JcbiAgICAgIGlmICghYW5jaG9yKSB7XG4gICAgICAgIGFuY2hvciA9IHZtLl9zdGFnZ2VyQW5jaG9yID0gXy5jcmVhdGVBbmNob3IoJ3N0YWdnZXItYW5jaG9yJylcbiAgICAgICAgYW5jaG9yLl9fdnVlX18gPSB2bVxuICAgICAgfVxuICAgICAgXy5hZnRlcihhbmNob3IsIHByZXZFbClcbiAgICAgIHZhciBvcCA9IHZtLl9zdGFnZ2VyQ2IgPSBfLmNhbmNlbGxhYmxlKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdm0uX3N0YWdnZXJDYiA9IG51bGxcbiAgICAgICAgdm0uJGJlZm9yZShhbmNob3IpXG4gICAgICAgIF8ucmVtb3ZlKGFuY2hvcilcbiAgICAgIH0pXG4gICAgICBzZXRUaW1lb3V0KG9wLCBzdGFnZ2VyQW1vdW50KVxuICAgIH0gZWxzZSB7XG4gICAgICB2bS4kYWZ0ZXIocHJldkVsKVxuICAgIH1cbiAgfSxcblxuICAvKipcbiAgICogTW92ZSBhbiBhbHJlYWR5IGluc2VydGVkIGluc3RhbmNlLlxuICAgKlxuICAgKiBAcGFyYW0ge1Z1ZX0gdm1cbiAgICogQHBhcmFtIHtOb2RlfSBwcmV2RWxcbiAgICovXG5cbiAgbW92ZTogZnVuY3Rpb24gKHZtLCBwcmV2RWwpIHtcbiAgICB2bS4kYWZ0ZXIocHJldkVsLCBudWxsLCBmYWxzZSlcbiAgfSxcblxuICAvKipcbiAgICogUmVtb3ZlIGFuIGluc3RhbmNlLlxuICAgKlxuICAgKiBAcGFyYW0ge1Z1ZX0gdm1cbiAgICogQHBhcmFtIHtOdW1iZXJ9IGluZGV4XG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gaW5Eb2NcbiAgICovXG5cbiAgcmVtb3ZlOiBmdW5jdGlvbiAodm0sIGluZGV4LCB0b3RhbCwgaW5Eb2MpIHtcbiAgICBpZiAodm0uX3N0YWdnZXJDYikge1xuICAgICAgdm0uX3N0YWdnZXJDYi5jYW5jZWwoKVxuICAgICAgdm0uX3N0YWdnZXJDYiA9IG51bGxcbiAgICAgIC8vIGl0J3Mgbm90IHBvc3NpYmxlIGZvciB0aGUgc2FtZSB2bSB0byBiZSByZW1vdmVkXG4gICAgICAvLyB0d2ljZSwgc28gaWYgd2UgaGF2ZSBhIHBlbmRpbmcgc3RhZ2dlciBjYWxsYmFjayxcbiAgICAgIC8vIGl0IG1lYW5zIHRoaXMgdm0gaXMgcXVldWVkIGZvciBlbnRlciBidXQgcmVtb3ZlZFxuICAgICAgLy8gYmVmb3JlIGl0cyB0cmFuc2l0aW9uIHN0YXJ0ZWQuIFNpbmNlIGl0IGlzIGFscmVhZHlcbiAgICAgIC8vIGRlc3Ryb3llZCwgd2UgY2FuIGp1c3QgbGVhdmUgaXQgaW4gZGV0YWNoZWQgc3RhdGUuXG4gICAgICByZXR1cm5cbiAgICB9XG4gICAgdmFyIHN0YWdnZXJBbW91bnQgPSB0aGlzLmdldFN0YWdnZXIodm0sIGluZGV4LCB0b3RhbCwgJ2xlYXZlJylcbiAgICBpZiAoaW5Eb2MgJiYgc3RhZ2dlckFtb3VudCkge1xuICAgICAgdmFyIG9wID0gdm0uX3N0YWdnZXJDYiA9IF8uY2FuY2VsbGFibGUoZnVuY3Rpb24gKCkge1xuICAgICAgICB2bS5fc3RhZ2dlckNiID0gbnVsbFxuICAgICAgICByZW1vdmUoKVxuICAgICAgfSlcbiAgICAgIHNldFRpbWVvdXQob3AsIHN0YWdnZXJBbW91bnQpXG4gICAgfSBlbHNlIHtcbiAgICAgIHJlbW92ZSgpXG4gICAgfVxuICAgIGZ1bmN0aW9uIHJlbW92ZSAoKSB7XG4gICAgICB2bS4kcmVtb3ZlKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdm0uX2NsZWFudXAoKVxuICAgICAgfSlcbiAgICB9XG4gIH0sXG5cbiAgLyoqXG4gICAqIEdldCB0aGUgc3RhZ2dlciBhbW91bnQgZm9yIGFuIGluc2VydGlvbi9yZW1vdmFsLlxuICAgKlxuICAgKiBAcGFyYW0ge1Z1ZX0gdm1cbiAgICogQHBhcmFtIHtOdW1iZXJ9IGluZGV4XG4gICAqIEBwYXJhbSB7U3RyaW5nfSB0eXBlXG4gICAqIEBwYXJhbSB7TnVtYmVyfSB0b3RhbFxuICAgKi9cblxuICBnZXRTdGFnZ2VyOiBmdW5jdGlvbiAodm0sIGluZGV4LCB0b3RhbCwgdHlwZSkge1xuICAgIHR5cGUgPSB0eXBlICsgJ1N0YWdnZXInXG4gICAgdmFyIHRyYW5zaXRpb24gPSB2bS4kZWwuX192X3RyYW5zXG4gICAgdmFyIGhvb2tzID0gdHJhbnNpdGlvbiAmJiB0cmFuc2l0aW9uLmhvb2tzXG4gICAgdmFyIGhvb2sgPSBob29rcyAmJiAoaG9va3NbdHlwZV0gfHwgaG9va3Muc3RhZ2dlcilcbiAgICByZXR1cm4gaG9va1xuICAgICAgPyBob29rLmNhbGwodm0sIGluZGV4LCB0b3RhbClcbiAgICAgIDogaW5kZXggKiB0aGlzW3R5cGVdXG4gIH0sXG5cbiAgLyoqXG4gICAqIFByZS1wcm9jZXNzIHRoZSB2YWx1ZSBiZWZvcmUgcGlwaW5nIGl0IHRocm91Z2ggdGhlXG4gICAqIGZpbHRlcnMsIGFuZCBjb252ZXJ0IG5vbi1BcnJheSBvYmplY3RzIHRvIGFycmF5cy5cbiAgICpcbiAgICogVGhpcyBmdW5jdGlvbiB3aWxsIGJlIGJvdW5kIHRvIHRoaXMgZGlyZWN0aXZlIGluc3RhbmNlXG4gICAqIGFuZCBwYXNzZWQgaW50byB0aGUgd2F0Y2hlci5cbiAgICpcbiAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgKiBAcmV0dXJuIHtBcnJheX1cbiAgICogQHByaXZhdGVcbiAgICovXG5cbiAgX3ByZVByb2Nlc3M6IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgIC8vIHJlZ2FyZGxlc3Mgb2YgdHlwZSwgc3RvcmUgdGhlIHVuLWZpbHRlcmVkIHJhdyB2YWx1ZS5cbiAgICB0aGlzLnJhd1ZhbHVlID0gdmFsdWVcbiAgICB2YXIgdHlwZSA9IHRoaXMucmF3VHlwZSA9IHR5cGVvZiB2YWx1ZVxuICAgIGlmICghaXNQbGFpbk9iamVjdCh2YWx1ZSkpIHtcbiAgICAgIHRoaXMuY29udmVydGVkID0gZmFsc2VcbiAgICAgIGlmICh0eXBlID09PSAnbnVtYmVyJykge1xuICAgICAgICB2YWx1ZSA9IHJhbmdlKHZhbHVlKVxuICAgICAgfSBlbHNlIGlmICh0eXBlID09PSAnc3RyaW5nJykge1xuICAgICAgICB2YWx1ZSA9IF8udG9BcnJheSh2YWx1ZSlcbiAgICAgIH1cbiAgICAgIHJldHVybiB2YWx1ZSB8fCBbXVxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBjb252ZXJ0IHBsYWluIG9iamVjdCB0byBhcnJheS5cbiAgICAgIHZhciBrZXlzID0gT2JqZWN0LmtleXModmFsdWUpXG4gICAgICB2YXIgaSA9IGtleXMubGVuZ3RoXG4gICAgICB2YXIgcmVzID0gbmV3IEFycmF5KGkpXG4gICAgICB2YXIga2V5XG4gICAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgIGtleSA9IGtleXNbaV1cbiAgICAgICAgcmVzW2ldID0ge1xuICAgICAgICAgICRrZXk6IGtleSxcbiAgICAgICAgICAkdmFsdWU6IHZhbHVlW2tleV1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhpcy5jb252ZXJ0ZWQgPSB0cnVlXG4gICAgICByZXR1cm4gcmVzXG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogSGVscGVyIHRvIGZpbmQgdGhlIHByZXZpb3VzIGVsZW1lbnQgdGhhdCBpcyBhbiBpbnN0YW5jZVxuICogcm9vdCBub2RlLiBUaGlzIGlzIG5lY2Vzc2FyeSBiZWNhdXNlIGEgZGVzdHJveWVkIHZtJ3NcbiAqIGVsZW1lbnQgY291bGQgc3RpbGwgYmUgbGluZ2VyaW5nIGluIHRoZSBET00gYmVmb3JlIGl0c1xuICogbGVhdmluZyB0cmFuc2l0aW9uIGZpbmlzaGVzLCBidXQgaXRzIF9fdnVlX18gcmVmZXJlbmNlXG4gKiBzaG91bGQgaGF2ZSBiZWVuIHJlbW92ZWQgc28gd2UgY2FuIHNraXAgdGhlbS5cbiAqXG4gKiBJZiB0aGlzIGlzIGEgYmxvY2sgcmVwZWF0LCB3ZSB3YW50IHRvIG1ha2Ugc3VyZSB3ZSBvbmx5XG4gKiByZXR1cm4gdm0gdGhhdCBpcyBib3VuZCB0byB0aGlzIHYtcmVwZWF0LiAoc2VlICM5MjkpXG4gKlxuICogQHBhcmFtIHtWdWV9IHZtXG4gKiBAcGFyYW0ge0NvbW1lbnR8VGV4dH0gYW5jaG9yXG4gKiBAcmV0dXJuIHtWdWV9XG4gKi9cblxuZnVuY3Rpb24gZmluZFByZXZWbSAodm0sIGFuY2hvciwgaWQpIHtcbiAgdmFyIGVsID0gdm0uJGVsLnByZXZpb3VzU2libGluZ1xuICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgaWYgKCFlbCkgcmV0dXJuXG4gIHdoaWxlIChcbiAgICAoIWVsLl9fdnVlX18gfHwgZWwuX192dWVfXy4kb3B0aW9ucy5fcmVwZWF0SWQgIT09IGlkKSAmJlxuICAgIGVsICE9PSBhbmNob3JcbiAgKSB7XG4gICAgZWwgPSBlbC5wcmV2aW91c1NpYmxpbmdcbiAgfVxuICByZXR1cm4gZWwuX192dWVfX1xufVxuXG4vKipcbiAqIENyZWF0ZSBhIHJhbmdlIGFycmF5IGZyb20gZ2l2ZW4gbnVtYmVyLlxuICpcbiAqIEBwYXJhbSB7TnVtYmVyfSBuXG4gKiBAcmV0dXJuIHtBcnJheX1cbiAqL1xuXG5mdW5jdGlvbiByYW5nZSAobikge1xuICB2YXIgaSA9IC0xXG4gIHZhciByZXQgPSBuZXcgQXJyYXkobilcbiAgd2hpbGUgKCsraSA8IG4pIHtcbiAgICByZXRbaV0gPSBpXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG4vKipcbiAqIENvbnZlcnQgYSB2bXMgYXJyYXkgdG8gYW4gb2JqZWN0IHJlZiBmb3Igdi1yZWYgb24gYW5cbiAqIE9iamVjdCB2YWx1ZS5cbiAqXG4gKiBAcGFyYW0ge0FycmF5fSB2bXNcbiAqIEByZXR1cm4ge09iamVjdH1cbiAqL1xuXG5mdW5jdGlvbiB0b1JlZk9iamVjdCAodm1zKSB7XG4gIHZhciByZWYgPSB7fVxuICBmb3IgKHZhciBpID0gMCwgbCA9IHZtcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICByZWZbdm1zW2ldLiRrZXldID0gdm1zW2ldXG4gIH1cbiAgcmV0dXJuIHJlZlxufVxuXG4vKipcbiAqIENoZWNrIGlmIGEgdmFsdWUgaXMgYSBwcmltaXRpdmUgb25lOlxuICogU3RyaW5nLCBOdW1iZXIsIEJvb2xlYW4sIG51bGwgb3IgdW5kZWZpbmVkLlxuICpcbiAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKi9cblxuZnVuY3Rpb24gaXNQcmltaXRpdmUgKHZhbHVlKSB7XG4gIHZhciB0eXBlID0gdHlwZW9mIHZhbHVlXG4gIHJldHVybiB2YWx1ZSA9PSBudWxsIHx8XG4gICAgdHlwZSA9PT0gJ3N0cmluZycgfHxcbiAgICB0eXBlID09PSAnbnVtYmVyJyB8fFxuICAgIHR5cGUgPT09ICdib29sZWFuJ1xufVxuIiwidmFyIHRyYW5zaXRpb24gPSByZXF1aXJlKCcuLi90cmFuc2l0aW9uJylcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgdmFyIGVsID0gdGhpcy5lbFxuICB0cmFuc2l0aW9uLmFwcGx5KGVsLCB2YWx1ZSA/IDEgOiAtMSwgZnVuY3Rpb24gKCkge1xuICAgIGVsLnN0eWxlLmRpc3BsYXkgPSB2YWx1ZSA/ICcnIDogJ25vbmUnXG4gIH0sIHRoaXMudm0pXG59XG4iLCJ2YXIgXyA9IHJlcXVpcmUoJy4uL3V0aWwnKVxudmFyIHByZWZpeGVzID0gWyctd2Via2l0LScsICctbW96LScsICctbXMtJ11cbnZhciBjYW1lbFByZWZpeGVzID0gWydXZWJraXQnLCAnTW96JywgJ21zJ11cbnZhciBpbXBvcnRhbnRSRSA9IC8haW1wb3J0YW50Oz8kL1xudmFyIGNhbWVsUkUgPSAvKFthLXpdKShbQS1aXSkvZ1xudmFyIHRlc3RFbCA9IG51bGxcbnZhciBwcm9wQ2FjaGUgPSB7fVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcblxuICBkZWVwOiB0cnVlLFxuXG4gIHVwZGF0ZTogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgaWYgKHRoaXMuYXJnKSB7XG4gICAgICB0aGlzLnNldFByb3AodGhpcy5hcmcsIHZhbHVlKVxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICB0aGlzLm9iamVjdEhhbmRsZXIodmFsdWUpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmVsLnN0eWxlLmNzc1RleHQgPSB2YWx1ZVxuICAgICAgfVxuICAgIH1cbiAgfSxcblxuICBvYmplY3RIYW5kbGVyOiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAvLyBjYWNoZSBvYmplY3Qgc3R5bGVzIHNvIHRoYXQgb25seSBjaGFuZ2VkIHByb3BzXG4gICAgLy8gYXJlIGFjdHVhbGx5IHVwZGF0ZWQuXG4gICAgdmFyIGNhY2hlID0gdGhpcy5jYWNoZSB8fCAodGhpcy5jYWNoZSA9IHt9KVxuICAgIHZhciBwcm9wLCB2YWxcbiAgICBmb3IgKHByb3AgaW4gY2FjaGUpIHtcbiAgICAgIGlmICghKHByb3AgaW4gdmFsdWUpKSB7XG4gICAgICAgIHRoaXMuc2V0UHJvcChwcm9wLCBudWxsKVxuICAgICAgICBkZWxldGUgY2FjaGVbcHJvcF1cbiAgICAgIH1cbiAgICB9XG4gICAgZm9yIChwcm9wIGluIHZhbHVlKSB7XG4gICAgICB2YWwgPSB2YWx1ZVtwcm9wXVxuICAgICAgaWYgKHZhbCAhPT0gY2FjaGVbcHJvcF0pIHtcbiAgICAgICAgY2FjaGVbcHJvcF0gPSB2YWxcbiAgICAgICAgdGhpcy5zZXRQcm9wKHByb3AsIHZhbClcbiAgICAgIH1cbiAgICB9XG4gIH0sXG5cbiAgc2V0UHJvcDogZnVuY3Rpb24gKHByb3AsIHZhbHVlKSB7XG4gICAgcHJvcCA9IG5vcm1hbGl6ZShwcm9wKVxuICAgIGlmICghcHJvcCkgcmV0dXJuIC8vIHVuc3VwcG9ydGVkIHByb3BcbiAgICAvLyBjYXN0IHBvc3NpYmxlIG51bWJlcnMvYm9vbGVhbnMgaW50byBzdHJpbmdzXG4gICAgaWYgKHZhbHVlICE9IG51bGwpIHZhbHVlICs9ICcnXG4gICAgaWYgKHZhbHVlKSB7XG4gICAgICB2YXIgaXNJbXBvcnRhbnQgPSBpbXBvcnRhbnRSRS50ZXN0KHZhbHVlKVxuICAgICAgICA/ICdpbXBvcnRhbnQnXG4gICAgICAgIDogJydcbiAgICAgIGlmIChpc0ltcG9ydGFudCkge1xuICAgICAgICB2YWx1ZSA9IHZhbHVlLnJlcGxhY2UoaW1wb3J0YW50UkUsICcnKS50cmltKClcbiAgICAgIH1cbiAgICAgIHRoaXMuZWwuc3R5bGUuc2V0UHJvcGVydHkocHJvcCwgdmFsdWUsIGlzSW1wb3J0YW50KVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmVsLnN0eWxlLnJlbW92ZVByb3BlcnR5KHByb3ApXG4gICAgfVxuICB9XG5cbn1cblxuLyoqXG4gKiBOb3JtYWxpemUgYSBDU1MgcHJvcGVydHkgbmFtZS5cbiAqIC0gY2FjaGUgcmVzdWx0XG4gKiAtIGF1dG8gcHJlZml4XG4gKiAtIGNhbWVsQ2FzZSAtPiBkYXNoLWNhc2VcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gcHJvcFxuICogQHJldHVybiB7U3RyaW5nfVxuICovXG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZSAocHJvcCkge1xuICBpZiAocHJvcENhY2hlW3Byb3BdKSB7XG4gICAgcmV0dXJuIHByb3BDYWNoZVtwcm9wXVxuICB9XG4gIHZhciByZXMgPSBwcmVmaXgocHJvcClcbiAgcHJvcENhY2hlW3Byb3BdID0gcHJvcENhY2hlW3Jlc10gPSByZXNcbiAgcmV0dXJuIHJlc1xufVxuXG4vKipcbiAqIEF1dG8gZGV0ZWN0IHRoZSBhcHByb3ByaWF0ZSBwcmVmaXggZm9yIGEgQ1NTIHByb3BlcnR5LlxuICogaHR0cHM6Ly9naXN0LmdpdGh1Yi5jb20vcGF1bGlyaXNoLzUyMzY5MlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBwcm9wXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKi9cblxuZnVuY3Rpb24gcHJlZml4IChwcm9wKSB7XG4gIHByb3AgPSBwcm9wLnJlcGxhY2UoY2FtZWxSRSwgJyQxLSQyJykudG9Mb3dlckNhc2UoKVxuICB2YXIgY2FtZWwgPSBfLmNhbWVsaXplKHByb3ApXG4gIHZhciB1cHBlciA9IGNhbWVsLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsgY2FtZWwuc2xpY2UoMSlcbiAgaWYgKCF0ZXN0RWwpIHtcbiAgICB0ZXN0RWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKVxuICB9XG4gIGlmIChjYW1lbCBpbiB0ZXN0RWwuc3R5bGUpIHtcbiAgICByZXR1cm4gcHJvcFxuICB9XG4gIHZhciBpID0gcHJlZml4ZXMubGVuZ3RoXG4gIHZhciBwcmVmaXhlZFxuICB3aGlsZSAoaS0tKSB7XG4gICAgcHJlZml4ZWQgPSBjYW1lbFByZWZpeGVzW2ldICsgdXBwZXJcbiAgICBpZiAocHJlZml4ZWQgaW4gdGVzdEVsLnN0eWxlKSB7XG4gICAgICByZXR1cm4gcHJlZml4ZXNbaV0gKyBwcm9wXG4gICAgfVxuICB9XG59XG4iLCJ2YXIgXyA9IHJlcXVpcmUoJy4uL3V0aWwnKVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcblxuICBiaW5kOiBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5hdHRyID0gdGhpcy5lbC5ub2RlVHlwZSA9PT0gM1xuICAgICAgPyAnZGF0YSdcbiAgICAgIDogJ3RleHRDb250ZW50J1xuICB9LFxuXG4gIHVwZGF0ZTogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgdGhpcy5lbFt0aGlzLmF0dHJdID0gXy50b1N0cmluZyh2YWx1ZSlcbiAgfVxufVxuIiwidmFyIF8gPSByZXF1aXJlKCcuLi91dGlsJylcbnZhciBUcmFuc2l0aW9uID0gcmVxdWlyZSgnLi4vdHJhbnNpdGlvbi90cmFuc2l0aW9uJylcblxubW9kdWxlLmV4cG9ydHMgPSB7XG5cbiAgcHJpb3JpdHk6IDEwMDAsXG4gIGlzTGl0ZXJhbDogdHJ1ZSxcblxuICBiaW5kOiBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKCF0aGlzLl9pc0R5bmFtaWNMaXRlcmFsKSB7XG4gICAgICB0aGlzLnVwZGF0ZSh0aGlzLmV4cHJlc3Npb24pXG4gICAgfVxuICB9LFxuXG4gIHVwZGF0ZTogZnVuY3Rpb24gKGlkLCBvbGRJZCkge1xuICAgIHZhciBlbCA9IHRoaXMuZWxcbiAgICB2YXIgdm0gPSB0aGlzLmVsLl9fdnVlX18gfHwgdGhpcy52bVxuICAgIHZhciBob29rcyA9IF8ucmVzb2x2ZUFzc2V0KHZtLiRvcHRpb25zLCAndHJhbnNpdGlvbnMnLCBpZClcbiAgICBpZCA9IGlkIHx8ICd2J1xuICAgIGVsLl9fdl90cmFucyA9IG5ldyBUcmFuc2l0aW9uKGVsLCBpZCwgaG9va3MsIHZtKVxuICAgIGlmIChvbGRJZCkge1xuICAgICAgXy5yZW1vdmVDbGFzcyhlbCwgb2xkSWQgKyAnLXRyYW5zaXRpb24nKVxuICAgIH1cbiAgICBfLmFkZENsYXNzKGVsLCBpZCArICctdHJhbnNpdGlvbicpXG4gIH1cbn1cbiIsInZhciBfID0gcmVxdWlyZSgnLi4vdXRpbCcpXG52YXIgY2xvbmUgPSByZXF1aXJlKCcuLi9wYXJzZXJzL3RlbXBsYXRlJykuY2xvbmVcblxuLy8gVGhpcyBpcyB0aGUgZWxlbWVudERpcmVjdGl2ZSB0aGF0IGhhbmRsZXMgPGNvbnRlbnQ+XG4vLyB0cmFuc2NsdXNpb25zLiBJdCByZWxpZXMgb24gdGhlIHJhdyBjb250ZW50IG9mIGFuXG4vLyBpbnN0YW5jZSBiZWluZyBzdG9yZWQgYXMgYCRvcHRpb25zLl9jb250ZW50YCBkdXJpbmdcbi8vIHRoZSB0cmFuc2NsdWRlIHBoYXNlLlxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcblxuICBiaW5kOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHZtID0gdGhpcy52bVxuICAgIHZhciBob3N0ID0gdm1cbiAgICAvLyB3ZSBuZWVkIGZpbmQgdGhlIGNvbnRlbnQgY29udGV4dCwgd2hpY2ggaXMgdGhlXG4gICAgLy8gY2xvc2VzdCBub24taW5saW5lLXJlcGVhdGVyIGluc3RhbmNlLlxuICAgIHdoaWxlIChob3N0LiRvcHRpb25zLl9yZXBlYXQpIHtcbiAgICAgIGhvc3QgPSBob3N0LiRwYXJlbnRcbiAgICB9XG4gICAgdmFyIHJhdyA9IGhvc3QuJG9wdGlvbnMuX2NvbnRlbnRcbiAgICB2YXIgY29udGVudFxuICAgIGlmICghcmF3KSB7XG4gICAgICB0aGlzLmZhbGxiYWNrKClcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICB2YXIgY29udGV4dCA9IGhvc3QuX2NvbnRleHRcbiAgICB2YXIgc2VsZWN0b3IgPSB0aGlzLl9jaGVja1BhcmFtKCdzZWxlY3QnKVxuICAgIGlmICghc2VsZWN0b3IpIHtcbiAgICAgIC8vIERlZmF1bHQgY29udGVudFxuICAgICAgdmFyIHNlbGYgPSB0aGlzXG4gICAgICB2YXIgY29tcGlsZURlZmF1bHRDb250ZW50ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBzZWxmLmNvbXBpbGUoXG4gICAgICAgICAgZXh0cmFjdEZyYWdtZW50KHJhdy5jaGlsZE5vZGVzLCByYXcsIHRydWUpLFxuICAgICAgICAgIGNvbnRleHQsXG4gICAgICAgICAgdm1cbiAgICAgICAgKVxuICAgICAgfVxuICAgICAgaWYgKCFob3N0Ll9pc0NvbXBpbGVkKSB7XG4gICAgICAgIC8vIGRlZmVyIHVudGlsIHRoZSBlbmQgb2YgaW5zdGFuY2UgY29tcGlsYXRpb24sXG4gICAgICAgIC8vIGJlY2F1c2UgdGhlIGRlZmF1bHQgb3V0bGV0IG11c3Qgd2FpdCB1bnRpbCBhbGxcbiAgICAgICAgLy8gb3RoZXIgcG9zc2libGUgb3V0bGV0cyB3aXRoIHNlbGVjdG9ycyBoYXZlIHBpY2tlZFxuICAgICAgICAvLyBvdXQgdGhlaXIgY29udGVudHMuXG4gICAgICAgIGhvc3QuJG9uY2UoJ2hvb2s6Y29tcGlsZWQnLCBjb21waWxlRGVmYXVsdENvbnRlbnQpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb21waWxlRGVmYXVsdENvbnRlbnQoKVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBzZWxlY3QgY29udGVudFxuICAgICAgdmFyIG5vZGVzID0gcmF3LnF1ZXJ5U2VsZWN0b3JBbGwoc2VsZWN0b3IpXG4gICAgICBpZiAobm9kZXMubGVuZ3RoKSB7XG4gICAgICAgIGNvbnRlbnQgPSBleHRyYWN0RnJhZ21lbnQobm9kZXMsIHJhdylcbiAgICAgICAgaWYgKGNvbnRlbnQuaGFzQ2hpbGROb2RlcygpKSB7XG4gICAgICAgICAgdGhpcy5jb21waWxlKGNvbnRlbnQsIGNvbnRleHQsIHZtKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuZmFsbGJhY2soKVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmZhbGxiYWNrKClcbiAgICAgIH1cbiAgICB9XG4gIH0sXG5cbiAgZmFsbGJhY2s6IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmNvbXBpbGUoXy5leHRyYWN0Q29udGVudCh0aGlzLmVsLCB0cnVlKSwgdGhpcy52bSlcbiAgfSxcblxuICBjb21waWxlOiBmdW5jdGlvbiAoY29udGVudCwgY29udGV4dCwgaG9zdCkge1xuICAgIGlmIChjb250ZW50ICYmIGNvbnRleHQpIHtcbiAgICAgIHRoaXMudW5saW5rID0gY29udGV4dC4kY29tcGlsZShjb250ZW50LCBob3N0KVxuICAgIH1cbiAgICBpZiAoY29udGVudCkge1xuICAgICAgXy5yZXBsYWNlKHRoaXMuZWwsIGNvbnRlbnQpXG4gICAgfSBlbHNlIHtcbiAgICAgIF8ucmVtb3ZlKHRoaXMuZWwpXG4gICAgfVxuICB9LFxuXG4gIHVuYmluZDogZnVuY3Rpb24gKCkge1xuICAgIGlmICh0aGlzLnVubGluaykge1xuICAgICAgdGhpcy51bmxpbmsoKVxuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIEV4dHJhY3QgcXVhbGlmaWVkIGNvbnRlbnQgbm9kZXMgZnJvbSBhIG5vZGUgbGlzdC5cbiAqXG4gKiBAcGFyYW0ge05vZGVMaXN0fSBub2Rlc1xuICogQHBhcmFtIHtFbGVtZW50fSBwYXJlbnRcbiAqIEBwYXJhbSB7Qm9vbGVhbn0gbWFpblxuICogQHJldHVybiB7RG9jdW1lbnRGcmFnbWVudH1cbiAqL1xuXG5mdW5jdGlvbiBleHRyYWN0RnJhZ21lbnQgKG5vZGVzLCBwYXJlbnQsIG1haW4pIHtcbiAgdmFyIGZyYWcgPSBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KClcbiAgZm9yICh2YXIgaSA9IDAsIGwgPSBub2Rlcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICB2YXIgbm9kZSA9IG5vZGVzW2ldXG4gICAgLy8gaWYgdGhpcyBpcyB0aGUgbWFpbiBvdXRsZXQsIHdlIHdhbnQgdG8gc2tpcCBhbGxcbiAgICAvLyBwcmV2aW91c2x5IHNlbGVjdGVkIG5vZGVzO1xuICAgIC8vIG90aGVyd2lzZSwgd2Ugd2FudCB0byBtYXJrIHRoZSBub2RlIGFzIHNlbGVjdGVkLlxuICAgIC8vIGNsb25lIHRoZSBub2RlIHNvIHRoZSBvcmlnaW5hbCByYXcgY29udGVudCByZW1haW5zXG4gICAgLy8gaW50YWN0LiB0aGlzIGVuc3VyZXMgcHJvcGVyIHJlLWNvbXBpbGF0aW9uIGluIGNhc2VzXG4gICAgLy8gd2hlcmUgdGhlIG91dGxldCBpcyBpbnNpZGUgYSBjb25kaXRpb25hbCBibG9ja1xuICAgIGlmIChtYWluICYmICFub2RlLl9fdl9zZWxlY3RlZCkge1xuICAgICAgZnJhZy5hcHBlbmRDaGlsZChjbG9uZShub2RlKSlcbiAgICB9IGVsc2UgaWYgKCFtYWluICYmIG5vZGUucGFyZW50Tm9kZSA9PT0gcGFyZW50KSB7XG4gICAgICBub2RlLl9fdl9zZWxlY3RlZCA9IHRydWVcbiAgICAgIGZyYWcuYXBwZW5kQ2hpbGQoY2xvbmUobm9kZSkpXG4gICAgfVxuICB9XG4gIHJldHVybiBmcmFnXG59XG4iLCJleHBvcnRzLmNvbnRlbnQgPSByZXF1aXJlKCcuL2NvbnRlbnQnKVxuZXhwb3J0cy5wYXJ0aWFsID0gcmVxdWlyZSgnLi9wYXJ0aWFsJylcbiIsInZhciBfID0gcmVxdWlyZSgnLi4vdXRpbCcpXG52YXIgdGVtcGxhdGVQYXJzZXIgPSByZXF1aXJlKCcuLi9wYXJzZXJzL3RlbXBsYXRlJylcbnZhciB0ZXh0UGFyc2VyID0gcmVxdWlyZSgnLi4vcGFyc2Vycy90ZXh0JylcbnZhciBjb21waWxlciA9IHJlcXVpcmUoJy4uL2NvbXBpbGVyJylcbnZhciBDYWNoZSA9IHJlcXVpcmUoJy4uL2NhY2hlJylcbnZhciBjYWNoZSA9IG5ldyBDYWNoZSgxMDAwKVxuXG4vLyB2LXBhcnRpYWwgcmV1c2VzIGxvZ2ljIGZyb20gdi1pZlxudmFyIHZJZiA9IHJlcXVpcmUoJy4uL2RpcmVjdGl2ZXMvaWYnKVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcblxuICBsaW5rOiB2SWYubGluayxcbiAgdGVhcmRvd246IHZJZi50ZWFyZG93bixcbiAgZ2V0Q29udGFpbmVkQ29tcG9uZW50czogdklmLmdldENvbnRhaW5lZENvbXBvbmVudHMsXG5cbiAgYmluZDogZnVuY3Rpb24gKCkge1xuICAgIHZhciBlbCA9IHRoaXMuZWxcbiAgICB0aGlzLnN0YXJ0ID0gXy5jcmVhdGVBbmNob3IoJ3YtcGFydGlhbC1zdGFydCcpXG4gICAgdGhpcy5lbmQgPSBfLmNyZWF0ZUFuY2hvcigndi1wYXJ0aWFsLWVuZCcpXG4gICAgXy5yZXBsYWNlKGVsLCB0aGlzLmVuZClcbiAgICBfLmJlZm9yZSh0aGlzLnN0YXJ0LCB0aGlzLmVuZClcbiAgICB2YXIgaWQgPSBlbC5nZXRBdHRyaWJ1dGUoJ25hbWUnKVxuICAgIHZhciB0b2tlbnMgPSB0ZXh0UGFyc2VyLnBhcnNlKGlkKVxuICAgIGlmICh0b2tlbnMpIHtcbiAgICAgIC8vIGR5bmFtaWMgcGFydGlhbFxuICAgICAgdGhpcy5zZXR1cER5bmFtaWModG9rZW5zKVxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBzdGF0aWMgcGFydGlhbFxuICAgICAgdGhpcy5pbnNlcnQoaWQpXG4gICAgfVxuICB9LFxuXG4gIHNldHVwRHluYW1pYzogZnVuY3Rpb24gKHRva2Vucykge1xuICAgIHZhciBzZWxmID0gdGhpc1xuICAgIHZhciBleHAgPSB0ZXh0UGFyc2VyLnRva2Vuc1RvRXhwKHRva2VucylcbiAgICB0aGlzLnVud2F0Y2ggPSB0aGlzLnZtLiR3YXRjaChleHAsIGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgc2VsZi50ZWFyZG93bigpXG4gICAgICBzZWxmLmluc2VydCh2YWx1ZSlcbiAgICB9LCB7XG4gICAgICBpbW1lZGlhdGU6IHRydWUsXG4gICAgICB1c2VyOiBmYWxzZVxuICAgIH0pXG4gIH0sXG5cbiAgaW5zZXJ0OiBmdW5jdGlvbiAoaWQpIHtcbiAgICB2YXIgcGFydGlhbCA9IF8ucmVzb2x2ZUFzc2V0KHRoaXMudm0uJG9wdGlvbnMsICdwYXJ0aWFscycsIGlkKVxuICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgICBfLmFzc2VydEFzc2V0KHBhcnRpYWwsICdwYXJ0aWFsJywgaWQpXG4gICAgfVxuICAgIGlmIChwYXJ0aWFsKSB7XG4gICAgICB2YXIgZnJhZyA9IHRlbXBsYXRlUGFyc2VyLnBhcnNlKHBhcnRpYWwsIHRydWUpXG4gICAgICAvLyBjYWNoZSBwYXJ0aWFscyBiYXNlZCBvbiBjb25zdHJ1Y3RvciBpZC5cbiAgICAgIHZhciBjYWNoZUlkID0gKHRoaXMudm0uY29uc3RydWN0b3IuY2lkIHx8ICcnKSArIHBhcnRpYWxcbiAgICAgIHZhciBsaW5rZXIgPSB0aGlzLmNvbXBpbGUoZnJhZywgY2FjaGVJZClcbiAgICAgIC8vIHRoaXMgaXMgcHJvdmlkZWQgYnkgdi1pZlxuICAgICAgdGhpcy5saW5rKGZyYWcsIGxpbmtlcilcbiAgICB9XG4gIH0sXG5cbiAgY29tcGlsZTogZnVuY3Rpb24gKGZyYWcsIGNhY2hlSWQpIHtcbiAgICB2YXIgaGl0ID0gY2FjaGUuZ2V0KGNhY2hlSWQpXG4gICAgaWYgKGhpdCkgcmV0dXJuIGhpdFxuICAgIHZhciBsaW5rZXIgPSBjb21waWxlci5jb21waWxlKGZyYWcsIHRoaXMudm0uJG9wdGlvbnMsIHRydWUpXG4gICAgY2FjaGUucHV0KGNhY2hlSWQsIGxpbmtlcilcbiAgICByZXR1cm4gbGlua2VyXG4gIH0sXG5cbiAgdW5iaW5kOiBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKHRoaXMudW5saW5rKSB0aGlzLnVubGluaygpXG4gICAgaWYgKHRoaXMudW53YXRjaCkgdGhpcy51bndhdGNoKClcbiAgfVxufVxuIiwidmFyIF8gPSByZXF1aXJlKCcuLi91dGlsJylcbnZhciBQYXRoID0gcmVxdWlyZSgnLi4vcGFyc2Vycy9wYXRoJylcblxuLyoqXG4gKiBGaWx0ZXIgZmlsdGVyIGZvciB2LXJlcGVhdFxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzZWFyY2hLZXlcbiAqIEBwYXJhbSB7U3RyaW5nfSBbZGVsaW1pdGVyXVxuICogQHBhcmFtIHtTdHJpbmd9IGRhdGFLZXlcbiAqL1xuXG5leHBvcnRzLmZpbHRlckJ5ID0gZnVuY3Rpb24gKGFyciwgc2VhcmNoLCBkZWxpbWl0ZXIgLyogLi4uZGF0YUtleXMgKi8pIHtcbiAgaWYgKHNlYXJjaCA9PSBudWxsKSB7XG4gICAgcmV0dXJuIGFyclxuICB9XG4gIGlmICh0eXBlb2Ygc2VhcmNoID09PSAnZnVuY3Rpb24nKSB7XG4gICAgcmV0dXJuIGFyci5maWx0ZXIoc2VhcmNoKVxuICB9XG4gIC8vIGNhc3QgdG8gbG93ZXJjYXNlIHN0cmluZ1xuICBzZWFyY2ggPSAoJycgKyBzZWFyY2gpLnRvTG93ZXJDYXNlKClcbiAgLy8gYWxsb3cgb3B0aW9uYWwgYGluYCBkZWxpbWl0ZXJcbiAgLy8gYmVjYXVzZSB3aHkgbm90XG4gIHZhciBuID0gZGVsaW1pdGVyID09PSAnaW4nID8gMyA6IDJcbiAgLy8gZXh0cmFjdCBhbmQgZmxhdHRlbiBrZXlzXG4gIHZhciBrZXlzID0gXy50b0FycmF5KGFyZ3VtZW50cywgbikucmVkdWNlKGZ1bmN0aW9uIChwcmV2LCBjdXIpIHtcbiAgICByZXR1cm4gcHJldi5jb25jYXQoY3VyKVxuICB9LCBbXSlcbiAgcmV0dXJuIGFyci5maWx0ZXIoZnVuY3Rpb24gKGl0ZW0pIHtcbiAgICByZXR1cm4ga2V5cy5sZW5ndGhcbiAgICAgID8ga2V5cy5zb21lKGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgICByZXR1cm4gY29udGFpbnMoUGF0aC5nZXQoaXRlbSwga2V5KSwgc2VhcmNoKVxuICAgICAgICB9KVxuICAgICAgOiBjb250YWlucyhpdGVtLCBzZWFyY2gpXG4gIH0pXG59XG5cbi8qKlxuICogRmlsdGVyIGZpbHRlciBmb3Igdi1yZXBlYXRcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gc29ydEtleVxuICogQHBhcmFtIHtTdHJpbmd9IHJldmVyc2VcbiAqL1xuXG5leHBvcnRzLm9yZGVyQnkgPSBmdW5jdGlvbiAoYXJyLCBzb3J0S2V5LCByZXZlcnNlKSB7XG4gIGlmICghc29ydEtleSkge1xuICAgIHJldHVybiBhcnJcbiAgfVxuICB2YXIgb3JkZXIgPSAxXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMikge1xuICAgIGlmIChyZXZlcnNlID09PSAnLTEnKSB7XG4gICAgICBvcmRlciA9IC0xXG4gICAgfSBlbHNlIHtcbiAgICAgIG9yZGVyID0gcmV2ZXJzZSA/IC0xIDogMVxuICAgIH1cbiAgfVxuICAvLyBzb3J0IG9uIGEgY29weSB0byBhdm9pZCBtdXRhdGluZyBvcmlnaW5hbCBhcnJheVxuICByZXR1cm4gYXJyLnNsaWNlKCkuc29ydChmdW5jdGlvbiAoYSwgYikge1xuICAgIGlmIChzb3J0S2V5ICE9PSAnJGtleScgJiYgc29ydEtleSAhPT0gJyR2YWx1ZScpIHtcbiAgICAgIGlmIChhICYmICckdmFsdWUnIGluIGEpIGEgPSBhLiR2YWx1ZVxuICAgICAgaWYgKGIgJiYgJyR2YWx1ZScgaW4gYikgYiA9IGIuJHZhbHVlXG4gICAgfVxuICAgIGEgPSBfLmlzT2JqZWN0KGEpID8gUGF0aC5nZXQoYSwgc29ydEtleSkgOiBhXG4gICAgYiA9IF8uaXNPYmplY3QoYikgPyBQYXRoLmdldChiLCBzb3J0S2V5KSA6IGJcbiAgICByZXR1cm4gYSA9PT0gYiA/IDAgOiBhID4gYiA/IG9yZGVyIDogLW9yZGVyXG4gIH0pXG59XG5cbi8qKlxuICogU3RyaW5nIGNvbnRhaW4gaGVscGVyXG4gKlxuICogQHBhcmFtIHsqfSB2YWxcbiAqIEBwYXJhbSB7U3RyaW5nfSBzZWFyY2hcbiAqL1xuXG5mdW5jdGlvbiBjb250YWlucyAodmFsLCBzZWFyY2gpIHtcbiAgaWYgKF8uaXNQbGFpbk9iamVjdCh2YWwpKSB7XG4gICAgZm9yICh2YXIga2V5IGluIHZhbCkge1xuICAgICAgaWYgKGNvbnRhaW5zKHZhbFtrZXldLCBzZWFyY2gpKSB7XG4gICAgICAgIHJldHVybiB0cnVlXG4gICAgICB9XG4gICAgfVxuICB9IGVsc2UgaWYgKF8uaXNBcnJheSh2YWwpKSB7XG4gICAgdmFyIGkgPSB2YWwubGVuZ3RoXG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgaWYgKGNvbnRhaW5zKHZhbFtpXSwgc2VhcmNoKSkge1xuICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgfVxuICAgIH1cbiAgfSBlbHNlIGlmICh2YWwgIT0gbnVsbCkge1xuICAgIHJldHVybiB2YWwudG9TdHJpbmcoKS50b0xvd2VyQ2FzZSgpLmluZGV4T2Yoc2VhcmNoKSA+IC0xXG4gIH1cbn1cbiIsInZhciBfID0gcmVxdWlyZSgnLi4vdXRpbCcpXG5cbi8qKlxuICogU3RyaW5naWZ5IHZhbHVlLlxuICpcbiAqIEBwYXJhbSB7TnVtYmVyfSBpbmRlbnRcbiAqL1xuXG5leHBvcnRzLmpzb24gPSB7XG4gIHJlYWQ6IGZ1bmN0aW9uICh2YWx1ZSwgaW5kZW50KSB7XG4gICAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZydcbiAgICAgID8gdmFsdWVcbiAgICAgIDogSlNPTi5zdHJpbmdpZnkodmFsdWUsIG51bGwsIE51bWJlcihpbmRlbnQpIHx8IDIpXG4gIH0sXG4gIHdyaXRlOiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIEpTT04ucGFyc2UodmFsdWUpXG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgcmV0dXJuIHZhbHVlXG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogJ2FiYycgPT4gJ0FiYydcbiAqL1xuXG5leHBvcnRzLmNhcGl0YWxpemUgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgaWYgKCF2YWx1ZSAmJiB2YWx1ZSAhPT0gMCkgcmV0dXJuICcnXG4gIHZhbHVlID0gdmFsdWUudG9TdHJpbmcoKVxuICByZXR1cm4gdmFsdWUuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyB2YWx1ZS5zbGljZSgxKVxufVxuXG4vKipcbiAqICdhYmMnID0+ICdBQkMnXG4gKi9cblxuZXhwb3J0cy51cHBlcmNhc2UgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgcmV0dXJuICh2YWx1ZSB8fCB2YWx1ZSA9PT0gMClcbiAgICA/IHZhbHVlLnRvU3RyaW5nKCkudG9VcHBlckNhc2UoKVxuICAgIDogJydcbn1cblxuLyoqXG4gKiAnQWJDJyA9PiAnYWJjJ1xuICovXG5cbmV4cG9ydHMubG93ZXJjYXNlID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gIHJldHVybiAodmFsdWUgfHwgdmFsdWUgPT09IDApXG4gICAgPyB2YWx1ZS50b1N0cmluZygpLnRvTG93ZXJDYXNlKClcbiAgICA6ICcnXG59XG5cbi8qKlxuICogMTIzNDUgPT4gJDEyLDM0NS4wMFxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzaWduXG4gKi9cblxudmFyIGRpZ2l0c1JFID0gLyhcXGR7M30pKD89XFxkKS9nXG5leHBvcnRzLmN1cnJlbmN5ID0gZnVuY3Rpb24gKHZhbHVlLCBjdXJyZW5jeSkge1xuICB2YWx1ZSA9IHBhcnNlRmxvYXQodmFsdWUpXG4gIGlmICghaXNGaW5pdGUodmFsdWUpIHx8ICghdmFsdWUgJiYgdmFsdWUgIT09IDApKSByZXR1cm4gJydcbiAgY3VycmVuY3kgPSBjdXJyZW5jeSAhPSBudWxsID8gY3VycmVuY3kgOiAnJCdcbiAgdmFyIHN0cmluZ2lmaWVkID0gTWF0aC5hYnModmFsdWUpLnRvRml4ZWQoMilcbiAgdmFyIF9pbnQgPSBzdHJpbmdpZmllZC5zbGljZSgwLCAtMylcbiAgdmFyIGkgPSBfaW50Lmxlbmd0aCAlIDNcbiAgdmFyIGhlYWQgPSBpID4gMFxuICAgID8gKF9pbnQuc2xpY2UoMCwgaSkgKyAoX2ludC5sZW5ndGggPiAzID8gJywnIDogJycpKVxuICAgIDogJydcbiAgdmFyIF9mbG9hdCA9IHN0cmluZ2lmaWVkLnNsaWNlKC0zKVxuICB2YXIgc2lnbiA9IHZhbHVlIDwgMCA/ICctJyA6ICcnXG4gIHJldHVybiBjdXJyZW5jeSArIHNpZ24gKyBoZWFkICtcbiAgICBfaW50LnNsaWNlKGkpLnJlcGxhY2UoZGlnaXRzUkUsICckMSwnKSArXG4gICAgX2Zsb2F0XG59XG5cbi8qKlxuICogJ2l0ZW0nID0+ICdpdGVtcydcbiAqXG4gKiBAcGFyYW1zXG4gKiAgYW4gYXJyYXkgb2Ygc3RyaW5ncyBjb3JyZXNwb25kaW5nIHRvXG4gKiAgdGhlIHNpbmdsZSwgZG91YmxlLCB0cmlwbGUgLi4uIGZvcm1zIG9mIHRoZSB3b3JkIHRvXG4gKiAgYmUgcGx1cmFsaXplZC4gV2hlbiB0aGUgbnVtYmVyIHRvIGJlIHBsdXJhbGl6ZWRcbiAqICBleGNlZWRzIHRoZSBsZW5ndGggb2YgdGhlIGFyZ3MsIGl0IHdpbGwgdXNlIHRoZSBsYXN0XG4gKiAgZW50cnkgaW4gdGhlIGFycmF5LlxuICpcbiAqICBlLmcuIFsnc2luZ2xlJywgJ2RvdWJsZScsICd0cmlwbGUnLCAnbXVsdGlwbGUnXVxuICovXG5cbmV4cG9ydHMucGx1cmFsaXplID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gIHZhciBhcmdzID0gXy50b0FycmF5KGFyZ3VtZW50cywgMSlcbiAgcmV0dXJuIGFyZ3MubGVuZ3RoID4gMVxuICAgID8gKGFyZ3NbdmFsdWUgJSAxMCAtIDFdIHx8IGFyZ3NbYXJncy5sZW5ndGggLSAxXSlcbiAgICA6IChhcmdzWzBdICsgKHZhbHVlID09PSAxID8gJycgOiAncycpKVxufVxuXG4vKipcbiAqIEEgc3BlY2lhbCBmaWx0ZXIgdGhhdCB0YWtlcyBhIGhhbmRsZXIgZnVuY3Rpb24sXG4gKiB3cmFwcyBpdCBzbyBpdCBvbmx5IGdldHMgdHJpZ2dlcmVkIG9uIHNwZWNpZmljXG4gKiBrZXlwcmVzc2VzLiB2LW9uIG9ubHkuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGtleVxuICovXG5cbnZhciBrZXlDb2RlcyA9IHtcbiAgZXNjOiAyNyxcbiAgdGFiOiA5LFxuICBlbnRlcjogMTMsXG4gIHNwYWNlOiAzMixcbiAgJ2RlbGV0ZSc6IDQ2LFxuICB1cDogMzgsXG4gIGxlZnQ6IDM3LFxuICByaWdodDogMzksXG4gIGRvd246IDQwXG59XG5cbmV4cG9ydHMua2V5ID0gZnVuY3Rpb24gKGhhbmRsZXIsIGtleSkge1xuICBpZiAoIWhhbmRsZXIpIHJldHVyblxuICB2YXIgY29kZSA9IGtleUNvZGVzW2tleV1cbiAgaWYgKCFjb2RlKSB7XG4gICAgY29kZSA9IHBhcnNlSW50KGtleSwgMTApXG4gIH1cbiAgcmV0dXJuIGZ1bmN0aW9uIChlKSB7XG4gICAgaWYgKGUua2V5Q29kZSA9PT0gY29kZSkge1xuICAgICAgcmV0dXJuIGhhbmRsZXIuY2FsbCh0aGlzLCBlKVxuICAgIH1cbiAgfVxufVxuXG4vLyBleHBvc2Uga2V5Y29kZSBoYXNoXG5leHBvcnRzLmtleS5rZXlDb2RlcyA9IGtleUNvZGVzXG5cbmV4cG9ydHMuZGVib3VuY2UgPSBmdW5jdGlvbiAoaGFuZGxlciwgZGVsYXkpIHtcbiAgaWYgKCFoYW5kbGVyKSByZXR1cm5cbiAgaWYgKCFkZWxheSkge1xuICAgIGRlbGF5ID0gMzAwXG4gIH1cbiAgcmV0dXJuIF8uZGVib3VuY2UoaGFuZGxlciwgZGVsYXkpXG59XG5cbi8qKlxuICogSW5zdGFsbCBzcGVjaWFsIGFycmF5IGZpbHRlcnNcbiAqL1xuXG5fLmV4dGVuZChleHBvcnRzLCByZXF1aXJlKCcuL2FycmF5LWZpbHRlcnMnKSlcbiIsInZhciBfID0gcmVxdWlyZSgnLi4vdXRpbCcpXG52YXIgRGlyZWN0aXZlID0gcmVxdWlyZSgnLi4vZGlyZWN0aXZlJylcbnZhciBjb21waWxlciA9IHJlcXVpcmUoJy4uL2NvbXBpbGVyJylcblxuLyoqXG4gKiBUcmFuc2NsdWRlLCBjb21waWxlIGFuZCBsaW5rIGVsZW1lbnQuXG4gKlxuICogSWYgYSBwcmUtY29tcGlsZWQgbGlua2VyIGlzIGF2YWlsYWJsZSwgdGhhdCBtZWFucyB0aGVcbiAqIHBhc3NlZCBpbiBlbGVtZW50IHdpbGwgYmUgcHJlLXRyYW5zY2x1ZGVkIGFuZCBjb21waWxlZFxuICogYXMgd2VsbCAtIGFsbCB3ZSBuZWVkIHRvIGRvIGlzIHRvIGNhbGwgdGhlIGxpbmtlci5cbiAqXG4gKiBPdGhlcndpc2Ugd2UgbmVlZCB0byBjYWxsIHRyYW5zY2x1ZGUvY29tcGlsZS9saW5rIGhlcmUuXG4gKlxuICogQHBhcmFtIHtFbGVtZW50fSBlbFxuICogQHJldHVybiB7RWxlbWVudH1cbiAqL1xuXG5leHBvcnRzLl9jb21waWxlID0gZnVuY3Rpb24gKGVsKSB7XG4gIHZhciBvcHRpb25zID0gdGhpcy4kb3B0aW9uc1xuICB2YXIgaG9zdCA9IHRoaXMuX2hvc3RcbiAgaWYgKG9wdGlvbnMuX2xpbmtGbikge1xuICAgIC8vIHByZS10cmFuc2NsdWRlZCB3aXRoIGxpbmtlciwganVzdCB1c2UgaXRcbiAgICB0aGlzLl9pbml0RWxlbWVudChlbClcbiAgICB0aGlzLl91bmxpbmtGbiA9IG9wdGlvbnMuX2xpbmtGbih0aGlzLCBlbCwgaG9zdClcbiAgfSBlbHNlIHtcbiAgICAvLyB0cmFuc2NsdWRlIGFuZCBpbml0IGVsZW1lbnRcbiAgICAvLyB0cmFuc2NsdWRlIGNhbiBwb3RlbnRpYWxseSByZXBsYWNlIG9yaWdpbmFsXG4gICAgLy8gc28gd2UgbmVlZCB0byBrZWVwIHJlZmVyZW5jZTsgdGhpcyBzdGVwIGFsc28gaW5qZWN0c1xuICAgIC8vIHRoZSB0ZW1wbGF0ZSBhbmQgY2FjaGVzIHRoZSBvcmlnaW5hbCBhdHRyaWJ1dGVzXG4gICAgLy8gb24gdGhlIGNvbnRhaW5lciBub2RlIGFuZCByZXBsYWNlciBub2RlLlxuICAgIHZhciBvcmlnaW5hbCA9IGVsXG4gICAgZWwgPSBjb21waWxlci50cmFuc2NsdWRlKGVsLCBvcHRpb25zKVxuICAgIHRoaXMuX2luaXRFbGVtZW50KGVsKVxuXG4gICAgLy8gcm9vdCBpcyBhbHdheXMgY29tcGlsZWQgcGVyLWluc3RhbmNlLCBiZWNhdXNlXG4gICAgLy8gY29udGFpbmVyIGF0dHJzIGFuZCBwcm9wcyBjYW4gYmUgZGlmZmVyZW50IGV2ZXJ5IHRpbWUuXG4gICAgdmFyIHJvb3RMaW5rZXIgPSBjb21waWxlci5jb21waWxlUm9vdChlbCwgb3B0aW9ucylcblxuICAgIC8vIGNvbXBpbGUgYW5kIGxpbmsgdGhlIHJlc3RcbiAgICB2YXIgY29udGVudExpbmtGblxuICAgIHZhciBjdG9yID0gdGhpcy5jb25zdHJ1Y3RvclxuICAgIC8vIGNvbXBvbmVudCBjb21waWxhdGlvbiBjYW4gYmUgY2FjaGVkXG4gICAgLy8gYXMgbG9uZyBhcyBpdCdzIG5vdCB1c2luZyBpbmxpbmUtdGVtcGxhdGVcbiAgICBpZiAob3B0aW9ucy5fbGlua2VyQ2FjaGFibGUpIHtcbiAgICAgIGNvbnRlbnRMaW5rRm4gPSBjdG9yLmxpbmtlclxuICAgICAgaWYgKCFjb250ZW50TGlua0ZuKSB7XG4gICAgICAgIGNvbnRlbnRMaW5rRm4gPSBjdG9yLmxpbmtlciA9IGNvbXBpbGVyLmNvbXBpbGUoZWwsIG9wdGlvbnMpXG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gbGluayBwaGFzZVxuICAgIHZhciByb290VW5saW5rRm4gPSByb290TGlua2VyKHRoaXMsIGVsKVxuICAgIHZhciBjb250ZW50VW5saW5rRm4gPSBjb250ZW50TGlua0ZuXG4gICAgICA/IGNvbnRlbnRMaW5rRm4odGhpcywgZWwpXG4gICAgICA6IGNvbXBpbGVyLmNvbXBpbGUoZWwsIG9wdGlvbnMpKHRoaXMsIGVsLCBob3N0KVxuXG4gICAgLy8gcmVnaXN0ZXIgY29tcG9zaXRlIHVubGluayBmdW5jdGlvblxuICAgIC8vIHRvIGJlIGNhbGxlZCBkdXJpbmcgaW5zdGFuY2UgZGVzdHJ1Y3Rpb25cbiAgICB0aGlzLl91bmxpbmtGbiA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIHJvb3RVbmxpbmtGbigpXG4gICAgICAvLyBwYXNzaW5nIGRlc3Ryb3lpbmc6IHRydWUgdG8gYXZvaWQgc2VhcmNoaW5nIGFuZFxuICAgICAgLy8gc3BsaWNpbmcgdGhlIGRpcmVjdGl2ZXNcbiAgICAgIGNvbnRlbnRVbmxpbmtGbih0cnVlKVxuICAgIH1cblxuICAgIC8vIGZpbmFsbHkgcmVwbGFjZSBvcmlnaW5hbFxuICAgIGlmIChvcHRpb25zLnJlcGxhY2UpIHtcbiAgICAgIF8ucmVwbGFjZShvcmlnaW5hbCwgZWwpXG4gICAgfVxuICB9XG4gIHJldHVybiBlbFxufVxuXG4vKipcbiAqIEluaXRpYWxpemUgaW5zdGFuY2UgZWxlbWVudC4gQ2FsbGVkIGluIHRoZSBwdWJsaWNcbiAqICRtb3VudCgpIG1ldGhvZC5cbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IGVsXG4gKi9cblxuZXhwb3J0cy5faW5pdEVsZW1lbnQgPSBmdW5jdGlvbiAoZWwpIHtcbiAgaWYgKGVsIGluc3RhbmNlb2YgRG9jdW1lbnRGcmFnbWVudCkge1xuICAgIHRoaXMuX2lzRnJhZ21lbnQgPSB0cnVlXG4gICAgdGhpcy4kZWwgPSB0aGlzLl9mcmFnbWVudFN0YXJ0ID0gZWwuZmlyc3RDaGlsZFxuICAgIHRoaXMuX2ZyYWdtZW50RW5kID0gZWwubGFzdENoaWxkXG4gICAgLy8gc2V0IHBlcnNpc3RlZCB0ZXh0IGFuY2hvcnMgdG8gZW1wdHlcbiAgICBpZiAodGhpcy5fZnJhZ21lbnRTdGFydC5ub2RlVHlwZSA9PT0gMykge1xuICAgICAgdGhpcy5fZnJhZ21lbnRTdGFydC5kYXRhID0gdGhpcy5fZnJhZ21lbnRFbmQuZGF0YSA9ICcnXG4gICAgfVxuICAgIHRoaXMuX2Jsb2NrRnJhZ21lbnQgPSBlbFxuICB9IGVsc2Uge1xuICAgIHRoaXMuJGVsID0gZWxcbiAgfVxuICB0aGlzLiRlbC5fX3Z1ZV9fID0gdGhpc1xuICB0aGlzLl9jYWxsSG9vaygnYmVmb3JlQ29tcGlsZScpXG59XG5cbi8qKlxuICogQ3JlYXRlIGFuZCBiaW5kIGEgZGlyZWN0aXZlIHRvIGFuIGVsZW1lbnQuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgLSBkaXJlY3RpdmUgbmFtZVxuICogQHBhcmFtIHtOb2RlfSBub2RlICAgLSB0YXJnZXQgbm9kZVxuICogQHBhcmFtIHtPYmplY3R9IGRlc2MgLSBwYXJzZWQgZGlyZWN0aXZlIGRlc2NyaXB0b3JcbiAqIEBwYXJhbSB7T2JqZWN0fSBkZWYgIC0gZGlyZWN0aXZlIGRlZmluaXRpb24gb2JqZWN0XG4gKiBAcGFyYW0ge1Z1ZXx1bmRlZmluZWR9IGhvc3QgLSB0cmFuc2NsdXNpb24gaG9zdCBjb21wb25lbnRcbiAqL1xuXG5leHBvcnRzLl9iaW5kRGlyID0gZnVuY3Rpb24gKG5hbWUsIG5vZGUsIGRlc2MsIGRlZiwgaG9zdCkge1xuICB0aGlzLl9kaXJlY3RpdmVzLnB1c2goXG4gICAgbmV3IERpcmVjdGl2ZShuYW1lLCBub2RlLCB0aGlzLCBkZXNjLCBkZWYsIGhvc3QpXG4gIClcbn1cblxuLyoqXG4gKiBUZWFyZG93biBhbiBpbnN0YW5jZSwgdW5vYnNlcnZlcyB0aGUgZGF0YSwgdW5iaW5kIGFsbCB0aGVcbiAqIGRpcmVjdGl2ZXMsIHR1cm4gb2ZmIGFsbCB0aGUgZXZlbnQgbGlzdGVuZXJzLCBldGMuXG4gKlxuICogQHBhcmFtIHtCb29sZWFufSByZW1vdmUgLSB3aGV0aGVyIHRvIHJlbW92ZSB0aGUgRE9NIG5vZGUuXG4gKiBAcGFyYW0ge0Jvb2xlYW59IGRlZmVyQ2xlYW51cCAtIGlmIHRydWUsIGRlZmVyIGNsZWFudXAgdG9cbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYmUgY2FsbGVkIGxhdGVyXG4gKi9cblxuZXhwb3J0cy5fZGVzdHJveSA9IGZ1bmN0aW9uIChyZW1vdmUsIGRlZmVyQ2xlYW51cCkge1xuICBpZiAodGhpcy5faXNCZWluZ0Rlc3Ryb3llZCkge1xuICAgIHJldHVyblxuICB9XG4gIHRoaXMuX2NhbGxIb29rKCdiZWZvcmVEZXN0cm95JylcbiAgdGhpcy5faXNCZWluZ0Rlc3Ryb3llZCA9IHRydWVcbiAgdmFyIGlcbiAgLy8gcmVtb3ZlIHNlbGYgZnJvbSBwYXJlbnQuIG9ubHkgbmVjZXNzYXJ5XG4gIC8vIGlmIHBhcmVudCBpcyBub3QgYmVpbmcgZGVzdHJveWVkIGFzIHdlbGwuXG4gIHZhciBwYXJlbnQgPSB0aGlzLiRwYXJlbnRcbiAgaWYgKHBhcmVudCAmJiAhcGFyZW50Ll9pc0JlaW5nRGVzdHJveWVkKSB7XG4gICAgcGFyZW50LiRjaGlsZHJlbi4kcmVtb3ZlKHRoaXMpXG4gIH1cbiAgLy8gZGVzdHJveSBhbGwgY2hpbGRyZW4uXG4gIGkgPSB0aGlzLiRjaGlsZHJlbi5sZW5ndGhcbiAgd2hpbGUgKGktLSkge1xuICAgIHRoaXMuJGNoaWxkcmVuW2ldLiRkZXN0cm95KClcbiAgfVxuICAvLyB0ZWFyZG93biBwcm9wc1xuICBpZiAodGhpcy5fcHJvcHNVbmxpbmtGbikge1xuICAgIHRoaXMuX3Byb3BzVW5saW5rRm4oKVxuICB9XG4gIC8vIHRlYXJkb3duIGFsbCBkaXJlY3RpdmVzLiB0aGlzIGFsc28gdGVhcnNkb3duIGFsbFxuICAvLyBkaXJlY3RpdmUtb3duZWQgd2F0Y2hlcnMuXG4gIGlmICh0aGlzLl91bmxpbmtGbikge1xuICAgIHRoaXMuX3VubGlua0ZuKClcbiAgfVxuICBpID0gdGhpcy5fd2F0Y2hlcnMubGVuZ3RoXG4gIHdoaWxlIChpLS0pIHtcbiAgICB0aGlzLl93YXRjaGVyc1tpXS50ZWFyZG93bigpXG4gIH1cbiAgLy8gcmVtb3ZlIHJlZmVyZW5jZSB0byBzZWxmIG9uICRlbFxuICBpZiAodGhpcy4kZWwpIHtcbiAgICB0aGlzLiRlbC5fX3Z1ZV9fID0gbnVsbFxuICB9XG4gIC8vIHJlbW92ZSBET00gZWxlbWVudFxuICB2YXIgc2VsZiA9IHRoaXNcbiAgaWYgKHJlbW92ZSAmJiB0aGlzLiRlbCkge1xuICAgIHRoaXMuJHJlbW92ZShmdW5jdGlvbiAoKSB7XG4gICAgICBzZWxmLl9jbGVhbnVwKClcbiAgICB9KVxuICB9IGVsc2UgaWYgKCFkZWZlckNsZWFudXApIHtcbiAgICB0aGlzLl9jbGVhbnVwKClcbiAgfVxufVxuXG4vKipcbiAqIENsZWFuIHVwIHRvIGVuc3VyZSBnYXJiYWdlIGNvbGxlY3Rpb24uXG4gKiBUaGlzIGlzIGNhbGxlZCBhZnRlciB0aGUgbGVhdmUgdHJhbnNpdGlvbiBpZiB0aGVyZVxuICogaXMgYW55LlxuICovXG5cbmV4cG9ydHMuX2NsZWFudXAgPSBmdW5jdGlvbiAoKSB7XG4gIC8vIHJlbW92ZSByZWZlcmVuY2UgZnJvbSBkYXRhIG9iXG4gIC8vIGZyb3plbiBvYmplY3QgbWF5IG5vdCBoYXZlIG9ic2VydmVyLlxuICBpZiAodGhpcy5fZGF0YS5fX29iX18pIHtcbiAgICB0aGlzLl9kYXRhLl9fb2JfXy5yZW1vdmVWbSh0aGlzKVxuICB9XG4gIC8vIENsZWFuIHVwIHJlZmVyZW5jZXMgdG8gcHJpdmF0ZSBwcm9wZXJ0aWVzIGFuZCBvdGhlclxuICAvLyBpbnN0YW5jZXMuIHByZXNlcnZlIHJlZmVyZW5jZSB0byBfZGF0YSBzbyB0aGF0IHByb3h5XG4gIC8vIGFjY2Vzc29ycyBzdGlsbCB3b3JrLiBUaGUgb25seSBwb3RlbnRpYWwgc2lkZSBlZmZlY3RcbiAgLy8gaGVyZSBpcyB0aGF0IG11dGF0aW5nIHRoZSBpbnN0YW5jZSBhZnRlciBpdCdzIGRlc3Ryb3llZFxuICAvLyBtYXkgYWZmZWN0IHRoZSBzdGF0ZSBvZiBvdGhlciBjb21wb25lbnRzIHRoYXQgYXJlIHN0aWxsXG4gIC8vIG9ic2VydmluZyB0aGUgc2FtZSBvYmplY3QsIGJ1dCB0aGF0IHNlZW1zIHRvIGJlIGFcbiAgLy8gcmVhc29uYWJsZSByZXNwb25zaWJpbGl0eSBmb3IgdGhlIHVzZXIgcmF0aGVyIHRoYW5cbiAgLy8gYWx3YXlzIHRocm93aW5nIGFuIGVycm9yIG9uIHRoZW0uXG4gIHRoaXMuJGVsID1cbiAgdGhpcy4kcGFyZW50ID1cbiAgdGhpcy4kcm9vdCA9XG4gIHRoaXMuJGNoaWxkcmVuID1cbiAgdGhpcy5fd2F0Y2hlcnMgPVxuICB0aGlzLl9kaXJlY3RpdmVzID0gbnVsbFxuICAvLyBjYWxsIHRoZSBsYXN0IGhvb2suLi5cbiAgdGhpcy5faXNEZXN0cm95ZWQgPSB0cnVlXG4gIHRoaXMuX2NhbGxIb29rKCdkZXN0cm95ZWQnKVxuICAvLyB0dXJuIG9mZiBhbGwgaW5zdGFuY2UgbGlzdGVuZXJzLlxuICB0aGlzLiRvZmYoKVxufVxuIiwidmFyIF8gPSByZXF1aXJlKCcuLi91dGlsJylcbnZhciBpbkRvYyA9IF8uaW5Eb2NcblxuLyoqXG4gKiBTZXR1cCB0aGUgaW5zdGFuY2UncyBvcHRpb24gZXZlbnRzICYgd2F0Y2hlcnMuXG4gKiBJZiB0aGUgdmFsdWUgaXMgYSBzdHJpbmcsIHdlIHB1bGwgaXQgZnJvbSB0aGVcbiAqIGluc3RhbmNlJ3MgbWV0aG9kcyBieSBuYW1lLlxuICovXG5cbmV4cG9ydHMuX2luaXRFdmVudHMgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBvcHRpb25zID0gdGhpcy4kb3B0aW9uc1xuICByZWdpc3RlckNhbGxiYWNrcyh0aGlzLCAnJG9uJywgb3B0aW9ucy5ldmVudHMpXG4gIHJlZ2lzdGVyQ2FsbGJhY2tzKHRoaXMsICckd2F0Y2gnLCBvcHRpb25zLndhdGNoKVxufVxuXG4vKipcbiAqIFJlZ2lzdGVyIGNhbGxiYWNrcyBmb3Igb3B0aW9uIGV2ZW50cyBhbmQgd2F0Y2hlcnMuXG4gKlxuICogQHBhcmFtIHtWdWV9IHZtXG4gKiBAcGFyYW0ge1N0cmluZ30gYWN0aW9uXG4gKiBAcGFyYW0ge09iamVjdH0gaGFzaFxuICovXG5cbmZ1bmN0aW9uIHJlZ2lzdGVyQ2FsbGJhY2tzICh2bSwgYWN0aW9uLCBoYXNoKSB7XG4gIGlmICghaGFzaCkgcmV0dXJuXG4gIHZhciBoYW5kbGVycywga2V5LCBpLCBqXG4gIGZvciAoa2V5IGluIGhhc2gpIHtcbiAgICBoYW5kbGVycyA9IGhhc2hba2V5XVxuICAgIGlmIChfLmlzQXJyYXkoaGFuZGxlcnMpKSB7XG4gICAgICBmb3IgKGkgPSAwLCBqID0gaGFuZGxlcnMubGVuZ3RoOyBpIDwgajsgaSsrKSB7XG4gICAgICAgIHJlZ2lzdGVyKHZtLCBhY3Rpb24sIGtleSwgaGFuZGxlcnNbaV0pXG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlZ2lzdGVyKHZtLCBhY3Rpb24sIGtleSwgaGFuZGxlcnMpXG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogSGVscGVyIHRvIHJlZ2lzdGVyIGFuIGV2ZW50L3dhdGNoIGNhbGxiYWNrLlxuICpcbiAqIEBwYXJhbSB7VnVlfSB2bVxuICogQHBhcmFtIHtTdHJpbmd9IGFjdGlvblxuICogQHBhcmFtIHtTdHJpbmd9IGtleVxuICogQHBhcmFtIHtGdW5jdGlvbnxTdHJpbmd8T2JqZWN0fSBoYW5kbGVyXG4gKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdXG4gKi9cblxuZnVuY3Rpb24gcmVnaXN0ZXIgKHZtLCBhY3Rpb24sIGtleSwgaGFuZGxlciwgb3B0aW9ucykge1xuICB2YXIgdHlwZSA9IHR5cGVvZiBoYW5kbGVyXG4gIGlmICh0eXBlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgdm1bYWN0aW9uXShrZXksIGhhbmRsZXIsIG9wdGlvbnMpXG4gIH0gZWxzZSBpZiAodHlwZSA9PT0gJ3N0cmluZycpIHtcbiAgICB2YXIgbWV0aG9kcyA9IHZtLiRvcHRpb25zLm1ldGhvZHNcbiAgICB2YXIgbWV0aG9kID0gbWV0aG9kcyAmJiBtZXRob2RzW2hhbmRsZXJdXG4gICAgaWYgKG1ldGhvZCkge1xuICAgICAgdm1bYWN0aW9uXShrZXksIG1ldGhvZCwgb3B0aW9ucylcbiAgICB9IGVsc2Uge1xuICAgICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiBfLndhcm4oXG4gICAgICAgICdVbmtub3duIG1ldGhvZDogXCInICsgaGFuZGxlciArICdcIiB3aGVuICcgK1xuICAgICAgICAncmVnaXN0ZXJpbmcgY2FsbGJhY2sgZm9yICcgKyBhY3Rpb24gK1xuICAgICAgICAnOiBcIicgKyBrZXkgKyAnXCIuJ1xuICAgICAgKVxuICAgIH1cbiAgfSBlbHNlIGlmIChoYW5kbGVyICYmIHR5cGUgPT09ICdvYmplY3QnKSB7XG4gICAgcmVnaXN0ZXIodm0sIGFjdGlvbiwga2V5LCBoYW5kbGVyLmhhbmRsZXIsIGhhbmRsZXIpXG4gIH1cbn1cblxuLyoqXG4gKiBTZXR1cCByZWN1cnNpdmUgYXR0YWNoZWQvZGV0YWNoZWQgY2FsbHNcbiAqL1xuXG5leHBvcnRzLl9pbml0RE9NSG9va3MgPSBmdW5jdGlvbiAoKSB7XG4gIHRoaXMuJG9uKCdob29rOmF0dGFjaGVkJywgb25BdHRhY2hlZClcbiAgdGhpcy4kb24oJ2hvb2s6ZGV0YWNoZWQnLCBvbkRldGFjaGVkKVxufVxuXG4vKipcbiAqIENhbGxiYWNrIHRvIHJlY3Vyc2l2ZWx5IGNhbGwgYXR0YWNoZWQgaG9vayBvbiBjaGlsZHJlblxuICovXG5cbmZ1bmN0aW9uIG9uQXR0YWNoZWQgKCkge1xuICBpZiAoIXRoaXMuX2lzQXR0YWNoZWQpIHtcbiAgICB0aGlzLl9pc0F0dGFjaGVkID0gdHJ1ZVxuICAgIHRoaXMuJGNoaWxkcmVuLmZvckVhY2goY2FsbEF0dGFjaClcbiAgfVxufVxuXG4vKipcbiAqIEl0ZXJhdG9yIHRvIGNhbGwgYXR0YWNoZWQgaG9va1xuICpcbiAqIEBwYXJhbSB7VnVlfSBjaGlsZFxuICovXG5cbmZ1bmN0aW9uIGNhbGxBdHRhY2ggKGNoaWxkKSB7XG4gIGlmICghY2hpbGQuX2lzQXR0YWNoZWQgJiYgaW5Eb2MoY2hpbGQuJGVsKSkge1xuICAgIGNoaWxkLl9jYWxsSG9vaygnYXR0YWNoZWQnKVxuICB9XG59XG5cbi8qKlxuICogQ2FsbGJhY2sgdG8gcmVjdXJzaXZlbHkgY2FsbCBkZXRhY2hlZCBob29rIG9uIGNoaWxkcmVuXG4gKi9cblxuZnVuY3Rpb24gb25EZXRhY2hlZCAoKSB7XG4gIGlmICh0aGlzLl9pc0F0dGFjaGVkKSB7XG4gICAgdGhpcy5faXNBdHRhY2hlZCA9IGZhbHNlXG4gICAgdGhpcy4kY2hpbGRyZW4uZm9yRWFjaChjYWxsRGV0YWNoKVxuICB9XG59XG5cbi8qKlxuICogSXRlcmF0b3IgdG8gY2FsbCBkZXRhY2hlZCBob29rXG4gKlxuICogQHBhcmFtIHtWdWV9IGNoaWxkXG4gKi9cblxuZnVuY3Rpb24gY2FsbERldGFjaCAoY2hpbGQpIHtcbiAgaWYgKGNoaWxkLl9pc0F0dGFjaGVkICYmICFpbkRvYyhjaGlsZC4kZWwpKSB7XG4gICAgY2hpbGQuX2NhbGxIb29rKCdkZXRhY2hlZCcpXG4gIH1cbn1cblxuLyoqXG4gKiBUcmlnZ2VyIGFsbCBoYW5kbGVycyBmb3IgYSBob29rXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGhvb2tcbiAqL1xuXG5leHBvcnRzLl9jYWxsSG9vayA9IGZ1bmN0aW9uIChob29rKSB7XG4gIHZhciBoYW5kbGVycyA9IHRoaXMuJG9wdGlvbnNbaG9va11cbiAgaWYgKGhhbmRsZXJzKSB7XG4gICAgZm9yICh2YXIgaSA9IDAsIGogPSBoYW5kbGVycy5sZW5ndGg7IGkgPCBqOyBpKyspIHtcbiAgICAgIGhhbmRsZXJzW2ldLmNhbGwodGhpcylcbiAgICB9XG4gIH1cbiAgdGhpcy4kZW1pdCgnaG9vazonICsgaG9vaylcbn1cbiIsInZhciBtZXJnZU9wdGlvbnMgPSByZXF1aXJlKCcuLi91dGlsJykubWVyZ2VPcHRpb25zXG5cbi8qKlxuICogVGhlIG1haW4gaW5pdCBzZXF1ZW5jZS4gVGhpcyBpcyBjYWxsZWQgZm9yIGV2ZXJ5XG4gKiBpbnN0YW5jZSwgaW5jbHVkaW5nIG9uZXMgdGhhdCBhcmUgY3JlYXRlZCBmcm9tIGV4dGVuZGVkXG4gKiBjb25zdHJ1Y3RvcnMuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMgLSB0aGlzIG9wdGlvbnMgb2JqZWN0IHNob3VsZCBiZVxuICogICAgICAgICAgICAgICAgICAgICAgICAgICB0aGUgcmVzdWx0IG9mIG1lcmdpbmcgY2xhc3NcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9ucyBhbmQgdGhlIG9wdGlvbnMgcGFzc2VkXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgIGluIHRvIHRoZSBjb25zdHJ1Y3Rvci5cbiAqL1xuXG5leHBvcnRzLl9pbml0ID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcblxuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fVxuXG4gIHRoaXMuJGVsID0gbnVsbFxuICB0aGlzLiRwYXJlbnQgPSBvcHRpb25zLl9wYXJlbnRcbiAgdGhpcy4kcm9vdCA9IG9wdGlvbnMuX3Jvb3QgfHwgdGhpc1xuICB0aGlzLiRjaGlsZHJlbiA9IFtdXG4gIHRoaXMuJCA9IHt9ICAgICAgICAgICAvLyBjaGlsZCB2bSByZWZlcmVuY2VzXG4gIHRoaXMuJCQgPSB7fSAgICAgICAgICAvLyBlbGVtZW50IHJlZmVyZW5jZXNcbiAgdGhpcy5fd2F0Y2hlcnMgPSBbXSAgIC8vIGFsbCB3YXRjaGVycyBhcyBhbiBhcnJheVxuICB0aGlzLl9kaXJlY3RpdmVzID0gW10gLy8gYWxsIGRpcmVjdGl2ZXNcbiAgdGhpcy5fY2hpbGRDdG9ycyA9IHt9IC8vIGluaGVyaXQ6dHJ1ZSBjb25zdHJ1Y3RvcnNcblxuICAvLyBhIGZsYWcgdG8gYXZvaWQgdGhpcyBiZWluZyBvYnNlcnZlZFxuICB0aGlzLl9pc1Z1ZSA9IHRydWVcblxuICAvLyBldmVudHMgYm9va2tlZXBpbmdcbiAgdGhpcy5fZXZlbnRzID0ge30gICAgICAgICAgICAvLyByZWdpc3RlcmVkIGNhbGxiYWNrc1xuICB0aGlzLl9ldmVudHNDb3VudCA9IHt9ICAgICAgIC8vIGZvciAkYnJvYWRjYXN0IG9wdGltaXphdGlvblxuICB0aGlzLl9ldmVudENhbmNlbGxlZCA9IGZhbHNlIC8vIGZvciBldmVudCBjYW5jZWxsYXRpb25cblxuICAvLyBmcmFnbWVudCBpbnN0YW5jZSBwcm9wZXJ0aWVzXG4gIHRoaXMuX2lzRnJhZ21lbnQgPSBmYWxzZVxuICB0aGlzLl9mcmFnbWVudFN0YXJ0ID0gICAgLy8gQHR5cGUge0NvbW1lbnROb2RlfVxuICB0aGlzLl9mcmFnbWVudEVuZCA9IG51bGwgLy8gQHR5cGUge0NvbW1lbnROb2RlfVxuXG4gIC8vIGxpZmVjeWNsZSBzdGF0ZVxuICB0aGlzLl9pc0NvbXBpbGVkID1cbiAgdGhpcy5faXNEZXN0cm95ZWQgPVxuICB0aGlzLl9pc1JlYWR5ID1cbiAgdGhpcy5faXNBdHRhY2hlZCA9XG4gIHRoaXMuX2lzQmVpbmdEZXN0cm95ZWQgPSBmYWxzZVxuICB0aGlzLl91bmxpbmtGbiA9IG51bGxcblxuICAvLyBjb250ZXh0OiB0aGUgc2NvcGUgaW4gd2hpY2ggdGhlIGNvbXBvbmVudCB3YXMgdXNlZCxcbiAgLy8gYW5kIHRoZSBzY29wZSBpbiB3aGljaCBwcm9wcyBhbmQgY29udGVudHMgb2YgdGhpc1xuICAvLyBpbnN0YW5jZSBzaG91bGQgYmUgY29tcGlsZWQgaW4uXG4gIHRoaXMuX2NvbnRleHQgPVxuICAgIG9wdGlvbnMuX2NvbnRleHQgfHxcbiAgICBvcHRpb25zLl9wYXJlbnRcblxuICAvLyBwdXNoIHNlbGYgaW50byBwYXJlbnQgLyB0cmFuc2NsdXNpb24gaG9zdFxuICBpZiAodGhpcy4kcGFyZW50KSB7XG4gICAgdGhpcy4kcGFyZW50LiRjaGlsZHJlbi5wdXNoKHRoaXMpXG4gIH1cblxuICAvLyBwcm9wcyB1c2VkIGluIHYtcmVwZWF0IGRpZmZpbmdcbiAgdGhpcy5fcmV1c2VkID0gZmFsc2VcbiAgdGhpcy5fc3RhZ2dlck9wID0gbnVsbFxuXG4gIC8vIG1lcmdlIG9wdGlvbnMuXG4gIG9wdGlvbnMgPSB0aGlzLiRvcHRpb25zID0gbWVyZ2VPcHRpb25zKFxuICAgIHRoaXMuY29uc3RydWN0b3Iub3B0aW9ucyxcbiAgICBvcHRpb25zLFxuICAgIHRoaXNcbiAgKVxuXG4gIC8vIGluaXRpYWxpemUgZGF0YSBhcyBlbXB0eSBvYmplY3QuXG4gIC8vIGl0IHdpbGwgYmUgZmlsbGVkIHVwIGluIF9pbml0U2NvcGUoKS5cbiAgdGhpcy5fZGF0YSA9IHt9XG5cbiAgLy8gaW5pdGlhbGl6ZSBkYXRhIG9ic2VydmF0aW9uIGFuZCBzY29wZSBpbmhlcml0YW5jZS5cbiAgdGhpcy5faW5pdFNjb3BlKClcblxuICAvLyBzZXR1cCBldmVudCBzeXN0ZW0gYW5kIG9wdGlvbiBldmVudHMuXG4gIHRoaXMuX2luaXRFdmVudHMoKVxuXG4gIC8vIGNhbGwgY3JlYXRlZCBob29rXG4gIHRoaXMuX2NhbGxIb29rKCdjcmVhdGVkJylcblxuICAvLyBpZiBgZWxgIG9wdGlvbiBpcyBwYXNzZWQsIHN0YXJ0IGNvbXBpbGF0aW9uLlxuICBpZiAob3B0aW9ucy5lbCkge1xuICAgIHRoaXMuJG1vdW50KG9wdGlvbnMuZWwpXG4gIH1cbn1cbiIsInZhciBfID0gcmVxdWlyZSgnLi4vdXRpbCcpXG5cbi8qKlxuICogQXBwbHkgYSBsaXN0IG9mIGZpbHRlciAoZGVzY3JpcHRvcnMpIHRvIGEgdmFsdWUuXG4gKiBVc2luZyBwbGFpbiBmb3IgbG9vcHMgaGVyZSBiZWNhdXNlIHRoaXMgd2lsbCBiZSBjYWxsZWQgaW5cbiAqIHRoZSBnZXR0ZXIgb2YgYW55IHdhdGNoZXIgd2l0aCBmaWx0ZXJzIHNvIGl0IGlzIHZlcnlcbiAqIHBlcmZvcm1hbmNlIHNlbnNpdGl2ZS5cbiAqXG4gKiBAcGFyYW0geyp9IHZhbHVlXG4gKiBAcGFyYW0geyp9IFtvbGRWYWx1ZV1cbiAqIEBwYXJhbSB7QXJyYXl9IGZpbHRlcnNcbiAqIEBwYXJhbSB7Qm9vbGVhbn0gd3JpdGVcbiAqIEByZXR1cm4geyp9XG4gKi9cblxuZXhwb3J0cy5fYXBwbHlGaWx0ZXJzID0gZnVuY3Rpb24gKHZhbHVlLCBvbGRWYWx1ZSwgZmlsdGVycywgd3JpdGUpIHtcbiAgdmFyIGZpbHRlciwgZm4sIGFyZ3MsIGFyZywgb2Zmc2V0LCBpLCBsLCBqLCBrXG4gIGZvciAoaSA9IDAsIGwgPSBmaWx0ZXJzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgIGZpbHRlciA9IGZpbHRlcnNbaV1cbiAgICBmbiA9IF8ucmVzb2x2ZUFzc2V0KHRoaXMuJG9wdGlvbnMsICdmaWx0ZXJzJywgZmlsdGVyLm5hbWUpXG4gICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgICAgIF8uYXNzZXJ0QXNzZXQoZm4sICdmaWx0ZXInLCBmaWx0ZXIubmFtZSlcbiAgICB9XG4gICAgaWYgKCFmbikgY29udGludWVcbiAgICBmbiA9IHdyaXRlID8gZm4ud3JpdGUgOiAoZm4ucmVhZCB8fCBmbilcbiAgICBpZiAodHlwZW9mIGZuICE9PSAnZnVuY3Rpb24nKSBjb250aW51ZVxuICAgIGFyZ3MgPSB3cml0ZSA/IFt2YWx1ZSwgb2xkVmFsdWVdIDogW3ZhbHVlXVxuICAgIG9mZnNldCA9IHdyaXRlID8gMiA6IDFcbiAgICBpZiAoZmlsdGVyLmFyZ3MpIHtcbiAgICAgIGZvciAoaiA9IDAsIGsgPSBmaWx0ZXIuYXJncy5sZW5ndGg7IGogPCBrOyBqKyspIHtcbiAgICAgICAgYXJnID0gZmlsdGVyLmFyZ3Nbal1cbiAgICAgICAgYXJnc1tqICsgb2Zmc2V0XSA9IGFyZy5keW5hbWljXG4gICAgICAgICAgPyB0aGlzLiRnZXQoYXJnLnZhbHVlKVxuICAgICAgICAgIDogYXJnLnZhbHVlXG4gICAgICB9XG4gICAgfVxuICAgIHZhbHVlID0gZm4uYXBwbHkodGhpcywgYXJncylcbiAgfVxuICByZXR1cm4gdmFsdWVcbn1cblxuLyoqXG4gKiBSZXNvbHZlIGEgY29tcG9uZW50LCBkZXBlbmRpbmcgb24gd2hldGhlciB0aGUgY29tcG9uZW50XG4gKiBpcyBkZWZpbmVkIG5vcm1hbGx5IG9yIHVzaW5nIGFuIGFzeW5jIGZhY3RvcnkgZnVuY3Rpb24uXG4gKiBSZXNvbHZlcyBzeW5jaHJvbm91c2x5IGlmIGFscmVhZHkgcmVzb2x2ZWQsIG90aGVyd2lzZVxuICogcmVzb2x2ZXMgYXN5bmNocm9ub3VzbHkgYW5kIGNhY2hlcyB0aGUgcmVzb2x2ZWRcbiAqIGNvbnN0cnVjdG9yIG9uIHRoZSBmYWN0b3J5LlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBpZFxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2JcbiAqL1xuXG5leHBvcnRzLl9yZXNvbHZlQ29tcG9uZW50ID0gZnVuY3Rpb24gKGlkLCBjYikge1xuICB2YXIgZmFjdG9yeSA9IF8ucmVzb2x2ZUFzc2V0KHRoaXMuJG9wdGlvbnMsICdjb21wb25lbnRzJywgaWQpXG4gIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgXy5hc3NlcnRBc3NldChmYWN0b3J5LCAnY29tcG9uZW50JywgaWQpXG4gIH1cbiAgaWYgKCFmYWN0b3J5KSB7XG4gICAgcmV0dXJuXG4gIH1cbiAgLy8gYXN5bmMgY29tcG9uZW50IGZhY3RvcnlcbiAgaWYgKCFmYWN0b3J5Lm9wdGlvbnMpIHtcbiAgICBpZiAoZmFjdG9yeS5yZXNvbHZlZCkge1xuICAgICAgLy8gY2FjaGVkXG4gICAgICBjYihmYWN0b3J5LnJlc29sdmVkKVxuICAgIH0gZWxzZSBpZiAoZmFjdG9yeS5yZXF1ZXN0ZWQpIHtcbiAgICAgIC8vIHBvb2wgY2FsbGJhY2tzXG4gICAgICBmYWN0b3J5LnBlbmRpbmdDYWxsYmFja3MucHVzaChjYilcbiAgICB9IGVsc2Uge1xuICAgICAgZmFjdG9yeS5yZXF1ZXN0ZWQgPSB0cnVlXG4gICAgICB2YXIgY2JzID0gZmFjdG9yeS5wZW5kaW5nQ2FsbGJhY2tzID0gW2NiXVxuICAgICAgZmFjdG9yeShmdW5jdGlvbiByZXNvbHZlIChyZXMpIHtcbiAgICAgICAgaWYgKF8uaXNQbGFpbk9iamVjdChyZXMpKSB7XG4gICAgICAgICAgcmVzID0gXy5WdWUuZXh0ZW5kKHJlcylcbiAgICAgICAgfVxuICAgICAgICAvLyBjYWNoZSByZXNvbHZlZFxuICAgICAgICBmYWN0b3J5LnJlc29sdmVkID0gcmVzXG4gICAgICAgIC8vIGludm9rZSBjYWxsYmFja3NcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBjYnMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgY2JzW2ldKHJlcylcbiAgICAgICAgfVxuICAgICAgfSwgZnVuY3Rpb24gcmVqZWN0IChyZWFzb24pIHtcbiAgICAgICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiBfLndhcm4oXG4gICAgICAgICAgJ0ZhaWxlZCB0byByZXNvbHZlIGFzeW5jIGNvbXBvbmVudDogJyArIGlkICsgJy4gJyArXG4gICAgICAgICAgKHJlYXNvbiA/ICdcXG5SZWFzb246ICcgKyByZWFzb24gOiAnJylcbiAgICAgICAgKVxuICAgICAgfSlcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgLy8gbm9ybWFsIGNvbXBvbmVudFxuICAgIGNiKGZhY3RvcnkpXG4gIH1cbn1cbiIsInZhciBfID0gcmVxdWlyZSgnLi4vdXRpbCcpXG52YXIgY29tcGlsZXIgPSByZXF1aXJlKCcuLi9jb21waWxlcicpXG52YXIgT2JzZXJ2ZXIgPSByZXF1aXJlKCcuLi9vYnNlcnZlcicpXG52YXIgRGVwID0gcmVxdWlyZSgnLi4vb2JzZXJ2ZXIvZGVwJylcbnZhciBXYXRjaGVyID0gcmVxdWlyZSgnLi4vd2F0Y2hlcicpXG5cbi8qKlxuICogU2V0dXAgdGhlIHNjb3BlIG9mIGFuIGluc3RhbmNlLCB3aGljaCBjb250YWluczpcbiAqIC0gb2JzZXJ2ZWQgZGF0YVxuICogLSBjb21wdXRlZCBwcm9wZXJ0aWVzXG4gKiAtIHVzZXIgbWV0aG9kc1xuICogLSBtZXRhIHByb3BlcnRpZXNcbiAqL1xuXG5leHBvcnRzLl9pbml0U2NvcGUgPSBmdW5jdGlvbiAoKSB7XG4gIHRoaXMuX2luaXRQcm9wcygpXG4gIHRoaXMuX2luaXRNZXRhKClcbiAgdGhpcy5faW5pdE1ldGhvZHMoKVxuICB0aGlzLl9pbml0RGF0YSgpXG4gIHRoaXMuX2luaXRDb21wdXRlZCgpXG59XG5cbi8qKlxuICogSW5pdGlhbGl6ZSBwcm9wcy5cbiAqL1xuXG5leHBvcnRzLl9pbml0UHJvcHMgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBvcHRpb25zID0gdGhpcy4kb3B0aW9uc1xuICB2YXIgZWwgPSBvcHRpb25zLmVsXG4gIHZhciBwcm9wcyA9IG9wdGlvbnMucHJvcHNcbiAgaWYgKHByb3BzICYmICFlbCkge1xuICAgIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgJiYgXy53YXJuKFxuICAgICAgJ1Byb3BzIHdpbGwgbm90IGJlIGNvbXBpbGVkIGlmIG5vIGBlbGAgb3B0aW9uIGlzICcgK1xuICAgICAgJ3Byb3ZpZGVkIGF0IGluc3RhbnRpYXRpb24uJ1xuICAgIClcbiAgfVxuICAvLyBtYWtlIHN1cmUgdG8gY29udmVydCBzdHJpbmcgc2VsZWN0b3JzIGludG8gZWxlbWVudCBub3dcbiAgZWwgPSBvcHRpb25zLmVsID0gXy5xdWVyeShlbClcbiAgdGhpcy5fcHJvcHNVbmxpbmtGbiA9IGVsICYmIGVsLm5vZGVUeXBlID09PSAxICYmIHByb3BzXG4gICAgPyBjb21waWxlci5jb21waWxlQW5kTGlua1Byb3BzKFxuICAgICAgICB0aGlzLCBlbCwgcHJvcHNcbiAgICAgIClcbiAgICA6IG51bGxcbn1cblxuLyoqXG4gKiBJbml0aWFsaXplIHRoZSBkYXRhLlxuICovXG5cbmV4cG9ydHMuX2luaXREYXRhID0gZnVuY3Rpb24gKCkge1xuICB2YXIgcHJvcHNEYXRhID0gdGhpcy5fZGF0YVxuICB2YXIgb3B0aW9uc0RhdGFGbiA9IHRoaXMuJG9wdGlvbnMuZGF0YVxuICB2YXIgb3B0aW9uc0RhdGEgPSBvcHRpb25zRGF0YUZuICYmIG9wdGlvbnNEYXRhRm4oKVxuICBpZiAob3B0aW9uc0RhdGEpIHtcbiAgICB0aGlzLl9kYXRhID0gb3B0aW9uc0RhdGFcbiAgICBmb3IgKHZhciBwcm9wIGluIHByb3BzRGF0YSkge1xuICAgICAgaWYgKFxuICAgICAgICB0aGlzLl9wcm9wc1twcm9wXS5yYXcgIT09IG51bGwgfHxcbiAgICAgICAgIW9wdGlvbnNEYXRhLmhhc093blByb3BlcnR5KHByb3ApXG4gICAgICApIHtcbiAgICAgICAgb3B0aW9uc0RhdGEuJHNldChwcm9wLCBwcm9wc0RhdGFbcHJvcF0pXG4gICAgICB9XG4gICAgfVxuICB9XG4gIHZhciBkYXRhID0gdGhpcy5fZGF0YVxuICAvLyBwcm94eSBkYXRhIG9uIGluc3RhbmNlXG4gIHZhciBrZXlzID0gT2JqZWN0LmtleXMoZGF0YSlcbiAgdmFyIGksIGtleVxuICBpID0ga2V5cy5sZW5ndGhcbiAgd2hpbGUgKGktLSkge1xuICAgIGtleSA9IGtleXNbaV1cbiAgICBpZiAoIV8uaXNSZXNlcnZlZChrZXkpKSB7XG4gICAgICB0aGlzLl9wcm94eShrZXkpXG4gICAgfVxuICB9XG4gIC8vIG9ic2VydmUgZGF0YVxuICBPYnNlcnZlci5jcmVhdGUoZGF0YSwgdGhpcylcbn1cblxuLyoqXG4gKiBTd2FwIHRoZSBpc250YW5jZSdzICRkYXRhLiBDYWxsZWQgaW4gJGRhdGEncyBzZXR0ZXIuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IG5ld0RhdGFcbiAqL1xuXG5leHBvcnRzLl9zZXREYXRhID0gZnVuY3Rpb24gKG5ld0RhdGEpIHtcbiAgbmV3RGF0YSA9IG5ld0RhdGEgfHwge31cbiAgdmFyIG9sZERhdGEgPSB0aGlzLl9kYXRhXG4gIHRoaXMuX2RhdGEgPSBuZXdEYXRhXG4gIHZhciBrZXlzLCBrZXksIGlcbiAgLy8gY29weSBwcm9wcy5cbiAgLy8gdGhpcyBzaG91bGQgb25seSBoYXBwZW4gZHVyaW5nIGEgdi1yZXBlYXQgb2YgY29tcG9uZW50XG4gIC8vIHRoYXQgYWxzbyBoYXBwZW5zIHRvIGhhdmUgY29tcGlsZWQgcHJvcHMuXG4gIHZhciBwcm9wcyA9IHRoaXMuJG9wdGlvbnMucHJvcHNcbiAgaWYgKHByb3BzKSB7XG4gICAgaSA9IHByb3BzLmxlbmd0aFxuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIGtleSA9IHByb3BzW2ldLm5hbWVcbiAgICAgIGlmIChrZXkgIT09ICckZGF0YScgJiYgIW5ld0RhdGEuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICBuZXdEYXRhLiRzZXQoa2V5LCBvbGREYXRhW2tleV0pXG4gICAgICB9XG4gICAgfVxuICB9XG4gIC8vIHVucHJveHkga2V5cyBub3QgcHJlc2VudCBpbiBuZXcgZGF0YVxuICBrZXlzID0gT2JqZWN0LmtleXMob2xkRGF0YSlcbiAgaSA9IGtleXMubGVuZ3RoXG4gIHdoaWxlIChpLS0pIHtcbiAgICBrZXkgPSBrZXlzW2ldXG4gICAgaWYgKCFfLmlzUmVzZXJ2ZWQoa2V5KSAmJiAhKGtleSBpbiBuZXdEYXRhKSkge1xuICAgICAgdGhpcy5fdW5wcm94eShrZXkpXG4gICAgfVxuICB9XG4gIC8vIHByb3h5IGtleXMgbm90IGFscmVhZHkgcHJveGllZCxcbiAgLy8gYW5kIHRyaWdnZXIgY2hhbmdlIGZvciBjaGFuZ2VkIHZhbHVlc1xuICBrZXlzID0gT2JqZWN0LmtleXMobmV3RGF0YSlcbiAgaSA9IGtleXMubGVuZ3RoXG4gIHdoaWxlIChpLS0pIHtcbiAgICBrZXkgPSBrZXlzW2ldXG4gICAgaWYgKCF0aGlzLmhhc093blByb3BlcnR5KGtleSkgJiYgIV8uaXNSZXNlcnZlZChrZXkpKSB7XG4gICAgICAvLyBuZXcgcHJvcGVydHlcbiAgICAgIHRoaXMuX3Byb3h5KGtleSlcbiAgICB9XG4gIH1cbiAgb2xkRGF0YS5fX29iX18ucmVtb3ZlVm0odGhpcylcbiAgT2JzZXJ2ZXIuY3JlYXRlKG5ld0RhdGEsIHRoaXMpXG4gIHRoaXMuX2RpZ2VzdCgpXG59XG5cbi8qKlxuICogUHJveHkgYSBwcm9wZXJ0eSwgc28gdGhhdFxuICogdm0ucHJvcCA9PT0gdm0uX2RhdGEucHJvcFxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBrZXlcbiAqL1xuXG5leHBvcnRzLl9wcm94eSA9IGZ1bmN0aW9uIChrZXkpIHtcbiAgLy8gbmVlZCB0byBzdG9yZSByZWYgdG8gc2VsZiBoZXJlXG4gIC8vIGJlY2F1c2UgdGhlc2UgZ2V0dGVyL3NldHRlcnMgbWlnaHRcbiAgLy8gYmUgY2FsbGVkIGJ5IGNoaWxkIGluc3RhbmNlcyFcbiAgdmFyIHNlbGYgPSB0aGlzXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShzZWxmLCBrZXksIHtcbiAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICBnZXQ6IGZ1bmN0aW9uIHByb3h5R2V0dGVyICgpIHtcbiAgICAgIHJldHVybiBzZWxmLl9kYXRhW2tleV1cbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gcHJveHlTZXR0ZXIgKHZhbCkge1xuICAgICAgc2VsZi5fZGF0YVtrZXldID0gdmFsXG4gICAgfVxuICB9KVxufVxuXG4vKipcbiAqIFVucHJveHkgYSBwcm9wZXJ0eS5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30ga2V5XG4gKi9cblxuZXhwb3J0cy5fdW5wcm94eSA9IGZ1bmN0aW9uIChrZXkpIHtcbiAgZGVsZXRlIHRoaXNba2V5XVxufVxuXG4vKipcbiAqIEZvcmNlIHVwZGF0ZSBvbiBldmVyeSB3YXRjaGVyIGluIHNjb3BlLlxuICovXG5cbmV4cG9ydHMuX2RpZ2VzdCA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIGkgPSB0aGlzLl93YXRjaGVycy5sZW5ndGhcbiAgd2hpbGUgKGktLSkge1xuICAgIHRoaXMuX3dhdGNoZXJzW2ldLnVwZGF0ZSh0cnVlKSAvLyBzaGFsbG93IHVwZGF0ZXNcbiAgfVxuICB2YXIgY2hpbGRyZW4gPSB0aGlzLiRjaGlsZHJlblxuICBpID0gY2hpbGRyZW4ubGVuZ3RoXG4gIHdoaWxlIChpLS0pIHtcbiAgICB2YXIgY2hpbGQgPSBjaGlsZHJlbltpXVxuICAgIGlmIChjaGlsZC4kb3B0aW9ucy5pbmhlcml0KSB7XG4gICAgICBjaGlsZC5fZGlnZXN0KClcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBTZXR1cCBjb21wdXRlZCBwcm9wZXJ0aWVzLiBUaGV5IGFyZSBlc3NlbnRpYWxseVxuICogc3BlY2lhbCBnZXR0ZXIvc2V0dGVyc1xuICovXG5cbmZ1bmN0aW9uIG5vb3AgKCkge31cbmV4cG9ydHMuX2luaXRDb21wdXRlZCA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIGNvbXB1dGVkID0gdGhpcy4kb3B0aW9ucy5jb21wdXRlZFxuICBpZiAoY29tcHV0ZWQpIHtcbiAgICBmb3IgKHZhciBrZXkgaW4gY29tcHV0ZWQpIHtcbiAgICAgIHZhciB1c2VyRGVmID0gY29tcHV0ZWRba2V5XVxuICAgICAgdmFyIGRlZiA9IHtcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICB9XG4gICAgICBpZiAodHlwZW9mIHVzZXJEZWYgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgZGVmLmdldCA9IG1ha2VDb21wdXRlZEdldHRlcih1c2VyRGVmLCB0aGlzKVxuICAgICAgICBkZWYuc2V0ID0gbm9vcFxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZGVmLmdldCA9IHVzZXJEZWYuZ2V0XG4gICAgICAgICAgPyB1c2VyRGVmLmNhY2hlICE9PSBmYWxzZVxuICAgICAgICAgICAgPyBtYWtlQ29tcHV0ZWRHZXR0ZXIodXNlckRlZi5nZXQsIHRoaXMpXG4gICAgICAgICAgICA6IF8uYmluZCh1c2VyRGVmLmdldCwgdGhpcylcbiAgICAgICAgICA6IG5vb3BcbiAgICAgICAgZGVmLnNldCA9IHVzZXJEZWYuc2V0XG4gICAgICAgICAgPyBfLmJpbmQodXNlckRlZi5zZXQsIHRoaXMpXG4gICAgICAgICAgOiBub29wXG4gICAgICB9XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywga2V5LCBkZWYpXG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIG1ha2VDb21wdXRlZEdldHRlciAoZ2V0dGVyLCBvd25lcikge1xuICB2YXIgd2F0Y2hlciA9IG5ldyBXYXRjaGVyKG93bmVyLCBnZXR0ZXIsIG51bGwsIHtcbiAgICBsYXp5OiB0cnVlXG4gIH0pXG4gIHJldHVybiBmdW5jdGlvbiBjb21wdXRlZEdldHRlciAoKSB7XG4gICAgaWYgKHdhdGNoZXIuZGlydHkpIHtcbiAgICAgIHdhdGNoZXIuZXZhbHVhdGUoKVxuICAgIH1cbiAgICBpZiAoRGVwLnRhcmdldCkge1xuICAgICAgd2F0Y2hlci5kZXBlbmQoKVxuICAgIH1cbiAgICByZXR1cm4gd2F0Y2hlci52YWx1ZVxuICB9XG59XG5cbi8qKlxuICogU2V0dXAgaW5zdGFuY2UgbWV0aG9kcy4gTWV0aG9kcyBtdXN0IGJlIGJvdW5kIHRvIHRoZVxuICogaW5zdGFuY2Ugc2luY2UgdGhleSBtaWdodCBiZSBjYWxsZWQgYnkgY2hpbGRyZW5cbiAqIGluaGVyaXRpbmcgdGhlbS5cbiAqL1xuXG5leHBvcnRzLl9pbml0TWV0aG9kcyA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIG1ldGhvZHMgPSB0aGlzLiRvcHRpb25zLm1ldGhvZHNcbiAgaWYgKG1ldGhvZHMpIHtcbiAgICBmb3IgKHZhciBrZXkgaW4gbWV0aG9kcykge1xuICAgICAgdGhpc1trZXldID0gXy5iaW5kKG1ldGhvZHNba2V5XSwgdGhpcylcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBJbml0aWFsaXplIG1ldGEgaW5mb3JtYXRpb24gbGlrZSAkaW5kZXgsICRrZXkgJiAkdmFsdWUuXG4gKi9cblxuZXhwb3J0cy5faW5pdE1ldGEgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBtZXRhcyA9IHRoaXMuJG9wdGlvbnMuX21ldGFcbiAgaWYgKG1ldGFzKSB7XG4gICAgZm9yICh2YXIga2V5IGluIG1ldGFzKSB7XG4gICAgICB0aGlzLl9kZWZpbmVNZXRhKGtleSwgbWV0YXNba2V5XSlcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBEZWZpbmUgYSBtZXRhIHByb3BlcnR5LCBlLmcgJGluZGV4LCAka2V5LCAkdmFsdWVcbiAqIHdoaWNoIG9ubHkgZXhpc3RzIG9uIHRoZSB2bSBpbnN0YW5jZSBidXQgbm90IGluICRkYXRhLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBrZXlcbiAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAqL1xuXG5leHBvcnRzLl9kZWZpbmVNZXRhID0gZnVuY3Rpb24gKGtleSwgdmFsdWUpIHtcbiAgdmFyIGRlcCA9IG5ldyBEZXAoKVxuICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywga2V5LCB7XG4gICAgZ2V0OiBmdW5jdGlvbiBtZXRhR2V0dGVyICgpIHtcbiAgICAgIGlmIChEZXAudGFyZ2V0KSB7XG4gICAgICAgIGRlcC5kZXBlbmQoKVxuICAgICAgfVxuICAgICAgcmV0dXJuIHZhbHVlXG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uIG1ldGFTZXR0ZXIgKHZhbCkge1xuICAgICAgaWYgKHZhbCAhPT0gdmFsdWUpIHtcbiAgICAgICAgdmFsdWUgPSB2YWxcbiAgICAgICAgZGVwLm5vdGlmeSgpXG4gICAgICB9XG4gICAgfVxuICB9KVxufVxuIiwidmFyIF8gPSByZXF1aXJlKCcuLi91dGlsJylcbnZhciBhcnJheVByb3RvID0gQXJyYXkucHJvdG90eXBlXG52YXIgYXJyYXlNZXRob2RzID0gT2JqZWN0LmNyZWF0ZShhcnJheVByb3RvKVxuXG4vKipcbiAqIEludGVyY2VwdCBtdXRhdGluZyBtZXRob2RzIGFuZCBlbWl0IGV2ZW50c1xuICovXG5cbjtbXG4gICdwdXNoJyxcbiAgJ3BvcCcsXG4gICdzaGlmdCcsXG4gICd1bnNoaWZ0JyxcbiAgJ3NwbGljZScsXG4gICdzb3J0JyxcbiAgJ3JldmVyc2UnXG5dXG4uZm9yRWFjaChmdW5jdGlvbiAobWV0aG9kKSB7XG4gIC8vIGNhY2hlIG9yaWdpbmFsIG1ldGhvZFxuICB2YXIgb3JpZ2luYWwgPSBhcnJheVByb3RvW21ldGhvZF1cbiAgXy5kZWZpbmUoYXJyYXlNZXRob2RzLCBtZXRob2QsIGZ1bmN0aW9uIG11dGF0b3IgKCkge1xuICAgIC8vIGF2b2lkIGxlYWtpbmcgYXJndW1lbnRzOlxuICAgIC8vIGh0dHA6Ly9qc3BlcmYuY29tL2Nsb3N1cmUtd2l0aC1hcmd1bWVudHNcbiAgICB2YXIgaSA9IGFyZ3VtZW50cy5sZW5ndGhcbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShpKVxuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIGFyZ3NbaV0gPSBhcmd1bWVudHNbaV1cbiAgICB9XG4gICAgdmFyIHJlc3VsdCA9IG9yaWdpbmFsLmFwcGx5KHRoaXMsIGFyZ3MpXG4gICAgdmFyIG9iID0gdGhpcy5fX29iX19cbiAgICB2YXIgaW5zZXJ0ZWQsIHJlbW92ZWRcbiAgICBzd2l0Y2ggKG1ldGhvZCkge1xuICAgICAgY2FzZSAncHVzaCc6XG4gICAgICAgIGluc2VydGVkID0gYXJnc1xuICAgICAgICBicmVha1xuICAgICAgY2FzZSAndW5zaGlmdCc6XG4gICAgICAgIGluc2VydGVkID0gYXJnc1xuICAgICAgICBicmVha1xuICAgICAgY2FzZSAnc3BsaWNlJzpcbiAgICAgICAgaW5zZXJ0ZWQgPSBhcmdzLnNsaWNlKDIpXG4gICAgICAgIHJlbW92ZWQgPSByZXN1bHRcbiAgICAgICAgYnJlYWtcbiAgICAgIGNhc2UgJ3BvcCc6XG4gICAgICBjYXNlICdzaGlmdCc6XG4gICAgICAgIHJlbW92ZWQgPSBbcmVzdWx0XVxuICAgICAgICBicmVha1xuICAgIH1cbiAgICBpZiAoaW5zZXJ0ZWQpIG9iLm9ic2VydmVBcnJheShpbnNlcnRlZClcbiAgICBpZiAocmVtb3ZlZCkgb2IudW5vYnNlcnZlQXJyYXkocmVtb3ZlZClcbiAgICAvLyBub3RpZnkgY2hhbmdlXG4gICAgb2Iubm90aWZ5KClcbiAgICByZXR1cm4gcmVzdWx0XG4gIH0pXG59KVxuXG4vKipcbiAqIFN3YXAgdGhlIGVsZW1lbnQgYXQgdGhlIGdpdmVuIGluZGV4IHdpdGggYSBuZXcgdmFsdWVcbiAqIGFuZCBlbWl0cyBjb3JyZXNwb25kaW5nIGV2ZW50LlxuICpcbiAqIEBwYXJhbSB7TnVtYmVyfSBpbmRleFxuICogQHBhcmFtIHsqfSB2YWxcbiAqIEByZXR1cm4geyp9IC0gcmVwbGFjZWQgZWxlbWVudFxuICovXG5cbl8uZGVmaW5lKFxuICBhcnJheVByb3RvLFxuICAnJHNldCcsXG4gIGZ1bmN0aW9uICRzZXQgKGluZGV4LCB2YWwpIHtcbiAgICBpZiAoaW5kZXggPj0gdGhpcy5sZW5ndGgpIHtcbiAgICAgIHRoaXMubGVuZ3RoID0gaW5kZXggKyAxXG4gICAgfVxuICAgIHJldHVybiB0aGlzLnNwbGljZShpbmRleCwgMSwgdmFsKVswXVxuICB9XG4pXG5cbi8qKlxuICogQ29udmVuaWVuY2UgbWV0aG9kIHRvIHJlbW92ZSB0aGUgZWxlbWVudCBhdCBnaXZlbiBpbmRleC5cbiAqXG4gKiBAcGFyYW0ge051bWJlcn0gaW5kZXhcbiAqIEBwYXJhbSB7Kn0gdmFsXG4gKi9cblxuXy5kZWZpbmUoXG4gIGFycmF5UHJvdG8sXG4gICckcmVtb3ZlJyxcbiAgZnVuY3Rpb24gJHJlbW92ZSAoaW5kZXgpIHtcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICBpZiAoIXRoaXMubGVuZ3RoKSByZXR1cm5cbiAgICBpZiAodHlwZW9mIGluZGV4ICE9PSAnbnVtYmVyJykge1xuICAgICAgaW5kZXggPSBfLmluZGV4T2YodGhpcywgaW5kZXgpXG4gICAgfVxuICAgIGlmIChpbmRleCA+IC0xKSB7XG4gICAgICByZXR1cm4gdGhpcy5zcGxpY2UoaW5kZXgsIDEpXG4gICAgfVxuICB9XG4pXG5cbm1vZHVsZS5leHBvcnRzID0gYXJyYXlNZXRob2RzXG4iLCJ2YXIgXyA9IHJlcXVpcmUoJy4uL3V0aWwnKVxuXG4vKipcbiAqIEEgZGVwIGlzIGFuIG9ic2VydmFibGUgdGhhdCBjYW4gaGF2ZSBtdWx0aXBsZVxuICogZGlyZWN0aXZlcyBzdWJzY3JpYmluZyB0byBpdC5cbiAqXG4gKiBAY29uc3RydWN0b3JcbiAqL1xuXG5mdW5jdGlvbiBEZXAgKCkge1xuICB0aGlzLnN1YnMgPSBbXVxufVxuXG4vLyB0aGUgY3VycmVudCB0YXJnZXQgd2F0Y2hlciBiZWluZyBldmFsdWF0ZWQuXG4vLyB0aGlzIGlzIGdsb2JhbGx5IHVuaXF1ZSBiZWNhdXNlIHRoZXJlIGNvdWxkIGJlIG9ubHkgb25lXG4vLyB3YXRjaGVyIGJlaW5nIGV2YWx1YXRlZCBhdCBhbnkgdGltZS5cbkRlcC50YXJnZXQgPSBudWxsXG5cbi8qKlxuICogQWRkIGEgZGlyZWN0aXZlIHN1YnNjcmliZXIuXG4gKlxuICogQHBhcmFtIHtEaXJlY3RpdmV9IHN1YlxuICovXG5cbkRlcC5wcm90b3R5cGUuYWRkU3ViID0gZnVuY3Rpb24gKHN1Yikge1xuICB0aGlzLnN1YnMucHVzaChzdWIpXG59XG5cbi8qKlxuICogUmVtb3ZlIGEgZGlyZWN0aXZlIHN1YnNjcmliZXIuXG4gKlxuICogQHBhcmFtIHtEaXJlY3RpdmV9IHN1YlxuICovXG5cbkRlcC5wcm90b3R5cGUucmVtb3ZlU3ViID0gZnVuY3Rpb24gKHN1Yikge1xuICB0aGlzLnN1YnMuJHJlbW92ZShzdWIpXG59XG5cbi8qKlxuICogQWRkIHNlbGYgYXMgYSBkZXBlbmRlbmN5IHRvIHRoZSB0YXJnZXQgd2F0Y2hlci5cbiAqL1xuXG5EZXAucHJvdG90eXBlLmRlcGVuZCA9IGZ1bmN0aW9uICgpIHtcbiAgRGVwLnRhcmdldC5hZGREZXAodGhpcylcbn1cblxuLyoqXG4gKiBOb3RpZnkgYWxsIHN1YnNjcmliZXJzIG9mIGEgbmV3IHZhbHVlLlxuICovXG5cbkRlcC5wcm90b3R5cGUubm90aWZ5ID0gZnVuY3Rpb24gKCkge1xuICAvLyBzdGFibGl6ZSB0aGUgc3Vic2NyaWJlciBsaXN0IGZpcnN0XG4gIHZhciBzdWJzID0gXy50b0FycmF5KHRoaXMuc3VicylcbiAgZm9yICh2YXIgaSA9IDAsIGwgPSBzdWJzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgIHN1YnNbaV0udXBkYXRlKClcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IERlcFxuIiwidmFyIF8gPSByZXF1aXJlKCcuLi91dGlsJylcbnZhciBjb25maWcgPSByZXF1aXJlKCcuLi9jb25maWcnKVxudmFyIERlcCA9IHJlcXVpcmUoJy4vZGVwJylcbnZhciBhcnJheU1ldGhvZHMgPSByZXF1aXJlKCcuL2FycmF5JylcbnZhciBhcnJheUtleXMgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhhcnJheU1ldGhvZHMpXG5yZXF1aXJlKCcuL29iamVjdCcpXG5cbi8qKlxuICogT2JzZXJ2ZXIgY2xhc3MgdGhhdCBhcmUgYXR0YWNoZWQgdG8gZWFjaCBvYnNlcnZlZFxuICogb2JqZWN0LiBPbmNlIGF0dGFjaGVkLCB0aGUgb2JzZXJ2ZXIgY29udmVydHMgdGFyZ2V0XG4gKiBvYmplY3QncyBwcm9wZXJ0eSBrZXlzIGludG8gZ2V0dGVyL3NldHRlcnMgdGhhdFxuICogY29sbGVjdCBkZXBlbmRlbmNpZXMgYW5kIGRpc3BhdGNoZXMgdXBkYXRlcy5cbiAqXG4gKiBAcGFyYW0ge0FycmF5fE9iamVjdH0gdmFsdWVcbiAqIEBjb25zdHJ1Y3RvclxuICovXG5cbmZ1bmN0aW9uIE9ic2VydmVyICh2YWx1ZSkge1xuICB0aGlzLnZhbHVlID0gdmFsdWVcbiAgdGhpcy5kZXAgPSBuZXcgRGVwKClcbiAgXy5kZWZpbmUodmFsdWUsICdfX29iX18nLCB0aGlzKVxuICBpZiAoXy5pc0FycmF5KHZhbHVlKSkge1xuICAgIHZhciBhdWdtZW50ID0gY29uZmlnLnByb3RvICYmIF8uaGFzUHJvdG9cbiAgICAgID8gcHJvdG9BdWdtZW50XG4gICAgICA6IGNvcHlBdWdtZW50XG4gICAgYXVnbWVudCh2YWx1ZSwgYXJyYXlNZXRob2RzLCBhcnJheUtleXMpXG4gICAgdGhpcy5vYnNlcnZlQXJyYXkodmFsdWUpXG4gIH0gZWxzZSB7XG4gICAgdGhpcy53YWxrKHZhbHVlKVxuICB9XG59XG5cbi8vIFN0YXRpYyBtZXRob2RzXG5cbi8qKlxuICogQXR0ZW1wdCB0byBjcmVhdGUgYW4gb2JzZXJ2ZXIgaW5zdGFuY2UgZm9yIGEgdmFsdWUsXG4gKiByZXR1cm5zIHRoZSBuZXcgb2JzZXJ2ZXIgaWYgc3VjY2Vzc2Z1bGx5IG9ic2VydmVkLFxuICogb3IgdGhlIGV4aXN0aW5nIG9ic2VydmVyIGlmIHRoZSB2YWx1ZSBhbHJlYWR5IGhhcyBvbmUuXG4gKlxuICogQHBhcmFtIHsqfSB2YWx1ZVxuICogQHBhcmFtIHtWdWV9IFt2bV1cbiAqIEByZXR1cm4ge09ic2VydmVyfHVuZGVmaW5lZH1cbiAqIEBzdGF0aWNcbiAqL1xuXG5PYnNlcnZlci5jcmVhdGUgPSBmdW5jdGlvbiAodmFsdWUsIHZtKSB7XG4gIHZhciBvYlxuICBpZiAoXG4gICAgdmFsdWUgJiZcbiAgICB2YWx1ZS5oYXNPd25Qcm9wZXJ0eSgnX19vYl9fJykgJiZcbiAgICB2YWx1ZS5fX29iX18gaW5zdGFuY2VvZiBPYnNlcnZlclxuICApIHtcbiAgICBvYiA9IHZhbHVlLl9fb2JfX1xuICB9IGVsc2UgaWYgKFxuICAgIChfLmlzQXJyYXkodmFsdWUpIHx8IF8uaXNQbGFpbk9iamVjdCh2YWx1ZSkpICYmXG4gICAgIU9iamVjdC5pc0Zyb3plbih2YWx1ZSkgJiZcbiAgICAhdmFsdWUuX2lzVnVlXG4gICkge1xuICAgIG9iID0gbmV3IE9ic2VydmVyKHZhbHVlKVxuICB9XG4gIGlmIChvYiAmJiB2bSkge1xuICAgIG9iLmFkZFZtKHZtKVxuICB9XG4gIHJldHVybiBvYlxufVxuXG4vLyBJbnN0YW5jZSBtZXRob2RzXG5cbi8qKlxuICogV2FsayB0aHJvdWdoIGVhY2ggcHJvcGVydHkgYW5kIGNvbnZlcnQgdGhlbSBpbnRvXG4gKiBnZXR0ZXIvc2V0dGVycy4gVGhpcyBtZXRob2Qgc2hvdWxkIG9ubHkgYmUgY2FsbGVkIHdoZW5cbiAqIHZhbHVlIHR5cGUgaXMgT2JqZWN0LiBQcm9wZXJ0aWVzIHByZWZpeGVkIHdpdGggYCRgIG9yIGBfYFxuICogYW5kIGFjY2Vzc29yIHByb3BlcnRpZXMgYXJlIGlnbm9yZWQuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IG9ialxuICovXG5cbk9ic2VydmVyLnByb3RvdHlwZS53YWxrID0gZnVuY3Rpb24gKG9iaikge1xuICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKG9iailcbiAgdmFyIGkgPSBrZXlzLmxlbmd0aFxuICB3aGlsZSAoaS0tKSB7XG4gICAgdGhpcy5jb252ZXJ0KGtleXNbaV0sIG9ialtrZXlzW2ldXSlcbiAgfVxufVxuXG4vKipcbiAqIFRyeSB0byBjYXJldGUgYW4gb2JzZXJ2ZXIgZm9yIGEgY2hpbGQgdmFsdWUsXG4gKiBhbmQgaWYgdmFsdWUgaXMgYXJyYXksIGxpbmsgZGVwIHRvIHRoZSBhcnJheS5cbiAqXG4gKiBAcGFyYW0geyp9IHZhbFxuICogQHJldHVybiB7RGVwfHVuZGVmaW5lZH1cbiAqL1xuXG5PYnNlcnZlci5wcm90b3R5cGUub2JzZXJ2ZSA9IGZ1bmN0aW9uICh2YWwpIHtcbiAgcmV0dXJuIE9ic2VydmVyLmNyZWF0ZSh2YWwpXG59XG5cbi8qKlxuICogT2JzZXJ2ZSBhIGxpc3Qgb2YgQXJyYXkgaXRlbXMuXG4gKlxuICogQHBhcmFtIHtBcnJheX0gaXRlbXNcbiAqL1xuXG5PYnNlcnZlci5wcm90b3R5cGUub2JzZXJ2ZUFycmF5ID0gZnVuY3Rpb24gKGl0ZW1zKSB7XG4gIHZhciBpID0gaXRlbXMubGVuZ3RoXG4gIHdoaWxlIChpLS0pIHtcbiAgICB2YXIgb2IgPSB0aGlzLm9ic2VydmUoaXRlbXNbaV0pXG4gICAgaWYgKG9iKSB7XG4gICAgICAob2IucGFyZW50cyB8fCAob2IucGFyZW50cyA9IFtdKSkucHVzaCh0aGlzKVxuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIFJlbW92ZSBzZWxmIGZyb20gdGhlIHBhcmVudCBsaXN0IG9mIHJlbW92ZWQgb2JqZWN0cy5cbiAqXG4gKiBAcGFyYW0ge0FycmF5fSBpdGVtc1xuICovXG5cbk9ic2VydmVyLnByb3RvdHlwZS51bm9ic2VydmVBcnJheSA9IGZ1bmN0aW9uIChpdGVtcykge1xuICB2YXIgaSA9IGl0ZW1zLmxlbmd0aFxuICB3aGlsZSAoaS0tKSB7XG4gICAgdmFyIG9iID0gaXRlbXNbaV0gJiYgaXRlbXNbaV0uX19vYl9fXG4gICAgaWYgKG9iKSB7XG4gICAgICBvYi5wYXJlbnRzLiRyZW1vdmUodGhpcylcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBOb3RpZnkgc2VsZiBkZXBlbmRlbmN5LCBhbmQgYWxzbyBwYXJlbnQgQXJyYXkgZGVwZW5kZW5jeVxuICogaWYgYW55LlxuICovXG5cbk9ic2VydmVyLnByb3RvdHlwZS5ub3RpZnkgPSBmdW5jdGlvbiAoKSB7XG4gIHRoaXMuZGVwLm5vdGlmeSgpXG4gIHZhciBwYXJlbnRzID0gdGhpcy5wYXJlbnRzXG4gIGlmIChwYXJlbnRzKSB7XG4gICAgdmFyIGkgPSBwYXJlbnRzLmxlbmd0aFxuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIHBhcmVudHNbaV0ubm90aWZ5KClcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBDb252ZXJ0IGEgcHJvcGVydHkgaW50byBnZXR0ZXIvc2V0dGVyIHNvIHdlIGNhbiBlbWl0XG4gKiB0aGUgZXZlbnRzIHdoZW4gdGhlIHByb3BlcnR5IGlzIGFjY2Vzc2VkL2NoYW5nZWQuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGtleVxuICogQHBhcmFtIHsqfSB2YWxcbiAqL1xuXG5PYnNlcnZlci5wcm90b3R5cGUuY29udmVydCA9IGZ1bmN0aW9uIChrZXksIHZhbCkge1xuICB2YXIgb2IgPSB0aGlzXG4gIHZhciBjaGlsZE9iID0gb2Iub2JzZXJ2ZSh2YWwpXG4gIHZhciBkZXAgPSBuZXcgRGVwKClcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iLnZhbHVlLCBrZXksIHtcbiAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgIGlmIChEZXAudGFyZ2V0KSB7XG4gICAgICAgIGRlcC5kZXBlbmQoKVxuICAgICAgICBpZiAoY2hpbGRPYikge1xuICAgICAgICAgIGNoaWxkT2IuZGVwLmRlcGVuZCgpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiB2YWxcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gKG5ld1ZhbCkge1xuICAgICAgaWYgKG5ld1ZhbCA9PT0gdmFsKSByZXR1cm5cbiAgICAgIHZhbCA9IG5ld1ZhbFxuICAgICAgY2hpbGRPYiA9IG9iLm9ic2VydmUobmV3VmFsKVxuICAgICAgZGVwLm5vdGlmeSgpXG4gICAgfVxuICB9KVxufVxuXG4vKipcbiAqIEFkZCBhbiBvd25lciB2bSwgc28gdGhhdCB3aGVuICRhZGQvJGRlbGV0ZSBtdXRhdGlvbnNcbiAqIGhhcHBlbiB3ZSBjYW4gbm90aWZ5IG93bmVyIHZtcyB0byBwcm94eSB0aGUga2V5cyBhbmRcbiAqIGRpZ2VzdCB0aGUgd2F0Y2hlcnMuIFRoaXMgaXMgb25seSBjYWxsZWQgd2hlbiB0aGUgb2JqZWN0XG4gKiBpcyBvYnNlcnZlZCBhcyBhbiBpbnN0YW5jZSdzIHJvb3QgJGRhdGEuXG4gKlxuICogQHBhcmFtIHtWdWV9IHZtXG4gKi9cblxuT2JzZXJ2ZXIucHJvdG90eXBlLmFkZFZtID0gZnVuY3Rpb24gKHZtKSB7XG4gICh0aGlzLnZtcyB8fCAodGhpcy52bXMgPSBbXSkpLnB1c2godm0pXG59XG5cbi8qKlxuICogUmVtb3ZlIGFuIG93bmVyIHZtLiBUaGlzIGlzIGNhbGxlZCB3aGVuIHRoZSBvYmplY3QgaXNcbiAqIHN3YXBwZWQgb3V0IGFzIGFuIGluc3RhbmNlJ3MgJGRhdGEgb2JqZWN0LlxuICpcbiAqIEBwYXJhbSB7VnVlfSB2bVxuICovXG5cbk9ic2VydmVyLnByb3RvdHlwZS5yZW1vdmVWbSA9IGZ1bmN0aW9uICh2bSkge1xuICB0aGlzLnZtcy4kcmVtb3ZlKHZtKVxufVxuXG4vLyBoZWxwZXJzXG5cbi8qKlxuICogQXVnbWVudCBhbiB0YXJnZXQgT2JqZWN0IG9yIEFycmF5IGJ5IGludGVyY2VwdGluZ1xuICogdGhlIHByb3RvdHlwZSBjaGFpbiB1c2luZyBfX3Byb3RvX19cbiAqXG4gKiBAcGFyYW0ge09iamVjdHxBcnJheX0gdGFyZ2V0XG4gKiBAcGFyYW0ge09iamVjdH0gcHJvdG9cbiAqL1xuXG5mdW5jdGlvbiBwcm90b0F1Z21lbnQgKHRhcmdldCwgc3JjKSB7XG4gIHRhcmdldC5fX3Byb3RvX18gPSBzcmNcbn1cblxuLyoqXG4gKiBBdWdtZW50IGFuIHRhcmdldCBPYmplY3Qgb3IgQXJyYXkgYnkgZGVmaW5pbmdcbiAqIGhpZGRlbiBwcm9wZXJ0aWVzLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fEFycmF5fSB0YXJnZXRcbiAqIEBwYXJhbSB7T2JqZWN0fSBwcm90b1xuICovXG5cbmZ1bmN0aW9uIGNvcHlBdWdtZW50ICh0YXJnZXQsIHNyYywga2V5cykge1xuICB2YXIgaSA9IGtleXMubGVuZ3RoXG4gIHZhciBrZXlcbiAgd2hpbGUgKGktLSkge1xuICAgIGtleSA9IGtleXNbaV1cbiAgICBfLmRlZmluZSh0YXJnZXQsIGtleSwgc3JjW2tleV0pXG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBPYnNlcnZlclxuIiwidmFyIF8gPSByZXF1aXJlKCcuLi91dGlsJylcbnZhciBvYmpQcm90byA9IE9iamVjdC5wcm90b3R5cGVcblxuLyoqXG4gKiBBZGQgYSBuZXcgcHJvcGVydHkgdG8gYW4gb2JzZXJ2ZWQgb2JqZWN0XG4gKiBhbmQgZW1pdHMgY29ycmVzcG9uZGluZyBldmVudFxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBrZXlcbiAqIEBwYXJhbSB7Kn0gdmFsXG4gKiBAcHVibGljXG4gKi9cblxuXy5kZWZpbmUoXG4gIG9ialByb3RvLFxuICAnJGFkZCcsXG4gIGZ1bmN0aW9uICRhZGQgKGtleSwgdmFsKSB7XG4gICAgaWYgKHRoaXMuaGFzT3duUHJvcGVydHkoa2V5KSkgcmV0dXJuXG4gICAgdmFyIG9iID0gdGhpcy5fX29iX19cbiAgICBpZiAoIW9iIHx8IF8uaXNSZXNlcnZlZChrZXkpKSB7XG4gICAgICB0aGlzW2tleV0gPSB2YWxcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICBvYi5jb252ZXJ0KGtleSwgdmFsKVxuICAgIG9iLm5vdGlmeSgpXG4gICAgaWYgKG9iLnZtcykge1xuICAgICAgdmFyIGkgPSBvYi52bXMubGVuZ3RoXG4gICAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgIHZhciB2bSA9IG9iLnZtc1tpXVxuICAgICAgICB2bS5fcHJveHkoa2V5KVxuICAgICAgICB2bS5fZGlnZXN0KClcbiAgICAgIH1cbiAgICB9XG4gIH1cbilcblxuLyoqXG4gKiBTZXQgYSBwcm9wZXJ0eSBvbiBhbiBvYnNlcnZlZCBvYmplY3QsIGNhbGxpbmcgYWRkIHRvXG4gKiBlbnN1cmUgdGhlIHByb3BlcnR5IGlzIG9ic2VydmVkLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBrZXlcbiAqIEBwYXJhbSB7Kn0gdmFsXG4gKiBAcHVibGljXG4gKi9cblxuXy5kZWZpbmUoXG4gIG9ialByb3RvLFxuICAnJHNldCcsXG4gIGZ1bmN0aW9uICRzZXQgKGtleSwgdmFsKSB7XG4gICAgdGhpcy4kYWRkKGtleSwgdmFsKVxuICAgIHRoaXNba2V5XSA9IHZhbFxuICB9XG4pXG5cbi8qKlxuICogRGVsZXRlcyBhIHByb3BlcnR5IGZyb20gYW4gb2JzZXJ2ZWQgb2JqZWN0XG4gKiBhbmQgZW1pdHMgY29ycmVzcG9uZGluZyBldmVudFxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBrZXlcbiAqIEBwdWJsaWNcbiAqL1xuXG5fLmRlZmluZShcbiAgb2JqUHJvdG8sXG4gICckZGVsZXRlJyxcbiAgZnVuY3Rpb24gJGRlbGV0ZSAoa2V5KSB7XG4gICAgaWYgKCF0aGlzLmhhc093blByb3BlcnR5KGtleSkpIHJldHVyblxuICAgIGRlbGV0ZSB0aGlzW2tleV1cbiAgICB2YXIgb2IgPSB0aGlzLl9fb2JfX1xuICAgIGlmICghb2IgfHwgXy5pc1Jlc2VydmVkKGtleSkpIHtcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICBvYi5ub3RpZnkoKVxuICAgIGlmIChvYi52bXMpIHtcbiAgICAgIHZhciBpID0gb2Iudm1zLmxlbmd0aFxuICAgICAgd2hpbGUgKGktLSkge1xuICAgICAgICB2YXIgdm0gPSBvYi52bXNbaV1cbiAgICAgICAgdm0uX3VucHJveHkoa2V5KVxuICAgICAgICB2bS5fZGlnZXN0KClcbiAgICAgIH1cbiAgICB9XG4gIH1cbilcbiIsInZhciBfID0gcmVxdWlyZSgnLi4vdXRpbCcpXG52YXIgQ2FjaGUgPSByZXF1aXJlKCcuLi9jYWNoZScpXG52YXIgY2FjaGUgPSBuZXcgQ2FjaGUoMTAwMClcbnZhciBhcmdSRSA9IC9eW15cXHtcXD9dKyR8XidbXiddKickfF5cIlteXCJdKlwiJC9cbnZhciBmaWx0ZXJUb2tlblJFID0gL1teXFxzJ1wiXSt8J1teJ10qJ3xcIlteXCJdKlwiL2dcbnZhciByZXNlcnZlZEFyZ1JFID0gL15pbiR8Xi0/XFxkKy9cblxuLyoqXG4gKiBQYXJzZXIgc3RhdGVcbiAqL1xuXG52YXIgc3RyXG52YXIgYywgaSwgbFxudmFyIGluU2luZ2xlXG52YXIgaW5Eb3VibGVcbnZhciBjdXJseVxudmFyIHNxdWFyZVxudmFyIHBhcmVuXG52YXIgYmVnaW5cbnZhciBhcmdJbmRleFxudmFyIGRpcnNcbnZhciBkaXJcbnZhciBsYXN0RmlsdGVySW5kZXhcbnZhciBhcmdcblxuLyoqXG4gKiBQdXNoIGEgZGlyZWN0aXZlIG9iamVjdCBpbnRvIHRoZSByZXN1bHQgQXJyYXlcbiAqL1xuXG5mdW5jdGlvbiBwdXNoRGlyICgpIHtcbiAgZGlyLnJhdyA9IHN0ci5zbGljZShiZWdpbiwgaSkudHJpbSgpXG4gIGlmIChkaXIuZXhwcmVzc2lvbiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgZGlyLmV4cHJlc3Npb24gPSBzdHIuc2xpY2UoYXJnSW5kZXgsIGkpLnRyaW0oKVxuICB9IGVsc2UgaWYgKGxhc3RGaWx0ZXJJbmRleCAhPT0gYmVnaW4pIHtcbiAgICBwdXNoRmlsdGVyKClcbiAgfVxuICBpZiAoaSA9PT0gMCB8fCBkaXIuZXhwcmVzc2lvbikge1xuICAgIGRpcnMucHVzaChkaXIpXG4gIH1cbn1cblxuLyoqXG4gKiBQdXNoIGEgZmlsdGVyIHRvIHRoZSBjdXJyZW50IGRpcmVjdGl2ZSBvYmplY3RcbiAqL1xuXG5mdW5jdGlvbiBwdXNoRmlsdGVyICgpIHtcbiAgdmFyIGV4cCA9IHN0ci5zbGljZShsYXN0RmlsdGVySW5kZXgsIGkpLnRyaW0oKVxuICB2YXIgZmlsdGVyXG4gIGlmIChleHApIHtcbiAgICBmaWx0ZXIgPSB7fVxuICAgIHZhciB0b2tlbnMgPSBleHAubWF0Y2goZmlsdGVyVG9rZW5SRSlcbiAgICBmaWx0ZXIubmFtZSA9IHRva2Vuc1swXVxuICAgIGlmICh0b2tlbnMubGVuZ3RoID4gMSkge1xuICAgICAgZmlsdGVyLmFyZ3MgPSB0b2tlbnMuc2xpY2UoMSkubWFwKHByb2Nlc3NGaWx0ZXJBcmcpXG4gICAgfVxuICB9XG4gIGlmIChmaWx0ZXIpIHtcbiAgICAoZGlyLmZpbHRlcnMgPSBkaXIuZmlsdGVycyB8fCBbXSkucHVzaChmaWx0ZXIpXG4gIH1cbiAgbGFzdEZpbHRlckluZGV4ID0gaSArIDFcbn1cblxuLyoqXG4gKiBDaGVjayBpZiBhbiBhcmd1bWVudCBpcyBkeW5hbWljIGFuZCBzdHJpcCBxdW90ZXMuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGFyZ1xuICogQHJldHVybiB7T2JqZWN0fVxuICovXG5cbmZ1bmN0aW9uIHByb2Nlc3NGaWx0ZXJBcmcgKGFyZykge1xuICB2YXIgc3RyaXBwZWQgPSByZXNlcnZlZEFyZ1JFLnRlc3QoYXJnKVxuICAgID8gYXJnXG4gICAgOiBfLnN0cmlwUXVvdGVzKGFyZylcbiAgdmFyIGR5bmFtaWMgPSBzdHJpcHBlZCA9PT0gZmFsc2VcbiAgcmV0dXJuIHtcbiAgICB2YWx1ZTogZHluYW1pYyA/IGFyZyA6IHN0cmlwcGVkLFxuICAgIGR5bmFtaWM6IGR5bmFtaWNcbiAgfVxufVxuXG4vKipcbiAqIFBhcnNlIGEgZGlyZWN0aXZlIHN0cmluZyBpbnRvIGFuIEFycmF5IG9mIEFTVC1saWtlXG4gKiBvYmplY3RzIHJlcHJlc2VudGluZyBkaXJlY3RpdmVzLlxuICpcbiAqIEV4YW1wbGU6XG4gKlxuICogXCJjbGljazogYSA9IGEgKyAxIHwgdXBwZXJjYXNlXCIgd2lsbCB5aWVsZDpcbiAqIHtcbiAqICAgYXJnOiAnY2xpY2snLFxuICogICBleHByZXNzaW9uOiAnYSA9IGEgKyAxJyxcbiAqICAgZmlsdGVyczogW1xuICogICAgIHsgbmFtZTogJ3VwcGVyY2FzZScsIGFyZ3M6IG51bGwgfVxuICogICBdXG4gKiB9XG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0clxuICogQHJldHVybiB7QXJyYXk8T2JqZWN0Pn1cbiAqL1xuXG5leHBvcnRzLnBhcnNlID0gZnVuY3Rpb24gKHMpIHtcblxuICB2YXIgaGl0ID0gY2FjaGUuZ2V0KHMpXG4gIGlmIChoaXQpIHtcbiAgICByZXR1cm4gaGl0XG4gIH1cblxuICAvLyByZXNldCBwYXJzZXIgc3RhdGVcbiAgc3RyID0gc1xuICBpblNpbmdsZSA9IGluRG91YmxlID0gZmFsc2VcbiAgY3VybHkgPSBzcXVhcmUgPSBwYXJlbiA9IGJlZ2luID0gYXJnSW5kZXggPSAwXG4gIGxhc3RGaWx0ZXJJbmRleCA9IDBcbiAgZGlycyA9IFtdXG4gIGRpciA9IHt9XG4gIGFyZyA9IG51bGxcblxuICBmb3IgKGkgPSAwLCBsID0gc3RyLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgIGMgPSBzdHIuY2hhckNvZGVBdChpKVxuICAgIGlmIChpblNpbmdsZSkge1xuICAgICAgLy8gY2hlY2sgc2luZ2xlIHF1b3RlXG4gICAgICBpZiAoYyA9PT0gMHgyNykgaW5TaW5nbGUgPSAhaW5TaW5nbGVcbiAgICB9IGVsc2UgaWYgKGluRG91YmxlKSB7XG4gICAgICAvLyBjaGVjayBkb3VibGUgcXVvdGVcbiAgICAgIGlmIChjID09PSAweDIyKSBpbkRvdWJsZSA9ICFpbkRvdWJsZVxuICAgIH0gZWxzZSBpZiAoXG4gICAgICBjID09PSAweDJDICYmIC8vIGNvbW1hXG4gICAgICAhcGFyZW4gJiYgIWN1cmx5ICYmICFzcXVhcmVcbiAgICApIHtcbiAgICAgIC8vIHJlYWNoZWQgdGhlIGVuZCBvZiBhIGRpcmVjdGl2ZVxuICAgICAgcHVzaERpcigpXG4gICAgICAvLyByZXNldCAmIHNraXAgdGhlIGNvbW1hXG4gICAgICBkaXIgPSB7fVxuICAgICAgYmVnaW4gPSBhcmdJbmRleCA9IGxhc3RGaWx0ZXJJbmRleCA9IGkgKyAxXG4gICAgfSBlbHNlIGlmIChcbiAgICAgIGMgPT09IDB4M0EgJiYgLy8gY29sb25cbiAgICAgICFkaXIuZXhwcmVzc2lvbiAmJlxuICAgICAgIWRpci5hcmdcbiAgICApIHtcbiAgICAgIC8vIGFyZ3VtZW50XG4gICAgICBhcmcgPSBzdHIuc2xpY2UoYmVnaW4sIGkpLnRyaW0oKVxuICAgICAgLy8gdGVzdCBmb3IgdmFsaWQgYXJndW1lbnQgaGVyZVxuICAgICAgLy8gc2luY2Ugd2UgbWF5IGhhdmUgY2F1Z2h0IHN0dWZmIGxpa2UgZmlyc3QgaGFsZiBvZlxuICAgICAgLy8gYW4gb2JqZWN0IGxpdGVyYWwgb3IgYSB0ZXJuYXJ5IGV4cHJlc3Npb24uXG4gICAgICBpZiAoYXJnUkUudGVzdChhcmcpKSB7XG4gICAgICAgIGFyZ0luZGV4ID0gaSArIDFcbiAgICAgICAgZGlyLmFyZyA9IF8uc3RyaXBRdW90ZXMoYXJnKSB8fCBhcmdcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKFxuICAgICAgYyA9PT0gMHg3QyAmJiAvLyBwaXBlXG4gICAgICBzdHIuY2hhckNvZGVBdChpICsgMSkgIT09IDB4N0MgJiZcbiAgICAgIHN0ci5jaGFyQ29kZUF0KGkgLSAxKSAhPT0gMHg3Q1xuICAgICkge1xuICAgICAgaWYgKGRpci5leHByZXNzaW9uID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgLy8gZmlyc3QgZmlsdGVyLCBlbmQgb2YgZXhwcmVzc2lvblxuICAgICAgICBsYXN0RmlsdGVySW5kZXggPSBpICsgMVxuICAgICAgICBkaXIuZXhwcmVzc2lvbiA9IHN0ci5zbGljZShhcmdJbmRleCwgaSkudHJpbSgpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBhbHJlYWR5IGhhcyBmaWx0ZXJcbiAgICAgICAgcHVzaEZpbHRlcigpXG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHN3aXRjaCAoYykge1xuICAgICAgICBjYXNlIDB4MjI6IGluRG91YmxlID0gdHJ1ZTsgYnJlYWsgLy8gXCJcbiAgICAgICAgY2FzZSAweDI3OiBpblNpbmdsZSA9IHRydWU7IGJyZWFrIC8vICdcbiAgICAgICAgY2FzZSAweDI4OiBwYXJlbisrOyBicmVhayAgICAgICAgIC8vIChcbiAgICAgICAgY2FzZSAweDI5OiBwYXJlbi0tOyBicmVhayAgICAgICAgIC8vIClcbiAgICAgICAgY2FzZSAweDVCOiBzcXVhcmUrKzsgYnJlYWsgICAgICAgIC8vIFtcbiAgICAgICAgY2FzZSAweDVEOiBzcXVhcmUtLTsgYnJlYWsgICAgICAgIC8vIF1cbiAgICAgICAgY2FzZSAweDdCOiBjdXJseSsrOyBicmVhayAgICAgICAgIC8vIHtcbiAgICAgICAgY2FzZSAweDdEOiBjdXJseS0tOyBicmVhayAgICAgICAgIC8vIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBpZiAoaSA9PT0gMCB8fCBiZWdpbiAhPT0gaSkge1xuICAgIHB1c2hEaXIoKVxuICB9XG5cbiAgY2FjaGUucHV0KHMsIGRpcnMpXG4gIHJldHVybiBkaXJzXG59XG4iLCJ2YXIgXyA9IHJlcXVpcmUoJy4uL3V0aWwnKVxudmFyIFBhdGggPSByZXF1aXJlKCcuL3BhdGgnKVxudmFyIENhY2hlID0gcmVxdWlyZSgnLi4vY2FjaGUnKVxudmFyIGV4cHJlc3Npb25DYWNoZSA9IG5ldyBDYWNoZSgxMDAwKVxuXG52YXIgYWxsb3dlZEtleXdvcmRzID1cbiAgJ01hdGgsRGF0ZSx0aGlzLHRydWUsZmFsc2UsbnVsbCx1bmRlZmluZWQsSW5maW5pdHksTmFOLCcgK1xuICAnaXNOYU4saXNGaW5pdGUsZGVjb2RlVVJJLGRlY29kZVVSSUNvbXBvbmVudCxlbmNvZGVVUkksJyArXG4gICdlbmNvZGVVUklDb21wb25lbnQscGFyc2VJbnQscGFyc2VGbG9hdCdcbnZhciBhbGxvd2VkS2V5d29yZHNSRSA9XG4gIG5ldyBSZWdFeHAoJ14oJyArIGFsbG93ZWRLZXl3b3Jkcy5yZXBsYWNlKC8sL2csICdcXFxcYnwnKSArICdcXFxcYiknKVxuXG4vLyBrZXl3b3JkcyB0aGF0IGRvbid0IG1ha2Ugc2Vuc2UgaW5zaWRlIGV4cHJlc3Npb25zXG52YXIgaW1wcm9wZXJLZXl3b3JkcyA9XG4gICdicmVhayxjYXNlLGNsYXNzLGNhdGNoLGNvbnN0LGNvbnRpbnVlLGRlYnVnZ2VyLGRlZmF1bHQsJyArXG4gICdkZWxldGUsZG8sZWxzZSxleHBvcnQsZXh0ZW5kcyxmaW5hbGx5LGZvcixmdW5jdGlvbixpZiwnICtcbiAgJ2ltcG9ydCxpbixpbnN0YW5jZW9mLGxldCxyZXR1cm4sc3VwZXIsc3dpdGNoLHRocm93LHRyeSwnICtcbiAgJ3Zhcix3aGlsZSx3aXRoLHlpZWxkLGVudW0sYXdhaXQsaW1wbGVtZW50cyxwYWNrYWdlLCcgK1xuICAncHJvY3RlY3RlZCxzdGF0aWMsaW50ZXJmYWNlLHByaXZhdGUscHVibGljJ1xudmFyIGltcHJvcGVyS2V5d29yZHNSRSA9XG4gIG5ldyBSZWdFeHAoJ14oJyArIGltcHJvcGVyS2V5d29yZHMucmVwbGFjZSgvLC9nLCAnXFxcXGJ8JykgKyAnXFxcXGIpJylcblxudmFyIHdzUkUgPSAvXFxzL2dcbnZhciBuZXdsaW5lUkUgPSAvXFxuL2dcbnZhciBzYXZlUkUgPSAvW1xceyxdXFxzKltcXHdcXCRfXStcXHMqOnwoJ1teJ10qJ3xcIlteXCJdKlwiKXxuZXcgfHR5cGVvZiB8dm9pZCAvZ1xudmFyIHJlc3RvcmVSRSA9IC9cIihcXGQrKVwiL2dcbnZhciBwYXRoVGVzdFJFID0gL15bQS1aYS16XyRdW1xcdyRdKihcXC5bQS1aYS16XyRdW1xcdyRdKnxcXFsnLio/J1xcXXxcXFtcIi4qP1wiXFxdfFxcW1xcZCtcXF18XFxbW0EtWmEtel8kXVtcXHckXSpcXF0pKiQvXG52YXIgcGF0aFJlcGxhY2VSRSA9IC9bXlxcdyRcXC5dKFtBLVphLXpfJF1bXFx3JF0qKFxcLltBLVphLXpfJF1bXFx3JF0qfFxcWycuKj8nXFxdfFxcW1wiLio/XCJcXF0pKikvZ1xudmFyIGJvb2xlYW5MaXRlcmFsUkUgPSAvXih0cnVlfGZhbHNlKSQvXG5cbi8qKlxuICogU2F2ZSAvIFJld3JpdGUgLyBSZXN0b3JlXG4gKlxuICogV2hlbiByZXdyaXRpbmcgcGF0aHMgZm91bmQgaW4gYW4gZXhwcmVzc2lvbiwgaXQgaXNcbiAqIHBvc3NpYmxlIGZvciB0aGUgc2FtZSBsZXR0ZXIgc2VxdWVuY2VzIHRvIGJlIGZvdW5kIGluXG4gKiBzdHJpbmdzIGFuZCBPYmplY3QgbGl0ZXJhbCBwcm9wZXJ0eSBrZXlzLiBUaGVyZWZvcmUgd2VcbiAqIHJlbW92ZSBhbmQgc3RvcmUgdGhlc2UgcGFydHMgaW4gYSB0ZW1wb3JhcnkgYXJyYXksIGFuZFxuICogcmVzdG9yZSB0aGVtIGFmdGVyIHRoZSBwYXRoIHJld3JpdGUuXG4gKi9cblxudmFyIHNhdmVkID0gW11cblxuLyoqXG4gKiBTYXZlIHJlcGxhY2VyXG4gKlxuICogVGhlIHNhdmUgcmVnZXggY2FuIG1hdGNoIHR3byBwb3NzaWJsZSBjYXNlczpcbiAqIDEuIEFuIG9wZW5pbmcgb2JqZWN0IGxpdGVyYWxcbiAqIDIuIEEgc3RyaW5nXG4gKiBJZiBtYXRjaGVkIGFzIGEgcGxhaW4gc3RyaW5nLCB3ZSBuZWVkIHRvIGVzY2FwZSBpdHNcbiAqIG5ld2xpbmVzLCBzaW5jZSB0aGUgc3RyaW5nIG5lZWRzIHRvIGJlIHByZXNlcnZlZCB3aGVuXG4gKiBnZW5lcmF0aW5nIHRoZSBmdW5jdGlvbiBib2R5LlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHJcbiAqIEBwYXJhbSB7U3RyaW5nfSBpc1N0cmluZyAtIHN0ciBpZiBtYXRjaGVkIGFzIGEgc3RyaW5nXG4gKiBAcmV0dXJuIHtTdHJpbmd9IC0gcGxhY2Vob2xkZXIgd2l0aCBpbmRleFxuICovXG5cbmZ1bmN0aW9uIHNhdmUgKHN0ciwgaXNTdHJpbmcpIHtcbiAgdmFyIGkgPSBzYXZlZC5sZW5ndGhcbiAgc2F2ZWRbaV0gPSBpc1N0cmluZ1xuICAgID8gc3RyLnJlcGxhY2UobmV3bGluZVJFLCAnXFxcXG4nKVxuICAgIDogc3RyXG4gIHJldHVybiAnXCInICsgaSArICdcIidcbn1cblxuLyoqXG4gKiBQYXRoIHJld3JpdGUgcmVwbGFjZXJcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gcmF3XG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKi9cblxuZnVuY3Rpb24gcmV3cml0ZSAocmF3KSB7XG4gIHZhciBjID0gcmF3LmNoYXJBdCgwKVxuICB2YXIgcGF0aCA9IHJhdy5zbGljZSgxKVxuICBpZiAoYWxsb3dlZEtleXdvcmRzUkUudGVzdChwYXRoKSkge1xuICAgIHJldHVybiByYXdcbiAgfSBlbHNlIHtcbiAgICBwYXRoID0gcGF0aC5pbmRleE9mKCdcIicpID4gLTFcbiAgICAgID8gcGF0aC5yZXBsYWNlKHJlc3RvcmVSRSwgcmVzdG9yZSlcbiAgICAgIDogcGF0aFxuICAgIHJldHVybiBjICsgJ3Njb3BlLicgKyBwYXRoXG4gIH1cbn1cblxuLyoqXG4gKiBSZXN0b3JlIHJlcGxhY2VyXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0clxuICogQHBhcmFtIHtTdHJpbmd9IGkgLSBtYXRjaGVkIHNhdmUgaW5kZXhcbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqL1xuXG5mdW5jdGlvbiByZXN0b3JlIChzdHIsIGkpIHtcbiAgcmV0dXJuIHNhdmVkW2ldXG59XG5cbi8qKlxuICogUmV3cml0ZSBhbiBleHByZXNzaW9uLCBwcmVmaXhpbmcgYWxsIHBhdGggYWNjZXNzb3JzIHdpdGhcbiAqIGBzY29wZS5gIGFuZCBnZW5lcmF0ZSBnZXR0ZXIvc2V0dGVyIGZ1bmN0aW9ucy5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gZXhwXG4gKiBAcGFyYW0ge0Jvb2xlYW59IG5lZWRTZXRcbiAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuICovXG5cbmZ1bmN0aW9uIGNvbXBpbGVFeHBGbnMgKGV4cCwgbmVlZFNldCkge1xuICBpZiAoaW1wcm9wZXJLZXl3b3Jkc1JFLnRlc3QoZXhwKSkge1xuICAgIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgJiYgXy53YXJuKFxuICAgICAgJ0F2b2lkIHVzaW5nIHJlc2VydmVkIGtleXdvcmRzIGluIGV4cHJlc3Npb246ICcgKyBleHBcbiAgICApXG4gIH1cbiAgLy8gcmVzZXQgc3RhdGVcbiAgc2F2ZWQubGVuZ3RoID0gMFxuICAvLyBzYXZlIHN0cmluZ3MgYW5kIG9iamVjdCBsaXRlcmFsIGtleXNcbiAgdmFyIGJvZHkgPSBleHBcbiAgICAucmVwbGFjZShzYXZlUkUsIHNhdmUpXG4gICAgLnJlcGxhY2Uod3NSRSwgJycpXG4gIC8vIHJld3JpdGUgYWxsIHBhdGhzXG4gIC8vIHBhZCAxIHNwYWNlIGhlcmUgYmVjYXVlIHRoZSByZWdleCBtYXRjaGVzIDEgZXh0cmEgY2hhclxuICBib2R5ID0gKCcgJyArIGJvZHkpXG4gICAgLnJlcGxhY2UocGF0aFJlcGxhY2VSRSwgcmV3cml0ZSlcbiAgICAucmVwbGFjZShyZXN0b3JlUkUsIHJlc3RvcmUpXG4gIHZhciBnZXR0ZXIgPSBtYWtlR2V0dGVyKGJvZHkpXG4gIGlmIChnZXR0ZXIpIHtcbiAgICByZXR1cm4ge1xuICAgICAgZ2V0OiBnZXR0ZXIsXG4gICAgICBib2R5OiBib2R5LFxuICAgICAgc2V0OiBuZWVkU2V0XG4gICAgICAgID8gbWFrZVNldHRlcihib2R5KVxuICAgICAgICA6IG51bGxcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBDb21waWxlIGdldHRlciBzZXR0ZXJzIGZvciBhIHNpbXBsZSBwYXRoLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBleHBcbiAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuICovXG5cbmZ1bmN0aW9uIGNvbXBpbGVQYXRoRm5zIChleHApIHtcbiAgdmFyIGdldHRlciwgcGF0aFxuICBpZiAoZXhwLmluZGV4T2YoJ1snKSA8IDApIHtcbiAgICAvLyByZWFsbHkgc2ltcGxlIHBhdGhcbiAgICBwYXRoID0gZXhwLnNwbGl0KCcuJylcbiAgICBwYXRoLnJhdyA9IGV4cFxuICAgIGdldHRlciA9IFBhdGguY29tcGlsZUdldHRlcihwYXRoKVxuICB9IGVsc2Uge1xuICAgIC8vIGRvIHRoZSByZWFsIHBhcnNpbmdcbiAgICBwYXRoID0gUGF0aC5wYXJzZShleHApXG4gICAgZ2V0dGVyID0gcGF0aC5nZXRcbiAgfVxuICByZXR1cm4ge1xuICAgIGdldDogZ2V0dGVyLFxuICAgIC8vIGFsd2F5cyBnZW5lcmF0ZSBzZXR0ZXIgZm9yIHNpbXBsZSBwYXRoc1xuICAgIHNldDogZnVuY3Rpb24gKG9iaiwgdmFsKSB7XG4gICAgICBQYXRoLnNldChvYmosIHBhdGgsIHZhbClcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBCdWlsZCBhIGdldHRlciBmdW5jdGlvbi4gUmVxdWlyZXMgZXZhbC5cbiAqXG4gKiBXZSBpc29sYXRlIHRoZSB0cnkvY2F0Y2ggc28gaXQgZG9lc24ndCBhZmZlY3QgdGhlXG4gKiBvcHRpbWl6YXRpb24gb2YgdGhlIHBhcnNlIGZ1bmN0aW9uIHdoZW4gaXQgaXMgbm90IGNhbGxlZC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gYm9keVxuICogQHJldHVybiB7RnVuY3Rpb258dW5kZWZpbmVkfVxuICovXG5cbmZ1bmN0aW9uIG1ha2VHZXR0ZXIgKGJvZHkpIHtcbiAgdHJ5IHtcbiAgICByZXR1cm4gbmV3IEZ1bmN0aW9uKCdzY29wZScsICdyZXR1cm4gJyArIGJvZHkgKyAnOycpXG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nICYmIF8ud2FybihcbiAgICAgICdJbnZhbGlkIGV4cHJlc3Npb24uICcgK1xuICAgICAgJ0dlbmVyYXRlZCBmdW5jdGlvbiBib2R5OiAnICsgYm9keVxuICAgIClcbiAgfVxufVxuXG4vKipcbiAqIEJ1aWxkIGEgc2V0dGVyIGZ1bmN0aW9uLlxuICpcbiAqIFRoaXMgaXMgb25seSBuZWVkZWQgaW4gcmFyZSBzaXR1YXRpb25zIGxpa2UgXCJhW2JdXCIgd2hlcmVcbiAqIGEgc2V0dGFibGUgcGF0aCByZXF1aXJlcyBkeW5hbWljIGV2YWx1YXRpb24uXG4gKlxuICogVGhpcyBzZXR0ZXIgZnVuY3Rpb24gbWF5IHRocm93IGVycm9yIHdoZW4gY2FsbGVkIGlmIHRoZVxuICogZXhwcmVzc2lvbiBib2R5IGlzIG5vdCBhIHZhbGlkIGxlZnQtaGFuZCBleHByZXNzaW9uIGluXG4gKiBhc3NpZ25tZW50LlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBib2R5XG4gKiBAcmV0dXJuIHtGdW5jdGlvbnx1bmRlZmluZWR9XG4gKi9cblxuZnVuY3Rpb24gbWFrZVNldHRlciAoYm9keSkge1xuICB0cnkge1xuICAgIHJldHVybiBuZXcgRnVuY3Rpb24oJ3Njb3BlJywgJ3ZhbHVlJywgYm9keSArICc9dmFsdWU7JylcbiAgfSBjYXRjaCAoZSkge1xuICAgIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgJiYgXy53YXJuKFxuICAgICAgJ0ludmFsaWQgc2V0dGVyIGZ1bmN0aW9uIGJvZHk6ICcgKyBib2R5XG4gICAgKVxuICB9XG59XG5cbi8qKlxuICogQ2hlY2sgZm9yIHNldHRlciBleGlzdGVuY2Ugb24gYSBjYWNoZSBoaXQuXG4gKlxuICogQHBhcmFtIHtGdW5jdGlvbn0gaGl0XG4gKi9cblxuZnVuY3Rpb24gY2hlY2tTZXR0ZXIgKGhpdCkge1xuICBpZiAoIWhpdC5zZXQpIHtcbiAgICBoaXQuc2V0ID0gbWFrZVNldHRlcihoaXQuYm9keSlcbiAgfVxufVxuXG4vKipcbiAqIFBhcnNlIGFuIGV4cHJlc3Npb24gaW50byByZS13cml0dGVuIGdldHRlci9zZXR0ZXJzLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBleHBcbiAqIEBwYXJhbSB7Qm9vbGVhbn0gbmVlZFNldFxuICogQHJldHVybiB7RnVuY3Rpb259XG4gKi9cblxuZXhwb3J0cy5wYXJzZSA9IGZ1bmN0aW9uIChleHAsIG5lZWRTZXQpIHtcbiAgZXhwID0gZXhwLnRyaW0oKVxuICAvLyB0cnkgY2FjaGVcbiAgdmFyIGhpdCA9IGV4cHJlc3Npb25DYWNoZS5nZXQoZXhwKVxuICBpZiAoaGl0KSB7XG4gICAgaWYgKG5lZWRTZXQpIHtcbiAgICAgIGNoZWNrU2V0dGVyKGhpdClcbiAgICB9XG4gICAgcmV0dXJuIGhpdFxuICB9XG4gIC8vIHdlIGRvIGEgc2ltcGxlIHBhdGggY2hlY2sgdG8gb3B0aW1pemUgZm9yIHRoZW0uXG4gIC8vIHRoZSBjaGVjayBmYWlscyB2YWxpZCBwYXRocyB3aXRoIHVudXNhbCB3aGl0ZXNwYWNlcyxcbiAgLy8gYnV0IHRoYXQncyB0b28gcmFyZSBhbmQgd2UgZG9uJ3QgY2FyZS5cbiAgLy8gYWxzbyBza2lwIGJvb2xlYW4gbGl0ZXJhbHMgYW5kIHBhdGhzIHRoYXQgc3RhcnQgd2l0aFxuICAvLyBnbG9iYWwgXCJNYXRoXCJcbiAgdmFyIHJlcyA9IGV4cG9ydHMuaXNTaW1wbGVQYXRoKGV4cClcbiAgICA/IGNvbXBpbGVQYXRoRm5zKGV4cClcbiAgICA6IGNvbXBpbGVFeHBGbnMoZXhwLCBuZWVkU2V0KVxuICBleHByZXNzaW9uQ2FjaGUucHV0KGV4cCwgcmVzKVxuICByZXR1cm4gcmVzXG59XG5cbi8qKlxuICogQ2hlY2sgaWYgYW4gZXhwcmVzc2lvbiBpcyBhIHNpbXBsZSBwYXRoLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBleHBcbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKi9cblxuZXhwb3J0cy5pc1NpbXBsZVBhdGggPSBmdW5jdGlvbiAoZXhwKSB7XG4gIHJldHVybiBwYXRoVGVzdFJFLnRlc3QoZXhwKSAmJlxuICAgIC8vIGRvbid0IHRyZWF0IHRydWUvZmFsc2UgYXMgcGF0aHNcbiAgICAhYm9vbGVhbkxpdGVyYWxSRS50ZXN0KGV4cCkgJiZcbiAgICAvLyBNYXRoIGNvbnN0YW50cyBlLmcuIE1hdGguUEksIE1hdGguRSBldGMuXG4gICAgZXhwLnNsaWNlKDAsIDUpICE9PSAnTWF0aC4nXG59XG4iLCJ2YXIgXyA9IHJlcXVpcmUoJy4uL3V0aWwnKVxudmFyIENhY2hlID0gcmVxdWlyZSgnLi4vY2FjaGUnKVxudmFyIHBhdGhDYWNoZSA9IG5ldyBDYWNoZSgxMDAwKVxudmFyIGlkZW50UkUgPSBleHBvcnRzLmlkZW50UkUgPSAvXlskX2EtekEtWl0rW1xcdyRdKiQvXG5cbi8vIGFjdGlvbnNcbnZhciBBUFBFTkQgPSAwXG52YXIgUFVTSCA9IDFcblxuLy8gc3RhdGVzXG52YXIgQkVGT1JFX1BBVEggPSAwXG52YXIgSU5fUEFUSCA9IDFcbnZhciBCRUZPUkVfSURFTlQgPSAyXG52YXIgSU5fSURFTlQgPSAzXG52YXIgQkVGT1JFX0VMRU1FTlQgPSA0XG52YXIgQUZURVJfWkVSTyA9IDVcbnZhciBJTl9JTkRFWCA9IDZcbnZhciBJTl9TSU5HTEVfUVVPVEUgPSA3XG52YXIgSU5fRE9VQkxFX1FVT1RFID0gOFxudmFyIElOX1NVQl9QQVRIID0gOVxudmFyIEFGVEVSX0VMRU1FTlQgPSAxMFxudmFyIEFGVEVSX1BBVEggPSAxMVxudmFyIEVSUk9SID0gMTJcblxudmFyIHBhdGhTdGF0ZU1hY2hpbmUgPSBbXVxuXG5wYXRoU3RhdGVNYWNoaW5lW0JFRk9SRV9QQVRIXSA9IHtcbiAgJ3dzJzogW0JFRk9SRV9QQVRIXSxcbiAgJ2lkZW50JzogW0lOX0lERU5ULCBBUFBFTkRdLFxuICAnWyc6IFtCRUZPUkVfRUxFTUVOVF0sXG4gICdlb2YnOiBbQUZURVJfUEFUSF1cbn1cblxucGF0aFN0YXRlTWFjaGluZVtJTl9QQVRIXSA9IHtcbiAgJ3dzJzogW0lOX1BBVEhdLFxuICAnLic6IFtCRUZPUkVfSURFTlRdLFxuICAnWyc6IFtCRUZPUkVfRUxFTUVOVF0sXG4gICdlb2YnOiBbQUZURVJfUEFUSF1cbn1cblxucGF0aFN0YXRlTWFjaGluZVtCRUZPUkVfSURFTlRdID0ge1xuICAnd3MnOiBbQkVGT1JFX0lERU5UXSxcbiAgJ2lkZW50JzogW0lOX0lERU5ULCBBUFBFTkRdXG59XG5cbnBhdGhTdGF0ZU1hY2hpbmVbSU5fSURFTlRdID0ge1xuICAnaWRlbnQnOiBbSU5fSURFTlQsIEFQUEVORF0sXG4gICcwJzogW0lOX0lERU5ULCBBUFBFTkRdLFxuICAnbnVtYmVyJzogW0lOX0lERU5ULCBBUFBFTkRdLFxuICAnd3MnOiBbSU5fUEFUSCwgUFVTSF0sXG4gICcuJzogW0JFRk9SRV9JREVOVCwgUFVTSF0sXG4gICdbJzogW0JFRk9SRV9FTEVNRU5ULCBQVVNIXSxcbiAgJ2VvZic6IFtBRlRFUl9QQVRILCBQVVNIXVxufVxuXG5wYXRoU3RhdGVNYWNoaW5lW0JFRk9SRV9FTEVNRU5UXSA9IHtcbiAgJ3dzJzogW0JFRk9SRV9FTEVNRU5UXSxcbiAgJzAnOiBbQUZURVJfWkVSTywgQVBQRU5EXSxcbiAgJ251bWJlcic6IFtJTl9JTkRFWCwgQVBQRU5EXSxcbiAgXCInXCI6IFtJTl9TSU5HTEVfUVVPVEUsIEFQUEVORCwgJyddLFxuICAnXCInOiBbSU5fRE9VQkxFX1FVT1RFLCBBUFBFTkQsICcnXSxcbiAgJ2lkZW50JzogW0lOX1NVQl9QQVRILCBBUFBFTkQsICcqJ11cbn1cblxucGF0aFN0YXRlTWFjaGluZVtBRlRFUl9aRVJPXSA9IHtcbiAgJ3dzJzogW0FGVEVSX0VMRU1FTlQsIFBVU0hdLFxuICAnXSc6IFtJTl9QQVRILCBQVVNIXVxufVxuXG5wYXRoU3RhdGVNYWNoaW5lW0lOX0lOREVYXSA9IHtcbiAgJzAnOiBbSU5fSU5ERVgsIEFQUEVORF0sXG4gICdudW1iZXInOiBbSU5fSU5ERVgsIEFQUEVORF0sXG4gICd3cyc6IFtBRlRFUl9FTEVNRU5UXSxcbiAgJ10nOiBbSU5fUEFUSCwgUFVTSF1cbn1cblxucGF0aFN0YXRlTWFjaGluZVtJTl9TSU5HTEVfUVVPVEVdID0ge1xuICBcIidcIjogW0FGVEVSX0VMRU1FTlRdLFxuICAnZW9mJzogRVJST1IsXG4gICdlbHNlJzogW0lOX1NJTkdMRV9RVU9URSwgQVBQRU5EXVxufVxuXG5wYXRoU3RhdGVNYWNoaW5lW0lOX0RPVUJMRV9RVU9URV0gPSB7XG4gICdcIic6IFtBRlRFUl9FTEVNRU5UXSxcbiAgJ2VvZic6IEVSUk9SLFxuICAnZWxzZSc6IFtJTl9ET1VCTEVfUVVPVEUsIEFQUEVORF1cbn1cblxucGF0aFN0YXRlTWFjaGluZVtJTl9TVUJfUEFUSF0gPSB7XG4gICdpZGVudCc6IFtJTl9TVUJfUEFUSCwgQVBQRU5EXSxcbiAgJzAnOiBbSU5fU1VCX1BBVEgsIEFQUEVORF0sXG4gICdudW1iZXInOiBbSU5fU1VCX1BBVEgsIEFQUEVORF0sXG4gICd3cyc6IFtBRlRFUl9FTEVNRU5UXSxcbiAgJ10nOiBbSU5fUEFUSCwgUFVTSF1cbn1cblxucGF0aFN0YXRlTWFjaGluZVtBRlRFUl9FTEVNRU5UXSA9IHtcbiAgJ3dzJzogW0FGVEVSX0VMRU1FTlRdLFxuICAnXSc6IFtJTl9QQVRILCBQVVNIXVxufVxuXG4vKipcbiAqIERldGVybWluZSB0aGUgdHlwZSBvZiBhIGNoYXJhY3RlciBpbiBhIGtleXBhdGguXG4gKlxuICogQHBhcmFtIHtDaGFyfSBjaFxuICogQHJldHVybiB7U3RyaW5nfSB0eXBlXG4gKi9cblxuZnVuY3Rpb24gZ2V0UGF0aENoYXJUeXBlIChjaCkge1xuICBpZiAoY2ggPT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiAnZW9mJ1xuICB9XG5cbiAgdmFyIGNvZGUgPSBjaC5jaGFyQ29kZUF0KDApXG5cbiAgc3dpdGNoIChjb2RlKSB7XG4gICAgY2FzZSAweDVCOiAvLyBbXG4gICAgY2FzZSAweDVEOiAvLyBdXG4gICAgY2FzZSAweDJFOiAvLyAuXG4gICAgY2FzZSAweDIyOiAvLyBcIlxuICAgIGNhc2UgMHgyNzogLy8gJ1xuICAgIGNhc2UgMHgzMDogLy8gMFxuICAgICAgcmV0dXJuIGNoXG5cbiAgICBjYXNlIDB4NUY6IC8vIF9cbiAgICBjYXNlIDB4MjQ6IC8vICRcbiAgICAgIHJldHVybiAnaWRlbnQnXG5cbiAgICBjYXNlIDB4MjA6IC8vIFNwYWNlXG4gICAgY2FzZSAweDA5OiAvLyBUYWJcbiAgICBjYXNlIDB4MEE6IC8vIE5ld2xpbmVcbiAgICBjYXNlIDB4MEQ6IC8vIFJldHVyblxuICAgIGNhc2UgMHhBMDogIC8vIE5vLWJyZWFrIHNwYWNlXG4gICAgY2FzZSAweEZFRkY6ICAvLyBCeXRlIE9yZGVyIE1hcmtcbiAgICBjYXNlIDB4MjAyODogIC8vIExpbmUgU2VwYXJhdG9yXG4gICAgY2FzZSAweDIwMjk6ICAvLyBQYXJhZ3JhcGggU2VwYXJhdG9yXG4gICAgICByZXR1cm4gJ3dzJ1xuICB9XG5cbiAgLy8gYS16LCBBLVpcbiAgaWYgKFxuICAgIChjb2RlID49IDB4NjEgJiYgY29kZSA8PSAweDdBKSB8fFxuICAgIChjb2RlID49IDB4NDEgJiYgY29kZSA8PSAweDVBKVxuICApIHtcbiAgICByZXR1cm4gJ2lkZW50J1xuICB9XG5cbiAgLy8gMS05XG4gIGlmIChjb2RlID49IDB4MzEgJiYgY29kZSA8PSAweDM5KSB7XG4gICAgcmV0dXJuICdudW1iZXInXG4gIH1cblxuICByZXR1cm4gJ2Vsc2UnXG59XG5cbi8qKlxuICogUGFyc2UgYSBzdHJpbmcgcGF0aCBpbnRvIGFuIGFycmF5IG9mIHNlZ21lbnRzXG4gKiBUb2RvIGltcGxlbWVudCBjYWNoZVxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoXG4gKiBAcmV0dXJuIHtBcnJheXx1bmRlZmluZWR9XG4gKi9cblxuZnVuY3Rpb24gcGFyc2VQYXRoIChwYXRoKSB7XG4gIHZhciBrZXlzID0gW11cbiAgdmFyIGluZGV4ID0gLTFcbiAgdmFyIG1vZGUgPSBCRUZPUkVfUEFUSFxuICB2YXIgYywgbmV3Q2hhciwga2V5LCB0eXBlLCB0cmFuc2l0aW9uLCBhY3Rpb24sIHR5cGVNYXBcblxuICB2YXIgYWN0aW9ucyA9IFtdXG4gIGFjdGlvbnNbUFVTSF0gPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKGtleSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm5cbiAgICB9XG4gICAga2V5cy5wdXNoKGtleSlcbiAgICBrZXkgPSB1bmRlZmluZWRcbiAgfVxuICBhY3Rpb25zW0FQUEVORF0gPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKGtleSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBrZXkgPSBuZXdDaGFyXG4gICAgfSBlbHNlIHtcbiAgICAgIGtleSArPSBuZXdDaGFyXG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gbWF5YmVVbmVzY2FwZVF1b3RlICgpIHtcbiAgICB2YXIgbmV4dENoYXIgPSBwYXRoW2luZGV4ICsgMV1cbiAgICBpZiAoKG1vZGUgPT09IElOX1NJTkdMRV9RVU9URSAmJiBuZXh0Q2hhciA9PT0gXCInXCIpIHx8XG4gICAgICAgIChtb2RlID09PSBJTl9ET1VCTEVfUVVPVEUgJiYgbmV4dENoYXIgPT09ICdcIicpKSB7XG4gICAgICBpbmRleCsrXG4gICAgICBuZXdDaGFyID0gbmV4dENoYXJcbiAgICAgIGFjdGlvbnNbQVBQRU5EXSgpXG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIH1cbiAgfVxuXG4gIHdoaWxlIChtb2RlICE9IG51bGwpIHtcbiAgICBpbmRleCsrXG4gICAgYyA9IHBhdGhbaW5kZXhdXG5cbiAgICBpZiAoYyA9PT0gJ1xcXFwnICYmIG1heWJlVW5lc2NhcGVRdW90ZSgpKSB7XG4gICAgICBjb250aW51ZVxuICAgIH1cblxuICAgIHR5cGUgPSBnZXRQYXRoQ2hhclR5cGUoYylcbiAgICB0eXBlTWFwID0gcGF0aFN0YXRlTWFjaGluZVttb2RlXVxuICAgIHRyYW5zaXRpb24gPSB0eXBlTWFwW3R5cGVdIHx8IHR5cGVNYXBbJ2Vsc2UnXSB8fCBFUlJPUlxuXG4gICAgaWYgKHRyYW5zaXRpb24gPT09IEVSUk9SKSB7XG4gICAgICByZXR1cm4gLy8gcGFyc2UgZXJyb3JcbiAgICB9XG5cbiAgICBtb2RlID0gdHJhbnNpdGlvblswXVxuICAgIGFjdGlvbiA9IGFjdGlvbnNbdHJhbnNpdGlvblsxXV1cbiAgICBpZiAoYWN0aW9uKSB7XG4gICAgICBuZXdDaGFyID0gdHJhbnNpdGlvblsyXVxuICAgICAgbmV3Q2hhciA9IG5ld0NoYXIgPT09IHVuZGVmaW5lZFxuICAgICAgICA/IGNcbiAgICAgICAgOiBuZXdDaGFyID09PSAnKidcbiAgICAgICAgICA/IG5ld0NoYXIgKyBjXG4gICAgICAgICAgOiBuZXdDaGFyXG4gICAgICBhY3Rpb24oKVxuICAgIH1cblxuICAgIGlmIChtb2RlID09PSBBRlRFUl9QQVRIKSB7XG4gICAgICBrZXlzLnJhdyA9IHBhdGhcbiAgICAgIHJldHVybiBrZXlzXG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogRm9ybWF0IGEgYWNjZXNzb3Igc2VnbWVudCBiYXNlZCBvbiBpdHMgdHlwZS5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30ga2V5XG4gKiBAcmV0dXJuIHtCb29sZWFufVxuICovXG5cbmZ1bmN0aW9uIGZvcm1hdEFjY2Vzc29yIChrZXkpIHtcbiAgaWYgKGlkZW50UkUudGVzdChrZXkpKSB7IC8vIGlkZW50aWZpZXJcbiAgICByZXR1cm4gJy4nICsga2V5XG4gIH0gZWxzZSBpZiAoK2tleSA9PT0ga2V5ID4+PiAwKSB7IC8vIGJyYWNrZXQgaW5kZXhcbiAgICByZXR1cm4gJ1snICsga2V5ICsgJ10nXG4gIH0gZWxzZSBpZiAoa2V5LmNoYXJBdCgwKSA9PT0gJyonKSB7XG4gICAgcmV0dXJuICdbbycgKyBmb3JtYXRBY2Nlc3NvcihrZXkuc2xpY2UoMSkpICsgJ10nXG4gIH0gZWxzZSB7IC8vIGJyYWNrZXQgc3RyaW5nXG4gICAgcmV0dXJuICdbXCInICsga2V5LnJlcGxhY2UoL1wiL2csICdcXFxcXCInKSArICdcIl0nXG4gIH1cbn1cblxuLyoqXG4gKiBDb21waWxlcyBhIGdldHRlciBmdW5jdGlvbiB3aXRoIGEgZml4ZWQgcGF0aC5cbiAqIFRoZSBmaXhlZCBwYXRoIGdldHRlciBzdXByZXNzZXMgZXJyb3JzLlxuICpcbiAqIEBwYXJhbSB7QXJyYXl9IHBhdGhcbiAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuICovXG5cbmV4cG9ydHMuY29tcGlsZUdldHRlciA9IGZ1bmN0aW9uIChwYXRoKSB7XG4gIHZhciBib2R5ID0gJ3JldHVybiBvJyArIHBhdGgubWFwKGZvcm1hdEFjY2Vzc29yKS5qb2luKCcnKVxuICByZXR1cm4gbmV3IEZ1bmN0aW9uKCdvJywgYm9keSlcbn1cblxuLyoqXG4gKiBFeHRlcm5hbCBwYXJzZSB0aGF0IGNoZWNrIGZvciBhIGNhY2hlIGhpdCBmaXJzdFxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoXG4gKiBAcmV0dXJuIHtBcnJheXx1bmRlZmluZWR9XG4gKi9cblxuZXhwb3J0cy5wYXJzZSA9IGZ1bmN0aW9uIChwYXRoKSB7XG4gIHZhciBoaXQgPSBwYXRoQ2FjaGUuZ2V0KHBhdGgpXG4gIGlmICghaGl0KSB7XG4gICAgaGl0ID0gcGFyc2VQYXRoKHBhdGgpXG4gICAgaWYgKGhpdCkge1xuICAgICAgaGl0LmdldCA9IGV4cG9ydHMuY29tcGlsZUdldHRlcihoaXQpXG4gICAgICBwYXRoQ2FjaGUucHV0KHBhdGgsIGhpdClcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGhpdFxufVxuXG4vKipcbiAqIEdldCBmcm9tIGFuIG9iamVjdCBmcm9tIGEgcGF0aCBzdHJpbmdcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqXG4gKiBAcGFyYW0ge1N0cmluZ30gcGF0aFxuICovXG5cbmV4cG9ydHMuZ2V0ID0gZnVuY3Rpb24gKG9iaiwgcGF0aCkge1xuICBwYXRoID0gZXhwb3J0cy5wYXJzZShwYXRoKVxuICBpZiAocGF0aCkge1xuICAgIHJldHVybiBwYXRoLmdldChvYmopXG4gIH1cbn1cblxuLyoqXG4gKiBTZXQgb24gYW4gb2JqZWN0IGZyb20gYSBwYXRoXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IG9ialxuICogQHBhcmFtIHtTdHJpbmcgfCBBcnJheX0gcGF0aFxuICogQHBhcmFtIHsqfSB2YWxcbiAqL1xuXG5leHBvcnRzLnNldCA9IGZ1bmN0aW9uIChvYmosIHBhdGgsIHZhbCkge1xuICB2YXIgb3JpZ2luYWwgPSBvYmpcbiAgaWYgKHR5cGVvZiBwYXRoID09PSAnc3RyaW5nJykge1xuICAgIHBhdGggPSBleHBvcnRzLnBhcnNlKHBhdGgpXG4gIH1cbiAgaWYgKCFwYXRoIHx8ICFfLmlzT2JqZWN0KG9iaikpIHtcbiAgICByZXR1cm4gZmFsc2VcbiAgfVxuICB2YXIgbGFzdCwga2V5XG4gIGZvciAodmFyIGkgPSAwLCBsID0gcGF0aC5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICBsYXN0ID0gb2JqXG4gICAga2V5ID0gcGF0aFtpXVxuICAgIGlmIChrZXkuY2hhckF0KDApID09PSAnKicpIHtcbiAgICAgIGtleSA9IG9yaWdpbmFsW2tleS5zbGljZSgxKV1cbiAgICB9XG4gICAgaWYgKGkgPCBsIC0gMSkge1xuICAgICAgb2JqID0gb2JqW2tleV1cbiAgICAgIGlmICghXy5pc09iamVjdChvYmopKSB7XG4gICAgICAgIHdhcm5Ob25FeGlzdGVudChwYXRoKVxuICAgICAgICBvYmogPSB7fVxuICAgICAgICBsYXN0LiRhZGQoa2V5LCBvYmopXG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChfLmlzQXJyYXkob2JqKSkge1xuICAgICAgICBvYmouJHNldChrZXksIHZhbClcbiAgICAgIH0gZWxzZSBpZiAoa2V5IGluIG9iaikge1xuICAgICAgICBvYmpba2V5XSA9IHZhbFxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgd2Fybk5vbkV4aXN0ZW50KHBhdGgpXG4gICAgICAgIG9iai4kYWRkKGtleSwgdmFsKVxuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4gdHJ1ZVxufVxuXG5mdW5jdGlvbiB3YXJuTm9uRXhpc3RlbnQgKHBhdGgpIHtcbiAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiBfLndhcm4oXG4gICAgJ1lvdSBhcmUgc2V0dGluZyBhIG5vbi1leGlzdGVudCBwYXRoIFwiJyArIHBhdGgucmF3ICsgJ1wiICcgK1xuICAgICdvbiBhIHZtIGluc3RhbmNlLiBDb25zaWRlciBwcmUtaW5pdGlhbGl6aW5nIHRoZSBwcm9wZXJ0eSAnICtcbiAgICAnd2l0aCB0aGUgXCJkYXRhXCIgb3B0aW9uIGZvciBtb3JlIHJlbGlhYmxlIHJlYWN0aXZpdHkgJyArXG4gICAgJ2FuZCBiZXR0ZXIgcGVyZm9ybWFuY2UuJ1xuICApXG59XG4iLCJ2YXIgXyA9IHJlcXVpcmUoJy4uL3V0aWwnKVxudmFyIENhY2hlID0gcmVxdWlyZSgnLi4vY2FjaGUnKVxudmFyIHRlbXBsYXRlQ2FjaGUgPSBuZXcgQ2FjaGUoMTAwMClcbnZhciBpZFNlbGVjdG9yQ2FjaGUgPSBuZXcgQ2FjaGUoMTAwMClcblxudmFyIG1hcCA9IHtcbiAgX2RlZmF1bHQ6IFswLCAnJywgJyddLFxuICBsZWdlbmQ6IFsxLCAnPGZpZWxkc2V0PicsICc8L2ZpZWxkc2V0PiddLFxuICB0cjogWzIsICc8dGFibGU+PHRib2R5PicsICc8L3Rib2R5PjwvdGFibGU+J10sXG4gIGNvbDogW1xuICAgIDIsXG4gICAgJzx0YWJsZT48dGJvZHk+PC90Ym9keT48Y29sZ3JvdXA+JyxcbiAgICAnPC9jb2xncm91cD48L3RhYmxlPidcbiAgXVxufVxuXG5tYXAudGQgPVxubWFwLnRoID0gW1xuICAzLFxuICAnPHRhYmxlPjx0Ym9keT48dHI+JyxcbiAgJzwvdHI+PC90Ym9keT48L3RhYmxlPidcbl1cblxubWFwLm9wdGlvbiA9XG5tYXAub3B0Z3JvdXAgPSBbXG4gIDEsXG4gICc8c2VsZWN0IG11bHRpcGxlPVwibXVsdGlwbGVcIj4nLFxuICAnPC9zZWxlY3Q+J1xuXVxuXG5tYXAudGhlYWQgPVxubWFwLnRib2R5ID1cbm1hcC5jb2xncm91cCA9XG5tYXAuY2FwdGlvbiA9XG5tYXAudGZvb3QgPSBbMSwgJzx0YWJsZT4nLCAnPC90YWJsZT4nXVxuXG5tYXAuZyA9XG5tYXAuZGVmcyA9XG5tYXAuc3ltYm9sID1cbm1hcC51c2UgPVxubWFwLmltYWdlID1cbm1hcC50ZXh0ID1cbm1hcC5jaXJjbGUgPVxubWFwLmVsbGlwc2UgPVxubWFwLmxpbmUgPVxubWFwLnBhdGggPVxubWFwLnBvbHlnb24gPVxubWFwLnBvbHlsaW5lID1cbm1hcC5yZWN0ID0gW1xuICAxLFxuICAnPHN2ZyAnICtcbiAgICAneG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiICcgK1xuICAgICd4bWxuczp4bGluaz1cImh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmtcIiAnICtcbiAgICAneG1sbnM6ZXY9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAxL3htbC1ldmVudHNcIicgK1xuICAgICd2ZXJzaW9uPVwiMS4xXCI+JyxcbiAgJzwvc3ZnPidcbl1cblxuLyoqXG4gKiBDaGVjayBpZiBhIG5vZGUgaXMgYSBzdXBwb3J0ZWQgdGVtcGxhdGUgbm9kZSB3aXRoIGFcbiAqIERvY3VtZW50RnJhZ21lbnQgY29udGVudC5cbiAqXG4gKiBAcGFyYW0ge05vZGV9IG5vZGVcbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKi9cblxuZnVuY3Rpb24gaXNSZWFsVGVtcGxhdGUgKG5vZGUpIHtcbiAgcmV0dXJuIF8uaXNUZW1wbGF0ZShub2RlKSAmJlxuICAgIG5vZGUuY29udGVudCBpbnN0YW5jZW9mIERvY3VtZW50RnJhZ21lbnRcbn1cblxudmFyIHRhZ1JFID0gLzwoW1xcdzpdKykvXG52YXIgZW50aXR5UkUgPSAvJlxcdys7L1xuXG4vKipcbiAqIENvbnZlcnQgYSBzdHJpbmcgdGVtcGxhdGUgdG8gYSBEb2N1bWVudEZyYWdtZW50LlxuICogRGV0ZXJtaW5lcyBjb3JyZWN0IHdyYXBwaW5nIGJ5IHRhZyB0eXBlcy4gV3JhcHBpbmdcbiAqIHN0cmF0ZWd5IGZvdW5kIGluIGpRdWVyeSAmIGNvbXBvbmVudC9kb21pZnkuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHRlbXBsYXRlU3RyaW5nXG4gKiBAcmV0dXJuIHtEb2N1bWVudEZyYWdtZW50fVxuICovXG5cbmZ1bmN0aW9uIHN0cmluZ1RvRnJhZ21lbnQgKHRlbXBsYXRlU3RyaW5nKSB7XG4gIC8vIHRyeSBhIGNhY2hlIGhpdCBmaXJzdFxuICB2YXIgaGl0ID0gdGVtcGxhdGVDYWNoZS5nZXQodGVtcGxhdGVTdHJpbmcpXG4gIGlmIChoaXQpIHtcbiAgICByZXR1cm4gaGl0XG4gIH1cblxuICB2YXIgZnJhZyA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKVxuICB2YXIgdGFnTWF0Y2ggPSB0ZW1wbGF0ZVN0cmluZy5tYXRjaCh0YWdSRSlcbiAgdmFyIGVudGl0eU1hdGNoID0gZW50aXR5UkUudGVzdCh0ZW1wbGF0ZVN0cmluZylcblxuICBpZiAoIXRhZ01hdGNoICYmICFlbnRpdHlNYXRjaCkge1xuICAgIC8vIHRleHQgb25seSwgcmV0dXJuIGEgc2luZ2xlIHRleHQgbm9kZS5cbiAgICBmcmFnLmFwcGVuZENoaWxkKFxuICAgICAgZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUodGVtcGxhdGVTdHJpbmcpXG4gICAgKVxuICB9IGVsc2Uge1xuXG4gICAgdmFyIHRhZyA9IHRhZ01hdGNoICYmIHRhZ01hdGNoWzFdXG4gICAgdmFyIHdyYXAgPSBtYXBbdGFnXSB8fCBtYXAuX2RlZmF1bHRcbiAgICB2YXIgZGVwdGggPSB3cmFwWzBdXG4gICAgdmFyIHByZWZpeCA9IHdyYXBbMV1cbiAgICB2YXIgc3VmZml4ID0gd3JhcFsyXVxuICAgIHZhciBub2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JylcblxuICAgIG5vZGUuaW5uZXJIVE1MID0gcHJlZml4ICsgdGVtcGxhdGVTdHJpbmcudHJpbSgpICsgc3VmZml4XG4gICAgd2hpbGUgKGRlcHRoLS0pIHtcbiAgICAgIG5vZGUgPSBub2RlLmxhc3RDaGlsZFxuICAgIH1cblxuICAgIHZhciBjaGlsZFxuICAgIC8qIGVzbGludC1kaXNhYmxlIG5vLWNvbmQtYXNzaWduICovXG4gICAgd2hpbGUgKGNoaWxkID0gbm9kZS5maXJzdENoaWxkKSB7XG4gICAgLyogZXNsaW50LWVuYWJsZSBuby1jb25kLWFzc2lnbiAqL1xuICAgICAgZnJhZy5hcHBlbmRDaGlsZChjaGlsZClcbiAgICB9XG4gIH1cblxuICB0ZW1wbGF0ZUNhY2hlLnB1dCh0ZW1wbGF0ZVN0cmluZywgZnJhZylcbiAgcmV0dXJuIGZyYWdcbn1cblxuLyoqXG4gKiBDb252ZXJ0IGEgdGVtcGxhdGUgbm9kZSB0byBhIERvY3VtZW50RnJhZ21lbnQuXG4gKlxuICogQHBhcmFtIHtOb2RlfSBub2RlXG4gKiBAcmV0dXJuIHtEb2N1bWVudEZyYWdtZW50fVxuICovXG5cbmZ1bmN0aW9uIG5vZGVUb0ZyYWdtZW50IChub2RlKSB7XG4gIC8vIGlmIGl0cyBhIHRlbXBsYXRlIHRhZyBhbmQgdGhlIGJyb3dzZXIgc3VwcG9ydHMgaXQsXG4gIC8vIGl0cyBjb250ZW50IGlzIGFscmVhZHkgYSBkb2N1bWVudCBmcmFnbWVudC5cbiAgaWYgKGlzUmVhbFRlbXBsYXRlKG5vZGUpKSB7XG4gICAgXy50cmltTm9kZShub2RlLmNvbnRlbnQpXG4gICAgcmV0dXJuIG5vZGUuY29udGVudFxuICB9XG4gIC8vIHNjcmlwdCB0ZW1wbGF0ZVxuICBpZiAobm9kZS50YWdOYW1lID09PSAnU0NSSVBUJykge1xuICAgIHJldHVybiBzdHJpbmdUb0ZyYWdtZW50KG5vZGUudGV4dENvbnRlbnQpXG4gIH1cbiAgLy8gbm9ybWFsIG5vZGUsIGNsb25lIGl0IHRvIGF2b2lkIG11dGF0aW5nIHRoZSBvcmlnaW5hbFxuICB2YXIgY2xvbmUgPSBleHBvcnRzLmNsb25lKG5vZGUpXG4gIHZhciBmcmFnID0gZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpXG4gIHZhciBjaGlsZFxuICAvKiBlc2xpbnQtZGlzYWJsZSBuby1jb25kLWFzc2lnbiAqL1xuICB3aGlsZSAoY2hpbGQgPSBjbG9uZS5maXJzdENoaWxkKSB7XG4gIC8qIGVzbGludC1lbmFibGUgbm8tY29uZC1hc3NpZ24gKi9cbiAgICBmcmFnLmFwcGVuZENoaWxkKGNoaWxkKVxuICB9XG4gIF8udHJpbU5vZGUoZnJhZylcbiAgcmV0dXJuIGZyYWdcbn1cblxuLy8gVGVzdCBmb3IgdGhlIHByZXNlbmNlIG9mIHRoZSBTYWZhcmkgdGVtcGxhdGUgY2xvbmluZyBidWdcbi8vIGh0dHBzOi8vYnVncy53ZWJraXQub3JnL3Nob3dfYnVnLmNnaT9pZD0xMzc3NTVcbnZhciBoYXNCcm9rZW5UZW1wbGF0ZSA9IF8uaW5Ccm93c2VyXG4gID8gKGZ1bmN0aW9uICgpIHtcbiAgICAgIHZhciBhID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JylcbiAgICAgIGEuaW5uZXJIVE1MID0gJzx0ZW1wbGF0ZT4xPC90ZW1wbGF0ZT4nXG4gICAgICByZXR1cm4gIWEuY2xvbmVOb2RlKHRydWUpLmZpcnN0Q2hpbGQuaW5uZXJIVE1MXG4gICAgfSkoKVxuICA6IGZhbHNlXG5cbi8vIFRlc3QgZm9yIElFMTAvMTEgdGV4dGFyZWEgcGxhY2Vob2xkZXIgY2xvbmUgYnVnXG52YXIgaGFzVGV4dGFyZWFDbG9uZUJ1ZyA9IF8uaW5Ccm93c2VyXG4gID8gKGZ1bmN0aW9uICgpIHtcbiAgICAgIHZhciB0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgndGV4dGFyZWEnKVxuICAgICAgdC5wbGFjZWhvbGRlciA9ICd0J1xuICAgICAgcmV0dXJuIHQuY2xvbmVOb2RlKHRydWUpLnZhbHVlID09PSAndCdcbiAgICB9KSgpXG4gIDogZmFsc2VcblxuLyoqXG4gKiAxLiBEZWFsIHdpdGggU2FmYXJpIGNsb25pbmcgbmVzdGVkIDx0ZW1wbGF0ZT4gYnVnIGJ5XG4gKiAgICBtYW51YWxseSBjbG9uaW5nIGFsbCB0ZW1wbGF0ZSBpbnN0YW5jZXMuXG4gKiAyLiBEZWFsIHdpdGggSUUxMC8xMSB0ZXh0YXJlYSBwbGFjZWhvbGRlciBidWcgYnkgc2V0dGluZ1xuICogICAgdGhlIGNvcnJlY3QgdmFsdWUgYWZ0ZXIgY2xvbmluZy5cbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR8RG9jdW1lbnRGcmFnbWVudH0gbm9kZVxuICogQHJldHVybiB7RWxlbWVudHxEb2N1bWVudEZyYWdtZW50fVxuICovXG5cbmV4cG9ydHMuY2xvbmUgPSBmdW5jdGlvbiAobm9kZSkge1xuICBpZiAoIW5vZGUucXVlcnlTZWxlY3RvckFsbCkge1xuICAgIHJldHVybiBub2RlLmNsb25lTm9kZSgpXG4gIH1cbiAgdmFyIHJlcyA9IG5vZGUuY2xvbmVOb2RlKHRydWUpXG4gIHZhciBpLCBvcmlnaW5hbCwgY2xvbmVkXG4gIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICBpZiAoaGFzQnJva2VuVGVtcGxhdGUpIHtcbiAgICB2YXIgY2xvbmUgPSByZXNcbiAgICBpZiAoaXNSZWFsVGVtcGxhdGUobm9kZSkpIHtcbiAgICAgIG5vZGUgPSBub2RlLmNvbnRlbnRcbiAgICAgIGNsb25lID0gcmVzLmNvbnRlbnRcbiAgICB9XG4gICAgb3JpZ2luYWwgPSBub2RlLnF1ZXJ5U2VsZWN0b3JBbGwoJ3RlbXBsYXRlJylcbiAgICBpZiAob3JpZ2luYWwubGVuZ3RoKSB7XG4gICAgICBjbG9uZWQgPSBjbG9uZS5xdWVyeVNlbGVjdG9yQWxsKCd0ZW1wbGF0ZScpXG4gICAgICBpID0gY2xvbmVkLmxlbmd0aFxuICAgICAgd2hpbGUgKGktLSkge1xuICAgICAgICBjbG9uZWRbaV0ucGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQoXG4gICAgICAgICAgZXhwb3J0cy5jbG9uZShvcmlnaW5hbFtpXSksXG4gICAgICAgICAgY2xvbmVkW2ldXG4gICAgICAgIClcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gIGlmIChoYXNUZXh0YXJlYUNsb25lQnVnKSB7XG4gICAgaWYgKG5vZGUudGFnTmFtZSA9PT0gJ1RFWFRBUkVBJykge1xuICAgICAgcmVzLnZhbHVlID0gbm9kZS52YWx1ZVxuICAgIH0gZWxzZSB7XG4gICAgICBvcmlnaW5hbCA9IG5vZGUucXVlcnlTZWxlY3RvckFsbCgndGV4dGFyZWEnKVxuICAgICAgaWYgKG9yaWdpbmFsLmxlbmd0aCkge1xuICAgICAgICBjbG9uZWQgPSByZXMucXVlcnlTZWxlY3RvckFsbCgndGV4dGFyZWEnKVxuICAgICAgICBpID0gY2xvbmVkLmxlbmd0aFxuICAgICAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgICAgY2xvbmVkW2ldLnZhbHVlID0gb3JpZ2luYWxbaV0udmFsdWVcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4gcmVzXG59XG5cbi8qKlxuICogUHJvY2VzcyB0aGUgdGVtcGxhdGUgb3B0aW9uIGFuZCBub3JtYWxpemVzIGl0IGludG8gYVxuICogYSBEb2N1bWVudEZyYWdtZW50IHRoYXQgY2FuIGJlIHVzZWQgYXMgYSBwYXJ0aWFsIG9yIGFcbiAqIGluc3RhbmNlIHRlbXBsYXRlLlxuICpcbiAqIEBwYXJhbSB7Kn0gdGVtcGxhdGVcbiAqICAgIFBvc3NpYmxlIHZhbHVlcyBpbmNsdWRlOlxuICogICAgLSBEb2N1bWVudEZyYWdtZW50IG9iamVjdFxuICogICAgLSBOb2RlIG9iamVjdCBvZiB0eXBlIFRlbXBsYXRlXG4gKiAgICAtIGlkIHNlbGVjdG9yOiAnI3NvbWUtdGVtcGxhdGUtaWQnXG4gKiAgICAtIHRlbXBsYXRlIHN0cmluZzogJzxkaXY+PHNwYW4+e3ttc2d9fTwvc3Bhbj48L2Rpdj4nXG4gKiBAcGFyYW0ge0Jvb2xlYW59IGNsb25lXG4gKiBAcGFyYW0ge0Jvb2xlYW59IG5vU2VsZWN0b3JcbiAqIEByZXR1cm4ge0RvY3VtZW50RnJhZ21lbnR8dW5kZWZpbmVkfVxuICovXG5cbmV4cG9ydHMucGFyc2UgPSBmdW5jdGlvbiAodGVtcGxhdGUsIGNsb25lLCBub1NlbGVjdG9yKSB7XG4gIHZhciBub2RlLCBmcmFnXG5cbiAgLy8gaWYgdGhlIHRlbXBsYXRlIGlzIGFscmVhZHkgYSBkb2N1bWVudCBmcmFnbWVudCxcbiAgLy8gZG8gbm90aGluZ1xuICBpZiAodGVtcGxhdGUgaW5zdGFuY2VvZiBEb2N1bWVudEZyYWdtZW50KSB7XG4gICAgXy50cmltTm9kZSh0ZW1wbGF0ZSlcbiAgICByZXR1cm4gY2xvbmVcbiAgICAgID8gZXhwb3J0cy5jbG9uZSh0ZW1wbGF0ZSlcbiAgICAgIDogdGVtcGxhdGVcbiAgfVxuXG4gIGlmICh0eXBlb2YgdGVtcGxhdGUgPT09ICdzdHJpbmcnKSB7XG4gICAgLy8gaWQgc2VsZWN0b3JcbiAgICBpZiAoIW5vU2VsZWN0b3IgJiYgdGVtcGxhdGUuY2hhckF0KDApID09PSAnIycpIHtcbiAgICAgIC8vIGlkIHNlbGVjdG9yIGNhbiBiZSBjYWNoZWQgdG9vXG4gICAgICBmcmFnID0gaWRTZWxlY3RvckNhY2hlLmdldCh0ZW1wbGF0ZSlcbiAgICAgIGlmICghZnJhZykge1xuICAgICAgICBub2RlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQodGVtcGxhdGUuc2xpY2UoMSkpXG4gICAgICAgIGlmIChub2RlKSB7XG4gICAgICAgICAgZnJhZyA9IG5vZGVUb0ZyYWdtZW50KG5vZGUpXG4gICAgICAgICAgLy8gc2F2ZSBzZWxlY3RvciB0byBjYWNoZVxuICAgICAgICAgIGlkU2VsZWN0b3JDYWNoZS5wdXQodGVtcGxhdGUsIGZyYWcpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gbm9ybWFsIHN0cmluZyB0ZW1wbGF0ZVxuICAgICAgZnJhZyA9IHN0cmluZ1RvRnJhZ21lbnQodGVtcGxhdGUpXG4gICAgfVxuICB9IGVsc2UgaWYgKHRlbXBsYXRlLm5vZGVUeXBlKSB7XG4gICAgLy8gYSBkaXJlY3Qgbm9kZVxuICAgIGZyYWcgPSBub2RlVG9GcmFnbWVudCh0ZW1wbGF0ZSlcbiAgfVxuXG4gIHJldHVybiBmcmFnICYmIGNsb25lXG4gICAgPyBleHBvcnRzLmNsb25lKGZyYWcpXG4gICAgOiBmcmFnXG59XG4iLCJ2YXIgQ2FjaGUgPSByZXF1aXJlKCcuLi9jYWNoZScpXG52YXIgY29uZmlnID0gcmVxdWlyZSgnLi4vY29uZmlnJylcbnZhciBkaXJQYXJzZXIgPSByZXF1aXJlKCcuL2RpcmVjdGl2ZScpXG52YXIgcmVnZXhFc2NhcGVSRSA9IC9bLS4qKz9eJHt9KCl8W1xcXVxcL1xcXFxdL2dcbnZhciBjYWNoZSwgdGFnUkUsIGh0bWxSRSwgZmlyc3RDaGFyLCBsYXN0Q2hhclxuXG4vKipcbiAqIEVzY2FwZSBhIHN0cmluZyBzbyBpdCBjYW4gYmUgdXNlZCBpbiBhIFJlZ0V4cFxuICogY29uc3RydWN0b3IuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0clxuICovXG5cbmZ1bmN0aW9uIGVzY2FwZVJlZ2V4IChzdHIpIHtcbiAgcmV0dXJuIHN0ci5yZXBsYWNlKHJlZ2V4RXNjYXBlUkUsICdcXFxcJCYnKVxufVxuXG4vKipcbiAqIENvbXBpbGUgdGhlIGludGVycG9sYXRpb24gdGFnIHJlZ2V4LlxuICpcbiAqIEByZXR1cm4ge1JlZ0V4cH1cbiAqL1xuXG5mdW5jdGlvbiBjb21waWxlUmVnZXggKCkge1xuICBjb25maWcuX2RlbGltaXRlcnNDaGFuZ2VkID0gZmFsc2VcbiAgdmFyIG9wZW4gPSBjb25maWcuZGVsaW1pdGVyc1swXVxuICB2YXIgY2xvc2UgPSBjb25maWcuZGVsaW1pdGVyc1sxXVxuICBmaXJzdENoYXIgPSBvcGVuLmNoYXJBdCgwKVxuICBsYXN0Q2hhciA9IGNsb3NlLmNoYXJBdChjbG9zZS5sZW5ndGggLSAxKVxuICB2YXIgZmlyc3RDaGFyUkUgPSBlc2NhcGVSZWdleChmaXJzdENoYXIpXG4gIHZhciBsYXN0Q2hhclJFID0gZXNjYXBlUmVnZXgobGFzdENoYXIpXG4gIHZhciBvcGVuUkUgPSBlc2NhcGVSZWdleChvcGVuKVxuICB2YXIgY2xvc2VSRSA9IGVzY2FwZVJlZ2V4KGNsb3NlKVxuICB0YWdSRSA9IG5ldyBSZWdFeHAoXG4gICAgZmlyc3RDaGFyUkUgKyAnPycgKyBvcGVuUkUgK1xuICAgICcoLis/KScgK1xuICAgIGNsb3NlUkUgKyBsYXN0Q2hhclJFICsgJz8nLFxuICAgICdnJ1xuICApXG4gIGh0bWxSRSA9IG5ldyBSZWdFeHAoXG4gICAgJ14nICsgZmlyc3RDaGFyUkUgKyBvcGVuUkUgK1xuICAgICcuKicgK1xuICAgIGNsb3NlUkUgKyBsYXN0Q2hhclJFICsgJyQnXG4gIClcbiAgLy8gcmVzZXQgY2FjaGVcbiAgY2FjaGUgPSBuZXcgQ2FjaGUoMTAwMClcbn1cblxuLyoqXG4gKiBQYXJzZSBhIHRlbXBsYXRlIHRleHQgc3RyaW5nIGludG8gYW4gYXJyYXkgb2YgdG9rZW5zLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSB0ZXh0XG4gKiBAcmV0dXJuIHtBcnJheTxPYmplY3Q+IHwgbnVsbH1cbiAqICAgICAgICAgICAgICAgLSB7U3RyaW5nfSB0eXBlXG4gKiAgICAgICAgICAgICAgIC0ge1N0cmluZ30gdmFsdWVcbiAqICAgICAgICAgICAgICAgLSB7Qm9vbGVhbn0gW2h0bWxdXG4gKiAgICAgICAgICAgICAgIC0ge0Jvb2xlYW59IFtvbmVUaW1lXVxuICovXG5cbmV4cG9ydHMucGFyc2UgPSBmdW5jdGlvbiAodGV4dCkge1xuICBpZiAoY29uZmlnLl9kZWxpbWl0ZXJzQ2hhbmdlZCkge1xuICAgIGNvbXBpbGVSZWdleCgpXG4gIH1cbiAgdmFyIGhpdCA9IGNhY2hlLmdldCh0ZXh0KVxuICBpZiAoaGl0KSB7XG4gICAgcmV0dXJuIGhpdFxuICB9XG4gIHRleHQgPSB0ZXh0LnJlcGxhY2UoL1xcbi9nLCAnJylcbiAgaWYgKCF0YWdSRS50ZXN0KHRleHQpKSB7XG4gICAgcmV0dXJuIG51bGxcbiAgfVxuICB2YXIgdG9rZW5zID0gW11cbiAgdmFyIGxhc3RJbmRleCA9IHRhZ1JFLmxhc3RJbmRleCA9IDBcbiAgdmFyIG1hdGNoLCBpbmRleCwgdmFsdWUsIGZpcnN0LCBvbmVUaW1lLCB0d29XYXlcbiAgLyogZXNsaW50LWRpc2FibGUgbm8tY29uZC1hc3NpZ24gKi9cbiAgd2hpbGUgKG1hdGNoID0gdGFnUkUuZXhlYyh0ZXh0KSkge1xuICAvKiBlc2xpbnQtZW5hYmxlIG5vLWNvbmQtYXNzaWduICovXG4gICAgaW5kZXggPSBtYXRjaC5pbmRleFxuICAgIC8vIHB1c2ggdGV4dCB0b2tlblxuICAgIGlmIChpbmRleCA+IGxhc3RJbmRleCkge1xuICAgICAgdG9rZW5zLnB1c2goe1xuICAgICAgICB2YWx1ZTogdGV4dC5zbGljZShsYXN0SW5kZXgsIGluZGV4KVxuICAgICAgfSlcbiAgICB9XG4gICAgLy8gdGFnIHRva2VuXG4gICAgZmlyc3QgPSBtYXRjaFsxXS5jaGFyQ29kZUF0KDApXG4gICAgb25lVGltZSA9IGZpcnN0ID09PSA0MiAvLyAqXG4gICAgdHdvV2F5ID0gZmlyc3QgPT09IDY0ICAvLyBAXG4gICAgdmFsdWUgPSBvbmVUaW1lIHx8IHR3b1dheVxuICAgICAgPyBtYXRjaFsxXS5zbGljZSgxKVxuICAgICAgOiBtYXRjaFsxXVxuICAgIHRva2Vucy5wdXNoKHtcbiAgICAgIHRhZzogdHJ1ZSxcbiAgICAgIHZhbHVlOiB2YWx1ZS50cmltKCksXG4gICAgICBodG1sOiBodG1sUkUudGVzdChtYXRjaFswXSksXG4gICAgICBvbmVUaW1lOiBvbmVUaW1lLFxuICAgICAgdHdvV2F5OiB0d29XYXlcbiAgICB9KVxuICAgIGxhc3RJbmRleCA9IGluZGV4ICsgbWF0Y2hbMF0ubGVuZ3RoXG4gIH1cbiAgaWYgKGxhc3RJbmRleCA8IHRleHQubGVuZ3RoKSB7XG4gICAgdG9rZW5zLnB1c2goe1xuICAgICAgdmFsdWU6IHRleHQuc2xpY2UobGFzdEluZGV4KVxuICAgIH0pXG4gIH1cbiAgY2FjaGUucHV0KHRleHQsIHRva2VucylcbiAgcmV0dXJuIHRva2Vuc1xufVxuXG4vKipcbiAqIEZvcm1hdCBhIGxpc3Qgb2YgdG9rZW5zIGludG8gYW4gZXhwcmVzc2lvbi5cbiAqIGUuZy4gdG9rZW5zIHBhcnNlZCBmcm9tICdhIHt7Yn19IGMnIGNhbiBiZSBzZXJpYWxpemVkXG4gKiBpbnRvIG9uZSBzaW5nbGUgZXhwcmVzc2lvbiBhcyAnXCJhIFwiICsgYiArIFwiIGNcIicuXG4gKlxuICogQHBhcmFtIHtBcnJheX0gdG9rZW5zXG4gKiBAcGFyYW0ge1Z1ZX0gW3ZtXVxuICogQHJldHVybiB7U3RyaW5nfVxuICovXG5cbmV4cG9ydHMudG9rZW5zVG9FeHAgPSBmdW5jdGlvbiAodG9rZW5zLCB2bSkge1xuICByZXR1cm4gdG9rZW5zLmxlbmd0aCA+IDFcbiAgICA/IHRva2Vucy5tYXAoZnVuY3Rpb24gKHRva2VuKSB7XG4gICAgICAgIHJldHVybiBmb3JtYXRUb2tlbih0b2tlbiwgdm0pXG4gICAgICB9KS5qb2luKCcrJylcbiAgICA6IGZvcm1hdFRva2VuKHRva2Vuc1swXSwgdm0sIHRydWUpXG59XG5cbi8qKlxuICogRm9ybWF0IGEgc2luZ2xlIHRva2VuLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSB0b2tlblxuICogQHBhcmFtIHtWdWV9IFt2bV1cbiAqIEBwYXJhbSB7Qm9vbGVhbn0gc2luZ2xlXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKi9cblxuZnVuY3Rpb24gZm9ybWF0VG9rZW4gKHRva2VuLCB2bSwgc2luZ2xlKSB7XG4gIHJldHVybiB0b2tlbi50YWdcbiAgICA/IHZtICYmIHRva2VuLm9uZVRpbWVcbiAgICAgID8gJ1wiJyArIHZtLiRldmFsKHRva2VuLnZhbHVlKSArICdcIidcbiAgICAgIDogaW5saW5lRmlsdGVycyh0b2tlbi52YWx1ZSwgc2luZ2xlKVxuICAgIDogJ1wiJyArIHRva2VuLnZhbHVlICsgJ1wiJ1xufVxuXG4vKipcbiAqIEZvciBhbiBhdHRyaWJ1dGUgd2l0aCBtdWx0aXBsZSBpbnRlcnBvbGF0aW9uIHRhZ3MsXG4gKiBlLmcuIGF0dHI9XCJzb21lLXt7dGhpbmcgfCBmaWx0ZXJ9fVwiLCBpbiBvcmRlciB0byBjb21iaW5lXG4gKiB0aGUgd2hvbGUgdGhpbmcgaW50byBhIHNpbmdsZSB3YXRjaGFibGUgZXhwcmVzc2lvbiwgd2VcbiAqIGhhdmUgdG8gaW5saW5lIHRob3NlIGZpbHRlcnMuIFRoaXMgZnVuY3Rpb24gZG9lcyBleGFjdGx5XG4gKiB0aGF0LiBUaGlzIGlzIGEgYml0IGhhY2t5IGJ1dCBpdCBhdm9pZHMgaGVhdnkgY2hhbmdlc1xuICogdG8gZGlyZWN0aXZlIHBhcnNlciBhbmQgd2F0Y2hlciBtZWNoYW5pc20uXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGV4cFxuICogQHBhcmFtIHtCb29sZWFufSBzaW5nbGVcbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqL1xuXG52YXIgZmlsdGVyUkUgPSAvW158XVxcfFtefF0vXG5mdW5jdGlvbiBpbmxpbmVGaWx0ZXJzIChleHAsIHNpbmdsZSkge1xuICBpZiAoIWZpbHRlclJFLnRlc3QoZXhwKSkge1xuICAgIHJldHVybiBzaW5nbGVcbiAgICAgID8gZXhwXG4gICAgICA6ICcoJyArIGV4cCArICcpJ1xuICB9IGVsc2Uge1xuICAgIHZhciBkaXIgPSBkaXJQYXJzZXIucGFyc2UoZXhwKVswXVxuICAgIGlmICghZGlyLmZpbHRlcnMpIHtcbiAgICAgIHJldHVybiAnKCcgKyBleHAgKyAnKSdcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuICd0aGlzLl9hcHBseUZpbHRlcnMoJyArXG4gICAgICAgIGRpci5leHByZXNzaW9uICsgLy8gdmFsdWVcbiAgICAgICAgJyxudWxsLCcgKyAgICAgICAvLyBvbGRWYWx1ZSAobnVsbCBmb3IgcmVhZClcbiAgICAgICAgSlNPTi5zdHJpbmdpZnkoZGlyLmZpbHRlcnMpICsgLy8gZmlsdGVyIGRlc2NyaXB0b3JzXG4gICAgICAgICcsZmFsc2UpJyAgICAgICAgLy8gd3JpdGU/XG4gICAgfVxuICB9XG59XG4iLCJ2YXIgXyA9IHJlcXVpcmUoJy4uL3V0aWwnKVxuXG4vKipcbiAqIEFwcGVuZCB3aXRoIHRyYW5zaXRpb24uXG4gKlxuICogQHBhcmFtIHtFbGVtZW50fSBlbFxuICogQHBhcmFtIHtFbGVtZW50fSB0YXJnZXRcbiAqIEBwYXJhbSB7VnVlfSB2bVxuICogQHBhcmFtIHtGdW5jdGlvbn0gW2NiXVxuICovXG5cbmV4cG9ydHMuYXBwZW5kID0gZnVuY3Rpb24gKGVsLCB0YXJnZXQsIHZtLCBjYikge1xuICBhcHBseShlbCwgMSwgZnVuY3Rpb24gKCkge1xuICAgIHRhcmdldC5hcHBlbmRDaGlsZChlbClcbiAgfSwgdm0sIGNiKVxufVxuXG4vKipcbiAqIEluc2VydEJlZm9yZSB3aXRoIHRyYW5zaXRpb24uXG4gKlxuICogQHBhcmFtIHtFbGVtZW50fSBlbFxuICogQHBhcmFtIHtFbGVtZW50fSB0YXJnZXRcbiAqIEBwYXJhbSB7VnVlfSB2bVxuICogQHBhcmFtIHtGdW5jdGlvbn0gW2NiXVxuICovXG5cbmV4cG9ydHMuYmVmb3JlID0gZnVuY3Rpb24gKGVsLCB0YXJnZXQsIHZtLCBjYikge1xuICBhcHBseShlbCwgMSwgZnVuY3Rpb24gKCkge1xuICAgIF8uYmVmb3JlKGVsLCB0YXJnZXQpXG4gIH0sIHZtLCBjYilcbn1cblxuLyoqXG4gKiBSZW1vdmUgd2l0aCB0cmFuc2l0aW9uLlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gZWxcbiAqIEBwYXJhbSB7VnVlfSB2bVxuICogQHBhcmFtIHtGdW5jdGlvbn0gW2NiXVxuICovXG5cbmV4cG9ydHMucmVtb3ZlID0gZnVuY3Rpb24gKGVsLCB2bSwgY2IpIHtcbiAgYXBwbHkoZWwsIC0xLCBmdW5jdGlvbiAoKSB7XG4gICAgXy5yZW1vdmUoZWwpXG4gIH0sIHZtLCBjYilcbn1cblxuLyoqXG4gKiBSZW1vdmUgYnkgYXBwZW5kaW5nIHRvIGFub3RoZXIgcGFyZW50IHdpdGggdHJhbnNpdGlvbi5cbiAqIFRoaXMgaXMgb25seSB1c2VkIGluIGJsb2NrIG9wZXJhdGlvbnMuXG4gKlxuICogQHBhcmFtIHtFbGVtZW50fSBlbFxuICogQHBhcmFtIHtFbGVtZW50fSB0YXJnZXRcbiAqIEBwYXJhbSB7VnVlfSB2bVxuICogQHBhcmFtIHtGdW5jdGlvbn0gW2NiXVxuICovXG5cbmV4cG9ydHMucmVtb3ZlVGhlbkFwcGVuZCA9IGZ1bmN0aW9uIChlbCwgdGFyZ2V0LCB2bSwgY2IpIHtcbiAgYXBwbHkoZWwsIC0xLCBmdW5jdGlvbiAoKSB7XG4gICAgdGFyZ2V0LmFwcGVuZENoaWxkKGVsKVxuICB9LCB2bSwgY2IpXG59XG5cbi8qKlxuICogQXBwZW5kIHRoZSBjaGlsZE5vZGVzIG9mIGEgZnJhZ21lbnQgdG8gdGFyZ2V0LlxuICpcbiAqIEBwYXJhbSB7RG9jdW1lbnRGcmFnbWVudH0gYmxvY2tcbiAqIEBwYXJhbSB7Tm9kZX0gdGFyZ2V0XG4gKiBAcGFyYW0ge1Z1ZX0gdm1cbiAqL1xuXG5leHBvcnRzLmJsb2NrQXBwZW5kID0gZnVuY3Rpb24gKGJsb2NrLCB0YXJnZXQsIHZtKSB7XG4gIHZhciBub2RlcyA9IF8udG9BcnJheShibG9jay5jaGlsZE5vZGVzKVxuICBmb3IgKHZhciBpID0gMCwgbCA9IG5vZGVzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgIGV4cG9ydHMuYmVmb3JlKG5vZGVzW2ldLCB0YXJnZXQsIHZtKVxuICB9XG59XG5cbi8qKlxuICogUmVtb3ZlIGEgYmxvY2sgb2Ygbm9kZXMgYmV0d2VlbiB0d28gZWRnZSBub2Rlcy5cbiAqXG4gKiBAcGFyYW0ge05vZGV9IHN0YXJ0XG4gKiBAcGFyYW0ge05vZGV9IGVuZFxuICogQHBhcmFtIHtWdWV9IHZtXG4gKi9cblxuZXhwb3J0cy5ibG9ja1JlbW92ZSA9IGZ1bmN0aW9uIChzdGFydCwgZW5kLCB2bSkge1xuICB2YXIgbm9kZSA9IHN0YXJ0Lm5leHRTaWJsaW5nXG4gIHZhciBuZXh0XG4gIHdoaWxlIChub2RlICE9PSBlbmQpIHtcbiAgICBuZXh0ID0gbm9kZS5uZXh0U2libGluZ1xuICAgIGV4cG9ydHMucmVtb3ZlKG5vZGUsIHZtKVxuICAgIG5vZGUgPSBuZXh0XG4gIH1cbn1cblxuLyoqXG4gKiBBcHBseSB0cmFuc2l0aW9ucyB3aXRoIGFuIG9wZXJhdGlvbiBjYWxsYmFjay5cbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IGVsXG4gKiBAcGFyYW0ge051bWJlcn0gZGlyZWN0aW9uXG4gKiAgICAgICAgICAgICAgICAgIDE6IGVudGVyXG4gKiAgICAgICAgICAgICAgICAgLTE6IGxlYXZlXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBvcCAtIHRoZSBhY3R1YWwgRE9NIG9wZXJhdGlvblxuICogQHBhcmFtIHtWdWV9IHZtXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2JdXG4gKi9cblxudmFyIGFwcGx5ID0gZXhwb3J0cy5hcHBseSA9IGZ1bmN0aW9uIChlbCwgZGlyZWN0aW9uLCBvcCwgdm0sIGNiKSB7XG4gIHZhciB0cmFuc2l0aW9uID0gZWwuX192X3RyYW5zXG4gIGlmIChcbiAgICAhdHJhbnNpdGlvbiB8fFxuICAgIC8vIHNraXAgaWYgdGhlcmUgYXJlIG5vIGpzIGhvb2tzIGFuZCBDU1MgdHJhbnNpdGlvbiBpc1xuICAgIC8vIG5vdCBzdXBwb3J0ZWRcbiAgICAoIXRyYW5zaXRpb24uaG9va3MgJiYgIV8udHJhbnNpdGlvbkVuZEV2ZW50KSB8fFxuICAgIC8vIHNraXAgdHJhbnNpdGlvbnMgZm9yIGluaXRpYWwgY29tcGlsZVxuICAgICF2bS5faXNDb21waWxlZCB8fFxuICAgIC8vIGlmIHRoZSB2bSBpcyBiZWluZyBtYW5pcHVsYXRlZCBieSBhIHBhcmVudCBkaXJlY3RpdmVcbiAgICAvLyBkdXJpbmcgdGhlIHBhcmVudCdzIGNvbXBpbGF0aW9uIHBoYXNlLCBza2lwIHRoZVxuICAgIC8vIGFuaW1hdGlvbi5cbiAgICAodm0uJHBhcmVudCAmJiAhdm0uJHBhcmVudC5faXNDb21waWxlZClcbiAgKSB7XG4gICAgb3AoKVxuICAgIGlmIChjYikgY2IoKVxuICAgIHJldHVyblxuICB9XG4gIHZhciBhY3Rpb24gPSBkaXJlY3Rpb24gPiAwID8gJ2VudGVyJyA6ICdsZWF2ZSdcbiAgdHJhbnNpdGlvblthY3Rpb25dKG9wLCBjYilcbn1cbiIsInZhciBfID0gcmVxdWlyZSgnLi4vdXRpbCcpXG52YXIgcXVldWUgPSBbXVxudmFyIHF1ZXVlZCA9IGZhbHNlXG5cbi8qKlxuICogUHVzaCBhIGpvYiBpbnRvIHRoZSBxdWV1ZS5cbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBqb2JcbiAqL1xuXG5leHBvcnRzLnB1c2ggPSBmdW5jdGlvbiAoam9iKSB7XG4gIHF1ZXVlLnB1c2goam9iKVxuICBpZiAoIXF1ZXVlZCkge1xuICAgIHF1ZXVlZCA9IHRydWVcbiAgICBfLm5leHRUaWNrKGZsdXNoKVxuICB9XG59XG5cbi8qKlxuICogRmx1c2ggdGhlIHF1ZXVlLCBhbmQgZG8gb25lIGZvcmNlZCByZWZsb3cgYmVmb3JlXG4gKiB0cmlnZ2VyaW5nIHRyYW5zaXRpb25zLlxuICovXG5cbmZ1bmN0aW9uIGZsdXNoICgpIHtcbiAgLy8gRm9yY2UgbGF5b3V0XG4gIHZhciBmID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50Lm9mZnNldEhlaWdodFxuICBmb3IgKHZhciBpID0gMDsgaSA8IHF1ZXVlLmxlbmd0aDsgaSsrKSB7XG4gICAgcXVldWVbaV0oKVxuICB9XG4gIHF1ZXVlID0gW11cbiAgcXVldWVkID0gZmFsc2VcbiAgLy8gZHVtbXkgcmV0dXJuLCBzbyBqcyBsaW50ZXJzIGRvbid0IGNvbXBsYWluIGFib3V0XG4gIC8vIHVudXNlZCB2YXJpYWJsZSBmXG4gIHJldHVybiBmXG59XG4iLCJ2YXIgXyA9IHJlcXVpcmUoJy4uL3V0aWwnKVxudmFyIHF1ZXVlID0gcmVxdWlyZSgnLi9xdWV1ZScpXG52YXIgYWRkQ2xhc3MgPSBfLmFkZENsYXNzXG52YXIgcmVtb3ZlQ2xhc3MgPSBfLnJlbW92ZUNsYXNzXG52YXIgdHJhbnNpdGlvbkVuZEV2ZW50ID0gXy50cmFuc2l0aW9uRW5kRXZlbnRcbnZhciBhbmltYXRpb25FbmRFdmVudCA9IF8uYW5pbWF0aW9uRW5kRXZlbnRcbnZhciB0cmFuc0R1cmF0aW9uUHJvcCA9IF8udHJhbnNpdGlvblByb3AgKyAnRHVyYXRpb24nXG52YXIgYW5pbUR1cmF0aW9uUHJvcCA9IF8uYW5pbWF0aW9uUHJvcCArICdEdXJhdGlvbidcblxudmFyIFRZUEVfVFJBTlNJVElPTiA9IDFcbnZhciBUWVBFX0FOSU1BVElPTiA9IDJcblxudmFyIHVpZCA9IDBcblxuLyoqXG4gKiBBIFRyYW5zaXRpb24gb2JqZWN0IHRoYXQgZW5jYXBzdWxhdGVzIHRoZSBzdGF0ZSBhbmQgbG9naWNcbiAqIG9mIHRoZSB0cmFuc2l0aW9uLlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gZWxcbiAqIEBwYXJhbSB7U3RyaW5nfSBpZFxuICogQHBhcmFtIHtPYmplY3R9IGhvb2tzXG4gKiBAcGFyYW0ge1Z1ZX0gdm1cbiAqL1xuXG5mdW5jdGlvbiBUcmFuc2l0aW9uIChlbCwgaWQsIGhvb2tzLCB2bSkge1xuICB0aGlzLmlkID0gdWlkKytcbiAgdGhpcy5lbCA9IGVsXG4gIHRoaXMuZW50ZXJDbGFzcyA9IGlkICsgJy1lbnRlcidcbiAgdGhpcy5sZWF2ZUNsYXNzID0gaWQgKyAnLWxlYXZlJ1xuICB0aGlzLmhvb2tzID0gaG9va3NcbiAgdGhpcy52bSA9IHZtXG4gIC8vIGFzeW5jIHN0YXRlXG4gIHRoaXMucGVuZGluZ0Nzc0V2ZW50ID1cbiAgdGhpcy5wZW5kaW5nQ3NzQ2IgPVxuICB0aGlzLmNhbmNlbCA9XG4gIHRoaXMucGVuZGluZ0pzQ2IgPVxuICB0aGlzLm9wID1cbiAgdGhpcy5jYiA9IG51bGxcbiAgdGhpcy5qdXN0RW50ZXJlZCA9IGZhbHNlXG4gIHRoaXMuZW50ZXJlZCA9IHRoaXMubGVmdCA9IGZhbHNlXG4gIHRoaXMudHlwZUNhY2hlID0ge31cbiAgLy8gYmluZFxuICB2YXIgc2VsZiA9IHRoaXNcbiAgO1snZW50ZXJOZXh0VGljaycsICdlbnRlckRvbmUnLCAnbGVhdmVOZXh0VGljaycsICdsZWF2ZURvbmUnXVxuICAgIC5mb3JFYWNoKGZ1bmN0aW9uIChtKSB7XG4gICAgICBzZWxmW21dID0gXy5iaW5kKHNlbGZbbV0sIHNlbGYpXG4gICAgfSlcbn1cblxudmFyIHAgPSBUcmFuc2l0aW9uLnByb3RvdHlwZVxuXG4vKipcbiAqIFN0YXJ0IGFuIGVudGVyaW5nIHRyYW5zaXRpb24uXG4gKlxuICogMS4gZW50ZXIgdHJhbnNpdGlvbiB0cmlnZ2VyZWRcbiAqIDIuIGNhbGwgYmVmb3JlRW50ZXIgaG9va1xuICogMy4gYWRkIGVudGVyIGNsYXNzXG4gKiA0LiBpbnNlcnQvc2hvdyBlbGVtZW50XG4gKiA1LiBjYWxsIGVudGVyIGhvb2sgKHdpdGggcG9zc2libGUgZXhwbGljaXQganMgY2FsbGJhY2spXG4gKiA2LiByZWZsb3dcbiAqIDcuIGJhc2VkIG9uIHRyYW5zaXRpb24gdHlwZTpcbiAqICAgIC0gdHJhbnNpdGlvbjpcbiAqICAgICAgICByZW1vdmUgY2xhc3Mgbm93LCB3YWl0IGZvciB0cmFuc2l0aW9uZW5kLFxuICogICAgICAgIHRoZW4gZG9uZSBpZiB0aGVyZSdzIG5vIGV4cGxpY2l0IGpzIGNhbGxiYWNrLlxuICogICAgLSBhbmltYXRpb246XG4gKiAgICAgICAgd2FpdCBmb3IgYW5pbWF0aW9uZW5kLCByZW1vdmUgY2xhc3MsXG4gKiAgICAgICAgdGhlbiBkb25lIGlmIHRoZXJlJ3Mgbm8gZXhwbGljaXQganMgY2FsbGJhY2suXG4gKiAgICAtIG5vIGNzcyB0cmFuc2l0aW9uOlxuICogICAgICAgIGRvbmUgbm93IGlmIHRoZXJlJ3Mgbm8gZXhwbGljaXQganMgY2FsbGJhY2suXG4gKiA4LiB3YWl0IGZvciBlaXRoZXIgZG9uZSBvciBqcyBjYWxsYmFjaywgdGhlbiBjYWxsXG4gKiAgICBhZnRlckVudGVyIGhvb2suXG4gKlxuICogQHBhcmFtIHtGdW5jdGlvbn0gb3AgLSBpbnNlcnQvc2hvdyB0aGUgZWxlbWVudFxuICogQHBhcmFtIHtGdW5jdGlvbn0gW2NiXVxuICovXG5cbnAuZW50ZXIgPSBmdW5jdGlvbiAob3AsIGNiKSB7XG4gIHRoaXMuY2FuY2VsUGVuZGluZygpXG4gIHRoaXMuY2FsbEhvb2soJ2JlZm9yZUVudGVyJylcbiAgdGhpcy5jYiA9IGNiXG4gIGFkZENsYXNzKHRoaXMuZWwsIHRoaXMuZW50ZXJDbGFzcylcbiAgb3AoKVxuICB0aGlzLmVudGVyZWQgPSBmYWxzZVxuICB0aGlzLmNhbGxIb29rV2l0aENiKCdlbnRlcicpXG4gIGlmICh0aGlzLmVudGVyZWQpIHtcbiAgICByZXR1cm4gLy8gdXNlciBjYWxsZWQgZG9uZSBzeW5jaHJvbm91c2x5LlxuICB9XG4gIHRoaXMuY2FuY2VsID0gdGhpcy5ob29rcyAmJiB0aGlzLmhvb2tzLmVudGVyQ2FuY2VsbGVkXG4gIHF1ZXVlLnB1c2godGhpcy5lbnRlck5leHRUaWNrKVxufVxuXG4vKipcbiAqIFRoZSBcIm5leHRUaWNrXCIgcGhhc2Ugb2YgYW4gZW50ZXJpbmcgdHJhbnNpdGlvbiwgd2hpY2ggaXNcbiAqIHRvIGJlIHB1c2hlZCBpbnRvIGEgcXVldWUgYW5kIGV4ZWN1dGVkIGFmdGVyIGEgcmVmbG93IHNvXG4gKiB0aGF0IHJlbW92aW5nIHRoZSBjbGFzcyBjYW4gdHJpZ2dlciBhIENTUyB0cmFuc2l0aW9uLlxuICovXG5cbnAuZW50ZXJOZXh0VGljayA9IGZ1bmN0aW9uICgpIHtcbiAgdGhpcy5qdXN0RW50ZXJlZCA9IHRydWVcbiAgXy5uZXh0VGljayhmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5qdXN0RW50ZXJlZCA9IGZhbHNlXG4gIH0sIHRoaXMpXG4gIHZhciBlbnRlckRvbmUgPSB0aGlzLmVudGVyRG9uZVxuICB2YXIgdHlwZSA9IHRoaXMuZ2V0Q3NzVHJhbnNpdGlvblR5cGUodGhpcy5lbnRlckNsYXNzKVxuICBpZiAoIXRoaXMucGVuZGluZ0pzQ2IpIHtcbiAgICBpZiAodHlwZSA9PT0gVFlQRV9UUkFOU0lUSU9OKSB7XG4gICAgICAvLyB0cmlnZ2VyIHRyYW5zaXRpb24gYnkgcmVtb3ZpbmcgZW50ZXIgY2xhc3Mgbm93XG4gICAgICByZW1vdmVDbGFzcyh0aGlzLmVsLCB0aGlzLmVudGVyQ2xhc3MpXG4gICAgICB0aGlzLnNldHVwQ3NzQ2IodHJhbnNpdGlvbkVuZEV2ZW50LCBlbnRlckRvbmUpXG4gICAgfSBlbHNlIGlmICh0eXBlID09PSBUWVBFX0FOSU1BVElPTikge1xuICAgICAgdGhpcy5zZXR1cENzc0NiKGFuaW1hdGlvbkVuZEV2ZW50LCBlbnRlckRvbmUpXG4gICAgfSBlbHNlIHtcbiAgICAgIGVudGVyRG9uZSgpXG4gICAgfVxuICB9IGVsc2UgaWYgKHR5cGUgPT09IFRZUEVfVFJBTlNJVElPTikge1xuICAgIHJlbW92ZUNsYXNzKHRoaXMuZWwsIHRoaXMuZW50ZXJDbGFzcylcbiAgfVxufVxuXG4vKipcbiAqIFRoZSBcImNsZWFudXBcIiBwaGFzZSBvZiBhbiBlbnRlcmluZyB0cmFuc2l0aW9uLlxuICovXG5cbnAuZW50ZXJEb25lID0gZnVuY3Rpb24gKCkge1xuICB0aGlzLmVudGVyZWQgPSB0cnVlXG4gIHRoaXMuY2FuY2VsID0gdGhpcy5wZW5kaW5nSnNDYiA9IG51bGxcbiAgcmVtb3ZlQ2xhc3ModGhpcy5lbCwgdGhpcy5lbnRlckNsYXNzKVxuICB0aGlzLmNhbGxIb29rKCdhZnRlckVudGVyJylcbiAgaWYgKHRoaXMuY2IpIHRoaXMuY2IoKVxufVxuXG4vKipcbiAqIFN0YXJ0IGEgbGVhdmluZyB0cmFuc2l0aW9uLlxuICpcbiAqIDEuIGxlYXZlIHRyYW5zaXRpb24gdHJpZ2dlcmVkLlxuICogMi4gY2FsbCBiZWZvcmVMZWF2ZSBob29rXG4gKiAzLiBhZGQgbGVhdmUgY2xhc3MgKHRyaWdnZXIgY3NzIHRyYW5zaXRpb24pXG4gKiA0LiBjYWxsIGxlYXZlIGhvb2sgKHdpdGggcG9zc2libGUgZXhwbGljaXQganMgY2FsbGJhY2spXG4gKiA1LiByZWZsb3cgaWYgbm8gZXhwbGljaXQganMgY2FsbGJhY2sgaXMgcHJvdmlkZWRcbiAqIDYuIGJhc2VkIG9uIHRyYW5zaXRpb24gdHlwZTpcbiAqICAgIC0gdHJhbnNpdGlvbiBvciBhbmltYXRpb246XG4gKiAgICAgICAgd2FpdCBmb3IgZW5kIGV2ZW50LCByZW1vdmUgY2xhc3MsIHRoZW4gZG9uZSBpZlxuICogICAgICAgIHRoZXJlJ3Mgbm8gZXhwbGljaXQganMgY2FsbGJhY2suXG4gKiAgICAtIG5vIGNzcyB0cmFuc2l0aW9uOlxuICogICAgICAgIGRvbmUgaWYgdGhlcmUncyBubyBleHBsaWNpdCBqcyBjYWxsYmFjay5cbiAqIDcuIHdhaXQgZm9yIGVpdGhlciBkb25lIG9yIGpzIGNhbGxiYWNrLCB0aGVuIGNhbGxcbiAqICAgIGFmdGVyTGVhdmUgaG9vay5cbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBvcCAtIHJlbW92ZS9oaWRlIHRoZSBlbGVtZW50XG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2JdXG4gKi9cblxucC5sZWF2ZSA9IGZ1bmN0aW9uIChvcCwgY2IpIHtcbiAgdGhpcy5jYW5jZWxQZW5kaW5nKClcbiAgdGhpcy5jYWxsSG9vaygnYmVmb3JlTGVhdmUnKVxuICB0aGlzLm9wID0gb3BcbiAgdGhpcy5jYiA9IGNiXG4gIGFkZENsYXNzKHRoaXMuZWwsIHRoaXMubGVhdmVDbGFzcylcbiAgdGhpcy5sZWZ0ID0gZmFsc2VcbiAgdGhpcy5jYWxsSG9va1dpdGhDYignbGVhdmUnKVxuICBpZiAodGhpcy5sZWZ0KSB7XG4gICAgcmV0dXJuIC8vIHVzZXIgY2FsbGVkIGRvbmUgc3luY2hyb25vdXNseS5cbiAgfVxuICB0aGlzLmNhbmNlbCA9IHRoaXMuaG9va3MgJiYgdGhpcy5ob29rcy5sZWF2ZUNhbmNlbGxlZFxuICAvLyBvbmx5IG5lZWQgdG8gaGFuZGxlIGxlYXZlRG9uZSBpZlxuICAvLyAxLiB0aGUgdHJhbnNpdGlvbiBpcyBhbHJlYWR5IGRvbmUgKHN5bmNocm9ub3VzbHkgY2FsbGVkXG4gIC8vICAgIGJ5IHRoZSB1c2VyLCB3aGljaCBjYXVzZXMgdGhpcy5vcCBzZXQgdG8gbnVsbClcbiAgLy8gMi4gdGhlcmUncyBubyBleHBsaWNpdCBqcyBjYWxsYmFja1xuICBpZiAodGhpcy5vcCAmJiAhdGhpcy5wZW5kaW5nSnNDYikge1xuICAgIC8vIGlmIGEgQ1NTIHRyYW5zaXRpb24gbGVhdmVzIGltbWVkaWF0ZWx5IGFmdGVyIGVudGVyLFxuICAgIC8vIHRoZSB0cmFuc2l0aW9uZW5kIGV2ZW50IG5ldmVyIGZpcmVzLiB0aGVyZWZvcmUgd2VcbiAgICAvLyBkZXRlY3Qgc3VjaCBjYXNlcyBhbmQgZW5kIHRoZSBsZWF2ZSBpbW1lZGlhdGVseS5cbiAgICBpZiAodGhpcy5qdXN0RW50ZXJlZCkge1xuICAgICAgdGhpcy5sZWF2ZURvbmUoKVxuICAgIH0gZWxzZSB7XG4gICAgICBxdWV1ZS5wdXNoKHRoaXMubGVhdmVOZXh0VGljaylcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBUaGUgXCJuZXh0VGlja1wiIHBoYXNlIG9mIGEgbGVhdmluZyB0cmFuc2l0aW9uLlxuICovXG5cbnAubGVhdmVOZXh0VGljayA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHR5cGUgPSB0aGlzLmdldENzc1RyYW5zaXRpb25UeXBlKHRoaXMubGVhdmVDbGFzcylcbiAgaWYgKHR5cGUpIHtcbiAgICB2YXIgZXZlbnQgPSB0eXBlID09PSBUWVBFX1RSQU5TSVRJT05cbiAgICAgID8gdHJhbnNpdGlvbkVuZEV2ZW50XG4gICAgICA6IGFuaW1hdGlvbkVuZEV2ZW50XG4gICAgdGhpcy5zZXR1cENzc0NiKGV2ZW50LCB0aGlzLmxlYXZlRG9uZSlcbiAgfSBlbHNlIHtcbiAgICB0aGlzLmxlYXZlRG9uZSgpXG4gIH1cbn1cblxuLyoqXG4gKiBUaGUgXCJjbGVhbnVwXCIgcGhhc2Ugb2YgYSBsZWF2aW5nIHRyYW5zaXRpb24uXG4gKi9cblxucC5sZWF2ZURvbmUgPSBmdW5jdGlvbiAoKSB7XG4gIHRoaXMubGVmdCA9IHRydWVcbiAgdGhpcy5jYW5jZWwgPSB0aGlzLnBlbmRpbmdKc0NiID0gbnVsbFxuICB0aGlzLm9wKClcbiAgcmVtb3ZlQ2xhc3ModGhpcy5lbCwgdGhpcy5sZWF2ZUNsYXNzKVxuICB0aGlzLmNhbGxIb29rKCdhZnRlckxlYXZlJylcbiAgaWYgKHRoaXMuY2IpIHRoaXMuY2IoKVxuICB0aGlzLm9wID0gbnVsbFxufVxuXG4vKipcbiAqIENhbmNlbCBhbnkgcGVuZGluZyBjYWxsYmFja3MgZnJvbSBhIHByZXZpb3VzbHkgcnVubmluZ1xuICogYnV0IG5vdCBmaW5pc2hlZCB0cmFuc2l0aW9uLlxuICovXG5cbnAuY2FuY2VsUGVuZGluZyA9IGZ1bmN0aW9uICgpIHtcbiAgdGhpcy5vcCA9IHRoaXMuY2IgPSBudWxsXG4gIHZhciBoYXNQZW5kaW5nID0gZmFsc2VcbiAgaWYgKHRoaXMucGVuZGluZ0Nzc0NiKSB7XG4gICAgaGFzUGVuZGluZyA9IHRydWVcbiAgICBfLm9mZih0aGlzLmVsLCB0aGlzLnBlbmRpbmdDc3NFdmVudCwgdGhpcy5wZW5kaW5nQ3NzQ2IpXG4gICAgdGhpcy5wZW5kaW5nQ3NzRXZlbnQgPSB0aGlzLnBlbmRpbmdDc3NDYiA9IG51bGxcbiAgfVxuICBpZiAodGhpcy5wZW5kaW5nSnNDYikge1xuICAgIGhhc1BlbmRpbmcgPSB0cnVlXG4gICAgdGhpcy5wZW5kaW5nSnNDYi5jYW5jZWwoKVxuICAgIHRoaXMucGVuZGluZ0pzQ2IgPSBudWxsXG4gIH1cbiAgaWYgKGhhc1BlbmRpbmcpIHtcbiAgICByZW1vdmVDbGFzcyh0aGlzLmVsLCB0aGlzLmVudGVyQ2xhc3MpXG4gICAgcmVtb3ZlQ2xhc3ModGhpcy5lbCwgdGhpcy5sZWF2ZUNsYXNzKVxuICB9XG4gIGlmICh0aGlzLmNhbmNlbCkge1xuICAgIHRoaXMuY2FuY2VsLmNhbGwodGhpcy52bSwgdGhpcy5lbClcbiAgICB0aGlzLmNhbmNlbCA9IG51bGxcbiAgfVxufVxuXG4vKipcbiAqIENhbGwgYSB1c2VyLXByb3ZpZGVkIHN5bmNocm9ub3VzIGhvb2sgZnVuY3Rpb24uXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHR5cGVcbiAqL1xuXG5wLmNhbGxIb29rID0gZnVuY3Rpb24gKHR5cGUpIHtcbiAgaWYgKHRoaXMuaG9va3MgJiYgdGhpcy5ob29rc1t0eXBlXSkge1xuICAgIHRoaXMuaG9va3NbdHlwZV0uY2FsbCh0aGlzLnZtLCB0aGlzLmVsKVxuICB9XG59XG5cbi8qKlxuICogQ2FsbCBhIHVzZXItcHJvdmlkZWQsIHBvdGVudGlhbGx5LWFzeW5jIGhvb2sgZnVuY3Rpb24uXG4gKiBXZSBjaGVjayBmb3IgdGhlIGxlbmd0aCBvZiBhcmd1bWVudHMgdG8gc2VlIGlmIHRoZSBob29rXG4gKiBleHBlY3RzIGEgYGRvbmVgIGNhbGxiYWNrLiBJZiB0cnVlLCB0aGUgdHJhbnNpdGlvbidzIGVuZFxuICogd2lsbCBiZSBkZXRlcm1pbmVkIGJ5IHdoZW4gdGhlIHVzZXIgY2FsbHMgdGhhdCBjYWxsYmFjaztcbiAqIG90aGVyd2lzZSwgdGhlIGVuZCBpcyBkZXRlcm1pbmVkIGJ5IHRoZSBDU1MgdHJhbnNpdGlvbiBvclxuICogYW5pbWF0aW9uLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSB0eXBlXG4gKi9cblxucC5jYWxsSG9va1dpdGhDYiA9IGZ1bmN0aW9uICh0eXBlKSB7XG4gIHZhciBob29rID0gdGhpcy5ob29rcyAmJiB0aGlzLmhvb2tzW3R5cGVdXG4gIGlmIChob29rKSB7XG4gICAgaWYgKGhvb2subGVuZ3RoID4gMSkge1xuICAgICAgdGhpcy5wZW5kaW5nSnNDYiA9IF8uY2FuY2VsbGFibGUodGhpc1t0eXBlICsgJ0RvbmUnXSlcbiAgICB9XG4gICAgaG9vay5jYWxsKHRoaXMudm0sIHRoaXMuZWwsIHRoaXMucGVuZGluZ0pzQ2IpXG4gIH1cbn1cblxuLyoqXG4gKiBHZXQgYW4gZWxlbWVudCdzIHRyYW5zaXRpb24gdHlwZSBiYXNlZCBvbiB0aGVcbiAqIGNhbGN1bGF0ZWQgc3R5bGVzLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBjbGFzc05hbWVcbiAqIEByZXR1cm4ge051bWJlcn1cbiAqL1xuXG5wLmdldENzc1RyYW5zaXRpb25UeXBlID0gZnVuY3Rpb24gKGNsYXNzTmFtZSkge1xuICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgaWYgKFxuICAgICF0cmFuc2l0aW9uRW5kRXZlbnQgfHxcbiAgICAvLyBza2lwIENTUyB0cmFuc2l0aW9ucyBpZiBwYWdlIGlzIG5vdCB2aXNpYmxlIC1cbiAgICAvLyB0aGlzIHNvbHZlcyB0aGUgaXNzdWUgb2YgdHJhbnNpdGlvbmVuZCBldmVudHMgbm90XG4gICAgLy8gZmlyaW5nIHVudGlsIHRoZSBwYWdlIGlzIHZpc2libGUgYWdhaW4uXG4gICAgLy8gcGFnZVZpc2liaWxpdHkgQVBJIGlzIHN1cHBvcnRlZCBpbiBJRTEwKywgc2FtZSBhc1xuICAgIC8vIENTUyB0cmFuc2l0aW9ucy5cbiAgICBkb2N1bWVudC5oaWRkZW4gfHxcbiAgICAvLyBleHBsaWNpdCBqcy1vbmx5IHRyYW5zaXRpb25cbiAgICAodGhpcy5ob29rcyAmJiB0aGlzLmhvb2tzLmNzcyA9PT0gZmFsc2UpXG4gICkge1xuICAgIHJldHVyblxuICB9XG4gIHZhciB0eXBlID0gdGhpcy50eXBlQ2FjaGVbY2xhc3NOYW1lXVxuICBpZiAodHlwZSkgcmV0dXJuIHR5cGVcbiAgdmFyIGlubGluZVN0eWxlcyA9IHRoaXMuZWwuc3R5bGVcbiAgdmFyIGNvbXB1dGVkU3R5bGVzID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUodGhpcy5lbClcbiAgdmFyIHRyYW5zRHVyYXRpb24gPVxuICAgIGlubGluZVN0eWxlc1t0cmFuc0R1cmF0aW9uUHJvcF0gfHxcbiAgICBjb21wdXRlZFN0eWxlc1t0cmFuc0R1cmF0aW9uUHJvcF1cbiAgaWYgKHRyYW5zRHVyYXRpb24gJiYgdHJhbnNEdXJhdGlvbiAhPT0gJzBzJykge1xuICAgIHR5cGUgPSBUWVBFX1RSQU5TSVRJT05cbiAgfSBlbHNlIHtcbiAgICB2YXIgYW5pbUR1cmF0aW9uID1cbiAgICAgIGlubGluZVN0eWxlc1thbmltRHVyYXRpb25Qcm9wXSB8fFxuICAgICAgY29tcHV0ZWRTdHlsZXNbYW5pbUR1cmF0aW9uUHJvcF1cbiAgICBpZiAoYW5pbUR1cmF0aW9uICYmIGFuaW1EdXJhdGlvbiAhPT0gJzBzJykge1xuICAgICAgdHlwZSA9IFRZUEVfQU5JTUFUSU9OXG4gICAgfVxuICB9XG4gIGlmICh0eXBlKSB7XG4gICAgdGhpcy50eXBlQ2FjaGVbY2xhc3NOYW1lXSA9IHR5cGVcbiAgfVxuICByZXR1cm4gdHlwZVxufVxuXG4vKipcbiAqIFNldHVwIGEgQ1NTIHRyYW5zaXRpb25lbmQvYW5pbWF0aW9uZW5kIGNhbGxiYWNrLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBldmVudFxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2JcbiAqL1xuXG5wLnNldHVwQ3NzQ2IgPSBmdW5jdGlvbiAoZXZlbnQsIGNiKSB7XG4gIHRoaXMucGVuZGluZ0Nzc0V2ZW50ID0gZXZlbnRcbiAgdmFyIHNlbGYgPSB0aGlzXG4gIHZhciBlbCA9IHRoaXMuZWxcbiAgdmFyIG9uRW5kID0gdGhpcy5wZW5kaW5nQ3NzQ2IgPSBmdW5jdGlvbiAoZSkge1xuICAgIGlmIChlLnRhcmdldCA9PT0gZWwpIHtcbiAgICAgIF8ub2ZmKGVsLCBldmVudCwgb25FbmQpXG4gICAgICBzZWxmLnBlbmRpbmdDc3NFdmVudCA9IHNlbGYucGVuZGluZ0Nzc0NiID0gbnVsbFxuICAgICAgaWYgKCFzZWxmLnBlbmRpbmdKc0NiICYmIGNiKSB7XG4gICAgICAgIGNiKClcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgXy5vbihlbCwgZXZlbnQsIG9uRW5kKVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFRyYW5zaXRpb25cbiIsInZhciBfID0gcmVxdWlyZSgnLi9pbmRleCcpXG5cbi8qKlxuICogQ2hlY2sgaWYgYW4gZWxlbWVudCBpcyBhIGNvbXBvbmVudCwgaWYgeWVzIHJldHVybiBpdHNcbiAqIGNvbXBvbmVudCBpZC5cbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IGVsXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICogQHJldHVybiB7U3RyaW5nfHVuZGVmaW5lZH1cbiAqL1xuXG5leHBvcnRzLmNvbW1vblRhZ1JFID0gL14oZGl2fHB8c3BhbnxpbWd8YXxicnx1bHxvbHxsaXxoMXxoMnxoM3xoNHxoNXxjb2RlfHByZSkkL1xuZXhwb3J0cy5jaGVja0NvbXBvbmVudCA9IGZ1bmN0aW9uIChlbCwgb3B0aW9ucykge1xuICB2YXIgdGFnID0gZWwudGFnTmFtZS50b0xvd2VyQ2FzZSgpXG4gIGlmICh0YWcgPT09ICdjb21wb25lbnQnKSB7XG4gICAgLy8gZHluYW1pYyBzeW50YXhcbiAgICB2YXIgZXhwID0gZWwuZ2V0QXR0cmlidXRlKCdpcycpXG4gICAgZWwucmVtb3ZlQXR0cmlidXRlKCdpcycpXG4gICAgcmV0dXJuIGV4cFxuICB9IGVsc2UgaWYgKFxuICAgICFleHBvcnRzLmNvbW1vblRhZ1JFLnRlc3QodGFnKSAmJlxuICAgIF8ucmVzb2x2ZUFzc2V0KG9wdGlvbnMsICdjb21wb25lbnRzJywgdGFnKVxuICApIHtcbiAgICByZXR1cm4gdGFnXG4gIC8qIGVzbGludC1kaXNhYmxlIG5vLWNvbmQtYXNzaWduICovXG4gIH0gZWxzZSBpZiAodGFnID0gXy5hdHRyKGVsLCAnY29tcG9uZW50JykpIHtcbiAgLyogZXNsaW50LWVuYWJsZSBuby1jb25kLWFzc2lnbiAqL1xuICAgIHJldHVybiB0YWdcbiAgfVxufVxuXG4vKipcbiAqIFNldCBhIHByb3AncyBpbml0aWFsIHZhbHVlIG9uIGEgdm0gYW5kIGl0cyBkYXRhIG9iamVjdC5cbiAqIFRoZSB2bSBtYXkgaGF2ZSBpbmhlcml0OnRydWUgc28gd2UgbmVlZCB0byBtYWtlIHN1cmVcbiAqIHdlIGRvbid0IGFjY2lkZW50YWxseSBvdmVyd3JpdGUgcGFyZW50IHZhbHVlLlxuICpcbiAqIEBwYXJhbSB7VnVlfSB2bVxuICogQHBhcmFtIHtPYmplY3R9IHByb3BcbiAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAqL1xuXG5leHBvcnRzLmluaXRQcm9wID0gZnVuY3Rpb24gKHZtLCBwcm9wLCB2YWx1ZSkge1xuICBpZiAoZXhwb3J0cy5hc3NlcnRQcm9wKHByb3AsIHZhbHVlKSkge1xuICAgIHZhciBrZXkgPSBwcm9wLnBhdGhcbiAgICBpZiAoa2V5IGluIHZtKSB7XG4gICAgICBfLmRlZmluZSh2bSwga2V5LCB2YWx1ZSwgdHJ1ZSlcbiAgICB9IGVsc2Uge1xuICAgICAgdm1ba2V5XSA9IHZhbHVlXG4gICAgfVxuICAgIHZtLl9kYXRhW2tleV0gPSB2YWx1ZVxuICB9XG59XG5cbi8qKlxuICogQXNzZXJ0IHdoZXRoZXIgYSBwcm9wIGlzIHZhbGlkLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBwcm9wXG4gKiBAcGFyYW0geyp9IHZhbHVlXG4gKi9cblxuZXhwb3J0cy5hc3NlcnRQcm9wID0gZnVuY3Rpb24gKHByb3AsIHZhbHVlKSB7XG4gIC8vIGlmIGEgcHJvcCBpcyBub3QgcHJvdmlkZWQgYW5kIGlzIG5vdCByZXF1aXJlZCxcbiAgLy8gc2tpcCB0aGUgY2hlY2suXG4gIGlmIChwcm9wLnJhdyA9PT0gbnVsbCAmJiAhcHJvcC5yZXF1aXJlZCkge1xuICAgIHJldHVybiB0cnVlXG4gIH1cbiAgdmFyIG9wdGlvbnMgPSBwcm9wLm9wdGlvbnNcbiAgdmFyIHR5cGUgPSBvcHRpb25zLnR5cGVcbiAgdmFyIHZhbGlkID0gdHJ1ZVxuICB2YXIgZXhwZWN0ZWRUeXBlXG4gIGlmICh0eXBlKSB7XG4gICAgaWYgKHR5cGUgPT09IFN0cmluZykge1xuICAgICAgZXhwZWN0ZWRUeXBlID0gJ3N0cmluZydcbiAgICAgIHZhbGlkID0gdHlwZW9mIHZhbHVlID09PSBleHBlY3RlZFR5cGVcbiAgICB9IGVsc2UgaWYgKHR5cGUgPT09IE51bWJlcikge1xuICAgICAgZXhwZWN0ZWRUeXBlID0gJ251bWJlcidcbiAgICAgIHZhbGlkID0gdHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJ1xuICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gQm9vbGVhbikge1xuICAgICAgZXhwZWN0ZWRUeXBlID0gJ2Jvb2xlYW4nXG4gICAgICB2YWxpZCA9IHR5cGVvZiB2YWx1ZSA9PT0gJ2Jvb2xlYW4nXG4gICAgfSBlbHNlIGlmICh0eXBlID09PSBGdW5jdGlvbikge1xuICAgICAgZXhwZWN0ZWRUeXBlID0gJ2Z1bmN0aW9uJ1xuICAgICAgdmFsaWQgPSB0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbidcbiAgICB9IGVsc2UgaWYgKHR5cGUgPT09IE9iamVjdCkge1xuICAgICAgZXhwZWN0ZWRUeXBlID0gJ29iamVjdCdcbiAgICAgIHZhbGlkID0gXy5pc1BsYWluT2JqZWN0KHZhbHVlKVxuICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gQXJyYXkpIHtcbiAgICAgIGV4cGVjdGVkVHlwZSA9ICdhcnJheSdcbiAgICAgIHZhbGlkID0gXy5pc0FycmF5KHZhbHVlKVxuICAgIH0gZWxzZSB7XG4gICAgICB2YWxpZCA9IHZhbHVlIGluc3RhbmNlb2YgdHlwZVxuICAgIH1cbiAgfVxuICBpZiAoIXZhbGlkKSB7XG4gICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiBfLndhcm4oXG4gICAgICAnSW52YWxpZCBwcm9wOiB0eXBlIGNoZWNrIGZhaWxlZCBmb3IgJyArXG4gICAgICBwcm9wLnBhdGggKyAnPVwiJyArIHByb3AucmF3ICsgJ1wiLicgK1xuICAgICAgJyBFeHBlY3RlZCAnICsgZm9ybWF0VHlwZShleHBlY3RlZFR5cGUpICtcbiAgICAgICcsIGdvdCAnICsgZm9ybWF0VmFsdWUodmFsdWUpICsgJy4nXG4gICAgKVxuICAgIHJldHVybiBmYWxzZVxuICB9XG4gIHZhciB2YWxpZGF0b3IgPSBvcHRpb25zLnZhbGlkYXRvclxuICBpZiAodmFsaWRhdG9yKSB7XG4gICAgaWYgKCF2YWxpZGF0b3IuY2FsbChudWxsLCB2YWx1ZSkpIHtcbiAgICAgIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgJiYgXy53YXJuKFxuICAgICAgICAnSW52YWxpZCBwcm9wOiBjdXN0b20gdmFsaWRhdG9yIGNoZWNrIGZhaWxlZCBmb3IgJyArXG4gICAgICAgIHByb3AucGF0aCArICc9XCInICsgcHJvcC5yYXcgKyAnXCInXG4gICAgICApXG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHRydWVcbn1cblxuZnVuY3Rpb24gZm9ybWF0VHlwZSAodmFsKSB7XG4gIHJldHVybiB2YWxcbiAgICA/IHZhbC5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIHZhbC5zbGljZSgxKVxuICAgIDogJ2N1c3RvbSB0eXBlJ1xufVxuXG5mdW5jdGlvbiBmb3JtYXRWYWx1ZSAodmFsKSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsKS5zbGljZSg4LCAtMSlcbn1cbiIsIi8qKlxuICogRW5hYmxlIGRlYnVnIHV0aWxpdGllcy5cbiAqL1xuXG5pZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuXG4gIHZhciBjb25maWcgPSByZXF1aXJlKCcuLi9jb25maWcnKVxuICB2YXIgaGFzQ29uc29sZSA9IHR5cGVvZiBjb25zb2xlICE9PSAndW5kZWZpbmVkJ1xuXG4gIC8qKlxuICAgKiBMb2cgYSBtZXNzYWdlLlxuICAgKlxuICAgKiBAcGFyYW0ge1N0cmluZ30gbXNnXG4gICAqL1xuXG4gIGV4cG9ydHMubG9nID0gZnVuY3Rpb24gKG1zZykge1xuICAgIGlmIChoYXNDb25zb2xlICYmIGNvbmZpZy5kZWJ1Zykge1xuICAgICAgY29uc29sZS5sb2coJ1tWdWUgaW5mb106ICcgKyBtc2cpXG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFdlJ3ZlIGdvdCBhIHByb2JsZW0gaGVyZS5cbiAgICpcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1zZ1xuICAgKi9cblxuICBleHBvcnRzLndhcm4gPSBmdW5jdGlvbiAobXNnLCBlKSB7XG4gICAgaWYgKGhhc0NvbnNvbGUgJiYgKCFjb25maWcuc2lsZW50IHx8IGNvbmZpZy5kZWJ1ZykpIHtcbiAgICAgIGNvbnNvbGUud2FybignW1Z1ZSB3YXJuXTogJyArIG1zZylcbiAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICAgICAgaWYgKGNvbmZpZy5kZWJ1Zykge1xuICAgICAgICBjb25zb2xlLndhcm4oKGUgfHwgbmV3IEVycm9yKCdXYXJuaW5nIFN0YWNrIFRyYWNlJykpLnN0YWNrKVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBBc3NlcnQgYXNzZXQgZXhpc3RzXG4gICAqL1xuXG4gIGV4cG9ydHMuYXNzZXJ0QXNzZXQgPSBmdW5jdGlvbiAodmFsLCB0eXBlLCBpZCkge1xuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICAgIGlmICh0eXBlID09PSAnZGlyZWN0aXZlJykge1xuICAgICAgaWYgKGlkID09PSAnd2l0aCcpIHtcbiAgICAgICAgZXhwb3J0cy53YXJuKFxuICAgICAgICAgICd2LXdpdGggaGFzIGJlZW4gZGVwcmVjYXRlZCBpbiBeMC4xMi4wLiAnICtcbiAgICAgICAgICAnVXNlIHByb3BzIGluc3RlYWQuJ1xuICAgICAgICApXG4gICAgICAgIHJldHVyblxuICAgICAgfVxuICAgICAgaWYgKGlkID09PSAnZXZlbnRzJykge1xuICAgICAgICBleHBvcnRzLndhcm4oXG4gICAgICAgICAgJ3YtZXZlbnRzIGhhcyBiZWVuIGRlcHJlY2F0ZWQgaW4gXjAuMTIuMC4gJyArXG4gICAgICAgICAgJ1Bhc3MgZG93biBtZXRob2RzIGFzIGNhbGxiYWNrIHByb3BzIGluc3RlYWQuJ1xuICAgICAgICApXG4gICAgICAgIHJldHVyblxuICAgICAgfVxuICAgIH1cbiAgICBpZiAoIXZhbCkge1xuICAgICAgZXhwb3J0cy53YXJuKCdGYWlsZWQgdG8gcmVzb2x2ZSAnICsgdHlwZSArICc6ICcgKyBpZClcbiAgICB9XG4gIH1cbn1cbiIsInZhciBfID0gcmVxdWlyZSgnLi9pbmRleCcpXG52YXIgY29uZmlnID0gcmVxdWlyZSgnLi4vY29uZmlnJylcblxuLyoqXG4gKiBRdWVyeSBhbiBlbGVtZW50IHNlbGVjdG9yIGlmIGl0J3Mgbm90IGFuIGVsZW1lbnQgYWxyZWFkeS5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ3xFbGVtZW50fSBlbFxuICogQHJldHVybiB7RWxlbWVudH1cbiAqL1xuXG5leHBvcnRzLnF1ZXJ5ID0gZnVuY3Rpb24gKGVsKSB7XG4gIGlmICh0eXBlb2YgZWwgPT09ICdzdHJpbmcnKSB7XG4gICAgdmFyIHNlbGVjdG9yID0gZWxcbiAgICBlbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoZWwpXG4gICAgaWYgKCFlbCkge1xuICAgICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiBfLndhcm4oXG4gICAgICAgICdDYW5ub3QgZmluZCBlbGVtZW50OiAnICsgc2VsZWN0b3JcbiAgICAgIClcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGVsXG59XG5cbi8qKlxuICogQ2hlY2sgaWYgYSBub2RlIGlzIGluIHRoZSBkb2N1bWVudC5cbiAqIE5vdGU6IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jb250YWlucyBzaG91bGQgd29yayBoZXJlXG4gKiBidXQgYWx3YXlzIHJldHVybnMgZmFsc2UgZm9yIGNvbW1lbnQgbm9kZXMgaW4gcGhhbnRvbWpzLFxuICogbWFraW5nIHVuaXQgdGVzdHMgZGlmZmljdWx0LiBUaGlzIGlzIGZpeGVkIGJ5eSBkb2luZyB0aGVcbiAqIGNvbnRhaW5zKCkgY2hlY2sgb24gdGhlIG5vZGUncyBwYXJlbnROb2RlIGluc3RlYWQgb2ZcbiAqIHRoZSBub2RlIGl0c2VsZi5cbiAqXG4gKiBAcGFyYW0ge05vZGV9IG5vZGVcbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKi9cblxuZXhwb3J0cy5pbkRvYyA9IGZ1bmN0aW9uIChub2RlKSB7XG4gIHZhciBkb2MgPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnRcbiAgdmFyIHBhcmVudCA9IG5vZGUgJiYgbm9kZS5wYXJlbnROb2RlXG4gIHJldHVybiBkb2MgPT09IG5vZGUgfHxcbiAgICBkb2MgPT09IHBhcmVudCB8fFxuICAgICEhKHBhcmVudCAmJiBwYXJlbnQubm9kZVR5cGUgPT09IDEgJiYgKGRvYy5jb250YWlucyhwYXJlbnQpKSlcbn1cblxuLyoqXG4gKiBFeHRyYWN0IGFuIGF0dHJpYnV0ZSBmcm9tIGEgbm9kZS5cbiAqXG4gKiBAcGFyYW0ge05vZGV9IG5vZGVcbiAqIEBwYXJhbSB7U3RyaW5nfSBhdHRyXG4gKi9cblxuZXhwb3J0cy5hdHRyID0gZnVuY3Rpb24gKG5vZGUsIGF0dHIpIHtcbiAgYXR0ciA9IGNvbmZpZy5wcmVmaXggKyBhdHRyXG4gIHZhciB2YWwgPSBub2RlLmdldEF0dHJpYnV0ZShhdHRyKVxuICBpZiAodmFsICE9PSBudWxsKSB7XG4gICAgbm9kZS5yZW1vdmVBdHRyaWJ1dGUoYXR0cilcbiAgfVxuICByZXR1cm4gdmFsXG59XG5cbi8qKlxuICogSW5zZXJ0IGVsIGJlZm9yZSB0YXJnZXRcbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IGVsXG4gKiBAcGFyYW0ge0VsZW1lbnR9IHRhcmdldFxuICovXG5cbmV4cG9ydHMuYmVmb3JlID0gZnVuY3Rpb24gKGVsLCB0YXJnZXQpIHtcbiAgdGFyZ2V0LnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKGVsLCB0YXJnZXQpXG59XG5cbi8qKlxuICogSW5zZXJ0IGVsIGFmdGVyIHRhcmdldFxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gZWxcbiAqIEBwYXJhbSB7RWxlbWVudH0gdGFyZ2V0XG4gKi9cblxuZXhwb3J0cy5hZnRlciA9IGZ1bmN0aW9uIChlbCwgdGFyZ2V0KSB7XG4gIGlmICh0YXJnZXQubmV4dFNpYmxpbmcpIHtcbiAgICBleHBvcnRzLmJlZm9yZShlbCwgdGFyZ2V0Lm5leHRTaWJsaW5nKVxuICB9IGVsc2Uge1xuICAgIHRhcmdldC5wYXJlbnROb2RlLmFwcGVuZENoaWxkKGVsKVxuICB9XG59XG5cbi8qKlxuICogUmVtb3ZlIGVsIGZyb20gRE9NXG4gKlxuICogQHBhcmFtIHtFbGVtZW50fSBlbFxuICovXG5cbmV4cG9ydHMucmVtb3ZlID0gZnVuY3Rpb24gKGVsKSB7XG4gIGVsLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoZWwpXG59XG5cbi8qKlxuICogUHJlcGVuZCBlbCB0byB0YXJnZXRcbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IGVsXG4gKiBAcGFyYW0ge0VsZW1lbnR9IHRhcmdldFxuICovXG5cbmV4cG9ydHMucHJlcGVuZCA9IGZ1bmN0aW9uIChlbCwgdGFyZ2V0KSB7XG4gIGlmICh0YXJnZXQuZmlyc3RDaGlsZCkge1xuICAgIGV4cG9ydHMuYmVmb3JlKGVsLCB0YXJnZXQuZmlyc3RDaGlsZClcbiAgfSBlbHNlIHtcbiAgICB0YXJnZXQuYXBwZW5kQ2hpbGQoZWwpXG4gIH1cbn1cblxuLyoqXG4gKiBSZXBsYWNlIHRhcmdldCB3aXRoIGVsXG4gKlxuICogQHBhcmFtIHtFbGVtZW50fSB0YXJnZXRcbiAqIEBwYXJhbSB7RWxlbWVudH0gZWxcbiAqL1xuXG5leHBvcnRzLnJlcGxhY2UgPSBmdW5jdGlvbiAodGFyZ2V0LCBlbCkge1xuICB2YXIgcGFyZW50ID0gdGFyZ2V0LnBhcmVudE5vZGVcbiAgaWYgKHBhcmVudCkge1xuICAgIHBhcmVudC5yZXBsYWNlQ2hpbGQoZWwsIHRhcmdldClcbiAgfVxufVxuXG4vKipcbiAqIEFkZCBldmVudCBsaXN0ZW5lciBzaG9ydGhhbmQuXG4gKlxuICogQHBhcmFtIHtFbGVtZW50fSBlbFxuICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50XG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYlxuICovXG5cbmV4cG9ydHMub24gPSBmdW5jdGlvbiAoZWwsIGV2ZW50LCBjYikge1xuICBlbC5hZGRFdmVudExpc3RlbmVyKGV2ZW50LCBjYilcbn1cblxuLyoqXG4gKiBSZW1vdmUgZXZlbnQgbGlzdGVuZXIgc2hvcnRoYW5kLlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gZWxcbiAqIEBwYXJhbSB7U3RyaW5nfSBldmVudFxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2JcbiAqL1xuXG5leHBvcnRzLm9mZiA9IGZ1bmN0aW9uIChlbCwgZXZlbnQsIGNiKSB7XG4gIGVsLnJlbW92ZUV2ZW50TGlzdGVuZXIoZXZlbnQsIGNiKVxufVxuXG4vKipcbiAqIEFkZCBjbGFzcyB3aXRoIGNvbXBhdGliaWxpdHkgZm9yIElFICYgU1ZHXG4gKlxuICogQHBhcmFtIHtFbGVtZW50fSBlbFxuICogQHBhcmFtIHtTdHJvbmd9IGNsc1xuICovXG5cbmV4cG9ydHMuYWRkQ2xhc3MgPSBmdW5jdGlvbiAoZWwsIGNscykge1xuICBpZiAoZWwuY2xhc3NMaXN0KSB7XG4gICAgZWwuY2xhc3NMaXN0LmFkZChjbHMpXG4gIH0gZWxzZSB7XG4gICAgdmFyIGN1ciA9ICcgJyArIChlbC5nZXRBdHRyaWJ1dGUoJ2NsYXNzJykgfHwgJycpICsgJyAnXG4gICAgaWYgKGN1ci5pbmRleE9mKCcgJyArIGNscyArICcgJykgPCAwKSB7XG4gICAgICBlbC5zZXRBdHRyaWJ1dGUoJ2NsYXNzJywgKGN1ciArIGNscykudHJpbSgpKVxuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIFJlbW92ZSBjbGFzcyB3aXRoIGNvbXBhdGliaWxpdHkgZm9yIElFICYgU1ZHXG4gKlxuICogQHBhcmFtIHtFbGVtZW50fSBlbFxuICogQHBhcmFtIHtTdHJvbmd9IGNsc1xuICovXG5cbmV4cG9ydHMucmVtb3ZlQ2xhc3MgPSBmdW5jdGlvbiAoZWwsIGNscykge1xuICBpZiAoZWwuY2xhc3NMaXN0KSB7XG4gICAgZWwuY2xhc3NMaXN0LnJlbW92ZShjbHMpXG4gIH0gZWxzZSB7XG4gICAgdmFyIGN1ciA9ICcgJyArIChlbC5nZXRBdHRyaWJ1dGUoJ2NsYXNzJykgfHwgJycpICsgJyAnXG4gICAgdmFyIHRhciA9ICcgJyArIGNscyArICcgJ1xuICAgIHdoaWxlIChjdXIuaW5kZXhPZih0YXIpID49IDApIHtcbiAgICAgIGN1ciA9IGN1ci5yZXBsYWNlKHRhciwgJyAnKVxuICAgIH1cbiAgICBlbC5zZXRBdHRyaWJ1dGUoJ2NsYXNzJywgY3VyLnRyaW0oKSlcbiAgfVxufVxuXG4vKipcbiAqIEV4dHJhY3QgcmF3IGNvbnRlbnQgaW5zaWRlIGFuIGVsZW1lbnQgaW50byBhIHRlbXBvcmFyeVxuICogY29udGFpbmVyIGRpdlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gZWxcbiAqIEBwYXJhbSB7Qm9vbGVhbn0gYXNGcmFnbWVudFxuICogQHJldHVybiB7RWxlbWVudH1cbiAqL1xuXG5leHBvcnRzLmV4dHJhY3RDb250ZW50ID0gZnVuY3Rpb24gKGVsLCBhc0ZyYWdtZW50KSB7XG4gIHZhciBjaGlsZFxuICB2YXIgcmF3Q29udGVudFxuICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgaWYgKFxuICAgIGV4cG9ydHMuaXNUZW1wbGF0ZShlbCkgJiZcbiAgICBlbC5jb250ZW50IGluc3RhbmNlb2YgRG9jdW1lbnRGcmFnbWVudFxuICApIHtcbiAgICBlbCA9IGVsLmNvbnRlbnRcbiAgfVxuICBpZiAoZWwuaGFzQ2hpbGROb2RlcygpKSB7XG4gICAgZXhwb3J0cy50cmltTm9kZShlbClcbiAgICByYXdDb250ZW50ID0gYXNGcmFnbWVudFxuICAgICAgPyBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KClcbiAgICAgIDogZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JylcbiAgICAvKiBlc2xpbnQtZGlzYWJsZSBuby1jb25kLWFzc2lnbiAqL1xuICAgIHdoaWxlIChjaGlsZCA9IGVsLmZpcnN0Q2hpbGQpIHtcbiAgICAvKiBlc2xpbnQtZW5hYmxlIG5vLWNvbmQtYXNzaWduICovXG4gICAgICByYXdDb250ZW50LmFwcGVuZENoaWxkKGNoaWxkKVxuICAgIH1cbiAgfVxuICByZXR1cm4gcmF3Q29udGVudFxufVxuXG4vKipcbiAqIFRyaW0gcG9zc2libGUgZW1wdHkgaGVhZC90YWlsIHRleHROb2RlcyBpbnNpZGUgYSBwYXJlbnQuXG4gKlxuICogQHBhcmFtIHtOb2RlfSBub2RlXG4gKi9cblxuZXhwb3J0cy50cmltTm9kZSA9IGZ1bmN0aW9uIChub2RlKSB7XG4gIHRyaW0obm9kZSwgbm9kZS5maXJzdENoaWxkKVxuICB0cmltKG5vZGUsIG5vZGUubGFzdENoaWxkKVxufVxuXG5mdW5jdGlvbiB0cmltIChwYXJlbnQsIG5vZGUpIHtcbiAgaWYgKG5vZGUgJiYgbm9kZS5ub2RlVHlwZSA9PT0gMyAmJiAhbm9kZS5kYXRhLnRyaW0oKSkge1xuICAgIHBhcmVudC5yZW1vdmVDaGlsZChub2RlKVxuICB9XG59XG5cbi8qKlxuICogQ2hlY2sgaWYgYW4gZWxlbWVudCBpcyBhIHRlbXBsYXRlIHRhZy5cbiAqIE5vdGUgaWYgdGhlIHRlbXBsYXRlIGFwcGVhcnMgaW5zaWRlIGFuIFNWRyBpdHMgdGFnTmFtZVxuICogd2lsbCBiZSBpbiBsb3dlcmNhc2UuXG4gKlxuICogQHBhcmFtIHtFbGVtZW50fSBlbFxuICovXG5cbmV4cG9ydHMuaXNUZW1wbGF0ZSA9IGZ1bmN0aW9uIChlbCkge1xuICByZXR1cm4gZWwudGFnTmFtZSAmJlxuICAgIGVsLnRhZ05hbWUudG9Mb3dlckNhc2UoKSA9PT0gJ3RlbXBsYXRlJ1xufVxuXG4vKipcbiAqIENyZWF0ZSBhbiBcImFuY2hvclwiIGZvciBwZXJmb3JtaW5nIGRvbSBpbnNlcnRpb24vcmVtb3ZhbHMuXG4gKiBUaGlzIGlzIHVzZWQgaW4gYSBudW1iZXIgb2Ygc2NlbmFyaW9zOlxuICogLSBmcmFnbWVudCBpbnN0YW5jZVxuICogLSB2LWh0bWxcbiAqIC0gdi1pZlxuICogLSBjb21wb25lbnRcbiAqIC0gcmVwZWF0XG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGNvbnRlbnRcbiAqIEBwYXJhbSB7Qm9vbGVhbn0gcGVyc2lzdCAtIElFIHRyYXNoZXMgZW1wdHkgdGV4dE5vZGVzIG9uXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbG9uZU5vZGUodHJ1ZSksIHNvIGluIGNlcnRhaW5cbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhc2VzIHRoZSBhbmNob3IgbmVlZHMgdG8gYmVcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5vbi1lbXB0eSB0byBiZSBwZXJzaXN0ZWQgaW5cbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRlbXBsYXRlcy5cbiAqIEByZXR1cm4ge0NvbW1lbnR8VGV4dH1cbiAqL1xuXG5leHBvcnRzLmNyZWF0ZUFuY2hvciA9IGZ1bmN0aW9uIChjb250ZW50LCBwZXJzaXN0KSB7XG4gIHJldHVybiBjb25maWcuZGVidWdcbiAgICA/IGRvY3VtZW50LmNyZWF0ZUNvbW1lbnQoY29udGVudClcbiAgICA6IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKHBlcnNpc3QgPyAnICcgOiAnJylcbn1cbiIsIi8vIGNhbiB3ZSB1c2UgX19wcm90b19fP1xuZXhwb3J0cy5oYXNQcm90byA9ICdfX3Byb3RvX18nIGluIHt9XG5cbi8vIEJyb3dzZXIgZW52aXJvbm1lbnQgc25pZmZpbmdcbnZhciBpbkJyb3dzZXIgPSBleHBvcnRzLmluQnJvd3NlciA9XG4gIHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnICYmXG4gIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh3aW5kb3cpICE9PSAnW29iamVjdCBPYmplY3RdJ1xuXG5leHBvcnRzLmlzSUU5ID1cbiAgaW5Ccm93c2VyICYmXG4gIG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKS5pbmRleE9mKCdtc2llIDkuMCcpID4gMFxuXG5leHBvcnRzLmlzQW5kcm9pZCA9XG4gIGluQnJvd3NlciAmJlxuICBuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCkuaW5kZXhPZignYW5kcm9pZCcpID4gMFxuXG4vLyBUcmFuc2l0aW9uIHByb3BlcnR5L2V2ZW50IHNuaWZmaW5nXG5pZiAoaW5Ccm93c2VyICYmICFleHBvcnRzLmlzSUU5KSB7XG4gIHZhciBpc1dlYmtpdFRyYW5zID1cbiAgICB3aW5kb3cub250cmFuc2l0aW9uZW5kID09PSB1bmRlZmluZWQgJiZcbiAgICB3aW5kb3cub253ZWJraXR0cmFuc2l0aW9uZW5kICE9PSB1bmRlZmluZWRcbiAgdmFyIGlzV2Via2l0QW5pbSA9XG4gICAgd2luZG93Lm9uYW5pbWF0aW9uZW5kID09PSB1bmRlZmluZWQgJiZcbiAgICB3aW5kb3cub253ZWJraXRhbmltYXRpb25lbmQgIT09IHVuZGVmaW5lZFxuICBleHBvcnRzLnRyYW5zaXRpb25Qcm9wID0gaXNXZWJraXRUcmFuc1xuICAgID8gJ1dlYmtpdFRyYW5zaXRpb24nXG4gICAgOiAndHJhbnNpdGlvbidcbiAgZXhwb3J0cy50cmFuc2l0aW9uRW5kRXZlbnQgPSBpc1dlYmtpdFRyYW5zXG4gICAgPyAnd2Via2l0VHJhbnNpdGlvbkVuZCdcbiAgICA6ICd0cmFuc2l0aW9uZW5kJ1xuICBleHBvcnRzLmFuaW1hdGlvblByb3AgPSBpc1dlYmtpdEFuaW1cbiAgICA/ICdXZWJraXRBbmltYXRpb24nXG4gICAgOiAnYW5pbWF0aW9uJ1xuICBleHBvcnRzLmFuaW1hdGlvbkVuZEV2ZW50ID0gaXNXZWJraXRBbmltXG4gICAgPyAnd2Via2l0QW5pbWF0aW9uRW5kJ1xuICAgIDogJ2FuaW1hdGlvbmVuZCdcbn1cblxuLyoqXG4gKiBEZWZlciBhIHRhc2sgdG8gZXhlY3V0ZSBpdCBhc3luY2hyb25vdXNseS4gSWRlYWxseSB0aGlzXG4gKiBzaG91bGQgYmUgZXhlY3V0ZWQgYXMgYSBtaWNyb3Rhc2ssIHNvIHdlIGxldmVyYWdlXG4gKiBNdXRhdGlvbk9ic2VydmVyIGlmIGl0J3MgYXZhaWxhYmxlLCBhbmQgZmFsbGJhY2sgdG9cbiAqIHNldFRpbWVvdXQoMCkuXG4gKlxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2JcbiAqIEBwYXJhbSB7T2JqZWN0fSBjdHhcbiAqL1xuXG5leHBvcnRzLm5leHRUaWNrID0gKGZ1bmN0aW9uICgpIHtcbiAgdmFyIGNhbGxiYWNrcyA9IFtdXG4gIHZhciBwZW5kaW5nID0gZmFsc2VcbiAgdmFyIHRpbWVyRnVuY1xuICBmdW5jdGlvbiBuZXh0VGlja0hhbmRsZXIgKCkge1xuICAgIHBlbmRpbmcgPSBmYWxzZVxuICAgIHZhciBjb3BpZXMgPSBjYWxsYmFja3Muc2xpY2UoMClcbiAgICBjYWxsYmFja3MgPSBbXVxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY29waWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb3BpZXNbaV0oKVxuICAgIH1cbiAgfVxuICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgaWYgKHR5cGVvZiBNdXRhdGlvbk9ic2VydmVyICE9PSAndW5kZWZpbmVkJykge1xuICAgIHZhciBjb3VudGVyID0gMVxuICAgIHZhciBvYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKG5leHRUaWNrSGFuZGxlcilcbiAgICB2YXIgdGV4dE5vZGUgPSBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShjb3VudGVyKVxuICAgIG9ic2VydmVyLm9ic2VydmUodGV4dE5vZGUsIHtcbiAgICAgIGNoYXJhY3RlckRhdGE6IHRydWVcbiAgICB9KVxuICAgIHRpbWVyRnVuYyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIGNvdW50ZXIgPSAoY291bnRlciArIDEpICUgMlxuICAgICAgdGV4dE5vZGUuZGF0YSA9IGNvdW50ZXJcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgdGltZXJGdW5jID0gc2V0VGltZW91dFxuICB9XG4gIHJldHVybiBmdW5jdGlvbiAoY2IsIGN0eCkge1xuICAgIHZhciBmdW5jID0gY3R4XG4gICAgICA/IGZ1bmN0aW9uICgpIHsgY2IuY2FsbChjdHgpIH1cbiAgICAgIDogY2JcbiAgICBjYWxsYmFja3MucHVzaChmdW5jKVxuICAgIGlmIChwZW5kaW5nKSByZXR1cm5cbiAgICBwZW5kaW5nID0gdHJ1ZVxuICAgIHRpbWVyRnVuYyhuZXh0VGlja0hhbmRsZXIsIDApXG4gIH1cbn0pKClcbiIsInZhciBsYW5nID0gcmVxdWlyZSgnLi9sYW5nJylcbnZhciBleHRlbmQgPSBsYW5nLmV4dGVuZFxuXG5leHRlbmQoZXhwb3J0cywgbGFuZylcbmV4dGVuZChleHBvcnRzLCByZXF1aXJlKCcuL2VudicpKVxuZXh0ZW5kKGV4cG9ydHMsIHJlcXVpcmUoJy4vZG9tJykpXG5leHRlbmQoZXhwb3J0cywgcmVxdWlyZSgnLi9vcHRpb25zJykpXG5leHRlbmQoZXhwb3J0cywgcmVxdWlyZSgnLi9jb21wb25lbnQnKSlcbmV4dGVuZChleHBvcnRzLCByZXF1aXJlKCcuL2RlYnVnJykpXG4iLCIvKipcbiAqIENoZWNrIGlmIGEgc3RyaW5nIHN0YXJ0cyB3aXRoICQgb3IgX1xuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHJcbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKi9cblxuZXhwb3J0cy5pc1Jlc2VydmVkID0gZnVuY3Rpb24gKHN0cikge1xuICB2YXIgYyA9IChzdHIgKyAnJykuY2hhckNvZGVBdCgwKVxuICByZXR1cm4gYyA9PT0gMHgyNCB8fCBjID09PSAweDVGXG59XG5cbi8qKlxuICogR3VhcmQgdGV4dCBvdXRwdXQsIG1ha2Ugc3VyZSB1bmRlZmluZWQgb3V0cHV0c1xuICogZW1wdHkgc3RyaW5nXG4gKlxuICogQHBhcmFtIHsqfSB2YWx1ZVxuICogQHJldHVybiB7U3RyaW5nfVxuICovXG5cbmV4cG9ydHMudG9TdHJpbmcgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlID09IG51bGxcbiAgICA/ICcnXG4gICAgOiB2YWx1ZS50b1N0cmluZygpXG59XG5cbi8qKlxuICogQ2hlY2sgYW5kIGNvbnZlcnQgcG9zc2libGUgbnVtZXJpYyBzdHJpbmdzIHRvIG51bWJlcnNcbiAqIGJlZm9yZSBzZXR0aW5nIGJhY2sgdG8gZGF0YVxuICpcbiAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAqIEByZXR1cm4geyp8TnVtYmVyfVxuICovXG5cbmV4cG9ydHMudG9OdW1iZXIgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ3N0cmluZycpIHtcbiAgICByZXR1cm4gdmFsdWVcbiAgfSBlbHNlIHtcbiAgICB2YXIgcGFyc2VkID0gTnVtYmVyKHZhbHVlKVxuICAgIHJldHVybiBpc05hTihwYXJzZWQpXG4gICAgICA/IHZhbHVlXG4gICAgICA6IHBhcnNlZFxuICB9XG59XG5cbi8qKlxuICogQ29udmVydCBzdHJpbmcgYm9vbGVhbiBsaXRlcmFscyBpbnRvIHJlYWwgYm9vbGVhbnMuXG4gKlxuICogQHBhcmFtIHsqfSB2YWx1ZVxuICogQHJldHVybiB7KnxCb29sZWFufVxuICovXG5cbmV4cG9ydHMudG9Cb29sZWFuID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSA9PT0gJ3RydWUnXG4gICAgPyB0cnVlXG4gICAgOiB2YWx1ZSA9PT0gJ2ZhbHNlJ1xuICAgICAgPyBmYWxzZVxuICAgICAgOiB2YWx1ZVxufVxuXG4vKipcbiAqIFN0cmlwIHF1b3RlcyBmcm9tIGEgc3RyaW5nXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0clxuICogQHJldHVybiB7U3RyaW5nIHwgZmFsc2V9XG4gKi9cblxuZXhwb3J0cy5zdHJpcFF1b3RlcyA9IGZ1bmN0aW9uIChzdHIpIHtcbiAgdmFyIGEgPSBzdHIuY2hhckNvZGVBdCgwKVxuICB2YXIgYiA9IHN0ci5jaGFyQ29kZUF0KHN0ci5sZW5ndGggLSAxKVxuICByZXR1cm4gYSA9PT0gYiAmJiAoYSA9PT0gMHgyMiB8fCBhID09PSAweDI3KVxuICAgID8gc3RyLnNsaWNlKDEsIC0xKVxuICAgIDogZmFsc2Vcbn1cblxuLyoqXG4gKiBDYW1lbGl6ZSBhIGh5cGhlbi1kZWxtaXRlZCBzdHJpbmcuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0clxuICogQHJldHVybiB7U3RyaW5nfVxuICovXG5cbmV4cG9ydHMuY2FtZWxpemUgPSBmdW5jdGlvbiAoc3RyKSB7XG4gIHJldHVybiBzdHIucmVwbGFjZSgvLShcXHcpL2csIHRvVXBwZXIpXG59XG5cbmZ1bmN0aW9uIHRvVXBwZXIgKF8sIGMpIHtcbiAgcmV0dXJuIGMgPyBjLnRvVXBwZXJDYXNlKCkgOiAnJ1xufVxuXG4vKipcbiAqIEh5cGhlbmF0ZSBhIGNhbWVsQ2FzZSBzdHJpbmcuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0clxuICogQHJldHVybiB7U3RyaW5nfVxuICovXG5cbmV4cG9ydHMuaHlwaGVuYXRlID0gZnVuY3Rpb24gKHN0cikge1xuICByZXR1cm4gc3RyXG4gICAgLnJlcGxhY2UoLyhbYS16XFxkXSkoW0EtWl0pL2csICckMS0kMicpXG4gICAgLnRvTG93ZXJDYXNlKClcbn1cblxuLyoqXG4gKiBDb252ZXJ0cyBoeXBoZW4vdW5kZXJzY29yZS9zbGFzaCBkZWxpbWl0ZXJlZCBuYW1lcyBpbnRvXG4gKiBjYW1lbGl6ZWQgY2xhc3NOYW1lcy5cbiAqXG4gKiBlLmcuIG15LWNvbXBvbmVudCA9PiBNeUNvbXBvbmVudFxuICogICAgICBzb21lX2Vsc2UgICAgPT4gU29tZUVsc2VcbiAqICAgICAgc29tZS9jb21wICAgID0+IFNvbWVDb21wXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0clxuICogQHJldHVybiB7U3RyaW5nfVxuICovXG5cbnZhciBjbGFzc2lmeVJFID0gLyg/Ol58Wy1fXFwvXSkoXFx3KS9nXG5leHBvcnRzLmNsYXNzaWZ5ID0gZnVuY3Rpb24gKHN0cikge1xuICByZXR1cm4gc3RyLnJlcGxhY2UoY2xhc3NpZnlSRSwgdG9VcHBlcilcbn1cblxuLyoqXG4gKiBTaW1wbGUgYmluZCwgZmFzdGVyIHRoYW4gbmF0aXZlXG4gKlxuICogQHBhcmFtIHtGdW5jdGlvbn0gZm5cbiAqIEBwYXJhbSB7T2JqZWN0fSBjdHhcbiAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuICovXG5cbmV4cG9ydHMuYmluZCA9IGZ1bmN0aW9uIChmbiwgY3R4KSB7XG4gIHJldHVybiBmdW5jdGlvbiAoYSkge1xuICAgIHZhciBsID0gYXJndW1lbnRzLmxlbmd0aFxuICAgIHJldHVybiBsXG4gICAgICA/IGwgPiAxXG4gICAgICAgID8gZm4uYXBwbHkoY3R4LCBhcmd1bWVudHMpXG4gICAgICAgIDogZm4uY2FsbChjdHgsIGEpXG4gICAgICA6IGZuLmNhbGwoY3R4KVxuICB9XG59XG5cbi8qKlxuICogQ29udmVydCBhbiBBcnJheS1saWtlIG9iamVjdCB0byBhIHJlYWwgQXJyYXkuXG4gKlxuICogQHBhcmFtIHtBcnJheS1saWtlfSBsaXN0XG4gKiBAcGFyYW0ge051bWJlcn0gW3N0YXJ0XSAtIHN0YXJ0IGluZGV4XG4gKiBAcmV0dXJuIHtBcnJheX1cbiAqL1xuXG5leHBvcnRzLnRvQXJyYXkgPSBmdW5jdGlvbiAobGlzdCwgc3RhcnQpIHtcbiAgc3RhcnQgPSBzdGFydCB8fCAwXG4gIHZhciBpID0gbGlzdC5sZW5ndGggLSBzdGFydFxuICB2YXIgcmV0ID0gbmV3IEFycmF5KGkpXG4gIHdoaWxlIChpLS0pIHtcbiAgICByZXRbaV0gPSBsaXN0W2kgKyBzdGFydF1cbiAgfVxuICByZXR1cm4gcmV0XG59XG5cbi8qKlxuICogTWl4IHByb3BlcnRpZXMgaW50byB0YXJnZXQgb2JqZWN0LlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSB0b1xuICogQHBhcmFtIHtPYmplY3R9IGZyb21cbiAqL1xuXG5leHBvcnRzLmV4dGVuZCA9IGZ1bmN0aW9uICh0bywgZnJvbSkge1xuICBmb3IgKHZhciBrZXkgaW4gZnJvbSkge1xuICAgIHRvW2tleV0gPSBmcm9tW2tleV1cbiAgfVxuICByZXR1cm4gdG9cbn1cblxuLyoqXG4gKiBRdWljayBvYmplY3QgY2hlY2sgLSB0aGlzIGlzIHByaW1hcmlseSB1c2VkIHRvIHRlbGxcbiAqIE9iamVjdHMgZnJvbSBwcmltaXRpdmUgdmFsdWVzIHdoZW4gd2Uga25vdyB0aGUgdmFsdWVcbiAqIGlzIGEgSlNPTi1jb21wbGlhbnQgdHlwZS5cbiAqXG4gKiBAcGFyYW0geyp9IG9ialxuICogQHJldHVybiB7Qm9vbGVhbn1cbiAqL1xuXG5leHBvcnRzLmlzT2JqZWN0ID0gZnVuY3Rpb24gKG9iaikge1xuICByZXR1cm4gb2JqICE9PSBudWxsICYmIHR5cGVvZiBvYmogPT09ICdvYmplY3QnXG59XG5cbi8qKlxuICogU3RyaWN0IG9iamVjdCB0eXBlIGNoZWNrLiBPbmx5IHJldHVybnMgdHJ1ZVxuICogZm9yIHBsYWluIEphdmFTY3JpcHQgb2JqZWN0cy5cbiAqXG4gKiBAcGFyYW0geyp9IG9ialxuICogQHJldHVybiB7Qm9vbGVhbn1cbiAqL1xuXG52YXIgdG9TdHJpbmcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nXG52YXIgT0JKRUNUX1NUUklORyA9ICdbb2JqZWN0IE9iamVjdF0nXG5leHBvcnRzLmlzUGxhaW5PYmplY3QgPSBmdW5jdGlvbiAob2JqKSB7XG4gIHJldHVybiB0b1N0cmluZy5jYWxsKG9iaikgPT09IE9CSkVDVF9TVFJJTkdcbn1cblxuLyoqXG4gKiBBcnJheSB0eXBlIGNoZWNrLlxuICpcbiAqIEBwYXJhbSB7Kn0gb2JqXG4gKiBAcmV0dXJuIHtCb29sZWFufVxuICovXG5cbmV4cG9ydHMuaXNBcnJheSA9IEFycmF5LmlzQXJyYXlcblxuLyoqXG4gKiBEZWZpbmUgYSBub24tZW51bWVyYWJsZSBwcm9wZXJ0eVxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmpcbiAqIEBwYXJhbSB7U3RyaW5nfSBrZXlcbiAqIEBwYXJhbSB7Kn0gdmFsXG4gKiBAcGFyYW0ge0Jvb2xlYW59IFtlbnVtZXJhYmxlXVxuICovXG5cbmV4cG9ydHMuZGVmaW5lID0gZnVuY3Rpb24gKG9iaiwga2V5LCB2YWwsIGVudW1lcmFibGUpIHtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iaiwga2V5LCB7XG4gICAgdmFsdWU6IHZhbCxcbiAgICBlbnVtZXJhYmxlOiAhIWVudW1lcmFibGUsXG4gICAgd3JpdGFibGU6IHRydWUsXG4gICAgY29uZmlndXJhYmxlOiB0cnVlXG4gIH0pXG59XG5cbi8qKlxuICogRGVib3VuY2UgYSBmdW5jdGlvbiBzbyBpdCBvbmx5IGdldHMgY2FsbGVkIGFmdGVyIHRoZVxuICogaW5wdXQgc3RvcHMgYXJyaXZpbmcgYWZ0ZXIgdGhlIGdpdmVuIHdhaXQgcGVyaW9kLlxuICpcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmNcbiAqIEBwYXJhbSB7TnVtYmVyfSB3YWl0XG4gKiBAcmV0dXJuIHtGdW5jdGlvbn0gLSB0aGUgZGVib3VuY2VkIGZ1bmN0aW9uXG4gKi9cblxuZXhwb3J0cy5kZWJvdW5jZSA9IGZ1bmN0aW9uIChmdW5jLCB3YWl0KSB7XG4gIHZhciB0aW1lb3V0LCBhcmdzLCBjb250ZXh0LCB0aW1lc3RhbXAsIHJlc3VsdFxuICB2YXIgbGF0ZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGxhc3QgPSBEYXRlLm5vdygpIC0gdGltZXN0YW1wXG4gICAgaWYgKGxhc3QgPCB3YWl0ICYmIGxhc3QgPj0gMCkge1xuICAgICAgdGltZW91dCA9IHNldFRpbWVvdXQobGF0ZXIsIHdhaXQgLSBsYXN0KVxuICAgIH0gZWxzZSB7XG4gICAgICB0aW1lb3V0ID0gbnVsbFxuICAgICAgcmVzdWx0ID0gZnVuYy5hcHBseShjb250ZXh0LCBhcmdzKVxuICAgICAgaWYgKCF0aW1lb3V0KSBjb250ZXh0ID0gYXJncyA9IG51bGxcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICBjb250ZXh0ID0gdGhpc1xuICAgIGFyZ3MgPSBhcmd1bWVudHNcbiAgICB0aW1lc3RhbXAgPSBEYXRlLm5vdygpXG4gICAgaWYgKCF0aW1lb3V0KSB7XG4gICAgICB0aW1lb3V0ID0gc2V0VGltZW91dChsYXRlciwgd2FpdClcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdFxuICB9XG59XG5cbi8qKlxuICogTWFudWFsIGluZGV4T2YgYmVjYXVzZSBpdCdzIHNsaWdodGx5IGZhc3RlciB0aGFuXG4gKiBuYXRpdmUuXG4gKlxuICogQHBhcmFtIHtBcnJheX0gYXJyXG4gKiBAcGFyYW0geyp9IG9ialxuICovXG5cbmV4cG9ydHMuaW5kZXhPZiA9IGZ1bmN0aW9uIChhcnIsIG9iaikge1xuICB2YXIgaSA9IGFyci5sZW5ndGhcbiAgd2hpbGUgKGktLSkge1xuICAgIGlmIChhcnJbaV0gPT09IG9iaikgcmV0dXJuIGlcbiAgfVxuICByZXR1cm4gLTFcbn1cblxuLyoqXG4gKiBNYWtlIGEgY2FuY2VsbGFibGUgdmVyc2lvbiBvZiBhbiBhc3luYyBjYWxsYmFjay5cbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmblxuICogQHJldHVybiB7RnVuY3Rpb259XG4gKi9cblxuZXhwb3J0cy5jYW5jZWxsYWJsZSA9IGZ1bmN0aW9uIChmbikge1xuICB2YXIgY2IgPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKCFjYi5jYW5jZWxsZWQpIHtcbiAgICAgIHJldHVybiBmbi5hcHBseSh0aGlzLCBhcmd1bWVudHMpXG4gICAgfVxuICB9XG4gIGNiLmNhbmNlbCA9IGZ1bmN0aW9uICgpIHtcbiAgICBjYi5jYW5jZWxsZWQgPSB0cnVlXG4gIH1cbiAgcmV0dXJuIGNiXG59XG5cbi8qKlxuICogQ2hlY2sgaWYgdHdvIHZhbHVlcyBhcmUgbG9vc2VseSBlcXVhbCAtIHRoYXQgaXMsXG4gKiBpZiB0aGV5IGFyZSBwbGFpbiBvYmplY3RzLCBkbyB0aGV5IGhhdmUgdGhlIHNhbWUgc2hhcGU/XG4gKlxuICogQHBhcmFtIHsqfSBhXG4gKiBAcGFyYW0geyp9IGJcbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKi9cblxuZXhwb3J0cy5sb29zZUVxdWFsID0gZnVuY3Rpb24gKGEsIGIpIHtcbiAgLyogZXNsaW50LWRpc2FibGUgZXFlcWVxICovXG4gIHJldHVybiBhID09IGIgfHwgKFxuICAgIGV4cG9ydHMuaXNPYmplY3QoYSkgJiYgZXhwb3J0cy5pc09iamVjdChiKVxuICAgICAgPyBKU09OLnN0cmluZ2lmeShhKSA9PT0gSlNPTi5zdHJpbmdpZnkoYilcbiAgICAgIDogZmFsc2VcbiAgKVxuICAvKiBlc2xpbnQtZW5hYmxlIGVxZXFlcSAqL1xufVxuIiwidmFyIF8gPSByZXF1aXJlKCcuL2luZGV4JylcbnZhciBjb25maWcgPSByZXF1aXJlKCcuLi9jb25maWcnKVxudmFyIGV4dGVuZCA9IF8uZXh0ZW5kXG5cbi8qKlxuICogT3B0aW9uIG92ZXJ3cml0aW5nIHN0cmF0ZWdpZXMgYXJlIGZ1bmN0aW9ucyB0aGF0IGhhbmRsZVxuICogaG93IHRvIG1lcmdlIGEgcGFyZW50IG9wdGlvbiB2YWx1ZSBhbmQgYSBjaGlsZCBvcHRpb25cbiAqIHZhbHVlIGludG8gdGhlIGZpbmFsIHZhbHVlLlxuICpcbiAqIEFsbCBzdHJhdGVneSBmdW5jdGlvbnMgZm9sbG93IHRoZSBzYW1lIHNpZ25hdHVyZTpcbiAqXG4gKiBAcGFyYW0geyp9IHBhcmVudFZhbFxuICogQHBhcmFtIHsqfSBjaGlsZFZhbFxuICogQHBhcmFtIHtWdWV9IFt2bV1cbiAqL1xuXG52YXIgc3RyYXRzID0gT2JqZWN0LmNyZWF0ZShudWxsKVxuXG4vKipcbiAqIEhlbHBlciB0aGF0IHJlY3Vyc2l2ZWx5IG1lcmdlcyB0d28gZGF0YSBvYmplY3RzIHRvZ2V0aGVyLlxuICovXG5cbmZ1bmN0aW9uIG1lcmdlRGF0YSAodG8sIGZyb20pIHtcbiAgdmFyIGtleSwgdG9WYWwsIGZyb21WYWxcbiAgZm9yIChrZXkgaW4gZnJvbSkge1xuICAgIHRvVmFsID0gdG9ba2V5XVxuICAgIGZyb21WYWwgPSBmcm9tW2tleV1cbiAgICBpZiAoIXRvLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgIHRvLiRhZGQoa2V5LCBmcm9tVmFsKVxuICAgIH0gZWxzZSBpZiAoXy5pc09iamVjdCh0b1ZhbCkgJiYgXy5pc09iamVjdChmcm9tVmFsKSkge1xuICAgICAgbWVyZ2VEYXRhKHRvVmFsLCBmcm9tVmFsKVxuICAgIH1cbiAgfVxuICByZXR1cm4gdG9cbn1cblxuLyoqXG4gKiBEYXRhXG4gKi9cblxuc3RyYXRzLmRhdGEgPSBmdW5jdGlvbiAocGFyZW50VmFsLCBjaGlsZFZhbCwgdm0pIHtcbiAgaWYgKCF2bSkge1xuICAgIC8vIGluIGEgVnVlLmV4dGVuZCBtZXJnZSwgYm90aCBzaG91bGQgYmUgZnVuY3Rpb25zXG4gICAgaWYgKCFjaGlsZFZhbCkge1xuICAgICAgcmV0dXJuIHBhcmVudFZhbFxuICAgIH1cbiAgICBpZiAodHlwZW9mIGNoaWxkVmFsICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nICYmIF8ud2FybihcbiAgICAgICAgJ1RoZSBcImRhdGFcIiBvcHRpb24gc2hvdWxkIGJlIGEgZnVuY3Rpb24gJyArXG4gICAgICAgICd0aGF0IHJldHVybnMgYSBwZXItaW5zdGFuY2UgdmFsdWUgaW4gY29tcG9uZW50ICcgK1xuICAgICAgICAnZGVmaW5pdGlvbnMuJ1xuICAgICAgKVxuICAgICAgcmV0dXJuIHBhcmVudFZhbFxuICAgIH1cbiAgICBpZiAoIXBhcmVudFZhbCkge1xuICAgICAgcmV0dXJuIGNoaWxkVmFsXG4gICAgfVxuICAgIC8vIHdoZW4gcGFyZW50VmFsICYgY2hpbGRWYWwgYXJlIGJvdGggcHJlc2VudCxcbiAgICAvLyB3ZSBuZWVkIHRvIHJldHVybiBhIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyB0aGVcbiAgICAvLyBtZXJnZWQgcmVzdWx0IG9mIGJvdGggZnVuY3Rpb25zLi4uIG5vIG5lZWQgdG9cbiAgICAvLyBjaGVjayBpZiBwYXJlbnRWYWwgaXMgYSBmdW5jdGlvbiBoZXJlIGJlY2F1c2VcbiAgICAvLyBpdCBoYXMgdG8gYmUgYSBmdW5jdGlvbiB0byBwYXNzIHByZXZpb3VzIG1lcmdlcy5cbiAgICByZXR1cm4gZnVuY3Rpb24gbWVyZ2VkRGF0YUZuICgpIHtcbiAgICAgIHJldHVybiBtZXJnZURhdGEoXG4gICAgICAgIGNoaWxkVmFsLmNhbGwodGhpcyksXG4gICAgICAgIHBhcmVudFZhbC5jYWxsKHRoaXMpXG4gICAgICApXG4gICAgfVxuICB9IGVsc2UgaWYgKHBhcmVudFZhbCB8fCBjaGlsZFZhbCkge1xuICAgIHJldHVybiBmdW5jdGlvbiBtZXJnZWRJbnN0YW5jZURhdGFGbiAoKSB7XG4gICAgICAvLyBpbnN0YW5jZSBtZXJnZVxuICAgICAgdmFyIGluc3RhbmNlRGF0YSA9IHR5cGVvZiBjaGlsZFZhbCA9PT0gJ2Z1bmN0aW9uJ1xuICAgICAgICA/IGNoaWxkVmFsLmNhbGwodm0pXG4gICAgICAgIDogY2hpbGRWYWxcbiAgICAgIHZhciBkZWZhdWx0RGF0YSA9IHR5cGVvZiBwYXJlbnRWYWwgPT09ICdmdW5jdGlvbidcbiAgICAgICAgPyBwYXJlbnRWYWwuY2FsbCh2bSlcbiAgICAgICAgOiB1bmRlZmluZWRcbiAgICAgIGlmIChpbnN0YW5jZURhdGEpIHtcbiAgICAgICAgcmV0dXJuIG1lcmdlRGF0YShpbnN0YW5jZURhdGEsIGRlZmF1bHREYXRhKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGRlZmF1bHREYXRhXG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogRWxcbiAqL1xuXG5zdHJhdHMuZWwgPSBmdW5jdGlvbiAocGFyZW50VmFsLCBjaGlsZFZhbCwgdm0pIHtcbiAgaWYgKCF2bSAmJiBjaGlsZFZhbCAmJiB0eXBlb2YgY2hpbGRWYWwgIT09ICdmdW5jdGlvbicpIHtcbiAgICBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nICYmIF8ud2FybihcbiAgICAgICdUaGUgXCJlbFwiIG9wdGlvbiBzaG91bGQgYmUgYSBmdW5jdGlvbiAnICtcbiAgICAgICd0aGF0IHJldHVybnMgYSBwZXItaW5zdGFuY2UgdmFsdWUgaW4gY29tcG9uZW50ICcgK1xuICAgICAgJ2RlZmluaXRpb25zLidcbiAgICApXG4gICAgcmV0dXJuXG4gIH1cbiAgdmFyIHJldCA9IGNoaWxkVmFsIHx8IHBhcmVudFZhbFxuICAvLyBpbnZva2UgdGhlIGVsZW1lbnQgZmFjdG9yeSBpZiB0aGlzIGlzIGluc3RhbmNlIG1lcmdlXG4gIHJldHVybiB2bSAmJiB0eXBlb2YgcmV0ID09PSAnZnVuY3Rpb24nXG4gICAgPyByZXQuY2FsbCh2bSlcbiAgICA6IHJldFxufVxuXG4vKipcbiAqIEhvb2tzIGFuZCBwYXJhbSBhdHRyaWJ1dGVzIGFyZSBtZXJnZWQgYXMgYXJyYXlzLlxuICovXG5cbnN0cmF0cy5jcmVhdGVkID1cbnN0cmF0cy5yZWFkeSA9XG5zdHJhdHMuYXR0YWNoZWQgPVxuc3RyYXRzLmRldGFjaGVkID1cbnN0cmF0cy5iZWZvcmVDb21waWxlID1cbnN0cmF0cy5jb21waWxlZCA9XG5zdHJhdHMuYmVmb3JlRGVzdHJveSA9XG5zdHJhdHMuZGVzdHJveWVkID1cbnN0cmF0cy5wcm9wcyA9IGZ1bmN0aW9uIChwYXJlbnRWYWwsIGNoaWxkVmFsKSB7XG4gIHJldHVybiBjaGlsZFZhbFxuICAgID8gcGFyZW50VmFsXG4gICAgICA/IHBhcmVudFZhbC5jb25jYXQoY2hpbGRWYWwpXG4gICAgICA6IF8uaXNBcnJheShjaGlsZFZhbClcbiAgICAgICAgPyBjaGlsZFZhbFxuICAgICAgICA6IFtjaGlsZFZhbF1cbiAgICA6IHBhcmVudFZhbFxufVxuXG4vKipcbiAqIDAuMTEgZGVwcmVjYXRpb24gd2FybmluZ1xuICovXG5cbnN0cmF0cy5wYXJhbUF0dHJpYnV0ZXMgPSBmdW5jdGlvbiAoKSB7XG4gIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG4gIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgJiYgXy53YXJuKFxuICAgICdcInBhcmFtQXR0cmlidXRlc1wiIG9wdGlvbiBoYXMgYmVlbiBkZXByZWNhdGVkIGluIDAuMTIuICcgK1xuICAgICdVc2UgXCJwcm9wc1wiIGluc3RlYWQuJ1xuICApXG59XG5cbi8qKlxuICogQXNzZXRzXG4gKlxuICogV2hlbiBhIHZtIGlzIHByZXNlbnQgKGluc3RhbmNlIGNyZWF0aW9uKSwgd2UgbmVlZCB0byBkb1xuICogYSB0aHJlZS13YXkgbWVyZ2UgYmV0d2VlbiBjb25zdHJ1Y3RvciBvcHRpb25zLCBpbnN0YW5jZVxuICogb3B0aW9ucyBhbmQgcGFyZW50IG9wdGlvbnMuXG4gKi9cblxuZnVuY3Rpb24gbWVyZ2VBc3NldHMgKHBhcmVudFZhbCwgY2hpbGRWYWwpIHtcbiAgdmFyIHJlcyA9IE9iamVjdC5jcmVhdGUocGFyZW50VmFsKVxuICByZXR1cm4gY2hpbGRWYWxcbiAgICA/IGV4dGVuZChyZXMsIGd1YXJkQXJyYXlBc3NldHMoY2hpbGRWYWwpKVxuICAgIDogcmVzXG59XG5cbmNvbmZpZy5fYXNzZXRUeXBlcy5mb3JFYWNoKGZ1bmN0aW9uICh0eXBlKSB7XG4gIHN0cmF0c1t0eXBlICsgJ3MnXSA9IG1lcmdlQXNzZXRzXG59KVxuXG4vKipcbiAqIEV2ZW50cyAmIFdhdGNoZXJzLlxuICpcbiAqIEV2ZW50cyAmIHdhdGNoZXJzIGhhc2hlcyBzaG91bGQgbm90IG92ZXJ3cml0ZSBvbmVcbiAqIGFub3RoZXIsIHNvIHdlIG1lcmdlIHRoZW0gYXMgYXJyYXlzLlxuICovXG5cbnN0cmF0cy53YXRjaCA9XG5zdHJhdHMuZXZlbnRzID0gZnVuY3Rpb24gKHBhcmVudFZhbCwgY2hpbGRWYWwpIHtcbiAgaWYgKCFjaGlsZFZhbCkgcmV0dXJuIHBhcmVudFZhbFxuICBpZiAoIXBhcmVudFZhbCkgcmV0dXJuIGNoaWxkVmFsXG4gIHZhciByZXQgPSB7fVxuICBleHRlbmQocmV0LCBwYXJlbnRWYWwpXG4gIGZvciAodmFyIGtleSBpbiBjaGlsZFZhbCkge1xuICAgIHZhciBwYXJlbnQgPSByZXRba2V5XVxuICAgIHZhciBjaGlsZCA9IGNoaWxkVmFsW2tleV1cbiAgICBpZiAocGFyZW50ICYmICFfLmlzQXJyYXkocGFyZW50KSkge1xuICAgICAgcGFyZW50ID0gW3BhcmVudF1cbiAgICB9XG4gICAgcmV0W2tleV0gPSBwYXJlbnRcbiAgICAgID8gcGFyZW50LmNvbmNhdChjaGlsZClcbiAgICAgIDogW2NoaWxkXVxuICB9XG4gIHJldHVybiByZXRcbn1cblxuLyoqXG4gKiBPdGhlciBvYmplY3QgaGFzaGVzLlxuICovXG5cbnN0cmF0cy5tZXRob2RzID1cbnN0cmF0cy5jb21wdXRlZCA9IGZ1bmN0aW9uIChwYXJlbnRWYWwsIGNoaWxkVmFsKSB7XG4gIGlmICghY2hpbGRWYWwpIHJldHVybiBwYXJlbnRWYWxcbiAgaWYgKCFwYXJlbnRWYWwpIHJldHVybiBjaGlsZFZhbFxuICB2YXIgcmV0ID0gT2JqZWN0LmNyZWF0ZShwYXJlbnRWYWwpXG4gIGV4dGVuZChyZXQsIGNoaWxkVmFsKVxuICByZXR1cm4gcmV0XG59XG5cbi8qKlxuICogRGVmYXVsdCBzdHJhdGVneS5cbiAqL1xuXG52YXIgZGVmYXVsdFN0cmF0ID0gZnVuY3Rpb24gKHBhcmVudFZhbCwgY2hpbGRWYWwpIHtcbiAgcmV0dXJuIGNoaWxkVmFsID09PSB1bmRlZmluZWRcbiAgICA/IHBhcmVudFZhbFxuICAgIDogY2hpbGRWYWxcbn1cblxuLyoqXG4gKiBNYWtlIHN1cmUgY29tcG9uZW50IG9wdGlvbnMgZ2V0IGNvbnZlcnRlZCB0byBhY3R1YWxcbiAqIGNvbnN0cnVjdG9ycy5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICovXG5cbmZ1bmN0aW9uIGd1YXJkQ29tcG9uZW50cyAob3B0aW9ucykge1xuICBpZiAob3B0aW9ucy5jb21wb25lbnRzKSB7XG4gICAgdmFyIGNvbXBvbmVudHMgPSBvcHRpb25zLmNvbXBvbmVudHMgPVxuICAgICAgZ3VhcmRBcnJheUFzc2V0cyhvcHRpb25zLmNvbXBvbmVudHMpXG4gICAgdmFyIGRlZlxuICAgIHZhciBpZHMgPSBPYmplY3Qua2V5cyhjb21wb25lbnRzKVxuICAgIGZvciAodmFyIGkgPSAwLCBsID0gaWRzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgdmFyIGtleSA9IGlkc1tpXVxuICAgICAgaWYgKF8uY29tbW9uVGFnUkUudGVzdChrZXkpKSB7XG4gICAgICAgIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgJiYgXy53YXJuKFxuICAgICAgICAgICdEbyBub3QgdXNlIGJ1aWx0LWluIEhUTUwgZWxlbWVudHMgYXMgY29tcG9uZW50ICcgK1xuICAgICAgICAgICdpZDogJyArIGtleVxuICAgICAgICApXG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG4gICAgICBkZWYgPSBjb21wb25lbnRzW2tleV1cbiAgICAgIGlmIChfLmlzUGxhaW5PYmplY3QoZGVmKSkge1xuICAgICAgICBkZWYuaWQgPSBkZWYuaWQgfHwga2V5XG4gICAgICAgIGNvbXBvbmVudHNba2V5XSA9IGRlZi5fQ3RvciB8fCAoZGVmLl9DdG9yID0gXy5WdWUuZXh0ZW5kKGRlZikpXG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogRW5zdXJlIGFsbCBwcm9wcyBvcHRpb24gc3ludGF4IGFyZSBub3JtYWxpemVkIGludG8gdGhlXG4gKiBPYmplY3QtYmFzZWQgZm9ybWF0LlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKi9cblxuZnVuY3Rpb24gZ3VhcmRQcm9wcyAob3B0aW9ucykge1xuICB2YXIgcHJvcHMgPSBvcHRpb25zLnByb3BzXG4gIGlmIChfLmlzUGxhaW5PYmplY3QocHJvcHMpKSB7XG4gICAgb3B0aW9ucy5wcm9wcyA9IE9iamVjdC5rZXlzKHByb3BzKS5tYXAoZnVuY3Rpb24gKGtleSkge1xuICAgICAgdmFyIHZhbCA9IHByb3BzW2tleV1cbiAgICAgIGlmICghXy5pc1BsYWluT2JqZWN0KHZhbCkpIHtcbiAgICAgICAgdmFsID0geyB0eXBlOiB2YWwgfVxuICAgICAgfVxuICAgICAgdmFsLm5hbWUgPSBrZXlcbiAgICAgIHJldHVybiB2YWxcbiAgICB9KVxuICB9IGVsc2UgaWYgKF8uaXNBcnJheShwcm9wcykpIHtcbiAgICBvcHRpb25zLnByb3BzID0gcHJvcHMubWFwKGZ1bmN0aW9uIChwcm9wKSB7XG4gICAgICByZXR1cm4gdHlwZW9mIHByb3AgPT09ICdzdHJpbmcnXG4gICAgICAgID8geyBuYW1lOiBwcm9wIH1cbiAgICAgICAgOiBwcm9wXG4gICAgfSlcbiAgfVxufVxuXG4vKipcbiAqIEd1YXJkIGFuIEFycmF5LWZvcm1hdCBhc3NldHMgb3B0aW9uIGFuZCBjb252ZXJ0ZWQgaXRcbiAqIGludG8gdGhlIGtleS12YWx1ZSBPYmplY3QgZm9ybWF0LlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fEFycmF5fSBhc3NldHNcbiAqIEByZXR1cm4ge09iamVjdH1cbiAqL1xuXG5mdW5jdGlvbiBndWFyZEFycmF5QXNzZXRzIChhc3NldHMpIHtcbiAgaWYgKF8uaXNBcnJheShhc3NldHMpKSB7XG4gICAgdmFyIHJlcyA9IHt9XG4gICAgdmFyIGkgPSBhc3NldHMubGVuZ3RoXG4gICAgdmFyIGFzc2V0XG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgYXNzZXQgPSBhc3NldHNbaV1cbiAgICAgIHZhciBpZCA9IGFzc2V0LmlkIHx8IChhc3NldC5vcHRpb25zICYmIGFzc2V0Lm9wdGlvbnMuaWQpXG4gICAgICBpZiAoIWlkKSB7XG4gICAgICAgIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgJiYgXy53YXJuKFxuICAgICAgICAgICdBcnJheS1zeW50YXggYXNzZXRzIG11c3QgcHJvdmlkZSBhbiBpZCBmaWVsZC4nXG4gICAgICAgIClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc1tpZF0gPSBhc3NldFxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcmVzXG4gIH1cbiAgcmV0dXJuIGFzc2V0c1xufVxuXG4vKipcbiAqIE1lcmdlIHR3byBvcHRpb24gb2JqZWN0cyBpbnRvIGEgbmV3IG9uZS5cbiAqIENvcmUgdXRpbGl0eSB1c2VkIGluIGJvdGggaW5zdGFudGlhdGlvbiBhbmQgaW5oZXJpdGFuY2UuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHBhcmVudFxuICogQHBhcmFtIHtPYmplY3R9IGNoaWxkXG4gKiBAcGFyYW0ge1Z1ZX0gW3ZtXSAtIGlmIHZtIGlzIHByZXNlbnQsIGluZGljYXRlcyB0aGlzIGlzXG4gKiAgICAgICAgICAgICAgICAgICAgIGFuIGluc3RhbnRpYXRpb24gbWVyZ2UuXG4gKi9cblxuZXhwb3J0cy5tZXJnZU9wdGlvbnMgPSBmdW5jdGlvbiBtZXJnZSAocGFyZW50LCBjaGlsZCwgdm0pIHtcbiAgZ3VhcmRDb21wb25lbnRzKGNoaWxkKVxuICBndWFyZFByb3BzKGNoaWxkKVxuICB2YXIgb3B0aW9ucyA9IHt9XG4gIHZhciBrZXlcbiAgaWYgKGNoaWxkLm1peGlucykge1xuICAgIGZvciAodmFyIGkgPSAwLCBsID0gY2hpbGQubWl4aW5zLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgcGFyZW50ID0gbWVyZ2UocGFyZW50LCBjaGlsZC5taXhpbnNbaV0sIHZtKVxuICAgIH1cbiAgfVxuICBmb3IgKGtleSBpbiBwYXJlbnQpIHtcbiAgICBtZXJnZUZpZWxkKGtleSlcbiAgfVxuICBmb3IgKGtleSBpbiBjaGlsZCkge1xuICAgIGlmICghKHBhcmVudC5oYXNPd25Qcm9wZXJ0eShrZXkpKSkge1xuICAgICAgbWVyZ2VGaWVsZChrZXkpXG4gICAgfVxuICB9XG4gIGZ1bmN0aW9uIG1lcmdlRmllbGQgKGtleSkge1xuICAgIHZhciBzdHJhdCA9IHN0cmF0c1trZXldIHx8IGRlZmF1bHRTdHJhdFxuICAgIG9wdGlvbnNba2V5XSA9IHN0cmF0KHBhcmVudFtrZXldLCBjaGlsZFtrZXldLCB2bSwga2V5KVxuICB9XG4gIHJldHVybiBvcHRpb25zXG59XG5cbi8qKlxuICogUmVzb2x2ZSBhbiBhc3NldC5cbiAqIFRoaXMgZnVuY3Rpb24gaXMgdXNlZCBiZWNhdXNlIGNoaWxkIGluc3RhbmNlcyBuZWVkIGFjY2Vzc1xuICogdG8gYXNzZXRzIGRlZmluZWQgaW4gaXRzIGFuY2VzdG9yIGNoYWluLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKiBAcGFyYW0ge1N0cmluZ30gdHlwZVxuICogQHBhcmFtIHtTdHJpbmd9IGlkXG4gKiBAcmV0dXJuIHtPYmplY3R8RnVuY3Rpb259XG4gKi9cblxuZXhwb3J0cy5yZXNvbHZlQXNzZXQgPSBmdW5jdGlvbiByZXNvbHZlIChvcHRpb25zLCB0eXBlLCBpZCkge1xuICB2YXIgY2FtZWxpemVkSWQgPSBfLmNhbWVsaXplKGlkKVxuICB2YXIgcGFzY2FsaXplZElkID0gY2FtZWxpemVkSWQuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBjYW1lbGl6ZWRJZC5zbGljZSgxKVxuICB2YXIgYXNzZXRzID0gb3B0aW9uc1t0eXBlXVxuICB2YXIgYXNzZXQgPSBhc3NldHNbaWRdIHx8IGFzc2V0c1tjYW1lbGl6ZWRJZF0gfHwgYXNzZXRzW3Bhc2NhbGl6ZWRJZF1cbiAgd2hpbGUgKFxuICAgICFhc3NldCAmJlxuICAgIG9wdGlvbnMuX3BhcmVudCAmJlxuICAgICghY29uZmlnLnN0cmljdCB8fCBvcHRpb25zLl9yZXBlYXQpXG4gICkge1xuICAgIG9wdGlvbnMgPSAob3B0aW9ucy5fY29udGV4dCB8fCBvcHRpb25zLl9wYXJlbnQpLiRvcHRpb25zXG4gICAgYXNzZXRzID0gb3B0aW9uc1t0eXBlXVxuICAgIGFzc2V0ID0gYXNzZXRzW2lkXSB8fCBhc3NldHNbY2FtZWxpemVkSWRdIHx8IGFzc2V0c1twYXNjYWxpemVkSWRdXG4gIH1cbiAgcmV0dXJuIGFzc2V0XG59XG4iLCJ2YXIgXyA9IHJlcXVpcmUoJy4vdXRpbCcpXG52YXIgZXh0ZW5kID0gXy5leHRlbmRcblxuLyoqXG4gKiBUaGUgZXhwb3NlZCBWdWUgY29uc3RydWN0b3IuXG4gKlxuICogQVBJIGNvbnZlbnRpb25zOlxuICogLSBwdWJsaWMgQVBJIG1ldGhvZHMvcHJvcGVydGllcyBhcmUgcHJlZmlleGVkIHdpdGggYCRgXG4gKiAtIGludGVybmFsIG1ldGhvZHMvcHJvcGVydGllcyBhcmUgcHJlZml4ZWQgd2l0aCBgX2BcbiAqIC0gbm9uLXByZWZpeGVkIHByb3BlcnRpZXMgYXJlIGFzc3VtZWQgdG8gYmUgcHJveGllZCB1c2VyXG4gKiAgIGRhdGEuXG4gKlxuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdXG4gKiBAcHVibGljXG4gKi9cblxuZnVuY3Rpb24gVnVlIChvcHRpb25zKSB7XG4gIHRoaXMuX2luaXQob3B0aW9ucylcbn1cblxuLyoqXG4gKiBNaXhpbiBnbG9iYWwgQVBJXG4gKi9cblxuZXh0ZW5kKFZ1ZSwgcmVxdWlyZSgnLi9hcGkvZ2xvYmFsJykpXG5cbi8qKlxuICogVnVlIGFuZCBldmVyeSBjb25zdHJ1Y3RvciB0aGF0IGV4dGVuZHMgVnVlIGhhcyBhblxuICogYXNzb2NpYXRlZCBvcHRpb25zIG9iamVjdCwgd2hpY2ggY2FuIGJlIGFjY2Vzc2VkIGR1cmluZ1xuICogY29tcGlsYXRpb24gc3RlcHMgYXMgYHRoaXMuY29uc3RydWN0b3Iub3B0aW9uc2AuXG4gKlxuICogVGhlc2UgY2FuIGJlIHNlZW4gYXMgdGhlIGRlZmF1bHQgb3B0aW9ucyBvZiBldmVyeVxuICogVnVlIGluc3RhbmNlLlxuICovXG5cblZ1ZS5vcHRpb25zID0ge1xuICByZXBsYWNlOiB0cnVlLFxuICBkaXJlY3RpdmVzOiByZXF1aXJlKCcuL2RpcmVjdGl2ZXMnKSxcbiAgZWxlbWVudERpcmVjdGl2ZXM6IHJlcXVpcmUoJy4vZWxlbWVudC1kaXJlY3RpdmVzJyksXG4gIGZpbHRlcnM6IHJlcXVpcmUoJy4vZmlsdGVycycpLFxuICB0cmFuc2l0aW9uczoge30sXG4gIGNvbXBvbmVudHM6IHt9LFxuICBwYXJ0aWFsczoge31cbn1cblxuLyoqXG4gKiBCdWlsZCB1cCB0aGUgcHJvdG90eXBlXG4gKi9cblxudmFyIHAgPSBWdWUucHJvdG90eXBlXG5cbi8qKlxuICogJGRhdGEgaGFzIGEgc2V0dGVyIHdoaWNoIGRvZXMgYSBidW5jaCBvZlxuICogdGVhcmRvd24vc2V0dXAgd29ya1xuICovXG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShwLCAnJGRhdGEnLCB7XG4gIGdldDogZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLl9kYXRhXG4gIH0sXG4gIHNldDogZnVuY3Rpb24gKG5ld0RhdGEpIHtcbiAgICBpZiAobmV3RGF0YSAhPT0gdGhpcy5fZGF0YSkge1xuICAgICAgdGhpcy5fc2V0RGF0YShuZXdEYXRhKVxuICAgIH1cbiAgfVxufSlcblxuLyoqXG4gKiBNaXhpbiBpbnRlcm5hbCBpbnN0YW5jZSBtZXRob2RzXG4gKi9cblxuZXh0ZW5kKHAsIHJlcXVpcmUoJy4vaW5zdGFuY2UvaW5pdCcpKVxuZXh0ZW5kKHAsIHJlcXVpcmUoJy4vaW5zdGFuY2UvZXZlbnRzJykpXG5leHRlbmQocCwgcmVxdWlyZSgnLi9pbnN0YW5jZS9zY29wZScpKVxuZXh0ZW5kKHAsIHJlcXVpcmUoJy4vaW5zdGFuY2UvY29tcGlsZScpKVxuZXh0ZW5kKHAsIHJlcXVpcmUoJy4vaW5zdGFuY2UvbWlzYycpKVxuXG4vKipcbiAqIE1peGluIHB1YmxpYyBBUEkgbWV0aG9kc1xuICovXG5cbmV4dGVuZChwLCByZXF1aXJlKCcuL2FwaS9kYXRhJykpXG5leHRlbmQocCwgcmVxdWlyZSgnLi9hcGkvZG9tJykpXG5leHRlbmQocCwgcmVxdWlyZSgnLi9hcGkvZXZlbnRzJykpXG5leHRlbmQocCwgcmVxdWlyZSgnLi9hcGkvY2hpbGQnKSlcbmV4dGVuZChwLCByZXF1aXJlKCcuL2FwaS9saWZlY3ljbGUnKSlcblxubW9kdWxlLmV4cG9ydHMgPSBfLlZ1ZSA9IFZ1ZVxuIiwidmFyIF8gPSByZXF1aXJlKCcuL3V0aWwnKVxudmFyIGNvbmZpZyA9IHJlcXVpcmUoJy4vY29uZmlnJylcbnZhciBEZXAgPSByZXF1aXJlKCcuL29ic2VydmVyL2RlcCcpXG52YXIgZXhwUGFyc2VyID0gcmVxdWlyZSgnLi9wYXJzZXJzL2V4cHJlc3Npb24nKVxudmFyIGJhdGNoZXIgPSByZXF1aXJlKCcuL2JhdGNoZXInKVxudmFyIHVpZCA9IDBcblxuLyoqXG4gKiBBIHdhdGNoZXIgcGFyc2VzIGFuIGV4cHJlc3Npb24sIGNvbGxlY3RzIGRlcGVuZGVuY2llcyxcbiAqIGFuZCBmaXJlcyBjYWxsYmFjayB3aGVuIHRoZSBleHByZXNzaW9uIHZhbHVlIGNoYW5nZXMuXG4gKiBUaGlzIGlzIHVzZWQgZm9yIGJvdGggdGhlICR3YXRjaCgpIGFwaSBhbmQgZGlyZWN0aXZlcy5cbiAqXG4gKiBAcGFyYW0ge1Z1ZX0gdm1cbiAqIEBwYXJhbSB7U3RyaW5nfSBleHByZXNzaW9uXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYlxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAqICAgICAgICAgICAgICAgICAtIHtBcnJheX0gZmlsdGVyc1xuICogICAgICAgICAgICAgICAgIC0ge0Jvb2xlYW59IHR3b1dheVxuICogICAgICAgICAgICAgICAgIC0ge0Jvb2xlYW59IGRlZXBcbiAqICAgICAgICAgICAgICAgICAtIHtCb29sZWFufSB1c2VyXG4gKiAgICAgICAgICAgICAgICAgLSB7Qm9vbGVhbn0gc3luY1xuICogICAgICAgICAgICAgICAgIC0ge0Jvb2xlYW59IGxhenlcbiAqICAgICAgICAgICAgICAgICAtIHtGdW5jdGlvbn0gW3ByZVByb2Nlc3NdXG4gKiBAY29uc3RydWN0b3JcbiAqL1xuXG5mdW5jdGlvbiBXYXRjaGVyICh2bSwgZXhwT3JGbiwgY2IsIG9wdGlvbnMpIHtcbiAgLy8gbWl4IGluIG9wdGlvbnNcbiAgaWYgKG9wdGlvbnMpIHtcbiAgICBfLmV4dGVuZCh0aGlzLCBvcHRpb25zKVxuICB9XG4gIHZhciBpc0ZuID0gdHlwZW9mIGV4cE9yRm4gPT09ICdmdW5jdGlvbidcbiAgdGhpcy52bSA9IHZtXG4gIHZtLl93YXRjaGVycy5wdXNoKHRoaXMpXG4gIHRoaXMuZXhwcmVzc2lvbiA9IGlzRm4gPyBleHBPckZuLnRvU3RyaW5nKCkgOiBleHBPckZuXG4gIHRoaXMuY2IgPSBjYlxuICB0aGlzLmlkID0gKyt1aWQgLy8gdWlkIGZvciBiYXRjaGluZ1xuICB0aGlzLmFjdGl2ZSA9IHRydWVcbiAgdGhpcy5kaXJ0eSA9IHRoaXMubGF6eSAvLyBmb3IgbGF6eSB3YXRjaGVyc1xuICB0aGlzLmRlcHMgPSBbXVxuICB0aGlzLm5ld0RlcHMgPSBudWxsXG4gIHRoaXMucHJldkVycm9yID0gbnVsbCAvLyBmb3IgYXN5bmMgZXJyb3Igc3RhY2tzXG4gIC8vIHBhcnNlIGV4cHJlc3Npb24gZm9yIGdldHRlci9zZXR0ZXJcbiAgaWYgKGlzRm4pIHtcbiAgICB0aGlzLmdldHRlciA9IGV4cE9yRm5cbiAgICB0aGlzLnNldHRlciA9IHVuZGVmaW5lZFxuICB9IGVsc2Uge1xuICAgIHZhciByZXMgPSBleHBQYXJzZXIucGFyc2UoZXhwT3JGbiwgdGhpcy50d29XYXkpXG4gICAgdGhpcy5nZXR0ZXIgPSByZXMuZ2V0XG4gICAgdGhpcy5zZXR0ZXIgPSByZXMuc2V0XG4gIH1cbiAgdGhpcy52YWx1ZSA9IHRoaXMubGF6eVxuICAgID8gdW5kZWZpbmVkXG4gICAgOiB0aGlzLmdldCgpXG4gIC8vIHN0YXRlIGZvciBhdm9pZGluZyBmYWxzZSB0cmlnZ2VycyBmb3IgZGVlcCBhbmQgQXJyYXlcbiAgLy8gd2F0Y2hlcnMgZHVyaW5nIHZtLl9kaWdlc3QoKVxuICB0aGlzLnF1ZXVlZCA9IHRoaXMuc2hhbGxvdyA9IGZhbHNlXG59XG5cbi8qKlxuICogQWRkIGEgZGVwZW5kZW5jeSB0byB0aGlzIGRpcmVjdGl2ZS5cbiAqXG4gKiBAcGFyYW0ge0RlcH0gZGVwXG4gKi9cblxuV2F0Y2hlci5wcm90b3R5cGUuYWRkRGVwID0gZnVuY3Rpb24gKGRlcCkge1xuICB2YXIgbmV3RGVwcyA9IHRoaXMubmV3RGVwc1xuICB2YXIgb2xkID0gdGhpcy5kZXBzXG4gIGlmIChfLmluZGV4T2YobmV3RGVwcywgZGVwKSA8IDApIHtcbiAgICBuZXdEZXBzLnB1c2goZGVwKVxuICAgIHZhciBpID0gXy5pbmRleE9mKG9sZCwgZGVwKVxuICAgIGlmIChpIDwgMCkge1xuICAgICAgZGVwLmFkZFN1Yih0aGlzKVxuICAgIH0gZWxzZSB7XG4gICAgICBvbGRbaV0gPSBudWxsXG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogRXZhbHVhdGUgdGhlIGdldHRlciwgYW5kIHJlLWNvbGxlY3QgZGVwZW5kZW5jaWVzLlxuICovXG5cbldhdGNoZXIucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uICgpIHtcbiAgdGhpcy5iZWZvcmVHZXQoKVxuICB2YXIgdm0gPSB0aGlzLnZtXG4gIHZhciB2YWx1ZVxuICB0cnkge1xuICAgIHZhbHVlID0gdGhpcy5nZXR0ZXIuY2FsbCh2bSwgdm0pXG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBpZiAoXG4gICAgICBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nICYmXG4gICAgICBjb25maWcud2FybkV4cHJlc3Npb25FcnJvcnNcbiAgICApIHtcbiAgICAgIF8ud2FybihcbiAgICAgICAgJ0Vycm9yIHdoZW4gZXZhbHVhdGluZyBleHByZXNzaW9uIFwiJyArXG4gICAgICAgIHRoaXMuZXhwcmVzc2lvbiArICdcIi4gJyArXG4gICAgICAgIChjb25maWcuZGVidWdcbiAgICAgICAgICA/ICcnXG4gICAgICAgICAgOiAnVHVybiBvbiBkZWJ1ZyBtb2RlIHRvIHNlZSBzdGFjayB0cmFjZS4nXG4gICAgICAgICksIGVcbiAgICAgIClcbiAgICB9XG4gIH1cbiAgLy8gXCJ0b3VjaFwiIGV2ZXJ5IHByb3BlcnR5IHNvIHRoZXkgYXJlIGFsbCB0cmFja2VkIGFzXG4gIC8vIGRlcGVuZGVuY2llcyBmb3IgZGVlcCB3YXRjaGluZ1xuICBpZiAodGhpcy5kZWVwKSB7XG4gICAgdHJhdmVyc2UodmFsdWUpXG4gIH1cbiAgaWYgKHRoaXMucHJlUHJvY2Vzcykge1xuICAgIHZhbHVlID0gdGhpcy5wcmVQcm9jZXNzKHZhbHVlKVxuICB9XG4gIGlmICh0aGlzLmZpbHRlcnMpIHtcbiAgICB2YWx1ZSA9IHZtLl9hcHBseUZpbHRlcnModmFsdWUsIG51bGwsIHRoaXMuZmlsdGVycywgZmFsc2UpXG4gIH1cbiAgdGhpcy5hZnRlckdldCgpXG4gIHJldHVybiB2YWx1ZVxufVxuXG4vKipcbiAqIFNldCB0aGUgY29ycmVzcG9uZGluZyB2YWx1ZSB3aXRoIHRoZSBzZXR0ZXIuXG4gKlxuICogQHBhcmFtIHsqfSB2YWx1ZVxuICovXG5cbldhdGNoZXIucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICB2YXIgdm0gPSB0aGlzLnZtXG4gIGlmICh0aGlzLmZpbHRlcnMpIHtcbiAgICB2YWx1ZSA9IHZtLl9hcHBseUZpbHRlcnMoXG4gICAgICB2YWx1ZSwgdGhpcy52YWx1ZSwgdGhpcy5maWx0ZXJzLCB0cnVlKVxuICB9XG4gIHRyeSB7XG4gICAgdGhpcy5zZXR0ZXIuY2FsbCh2bSwgdm0sIHZhbHVlKVxuICB9IGNhdGNoIChlKSB7XG4gICAgaWYgKFxuICAgICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJlxuICAgICAgY29uZmlnLndhcm5FeHByZXNzaW9uRXJyb3JzXG4gICAgKSB7XG4gICAgICBfLndhcm4oXG4gICAgICAgICdFcnJvciB3aGVuIGV2YWx1YXRpbmcgc2V0dGVyIFwiJyArXG4gICAgICAgIHRoaXMuZXhwcmVzc2lvbiArICdcIicsIGVcbiAgICAgIClcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBQcmVwYXJlIGZvciBkZXBlbmRlbmN5IGNvbGxlY3Rpb24uXG4gKi9cblxuV2F0Y2hlci5wcm90b3R5cGUuYmVmb3JlR2V0ID0gZnVuY3Rpb24gKCkge1xuICBEZXAudGFyZ2V0ID0gdGhpc1xuICB0aGlzLm5ld0RlcHMgPSBbXVxufVxuXG4vKipcbiAqIENsZWFuIHVwIGZvciBkZXBlbmRlbmN5IGNvbGxlY3Rpb24uXG4gKi9cblxuV2F0Y2hlci5wcm90b3R5cGUuYWZ0ZXJHZXQgPSBmdW5jdGlvbiAoKSB7XG4gIERlcC50YXJnZXQgPSBudWxsXG4gIHZhciBpID0gdGhpcy5kZXBzLmxlbmd0aFxuICB3aGlsZSAoaS0tKSB7XG4gICAgdmFyIGRlcCA9IHRoaXMuZGVwc1tpXVxuICAgIGlmIChkZXApIHtcbiAgICAgIGRlcC5yZW1vdmVTdWIodGhpcylcbiAgICB9XG4gIH1cbiAgdGhpcy5kZXBzID0gdGhpcy5uZXdEZXBzXG4gIHRoaXMubmV3RGVwcyA9IG51bGxcbn1cblxuLyoqXG4gKiBTdWJzY3JpYmVyIGludGVyZmFjZS5cbiAqIFdpbGwgYmUgY2FsbGVkIHdoZW4gYSBkZXBlbmRlbmN5IGNoYW5nZXMuXG4gKlxuICogQHBhcmFtIHtCb29sZWFufSBzaGFsbG93XG4gKi9cblxuV2F0Y2hlci5wcm90b3R5cGUudXBkYXRlID0gZnVuY3Rpb24gKHNoYWxsb3cpIHtcbiAgaWYgKHRoaXMubGF6eSkge1xuICAgIHRoaXMuZGlydHkgPSB0cnVlXG4gIH0gZWxzZSBpZiAodGhpcy5zeW5jIHx8ICFjb25maWcuYXN5bmMpIHtcbiAgICB0aGlzLnJ1bigpXG4gIH0gZWxzZSB7XG4gICAgLy8gaWYgcXVldWVkLCBvbmx5IG92ZXJ3cml0ZSBzaGFsbG93IHdpdGggbm9uLXNoYWxsb3csXG4gICAgLy8gYnV0IG5vdCB0aGUgb3RoZXIgd2F5IGFyb3VuZC5cbiAgICB0aGlzLnNoYWxsb3cgPSB0aGlzLnF1ZXVlZFxuICAgICAgPyBzaGFsbG93XG4gICAgICAgID8gdGhpcy5zaGFsbG93XG4gICAgICAgIDogZmFsc2VcbiAgICAgIDogISFzaGFsbG93XG4gICAgdGhpcy5xdWV1ZWQgPSB0cnVlXG4gICAgLy8gcmVjb3JkIGJlZm9yZS1wdXNoIGVycm9yIHN0YWNrIGluIGRlYnVnIG1vZGVcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiBjb25maWcuZGVidWcpIHtcbiAgICAgIHRoaXMucHJldkVycm9yID0gbmV3IEVycm9yKCdbdnVlXSBhc3luYyBzdGFjayB0cmFjZScpXG4gICAgfVxuICAgIGJhdGNoZXIucHVzaCh0aGlzKVxuICB9XG59XG5cbi8qKlxuICogQmF0Y2hlciBqb2IgaW50ZXJmYWNlLlxuICogV2lsbCBiZSBjYWxsZWQgYnkgdGhlIGJhdGNoZXIuXG4gKi9cblxuV2F0Y2hlci5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24gKCkge1xuICBpZiAodGhpcy5hY3RpdmUpIHtcbiAgICB2YXIgdmFsdWUgPSB0aGlzLmdldCgpXG4gICAgaWYgKFxuICAgICAgdmFsdWUgIT09IHRoaXMudmFsdWUgfHxcbiAgICAgIC8vIERlZXAgd2F0Y2hlcnMgYW5kIEFycmF5IHdhdGNoZXJzIHNob3VsZCBmaXJlIGV2ZW5cbiAgICAgIC8vIHdoZW4gdGhlIHZhbHVlIGlzIHRoZSBzYW1lLCBiZWNhdXNlIHRoZSB2YWx1ZSBtYXlcbiAgICAgIC8vIGhhdmUgbXV0YXRlZDsgYnV0IG9ubHkgZG8gc28gaWYgdGhpcyBpcyBhXG4gICAgICAvLyBub24tc2hhbGxvdyB1cGRhdGUgKGNhdXNlZCBieSBhIHZtIGRpZ2VzdCkuXG4gICAgICAoKF8uaXNBcnJheSh2YWx1ZSkgfHwgdGhpcy5kZWVwKSAmJiAhdGhpcy5zaGFsbG93KVxuICAgICkge1xuICAgICAgLy8gc2V0IG5ldyB2YWx1ZVxuICAgICAgdmFyIG9sZFZhbHVlID0gdGhpcy52YWx1ZVxuICAgICAgdGhpcy52YWx1ZSA9IHZhbHVlXG4gICAgICAvLyBpbiBkZWJ1ZyArIGFzeW5jIG1vZGUsIHdoZW4gYSB3YXRjaGVyIGNhbGxiYWNrc1xuICAgICAgLy8gdGhyb3dzLCB3ZSBhbHNvIHRocm93IHRoZSBzYXZlZCBiZWZvcmUtcHVzaCBlcnJvclxuICAgICAgLy8gc28gdGhlIGZ1bGwgY3Jvc3MtdGljayBzdGFjayB0cmFjZSBpcyBhdmFpbGFibGUuXG4gICAgICB2YXIgcHJldkVycm9yID0gdGhpcy5wcmV2RXJyb3JcbiAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICAgICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgJiZcbiAgICAgICAgICBjb25maWcuZGVidWcgJiYgcHJldkVycm9yKSB7XG4gICAgICAgIHRoaXMucHJldkVycm9yID0gbnVsbFxuICAgICAgICB0cnkge1xuICAgICAgICAgIHRoaXMuY2IuY2FsbCh0aGlzLnZtLCB2YWx1ZSwgb2xkVmFsdWUpXG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICBfLm5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHRocm93IHByZXZFcnJvclxuICAgICAgICAgIH0sIDApXG4gICAgICAgICAgdGhyb3cgZVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmNiLmNhbGwodGhpcy52bSwgdmFsdWUsIG9sZFZhbHVlKVxuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLnF1ZXVlZCA9IHRoaXMuc2hhbGxvdyA9IGZhbHNlXG4gIH1cbn1cblxuLyoqXG4gKiBFdmFsdWF0ZSB0aGUgdmFsdWUgb2YgdGhlIHdhdGNoZXIuXG4gKiBUaGlzIG9ubHkgZ2V0cyBjYWxsZWQgZm9yIGxhenkgd2F0Y2hlcnMuXG4gKi9cblxuV2F0Y2hlci5wcm90b3R5cGUuZXZhbHVhdGUgPSBmdW5jdGlvbiAoKSB7XG4gIC8vIGF2b2lkIG92ZXJ3cml0aW5nIGFub3RoZXIgd2F0Y2hlciB0aGF0IGlzIGJlaW5nXG4gIC8vIGNvbGxlY3RlZC5cbiAgdmFyIGN1cnJlbnQgPSBEZXAudGFyZ2V0XG4gIHRoaXMudmFsdWUgPSB0aGlzLmdldCgpXG4gIHRoaXMuZGlydHkgPSBmYWxzZVxuICBEZXAudGFyZ2V0ID0gY3VycmVudFxufVxuXG4vKipcbiAqIERlcGVuZCBvbiBhbGwgZGVwcyBjb2xsZWN0ZWQgYnkgdGhpcyB3YXRjaGVyLlxuICovXG5cbldhdGNoZXIucHJvdG90eXBlLmRlcGVuZCA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIGkgPSB0aGlzLmRlcHMubGVuZ3RoXG4gIHdoaWxlIChpLS0pIHtcbiAgICB0aGlzLmRlcHNbaV0uZGVwZW5kKClcbiAgfVxufVxuXG4vKipcbiAqIFJlbW92ZSBzZWxmIGZyb20gYWxsIGRlcGVuZGVuY2llcycgc3ViY3JpYmVyIGxpc3QuXG4gKi9cblxuV2F0Y2hlci5wcm90b3R5cGUudGVhcmRvd24gPSBmdW5jdGlvbiAoKSB7XG4gIGlmICh0aGlzLmFjdGl2ZSkge1xuICAgIC8vIHJlbW92ZSBzZWxmIGZyb20gdm0ncyB3YXRjaGVyIGxpc3RcbiAgICAvLyB3ZSBjYW4gc2tpcCB0aGlzIGlmIHRoZSB2bSBpZiBiZWluZyBkZXN0cm95ZWRcbiAgICAvLyB3aGljaCBjYW4gaW1wcm92ZSB0ZWFyZG93biBwZXJmb3JtYW5jZS5cbiAgICBpZiAoIXRoaXMudm0uX2lzQmVpbmdEZXN0cm95ZWQpIHtcbiAgICAgIHRoaXMudm0uX3dhdGNoZXJzLiRyZW1vdmUodGhpcylcbiAgICB9XG4gICAgdmFyIGkgPSB0aGlzLmRlcHMubGVuZ3RoXG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgdGhpcy5kZXBzW2ldLnJlbW92ZVN1Yih0aGlzKVxuICAgIH1cbiAgICB0aGlzLmFjdGl2ZSA9IGZhbHNlXG4gICAgdGhpcy52bSA9IHRoaXMuY2IgPSB0aGlzLnZhbHVlID0gbnVsbFxuICB9XG59XG5cbi8qKlxuICogUmVjcnVzaXZlbHkgdHJhdmVyc2UgYW4gb2JqZWN0IHRvIGV2b2tlIGFsbCBjb252ZXJ0ZWRcbiAqIGdldHRlcnMsIHNvIHRoYXQgZXZlcnkgbmVzdGVkIHByb3BlcnR5IGluc2lkZSB0aGUgb2JqZWN0XG4gKiBpcyBjb2xsZWN0ZWQgYXMgYSBcImRlZXBcIiBkZXBlbmRlbmN5LlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmpcbiAqL1xuXG5mdW5jdGlvbiB0cmF2ZXJzZSAob2JqKSB7XG4gIHZhciBrZXksIHZhbCwgaVxuICBmb3IgKGtleSBpbiBvYmopIHtcbiAgICB2YWwgPSBvYmpba2V5XVxuICAgIGlmIChfLmlzQXJyYXkodmFsKSkge1xuICAgICAgaSA9IHZhbC5sZW5ndGhcbiAgICAgIHdoaWxlIChpLS0pIHRyYXZlcnNlKHZhbFtpXSlcbiAgICB9IGVsc2UgaWYgKF8uaXNPYmplY3QodmFsKSkge1xuICAgICAgdHJhdmVyc2UodmFsKVxuICAgIH1cbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFdhdGNoZXJcbiIsInZhciBWdWUgPSByZXF1aXJlKCd2dWUnKTtcblZ1ZS51c2UocmVxdWlyZSgndnVlLXJlc291cmNlJykpO1xudmFyIGNhckNvbXBvbmVudCA9IHJlcXVpcmUoJy4vdmlld3MvY2FyLWNvbXBvbmVudC5odG1sJyk7XG5cblZ1ZS5jb21wb25lbnQoJ2Nhci1jb21wb25lbnQnLCB7XG4gIHRlbXBsYXRlOiBjYXJDb21wb25lbnQsXG5cbiAgcHJvcHM6IFsnY2F0YWxvZ0NhciddLFxuXG4gIGRhdGEoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHRvZ2dsZTogZmFsc2VcbiAgICB9XG4gIH0sXG5cbiAgbWV0aG9kczoge1xuICAgIGFjY29yZGlvbigpIHtcbiAgICAgIHRoaXMudG9nZ2xlID0gIXRoaXMudG9nZ2xlO1xuICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICB9XG4gIH1cbn0pO1xuXG52YXIgdm0gPSBuZXcgVnVlKHtcbiAgZWw6ICcjdnVlLWFwcCcsXG5cbiAgZGF0YToge1xuICAgIGNhdGFsb2dDYXI6IHt9LFxuICAgIHRvZ2dsZTogZmFsc2VcbiAgfSxcblxuICByZWFkeSgpIHtcbiAgICB2YXIgdXJsID0gJ2h0dHA6Ly93d3cuY2Fyc2Vuc29ybGFiLm5ldC93ZWJhcGkvVjIvY2F0YWxvZ1NlYXJjaC8/b3V0cHV0PWpzb24mYnJhbmQ9JyArIGVuY29kZVVSSUNvbXBvbmVudCgn44Op44Oz44Oc44Or44Ku44O844OLJyk7XG4gICAgdGhpcy4kaHR0cC5qc29ucCh1cmwsIGZ1bmN0aW9uIChkYXRhLCBzdGF0dXMsIHJlcXVlc3QpIHtcbiAgICAgIHRoaXMuJHNldCgnY2F0YWxvZ0NhcicsIGRhdGEuY2F0YWxvZ0Nhcik7XG4gICAgfSkuZXJyb3IoZnVuY3Rpb24gKGRhdGEsIHN0YXR1cywgcmVxdWVzdCkge1xuICAgICAgY29uc29sZS5lcnJvcihzdGF0dXMpO1xuICAgIH0pO1xuICB9XG59KTtcblxuLy8gY29uc29sZS53YXJuKCdodHRwOi8vanAudnVlanMub3JnL2FwaS9kaXJlY3RpdmVzLmh0bWwjdi1hdHRyJyk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IFwiPGRpdj48aDI+e3tpdGVtLm1vZGVsfX0gPHNtYWxsPi8ge3tpdGVtLmJyYW5kfX08L3NtYWxsPjwvaDI+PGRpdiBjbGFzcz1cXFwibWVkaWFcXFwiPjxkaXYgY2xhc3M9XFxcIm1lZGlhX19pbWdcXFwiPjxpbWcgc3JjPVxcXCJ7e2l0ZW0uaW1hZ2VGcm9udFVybH19XFxcIiBhbHQ9XFxcIlxcXCIgd2lkdGg9XFxcIjE4MFxcXCIgaGVpZ2h0PVxcXCIxMzVcXFwiIC8+PC9kaXY+PGRpdiBjbGFzcz1cXFwibWVkaWFfX2JvZHlcXFwiPjxwIHYtaWY9XFxcIml0ZW0uY29tbWVudFxcXCI+e3tpdGVtLmNvbW1lbnR9fTwvcD4gPGEgaHJlZj1cXFwiI1xcXCIgdi1vbj1cXFwiY2xpY2s6IGFjY29yZGlvblxcXCI+6Kmz57Sw44K544Oa44OD44KvPC9hPjx0YWJsZSB2LXNob3c9XFxcInRvZ2dsZVxcXCI+PHRyPjx0aD7mjpLmsJfph488L3RoPjx0ZD57e2l0ZW0uZW5naW5lQ2FwYWNpdHl9fWNjPC90ZD48L3RyPjx0cj48dGg+6LuK5L2T44K144Kk44K6PC90aD48dGQ+e3tpdGVtLmJvZHlTaXplfX08L3RkPjwvdHI+PHRyPjx0aD7nlJ/nlKPmnJ/plpM8L3RoPjx0ZD57e2l0ZW0ucHJvZHVjdGlvblBlcmlvZH19PC90ZD48L3RyPjwvdGFibGU+PC9kaXY+PC9kaXY+PC9kaXY+XCI7XG4iXX0=
