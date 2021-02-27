const chalk = require("chalk");
const semver = require("semver");
const { DateTime } = require("luxon");
const EventEmitter = require("./Util/AsyncEventEmitter");
const EleventyBaseError = require("./EleventyBaseError");
const bench = require("./BenchmarkManager").get("Configuration");
const aggregateBench = require("./BenchmarkManager").get("Aggregate");
const debug = require("debug")("Eleventy:UserConfig");
const pkg = require("../package.json");

class UserConfigError extends EleventyBaseError {}

// API to expose configuration options in config file
class UserConfig {
  constructor() {
    this.reset();
  }

  reset() {
    debug("Resetting EleventyConfig to initial values.");
    this.events = new EventEmitter();
    this.collections = {};
    this.templateFormats = undefined;

    this.liquidOptions = {};
    this.liquidTags = {};
    this.liquidFilters = {};
    this.liquidShortcodes = {};
    this.liquidPairedShortcodes = {};
    this.nunjucksFilters = {};
    this.nunjucksAsyncFilters = {};
    this.nunjucksTags = {};
    this.nunjucksGlobals = {};
    this.nunjucksShortcodes = {};
    this.nunjucksAsyncShortcodes = {};
    this.nunjucksPairedShortcodes = {};
    this.nunjucksAsyncPairedShortcodes = {};
    this.handlebarsHelpers = {};
    this.handlebarsShortcodes = {};
    this.handlebarsPairedShortcodes = {};
    this.javascriptFunctions = {};
    this.pugOptions = {};
    this.ejsOptions = {};
    this.markdownHighlighter = null;
    this.libraryOverrides = {};

    this.passthroughCopies = {};
    this.layoutAliases = {};
    this.linters = {};
    this.transforms = {};
    this.activeNamespace = "";
    this.DateTime = DateTime;
    this.dynamicPermalinks = true;
    this.useGitIgnore = true;
    this.dataDeepMerge = false;
    this.extensionMap = new Set();
    this.watchJavaScriptDependencies = true;
    this.additionalWatchTargets = [];
    this.browserSyncConfig = {};
    this.globalData = {};
    this.chokidarConfig = {};
    this.watchThrottleWaitTime = 0; //ms

    // using Map to preserve insertion order
    this.dataExtensions = new Map();

    this.quietMode = false;
  }

  versionCheck(expected) {
    if (!semver.satisfies(pkg.version, expected)) {
      throw new UserConfigError(
        `This project requires the eleventy version to match '${expected}' but found ${pkg.version}. Use \`npm update @11ty/eleventy -g\` to upgrade the eleventy global or \`npm update @11ty/eleventy --save\` to upgrade your local project version.`
      );
    }
  }

  // Duplicate event bindings are avoided with the `reset` method above.
  // A new EventEmitter instance is created when the config is reset.
  on(eventName, callback) {
    return this.events.on(eventName, callback);
  }

  emit(eventName, ...args) {
    return this.events.emit(eventName, ...args);
  }

  // This is a method for plugins, probably shouldn’t use this in projects.
  // Projects should use `setLibrary` as documented here:
  // https://github.com/11ty/eleventy/blob/master/docs/engines/markdown.md#use-your-own-options
  addMarkdownHighlighter(highlightFn) {
    this.markdownHighlighter = highlightFn;
  }

  // tagCallback: function(liquidEngine) { return { parse: …, render: … }} };
  addLiquidTag(name, tagFn) {
    name = this.getNamespacedName(name);

    if (typeof tagFn !== "function") {
      throw new UserConfigError(
        `EleventyConfig.addLiquidTag expects a callback function to be passed in for ${name}: addLiquidTag(name, function(liquidEngine) { return { parse: …, render: … } })`
      );
    }

    if (this.liquidTags[name]) {
      debug(
        chalk.yellow(
          "Warning, overwriting a Liquid tag with `addLiquidTag(%o)`"
        ),
        name
      );
    }
    this.liquidTags[name] = bench.add(`"${name}" Liquid Custom Tag`, tagFn);
  }

  addLiquidFilter(name, callback) {
    name = this.getNamespacedName(name);

    if (this.liquidFilters[name]) {
      debug(
        chalk.yellow(
          "Warning, overwriting a Liquid filter with `addLiquidFilter(%o)`"
        ),
        name
      );
    }

    this.liquidFilters[name] = bench.add(`"${name}" Liquid Filter`, callback);
  }

  addNunjucksAsyncFilter(name, callback) {
    name = this.getNamespacedName(name);

    if (this.nunjucksAsyncFilters[name]) {
      debug(
        chalk.yellow(
          "Warning, overwriting a Nunjucks filter with `addNunjucksAsyncFilter(%o)`"
        ),
        name
      );
    }

    this.nunjucksAsyncFilters[name] = bench.add(
      `"${name}" Nunjucks Async Filter`,
      callback
    );
  }

  // Support the nunjucks style syntax for asynchronous filter add
  addNunjucksFilter(name, callback, isAsync = false) {
    if (isAsync) {
      // namespacing happens downstream
      this.addNunjucksAsyncFilter(name, callback);
    } else {
      name = this.getNamespacedName(name);

      if (this.nunjucksFilters[name]) {
        debug(
          chalk.yellow(
            "Warning, overwriting a Nunjucks filter with `addNunjucksFilter(%o)`"
          ),
          name
        );
      }

      this.nunjucksFilters[name] = bench.add(
        `"${name}" Nunjucks Filter`,
        callback
      );
    }
  }

  addHandlebarsHelper(name, callback) {
    name = this.getNamespacedName(name);

    if (this.handlebarsHelpers[name]) {
      debug(
        chalk.yellow(
          "Warning, overwriting a Handlebars helper with `addHandlebarsHelper(%o)`."
        ),
        name
      );
    }

    this.handlebarsHelpers[name] = bench.add(
      `"${name}" Handlebars Helper`,
      callback
    );
  }

  addFilter(name, callback) {
    debug("Adding universal filter %o", this.getNamespacedName(name));

    // namespacing happens downstream
    this.addLiquidFilter(name, callback);
    this.addNunjucksFilter(name, callback);
    this.addJavaScriptFunction(name, callback);

    // TODO remove Handlebars helpers in Universal Filters. Use shortcodes instead (the Handlebars template syntax is the same).
    this.addHandlebarsHelper(name, callback);
  }

  getFilter(name) {
    return (
      this.javascriptFunctions[name] ||
      this.nunjucksFilters[name] ||
      this.liquidFilters[name] ||
      this.handlebarsHelpers[name]
    );
  }

  addNunjucksTag(name, tagFn) {
    name = this.getNamespacedName(name);

    if (typeof tagFn !== "function") {
      throw new UserConfigError(
        `EleventyConfig.addNunjucksTag expects a callback function to be passed in for ${name}: addNunjucksTag(name, function(nunjucksEngine) {})`
      );
    }

    if (this.nunjucksTags[name]) {
      debug(
        chalk.yellow(
          "Warning, overwriting a Nunjucks tag with `addNunjucksTag(%o)`"
        ),
        name
      );
    }

    this.nunjucksTags[name] = bench.add(`"${name}" Nunjucks Custom Tag`, tagFn);
  }

  addGlobalData(name, data) {
    name = this.getNamespacedName(name);
    this.globalData[name] = data;
    return this;
  }

  addNunjucksGlobal(name, globalFn) {
    name = this.getNamespacedName(name);

    if (this.nunjucksGlobals[name]) {
      debug(
        chalk.yellow(
          "Warning, overwriting a Nunjucks global with `addNunjucksGlobal(%o)`"
        ),
        name
      );
    }

    this.nunjucksGlobals[name] = bench.add(
      `"${name}" Nunjucks Global`,
      globalFn
    );
  }

  addTransform(name, callback) {
    name = this.getNamespacedName(name);

    this.transforms[name] = callback;
  }

  addLinter(name, callback) {
    name = this.getNamespacedName(name);

    this.linters[name] = callback;
  }

  addLayoutAlias(from, to) {
    this.layoutAliases[from] = to;
  }

  // get config defined collections
  getCollections() {
    return this.collections;
  }

  addCollection(name, callback) {
    name = this.getNamespacedName(name);

    if (this.collections[name]) {
      throw new UserConfigError(
        `config.addCollection(${name}) already exists. Try a different name for your collection.`
      );
    }

    this.collections[name] = callback;
  }

  addPlugin(plugin, options) {
    // TODO support function.name in plugin config functions
    debug("Adding plugin (unknown name: check your config file).");
    let pluginBench = aggregateBench.get("Configuration addPlugin");
    if (typeof plugin === "function") {
      pluginBench.before();
      let configFunction = plugin;
      configFunction(this, options);
      pluginBench.after();
    } else if (plugin && plugin.configFunction) {
      pluginBench.before();
      if (options && typeof options.init === "function") {
        options.init.call(this, plugin.initArguments || {});
      }

      plugin.configFunction(this, options);
      pluginBench.after();
    } else {
      throw new UserConfigError(
        "Invalid EleventyConfig.addPlugin signature. Should be a function or a valid Eleventy plugin object."
      );
    }
  }

  getNamespacedName(name) {
    return this.activeNamespace + name;
  }

  namespace(pluginNamespace, callback) {
    let validNamespace = pluginNamespace && typeof pluginNamespace === "string";
    if (validNamespace) {
      this.activeNamespace = pluginNamespace || "";
    }

    callback();

    if (validNamespace) {
      this.activeNamespace = "";
    }
  }

  /**
   * Adds a path to a file or directory to the list of pass-through copies
   * which are copied as-is to the output.
   *
   * @param {string|object} fileOrDir The path to the file or directory that should
   * be copied. OR an object where the key is the input glob and the property is the output directory
   * @returns {any} a reference to the `EleventyConfig` object.
   * @memberof EleventyConfig
   */
  addPassthroughCopy(fileOrDir) {
    if (typeof fileOrDir === "string") {
      this.passthroughCopies[fileOrDir] = true;
    } else {
      Object.assign(this.passthroughCopies, fileOrDir);
    }

    return this;
  }

  _normalizeTemplateFormats(templateFormats) {
    if (typeof templateFormats === "string") {
      templateFormats = templateFormats.split(",").map(format => format.trim());
    }
    return templateFormats;
  }

  setTemplateFormats(templateFormats) {
    this.templateFormats = this._normalizeTemplateFormats(templateFormats);
  }

  // additive, usually for plugins
  addTemplateFormats(templateFormats) {
    if (!this.templateFormatsAdded) {
      this.templateFormatsAdded = [];
    }
    this.templateFormatsAdded = this.templateFormatsAdded.concat(
      this._normalizeTemplateFormats(templateFormats)
    );
  }

  setLibrary(engineName, libraryInstance) {
    // Pug options are passed to `compile` and not in the library constructor so we don’t need to warn
    if (engineName === "liquid" && this.mdOptions) {
      debug(
        "WARNING: using `eleventyConfig.setLibrary` will override any configuration set using `.setLiquidOptions` or with the `liquidOptions` key in the config object. You’ll need to pass these options to the library yourself."
      );
    }

    this.libraryOverrides[engineName.toLowerCase()] = libraryInstance;
  }

  setPugOptions(options) {
    this.pugOptions = options;
  }

  setLiquidOptions(options) {
    this.liquidOptions = options;
  }

  setEjsOptions(options) {
    this.ejsOptions = options;
  }

  setDynamicPermalinks(enabled) {
    this.dynamicPermalinks = !!enabled;
  }

  setUseGitIgnore(enabled) {
    this.useGitIgnore = !!enabled;
  }

  addShortcode(name, callback) {
    debug("Adding universal shortcode %o", this.getNamespacedName(name));
    this.addNunjucksShortcode(name, callback);
    this.addLiquidShortcode(name, callback);
    this.addHandlebarsShortcode(name, callback);
    this.addJavaScriptFunction(name, callback);
  }

  // Undocumented method as a mitigation to reduce risk of #498
  addAsyncShortcode(name, callback) {
    debug("Adding universal async shortcode %o", this.getNamespacedName(name));
    this.addNunjucksAsyncShortcode(name, callback);
    this.addLiquidShortcode(name, callback);
    this.addJavaScriptFunction(name, callback);
    // not supported in Handlebars
  }

  addNunjucksAsyncShortcode(name, callback) {
    name = this.getNamespacedName(name);

    if (this.nunjucksAsyncShortcodes[name]) {
      debug(
        chalk.yellow(
          "Warning, overwriting a Nunjucks Async Shortcode with `addNunjucksAsyncShortcode(%o)`"
        ),
        name
      );
    }

    this.nunjucksAsyncShortcodes[name] = bench.add(
      `"${name}" Nunjucks Async Shortcode`,
      callback
    );
  }

  addNunjucksShortcode(name, callback, isAsync = false) {
    if (isAsync) {
      this.addNunjucksAsyncShortcode(name, callback);
    } else {
      name = this.getNamespacedName(name);

      if (this.nunjucksShortcodes[name]) {
        debug(
          chalk.yellow(
            "Warning, overwriting a Nunjucks Shortcode with `addNunjucksShortcode(%o)`"
          ),
          name
        );
      }

      this.nunjucksShortcodes[name] = bench.add(
        `"${name}" Nunjucks Shortcode`,
        callback
      );
    }
  }

  addLiquidShortcode(name, callback) {
    name = this.getNamespacedName(name);

    if (this.liquidShortcodes[name]) {
      debug(
        chalk.yellow(
          "Warning, overwriting a Liquid Shortcode with `addLiquidShortcode(%o)`"
        ),
        name
      );
    }

    this.liquidShortcodes[name] = bench.add(
      `"${name}" Liquid Shortcode`,
      callback
    );
  }

  addHandlebarsShortcode(name, callback) {
    name = this.getNamespacedName(name);

    if (this.handlebarsShortcodes[name]) {
      debug(
        chalk.yellow(
          "Warning, overwriting a Handlebars Shortcode with `addHandlebarsShortcode(%o)`"
        ),
        name
      );
    }

    this.handlebarsShortcodes[name] = bench.add(
      `"${name}" Handlebars Shortcode`,
      callback
    );
  }

  addPairedShortcode(name, callback) {
    debug("Adding universal paired shortcode %o", this.getNamespacedName(name));
    this.addPairedNunjucksShortcode(name, callback);
    this.addPairedLiquidShortcode(name, callback);
    this.addPairedHandlebarsShortcode(name, callback);
    this.addJavaScriptFunction(name, callback);
  }

  // Undocumented method as a mitigation to reduce risk of #498
  addPairedAsyncShortcode(name, callback) {
    debug(
      "Adding universal async paired shortcode %o",
      this.getNamespacedName(name)
    );
    this.addPairedNunjucksAsyncShortcode(name, callback);
    this.addPairedLiquidShortcode(name, callback);
    this.addJavaScriptFunction(name, callback);
    // not supported in Handlebars
  }

  addPairedNunjucksAsyncShortcode(name, callback) {
    name = this.getNamespacedName(name);

    if (this.nunjucksAsyncPairedShortcodes[name]) {
      debug(
        chalk.yellow(
          "Warning, overwriting a Nunjucks Async Paired Shortcode with `addPairedNunjucksAsyncShortcode(%o)`"
        ),
        name
      );
    }

    this.nunjucksAsyncPairedShortcodes[name] = bench.add(
      `"${name}" Nunjucks Async Paired Shortcode`,
      callback
    );
  }

  addPairedNunjucksShortcode(name, callback, isAsync = false) {
    if (isAsync) {
      this.addPairedNunjucksAsyncShortcode(name, callback);
    } else {
      name = this.getNamespacedName(name);

      if (this.nunjucksPairedShortcodes[name]) {
        debug(
          chalk.yellow(
            "Warning, overwriting a Nunjucks Paired Shortcode with `addPairedNunjucksShortcode(%o)`"
          ),
          name
        );
      }

      this.nunjucksPairedShortcodes[name] = bench.add(
        `"${name}" Nunjucks Paired Shortcode`,
        callback
      );
    }
  }

  addPairedLiquidShortcode(name, callback) {
    name = this.getNamespacedName(name);

    if (this.liquidPairedShortcodes[name]) {
      debug(
        chalk.yellow(
          "Warning, overwriting a Liquid Paired Shortcode with `addPairedLiquidShortcode(%o)`"
        ),
        name
      );
    }

    this.liquidPairedShortcodes[name] = bench.add(
      `"${name}" Liquid Paired Shortcode`,
      callback
    );
  }

  addPairedHandlebarsShortcode(name, callback) {
    name = this.getNamespacedName(name);

    if (this.handlebarsPairedShortcodes[name]) {
      debug(
        chalk.yellow(
          "Warning, overwriting a Handlebars Paired Shortcode with `addPairedHandlebarsShortcode(%o)`"
        ),
        name
      );
    }

    this.handlebarsPairedShortcodes[name] = bench.add(
      `"${name}" Handlebars Paired Shortcode`,
      callback
    );
  }

  addJavaScriptFunction(name, callback) {
    name = this.getNamespacedName(name);

    if (this.javascriptFunctions[name]) {
      debug(
        chalk.yellow(
          "Warning, overwriting a JavaScript template function with `addJavaScriptFunction(%o)`"
        ),
        name
      );
    }

    this.javascriptFunctions[name] = bench.add(
      `"${name}" JavaScript Function`,
      callback
    );
  }

  setDataDeepMerge(deepMerge) {
    this.dataDeepMerge = !!deepMerge;
  }

  addWatchTarget(additionalWatchTargets) {
    this.additionalWatchTargets.push(additionalWatchTargets);
  }

  setWatchJavaScriptDependencies(watchEnabled) {
    this.watchJavaScriptDependencies = !!watchEnabled;
  }

  setBrowserSyncConfig(options = {}) {
    this.browserSyncConfig = options;
  }

  setChokidarConfig(options = {}) {
    this.chokidarConfig = options;
  }

  setWatchThrottleWaitTime(time = 0) {
    this.watchThrottleWaitTime = time;
  }

  setFrontMatterParsingOptions(options = {}) {
    this.frontMatterParsingOptions = options;
  }

  setQuietMode(quietMode) {
    this.quietMode = !!quietMode;
  }

  addExtension(fileExtension, options = {}) {
    if (!process.env.ELEVENTY_EXPERIMENTAL) {
      return;
    }

    this.extensionMap.add(
      Object.assign(
        {
          key: fileExtension,
          extension: fileExtension,
        },
        options
      )
    );
  }

  addDataExtension(formatExtension, formatParser) {
    this.dataExtensions.set(formatExtension, formatParser);
  }

  getMergingConfigObject() {
    return {
      templateFormats: this.templateFormats,
      templateFormatsAdded: this.templateFormatsAdded,
      // filters removed in 1.0 (use addTransform instead)
      transforms: this.transforms,
      linters: this.linters,
      globalData: this.globalData,
      layoutAliases: this.layoutAliases,
      passthroughCopies: this.passthroughCopies,
      liquidOptions: this.liquidOptions,
      liquidTags: this.liquidTags,
      liquidFilters: this.liquidFilters,
      liquidShortcodes: this.liquidShortcodes,
      liquidPairedShortcodes: this.liquidPairedShortcodes,
      nunjucksFilters: this.nunjucksFilters,
      nunjucksAsyncFilters: this.nunjucksAsyncFilters,
      nunjucksTags: this.nunjucksTags,
      nunjucksGlobals: this.nunjucksGlobals,
      nunjucksAsyncShortcodes: this.nunjucksAsyncShortcodes,
      nunjucksShortcodes: this.nunjucksShortcodes,
      nunjucksAsyncPairedShortcodes: this.nunjucksAsyncPairedShortcodes,
      nunjucksPairedShortcodes: this.nunjucksPairedShortcodes,
      handlebarsHelpers: this.handlebarsHelpers,
      handlebarsShortcodes: this.handlebarsShortcodes,
      handlebarsPairedShortcodes: this.handlebarsPairedShortcodes,
      javascriptFunctions: this.javascriptFunctions,
      pugOptions: this.pugOptions,
      ejsOptions: this.ejsOptions,
      markdownHighlighter: this.markdownHighlighter,
      libraryOverrides: this.libraryOverrides,
      dynamicPermalinks: this.dynamicPermalinks,
      useGitIgnore: this.useGitIgnore,
      dataDeepMerge: this.dataDeepMerge,
      watchJavaScriptDependencies: this.watchJavaScriptDependencies,
      additionalWatchTargets: this.additionalWatchTargets,
      browserSyncConfig: this.browserSyncConfig,
      chokidarConfig: this.chokidarConfig,
      watchThrottleWaitTime: this.watchThrottleWaitTime,
      frontMatterParsingOptions: this.frontMatterParsingOptions,
      dataExtensions: this.dataExtensions,
      extensionMap: this.extensionMap,
      quietMode: this.quietMode,
      events: this.events,
    };
  }
}

module.exports = UserConfig;
