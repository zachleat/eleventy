const EleventyExtensionMap = require("./EleventyExtensionMap");
const EleventyBaseError = require("./EleventyBaseError");
const TemplatePassthrough = require("./TemplatePassthrough");
const TemplatePath = require("./TemplatePath");
const debug = require("debug")("Eleventy:TemplatePassthroughManager");

class TemplatePassthroughManagerCopyError extends EleventyBaseError {}

class TemplatePassthroughManager {
  constructor(templateConfig) {
    this.config = templateConfig.getConfig();
    this.templateConfig = templateConfig;
    this.reset();
  }

  reset() {
    this.count = 0;
    this.incrementalFile = null;
    debug("Resetting counts to 0");
  }

  setConfig(configOverride) {
    this.config = configOverride || {};
  }

  set extensionMap(extensionMap) {
    this._extensionMap = extensionMap;
  }

  get extensionMap() {
    if (!this._extensionMap) {
      this._extensionMap = new EleventyExtensionMap([], this.templateConfig);
      this._extensionMap.config = this.config;
    }
    return this._extensionMap;
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

  setIncrementalFile(path) {
    this.incrementalFile = path;
  }

  _normalizePaths(path, outputPath) {
    return {
      inputPath: TemplatePath.addLeadingDotSlash(path),
      outputPath: outputPath
        ? TemplatePath.stripLeadingDotSlash(outputPath)
        : true,
    };
  }

  getConfigPaths() {
    if (!this.config.passthroughFileCopy) {
      debug("`passthroughFileCopy` is disabled in config, bypassing.");
      return [];
    }

    let paths = [];
    let target = this.config.passthroughCopies || {};
    debug("`passthroughFileCopy` config paths: %o", target);
    for (let path in target) {
      paths.push(this._normalizePaths(path, target[path]));
    }
    debug("`passthroughFileCopy` config normalized paths: %o", paths);
    return paths;
  }

  getConfigPathGlobs() {
    return this.getConfigPaths().map((path) => {
      return TemplatePath.convertToRecursiveGlobSync(path.inputPath);
    });
  }

  getNonTemplatePaths(paths) {
    if (!this.config.passthroughFileCopy) {
      debug("`passthroughFileCopy` is disabled in config, bypassing.");
      return [];
    }

    let matches = [];
    for (let path of paths) {
      if (!this.extensionMap.hasEngine(path)) {
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

    if (this.incrementalFile && path.inputPath !== this.incrementalFile) {
      pass.setDryRun(true);
    } else {
      pass.setDryRun(this.isDryRun);
    }

    return pass
      .write()
      .then((fileCopyCount) => {
        if (pass.isDryRun) {
          // We don’t count the skipped files as we need to iterate over them
          debug(
            "Skipped %o (either from --dryrun or --incremental)",
            path.inputPath
          );
        } else {
          if (Array.isArray(fileCopyCount)) {
            // globs
            for (let count of fileCopyCount) {
              this.count += count;
            }
          } else {
            this.count += fileCopyCount;
          }
          debug("Copied %o (%d files)", path.inputPath, fileCopyCount || 0);
        }
      })
      .catch(function (e) {
        return Promise.reject(
          new TemplatePassthroughManagerCopyError(
            `Having trouble copying '${path.inputPath}'`,
            e
          )
        );
      });
  }

  isPassthroughCopyFile(paths, changedFile) {
    for (let path of paths) {
      if (path === changedFile && !this.extensionMap.hasEngine(path)) {
        return true;
      }
    }

    for (let path of this.getConfigPaths()) {
      if (TemplatePath.startsWithSubPath(changedFile, path.inputPath)) {
        return true;
      }
    }

    return false;
  }

  // Performance note: these can actually take a fair bit of time, but aren’t a
  // bottleneck to eleventy. The copies are performed asynchronously and don’t affect eleventy
  // write times in a significant way.
  async copyAll(paths) {
    if (!this.config.passthroughFileCopy) {
      debug("`passthroughFileCopy` is disabled in config, bypassing.");
      return;
    }

    if (
      this.incrementalFile &&
      this.isPassthroughCopyFile(paths, this.incrementalFile)
    ) {
      return this.copyPath(this._normalizePaths(this.incrementalFile)).then(
        () => {
          debug(
            `TemplatePassthrough --incremental copy finished. Current count: ${this.count}`
          );
        }
      );
    }

    let promises = [];
    debug("TemplatePassthrough copy started.");
    for (let path of this.getConfigPaths()) {
      debug("TemplatePassthrough copying from config: %o", path);
      promises.push(this.copyPath(path));
    }

    let passthroughPaths = this.getNonTemplatePaths(paths);
    for (let path of passthroughPaths) {
      let normalizedPath = this._normalizePaths(path);
      debug(
        `TemplatePassthrough copying from non-matching file extension: ${normalizedPath.inputPath}`
      );
      promises.push(this.copyPath(normalizedPath));
    }

    return Promise.all(promises).then(() => {
      debug(`TemplatePassthrough copy finished. Current count: ${this.count}`);
    });
  }
}

module.exports = TemplatePassthroughManager;
