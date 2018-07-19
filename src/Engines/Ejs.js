const ejsLib = require("ejs");
const TemplateEngine = require("./TemplateEngine");
const lodashMerge = require("lodash.merge");
const config = require("../Config");

class Ejs extends TemplateEngine {
  constructor(name, inputDir) {
    super(name, inputDir);

    this.ejsOptions = {};

    this.config = config.getConfig();
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
    let inputDir = super.getInputDir();

    return lodashMerge(
      {
        root: "./" + inputDir,
        compileDebug: true,
        filename: "./" + inputDir
      },
      this.ejsOptions || {}
    );
  }

  async compile(str, inputPath) {
    let options = this.getEjsOptions();
    options.filename = inputPath || options.filename;

    let fn = this.ejsLib.compile(str, options);

    return function(data) {
      return fn(data);
    };
  }
}

module.exports = Ejs;
