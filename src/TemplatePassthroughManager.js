const config = require("./Config");
const EleventyError = require("./EleventyError");
const TemplatePassthrough = require("./TemplatePassthrough");
const TemplateRender = require("./TemplateRender");
const TemplatePath = require("./TemplatePath");
const debug = require("debug")("Eleventy:TemplatePassthroughManager");

class TemplatePassthroughManager {
  constructor(inputDir, outputDir, isDryRun) {
    this.config = config.getConfig();

    this.reset();
  }

  reset() {
    this.count = 0;
    debug("Resetting counts to 0");
  }

  setConfig(configOverride) {
    this.config = configOverride || {};
  }

  setOutputDir(outputDir) {
    this.outputDir = outputDir;
  }

  setInputDir(inputDir) {
    this.inputDir = inputDir;
  }

  setDryRun(isDryRun) {
    this.isDryRun = !!isDryRun;
  }

  getConfigPaths() {
    if (!this.config.passthroughFileCopy) {
      debug("`passthroughFileCopy` is disabled in config, bypassing.");
      return [];
    }

    let paths = [];
    let target = this.config.passthroughCopies || {};
    for (let path in target) {
      paths.push(TemplatePath.addLeadingDotSlash(path));
    }
    return paths;
  }

  getConfigPathGlobs() {
    return this.getConfigPaths().map(path => {
      return TemplatePath.convertToGlob(path);
    });
  }

  getFilePaths(paths) {
    if (!this.config.passthroughFileCopy) {
      debug("`passthroughFileCopy` is disabled in config, bypassing.");
      return [];
    }

    let matches = [];
    for (let path of paths) {
      if (!TemplateRender.hasEngine(path)) {
        matches.push(path);
      }
    }

    return matches;
  }

  getCopyCount() {
    return this.count;
  }

  async copyPath(path) {
    let pass = new TemplatePassthrough(path, this.outputDir, this.inputDir);
    pass.setDryRun(this.isDryRun);

    try {
      return pass.write().then(function() {
        debug("Copied %o", path);
      });
    } catch (e) {
      throw EleventyError.make(new Error(`Having trouble copying: ${path}`), e);
    }
  }

  // Performance note: these can actually take a fair bit of time, but aren’t a
  // bottleneck to eleventy. The copies are performed asynchronously and don’t affect eleventy
  // write times in a significant way.
  async copyAll(paths) {
    if (!this.config.passthroughFileCopy) {
      debug("`passthroughFileCopy` is disabled in config, bypassing.");
      return;
    }

    let promises = [];
    debug("TemplatePassthrough copy started.");
    for (let cfgPath of this.getConfigPaths()) {
      this.count++;
      promises.push(this.copyPath(cfgPath));
    }

    let passthroughPaths = this.getFilePaths(paths);
    for (let path of passthroughPaths) {
      this.count++;
      promises.push(this.copyPath(path));
    }

    return Promise.all(promises).then(() => {
      debug(`TemplatePassthrough copy finished. Current count: ${this.count}`);
    });
  }
}

module.exports = TemplatePassthroughManager;
