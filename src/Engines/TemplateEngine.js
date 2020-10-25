const fastglob = require("fast-glob");
const fs = require("fs-extra");
const TemplatePath = require("../TemplatePath");
const EleventyExtensionMap = require("../EleventyExtensionMap");
const debug = require("debug")("Eleventy:TemplateEngine");
const aggregateBench = require("../BenchmarkManager").get("Aggregate");

class TemplateEngine {
  constructor(name, includesDir, templateConfig) {
    this.name = name;
    this.includesDir = includesDir;
    this.partialsHaveBeenCached = false;
    this.partials = [];
    this.engineLib = null;
    this.cacheable = false;
    this.templateConfig = templateConfig;
    this._config = templateConfig.getConfig();
  }

  get config() {
    return this._config;
  }

  set config(config) {
    this._config = config;
  }

  get engineManager() {
    return this._engineManager;
  }

  set engineManager(manager) {
    this._engineManager = manager;
  }

  get extensionMap() {
    if (!this._extensionMap) {
      this._extensionMap = new EleventyExtensionMap([], this.templateConfig);
      this._extensionMap.config = this._config;
    }
    return this._extensionMap;
  }

  set extensionMap(map) {
    this._extensionMap = map;
  }

  get extensions() {
    if (!this._extensions) {
      this._extensions = this.extensionMap.getExtensionsFromKey(this.name);
    }
    return this._extensions;
  }

  getName() {
    return this.name;
  }

  getIncludesDir() {
    return this.includesDir;
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
    // This only runs if getPartials() is called, which is only for Mustache/Handlebars
    this.partialsHaveBeenCached = true;
    let partials = {};
    let prefix = this.includesDir + "/**/*.";
    // TODO: reuse mustache partials in handlebars?
    let partialFiles = [];
    if (this.includesDir) {
      let bench = aggregateBench.get("Searching the file system");
      bench.before();
      this.extensions.forEach(function (extension) {
        partialFiles = partialFiles.concat(
          fastglob.sync(prefix + extension, {
            caseSensitiveMatch: false,
            dot: true,
          })
        );
      });
      bench.after();
    }

    partialFiles = TemplatePath.addLeadingDotSlashArray(partialFiles);

    for (let j = 0, k = partialFiles.length; j < k; j++) {
      let partialPath = TemplatePath.stripLeadingSubPath(
        partialFiles[j],
        this.includesDir
      );
      let partialPathNoExt = partialPath;
      this.extensions.forEach(function (extension) {
        partialPathNoExt = TemplatePath.removeExtension(
          partialPathNoExt,
          "." + extension
        );
      });
      partials[partialPathNoExt] = fs.readFileSync(partialFiles[j], "utf-8");
    }

    debug(
      `${this.includesDir}/*.{${this.extensions}} found partials for: %o`,
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

  async _testRender(str, data) {
    /* TODO compile needs to pass in inputPath? */
    try {
      let fn = await this.compile(str);
      return fn(data);
    } catch (e) {
      return Promise.reject(e);
    }
  }

  // JavaScript files defer to the module loader rather than read the files to strings
  needsToReadFileContents() {
    return true;
  }

  getExtraDataFromFile() {
    return {};
  }

  initRequireCache() {
    // do nothing
  }

  get defaultTemplateFileExtension() {
    return "html";
  }
}

module.exports = TemplateEngine;
