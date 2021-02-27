const Template = require("./Template");
const TemplatePath = require("./TemplatePath");
const TemplateMap = require("./TemplateMap");
const EleventyFiles = require("./EleventyFiles");
const EleventyExtensionMap = require("./EleventyExtensionMap");
const EleventyBaseError = require("./EleventyBaseError");
const EleventyErrorHandler = require("./EleventyErrorHandler");
const EleventyErrorUtil = require("./EleventyErrorUtil");
const ConsoleLogger = require("./Util/ConsoleLogger");

const config = require("./Config");
const lodashFlatten = require("lodash/flatten");
const debug = require("debug")("Eleventy:TemplateWriter");
const debugDev = require("debug")("Dev:Eleventy:TemplateWriter");

class TemplateWriterWriteError extends EleventyBaseError {}

class TemplateWriter {
  constructor(
    inputPath,
    outputDir,
    templateFormats, // TODO remove this, see `get eleventyFiles` first
    templateData,
    isPassthroughAll
  ) {
    this.config = config.getConfig();
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

  /* Getter for error handler */
  get errorHandler() {
    if (!this._errorHandler) {
      this._errorHandler = new EleventyErrorHandler();
      this._errorHandler.isVerbose = this.verboseMode;
      this._errorHandler.logger = this.logger;
    }

    return this._errorHandler;
  }

  /* Getter for Logger */
  get logger() {
    if (!this._logger) {
      this._logger = new ConsoleLogger();
      this._logger.isVerbose = this.verboseMode;
    }

    return this._logger;
  }

  /* Setter for Logger */
  set logger(logger) {
    this._logger = logger;
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
      this._extensionMap = new EleventyExtensionMap(this.templateFormats);
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
    // usually Eleventy.js will setEleventyFiles with the EleventyFiles manager
    if (!this._eleventyFiles) {
      // if not, we can create one (used only by tests)
      this._eleventyFiles = new EleventyFiles(
        this.input,
        this.outputDir,
        this.templateFormats,
        this.passthroughAll
      );

      this._eleventyFiles.init();
    }

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
      this.extensionMap
    );
    tmpl.logger = this.logger;
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
    for (let transformName in this.config.transforms) {
      let transform = this.config.transforms[transformName];
      if (typeof transform === "function") {
        tmpl.addTransform(transformName, transform);
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

  async _generateTemplate(mapEntry, to) {
    let tmpl = mapEntry.template;

    return tmpl.generateMapEntry(mapEntry, to).then(pages => {
      this.skippedCount += tmpl.getSkippedCount();
      this.writeCount += tmpl.getWriteCount();
      return pages;
    });
  }

  async writePassthroughCopy(paths) {
    let passthroughManager = this.eleventyFiles.getPassthroughManager();
    if (this.incrementalFile) {
      passthroughManager.setIncrementalFile(this.incrementalFile);
    }

    return passthroughManager.copyAll(paths).catch(e => {
      this.errorHandler.warn(e, "Error with passthrough copy");
      return Promise.reject(
        new TemplateWriterWriteError("Having trouble copying", e)
      );
    });
  }

  async generateTemplates(paths, to = "fs") {
    let promises = [];

    // console.time("generateTemplates:_createTemplateMap");
    // TODO optimize await here
    await this._createTemplateMap(paths);
    // console.timeEnd("generateTemplates:_createTemplateMap");
    debug("Template map created.");

    let usedTemplateContentTooEarlyMap = [];
    for (let mapEntry of this.templateMap.getMap()) {
      promises.push(
        this._generateTemplate(mapEntry, to).catch(function (e) {
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
        this._generateTemplate(mapEntry, to).catch(function (e) {
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
      promises.push(...(await this.generateTemplates(paths)));
    }

    return Promise.all(promises).catch(e => {
      this.errorHandler.error(e, "Error writing templates");
      throw e;
    });
  }

  // Passthrough copy not supported in JSON output.
  // --incremental not supported in JSON output.
  async getJSON(to = "json") {
    let paths = await this._getAllPaths();
    let promises = await this.generateTemplates(paths, to);

    return Promise.all(promises)
      .then(results => {
        let flat = lodashFlatten(results); // switch to results.flat(1) with Node 12+
        return flat;
      })
      .catch(e => {
        this.errorHandler.error(e, "Error generating templates");
        throw e;
      });
  }

  setVerboseOutput(isVerbose) {
    this.isVerbose = isVerbose;
    this.errorHandler.isVerbose = isVerbose;
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
