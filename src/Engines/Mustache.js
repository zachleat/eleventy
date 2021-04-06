const MustacheLib = require("mustache");
const TemplateEngine = require("./TemplateEngine");

class Mustache extends TemplateEngine {
  constructor(name, includesDir, config) {
    super(name, includesDir, config);

    this.setLibrary(this.config.libraryOverrides.mustache);
  }

  setLibrary(lib) {
    this.mustacheLib = lib || MustacheLib;
    this.setEngineLib(this.mustacheLib);
  }

  async compile(str) {
    let partials = await super.getPartials();

    return function (data) {
      return this.render(str, data, partials).trim();
    }.bind(this.mustacheLib);
  }
}

module.exports = Mustache;
