const pkg = require("../package.json");
const TemplatePath = require("./TemplatePath");
const TemplateData = require("./TemplateData");
const TemplateContent = require("./TemplateContent");
const TemplateWriter = require("./TemplateWriter");
const EleventyExtensionMap = require("./EleventyExtensionMap");
const EleventyErrorHandler = require("./EleventyErrorHandler");
const EleventyBaseError = require("./EleventyBaseError");
const EleventyServe = require("./EleventyServe");
const EleventyWatch = require("./EleventyWatch");
const EleventyWatchTargets = require("./EleventyWatchTargets");
const EleventyFiles = require("./EleventyFiles");
const ConsoleLogger = require("./Util/ConsoleLogger");
const { performance } = require("perf_hooks");

const templateCache = require("./TemplateCache");
const simplePlural = require("./Util/Pluralize");
const deleteRequireCache = require("./Util/DeleteRequireCache");
const config = require("./Config");
const bench = require("./BenchmarkManager");
const debug = require("debug")("Eleventy");
const eventBus = require("./EventBus");

/**
 * @module 11ty/eleventy/Eleventy
 */

/**
 * Runtime of eleventy.
 *
 * @param {String} input - Where to read files from.
 * @param {String} output - Where to write rendered files to.
 * @returns {module:11ty/eleventy/Eleventy~Eleventy}
 */
class Eleventy {
  constructor(input, output, options = {}) {
    /** @member {module:11ty/eleventy/TemplateConfig~TemplateConfig~config} - TemplateConfig instance */
    this.config = config.getConfig();

    /**
     * @member {String} - The path to Eleventy's config file.
     * @default null
     */
    this.configPath = null;

    /**
     * @member {Boolean} - Was verbose mode overwritten?
     * @default false
     */
    this.verboseModeSetViaCommandLineParam = false;

    /**
     * @member {Boolean} - Is Eleventy running in verbose mode?
     * @default true
     */
    if (options.quietMode === true || options.quietMode === false) {
      // Set via --quiet
      this.setIsVerbose(!options.quietMode);
      this.verboseModeSetViaCommandLineParam = true;
    } else {
      // Fall back to configuration
      this.setIsVerbose(!this.config.quietMode);
    }

    /**
     * @member {Boolean} - Is Eleventy running in dry mode?
     * @default false
     */
    this.isDryRun = false;

    if (performance) {
      debug("Eleventy warm up time (in ms) %o", performance.now());
    }

    /** @member {Number} - The timestamp of Eleventy start. */
    this.start = this.getNewTimestamp();

    /**
     * @member {Array<String>} - Subset of template types.
     * @default null
     */
    this.formatsOverride = null;

    /** @member {Object} - tbd. */
    this.eleventyServe = new EleventyServe();

    /** @member {String} - Holds the path to the input directory. */
    this.rawInput = input;

    /** @member {String} - Holds the path to the output directory. */
    this.rawOutput = output;

    /** @member {Object} - tbd. */
    this.watchManager = new EleventyWatch();

    /** @member {Object} - tbd. */
    this.watchTargets = new EleventyWatchTargets();
    this.watchTargets.addAndMakeGlob(this.config.additionalWatchTargets);
    this.watchTargets.watchJavaScriptDependencies = this.config.watchJavaScriptDependencies;
  }

  getNewTimestamp() {
    if (performance) {
      return performance.now();
    }
    return new Date().getTime();
  }

  /** @type {String} */
  get input() {
    return this.rawInput || this.config.dir.input;
  }

  /** @type {String} */
  get inputDir() {
    if (this._inputDir) {
      // set manually via setter
      return this._inputDir;
    }

    return TemplatePath.getDir(this.input);
  }

  setInputDir(dir) {
    this._inputDir = dir;
  }

  /** @type {String} */
  get outputDir() {
    let dir = this.rawOutput || this.config.dir.output;
    if (dir !== this._savedOutputDir) {
      this.eleventyServe.setOutputDir(dir);
    }
    this._savedOutputDir = dir;

    return dir;
  }

  /**
   * Updates the dry-run mode of Eleventy.
   *
   * @method
   * @param {Boolean} isDryRun - Shall Eleventy run in dry mode?
   */
  setDryRun(isDryRun) {
    this.isDryRun = !!isDryRun;
  }

  /**
   * Sets the incremental build mode.
   *
   * @method
   * @param {Boolean} isIncremental - Shall Eleventy run in incremental build mode and only write the files that trigger watch updates
   */
  setIncrementalBuild(isIncremental) {
    this.isIncremental = !!isIncremental;
    this.watchManager.incremental = !!isIncremental;
  }

  /**
   * Updates the passthrough mode of Eleventy.
   *
   * @method
   * @param {Boolean} isPassthroughAll - Shall Eleventy passthrough everything?
   */
  setPassthroughAll(isPassthroughAll) {
    this.isPassthroughAll = !!isPassthroughAll;
  }

  /**
   * Updates the path prefix used in the config.
   *
   * @method
   * @param {String} pathPrefix - The new path prefix.
   */
  setPathPrefix(pathPrefix) {
    if (pathPrefix || pathPrefix === "") {
      config.setPathPrefix(pathPrefix);
      this.config = config.getConfig();
    }
  }

  /**
   * Updates the watch targets.
   *
   * @method
   * @param {} watchTargets - The new watch targets.
   */
  setWatchTargets(watchTargets) {
    this.watchTargets = watchTargets;
  }

  /**
   * Updates the config path.
   *
   * @method
   * @param {String} configPath - The new config path.
   */
  setConfigPathOverride(configPath) {
    if (configPath) {
      this.configPath = configPath;

      config.setProjectConfigPath(configPath);
      this.config = config.getConfig();
    }
  }

  /**
   * Restarts Eleventy.
   *
   * @async
   * @method
   */
  async restart() {
    debug("Restarting");
    this.start = this.getNewTimestamp();
    templateCache.clear();
    bench.reset();
    this.eleventyFiles.restart();

    // reload package.json values (if applicable)
    // TODO only reset this if it changed
    deleteRequireCache(TemplatePath.absolutePath("package.json"));

    await this.init();
  }

  /**
   * Logs some statistics after a complete run of Eleventy.
   *
   * @method
   * @returns {String} ret - The log message.
   */
  logFinished() {
    if (!this.writer) {
      throw new Error(
        "Did you call Eleventy.init to create the TemplateWriter instance? Hint: you probably didn’t."
      );
    }

    let ret = [];

    let writeCount = this.writer.getWriteCount();
    let skippedCount = this.writer.getSkippedCount();
    let copyCount = this.writer.getCopyCount();

    let slashRet = [];

    if (copyCount) {
      slashRet.push(
        `Copied ${copyCount} ${simplePlural(copyCount, "file", "files")}`
      );
    }

    slashRet.push(
      `Wrote ${writeCount} ${simplePlural(writeCount, "file", "files")}${
        skippedCount ? ` (skipped ${skippedCount})` : ""
      }`
    );

    if (slashRet.length) {
      ret.push(slashRet.join(" / "));
    }

    let versionStr = `v${pkg.version}`;
    let time = ((this.getNewTimestamp() - this.start) / 1000).toFixed(2);
    ret.push(`in ${time} ${simplePlural(time, "second", "seconds")}`);

    if (writeCount >= 10) {
      ret.push(
        `(${((time * 1000) / writeCount).toFixed(1)}ms each, ${versionStr})`
      );
    } else {
      ret.push(`(${versionStr})`);
    }

    let pathPrefix = this.config.pathPrefix;
    if (pathPrefix && pathPrefix !== "/") {
      return `Using pathPrefix: ${pathPrefix}\n${ret.join(" ")}`;
    }

    return ret.join(" ");
  }

  /**
   * Starts Eleventy.
   *
   * @async
   * @method
   * @returns {} - tbd.
   */
  async init() {
    this.config.inputDir = this.inputDir;

    let formats = this.formatsOverride || this.config.templateFormats;
    this.extensionMap = new EleventyExtensionMap(formats);

    this.eleventyFiles = new EleventyFiles(
      this.input,
      this.outputDir,
      formats,
      this.isPassthroughAll
    );
    this.eleventyFiles.extensionMap = this.extensionMap;
    this.eleventyFiles.init();

    this.templateData = new TemplateData(this.inputDir);
    this.templateData.extensionMap = this.extensionMap;
    this.eleventyFiles.templateData = this.templateData;

    this.writer = new TemplateWriter(
      this.input,
      this.outputDir,
      formats,
      this.templateData,
      this.isPassthroughAll
    );
    this.writer.logger = this.logger;
    this.writer.extensionMap = this.extensionMap;
    this.writer.setEleventyFiles(this.eleventyFiles);

    debug(`Directories:
Input: ${this.inputDir}
Data: ${this.templateData.getDataDir()}
Includes: ${this.eleventyFiles.getIncludesDir()}
Layouts: ${this.eleventyFiles.getLayoutsDir()}
Output: ${this.outputDir}
Template Formats: ${formats.join(",")}
Verbose Output: ${this.verboseMode}`);

    this.writer.setVerboseOutput(this.verboseMode);
    this.writer.setDryRun(this.isDryRun);

    return this.templateData.cacheData();
  }

  /* Setter for verbose mode */
  set verboseMode(value) {
    this._isVerboseMode = !!value;

    if (this.writer) {
      this.writer.setVerboseOutput(this._isVerboseMode);
    }

    if (bench) {
      bench.setVerboseOutput(this._isVerboseMode);
    }

    if (this.logger) {
      this.logger.isVerbose = this._isVerboseMode;
    }

    if (this.errorHandler) {
      this.errorHandler.isVerbose = this._isVerboseMode;
    }
  }

  /* Getter for verbose mode */
  get verboseMode() {
    return this._isVerboseMode;
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

  /* Getter for error handler */
  get errorHandler() {
    if (!this._errorHandler) {
      this._errorHandler = new EleventyErrorHandler();
      this._errorHandler.isVerbose = this.verboseMode;
      this._errorHandler.logger = this.logger;
    }

    return this._errorHandler;
  }

  /**
   * Updates the verbose mode of Eleventy.
   *
   * @method
   * @param {Boolean} isVerbose - Shall Eleventy run in verbose mode?
   */
  setIsVerbose(isVerbose) {
    // Debug mode should always run quiet (all output goes to debug logger)
    if (process.env.DEBUG) {
      isVerbose = false;
    }

    this.verboseMode = isVerbose;
  }

  /**
   * Updates the template formats of Eleventy.
   *
   * @method
   * @param {String} formats - The new template formats.
   */
  setFormats(formats) {
    if (formats && formats !== "*") {
      this.formatsOverride = formats.split(",");
    }
  }

  /**
   * Reads the version of Eleventy.
   *
   * @method
   * @returns {String} - The version of Eleventy.
   */
  getVersion() {
    return require("../package.json").version;
  }

  /**
   * Shows a help message including usage.
   *
   * @method
   * @returns {String} - The help mesage.
   */
  getHelp() {
    return `usage: eleventy
       eleventy --input=. --output=./_site
       eleventy --serve

Arguments:
     --version
     --input=.
       Input template files (default: \`.\`)
     --output=_site
       Write HTML output to this folder (default: \`_site\`)
     --serve
       Run web server on --port (default 8080) and watch them too
     --watch
       Wait for files to change and automatically rewrite (no web server)
     --formats=liquid,md
       Whitelist only certain template types (default: \`*\`)
     --quiet
       Don’t print all written files (off by default)
     --config=filename.js
       Override the eleventy config file path (default: \`.eleventy.js\`)
     --pathprefix='/'
       Change all url template filters to use this subdirectory.
     --dryrun
       Don’t write any files. Useful with \`DEBUG=Eleventy* npx eleventy\`
     --help`;
  }

  /**
   * Resets the config of Eleventy.
   *
   * @method
   */
  resetConfig() {
    config.reset();

    this.config = config.getConfig();
    this.eleventyServe.config = this.config;

    // only use config quietMode if --quiet not set on CLI
    if (!this.verboseModeSetViaCommandLineParam) {
      this.setIsVerbose(!this.config.quietMode);
    }
  }

  /**
   * tbd.
   *
   * @private
   * @method
   * @param {String} changedFilePath - File that triggered a re-run (added or modified)
   */
  async _addFileToWatchQueue(changedFilePath) {
    eventBus.emit("resourceModified", changedFilePath);
    this.watchManager.addToPendingQueue(changedFilePath);
  }

  /**
   * tbd.
   *
   * @private
   * @method
   */
  async _watch() {
    if (this.watchManager.isBuildRunning()) {
      return;
    }

    this.watchManager.setBuildRunning();

    await this.config.events.emit(
      "beforeWatch",
      this.watchManager.getActiveQueue()
    );

    // reset and reload global configuration :O
    if (this.watchManager.hasQueuedFile(config.getLocalProjectConfigFile())) {
      this.resetConfig();
    }

    await this.restart();

    this.watchTargets.clearDependencyRequireCache();

    let incrementalFile = this.watchManager.getIncrementalFile();
    if (incrementalFile) {
      // TODO remove these and delegate to the template dependency graph
      let isInclude = TemplatePath.startsWithSubPath(
        incrementalFile,
        this.eleventyFiles.getIncludesDir()
      );
      let isLayout = TemplatePath.startsWithSubPath(
        incrementalFile,
        this.eleventyFiles.getLayoutsDir()
      );
      let isJSDependency = this.watchTargets.isJavaScriptDependency(
        incrementalFile
      );
      if (!isInclude && !isLayout && !isJSDependency) {
        this.writer.setIncrementalFile(incrementalFile);
      }
    }

    await this.write();

    this.writer.resetIncrementalFile();

    this.watchTargets.reset();

    await this._initWatchDependencies();

    // Add new deps to chokidar
    this.watcher.add(this.watchTargets.getNewTargetsSinceLastReset());

    // Is a CSS input file and is not in the includes folder
    // TODO check output path file extension of this template (not input path)
    // TODO add additional API for this, maybe a config callback?
    let onlyCssChanges = this.watchManager.hasAllQueueFiles(path => {
      return (
        path.endsWith(".css") &&
        // TODO how to make this work with relative includes?
        !TemplatePath.startsWithSubPath(
          path,
          this.eleventyFiles.getIncludesDir()
        )
      );
    });

    if (onlyCssChanges) {
      this.eleventyServe.reload("*.css");
    } else {
      this.eleventyServe.reload();
    }

    this.watchManager.setBuildFinished();

    if (this.watchManager.getPendingQueueSize() > 0) {
      this.logger.log(
        `You saved while Eleventy was running, let’s run again. (${this.watchManager.getPendingQueueSize()} remain)`
      );
      await this._watch();
    } else {
      this.logger.log("Watching…");
    }
  }

  /**
   * tbd.
   *
   * @returns {} - tbd.
   */
  get watcherBench() {
    return bench.get("Watcher");
  }

  /**
   * Set up watchers and benchmarks.
   *
   * @async
   * @method
   */
  async initWatch() {
    this.watchManager = new EleventyWatch();
    this.watchManager.incremental = this.isIncremental;

    this.watchTargets.add(this.eleventyFiles.getGlobWatcherFiles());

    // Watch the local project config file
    this.watchTargets.add(config.getLocalProjectConfigFile());

    // Template and Directory Data Files
    this.watchTargets.add(
      await this.eleventyFiles.getGlobWatcherTemplateDataFiles()
    );

    let benchmark = this.watcherBench.get(
      "Watching JavaScript Dependencies (disable with `eleventyConfig.setWatchJavaScriptDependencies(false)`)"
    );
    benchmark.before();
    await this._initWatchDependencies();
    benchmark.after();
  }

  /**
   * Starts watching dependencies.
   *
   * @private
   * @async
   * @method
   */
  async _initWatchDependencies() {
    if (!this.watchTargets.watchJavaScriptDependencies) {
      return;
    }

    let dataDir = this.templateData.getDataDir();
    function filterOutGlobalDataFiles(path) {
      return !dataDir || path.indexOf(dataDir) === -1;
    }

    // Template files .11ty.js
    this.watchTargets.addDependencies(this.eleventyFiles.getWatchPathCache());

    // Config file dependencies
    this.watchTargets.addDependencies(
      config.getLocalProjectConfigFile(),
      filterOutGlobalDataFiles
    );

    // Deps from Global Data (that aren’t in the global data directory, everything is watched there)
    this.watchTargets.addDependencies(
      this.templateData.getWatchPathCache(),
      filterOutGlobalDataFiles
    );

    this.watchTargets.addDependencies(
      await this.eleventyFiles.getWatcherTemplateJavaScriptDataFiles()
    );
  }

  /**
   * Returns all watched files.
   *
   * @async
   * @method
   * @returns {} targets - The watched files.
   */
  async getWatchedFiles() {
    return this.watchTargets.getTargets();
  }

  getChokidarConfig() {
    let ignores = this.eleventyFiles.getGlobWatcherIgnores();
    debug("Ignoring watcher changes to: %o", ignores);

    let configOptions = this.config.chokidarConfig;

    // can’t override these yet
    // TODO maybe if array, merge the array?
    delete configOptions.ignored;

    return Object.assign(
      {
        ignored: ignores,
        ignoreInitial: true,
        // also interesting: awaitWriteFinish
      },
      configOptions
    );
  }

  /**
   * Start the watching of files.
   *
   * @async
   * @method
   */
  async watch() {
    this.watcherBench.setMinimumThresholdMs(500);
    this.watcherBench.reset();

    const chokidar = require("chokidar");

    // Note that watching indirectly depends on this for fetching dependencies from JS files
    // See: TemplateWriter:pathCache and EleventyWatchTargets
    await this.write();

    let initWatchBench = this.watcherBench.get("Start up --watch");
    initWatchBench.before();

    await this.initWatch();

    // TODO improve unwatching if JS dependencies are removed (or files are deleted)
    let rawFiles = await this.getWatchedFiles();
    debug("Watching for changes to: %o", rawFiles);

    let watcher = chokidar.watch(rawFiles, this.getChokidarConfig());

    initWatchBench.after();

    this.watcherBench.finish("Watch");

    this.logger.log("Watching…");

    this.watcher = watcher;

    let watchDelay;
    let watchRun = async path => {
      try {
        this._addFileToWatchQueue(path);
        clearTimeout(watchDelay);

        await new Promise((resolve, reject) => {
          watchDelay = setTimeout(async () => {
            this._watch().then(resolve, reject);
          }, this.config.watchThrottleWaitTime);
        });
      } catch (e) {
        if (e instanceof EleventyBaseError) {
          this.errorHandler.error(e, "Eleventy watch error");
          this.watchManager.setBuildFinished();
        } else {
          this.errorHandler.fatal(e, "Eleventy fatal watch error");
          this.stopWatch();
        }
      }
    };

    watcher.on("change", async path => {
      this.logger.log(`File changed: ${path}`);
      await watchRun(path);
    });

    watcher.on("add", async path => {
      this.logger.log(`File added: ${path}`);
      await watchRun(path);
    });

    process.on("SIGINT", () => this.stopWatch());
  }

  stopWatch() {
    debug("Cleaning up chokidar and browsersync (if exists) instances.");
    this.eleventyServe.close();
    this.watcher.close();
    process.exit();
  }

  /**
   * Serve Eleventy on this port.
   *
   * @param {Number} port - The HTTP port to serve Eleventy from.
   */
  serve(port) {
    this.eleventyServe.serve(port);
  }

  /**
   * Writes templates to the file system.
   *
   * @async
   * @method
   * @returns {Promise<{}>}
   */
  async write() {
    return this.executeBuild();
  }

  /**
   * Renders templates to a JSON object.
   *
   * @async
   * @method
   * @returns {Promise<{}>}
   */
  async toJSON() {
    return this.executeBuild("json");
  }

  /**
   * Returns a stream of new line delimited (NDJSON) objects
   *
   * @async
   * @method
   * @returns {Promise<{ReadableStream}>}
   */
  async toNDJSON() {
    return this.executeBuild("ndjson");
  }

  /**
   * tbd.
   *
   * @async
   * @method
   * @returns {Promise<{}>} ret - tbd.
   */
  async executeBuild(to = "fs") {
    let ret;

    await this.config.events.emit("beforeBuild");

    try {
      let promise;
      if (to === "fs") {
        promise = this.writer.write();
      } else if (to === "json") {
        promise = this.writer.getJSON("json");
      } else if (to === "ndjson") {
        promise = this.writer.getJSON("ndjson");
      } else {
        throw new Error(
          `Invalid argument for \`Eleventy->executeBuild(${to})\`, expected "json", "ndjson", or "fs".`
        );
      }

      ret = await promise;

      if (to === "ndjson") {
        // return a stream
        // TODO this might return only after all the templates have been added to the stream
        ret = this.logger.closeStream(to);
      }
      await this.config.events.emit("afterBuild");
    } catch (e) {
      this.errorHandler.initialMessage(
        "Problem writing Eleventy templates",
        "error",
        "red"
      );
      this.errorHandler.fatal(e);
    }

    bench.finish();

    if (to === "fs") {
      this.logger.log(this.logFinished());
    }
    debug("Finished writing templates.");

    debug(`
Getting frustrated? Have a suggestion/feature request/feedback?
I want to hear it! Open an issue: https://github.com/11ty/eleventy/issues/new`);

    return ret;
  }
}

module.exports = Eleventy;
