const HandlebarsLib = require("handlebars");
const TemplateEngine = require("./TemplateEngine");

class Handlebars extends TemplateEngine {
  constructor(name, includesDir, templateConfig) {
    super(name, includesDir, templateConfig);

    this.setLibrary(this.config.libraryOverrides.hbs);
  }

  setLibrary(lib) {
    this.handlebarsLib = lib || HandlebarsLib;
    this.setEngineLib(this.handlebarsLib);

    let partials = super.getPartials();
    for (let name in partials) {
      this.handlebarsLib.registerPartial(name, partials[name]);
    }

    // TODO these all go to the same place (addHelper), add warnings for overwrites
    this.addHelpers(this.config.handlebarsHelpers);
    this.addShortcodes(this.config.handlebarsShortcodes);
    this.addPairedShortcodes(this.config.handlebarsPairedShortcodes);
  }

  addHelper(name, callback) {
    this.handlebarsLib.registerHelper(name, callback);
  }

  addHelpers(helpers) {
    for (let name in helpers) {
      this.addHelper(name, helpers[name]);
    }
  }

  addShortcodes(shortcodes) {
    for (let name in shortcodes) {
      this.addHelper(name, shortcodes[name]);
    }
  }

  addPairedShortcodes(shortcodes) {
    for (let name in shortcodes) {
      let callback = shortcodes[name];
      this.addHelper(name, function (...args) {
        let options = args[args.length - 1];
        let content = "";
        if (options && options.fn) {
          content = options.fn(this);
        }

        return callback.call(this, content, ...args);
      });
    }
  }

  async compile(str) {
    let fn = this.handlebarsLib.compile(str);
    return function (data) {
      return fn(data);
    };
  }
}

module.exports = Handlebars;
