const EleventyExtensionMap = require("./EleventyExtensionMap");
const EleventyBaseError = require("./EleventyBaseError");
const TemplatePassthrough = require("./TemplatePassthrough");
const TemplatePath = require("./TemplatePath");
const debug = require("debug")("Eleventy:TemplatePassthroughManager");
const debugDev = require("debug")("Dev:Eleventy:TemplatePassthroughManager");

class TemplatePassthroughManagerConfigError extends EleventyBaseError {}
class TemplatePassthroughManagerCopyError extends EleventyBaseError {}

class TemplatePassthroughManager {
  constructor(eleventyConfig) {
    if (!eleventyConfig) {
      throw new TemplatePassthroughManagerConfigError(
        "Missing `config` argument."
      );
    }
    this.eleventyConfig = eleventyConfig;
    this.config = eleventyConfig.getConfig();
    this.reset();
  }

  reset() {
    this.count = 0;
    this.conflictMap = {};
    this.incrementalFile = null;
    debug("Resetting counts to 0");
  }

  set extensionMap(extensionMap) {
    this._extensionMap = extensionMap;
  }

  get extensionMap() {
    if (!this._extensionMap) {
      this._extensionMap = new EleventyExtensionMap([], this.config);
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
    if (path) {
      this.incrementalFile = path;
    }
  }

  _normalizePaths(path, outputPath, copyOptions = {}) {
    return {
      inputPath: TemplatePath.addLeadingDotSlash(path),
      outputPath: outputPath
        ? TemplatePath.stripLeadingDotSlash(outputPath)
        : true,
      copyOptions,
    };
  }

  getConfigPaths() {
    const paths = [];
    const pathsRaw = this.config.passthroughCopies || {};
    debug("`addPassthroughCopy` config API paths: %o", pathsRaw);
    for (const [inputPath, { outputPath, copyOptions }] of Object.entries(pathsRaw)) {
      paths.push(this._normalizePaths(inputPath, outputPath, copyOptions));
    }
    debug("`addPassthroughCopy` config API normalized paths: %o", paths);
    return paths;
  }

  getConfigPathGlobs() {
    return this.getConfigPaths().map((path) => {
      return TemplatePath.convertToRecursiveGlobSync(path.inputPath);
    });
  }

  getNonTemplatePaths(paths) {
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

  getTemplatePassthroughForPath(path) {
    return new TemplatePassthrough(path, this.outputDir, this.inputDir);
  }

  async copyPassthrough(pass) {
    if (!(pass instanceof TemplatePassthrough)) {
      throw new TemplatePassthroughManagerCopyError(
        "copyPassthrough expects an instance of TemplatePassthrough"
      );
    }

    let path = pass.getPath();
    pass.setDryRun(this.isDryRun);

    return pass
      .write()
      .then(({ count, map }) => {
        for (let src in map) {
          let dest = map[src];
          if (this.conflictMap[dest]) {
            throw new TemplatePassthroughManagerCopyError(
              `Multiple passthrough copy files are trying to write to the same output file (${dest}). ${src} and ${this.conflictMap[dest]}`
            );
          }

          debugDev(
            "Adding %o to passthrough copy conflict map, from %o",
            dest,
            src
          );
          this.conflictMap[dest] = src;
        }

        if (pass.isDryRun) {
          // We don’t count the skipped files as we need to iterate over them
          debug(
            "Skipped %o (either from --dryrun or --incremental)",
            path.inputPath
          );
        } else {
          if (count) {
            this.count += count;
          }
          debug("Copied %o (%d files)", path.inputPath, count || 0);
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

  getAllNormalizedPaths(paths) {
    if (this.incrementalFile) {
      if (this.isPassthroughCopyFile(paths, this.incrementalFile)) {
        return [this._normalizePaths(this.incrementalFile)];
      }
      return [];
    }

    const normalizedPaths = this.getConfigPaths();
    if (debug.enabled) {
      for (const path of normalizedPaths) {
        debug("TemplatePassthrough copying from config: %o", path);
      }
    }

    if (paths && paths.length) {
      const passthroughPaths = this.getNonTemplatePaths(paths);
      for (const path of passthroughPaths) {
        const normalizedPath = this._normalizePaths(path);
        normalizedPaths.push(normalizedPath);
      }
      if (debug.enabled) {
        for (const path of passthroughPaths) {
          const normalizedPath = this._normalizePaths(path);
          debug(
            `TemplatePassthrough copying from non-matching file extension: ${normalizedPath.inputPath}`
          );
        }
      }
    }

    return normalizedPaths;
  }

  // Performance note: these can actually take a fair bit of time, but aren’t a
  // bottleneck to eleventy. The copies are performed asynchronously and don’t affect eleventy
  // write times in a significant way.
  async copyAll(paths) {
    debug("TemplatePassthrough copy started.");
    let normalizedPaths = this.getAllNormalizedPaths(paths);

    const passthroughs = normalizedPaths.map(path => this.getTemplatePassthroughForPath(path));

    return Promise.all(
      passthroughs.map((pass) => this.copyPassthrough(pass))
    ).then(() => {
      debug(`TemplatePassthrough copy finished. Current count: ${this.count}`);
    });
  }
}

module.exports = TemplatePassthroughManager;
