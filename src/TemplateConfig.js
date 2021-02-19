const fs = require("fs-extra");
const chalk = require("chalk");
const lodashUniq = require("lodash/uniq");
const lodashMerge = require("lodash/merge");
const TemplatePath = require("./TemplatePath");
const EleventyBaseError = require("./EleventyBaseError");
const eleventyConfig = require("./EleventyConfig");
const debug = require("debug")("Eleventy:TemplateConfig");
const deleteRequireCache = require("./Util/DeleteRequireCache");

/**
 * @module 11ty/eleventy/TemplateConfig
 */

/**
 * Config as used by the template.
 * @typedef {Object} module:11ty/eleventy/TemplateConfig~TemplateConfig~config
 * @property {String=} pathPrefix - The path prefix.
 */

/**
 * Object holding override information for the template config.
 * @typedef {Object} module:11ty/eleventy/TemplateConfig~TemplateConfig~override
 * @property {String=} pathPrefix - The path prefix.
 */

/**
 * Errors in eleventy config.
 */
class EleventyConfigError extends EleventyBaseError {}

/**
 * Config for a template.
 *
 * @param {{}} customRootConfig - tbd.
 * @param {String} localProjectConfigPath - Path to local project config.
 */
class TemplateConfig {
  constructor(customRootConfig, localProjectConfigPath) {
    /** @member {module:11ty/eleventy/TemplateConfig~TemplateConfig~override} - tbd. */
    this.overrides = {};

    /**
     * @member {String} - Path to local project config.
     * @default .eleventy.js
     */
    this.localProjectConfigPath = localProjectConfigPath || ".eleventy.js";

    if (customRootConfig) {
      /**
       * @member {?{}} - Custom root config.
       */
      this.customRootConfig = customRootConfig;
      debug("Warning: Using custom root config!");
    } else {
      this.customRootConfig = null;
    }

    this.initializeRootConfig();

    /**
     * @member {module:11ty/eleventy/TemplateConfig~TemplateConfig~config} - tbd.
     */
    this.config = this.mergeConfig(this.localProjectConfigPath);
  }

  /**
   * Normalises local project config file path.
   *
   * @method
   * @returns {String} - The normalised local project config file path.
   */
  getLocalProjectConfigFile() {
    return TemplatePath.addLeadingDotSlash(this.localProjectConfigPath);
  }

  get inputDir() {
    return this._inputDir;
  }

  set inputDir(inputDir) {
    this._inputDir = inputDir;
  }

  get tagsCollection() {
    return this.config.keys.tags;
  }

  /**
   * Resets the configuration.
   */
  reset() {
    eleventyConfig.reset();
    this.initializeRootConfig();
    this.config = this.mergeConfig(this.localProjectConfigPath);
  }

  /**
   * Resets the configuration while in watch mode.
   *
   * @todo Add implementation.
   */
  resetOnWatch() {
    // nothing yet
  }

  /**
   * Returns the config object.
   *
   * @returns {{}} - The config object.
   */
  getConfig() {
    return this.config;
  }

  /**
   * Overwrites the config path.
   *
   * @param {String} path - The new config path.
   */
  setProjectConfigPath(path) {
    this.localProjectConfigPath = path;

    this.config = this.mergeConfig(path);
  }

  /**
   * Overwrites the path prefix.
   *
   * @param {String} pathPrefix - The new path prefix.
   */
  setPathPrefix(pathPrefix) {
    debug("Setting pathPrefix to %o", pathPrefix);
    this.overrides.pathPrefix = pathPrefix;
    this.config.pathPrefix = pathPrefix;
  }

  /**
   * Bootstraps the config object.
   */
  initializeRootConfig() {
    this.rootConfig = this.customRootConfig || require("./defaultConfig.js");

    if (typeof this.rootConfig === "function") {
      this.rootConfig = this.rootConfig(eleventyConfig);
      // debug( "rootConfig is a function, after calling, eleventyConfig is %o", eleventyConfig );
    }
    debug("rootConfig %o", this.rootConfig);
  }

  /**
   * Merges different config files together.
   *
   * @param {String} localProjectConfigPath - Path to local project config.
   * @returns {{}} merged - The merged config file.
   */
  mergeConfig(localProjectConfigPath) {
    let localConfig = {};
    let path = TemplatePath.join(
      TemplatePath.getWorkingDir(),
      localProjectConfigPath
    );
    debug(`Merging config with ${path}`);

    if (fs.existsSync(path)) {
      try {
        // remove from require cache so it will grab a fresh copy
        if (path in require.cache) {
          deleteRequireCache(path);
        }

        localConfig = require(path);
        // debug( "localConfig require return value: %o", localConfig );

        if (typeof localConfig === "function") {
          localConfig = localConfig(eleventyConfig);
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

        if (
          localConfig &&
          localConfig.filters !== undefined &&
          Object.keys(localConfig.filters).length
        ) {
          throw new EleventyConfigError(
            `The \`filters\` configuration option was renamed in Eleventy 0.3.3 and removed in Eleventy 1.0. Please use the \`addTransform\` configuration method instead. Read more: https://www.11ty.dev/docs/config/#transforms`
          );
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

    debug("Current configuration: %o", merged);

    return merged;
  }
}

module.exports = TemplateConfig;
