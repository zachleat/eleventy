const fs = require("fs-extra");
const chalk = require("chalk");
const lodashUniq = require("lodash/uniq");
const lodashMerge = require("lodash/merge");
const TemplatePath = require("./TemplatePath");
const EleventyBaseError = require("./EleventyBaseError");
const eleventyConfig = require("./EleventyConfig");
const debug = require("debug")("Eleventy:TemplateConfig");
const deleteRequireCache = require("./Util/DeleteRequireCache");

class EleventyConfigError extends EleventyBaseError {}

class TemplateConfig {
  constructor(customRootConfig, localProjectConfigPath) {
    this.overrides = {};
    this.localProjectConfigPath = localProjectConfigPath || ".eleventy.js";

    if (customRootConfig) {
      this.customRootConfig = customRootConfig;
      debug("Warning: Using custom root config!");
    } else {
      this.customRootConfig = null;
    }
  }

  getLocalProjectConfigFile() {
    return TemplatePath.addLeadingDotSlash(this.localProjectConfigPath);
  }

  get inputDir() {
    return this._inputDir;
  }

  set inputDir(inputDir) {
    this._inputDir = inputDir;
  }

  async reset() {
    eleventyConfig.reset();
    await this.init();
  }

  getConfig() {
    if (!this.config) {
      throw new Error(`getConfig() cannot be called before UserConfig.init().`);
    }
    return this.config;
  }

  async setProjectConfigPath(path) {
    this.localProjectConfigPath = path;
    this.config = await this.mergeConfig(path);
  }

  setPathPrefix(pathPrefix) {
    debug("Setting pathPrefix to %o", pathPrefix);
    this.overrides.pathPrefix = pathPrefix;
    this.config.pathPrefix = pathPrefix;
  }

  async init() {
    this.rootConfig = this.customRootConfig || require("./defaultConfig.js");

    if (typeof this.rootConfig === "function") {
      this.rootConfig = await this.rootConfig(eleventyConfig);
      // debug( "rootConfig is a function, after calling, eleventyConfig is %o", eleventyConfig );
    }
    debug("rootConfig %o", this.rootConfig);

    this.config = await this.mergeConfig(this.localProjectConfigPath);
  }

  mergeEleventyConfig(localConfig) {
    let eleventyConfigApiMergingObject = eleventyConfig.getMergingConfigObject();

    // remove special merge keys from object
    let savedForSpecialMerge = {
      templateFormatsAdded: eleventyConfigApiMergingObject.templateFormatsAdded,
    };
    delete eleventyConfigApiMergingObject.templateFormatsAdded;

    localConfig = lodashMerge(localConfig, eleventyConfigApiMergingObject);

    // blow away any templateFormats set in config return object and prefer those set in config API.
    localConfig.templateFormats =
      eleventyConfigApiMergingObject.templateFormats ||
      localConfig.templateFormats;

    // debug("eleventyConfig.getMergingConfigObject: %o", eleventyConfig.getMergingConfigObject());
    debug("localConfig: %o", localConfig);
    debug("overrides: %o", this.overrides);

    // Object assign overrides original values (good only for templateFormats) but not good for anything else
    let merged = lodashMerge({}, this.rootConfig, localConfig, this.overrides);
    // blow away any templateFormats upstream (don’t deep merge)
    merged.templateFormats =
      localConfig.templateFormats || this.rootConfig.templateFormats;

    // Additive should preserve original templateFormats, wherever those come from (config API or config return object)
    if (savedForSpecialMerge.templateFormatsAdded) {
      merged.templateFormats = merged.templateFormats.concat(
        savedForSpecialMerge.templateFormatsAdded
      );
    }

    // Unique
    merged.templateFormats = lodashUniq(merged.templateFormats);

    return merged;
  }

  async mergeConfig(localProjectConfigPath) {
    let localConfig = {};
    let path = TemplatePath.join(
      TemplatePath.getWorkingDir(),
      localProjectConfigPath
    );
    debug(`Merging config with ${path}`);

    // Note for Mike: I'm delaying the processing of plugins until here.
    // Remember to come back and have a solid think about if this could
    // results in different results when merging

    if (fs.existsSync(path)) {
      try {
        // remove from require cache so it will grab a fresh copy
        if (path in require.cache) {
          deleteRequireCache(path);
        }

        localConfig = require(path);
        // debug( "localConfig require return value: %o", localConfig );

        if (typeof localConfig === "function") {
          localConfig = await localConfig(eleventyConfig);
          // debug( "localConfig is a function, after calling, eleventyConfig is %o", eleventyConfig );

          if (
            typeof localConfig === "object" &&
            typeof localConfig.then === "function"
          ) {
            throw new EleventyConfigError(
              `Error in your Eleventy config file '${path}': Returning a promise is not supported`
            );
          }
        }
      } catch (err) {
        throw new EleventyConfigError(
          `Error in your Eleventy config file '${path}'.` +
            (err.message.includes("Cannot find module")
              ? chalk.blueBright(" You may need to run `npm install`.")
              : ""),
          err
        );
      }
    } else {
      debug("Eleventy local project config file not found, skipping.");
    }

    // If passing template config data to plugins, we need to re-merge the data after applying plugins
    // each plugin has the abilty to change the eleventyConfig and thus the data that is merged from this
    let merged = this.mergeEleventyConfig(localConfig);
    await eleventyConfig.applyPlugins(merged);
    merged = this.mergeEleventyConfig(localConfig);

    debug("Current configuration: %o", merged);
    return merged;
  }
}

module.exports = TemplateConfig;
