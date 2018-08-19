const fastglob = require("fast-glob");
const fs = require("fs-extra");
const TemplatePath = require("../TemplatePath");
const debug = require("debug")("Eleventy:TemplateEngine");

class TemplateEngine {
  constructor(name, inputDir) {
    this.name = name;

    // TODO use EleventyExtensionMap
    this.extension = "." + name;
    this.inputDir = inputDir;
    this.partialsHaveBeenCached = false;
    this.partials = [];
    this.engineLib = null;
  }

  getName() {
    return this.name;
  }

  getInputDir() {
    return this.inputDir;
  }

  // TODO make async
  getPartials() {
    if (!this.partialsHaveBeenCached) {
      this.partials = this.cachePartialFiles();
    }

    return this.partials;
  }

  // TODO make async
  cachePartialFiles() {
    this.partialsHaveBeenCached = true;
    let partials = {};
    // TODO: reuse mustache partials in handlebars?
    let partialFiles = this.inputDir
      ? TemplatePath.addLeadingDotSlashArray(
          fastglob.sync(this.inputDir + "/**/*" + this.extension)
        )
      : [];

    for (let j = 0, k = partialFiles.length; j < k; j++) {
      let partialPath = TemplatePath.stripPathFromDir(
        partialFiles[j],
        this.inputDir
      );
      let partialPathNoExt = TemplatePath.removeExtension(
        partialPath,
        this.extension
      );

      partials[partialPathNoExt] = fs.readFileSync(partialFiles[j], "utf-8");
    }

    debug(
      `${this.inputDir}/*${this.extension} found partials for: %o`,
      Object.keys(partials)
    );

    return partials;
  }

  setEngineLib(engineLib) {
    this.engineLib = engineLib;
  }

  getEngineLib() {
    return this.engineLib;
  }

  async render(str, data) {
    /* TODO compile needs to pass in inputPath? */
    let fn = await this.compile(str);
    return fn(data);
  }

  static get templateKeyMapToClassName() {
    return {
      ejs: "Ejs",
      md: "Markdown",
      jstl: "JavaScriptTemplateLiteral",
      html: "Html",
      hbs: "Handlebars",
      mustache: "Mustache",
      haml: "Haml",
      pug: "Pug",
      njk: "Nunjucks",
      liquid: "Liquid",
      "11ty.js": "JavaScript"
    };
  }

  static hasEngine(name) {
    return name in TemplateEngine.templateKeyMapToClassName;
  }

  static getEngine(name, inputDir) {
    if (!(name in TemplateEngine.templateKeyMapToClassName)) {
      throw new Error(
        "Template Engine " + name + " does not exist in getEngine"
      );
    }

    const cls = require("./" + TemplateEngine.templateKeyMapToClassName[name]);
    return new cls(name, inputDir);
  }
}

module.exports = TemplateEngine;
