const LiquidLib = require("liquidjs");
const TemplateEngine = require("./TemplateEngine");
const lodashMerge = require("lodash.merge");
const config = require("../Config");
const debug = require("debug")("Eleventy:Liquid");

class Liquid extends TemplateEngine {
  constructor(name, inputDir) {
    super(name, inputDir);

    this.config = config.getConfig();
    this.liquidOptions = {};

    this.setLibrary(this.config.libraryOverrides.liquid);
    this.setLiquidOptions(this.config.liquidOptions);
  }

  setLibrary(lib) {
    this.liquidLibOverride = lib;

    // warning, the include syntax supported here does not exactly match what Jekyll uses.
    this.liquidLib = lib || LiquidLib(this.getLiquidOptions());
    this.setEngineLib(this.liquidLib);

    this.addFilters(this.config.liquidFilters);

    // TODO these all go to the same place (addTag), add warnings for overwrites
    this.addCustomTags(this.config.liquidTags);
    this.addAllShortcodes(this.config.liquidShortcodes);
    this.addAllPairedShortcodes(this.config.liquidPairedShortcodes);
  }

  setLiquidOptions(options) {
    this.liquidOptions = options;

    this.setLibrary(this.liquidLibOverride);
  }

  getLiquidOptions() {
    let defaults = {
      root: [super.getInputDir()],
      extname: ".liquid",
      dynamicPartials: false
    };

    let options = lodashMerge(defaults, this.liquidOptions || {});
    // debug("Liquid constructor options: %o", options);

    return options;
  }

  addCustomTags(tags) {
    for (let name in tags) {
      this.addTag(name, tags[name]);
    }
  }

  addFilters(filters) {
    for (let name in filters) {
      this.addFilter(name, filters[name]);
    }
  }

  addFilter(name, filter) {
    this.liquidLib.registerFilter(name, filter);
  }

  addTag(name, tagFn) {
    let tagObj;
    if (typeof tagFn === "function") {
      tagObj = tagFn(this.liquidLib);
    } else {
      throw new Error(
        "Liquid.addTag expects a callback function to be passed in: addTag(name, function(liquidEngine) { return { parse: …, render: … } })"
      );
    }
    this.liquidLib.registerTag(name, tagObj);
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
    this.addTag(shortcodeName, function(liquidEngine) {
      return {
        parse: function(tagToken, remainTokens) {
          this.name = tagToken.name;
          this.args = tagToken.args;
        },
        render: function(scope, hash) {
          let argArray = [];
          if (typeof this.args === "string") {
            // TODO key=value key2=value
            // TODO JSON?
            let args = this.args.split(" ");
            for (let arg of args) {
              argArray.push(LiquidLib.evalExp(arg, scope)); // or evalValue
            }
          }

          return Promise.resolve(shortcodeFn(...argArray));
        }
      };
    });
  }

  addPairedShortcode(shortcodeName, shortcodeFn) {
    this.addTag(shortcodeName, function(liquidEngine) {
      return {
        parse: function(tagToken, remainTokens) {
          this.name = tagToken.name;
          this.args = tagToken.args;
          this.templates = [];

          var stream = liquidEngine.parser
            .parseStream(remainTokens)
            .on("template", tpl => this.templates.push(tpl))
            .on("tag:end" + shortcodeName, token => stream.stop())
            .on("end", x => {
              throw new Error(`tag ${tagToken.raw} not closed`);
            });

          stream.start();
        },
        render: function(scope, hash) {
          let argArray = [];
          let args = this.args.split(" ");
          for (let arg of args) {
            argArray.push(LiquidLib.evalExp(arg, scope)); // or evalValue
          }

          return new Promise((resolve, reject) => {
            liquidEngine.renderer
              .renderTemplates(this.templates, scope)
              .then(function(html) {
                resolve(shortcodeFn(html, ...argArray));
              });
          });
        }
      };
    });
  }

  async compile(str, inputPath) {
    let engine = this.liquidLib;
    let tmpl = await engine.parse(str);
    return async function(data) {
      return engine.render(tmpl, data);
    };
  }
}

module.exports = Liquid;
