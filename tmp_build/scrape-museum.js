"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// ../Developer/CultureFlow-New/node_modules/ms/index.js
var require_ms = __commonJS({
  "../Developer/CultureFlow-New/node_modules/ms/index.js"(exports2, module2) {
    var s = 1e3;
    var m = s * 60;
    var h = m * 60;
    var d = h * 24;
    var w = d * 7;
    var y = d * 365.25;
    module2.exports = function(val, options) {
      options = options || {};
      var type = typeof val;
      if (type === "string" && val.length > 0) {
        return parse(val);
      } else if (type === "number" && isFinite(val)) {
        return options.long ? fmtLong(val) : fmtShort(val);
      }
      throw new Error(
        "val is not a non-empty string or a valid number. val=" + JSON.stringify(val)
      );
    };
    function parse(str) {
      str = String(str);
      if (str.length > 100) {
        return;
      }
      var match = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
        str
      );
      if (!match) {
        return;
      }
      var n = parseFloat(match[1]);
      var type = (match[2] || "ms").toLowerCase();
      switch (type) {
        case "years":
        case "year":
        case "yrs":
        case "yr":
        case "y":
          return n * y;
        case "weeks":
        case "week":
        case "w":
          return n * w;
        case "days":
        case "day":
        case "d":
          return n * d;
        case "hours":
        case "hour":
        case "hrs":
        case "hr":
        case "h":
          return n * h;
        case "minutes":
        case "minute":
        case "mins":
        case "min":
        case "m":
          return n * m;
        case "seconds":
        case "second":
        case "secs":
        case "sec":
        case "s":
          return n * s;
        case "milliseconds":
        case "millisecond":
        case "msecs":
        case "msec":
        case "ms":
          return n;
        default:
          return void 0;
      }
    }
    function fmtShort(ms) {
      var msAbs = Math.abs(ms);
      if (msAbs >= d) {
        return Math.round(ms / d) + "d";
      }
      if (msAbs >= h) {
        return Math.round(ms / h) + "h";
      }
      if (msAbs >= m) {
        return Math.round(ms / m) + "m";
      }
      if (msAbs >= s) {
        return Math.round(ms / s) + "s";
      }
      return ms + "ms";
    }
    function fmtLong(ms) {
      var msAbs = Math.abs(ms);
      if (msAbs >= d) {
        return plural(ms, msAbs, d, "day");
      }
      if (msAbs >= h) {
        return plural(ms, msAbs, h, "hour");
      }
      if (msAbs >= m) {
        return plural(ms, msAbs, m, "minute");
      }
      if (msAbs >= s) {
        return plural(ms, msAbs, s, "second");
      }
      return ms + " ms";
    }
    function plural(ms, msAbs, n, name) {
      var isPlural = msAbs >= n * 1.5;
      return Math.round(ms / n) + " " + name + (isPlural ? "s" : "");
    }
  }
});

// ../Developer/CultureFlow-New/node_modules/debug/src/common.js
var require_common = __commonJS({
  "../Developer/CultureFlow-New/node_modules/debug/src/common.js"(exports2, module2) {
    function setup(env) {
      createDebug.debug = createDebug;
      createDebug.default = createDebug;
      createDebug.coerce = coerce;
      createDebug.disable = disable;
      createDebug.enable = enable;
      createDebug.enabled = enabled;
      createDebug.humanize = require_ms();
      createDebug.destroy = destroy;
      Object.keys(env).forEach((key) => {
        createDebug[key] = env[key];
      });
      createDebug.names = [];
      createDebug.skips = [];
      createDebug.formatters = {};
      function selectColor(namespace) {
        let hash = 0;
        for (let i = 0; i < namespace.length; i++) {
          hash = (hash << 5) - hash + namespace.charCodeAt(i);
          hash |= 0;
        }
        return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
      }
      createDebug.selectColor = selectColor;
      function createDebug(namespace) {
        let prevTime;
        let enableOverride = null;
        let namespacesCache;
        let enabledCache;
        function debug(...args) {
          if (!debug.enabled) {
            return;
          }
          const self = debug;
          const curr = Number(/* @__PURE__ */ new Date());
          const ms = curr - (prevTime || curr);
          self.diff = ms;
          self.prev = prevTime;
          self.curr = curr;
          prevTime = curr;
          args[0] = createDebug.coerce(args[0]);
          if (typeof args[0] !== "string") {
            args.unshift("%O");
          }
          let index = 0;
          args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
            if (match === "%%") {
              return "%";
            }
            index++;
            const formatter = createDebug.formatters[format];
            if (typeof formatter === "function") {
              const val = args[index];
              match = formatter.call(self, val);
              args.splice(index, 1);
              index--;
            }
            return match;
          });
          createDebug.formatArgs.call(self, args);
          const logFn = self.log || createDebug.log;
          logFn.apply(self, args);
        }
        debug.namespace = namespace;
        debug.useColors = createDebug.useColors();
        debug.color = createDebug.selectColor(namespace);
        debug.extend = extend;
        debug.destroy = createDebug.destroy;
        Object.defineProperty(debug, "enabled", {
          enumerable: true,
          configurable: false,
          get: () => {
            if (enableOverride !== null) {
              return enableOverride;
            }
            if (namespacesCache !== createDebug.namespaces) {
              namespacesCache = createDebug.namespaces;
              enabledCache = createDebug.enabled(namespace);
            }
            return enabledCache;
          },
          set: (v) => {
            enableOverride = v;
          }
        });
        if (typeof createDebug.init === "function") {
          createDebug.init(debug);
        }
        return debug;
      }
      function extend(namespace, delimiter) {
        const newDebug = createDebug(this.namespace + (typeof delimiter === "undefined" ? ":" : delimiter) + namespace);
        newDebug.log = this.log;
        return newDebug;
      }
      function enable(namespaces) {
        createDebug.save(namespaces);
        createDebug.namespaces = namespaces;
        createDebug.names = [];
        createDebug.skips = [];
        const split = (typeof namespaces === "string" ? namespaces : "").trim().replace(/\s+/g, ",").split(",").filter(Boolean);
        for (const ns of split) {
          if (ns[0] === "-") {
            createDebug.skips.push(ns.slice(1));
          } else {
            createDebug.names.push(ns);
          }
        }
      }
      function matchesTemplate(search, template) {
        let searchIndex = 0;
        let templateIndex = 0;
        let starIndex = -1;
        let matchIndex = 0;
        while (searchIndex < search.length) {
          if (templateIndex < template.length && (template[templateIndex] === search[searchIndex] || template[templateIndex] === "*")) {
            if (template[templateIndex] === "*") {
              starIndex = templateIndex;
              matchIndex = searchIndex;
              templateIndex++;
            } else {
              searchIndex++;
              templateIndex++;
            }
          } else if (starIndex !== -1) {
            templateIndex = starIndex + 1;
            matchIndex++;
            searchIndex = matchIndex;
          } else {
            return false;
          }
        }
        while (templateIndex < template.length && template[templateIndex] === "*") {
          templateIndex++;
        }
        return templateIndex === template.length;
      }
      function disable() {
        const namespaces = [
          ...createDebug.names,
          ...createDebug.skips.map((namespace) => "-" + namespace)
        ].join(",");
        createDebug.enable("");
        return namespaces;
      }
      function enabled(name) {
        for (const skip of createDebug.skips) {
          if (matchesTemplate(name, skip)) {
            return false;
          }
        }
        for (const ns of createDebug.names) {
          if (matchesTemplate(name, ns)) {
            return true;
          }
        }
        return false;
      }
      function coerce(val) {
        if (val instanceof Error) {
          return val.stack || val.message;
        }
        return val;
      }
      function destroy() {
        console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
      }
      createDebug.enable(createDebug.load());
      return createDebug;
    }
    module2.exports = setup;
  }
});

// ../Developer/CultureFlow-New/node_modules/debug/src/browser.js
var require_browser = __commonJS({
  "../Developer/CultureFlow-New/node_modules/debug/src/browser.js"(exports2, module2) {
    exports2.formatArgs = formatArgs;
    exports2.save = save;
    exports2.load = load;
    exports2.useColors = useColors;
    exports2.storage = localstorage();
    exports2.destroy = /* @__PURE__ */ (() => {
      let warned = false;
      return () => {
        if (!warned) {
          warned = true;
          console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
        }
      };
    })();
    exports2.colors = [
      "#0000CC",
      "#0000FF",
      "#0033CC",
      "#0033FF",
      "#0066CC",
      "#0066FF",
      "#0099CC",
      "#0099FF",
      "#00CC00",
      "#00CC33",
      "#00CC66",
      "#00CC99",
      "#00CCCC",
      "#00CCFF",
      "#3300CC",
      "#3300FF",
      "#3333CC",
      "#3333FF",
      "#3366CC",
      "#3366FF",
      "#3399CC",
      "#3399FF",
      "#33CC00",
      "#33CC33",
      "#33CC66",
      "#33CC99",
      "#33CCCC",
      "#33CCFF",
      "#6600CC",
      "#6600FF",
      "#6633CC",
      "#6633FF",
      "#66CC00",
      "#66CC33",
      "#9900CC",
      "#9900FF",
      "#9933CC",
      "#9933FF",
      "#99CC00",
      "#99CC33",
      "#CC0000",
      "#CC0033",
      "#CC0066",
      "#CC0099",
      "#CC00CC",
      "#CC00FF",
      "#CC3300",
      "#CC3333",
      "#CC3366",
      "#CC3399",
      "#CC33CC",
      "#CC33FF",
      "#CC6600",
      "#CC6633",
      "#CC9900",
      "#CC9933",
      "#CCCC00",
      "#CCCC33",
      "#FF0000",
      "#FF0033",
      "#FF0066",
      "#FF0099",
      "#FF00CC",
      "#FF00FF",
      "#FF3300",
      "#FF3333",
      "#FF3366",
      "#FF3399",
      "#FF33CC",
      "#FF33FF",
      "#FF6600",
      "#FF6633",
      "#FF9900",
      "#FF9933",
      "#FFCC00",
      "#FFCC33"
    ];
    function useColors() {
      if (typeof window !== "undefined" && window.process && (window.process.type === "renderer" || window.process.__nwjs)) {
        return true;
      }
      if (typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
        return false;
      }
      let m;
      return typeof document !== "undefined" && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance || // Is firebug? http://stackoverflow.com/a/398120/376773
      typeof window !== "undefined" && window.console && (window.console.firebug || window.console.exception && window.console.table) || // Is firefox >= v31?
      // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
      typeof navigator !== "undefined" && navigator.userAgent && (m = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) && parseInt(m[1], 10) >= 31 || // Double check webkit in userAgent just in case we are in a worker
      typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/);
    }
    function formatArgs(args) {
      args[0] = (this.useColors ? "%c" : "") + this.namespace + (this.useColors ? " %c" : " ") + args[0] + (this.useColors ? "%c " : " ") + "+" + module2.exports.humanize(this.diff);
      if (!this.useColors) {
        return;
      }
      const c = "color: " + this.color;
      args.splice(1, 0, c, "color: inherit");
      let index = 0;
      let lastC = 0;
      args[0].replace(/%[a-zA-Z%]/g, (match) => {
        if (match === "%%") {
          return;
        }
        index++;
        if (match === "%c") {
          lastC = index;
        }
      });
      args.splice(lastC, 0, c);
    }
    exports2.log = console.debug || console.log || (() => {
    });
    function save(namespaces) {
      try {
        if (namespaces) {
          exports2.storage.setItem("debug", namespaces);
        } else {
          exports2.storage.removeItem("debug");
        }
      } catch (error) {
      }
    }
    function load() {
      let r;
      try {
        r = exports2.storage.getItem("debug") || exports2.storage.getItem("DEBUG");
      } catch (error) {
      }
      if (!r && typeof process !== "undefined" && "env" in process) {
        r = process.env.DEBUG;
      }
      return r;
    }
    function localstorage() {
      try {
        return localStorage;
      } catch (error) {
      }
    }
    module2.exports = require_common()(exports2);
    var { formatters } = module2.exports;
    formatters.j = function(v) {
      try {
        return JSON.stringify(v);
      } catch (error) {
        return "[UnexpectedJSONParseError]: " + error.message;
      }
    };
  }
});

// ../Developer/CultureFlow-New/node_modules/has-flag/index.js
var require_has_flag = __commonJS({
  "../Developer/CultureFlow-New/node_modules/has-flag/index.js"(exports2, module2) {
    "use strict";
    module2.exports = (flag, argv = process.argv) => {
      const prefix = flag.startsWith("-") ? "" : flag.length === 1 ? "-" : "--";
      const position = argv.indexOf(prefix + flag);
      const terminatorPosition = argv.indexOf("--");
      return position !== -1 && (terminatorPosition === -1 || position < terminatorPosition);
    };
  }
});

// ../Developer/CultureFlow-New/node_modules/supports-color/index.js
var require_supports_color = __commonJS({
  "../Developer/CultureFlow-New/node_modules/supports-color/index.js"(exports2, module2) {
    "use strict";
    var os = require("os");
    var tty = require("tty");
    var hasFlag = require_has_flag();
    var { env } = process;
    var forceColor;
    if (hasFlag("no-color") || hasFlag("no-colors") || hasFlag("color=false") || hasFlag("color=never")) {
      forceColor = 0;
    } else if (hasFlag("color") || hasFlag("colors") || hasFlag("color=true") || hasFlag("color=always")) {
      forceColor = 1;
    }
    if ("FORCE_COLOR" in env) {
      if (env.FORCE_COLOR === "true") {
        forceColor = 1;
      } else if (env.FORCE_COLOR === "false") {
        forceColor = 0;
      } else {
        forceColor = env.FORCE_COLOR.length === 0 ? 1 : Math.min(parseInt(env.FORCE_COLOR, 10), 3);
      }
    }
    function translateLevel(level) {
      if (level === 0) {
        return false;
      }
      return {
        level,
        hasBasic: true,
        has256: level >= 2,
        has16m: level >= 3
      };
    }
    function supportsColor(haveStream, streamIsTTY) {
      if (forceColor === 0) {
        return 0;
      }
      if (hasFlag("color=16m") || hasFlag("color=full") || hasFlag("color=truecolor")) {
        return 3;
      }
      if (hasFlag("color=256")) {
        return 2;
      }
      if (haveStream && !streamIsTTY && forceColor === void 0) {
        return 0;
      }
      const min = forceColor || 0;
      if (env.TERM === "dumb") {
        return min;
      }
      if (process.platform === "win32") {
        const osRelease = os.release().split(".");
        if (Number(osRelease[0]) >= 10 && Number(osRelease[2]) >= 10586) {
          return Number(osRelease[2]) >= 14931 ? 3 : 2;
        }
        return 1;
      }
      if ("CI" in env) {
        if (["TRAVIS", "CIRCLECI", "APPVEYOR", "GITLAB_CI", "GITHUB_ACTIONS", "BUILDKITE"].some((sign) => sign in env) || env.CI_NAME === "codeship") {
          return 1;
        }
        return min;
      }
      if ("TEAMCITY_VERSION" in env) {
        return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(env.TEAMCITY_VERSION) ? 1 : 0;
      }
      if (env.COLORTERM === "truecolor") {
        return 3;
      }
      if ("TERM_PROGRAM" in env) {
        const version = parseInt((env.TERM_PROGRAM_VERSION || "").split(".")[0], 10);
        switch (env.TERM_PROGRAM) {
          case "iTerm.app":
            return version >= 3 ? 3 : 2;
          case "Apple_Terminal":
            return 2;
        }
      }
      if (/-256(color)?$/i.test(env.TERM)) {
        return 2;
      }
      if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(env.TERM)) {
        return 1;
      }
      if ("COLORTERM" in env) {
        return 1;
      }
      return min;
    }
    function getSupportLevel(stream) {
      const level = supportsColor(stream, stream && stream.isTTY);
      return translateLevel(level);
    }
    module2.exports = {
      supportsColor: getSupportLevel,
      stdout: translateLevel(supportsColor(true, tty.isatty(1))),
      stderr: translateLevel(supportsColor(true, tty.isatty(2)))
    };
  }
});

// ../Developer/CultureFlow-New/node_modules/debug/src/node.js
var require_node = __commonJS({
  "../Developer/CultureFlow-New/node_modules/debug/src/node.js"(exports2, module2) {
    var tty = require("tty");
    var util = require("util");
    exports2.init = init;
    exports2.log = log;
    exports2.formatArgs = formatArgs;
    exports2.save = save;
    exports2.load = load;
    exports2.useColors = useColors;
    exports2.destroy = util.deprecate(
      () => {
      },
      "Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`."
    );
    exports2.colors = [6, 2, 3, 4, 5, 1];
    try {
      const supportsColor = require_supports_color();
      if (supportsColor && (supportsColor.stderr || supportsColor).level >= 2) {
        exports2.colors = [
          20,
          21,
          26,
          27,
          32,
          33,
          38,
          39,
          40,
          41,
          42,
          43,
          44,
          45,
          56,
          57,
          62,
          63,
          68,
          69,
          74,
          75,
          76,
          77,
          78,
          79,
          80,
          81,
          92,
          93,
          98,
          99,
          112,
          113,
          128,
          129,
          134,
          135,
          148,
          149,
          160,
          161,
          162,
          163,
          164,
          165,
          166,
          167,
          168,
          169,
          170,
          171,
          172,
          173,
          178,
          179,
          184,
          185,
          196,
          197,
          198,
          199,
          200,
          201,
          202,
          203,
          204,
          205,
          206,
          207,
          208,
          209,
          214,
          215,
          220,
          221
        ];
      }
    } catch (error) {
    }
    exports2.inspectOpts = Object.keys(process.env).filter((key) => {
      return /^debug_/i.test(key);
    }).reduce((obj, key) => {
      const prop = key.substring(6).toLowerCase().replace(/_([a-z])/g, (_, k) => {
        return k.toUpperCase();
      });
      let val = process.env[key];
      if (/^(yes|on|true|enabled)$/i.test(val)) {
        val = true;
      } else if (/^(no|off|false|disabled)$/i.test(val)) {
        val = false;
      } else if (val === "null") {
        val = null;
      } else {
        val = Number(val);
      }
      obj[prop] = val;
      return obj;
    }, {});
    function useColors() {
      return "colors" in exports2.inspectOpts ? Boolean(exports2.inspectOpts.colors) : tty.isatty(process.stderr.fd);
    }
    function formatArgs(args) {
      const { namespace: name, useColors: useColors2 } = this;
      if (useColors2) {
        const c = this.color;
        const colorCode = "\x1B[3" + (c < 8 ? c : "8;5;" + c);
        const prefix = `  ${colorCode};1m${name} \x1B[0m`;
        args[0] = prefix + args[0].split("\n").join("\n" + prefix);
        args.push(colorCode + "m+" + module2.exports.humanize(this.diff) + "\x1B[0m");
      } else {
        args[0] = getDate() + name + " " + args[0];
      }
    }
    function getDate() {
      if (exports2.inspectOpts.hideDate) {
        return "";
      }
      return (/* @__PURE__ */ new Date()).toISOString() + " ";
    }
    function log(...args) {
      return process.stderr.write(util.formatWithOptions(exports2.inspectOpts, ...args) + "\n");
    }
    function save(namespaces) {
      if (namespaces) {
        process.env.DEBUG = namespaces;
      } else {
        delete process.env.DEBUG;
      }
    }
    function load() {
      return process.env.DEBUG;
    }
    function init(debug) {
      debug.inspectOpts = {};
      const keys = Object.keys(exports2.inspectOpts);
      for (let i = 0; i < keys.length; i++) {
        debug.inspectOpts[keys[i]] = exports2.inspectOpts[keys[i]];
      }
    }
    module2.exports = require_common()(exports2);
    var { formatters } = module2.exports;
    formatters.o = function(v) {
      this.inspectOpts.colors = this.useColors;
      return util.inspect(v, this.inspectOpts).split("\n").map((str) => str.trim()).join(" ");
    };
    formatters.O = function(v) {
      this.inspectOpts.colors = this.useColors;
      return util.inspect(v, this.inspectOpts);
    };
  }
});

// ../Developer/CultureFlow-New/node_modules/debug/src/index.js
var require_src = __commonJS({
  "../Developer/CultureFlow-New/node_modules/debug/src/index.js"(exports2, module2) {
    if (typeof process === "undefined" || process.type === "renderer" || process.browser === true || process.__nwjs) {
      module2.exports = require_browser();
    } else {
      module2.exports = require_node();
    }
  }
});

// ../Developer/CultureFlow-New/node_modules/deepmerge/dist/cjs.js
var require_cjs = __commonJS({
  "../Developer/CultureFlow-New/node_modules/deepmerge/dist/cjs.js"(exports2, module2) {
    "use strict";
    var isMergeableObject = function isMergeableObject2(value) {
      return isNonNullObject(value) && !isSpecial(value);
    };
    function isNonNullObject(value) {
      return !!value && typeof value === "object";
    }
    function isSpecial(value) {
      var stringValue = Object.prototype.toString.call(value);
      return stringValue === "[object RegExp]" || stringValue === "[object Date]" || isReactElement(value);
    }
    var canUseSymbol = typeof Symbol === "function" && Symbol.for;
    var REACT_ELEMENT_TYPE = canUseSymbol ? /* @__PURE__ */ Symbol.for("react.element") : 60103;
    function isReactElement(value) {
      return value.$$typeof === REACT_ELEMENT_TYPE;
    }
    function emptyTarget(val) {
      return Array.isArray(val) ? [] : {};
    }
    function cloneUnlessOtherwiseSpecified(value, options) {
      return options.clone !== false && options.isMergeableObject(value) ? deepmerge(emptyTarget(value), value, options) : value;
    }
    function defaultArrayMerge(target, source, options) {
      return target.concat(source).map(function(element) {
        return cloneUnlessOtherwiseSpecified(element, options);
      });
    }
    function getMergeFunction(key, options) {
      if (!options.customMerge) {
        return deepmerge;
      }
      var customMerge = options.customMerge(key);
      return typeof customMerge === "function" ? customMerge : deepmerge;
    }
    function getEnumerableOwnPropertySymbols(target) {
      return Object.getOwnPropertySymbols ? Object.getOwnPropertySymbols(target).filter(function(symbol) {
        return Object.propertyIsEnumerable.call(target, symbol);
      }) : [];
    }
    function getKeys(target) {
      return Object.keys(target).concat(getEnumerableOwnPropertySymbols(target));
    }
    function propertyIsOnObject(object, property) {
      try {
        return property in object;
      } catch (_) {
        return false;
      }
    }
    function propertyIsUnsafe(target, key) {
      return propertyIsOnObject(target, key) && !(Object.hasOwnProperty.call(target, key) && Object.propertyIsEnumerable.call(target, key));
    }
    function mergeObject(target, source, options) {
      var destination = {};
      if (options.isMergeableObject(target)) {
        getKeys(target).forEach(function(key) {
          destination[key] = cloneUnlessOtherwiseSpecified(target[key], options);
        });
      }
      getKeys(source).forEach(function(key) {
        if (propertyIsUnsafe(target, key)) {
          return;
        }
        if (propertyIsOnObject(target, key) && options.isMergeableObject(source[key])) {
          destination[key] = getMergeFunction(key, options)(target[key], source[key], options);
        } else {
          destination[key] = cloneUnlessOtherwiseSpecified(source[key], options);
        }
      });
      return destination;
    }
    function deepmerge(target, source, options) {
      options = options || {};
      options.arrayMerge = options.arrayMerge || defaultArrayMerge;
      options.isMergeableObject = options.isMergeableObject || isMergeableObject;
      options.cloneUnlessOtherwiseSpecified = cloneUnlessOtherwiseSpecified;
      var sourceIsArray = Array.isArray(source);
      var targetIsArray = Array.isArray(target);
      var sourceAndTargetTypesMatch = sourceIsArray === targetIsArray;
      if (!sourceAndTargetTypesMatch) {
        return cloneUnlessOtherwiseSpecified(source, options);
      } else if (sourceIsArray) {
        return options.arrayMerge(target, source, options);
      } else {
        return mergeObject(target, source, options);
      }
    }
    deepmerge.all = function deepmergeAll(array, options) {
      if (!Array.isArray(array)) {
        throw new Error("first argument should be an array");
      }
      return array.reduce(function(prev, next) {
        return deepmerge(prev, next, options);
      }, {});
    };
    var deepmerge_1 = deepmerge;
    module2.exports = deepmerge_1;
  }
});

// ../Developer/CultureFlow-New/node_modules/puppeteer-extra/dist/index.cjs.js
var require_index_cjs = __commonJS({
  "../Developer/CultureFlow-New/node_modules/puppeteer-extra/dist/index.cjs.js"(exports2, module2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    function _interopDefault(ex) {
      return ex && typeof ex === "object" && "default" in ex ? ex["default"] : ex;
    }
    var Debug = _interopDefault(require_src());
    var merge = _interopDefault(require_cjs());
    var debug = Debug("puppeteer-extra");
    var PuppeteerExtra = class {
      constructor(_pptr, _requireError) {
        this._pptr = _pptr;
        this._requireError = _requireError;
        this._plugins = [];
      }
      /**
       * The **main interface** to register `puppeteer-extra` plugins.
       *
       * @example
       * puppeteer.use(plugin1).use(plugin2)
       *
       * @see [PuppeteerExtraPlugin]
       *
       * @return The same `PuppeteerExtra` instance (for optional chaining)
       */
      use(plugin) {
        if (typeof plugin !== "object" || !plugin._isPuppeteerExtraPlugin) {
          console.error(`Warning: Plugin is not derived from PuppeteerExtraPlugin, ignoring.`, plugin);
          return this;
        }
        if (!plugin.name) {
          console.error(`Warning: Plugin with no name registering, ignoring.`, plugin);
          return this;
        }
        if (plugin.requirements.has("dataFromPlugins")) {
          plugin.getDataFromPlugins = this.getPluginData.bind(this);
        }
        plugin._register(Object.getPrototypeOf(plugin));
        this._plugins.push(plugin);
        debug("plugin registered", plugin.name);
        return this;
      }
      /**
       * To stay backwards compatible with puppeteer's (and our) default export after adding `addExtra`
       * we need to defer the check if we have a puppeteer instance to work with.
       * Otherwise we would throw even if the user intends to use their non-standard puppeteer implementation.
       *
       * @private
       */
      get pptr() {
        if (this._pptr) {
          return this._pptr;
        }
        console.warn(`
    Puppeteer is missing. :-)

    Note: puppeteer is a peer dependency of puppeteer-extra,
    which means you can install your own preferred version.

    - To get the latest stable version run: 'yarn add puppeteer' or 'npm i puppeteer'

    Alternatively:
    - To get puppeteer without the bundled Chromium browser install 'puppeteer-core'
    `);
        throw this._requireError || new Error("No puppeteer instance provided.");
      }
      /**
       * The method launches a browser instance with given arguments. The browser will be closed when the parent node.js process is closed.
       *
       * Augments the original `puppeteer.launch` method with plugin lifecycle methods.
       *
       * All registered plugins that have a `beforeLaunch` method will be called
       * in sequence to potentially update the `options` Object before launching the browser.
       *
       * @example
       * const browser = await puppeteer.launch({
       *   headless: false,
       *   defaultViewport: null
       * })
       *
       * @param options - See [puppeteer docs](https://github.com/puppeteer/puppeteer/blob/master/docs/api.md#puppeteerlaunchoptions).
       */
      async launch(options) {
        const defaultLaunchOptions = { args: [] };
        options = merge(defaultLaunchOptions, options || {});
        this.resolvePluginDependencies();
        this.orderPlugins();
        options = await this.callPluginsWithValue("beforeLaunch", options);
        const opts = {
          context: "launch",
          options,
          defaultArgs: this.defaultArgs
        };
        this.checkPluginRequirements(opts);
        const browser = await this.pptr.launch(options);
        this._patchPageCreationMethods(browser);
        await this.callPlugins("_bindBrowserEvents", browser, opts);
        return browser;
      }
      /**
       * Attach Puppeteer to an existing Chromium instance.
       *
       * Augments the original `puppeteer.connect` method with plugin lifecycle methods.
       *
       * All registered plugins that have a `beforeConnect` method will be called
       * in sequence to potentially update the `options` Object before launching the browser.
       *
       * @param options - See [puppeteer docs](https://github.com/puppeteer/puppeteer/blob/master/docs/api.md#puppeteerconnectoptions).
       */
      async connect(options) {
        this.resolvePluginDependencies();
        this.orderPlugins();
        options = await this.callPluginsWithValue("beforeConnect", options);
        const opts = { context: "connect", options };
        this.checkPluginRequirements(opts);
        const browser = await this.pptr.connect(options);
        this._patchPageCreationMethods(browser);
        await this.callPlugins("_bindBrowserEvents", browser, opts);
        return browser;
      }
      /**
       * The default flags that Chromium will be launched with.
       *
       * @param options - See [puppeteer docs](https://github.com/puppeteer/puppeteer/blob/master/docs/api.md#puppeteerdefaultargsoptions).
       */
      defaultArgs(options) {
        return this.pptr.defaultArgs(options);
      }
      /** Path where Puppeteer expects to find bundled Chromium. */
      executablePath() {
        return this.pptr.executablePath();
      }
      /**
       * This methods attaches Puppeteer to an existing Chromium instance.
       *
       * @param options - See [puppeteer docs](https://github.com/puppeteer/puppeteer/blob/master/docs/api.md#puppeteercreatebrowserfetcheroptions).
       */
      createBrowserFetcher(options) {
        return this.pptr.createBrowserFetcher(options);
      }
      /**
       * Patch page creation methods (both regular and incognito contexts).
       *
       * Unfortunately it's possible that the `targetcreated` events are not triggered
       * early enough for listeners (e.g. plugins using `onPageCreated`) to be able to
       * modify the page instance (e.g. user-agent) before the browser request occurs.
       *
       * This only affects the first request of a newly created page target.
       *
       * As a workaround I've noticed that navigating to `about:blank` (again),
       * right after a page has been created reliably fixes this issue and adds
       * no noticable delay or side-effects.
       *
       * This problem is not specific to `puppeteer-extra` but default Puppeteer behaviour.
       *
       * Note: This patch only fixes explicitly created pages, implicitly created ones
       * (e.g. through `window.open`) are still subject to this issue. I didn't find a
       * reliable mitigation for implicitly created pages yet.
       *
       * Puppeteer issues:
       * https://github.com/GoogleChrome/puppeteer/issues/2669
       * https://github.com/puppeteer/puppeteer/issues/3667
       * https://github.com/GoogleChrome/puppeteer/issues/386#issuecomment-343059315
       * https://github.com/GoogleChrome/puppeteer/issues/1378#issue-273733905
       *
       * @private
       */
      _patchPageCreationMethods(browser) {
        if (!browser._createPageInContext) {
          debug("warning: _patchPageCreationMethods failed (no browser._createPageInContext)");
          return;
        }
        browser._createPageInContext = /* @__PURE__ */ (function(originalMethod, context) {
          return async function() {
            const page = await originalMethod.apply(context, arguments);
            await page.goto("about:blank");
            return page;
          };
        })(browser._createPageInContext, browser);
      }
      /**
       * Get a list of all registered plugins.
       *
       * @member {Array<PuppeteerExtraPlugin>}
       */
      get plugins() {
        return this._plugins;
      }
      /**
       * Get the names of all registered plugins.
       *
       * @member {Array<string>}
       * @private
       */
      get pluginNames() {
        return this._plugins.map((p) => p.name);
      }
      /**
       * Collects the exposed `data` property of all registered plugins.
       * Will be reduced/flattened to a single array.
       *
       * Can be accessed by plugins that listed the `dataFromPlugins` requirement.
       *
       * Implemented mainly for plugins that need data from other plugins (e.g. `user-preferences`).
       *
       * @see [PuppeteerExtraPlugin]/data
       * @param name - Filter data by optional plugin name
       *
       * @private
       */
      getPluginData(name) {
        const data = this._plugins.map((p) => Array.isArray(p.data) ? p.data : [p.data]).reduce((acc, arr) => [...acc, ...arr], []);
        return name ? data.filter((d) => d.name === name) : data;
      }
      /**
       * Get all plugins that feature a given property/class method.
       *
       * @private
       */
      getPluginsByProp(prop) {
        return this._plugins.filter((plugin) => prop in plugin);
      }
      /**
       * Lightweight plugin dependency management to require plugins and code mods on demand.
       *
       * This uses the `dependencies` stanza (a `Set`) exposed by `puppeteer-extra` plugins.
       *
       * @todo Allow objects as depdencies that contains opts for the requested plugin.
       *
       * @private
       */
      resolvePluginDependencies() {
        const missingPlugins = this._plugins.map((p) => p._getMissingDependencies(this._plugins)).reduce((combined, list) => {
          return /* @__PURE__ */ new Set([...combined, ...list]);
        }, /* @__PURE__ */ new Set());
        if (!missingPlugins.size) {
          debug("no dependencies are missing");
          return;
        }
        debug("dependencies missing", missingPlugins);
        for (let name of [...missingPlugins]) {
          if (this.pluginNames.includes(name)) {
            debug(`ignoring dependency '${name}', which has been required already.`);
            continue;
          }
          name = name.startsWith("puppeteer-extra-plugin") ? name : `puppeteer-extra-plugin-${name}`;
          const packageName = name.split("/")[0];
          let dep = null;
          try {
            dep = require(name)();
            this.use(dep);
          } catch (err) {
            console.warn(`
          A plugin listed '${name}' as dependency,
          which is currently missing. Please install it:

          yarn add ${packageName}

          Note: You don't need to require the plugin yourself,
          unless you want to modify it's default settings.
          `);
            throw err;
          }
          if (dep.dependencies.size) {
            this.resolvePluginDependencies();
          }
        }
      }
      /**
       * Order plugins that have expressed a special placement requirement.
       *
       * This is useful/necessary for e.g. plugins that depend on the data from other plugins.
       *
       * @todo Support more than 'runLast'.
       * @todo If there are multiple plugins defining 'runLast', sort them depending on who depends on whom. :D
       *
       * @private
       */
      orderPlugins() {
        debug("orderPlugins:before", this.pluginNames);
        const runLast = this._plugins.filter((p) => p.requirements.has("runLast")).map((p) => p.name);
        for (const name of runLast) {
          const index = this._plugins.findIndex((p) => p.name === name);
          this._plugins.push(this._plugins.splice(index, 1)[0]);
        }
        debug("orderPlugins:after", this.pluginNames);
      }
      /**
       * Lightweight plugin requirement checking.
       *
       * The main intent is to notify the user when a plugin won't work as expected.
       *
       * @todo This could be improved, e.g. be evaluated by the plugin base class.
       *
       * @private
       */
      checkPluginRequirements(opts = {}) {
        for (const plugin of this._plugins) {
          for (const requirement of plugin.requirements) {
            if (opts.context === "launch" && requirement === "headful" && opts.options.headless) {
              console.warn(`Warning: Plugin '${plugin.name}' is not supported in headless mode.`);
            }
            if (opts.context === "connect" && requirement === "launch") {
              console.warn(`Warning: Plugin '${plugin.name}' doesn't support puppeteer.connect().`);
            }
          }
        }
      }
      /**
       * Call plugins sequentially with the same values.
       * Plugins that expose the supplied property will be called.
       *
       * @param prop - The plugin property to call
       * @param values - Any number of values
       * @private
       */
      async callPlugins(prop, ...values) {
        for (const plugin of this.getPluginsByProp(prop)) {
          await plugin[prop].apply(plugin, values);
        }
      }
      /**
       * Call plugins sequentially and pass on a value (waterfall style).
       * Plugins that expose the supplied property will be called.
       *
       * The plugins can either modify the value or return an updated one.
       * Will return the latest, updated value which ran through all plugins.
       *
       * @param prop - The plugin property to call
       * @param value - Any value
       * @return The new updated value
       * @private
       */
      async callPluginsWithValue(prop, value) {
        for (const plugin of this.getPluginsByProp(prop)) {
          const newValue = await plugin[prop](value);
          if (newValue) {
            value = newValue;
          }
        }
        return value;
      }
    };
    var defaultExport = (() => {
      return new PuppeteerExtra(...requireVanillaPuppeteer());
    })();
    var addExtra = (puppeteer2) => new PuppeteerExtra(puppeteer2);
    function requireVanillaPuppeteer() {
      try {
        return [require("puppeteer"), void 0];
      } catch (_) {
      }
      try {
        return [require("puppeteer-core"), void 0];
      } catch (err) {
        return [void 0, err];
      }
    }
    exports2.PuppeteerExtra = PuppeteerExtra;
    exports2.addExtra = addExtra;
    exports2.default = defaultExport;
    module2.exports = exports2.default || {};
    Object.entries(exports2).forEach(([key, value]) => {
      module2.exports[key] = value;
    });
  }
});

// ../Developer/CultureFlow-New/node_modules/arr-union/index.js
var require_arr_union = __commonJS({
  "../Developer/CultureFlow-New/node_modules/arr-union/index.js"(exports2, module2) {
    "use strict";
    module2.exports = function union(init) {
      if (!Array.isArray(init)) {
        throw new TypeError("arr-union expects the first argument to be an array.");
      }
      var len = arguments.length;
      var i = 0;
      while (++i < len) {
        var arg = arguments[i];
        if (!arg) continue;
        if (!Array.isArray(arg)) {
          arg = [arg];
        }
        for (var j = 0; j < arg.length; j++) {
          var ele = arg[j];
          if (init.indexOf(ele) >= 0) {
            continue;
          }
          init.push(ele);
        }
      }
      return init;
    };
  }
});

// ../Developer/CultureFlow-New/node_modules/lazy-cache/index.js
var require_lazy_cache = __commonJS({
  "../Developer/CultureFlow-New/node_modules/lazy-cache/index.js"(exports2, module2) {
    "use strict";
    function lazyCache(fn) {
      var cache = {};
      var proxy = function(mod, name) {
        name = name || camelcase(mod);
        if (process.env.UNLAZY === "true" || process.env.UNLAZY === true || process.env.TRAVIS) {
          cache[name] = fn(mod);
        }
        Object.defineProperty(proxy, name, {
          enumerable: true,
          configurable: true,
          get: getter
        });
        function getter() {
          if (cache.hasOwnProperty(name)) {
            return cache[name];
          }
          return cache[name] = fn(mod);
        }
        return getter;
      };
      return proxy;
    }
    function camelcase(str) {
      if (str.length === 1) {
        return str.toLowerCase();
      }
      str = str.replace(/^[\W_]+|[\W_]+$/g, "").toLowerCase();
      return str.replace(/[\W_]+(\w|$)/g, function(_, ch) {
        return ch.toUpperCase();
      });
    }
    module2.exports = lazyCache;
  }
});

// ../Developer/CultureFlow-New/node_modules/for-in/index.js
var require_for_in = __commonJS({
  "../Developer/CultureFlow-New/node_modules/for-in/index.js"(exports2, module2) {
    "use strict";
    module2.exports = function forIn(obj, fn, thisArg) {
      for (var key in obj) {
        if (fn.call(thisArg, obj[key], key, obj) === false) {
          break;
        }
      }
    };
  }
});

// ../Developer/CultureFlow-New/node_modules/for-own/index.js
var require_for_own = __commonJS({
  "../Developer/CultureFlow-New/node_modules/for-own/index.js"(exports2, module2) {
    "use strict";
    var forIn = require_for_in();
    var hasOwn = Object.prototype.hasOwnProperty;
    module2.exports = function forOwn(obj, fn, thisArg) {
      forIn(obj, function(val, key) {
        if (hasOwn.call(obj, key)) {
          return fn.call(thisArg, obj[key], key, obj);
        }
      });
    };
  }
});

// ../Developer/CultureFlow-New/node_modules/clone-deep/utils.js
var require_utils = __commonJS({
  "../Developer/CultureFlow-New/node_modules/clone-deep/utils.js"(exports2, module2) {
    "use strict";
    var utils = require_lazy_cache()(require);
    var fn = require;
    require = utils;
    require("is-plain-object", "isObject");
    require("shallow-clone", "clone");
    require("kind-of", "typeOf");
    require_for_own();
    require = fn;
    module2.exports = utils;
  }
});

// ../Developer/CultureFlow-New/node_modules/clone-deep/index.js
var require_clone_deep = __commonJS({
  "../Developer/CultureFlow-New/node_modules/clone-deep/index.js"(exports2, module2) {
    "use strict";
    var utils = require_utils();
    function cloneDeep(val, instanceClone) {
      switch (utils.typeOf(val)) {
        case "object":
          return cloneObjectDeep(val, instanceClone);
        case "array":
          return cloneArrayDeep(val, instanceClone);
        default:
          return utils.clone(val);
      }
    }
    function cloneObjectDeep(obj, instanceClone) {
      if (utils.isObject(obj)) {
        var res = {};
        utils.forOwn(obj, function(obj2, key) {
          this[key] = cloneDeep(obj2, instanceClone);
        }, res);
        return res;
      } else if (instanceClone) {
        return instanceClone(obj);
      } else {
        return obj;
      }
    }
    function cloneArrayDeep(arr, instanceClone) {
      var len = arr.length, res = [];
      var i = -1;
      while (++i < len) {
        res[i] = cloneDeep(arr[i], instanceClone);
      }
      return res;
    }
    module2.exports = cloneDeep;
  }
});

// ../Developer/CultureFlow-New/node_modules/is-buffer/index.js
var require_is_buffer = __commonJS({
  "../Developer/CultureFlow-New/node_modules/is-buffer/index.js"(exports2, module2) {
    module2.exports = function(obj) {
      return obj != null && (isBuffer(obj) || isSlowBuffer(obj) || !!obj._isBuffer);
    };
    function isBuffer(obj) {
      return !!obj.constructor && typeof obj.constructor.isBuffer === "function" && obj.constructor.isBuffer(obj);
    }
    function isSlowBuffer(obj) {
      return typeof obj.readFloatLE === "function" && typeof obj.slice === "function" && isBuffer(obj.slice(0, 0));
    }
  }
});

// ../Developer/CultureFlow-New/node_modules/kind-of/index.js
var require_kind_of = __commonJS({
  "../Developer/CultureFlow-New/node_modules/kind-of/index.js"(exports2, module2) {
    var isBuffer = require_is_buffer();
    var toString = Object.prototype.toString;
    module2.exports = function kindOf(val) {
      if (typeof val === "undefined") {
        return "undefined";
      }
      if (val === null) {
        return "null";
      }
      if (val === true || val === false || val instanceof Boolean) {
        return "boolean";
      }
      if (typeof val === "string" || val instanceof String) {
        return "string";
      }
      if (typeof val === "number" || val instanceof Number) {
        return "number";
      }
      if (typeof val === "function" || val instanceof Function) {
        return "function";
      }
      if (typeof Array.isArray !== "undefined" && Array.isArray(val)) {
        return "array";
      }
      if (val instanceof RegExp) {
        return "regexp";
      }
      if (val instanceof Date) {
        return "date";
      }
      var type = toString.call(val);
      if (type === "[object RegExp]") {
        return "regexp";
      }
      if (type === "[object Date]") {
        return "date";
      }
      if (type === "[object Arguments]") {
        return "arguments";
      }
      if (type === "[object Error]") {
        return "error";
      }
      if (isBuffer(val)) {
        return "buffer";
      }
      if (type === "[object Set]") {
        return "set";
      }
      if (type === "[object WeakSet]") {
        return "weakset";
      }
      if (type === "[object Map]") {
        return "map";
      }
      if (type === "[object WeakMap]") {
        return "weakmap";
      }
      if (type === "[object Symbol]") {
        return "symbol";
      }
      if (type === "[object Int8Array]") {
        return "int8array";
      }
      if (type === "[object Uint8Array]") {
        return "uint8array";
      }
      if (type === "[object Uint8ClampedArray]") {
        return "uint8clampedarray";
      }
      if (type === "[object Int16Array]") {
        return "int16array";
      }
      if (type === "[object Uint16Array]") {
        return "uint16array";
      }
      if (type === "[object Int32Array]") {
        return "int32array";
      }
      if (type === "[object Uint32Array]") {
        return "uint32array";
      }
      if (type === "[object Float32Array]") {
        return "float32array";
      }
      if (type === "[object Float64Array]") {
        return "float64array";
      }
      return "object";
    };
  }
});

// ../Developer/CultureFlow-New/node_modules/merge-deep/index.js
var require_merge_deep = __commonJS({
  "../Developer/CultureFlow-New/node_modules/merge-deep/index.js"(exports2, module2) {
    "use strict";
    var union = require_arr_union();
    var clone = require_clone_deep();
    var typeOf = require_kind_of();
    module2.exports = function mergeDeep(orig, objects) {
      if (!isObject(orig) && !Array.isArray(orig)) {
        orig = {};
      }
      var target = clone(orig);
      var len = arguments.length;
      var idx = 0;
      while (++idx < len) {
        var val = arguments[idx];
        if (isObject(val) || Array.isArray(val)) {
          merge(target, val);
        }
      }
      return target;
    };
    function merge(target, obj) {
      for (var key in obj) {
        if (!isValidKey(key) || !hasOwn(obj, key)) {
          continue;
        }
        var oldVal = obj[key];
        var newVal = target[key];
        if (isObject(newVal) && isObject(oldVal)) {
          target[key] = merge(newVal, oldVal);
        } else if (Array.isArray(newVal)) {
          target[key] = union([], newVal, oldVal);
        } else {
          target[key] = clone(oldVal);
        }
      }
      return target;
    }
    function hasOwn(obj, key) {
      return Object.prototype.hasOwnProperty.call(obj, key);
    }
    function isObject(val) {
      return typeOf(val) === "object" || typeOf(val) === "function";
    }
    function isValidKey(key) {
      return key !== "__proto__" && key !== "constructor" && key !== "prototype";
    }
  }
});

// ../Developer/CultureFlow-New/node_modules/puppeteer-extra-plugin/dist/index.cjs.js
var require_index_cjs2 = __commonJS({
  "../Developer/CultureFlow-New/node_modules/puppeteer-extra-plugin/dist/index.cjs.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    function _interopDefault(ex) {
      return ex && typeof ex === "object" && "default" in ex ? ex["default"] : ex;
    }
    var debug = _interopDefault(require_src());
    var merge = require_merge_deep();
    var PuppeteerExtraPlugin = class {
      constructor(opts) {
        this._debugBase = debug(`puppeteer-extra-plugin:base:${this.name}`);
        this._childClassMembers = [];
        this._opts = merge(this.defaults, opts || {});
        this._debugBase("Initialized.");
      }
      /**
       * Plugin name (required).
       *
       * Convention:
       * - Package: `puppeteer-extra-plugin-anonymize-ua`
       * - Name: `anonymize-ua`
       *
       * @example
       * get name () { return 'anonymize-ua' }
       */
      get name() {
        throw new Error('Plugin must override "name"');
      }
      /**
       * Plugin defaults (optional).
       *
       * If defined will be ([deep-](https://github.com/jonschlinkert/merge-deep))merged with the (optional) user supplied options (supplied during plugin instantiation).
       *
       * The result of merging defaults with user supplied options can be accessed through `this.opts`.
       *
       * @see [[opts]]
       *
       * @example
       * get defaults () {
       *   return {
       *     stripHeadless: true,
       *     makeWindows: true,
       *     customFn: null
       *   }
       * }
       *
       * // Users can overwrite plugin defaults during instantiation:
       * puppeteer.use(require('puppeteer-extra-plugin-foobar')({ makeWindows: false }))
       */
      get defaults() {
        return {};
      }
      /**
       * Plugin requirements (optional).
       *
       * Signal certain plugin requirements to the base class and the user.
       *
       * Currently supported:
       * - `launch`
       *   - If the plugin only supports locally created browser instances (no `puppeteer.connect()`),
       *     will output a warning to the user.
       * - `headful`
       *   - If the plugin doesn't work in `headless: true` mode,
       *     will output a warning to the user.
       * - `dataFromPlugins`
       *   - In case the plugin requires data from other plugins.
       *     will enable usage of `this.getDataFromPlugins()`.
       * - `runLast`
       *   - In case the plugin prefers to run after the others.
       *     Useful when the plugin needs data from others.
       *
       * @example
       * get requirements () {
       *   return new Set(['runLast', 'dataFromPlugins'])
       * }
       */
      get requirements() {
        return /* @__PURE__ */ new Set([]);
      }
      /**
       * Plugin dependencies (optional).
       *
       * Missing plugins will be required() by puppeteer-extra.
       *
       * @example
       * get dependencies () {
       *   return new Set(['user-preferences'])
       * }
       * // Will ensure the 'puppeteer-extra-plugin-user-preferences' plugin is loaded.
       */
      get dependencies() {
        return /* @__PURE__ */ new Set([]);
      }
      /**
       * Plugin data (optional).
       *
       * Plugins can expose data (an array of objects), which in turn can be consumed by other plugins,
       * that list the `dataFromPlugins` requirement (by using `this.getDataFromPlugins()`).
       *
       * Convention: `[ {name: 'Any name', value: 'Any value'} ]`
       *
       * @see [[getDataFromPlugins]]
       *
       * @example
       * // plugin1.js
       * get data () {
       *   return [
       *     {
       *       name: 'userPreferences',
       *       value: { foo: 'bar' }
       *     },
       *     {
       *       name: 'userPreferences',
       *       value: { hello: 'world' }
       *     }
       *   ]
       *
       * // plugin2.js
       * get requirements () { return new Set(['dataFromPlugins']) }
       *
       * async beforeLaunch () {
       *   const prefs = this.getDataFromPlugins('userPreferences').map(d => d.value)
       *   this.debug(prefs) // => [ { foo: 'bar' }, { hello: 'world' } ]
       * }
       */
      get data() {
        return [];
      }
      /**
       * Access the plugin options (usually the `defaults` merged with user defined options)
       *
       * To skip the auto-merging of defaults with user supplied opts don't define a `defaults`
       * property and set the `this._opts` Object in your plugin constructor directly.
       *
       * @see [[defaults]]
       *
       * @example
       * get defaults () { return { foo: "bar" } }
       *
       * async onPageCreated (page) {
       *   this.debug(this.opts.foo) // => bar
       * }
       */
      get opts() {
        return this._opts;
      }
      /**
       *  Convenience debug logger based on the [debug] module.
       *  Will automatically namespace the logging output to the plugin package name.
       *  [debug]: https://www.npmjs.com/package/debug
       *
       *  ```bash
       *  # toggle output using environment variables
       *  DEBUG=puppeteer-extra-plugin:<plugin_name> node foo.js
       *  # to debug all the things:
       *  DEBUG=puppeteer-extra,puppeteer-extra-plugin:* node foo.js
       *  ```
       *
       * @example
       * this.debug('hello world')
       * // will output e.g. 'puppeteer-extra-plugin:anonymize-ua hello world'
       */
      get debug() {
        return debug(`puppeteer-extra-plugin:${this.name}`);
      }
      /**
       * Before a new browser instance is created/launched.
       *
       * Can be used to modify the puppeteer launch options by modifying or returning them.
       *
       * Plugins using this method will be called in sequence to each
       * be able to update the launch options.
       *
       * @example
       * async beforeLaunch (options) {
       *   if (this.opts.flashPluginPath) {
       *     options.args.push(`--ppapi-flash-path=${this.opts.flashPluginPath}`)
       *   }
       * }
       *
       * @param options - Puppeteer launch options
       */
      async beforeLaunch(options) {
      }
      /**
       * After the browser has launched.
       *
       * Note: Don't assume that there will only be a single browser instance during the lifecycle of a plugin.
       * It's possible that `pupeeteer.launch` will be  called multiple times and more than one browser created.
       * In order to make the plugins as stateless as possible don't store a reference to the browser instance
       * in the plugin but rather consider alternatives.
       *
       * E.g. when using `onPageCreated` you can get a browser reference by using `page.browser()`.
       *
       * Alternatively you could expose a class method that takes a browser instance as a parameter to work with:
       *
       * ```es6
       * const fancyPlugin = require('puppeteer-extra-plugin-fancy')()
       * puppeteer.use(fancyPlugin)
       * const browser = await puppeteer.launch()
       * await fancyPlugin.killBrowser(browser)
       * ```
       *
       * @param  browser - The `puppeteer` browser instance.
       * @param  opts.options - Puppeteer launch options used.
       *
       * @example
       * async afterLaunch (browser, opts) {
       *   this.debug('browser has been launched', opts.options)
       * }
       */
      async afterLaunch(browser, opts = { options: {} }) {
      }
      /**
       * Before connecting to an existing browser instance.
       *
       * Can be used to modify the puppeteer connect options by modifying or returning them.
       *
       * Plugins using this method will be called in sequence to each
       * be able to update the launch options.
       *
       * @param  {Object} options - Puppeteer connect options
       * @return {Object=}
       */
      async beforeConnect(options) {
      }
      /**
       * After connecting to an existing browser instance.
       *
       * > Note: Don't assume that there will only be a single browser instance during the lifecycle of a plugin.
       *
       * @param browser - The `puppeteer` browser instance.
       * @param  {Object} opts
       * @param  {Object} opts.options - Puppeteer connect options used.
       *
       */
      async afterConnect(browser, opts = {}) {
      }
      /**
       * Called when a browser instance is available.
       *
       * This applies to both `puppeteer.launch()` and `puppeteer.connect()`.
       *
       * Convenience method created for plugins that need access to a browser instance
       * and don't mind if it has been created through `launch` or `connect`.
       *
       * > Note: Don't assume that there will only be a single browser instance during the lifecycle of a plugin.
       *
       * @param browser - The `puppeteer` browser instance.
       */
      async onBrowser(browser, opts) {
      }
      /**
       * Called when a target is created, for example when a new page is opened by window.open or browser.newPage.
       *
       * > Note: This includes target creations in incognito browser contexts.
       *
       * > Note: This includes browser instances created through `.launch()` as well as `.connect()`.
       *
       * @param  {Puppeteer.Target} target
       */
      async onTargetCreated(target) {
      }
      /**
       * Same as `onTargetCreated` but prefiltered to only contain Pages, for convenience.
       *
       * > Note: This includes page creations in incognito browser contexts.
       *
       * > Note: This includes browser instances created through `.launch()` as well as `.connect()`.
       *
       * @param  {Puppeteer.Target} target
       *
       * @example
       * async onPageCreated (page) {
       *   let ua = await page.browser().userAgent()
       *   if (this.opts.stripHeadless) {
       *     ua = ua.replace('HeadlessChrome/', 'Chrome/')
       *   }
       *   this.debug('new ua', ua)
       *   await page.setUserAgent(ua)
       * }
       */
      async onPageCreated(page) {
      }
      /**
       * Called when the url of a target changes.
       *
       * > Note: This includes target changes in incognito browser contexts.
       *
       * > Note: This includes browser instances created through `.launch()` as well as `.connect()`.
       *
       * @param  {Puppeteer.Target} target
       */
      async onTargetChanged(target) {
      }
      /**
       * Called when a target is destroyed, for example when a page is closed.
       *
       * > Note: This includes target destructions in incognito browser contexts.
       *
       * > Note: This includes browser instances created through `.launch()` as well as `.connect()`.
       *
       * @param  {Puppeteer.Target} target
       */
      async onTargetDestroyed(target) {
      }
      /**
       * Called when Puppeteer gets disconnected from the Chromium instance.
       *
       * This might happen because of one of the following:
       * - Chromium is closed or crashed
       * - The `browser.disconnect` method was called
       */
      async onDisconnected() {
      }
      /**
       * **Deprecated:** Since puppeteer v1.6.0 `onDisconnected` has been improved
       * and should be used instead of `onClose`.
       *
       * In puppeteer < v1.6.0 `onDisconnected` was not catching all exit scenarios.
       * In order for plugins to clean up properly (e.g. deleting temporary files)
       * the `onClose` method had been introduced.
       *
       * > Note: Might be called multiple times on exit.
       *
       * > Note: This only includes browser instances created through `.launch()`.
       */
      async onClose() {
      }
      /**
       * After the plugin has been registered in `puppeteer-extra`.
       *
       * Normally right after `puppeteer.use(plugin)` is called
       */
      async onPluginRegistered() {
      }
      /**
       * Helper method to retrieve `data` objects from other plugins.
       *
       * A plugin needs to state the `dataFromPlugins` requirement
       * in order to use this method. Will be mapped to `puppeteer.getPluginData`.
       *
       * @param name - Filter data by `name` property
       *
       * @see [data]
       * @see [requirements]
       */
      getDataFromPlugins(name) {
        return [];
      }
      /**
       * Will match plugin dependencies against all currently registered plugins.
       * Is being called by `puppeteer-extra` and used to require missing dependencies.
       *
       * @param  {Array<Object>} plugins
       * @return {Set} - list of missing plugin names
       *
       * @private
       */
      _getMissingDependencies(plugins) {
        const pluginNames = new Set(plugins.map((p) => p.name));
        const missing = new Set(Array.from(this.dependencies.values()).filter((x) => !pluginNames.has(x)));
        return missing;
      }
      /**
       * Conditionally bind browser/process events to class members.
       * The idea is to reduce event binding boilerplate in plugins.
       *
       * For efficiency we make sure the plugin is using the respective event
       * by checking the child class members before registering the listener.
       *
       * @param  {<Puppeteer.Browser>} browser
       * @param  {Object} opts - Options
       * @param  {string} opts.context - Puppeteer context (launch/connect)
       * @param  {Object} [opts.options] - Puppeteer launch or connect options
       * @param  {Array<string>} [opts.defaultArgs] - The default flags that Chromium will be launched with
       *
       * @private
       */
      async _bindBrowserEvents(browser, opts = {}) {
        if (this._hasChildClassMember("onTargetCreated") || this._hasChildClassMember("onPageCreated")) {
          browser.on("targetcreated", this._onTargetCreated.bind(this));
        }
        if (this._hasChildClassMember("onTargetChanged") && this.onTargetChanged) {
          browser.on("targetchanged", this.onTargetChanged.bind(this));
        }
        if (this._hasChildClassMember("onTargetDestroyed") && this.onTargetDestroyed) {
          browser.on("targetdestroyed", this.onTargetDestroyed.bind(this));
        }
        if (this._hasChildClassMember("onDisconnected") && this.onDisconnected) {
          browser.on("disconnected", this.onDisconnected.bind(this));
        }
        if (opts.context === "launch" && this._hasChildClassMember("onClose")) {
          if (this.onClose) {
            process.on("exit", this.onClose.bind(this));
            browser.on("disconnected", this.onClose.bind(this));
            if (opts.options.handleSIGINT !== false) {
              process.on("SIGINT", this.onClose.bind(this));
            }
            if (opts.options.handleSIGTERM !== false) {
              process.on("SIGTERM", this.onClose.bind(this));
            }
            if (opts.options.handleSIGHUP !== false) {
              process.on("SIGHUP", this.onClose.bind(this));
            }
          }
        }
        if (opts.context === "launch" && this.afterLaunch) {
          await this.afterLaunch(browser, opts);
        }
        if (opts.context === "connect" && this.afterConnect) {
          await this.afterConnect(browser, opts);
        }
        if (this.onBrowser)
          await this.onBrowser(browser, opts);
      }
      /**
       * @private
       */
      async _onTargetCreated(target) {
        if (this.onTargetCreated)
          await this.onTargetCreated(target);
        if (target.type() === "page") {
          try {
            const page = await target.page();
            if (!page) {
              return;
            }
            const validPage = "isClosed" in page && !page.isClosed();
            if (this.onPageCreated && validPage) {
              await this.onPageCreated(page);
            }
          } catch (err) {
            console.error(err);
          }
        }
      }
      /**
       * @private
       */
      _register(prototype) {
        this._registerChildClassMembers(prototype);
        if (this.onPluginRegistered)
          this.onPluginRegistered();
      }
      /**
       * @private
       */
      _registerChildClassMembers(prototype) {
        this._childClassMembers = Object.getOwnPropertyNames(prototype);
      }
      /**
       * @private
       */
      _hasChildClassMember(name) {
        return !!this._childClassMembers.includes(name);
      }
      /**
       * @private
       */
      get _isPuppeteerExtraPlugin() {
        return true;
      }
    };
    exports2.PuppeteerExtraPlugin = PuppeteerExtraPlugin;
  }
});

// ../Developer/CultureFlow-New/node_modules/puppeteer-extra-plugin-stealth/index.js
var require_puppeteer_extra_plugin_stealth = __commonJS({
  "../Developer/CultureFlow-New/node_modules/puppeteer-extra-plugin-stealth/index.js"(exports2, module2) {
    "use strict";
    var { PuppeteerExtraPlugin } = require_index_cjs2();
    var StealthPlugin2 = class extends PuppeteerExtraPlugin {
      constructor(opts = {}) {
        super(opts);
      }
      get name() {
        return "stealth";
      }
      get defaults() {
        const availableEvasions = /* @__PURE__ */ new Set([
          "chrome.app",
          "chrome.csi",
          "chrome.loadTimes",
          "chrome.runtime",
          "defaultArgs",
          "iframe.contentWindow",
          "media.codecs",
          "navigator.hardwareConcurrency",
          "navigator.languages",
          "navigator.permissions",
          "navigator.plugins",
          "navigator.webdriver",
          "sourceurl",
          "user-agent-override",
          "webgl.vendor",
          "window.outerdimensions"
        ]);
        return {
          availableEvasions,
          // Enable all available evasions by default
          enabledEvasions: /* @__PURE__ */ new Set([...availableEvasions])
        };
      }
      /**
       * Requires evasion techniques dynamically based on configuration.
       *
       * @private
       */
      get dependencies() {
        return new Set(
          [...this.opts.enabledEvasions].map((e) => `${this.name}/evasions/${e}`)
        );
      }
      /**
       * Get all available evasions.
       *
       * Please look into the [evasions directory](./evasions/) for an up to date list.
       *
       * @type {Set<string>} - A Set of all available evasions.
       *
       * @example
       * const pluginStealth = require('puppeteer-extra-plugin-stealth')()
       * console.log(pluginStealth.availableEvasions) // => Set { 'user-agent', 'console.debug' }
       * puppeteer.use(pluginStealth)
       */
      get availableEvasions() {
        return this.defaults.availableEvasions;
      }
      /**
       * Get all enabled evasions.
       *
       * Enabled evasions can be configured either through `opts` or by modifying this property.
       *
       * @type {Set<string>} - A Set of all enabled evasions.
       *
       * @example
       * // Remove specific evasion from enabled ones dynamically
       * const pluginStealth = require('puppeteer-extra-plugin-stealth')()
       * pluginStealth.enabledEvasions.delete('console.debug')
       * puppeteer.use(pluginStealth)
       */
      get enabledEvasions() {
        return this.opts.enabledEvasions;
      }
      /**
       * @private
       */
      set enabledEvasions(evasions) {
        this.opts.enabledEvasions = evasions;
      }
      async onBrowser(browser) {
        if (browser && browser.setMaxListeners) {
          browser.setMaxListeners(30);
        }
      }
    };
    var defaultExport = (opts) => new StealthPlugin2(opts);
    module2.exports = defaultExport;
  }
});

// ../Developer/CultureFlow-New/scripts/scrape-museum.ts
var import_puppeteer_extra = __toESM(require_index_cjs());
var import_puppeteer_extra_plugin_stealth = __toESM(require_puppeteer_extra_plugin_stealth());
var import_fs = __toESM(require("fs"));
var import_path = __toESM(require("path"));
import_puppeteer_extra.default.use((0, import_puppeteer_extra_plugin_stealth.default)());
var TARGET_URL = "https://mom-mom.net/search?q=%EB%B0%95%EB%AC%BC%EA%B4%80/%EC%B2%B4%ED%97%98%EA%B4%80&hl=places";
var DATA_PATH = import_path.default.join(process.cwd(), "src/data/museum.json");
var CONCURRENCY_LIMIT = 5;
function slugify(text) {
  return text.replace(/[^a-zA-Z0-9가-힣]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
}
async function scrapeMuseum() {
  const browser = await import_puppeteer_extra.default.launch({
    headless: process.env.HEADLESS !== "false",
    userDataDir: process.env.CHROME_TMPDIR ? require("path").join(process.env.CHROME_TMPDIR, "puppeteer_museum") : void 0,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(TARGET_URL, { waitUntil: "networkidle2", timeout: 6e4 });
    console.log("Scrolling to load all items (~800)...");
    console.log("Scrolling to load all items...");
    let previousHeight = 0;
    let noChangeAttempts = 0;
    const MAX_NO_CHANGE = 10;
    while (noChangeAttempts < MAX_NO_CHANGE) {
      const currentHeight = await page.evaluate(() => document.body.scrollHeight);
      if (currentHeight > previousHeight) {
        previousHeight = currentHeight;
        noChangeAttempts = 0;
      } else {
        noChangeAttempts++;
      }
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await new Promise((r) => setTimeout(r, 2e3));
      const count = await page.evaluate(() => document.querySelectorAll("div.contents > a").length);
      process.stdout.write(`\rLoaded ${count} items...`);
    }
    console.log("\nFinished scrolling.");
    await new Promise((r) => setTimeout(r, 3e3));
    console.log("Extracting list items...");
    const listItems = await page.evaluate(() => {
      const results = [];
      const anchors = document.querySelectorAll("div.contents > a");
      anchors.forEach((a) => {
        const link = a.href;
        const titleEl = a.querySelector(".title > h3");
        const title = titleEl?.textContent?.trim() || "";
        const imgContainer = a.querySelector(".image-container");
        let image = "";
        if (imgContainer) {
          const bgDiv = imgContainer.querySelector('div > div[style*="background-image"]');
          if (bgDiv) {
            const style = window.getComputedStyle(bgDiv);
            const urlMatch = style.backgroundImage.match(/url\("?(.+?)"?\)/);
            if (urlMatch) image = urlMatch[1];
          }
          if (!image) {
            const imgTag = imgContainer.querySelector("img");
            if (imgTag) image = imgTag.src;
          }
        }
        const descEl = a.querySelector("p.description");
        const description = descEl?.textContent?.trim() || "";
        const usageEl = a.querySelector("div.usage-stat");
        const usageStat = usageEl?.textContent?.trim() || "";
        if (title && link) {
          results.push({ title, image, link, description, usageStat });
        }
      });
      return results;
    });
    if (listItems.length === 0) {
      console.error("Museum scraper found 0 items. Creating error marker.");
      import_fs.default.writeFileSync(import_path.default.join(process.cwd(), "src/data/museum.error"), "Museum scraper found 0 items. Check selector: div.contents > a");
      await browser.close();
      return;
    } else {
      const errFile = import_path.default.join(process.cwd(), "src/data/museum.error");
      if (import_fs.default.existsSync(errFile)) import_fs.default.unlinkSync(errFile);
    }
    console.log(`Found ${listItems.length} items. Starting detail scraping...`);
    const finalItems = [];
    const chunkedItems = [];
    for (let i = 0; i < listItems.length; i += CONCURRENCY_LIMIT) {
      chunkedItems.push(listItems.slice(i, i + CONCURRENCY_LIMIT));
    }
    let processedCount = 0;
    for (const chunk of chunkedItems) {
      await Promise.all(chunk.map(async (item) => {
        const detailPage = await browser.newPage();
        await detailPage.setRequestInterception(true);
        detailPage.on("request", (req) => {
          if (["image", "stylesheet", "font"].includes(req.resourceType())) {
            req.abort();
          } else {
            req.continue();
          }
        });
        let address = "";
        try {
          await detailPage.goto(item.link, { waitUntil: "domcontentloaded", timeout: 3e4 });
          address = await detailPage.evaluate(() => {
            const results = {};
            const labels = document.querySelectorAll("section > ul > li > p.label");
            labels.forEach((label) => {
              const key = label.textContent?.trim() || "";
              const valueEl = label.parentElement?.querySelector("p.value, div.value");
              const value = valueEl?.textContent?.trim() || "";
              if (key.includes("\uC8FC\uC18C")) results.address = value;
              if (key.includes("\uC804\uD654")) results.contact = value;
              if (key.includes("\uC601\uC5C5\uC2DC\uAC04")) results.hours = value;
              if (key.includes("\uC2DC\uC124")) results.facilities = value;
            });
            const webBtn = document.querySelector("div.reservation-buttons > a");
            if (webBtn) results.website = webBtn.href;
            let feesAndPrograms = "";
            const allHeadings = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6, dt, span, b, p"));
            const feeHeader = allHeadings.find((h) => h.textContent?.includes("\uC694\uAE08 \uBC0F \uD504\uB85C\uADF8\uB7A8"));
            if (feeHeader) {
              const section = feeHeader.closest("section") || feeHeader.parentElement?.closest("div");
              if (section) feesAndPrograms = section.innerText?.trim() || "";
              else feesAndPrograms = feeHeader.parentElement?.innerText?.trim() || "";
            }
            if (!feesAndPrograms) {
              const sections = Array.from(document.querySelectorAll("section"));
              const feeSection = sections.find((s) => s.innerText?.includes("\uC694\uAE08 \uBC0F \uD504\uB85C\uADF8\uB7A8"));
              if (feeSection) feesAndPrograms = feeSection.innerText?.trim() || "";
              else {
                const f = sections.find((s) => s.innerText?.includes("\uC694\uAE08"));
                if (f) feesAndPrograms = f.innerText?.trim() || "";
              }
            }
            if (!feesAndPrograms) {
              const feesSection = Array.from(document.querySelectorAll("section")).find((s) => s.textContent?.includes("\uC694\uAE08"));
              if (feesSection) feesAndPrograms = feesSection.querySelector("ul")?.textContent?.trim() || "";
            }
            if (feesAndPrograms) {
              results.feesAndPrograms = feesAndPrograms;
            }
            return results;
          });
        } catch (e) {
          console.error(`Failed to scrape details for ${item.title}:`, e);
        } finally {
          await detailPage.close();
        }
        const id = `museum_${slugify(item.title)}`;
        finalItems.push({
          id,
          ...item,
          ...typeof address === "string" ? { address } : address,
          genre: "museum"
        });
        processedCount++;
      }));
      process.stdout.write(`\rProgress: ${processedCount}/${listItems.length}`);
      await new Promise((r) => setTimeout(r, 500));
    }
    console.log("\nScraping complete.");
    const now = (/* @__PURE__ */ new Date()).toISOString();
    let existingData = [];
    if (import_fs.default.existsSync(DATA_PATH)) {
      existingData = JSON.parse(import_fs.default.readFileSync(DATA_PATH, "utf-8"));
    }
    const dataMap = /* @__PURE__ */ new Map();
    existingData.forEach((item) => dataMap.set(item.id, item));
    for (const item of finalItems) {
      const existing = dataMap.get(item.id);
      const merged = {
        ...existing,
        ...item,
        lastCollected: now
      };
      dataMap.set(item.id, merged);
    }
    const allItems = Array.from(dataMap.values());
    import_fs.default.writeFileSync(DATA_PATH, JSON.stringify(allItems, null, 2));
    console.log(`Saved ${allItems.length} items (merged). Updated: ${finalItems.length}.`);
  } catch (error) {
    console.error("Fatal Error:", error);
  } finally {
    await browser.close();
  }
}
scrapeMuseum();
/*! Bundled license information:

puppeteer-extra/dist/index.cjs.js:
  (*!
   * puppeteer-extra v3.3.5 by berstend
   * https://github.com/berstend/puppeteer-extra
   * @license MIT
   *)

for-in/index.js:
  (*!
   * for-in <https://github.com/jonschlinkert/for-in>
   *
   * Copyright (c) 2014-2017, Jon Schlinkert.
   * Released under the MIT License.
   *)

for-own/index.js:
  (*!
   * for-own <https://github.com/jonschlinkert/for-own>
   *
   * Copyright (c) 2014-2017, Jon Schlinkert.
   * Released under the MIT License.
   *)

is-buffer/index.js:
  (*!
   * Determine if an object is a Buffer
   *
   * @author   Feross Aboukhadijeh <https://feross.org>
   * @license  MIT
   *)

merge-deep/index.js:
  (*!
   * merge-deep <https://github.com/jonschlinkert/merge-deep>
   *
   * Copyright (c) 2014-2015, Jon Schlinkert.
   * Licensed under the MIT License.
   *)

puppeteer-extra-plugin/dist/index.cjs.js:
  (*!
   * puppeteer-extra-plugin v3.2.2 by berstend
   * https://github.com/berstend/puppeteer-extra/tree/master/packages/puppeteer-extra-plugin
   * @license MIT
   *)
*/
