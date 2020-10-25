const Template = require("./Template");
const TemplatePath = require("./TemplatePath");
const TemplateMap = require("./TemplateMap");
const EleventyFiles = require("./EleventyFiles");
const EleventyExtensionMap = require("./EleventyExtensionMap");
const EleventyBaseError = require("./EleventyBaseError");
const EleventyErrorHandler = require("./EleventyErrorHandler");
const EleventyErrorUtil = require("./EleventyErrorUtil");

const debug = require("debug")("Eleventy:TemplateWriter");
const debugDev = require("debug")("Dev:Eleventy:TemplateWriter");

class TemplateWriterWriteError extends EleventyBaseError {}

class TemplateWriter {
  constructor(
    inputPath,
    outputDir,
    templateFormats, // TODO remove this, see `get eleventyFiles` first
    templateData,
    isPassthroughAll,
    templateConfig
  ) {
    this.config = templateConfig.getConfig();
    this.templateConfig = templateConfig;
    this.input = inputPath;
    this.inputDir = TemplatePath.getDir(inputPath);
    this.outputDir = outputDir;

    this.needToSearchForFiles = null;
    this.templateFormats = templateFormats;

    this.templateData = templateData;
    this.isVerbose = true;
    this.isDryRun = false;
    this.writeCount = 0;
    this.skippedCount = 0;

    // TODO can we get rid of this? It’s only used for tests in `get eleventyFiles``
    this.passthroughAll = isPassthroughAll;

    this._templatePathCache = new Map();

    this._eleventyFiles = new EleventyFiles(
      this.input,
      this.outputDir,
      this.templateFormats,
      this.passthroughAll,
      this.templateConfig
    );
    this._eleventyFiles.init();
  }

  get templateFormats() {
    return this._templateFormats;
  }

  set templateFormats(value) {
    if (value !== this._templateFormats) {
      this.needToSearchForFiles = true;
    }

    this._templateFormats = value;
  }

  /* For testing */
  overrideConfig(config) {
    this.config = config;
  }

  restart() {
    this.writeCount = 0;
    this.skippedCount = 0;
    debugDev("Resetting counts to 0");
  }

  set extensionMap(extensionMap) {
    this._extensionMap = extensionMap;
  }

  get extensionMap() {
    if (!this._extensionMap) {
      this._extensionMap = new EleventyExtensionMap(
        this.templateFormats,
        this.templateConfig
      );
      this._extensionMap.config = this.config;
    }
    return this._extensionMap;
  }

  setEleventyFiles(eleventyFiles) {
    this.eleventyFiles = eleventyFiles;
  }

  set eleventyFiles(eleventyFiles) {
    this._eleventyFiles = eleventyFiles;
  }

  get eleventyFiles() {
    return this._eleventyFiles;
  }

  async _getAllPaths() {
    if (!this.allPaths || this.needToSearchForFiles) {
      this.allPaths = await this.eleventyFiles.getFiles();
      debug("Found: %o", this.allPaths);
    }
    return this.allPaths;
  }

  _createTemplate(path) {
    let tmpl = this._templatePathCache.get(path);
    if (tmpl) {
      return tmpl;
    }

    tmpl = new Template(
      path,
      this.inputDir,
      this.outputDir,
      this.templateData,
      this.extensionMap,
      this.templateConfig
    );
    this._templatePathCache.set(path, tmpl);

    tmpl.setIsVerbose(this.isVerbose);

    // --incremental only writes files that trigger a build during --watch
    if (this.incrementalFile && path !== this.incrementalFile) {
      tmpl.setDryRun(true);
    } else {
      tmpl.setDryRun(this.isDryRun);
    }

    /*
     * Sample filter: arg str, return pretty HTML string
     * function(str) {
     *   return pretty(str, { ocd: true });
     * }
     */
    for (let transformName in this.config.filters) {
      let transform = this.config.filters[transformName];
      if (typeof transform === "function") {
        tmpl.addTransform(transform);
      }
    }

    for (let linterName in this.config.linters) {
      let linter = this.config.linters[linterName];
      if (typeof linter === "function") {
        tmpl.addLinter(linter);
      }
    }

    return tmpl;
  }

  async _addToTemplateMap(paths) {
    let promises = [];
    for (let path of paths) {
      if (this.extensionMap.hasEngine(path)) {
        promises.push(
          this.templateMap.add(this._createTemplate(path)).then(() => {
            debug(`${path} added to map.`);
          })
        );
      }
    }

    return Promise.all(promises);
  }

  async _createTemplateMap(paths) {
    this.templateMap = new TemplateMap();

    await this._addToTemplateMap(paths);
    await this.templateMap.cache();

    debugDev("TemplateMap cache complete.");
    return this.templateMap;
  }

  async _writeTemplate(mapEntry) {
    let tmpl = mapEntry.template;

    return tmpl.writeMapEntry(mapEntry).then(() => {
      this.skippedCount += tmpl.getSkippedCount();
      this.writeCount += tmpl.getWriteCount();
    });
  }

  async writePassthroughCopy(paths) {
    let passthroughManager = this.eleventyFiles.getPassthroughManager();
    if (this.incrementalFile) {
      passthroughManager.setIncrementalFile(this.incrementalFile);
    }

    return passthroughManager.copyAll(paths).catch((e) => {
      EleventyErrorHandler.warn(e, "Error with passthrough copy");
      return Promise.reject(
        new TemplateWriterWriteError("Having trouble copying", e)
      );
    });
  }

  async writeTemplates(paths) {
    let promises = [];

    // console.time("writeTemplates:_createTemplateMap");
    // TODO optimize await here
    await this._createTemplateMap(paths);
    // console.timeEnd("writeTemplates:_createTemplateMap");
    debug("Template map created.");

    let usedTemplateContentTooEarlyMap = [];
    for (let mapEntry of this.templateMap.getMap()) {
      promises.push(
        this._writeTemplate(mapEntry).catch(function (e) {
          // Premature templateContent in layout render, this also happens in
          // TemplateMap.populateContentDataInMap for non-layout content
          if (EleventyErrorUtil.isPrematureTemplateContentError(e)) {
            usedTemplateContentTooEarlyMap.push(mapEntry);
          } else {
            return Promise.reject(
              new TemplateWriterWriteError(
                `Having trouble writing template: ${mapEntry.outputPath}`,
                e
              )
            );
          }
        })
      );
    }

    for (let mapEntry of usedTemplateContentTooEarlyMap) {
      promises.push(
        this._writeTemplate(mapEntry).catch(function (e) {
          return Promise.reject(
            new TemplateWriterWriteError(
              `Having trouble writing template (second pass): ${mapEntry.outputPath}`,
              e
            )
          );
        })
      );
    }

    return promises;
  }

  async write() {
    let paths = await this._getAllPaths();
    let promises = [];
    promises.push(this.writePassthroughCopy(paths));

    // Only write templates if not using incremental OR if incremental file was *not* a passthrough copy
    if (
      !this.incrementalFile ||
      !this.eleventyFiles
        .getPassthroughManager()
        .isPassthroughCopyFile(paths, this.incrementalFile)
    ) {
      promises.push(...(await this.writeTemplates(paths)));
    }

    return Promise.all(promises).catch((e) => {
      EleventyErrorHandler.error(e, "Error writing templates");
      throw e;
    });
  }

  setVerboseOutput(isVerbose) {
    this.isVerbose = isVerbose;
  }

  setDryRun(isDryRun) {
    this.isDryRun = !!isDryRun;
    this.eleventyFiles.getPassthroughManager().setDryRun(this.isDryRun);
  }

  setIncrementalFile(incrementalFile) {
    this.incrementalFile = incrementalFile;
  }
  resetIncrementalFile() {
    this.incrementalFile = null;
  }

  getCopyCount() {
    return this.eleventyFiles.getPassthroughManager().getCopyCount();
  }

  getSkippedCopyCount() {
    return this.eleventyFiles.getPassthroughManager().getSkippedCount();
  }

  getWriteCount() {
    return this.writeCount;
  }

  getSkippedCount() {
    return this.skippedCount;
  }
}

module.exports = TemplateWriter;
