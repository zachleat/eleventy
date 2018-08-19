const NunjucksLib = require("nunjucks");
const TemplateEngine = require("./TemplateEngine");
const config = require("../Config");

class Nunjucks extends TemplateEngine {
  constructor(name, inputDir) {
    super(name, inputDir);

    this.config = config.getConfig();
    this.setLibrary(this.config.libraryOverrides.njk);
  }

  setLibrary(env) {
    this.njkEnv =
      env ||
      new NunjucksLib.Environment(
        new NunjucksLib.FileSystemLoader(super.getInputDir())
      );
    this.setEngineLib(this.njkEnv);

    this.addFilters(this.config.nunjucksFilters);
    this.addFilters(this.config.nunjucksAsyncFilters, true);

    // TODO these all go to the same place (addTag), add warnings for overwrites
    this.addCustomTags(this.config.nunjucksTags);
    this.addAllShortcodes(this.config.nunjucksShortcodes);
    this.addAllPairedShortcodes(this.config.nunjucksPairedShortcodes);
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

  addAllShortcodes(shortcodes) {
    for (let name in shortcodes) {
      this.addShortcode(name, shortcodes[name]);
    }
  }

  addAllPairedShortcodes(shortcodes) {
    for (let name in shortcodes) {
      this.addPairedShortcode(name, shortcodes[name]);
    }
  }

  addShortcode(shortcodeName, shortcodeFn) {
    this.addTag(shortcodeName, function(nunjucksEngine) {
      return new function() {
        this.tags = [shortcodeName];

        this.parse = function(parser, nodes, lexer) {
          var tok = parser.nextToken();

          var args = parser.parseSignature(null, true);
          parser.advanceAfterBlockEnd(tok.value);

          return new nodes.CallExtensionAsync(this, "run", args);
        };

        this.run = function(...args) {
          let callback = args.pop();
          let [context, ...argArray] = args;

          let ret = new nunjucksEngine.runtime.SafeString(
            shortcodeFn(...argArray)
          );
          callback(null, ret);
        };
      }();
    });
  }

  addPairedShortcode(shortcodeName, shortcodeFn) {
    this.addTag(shortcodeName, function(nunjucksEngine, nunjucksEnv) {
      return new function() {
        this.tags = [shortcodeName];

        this.parse = function(parser, nodes, lexer) {
          var tok = parser.nextToken();

          var args = parser.parseSignature(null, true);
          parser.advanceAfterBlockEnd(tok.value);

          var body = parser.parseUntilBlocks("end" + shortcodeName);
          parser.advanceAfterBlockEnd();

          return new nodes.CallExtensionAsync(this, "run", args, [body]);
        };

        this.run = function(...args) {
          let callback = args.pop();
          let body = args.pop();
          let [context, ...argArray] = args;

          let ret = new nunjucksEngine.runtime.SafeString(
            shortcodeFn(body(), ...argArray)
          );
          callback(null, ret);
        };
      }();
    });
  }

  async compile(str, inputPath) {
    let tmpl = NunjucksLib.compile(str, this.njkEnv);
    return async function(data) {
      return new Promise(function(resolve, reject) {
        tmpl.render(data, function(err, res) {
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
