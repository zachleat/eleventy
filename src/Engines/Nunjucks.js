const NunjucksLib = require("nunjucks");
const TemplateEngine = require("./TemplateEngine");
const TemplatePath = require("../TemplatePath");
const EleventyErrorUtil = require("../EleventyErrorUtil");
const EleventyBaseError = require("../EleventyBaseError");

class EleventyShortcodeError extends EleventyBaseError {}

class Nunjucks extends TemplateEngine {
  constructor(name, includesDir, templateConfig) {
    super(name, includesDir, templateConfig);

    this.setLibrary(this.config.libraryOverrides.njk);

    this.cacheable = true;
  }

  setLibrary(env) {
    this.njkEnv =
      env ||
      new NunjucksLib.Environment(
        new NunjucksLib.FileSystemLoader([
          super.getIncludesDir(),
          TemplatePath.getWorkingDir(),
        ])
      );
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
            // console.log( shortcodeFn.toString() );
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
