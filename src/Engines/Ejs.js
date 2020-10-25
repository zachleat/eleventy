const ejsLib = require("ejs");
const TemplateEngine = require("./TemplateEngine");

class Ejs extends TemplateEngine {
  constructor(name, includesDir, templateConfig) {
    super(name, includesDir, templateConfig);

    this.ejsOptions = {};

    this.setLibrary(this.config.libraryOverrides.ejs);
    this.setEjsOptions(this.config.ejsOptions);
  }

  setLibrary(lib) {
    this.ejsLib = lib || ejsLib;
    this.setEngineLib(this.ejsLib);
  }

  getEngine() {
    return this.ejsLib;
  }

  setEjsOptions(options) {
    this.ejsOptions = options;
  }

  getEjsOptions() {
    let includesDir = super.getIncludesDir();

    return Object.assign(
      {
        root: "./" + includesDir,
        compileDebug: true,
        filename: "./" + includesDir,
      },
      this.ejsOptions || {}
    );
  }

  async compile(str, inputPath) {
    let options = this.getEjsOptions();

    if (inputPath && inputPath !== "ejs" && inputPath !== "md") {
      options.filename = inputPath;
    }

    let fn = this.ejsLib.compile(str, options);

    return function (data) {
      return fn(data);
    };
  }
}

module.exports = Ejs;
