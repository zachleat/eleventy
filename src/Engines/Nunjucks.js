const NunjucksLib = require("nunjucks");
const TemplateEngine = require("./TemplateEngine");
const TemplatePath = require("../TemplatePath");
const EleventyErrorUtil = require("../EleventyErrorUtil");
const EleventyBaseError = require("../EleventyBaseError");
const eventBus = require("../EventBus");

/*
 * The IFFE below apply a monkey-patch to Nunjucks internals to cache
 * compiled templates and re-use them where possible.
 */
(function () {
  let templateCache = new Map();

  let getKey = obj => {
    return [
      obj.path || obj.tmplStr,
      obj.tmplStr.length,
      obj.env.asyncFilters.length,
      obj.env.extensionsList
        .map(e => {
          return e.__id || "";
        })
        .join(":"),
    ].join(" :: ");
  };

  let evictByPath = path => {
    let keys = templateCache.keys();
    // Likely to be slow; do we care?
    for (let k of keys) {
      if (k.indexOf(path) >= 0) {
        templateCache.delete(k);
      }
    }
  };
  eventBus.on("resourceModified", evictByPath);

  let _compile = NunjucksLib.Template.prototype._compile;
  NunjucksLib.Template.prototype._compile = function _wrap_compile(...args) {
    if (!this.compiled && !this.tmplProps && templateCache.has(getKey(this))) {
      let pathProps = templateCache.get(getKey(this));
      this.blocks = pathProps.blocks;
      this.rootRenderFunc = pathProps.rootRenderFunc;
      this.compiled = true;
    } else {
      _compile.call(this, ...args);
      templateCache.set(getKey(this), {
        blocks: this.blocks,
        rootRenderFunc: this.rootRenderFunc,
      });
    }
  };

  let extensionIdCounter = 0;
  let addExtension = NunjucksLib.Environment.prototype.addExtension;
  NunjucksLib.Environment.prototype.addExtension = function _wrap_addExtension(
    name,
    ext
  ) {
    if (!("__id" in ext)) {
      ext.__id = extensionIdCounter++;
    }
    return addExtension.call(this, name, ext);
  };

  // NunjucksLib.runtime.Frame.prototype.set is the hotest in-template method.
  // We replace it with a version that doesn't allocate a `parts` array on
  // repeat key use.
  let partsCache = new Map();
  let partsFromCache = name => {
    if (partsCache.has(name)) {
      return partsCache.get(name);
    }

    let parts = name.split(".");
    partsCache.set(name, parts);
    return parts;
  };

  let frameSet = NunjucksLib.runtime.Frame.prototype.set;
  NunjucksLib.runtime.Frame.prototype.set = function _replacement_set(
    name,
    val,
    resolveUp
  ) {
    let parts = partsFromCache(name);
    let frame = this;
    let obj = frame.variables;

    if (resolveUp) {
      if ((frame = this.resolve(parts[0], true))) {
        frame.set(name, val);
        return;
      }
    }

    // A slightly faster version of the intermediate object allocation loop
    let count = parts.length - 1;
    let i = 0;
    let id = parts[0];
    while (i < count) {
      if (!obj.hasOwnProperty(id)) {
        obj = obj[id] = {};
      }
      id = parts[++i];
    }
    obj[id] = val;
  };
})();

class EleventyShortcodeError extends EleventyBaseError {}

class Nunjucks extends TemplateEngine {
  constructor(name, includesDir) {
    super(name, includesDir);

    this.setLibrary(this.config.libraryOverrides.njk);

    this.cacheable = true;
  }

  setLibrary(env) {
    let fsLoader = new NunjucksLib.FileSystemLoader([
      super.getIncludesDir(),
      TemplatePath.getWorkingDir(),
    ]);
    this.njkEnv = env || new NunjucksLib.Environment(fsLoader);
    // Correct, but overbroad. Better would be to evict more granularly, but
    // resolution from paths isn't straightforward.
    eventBus.on("resourceModified", path => {
      this.njkEnv.invalidateCache();
    });

    this.setEngineLib(this.njkEnv);

    this.addFilters(this.config.nunjucksFilters);
    this.addFilters(this.config.nunjucksAsyncFilters, true);

    // TODO these all go to the same place (addTag), add warnings for overwrites
    this.addCustomTags(this.config.nunjucksTags);
    this.addAllShortcodes(this.config.nunjucksShortcodes);
    this.addAllShortcodes(this.config.nunjucksAsyncShortcodes, true);
    this.addAllPairedShortcodes(this.config.nunjucksPairedShortcodes);
    this.addAllPairedShortcodes(
      this.config.nunjucksAsyncPairedShortcodes,
      true
    );
    this.addGlobals(this.config.nunjucksGlobals);
  }

  addFilters(helpers, isAsync) {
    for (let name in helpers) {
      this.njkEnv.addFilter(name, helpers[name], isAsync);
    }
  }

  addCustomTags(tags) {
    for (let name in tags) {
      this.addTag(name, tags[name]);
    }
  }

  addTag(name, tagFn) {
    let tagObj;
    if (typeof tagFn === "function") {
      tagObj = tagFn(NunjucksLib, this.njkEnv);
    } else {
      throw new Error(
        "Nunjucks.addTag expects a callback function to be passed in: addTag(name, function(nunjucksEngine) {})"
      );
    }

    this.njkEnv.addExtension(name, tagObj);
  }

  addGlobals(globals) {
    for (let name in globals) {
      this.addGlobal(name, globals[name]);
    }
  }

  addGlobal(name, globalFn) {
    this.njkEnv.addGlobal(name, globalFn);
  }

  addAllShortcodes(shortcodes, isAsync = false) {
    for (let name in shortcodes) {
      this.addShortcode(name, shortcodes[name], isAsync);
    }
  }

  addAllPairedShortcodes(shortcodes, isAsync = false) {
    for (let name in shortcodes) {
      this.addPairedShortcode(name, shortcodes[name], isAsync);
    }
  }

  static _normalizeShortcodeContext(context) {
    let obj = {};
    if (context.ctx && context.ctx.page) {
      obj.page = context.ctx.page;
    }
    return obj;
  }

  addShortcode(shortcodeName, shortcodeFn, isAsync = false) {
    function ShortcodeFunction() {
      this.tags = [shortcodeName];

      this.parse = function (parser, nodes) {
        let args;
        let tok = parser.nextToken();

        args = parser.parseSignature(true, true);

        // Nunjucks bug with non-paired custom tags bug still exists even
        // though this issue is closed. Works fine for paired.
        // https://github.com/mozilla/nunjucks/issues/158
        if (args.children.length === 0) {
          args.addChild(new nodes.Literal(0, 0, ""));
        }

        parser.advanceAfterBlockEnd(tok.value);
        if (isAsync) {
          return new nodes.CallExtensionAsync(this, "run", args);
        }
        return new nodes.CallExtension(this, "run", args);
      };

      this.run = function (...args) {
        let resolve;
        if (isAsync) {
          resolve = args.pop();
        }

        let [context, ...argArray] = args;

        if (isAsync) {
          shortcodeFn
            .call(Nunjucks._normalizeShortcodeContext(context), ...argArray)
            .then(function (returnValue) {
              resolve(null, new NunjucksLib.runtime.SafeString(returnValue));
            })
            .catch(function (e) {
              resolve(
                new EleventyShortcodeError(
                  `Error with Nunjucks shortcode \`${shortcodeName}\`${EleventyErrorUtil.convertErrorToString(
                    e
                  )}`
                ),
                null
              );
            });
        } else {
          try {
            return new NunjucksLib.runtime.SafeString(
              shortcodeFn.call(
                Nunjucks._normalizeShortcodeContext(context),
                ...argArray
              )
            );
          } catch (e) {
            throw new EleventyShortcodeError(
              `Error with Nunjucks shortcode \`${shortcodeName}\`${EleventyErrorUtil.convertErrorToString(
                e
              )}`
            );
          }
        }
      };
    }

    this.njkEnv.addExtension(shortcodeName, new ShortcodeFunction());
  }

  addPairedShortcode(shortcodeName, shortcodeFn, isAsync = false) {
    function PairedShortcodeFunction() {
      this.tags = [shortcodeName];

      this.parse = function (parser, nodes) {
        var tok = parser.nextToken();

        var args = parser.parseSignature(true, true);
        parser.advanceAfterBlockEnd(tok.value);

        var body = parser.parseUntilBlocks("end" + shortcodeName);
        parser.advanceAfterBlockEnd();

        if (isAsync) {
          return new nodes.CallExtensionAsync(this, "run", args, [body]);
        }
        return new nodes.CallExtension(this, "run", args, [body]);
      };

      this.run = function (...args) {
        let resolve;
        if (isAsync) {
          resolve = args.pop();
        }
        let body = args.pop();
        let [context, ...argArray] = args;

        if (isAsync) {
          shortcodeFn
            .call(
              Nunjucks._normalizeShortcodeContext(context),
              body(),
              ...argArray
            )
            .then(function (returnValue) {
              resolve(null, new NunjucksLib.runtime.SafeString(returnValue));
            })
            .catch(function (e) {
              resolve(
                new EleventyShortcodeError(
                  `Error with Nunjucks paired shortcode \`${shortcodeName}\`${EleventyErrorUtil.convertErrorToString(
                    e
                  )}`
                ),
                null
              );
            });
        } else {
          try {
            return new NunjucksLib.runtime.SafeString(
              shortcodeFn.call(
                Nunjucks._normalizeShortcodeContext(context),
                body(),
                ...argArray
              )
            );
          } catch (e) {
            throw new EleventyShortcodeError(
              `Error with Nunjucks paired shortcode \`${shortcodeName}\`${EleventyErrorUtil.convertErrorToString(
                e
              )}`
            );
          }
        }
      };
    }

    this.njkEnv.addExtension(shortcodeName, new PairedShortcodeFunction());
  }

  async compile(str, inputPath) {
    // Defend against syntax customisations:
    //    https://mozilla.github.io/nunjucks/api.html#customizing-syntax
    let optsTags = this.njkEnv.opts.tags || {};
    let blockStart = optsTags.blockStart || "{%";
    let variableStart = optsTags.variableStart || "{{";
    let commentStart = optsTags.variableStart || "{#";
    let needsCompile =
      str.indexOf(blockStart) != -1 ||
      str.indexOf(variableStart) != -1 ||
      str.indexOf(commentStart) != -1;
    if (!needsCompile) {
      return async function () {
        return str;
      };
    }

    let tmpl;
    if (!inputPath || inputPath === "njk" || inputPath === "md") {
      tmpl = NunjucksLib.compile(str, this.njkEnv);
    } else {
      tmpl = NunjucksLib.compile(str, this.njkEnv, inputPath);
    }
    return async function (data) {
      return new Promise(function (resolve, reject) {
        tmpl.render(data, function (err, res) {
          if (err) {
            reject(err);
          } else {
            resolve(res);
          }
        });
      });
    };
  }
}

module.exports = Nunjucks;
