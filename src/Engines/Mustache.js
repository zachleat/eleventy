const MustacheLib = require("mustache");
const TemplateEngine = require("./TemplateEngine");

class Mustache extends TemplateEngine {
  constructor(name, includesDir, templateConfig) {
    super(name, includesDir, templateConfig);

    this.setLibrary(this.config.libraryOverrides.mustache);
  }

  setLibrary(lib) {
    this.mustacheLib = lib || MustacheLib;
    this.setEngineLib(this.mustacheLib);
  }

  async compile(str) {
    let partials = super.getPartials();

    return function (data) {
      return this.render(str, data, partials).trim();
    }.bind(this.mustacheLib);
  }
}

module.exports = Mustache;
