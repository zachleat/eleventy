const chalk = require("chalk");
const fs = require("fs-extra");
const lodashMerge = require("lodash.merge");
const TemplatePath = require("./TemplatePath");
const eleventyConfig = require("./EleventyConfig");
const debug = require("debug")("Eleventy:TemplateConfig");

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
    this.initializeRootConfig();
    this.config = this.mergeConfig(this.localProjectConfigPath);
  }

  getLocalProjectConfigFile() {
    return this.localProjectConfigPath;
  }

  reset() {
    eleventyConfig.reset();
    this.initializeRootConfig();
    this.config = this.mergeConfig(this.localProjectConfigPath);
  }

  resetOnWatch() {
    eleventyConfig.resetOnWatch();
  }

  getConfig() {
    return this.config;
  }

  setProjectConfigPath(path) {
    this.localProjectConfigPath = path;

    this.config = this.mergeConfig(path);
  }

  setPathPrefix(pathPrefix) {
    debug("Setting pathPrefix to %o", pathPrefix);
    this.overrides.pathPrefix = pathPrefix;
    this.config.pathPrefix = pathPrefix;
  }

  initializeRootConfig() {
    this.rootConfig = this.customRootConfig || require("../config.js");

    if (typeof this.rootConfig === "function") {
      this.rootConfig = this.rootConfig(eleventyConfig);
      // debug( "rootConfig is a function, after calling, eleventyConfig is %o", eleventyConfig );
    }
    debug("rootConfig %o", this.rootConfig);
  }

  mergeConfig(localProjectConfigPath) {
    let overrides = ["templateFormats"];
    let localConfig = {};
    let path = TemplatePath.normalize(
      TemplatePath.getWorkingDir() + "/" + localProjectConfigPath
    );
    debug(`Merging config with ${path}`);

    if (fs.existsSync(path)) {
      try {
        // remove from require cache so it will grab a fresh copy
        if (path in require.cache) {
          delete require.cache[path];
        }

        localConfig = require(path);
        // debug( "localConfig require return value: %o", localConfig );
      } catch (err) {
        // TODO if file does exist, rethrow the error or console.log the error (file has syntax problem)

        // if file does not exist, return empty obj
        localConfig = {};
        debug(chalk.red("Problem getting localConfig file, %o"), err);
      }
    } else {
      debug("Eleventy local project config file not found, skipping.");
    }

    if (typeof localConfig === "function") {
      localConfig = localConfig(eleventyConfig);
      // debug( "localConfig is a function, after calling, eleventyConfig is %o", eleventyConfig );
    }

    let eleventyConfigApiMergingObject = eleventyConfig.getMergingConfigObject();
    localConfig = lodashMerge(localConfig, eleventyConfigApiMergingObject);

    // blow away any templateFormats set in config return object and prefer those set in config API.
    for (let localConfigKey of overrides) {
      localConfig[localConfigKey] =
        eleventyConfigApiMergingObject[localConfigKey] ||
        localConfig[localConfigKey];
    }

    // debug("eleventyConfig.getMergingConfigObject: %o", eleventyConfig.getMergingConfigObject());
    debug("localConfig: %o", localConfig);
    debug("overrides: %o", this.overrides);

    // Object assign overrides original values (good only for templateFormats) but not good for anything else
    let merged = lodashMerge({}, this.rootConfig, localConfig, this.overrides);

    // blow away any templateFormats upstream (don’t merge)
    for (let key of overrides) {
      merged[key] = localConfig[key] || this.rootConfig[key];
    }

    debug("Current configuration: %o", merged);

    return merged;
  }
}

module.exports = TemplateConfig;
