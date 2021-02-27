const fs = require("fs-extra");
const fastglob = require("fast-glob");

const EleventyExtensionMap = require("./EleventyExtensionMap");
const TemplateData = require("./TemplateData");
const TemplateGlob = require("./TemplateGlob");
const TemplatePath = require("./TemplatePath");
const TemplatePassthroughManager = require("./TemplatePassthroughManager");

const config = require("./Config");
const debug = require("debug")("Eleventy:EleventyFiles");
// const debugDev = require("debug")("Dev:Eleventy:EleventyFiles");
const aggregateBench = require("./BenchmarkManager").get("Aggregate");

class EleventyFiles {
  constructor(input, outputDir, formats, passthroughAll) {
    this.config = config.getConfig();
    this.input = input;
    this.inputDir = TemplatePath.getDir(this.input);
    this.outputDir = outputDir;

    this.initConfig();

    this.passthroughAll = !!passthroughAll;

    this.formats = formats;
  }

  initConfig() {
    this.includesDir = TemplatePath.join(
      this.inputDir,
      this.config.dir.includes
    );

    if ("layouts" in this.config.dir) {
      this.layoutsDir = TemplatePath.join(
        this.inputDir,
        this.config.dir.layouts
      );
    }
  }

  init() {
    // Input was a directory
    if (this.input === this.inputDir) {
      this.templateGlobs = this.extensionMap.getGlobs(this.inputDir);
    } else {
      this.templateGlobs = TemplateGlob.map([this.input]);
    }

    this.initPassthroughManager();
    this.setupGlobs();
  }

  get validTemplateGlobs() {
    if (!this._validTemplateGlobs) {
      let globs;
      if (this.input === this.inputDir) {
        globs = this.extensionMap.getValidGlobs(this.inputDir);
      } else {
        globs = this.templateGlobs;
      }
      this._validTemplateGlobs = globs;
    }
    return this._validTemplateGlobs;
  }

  get passthroughGlobs() {
    let paths = new Set();
    // stuff added in addPassthroughCopy()
    for (let path of this.passthroughManager.getConfigPathGlobs()) {
      paths.add(path);
    }
    // non-template language extensions
    for (let path of this.extensionMap.getPassthroughCopyGlobs(this.inputDir)) {
      paths.add(path);
    }
    return Array.from(paths);
  }

  restart() {
    this.passthroughManager.reset();
    this.setupGlobs();
  }

  /* For testing */
  _setConfig(config) {
    this.config = config;
    this.initConfig();
  }
  /* Set command root for local project paths */
  _setLocalPathRoot(dir) {
    this.localPathRoot = dir;
  }

  set extensionMap(extensionMap) {
    this._extensionMap = extensionMap;
  }

  get extensionMap() {
    // for tests
    if (!this._extensionMap) {
      this._extensionMap = new EleventyExtensionMap(this.formats);
      this._extensionMap.config = this.config;
    }
    return this._extensionMap;
  }

  setPassthroughAll(passthroughAll) {
    this.passthroughAll = !!passthroughAll;
  }

  initPassthroughManager() {
    let mgr = new TemplatePassthroughManager();
    mgr.setInputDir(this.inputDir);
    mgr.setOutputDir(this.outputDir);
    mgr.extensionMap = this.extensionMap;
    this.passthroughManager = mgr;
  }

  getPassthroughManager() {
    return this.passthroughManager;
  }

  setPassthroughManager(mgr) {
    mgr.extensionMap = this.extensionMap;
    this.passthroughManager = mgr;
  }

  set templateData(templateData) {
    this._templateData = templateData;
  }

  get templateData() {
    if (!this._templateData) {
      this._templateData = new TemplateData(this.inputDir);
    }
    return this._templateData;
  }

  getDataDir() {
    let data = this.templateData;

    return data.getDataDir();
  }

  setupGlobs() {
    this.fileIgnores = this.getIgnores();

    if (this.passthroughAll) {
      this.templateGlobsWithIgnoresFromFiles = TemplateGlob.map([
        TemplateGlob.normalizePath(this.input, "/**"),
      ]).concat(this.fileIgnores);
    } else {
      this.templateGlobsWithIgnoresFromFiles = this.templateGlobs.concat(
        this.fileIgnores
      );
    }

    this.templateGlobsWithAllIgnores = this.templateGlobsWithIgnoresFromFiles.concat(
      this._getIncludesAndDataDirIgnores()
    );
  }

  static getFileIgnores(ignoreFiles, defaultIfFileDoesNotExist) {
    if (!Array.isArray(ignoreFiles)) {
      ignoreFiles = [ignoreFiles];
    }

    let ignores = [];
    let fileFound = false;
    let dirs = [];
    for (let ignorePath of ignoreFiles) {
      ignorePath = TemplatePath.normalize(ignorePath);

      let dir = TemplatePath.getDirFromFilePath(ignorePath);
      dirs.push(dir);

      if (fs.existsSync(ignorePath) && fs.statSync(ignorePath).size > 0) {
        fileFound = true;
        let ignoreContent = fs.readFileSync(ignorePath, "utf-8");

        // make sure that empty .gitignore with spaces takes default ignore.
        if (ignoreContent.trim().length === 0) {
          fileFound = false;
        } else {
          ignores = ignores.concat(
            EleventyFiles.normalizeIgnoreContent(dir, ignoreContent)
          );
        }
      }
    }

    if (!fileFound && defaultIfFileDoesNotExist) {
      ignores.push("!" + TemplateGlob.normalizePath(defaultIfFileDoesNotExist));
      for (let dir of dirs) {
        ignores.push(
          "!" + TemplateGlob.normalizePath(dir, defaultIfFileDoesNotExist)
        );
      }
    }

    ignores.forEach(function (path) {
      debug(`${ignoreFiles} ignoring: ${path}`);
    });
    return ignores;
  }

  static normalizeIgnoreContent(dir, ignoreContent) {
    let ignores = [];

    if (ignoreContent) {
      ignores = ignoreContent
        .split("\n")
        .map(line => {
          return line.trim();
        })
        .filter(line => {
          if (line.charAt(0) === "!") {
            debug(
              ">>> When processing .gitignore/.eleventyignore, Eleventy does not currently support negative patterns but encountered one:"
            );
            debug(">>>", line);
            debug(
              "Follow along at https://github.com/11ty/eleventy/issues/693 to track support."
            );
          }

          // empty lines or comments get filtered out
          return (
            line.length > 0 && line.charAt(0) !== "#" && line.charAt(0) !== "!"
          );
        })
        .map(line => {
          let path = TemplateGlob.normalizePath(dir, "/", line);
          path = TemplatePath.addLeadingDotSlash(
            TemplatePath.relativePath(path)
          );

          try {
            // Note these folders must exist to get /** suffix
            let stat = fs.statSync(path);
            if (stat.isDirectory()) {
              return "!" + path + "/**";
            }
            return "!" + path;
          } catch (e) {
            return "!" + path;
          }
        });
    }

    return ignores;
  }

  getIgnores() {
    let files = [];
    let rootDirectory = this.localPathRoot || TemplatePath.getWorkingDir();
    let absoluteInputDir = TemplatePath.absolutePath(this.inputDir);
    if (this.config.useGitIgnore) {
      let gitIgnores = [TemplatePath.join(rootDirectory, ".gitignore")];
      if (rootDirectory !== absoluteInputDir) {
        gitIgnores.push(TemplatePath.join(this.inputDir, ".gitignore"));
      }

      files = files.concat(
        EleventyFiles.getFileIgnores(gitIgnores, "node_modules/**")
      );
    }

    if (this.config.eleventyignoreOverride !== false) {
      let eleventyIgnores = [
        TemplatePath.join(rootDirectory, ".eleventyignore"),
      ];
      if (rootDirectory !== absoluteInputDir) {
        eleventyIgnores.push(
          TemplatePath.join(this.inputDir, ".eleventyignore")
        );
      }

      files = files.concat(
        this.config.eleventyignoreOverride ||
          EleventyFiles.getFileIgnores(eleventyIgnores)
      );
    }

    // ignore output dir unless that would occlude all input
    if (!TemplatePath.startsWithSubPath(this.inputDir, this.outputDir)) {
      files = files.concat(TemplateGlob.map("!" + this.outputDir + "/**"));
    }

    return files;
  }

  getIncludesDir() {
    return this.includesDir;
  }

  getLayoutsDir() {
    return this.layoutsDir;
  }

  getFileGlobs() {
    return this.templateGlobsWithAllIgnores;
  }

  getRawFiles() {
    return this.templateGlobs;
  }

  getWatchPathCache() {
    // Issue #1325: make sure passthrough copy files are not included here
    if (!this.pathCache) {
      throw new Error(
        "Watching requires `.getFiles()` to be called first in EleventyFiles"
      );
    }

    return this.pathCache.filter(path =>
      this.extensionMap.isFullTemplateFilename(path)
    );
  }

  async getFiles() {
    let globs = this.getFileGlobs();

    debug("Searching for: %o", globs);
    let bench = aggregateBench.get("Searching the file system");
    bench.before();
    let paths = TemplatePath.addLeadingDotSlashArray(
      await fastglob(globs, {
        caseSensitiveMatch: false,
        dot: true,
      })
    );
    bench.after();

    if ("extensionMap" in this.config) {
      let extensions = this.config.extensionMap;
      paths = paths.filter(function (path) {
        for (let entry of extensions) {
          // TODO `.${extension}` ?
          if (path.endsWith(entry.extension) && entry.filter) {
            return entry.filter(path);
          }
        }
        return true;
      });
    }

    this.pathCache = paths;
    return paths;
  }

  /* For `eleventy --watch` */
  getGlobWatcherFiles() {
    // TODO is it better to tie the includes and data to specific file extensions or keep the **?
    return this.validTemplateGlobs
      .concat(this.passthroughGlobs)
      .concat(this._getIncludesAndDataDirs());
  }

  /* For `eleventy --watch` */
  async getGlobWatcherTemplateDataFiles() {
    let templateData = this.templateData;
    return await templateData.getTemplateDataFileGlob();
  }

  /* For `eleventy --watch` */
  // TODO this isn’t great but reduces complexity avoiding using TemplateData:getLocalDataPaths for each template in the cache
  async getWatcherTemplateJavaScriptDataFiles() {
    let globs = await this.templateData.getTemplateJavaScriptDataFileGlob();
    let bench = aggregateBench.get("Searching the file system");
    bench.before();
    let results = TemplatePath.addLeadingDotSlashArray(
      await fastglob(globs, {
        ignore: ["**/node_modules/**"],
        caseSensitiveMatch: false,
        dot: true,
      })
    );
    bench.after();
    return results;
  }

  /* Ignored by `eleventy --watch` */
  getGlobWatcherIgnores() {
    // convert to format without ! since they are passed in as a separate argument to glob watcher
    return this.fileIgnores.map(ignore =>
      TemplatePath.stripLeadingDotSlash(ignore.substr(1))
    );
  }

  _getIncludesAndDataDirs() {
    let files = [];
    // we want this to fail on "" because we don’t want to ignore the
    // entire input directory when using ""
    if (this.config.dir.includes) {
      files = files.concat(TemplateGlob.map(this.includesDir + "/**"));
    }

    // we want this to fail on "" because we don’t want to ignore the
    // entire input directory when using ""
    if (this.config.dir.layouts) {
      files = files.concat(TemplateGlob.map(this.layoutsDir + "/**"));
    }

    if (this.config.dir.data && this.config.dir.data !== ".") {
      let dataDir = this.getDataDir();
      files = files.concat(TemplateGlob.map(dataDir + "/**"));
    }

    return files;
  }

  _getIncludesAndDataDirIgnores() {
    return this._getIncludesAndDataDirs().map(function (dir) {
      return "!" + dir;
    });
  }
}

module.exports = EleventyFiles;
