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
// (function () {
//   let templateCache = new Map();

//   let getKey = (obj) => {
//     return [
//       obj.path || obj.tmplStr,
//       obj.tmplStr.length,
//       obj.env.asyncFilters.length,
//       obj.env.extensionsList
//         .map((e) => {
//           return e.__id || "";
//         })
//         .join(":"),
//     ].join(" :: ");
//   };

//   let evictByPath = (path) => {
//     let keys = templateCache.keys();
//     // Likely to be slow; do we care?
//     for (let k of keys) {
//       if (k.indexOf(path) >= 0) {
//         templateCache.delete(k);
//       }
//     }
//   };
//   eventBus.on("eleventy.resourceModified", evictByPath);

//   let _compile = NunjucksLib.Template.prototype._compile;
//   NunjucksLib.Template.prototype._compile = function _wrap_compile(...args) {
//     if (!this.compiled && !this.tmplProps && templateCache.has(getKey(this))) {
//       let pathProps = templateCache.get(getKey(this));
//       this.blocks = pathProps.blocks;
//       this.rootRenderFunc = pathProps.rootRenderFunc;
//       this.compiled = true;
//     } else {
//       _compile.call(this, ...args);
//       templateCache.set(getKey(this), {
//         blocks: this.blocks,
//         rootRenderFunc: this.rootRenderFunc,
//       });
//     }
//   };

//   let extensionIdCounter = 0;
//   let addExtension = NunjucksLib.Environment.prototype.addExtension;
//   NunjucksLib.Environment.prototype.addExtension = function _wrap_addExtension(
//     name,
//     ext
//   ) {
//     if (!("__id" in ext)) {
//       ext.__id = extensionIdCounter++;
//     }
//     return addExtension.call(this, name, ext);
//   };

//   // NunjucksLib.runtime.Frame.prototype.set is the hotest in-template method.
//   // We replace it with a version that doesn't allocate a `parts` array on
//   // repeat key use.
//   let partsCache = new Map();
//   let partsFromCache = (name) => {
//     if (partsCache.has(name)) {
//       return partsCache.get(name);
//     }

//     let parts = name.split(".");
//     partsCache.set(name, parts);
//     return parts;
//   };

//   let frameSet = NunjucksLib.runtime.Frame.prototype.set;
//   NunjucksLib.runtime.Frame.prototype.set = function _replacement_set(
//     name,
//     val,
//     resolveUp
//   ) {
//     let parts = partsFromCache(name);
//     let frame = this;
//     let obj = frame.variables;

//     if (resolveUp) {
//       if ((frame = this.resolve(parts[0], true))) {
//         frame.set(name, val);
//         return;
//       }
//     }

//     // A slightly faster version of the intermediate object allocation loop
//     let count = parts.length - 1;
//     let i = 0;
//     let id = parts[0];
//     while (i < count) {
//       if (!obj.hasOwnProperty(id)) {
//         obj = obj[id] = {};
//       }
//       id = parts[++i];
//     }
//     obj[id] = val;
//   };
// })();

class EleventyShortcodeError extends EleventyBaseError {}

class Nunjucks extends TemplateEngine {
  constructor(name, includesDir, config) {
    super(name, includesDir, config);

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
    eventBus.on("eleventy.resourceModified", (path) => {
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

  _getShortcodeFn(shortcodeName, shortcodeFn, isAsync = false) {
    return function ShortcodeFunction() {
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
    };
  }

  _getPairedShortcodeFn(shortcodeName, shortcodeFn, isAsync = false) {
    return function PairedShortcodeFunction() {
      this.tags = [shortcodeName];

      this.parse = function (parser, nodes) {
        var tok = parser.nextToken();

        var args = parser.parseSignature(true, true);
        parser.advanceAfterBlockEnd(tok.value);

        var body = parser.parseUntilBlocks("end" + shortcodeName);
        parser.advanceAfterBlockEnd();

        return new nodes.CallExtensionAsync(this, "run", args, [body]);
      };

      this.run = function (...args) {
        let resolve = args.pop();
        let body = args.pop();
        let [context, ...argArray] = args;

        body(function (e, bodyContent) {
          if (e) {
            resolve(
              new EleventyShortcodeError(
                `Error with Nunjucks paired shortcode \`${shortcodeName}\`${EleventyErrorUtil.convertErrorToString(
                  e
                )}`
              )
            );
          }

          if (isAsync) {
            shortcodeFn
              .call(
                Nunjucks._normalizeShortcodeContext(context),
                bodyContent,
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
              resolve(
                null,
                new NunjucksLib.runtime.SafeString(
                  shortcodeFn.call(
                    Nunjucks._normalizeShortcodeContext(context),
                    bodyContent,
                    ...argArray
                  )
                )
              );
            } catch (e) {
              resolve(
                new EleventyShortcodeError(
                  `Error with Nunjucks paired shortcode \`${shortcodeName}\`${EleventyErrorUtil.convertErrorToString(
                    e
                  )}`
                )
              );
            }
          }
        });
      };
    };
  }

  addShortcode(shortcodeName, shortcodeFn, isAsync = false) {
    let fn = this._getShortcodeFn(shortcodeName, shortcodeFn, isAsync);
    this.njkEnv.addExtension(shortcodeName, new fn());
  }

  addPairedShortcode(shortcodeName, shortcodeFn, isAsync = false) {
    let fn = this._getPairedShortcodeFn(shortcodeName, shortcodeFn, isAsync);
    this.njkEnv.addExtension(shortcodeName, new fn());
  }

  needsCompilation(str) {
    // Defend against syntax customisations:
    //    https://mozilla.github.io/nunjucks/api.html#customizing-syntax
    let optsTags = this.njkEnv.opts.tags || {};
    let blockStart = optsTags.blockStart || "{%";
    let variableStart = optsTags.variableStart || "{{";
    let commentStart = optsTags.variableStart || "{#";
    return (
      str.indexOf(blockStart) !== -1 ||
      str.indexOf(variableStart) !== -1 ||
      str.indexOf(commentStart) !== -1
    );
  }

  _getParseExtensions() {
    if (this._parseExtensions) {
      return this._parseExtensions;
    }

    // add extensions so the parser knows about our custom tags/blocks
    let ext = [];
    for (let name in this.config.nunjucksTags) {
      let fn = this._getShortcodeFn(name, () => {});
      ext.push(new fn());
    }
    for (let name in this.config.nunjucksShortcodes) {
      let fn = this._getShortcodeFn(name, () => {});
      ext.push(new fn());
    }
    for (let name in this.config.nunjucksAsyncShortcodes) {
      let fn = this._getShortcodeFn(name, () => {}, true);
      ext.push(new fn());
    }
    for (let name in this.config.nunjucksPairedShortcodes) {
      let fn = this._getPairedShortcodeFn(name, () => {});
      ext.push(new fn());
    }
    for (let name in this.config.nunjucksAsyncPairedShortcodes) {
      let fn = this._getPairedShortcodeFn(name, () => {}, true);
      ext.push(new fn());
    }

    this._parseExtensions = ext;
    return ext;
  }

  /* Outputs an Array of lodash.get selectors */
  parseForSymbols(str) {
    const { parser, nodes } = NunjucksLib;
    let obj = parser.parse(str, this._getParseExtensions());
    let linesplit = str.split("\n");
    let values = obj.findAll(nodes.Value);
    let symbols = obj.findAll(nodes.Symbol).map((entry) => {
      let name = [entry.value];
      let nestedIndex = -1;
      for (let val of values) {
        if (nestedIndex > -1) {
          /* deep.object.syntax */
          if (linesplit[val.lineno].charAt(nestedIndex) === ".") {
            name.push(val.value);
            nestedIndex += val.value.length + 1;
          } else {
            nestedIndex = -1;
          }
        } else if (
          val.lineno === entry.lineno &&
          val.colno === entry.colno &&
          val.value === entry.value
        ) {
          nestedIndex = entry.colno + entry.value.length;
        }
      }
      return name.join(".");
    });

    return Array.from(new Set(symbols));
  }

  async compile(str, inputPath) {
    if (!this.needsCompilation(str)) {
      return async function () {
        return str;
      };
    }

    // for(let loader of this.njkEnv.loaders) {
    //   loader.cache = {};
    // }

    let tmpl;
    if (!inputPath || inputPath === "njk" || inputPath === "md") {
      tmpl = new NunjucksLib.Template(str, this.njkEnv, null, true);
    } else {
      tmpl = new NunjucksLib.Template(str, this.njkEnv, inputPath, true);
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
