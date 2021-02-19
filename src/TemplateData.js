const fs = require("fs-extra");
const fastglob = require("fast-glob");
const parsePath = require("parse-filepath");
const lodashset = require("lodash/set");
const lodashget = require("lodash/get");
const lodashUniq = require("lodash/uniq");
const merge = require("./Util/Merge");
const TemplateRender = require("./TemplateRender");
const TemplatePath = require("./TemplatePath");
const TemplateGlob = require("./TemplateGlob");
const EleventyExtensionMap = require("./EleventyExtensionMap");
const EleventyBaseError = require("./EleventyBaseError");

const config = require("./Config");
const debugWarn = require("debug")("Eleventy:Warnings");
const debug = require("debug")("Eleventy:TemplateData");
const debugDev = require("debug")("Dev:Eleventy:TemplateData");
const deleteRequireCache = require("./Util/DeleteRequireCache");

const bench = require("./BenchmarkManager").get("Data");
const aggregateBench = require("./BenchmarkManager").get("Aggregate");

class FSExistsCache {
  constructor() {
    this._cache = new Map();
  }
  has(path) {
    return this._cache.has(path);
  }
  exists(path) {
    let exists = this._cache.get(path);
    if (!this.has(path)) {
      exists = fs.pathExistsSync(path);
      this._cache.set(path, exists);
    }
    return exists;
  }
  markExists(path, value = true) {
    this._cache.set(path, !!value);
  }
}

class TemplateDataParseError extends EleventyBaseError {}

class TemplateData {
  constructor(inputDir) {
    this.config = config.getConfig();
    this.dataTemplateEngine = this.config.dataTemplateEngine;

    this.inputDirNeedsCheck = false;
    this.setInputDir(inputDir);

    this.rawImports = {};
    this.globalData = null;

    // It's common for data files not to exist, so we avoid going to the FS to
    // re-check if they do via a quick-and-dirty cache.
    this._fsExistsCache = new FSExistsCache();
  }

  get extensionMap() {
    if (!this._extensionMap) {
      this._extensionMap = new EleventyExtensionMap();
      this._extensionMap.config = this.config;
    }
    return this._extensionMap;
  }

  set extensionMap(map) {
    this._extensionMap = map;
  }

  /* Used by tests */
  _setConfig(config) {
    this.config = config;
    this.dataTemplateEngine = this.config.dataTemplateEngine;
  }

  setInputDir(inputDir) {
    this.inputDirNeedsCheck = true;
    this.inputDir = inputDir;
    this.dataDir = this.config.dir.data
      ? TemplatePath.join(inputDir, this.config.dir.data)
      : inputDir;
  }

  setDataTemplateEngine(engineName) {
    this.dataTemplateEngine = engineName;
  }

  getRawImports() {
    let pkgPath = TemplatePath.absolutePath("package.json");

    try {
      this.rawImports[this.config.keys.package] = require(pkgPath);
    } catch (e) {
      debug(
        "Could not find and/or require package.json for data preprocessing at %o",
        pkgPath
      );
    }

    return this.rawImports;
  }

  getDataDir() {
    return this.dataDir;
  }

  clearData() {
    this.globalData = null;
  }

  async cacheData() {
    this.clearData();

    return this.getData();
  }

  _getGlobalDataGlobByExtension(dir, extension) {
    return TemplateGlob.normalizePath(
      dir,
      "/",
      this.config.dir.data !== "." ? this.config.dir.data : "",
      `/**/*.${extension}`
    );
  }

  async _checkInputDir() {
    if (this.inputDirNeedsCheck) {
      let globalPathStat = await fs.stat(this.inputDir);

      if (!globalPathStat.isDirectory()) {
        throw new Error("Could not find data path directory: " + this.inputDir);
      }

      this.inputDirNeedsCheck = false;
    }
  }

  async getInputDir() {
    let dir = ".";

    if (this.inputDir) {
      await this._checkInputDir();
      dir = this.inputDir;
    }

    return dir;
  }

  async getTemplateDataFileGlob() {
    let dir = await this.getInputDir();
    let paths = [
      `${dir}/**/*.json`, // covers .11tydata.json too
      `${dir}/**/*${this.config.jsDataFileSuffix}.cjs`,
      `${dir}/**/*${this.config.jsDataFileSuffix}.js`,
    ];

    if (this.hasUserDataExtensions()) {
      let userPaths = this.getUserDataExtensions().map(
        (extension) => `${dir}/**/*.${extension}` // covers .11tydata.{extension} too
      );
      paths = userPaths.concat(paths);
    }

    return TemplatePath.addLeadingDotSlashArray(paths);
  }

  async getTemplateJavaScriptDataFileGlob() {
    let dir = await this.getInputDir();
    return TemplatePath.addLeadingDotSlashArray([
      `${dir}/**/*${this.config.jsDataFileSuffix}.js`,
    ]);
  }

  async getGlobalDataGlob() {
    let dir = await this.getInputDir();

    let extGlob = this.getGlobalDataExtensionPriorities().join("|");
    return [this._getGlobalDataGlobByExtension(dir, "(" + extGlob + ")")];
  }

  getWatchPathCache() {
    return this.pathCache;
  }

  getGlobalDataExtensionPriorities() {
    return this.getUserDataExtensions().concat(["json", "cjs", "js"]);
  }

  static calculateExtensionPriority(path, priorities) {
    for (let i = 0; i < priorities.length; i++) {
      let ext = priorities[i];
      if (path.endsWith(ext)) {
        return i;
      }
    }
    return priorities.length;
  }

  async getGlobalDataFiles() {
    let priorities = this.getGlobalDataExtensionPriorities();

    let fsBench = aggregateBench.get("Searching the file system");
    fsBench.before();
    let paths = fastglob.sync(await this.getGlobalDataGlob(), {
      caseSensitiveMatch: false,
      dot: true,
    });
    fsBench.after();

    // sort paths according to extension priorities
    // here we use reverse ordering, because paths with bigger index in array will override the first ones
    // example [path/file.json, path/file.js] here js will override json
    paths = paths.sort((first, second) => {
      let p1 = TemplateData.calculateExtensionPriority(first, priorities);
      let p2 = TemplateData.calculateExtensionPriority(second, priorities);
      if (p1 < p2) {
        return -1;
      }
      if (p1 > p2) {
        return 1;
      }
      return 0;
    });

    this.pathCache = paths;
    return paths;
  }

  getObjectPathForDataFile(path) {
    let reducedPath = TemplatePath.stripLeadingSubPath(path, this.dataDir);
    let parsed = parsePath(reducedPath);
    let folders = parsed.dir ? parsed.dir.split("/") : [];
    folders.push(parsed.name);

    return folders.join(".");
  }

  async getAllGlobalData() {
    let rawImports = this.getRawImports();
    let globalData = {};
    let files = TemplatePath.addLeadingDotSlashArray(
      await this.getGlobalDataFiles()
    );

    let dataFileConflicts = {};

    for (let j = 0, k = files.length; j < k; j++) {
      let objectPathTarget = await this.getObjectPathForDataFile(files[j]);
      let data = await this.getDataValue(files[j], rawImports);

      // if two global files have the same path (but different extensions)
      // and conflict, let’s merge them.
      if (dataFileConflicts[objectPathTarget]) {
        debugWarn(
          `merging global data from ${files[j]} with an already existing global data file (${dataFileConflicts[objectPathTarget]}). Overriding existing keys.`
        );

        let oldData = lodashget(globalData, objectPathTarget);
        data = TemplateData.mergeDeep(this.config, oldData, data);
      }

      dataFileConflicts[objectPathTarget] = files[j];
      debug(
        `Found global data file ${files[j]} and adding as: ${objectPathTarget}`
      );
      lodashset(globalData, objectPathTarget, data);
    }

    return globalData;
  }

  async getInitialGlobalData() {
    let globalData = {};
    if (this.config.globalData) {
      let keys = Object.keys(this.config.globalData);
      for (let j = 0; j < keys.length; j++) {
        let returnValue = this.config.globalData[keys[j]];

        if (typeof returnValue === "function") {
          returnValue = await returnValue();
        }
        globalData[keys[j]] = returnValue;
      }
    }
    return globalData;
  }

  async getData() {
    let rawImports = this.getRawImports();

    let initialGlobalData = await this.getInitialGlobalData();

    if (!this.globalData) {
      let globalJson = await this.getAllGlobalData();

      // OK: Shallow merge when combining rawImports (pkg) with global data files
      this.globalData = Object.assign(
        {},
        initialGlobalData,
        globalJson,
        rawImports
      );
    }

    return this.globalData;
  }

  /* Template and Directory data files */
  async combineLocalData(localDataPaths) {
    let localData = {};
    if (!Array.isArray(localDataPaths)) {
      localDataPaths = [localDataPaths];
    }

    // Filter out files we know don't exist to avoid overhead for checking
    localDataPaths = localDataPaths.filter((path) => {
      return this._fsExistsCache.exists(path);
    });

    if (!localDataPaths.length) {
      return localData;
    }

    for (let path of localDataPaths) {
      // clean up data for template/directory data files only.
      let dataForPath = await this.getDataValue(path, null, true);
      let cleanedDataForPath = TemplateData.cleanupData(dataForPath);
      TemplateData.mergeDeep(this.config, localData, cleanedDataForPath);
      // debug("`combineLocalData` (iterating) for %o: %O", path, localData);
    }
    return localData;
  }

  async getLocalData(templatePath) {
    let localDataPaths = await this.getLocalDataPaths(templatePath);
    let importedData = await this.combineLocalData(localDataPaths);
    let globalData = await this.getData();

    // OK-ish: shallow merge when combining template/data dir files with global data files
    let localData = Object.assign({}, globalData, importedData);
    // debug("`getLocalData` for %o: %O", templatePath, localData);
    return localData;
  }

  getUserDataExtensions() {
    if (!this.config.dataExtensions) {
      return [];
    }

    // returning extensions in reverse order to create proper extension order
    // later added formats will override first ones
    return Array.from(this.config.dataExtensions.keys()).reverse();
  }

  getUserDataParser(extension) {
    return this.config.dataExtensions.get(extension);
  }

  isUserDataExtension(extension) {
    return (
      this.config.dataExtensions && this.config.dataExtensions.has(extension)
    );
  }

  hasUserDataExtensions() {
    return this.config.dataExtensions && this.config.dataExtensions.size > 0;
  }

  async _loadFileContents(path) {
    let rawInput;
    try {
      rawInput = await fs.readFile(path, "utf-8");
    } catch (e) {
      // if file does not exist, return nothing
    }
    return rawInput;
  }

  async _parseDataFile(path, rawImports, ignoreProcessing, parser) {
    let rawInput = await this._loadFileContents(path);
    let engineName = this.dataTemplateEngine;

    if (!rawInput) {
      return {};
    }

    if (ignoreProcessing || engineName === false) {
      try {
        return parser(rawInput);
      } catch (e) {
        throw new TemplateDataParseError(
          `Having trouble parsing data file ${path}`,
          e
        );
      }
    } else {
      let tr = new TemplateRender(engineName, this.inputDir);
      tr.extensionMap = this.extensionMap;

      let fn = await tr.getCompiledTemplate(rawInput);

      try {
        // pass in rawImports, don’t pass in global data, that’s what we’re parsing
        let raw = await fn(rawImports);
        return parser(raw);
      } catch (e) {
        throw new TemplateDataParseError(
          `Having trouble parsing data file ${path}`,
          e
        );
      }
    }
  }

  // ignoreProcessing = false for global data files
  // ignoreProcessing = true for local data files
  async getDataValue(path, rawImports, ignoreProcessing) {
    let extension = TemplatePath.getExtension(path);

    if (
      extension === "js" ||
      extension === "cjs" ||
      (extension === "json" && (ignoreProcessing || !this.dataTemplateEngine))
    ) {
      // JS data file or require’d JSON (no preprocessing needed)
      let localPath = TemplatePath.absolutePath(path);
      let exists = this._fsExistsCache.exists(localPath);
      // Make sure that relative lookups benefit from cache
      this._fsExistsCache.markExists(path, exists);

      if (!exists) {
        return {};
      }

      let aggregateDataBench = aggregateBench.get("Data File");
      aggregateDataBench.before();
      let dataBench = bench.get(`\`${path}\``);
      dataBench.before();
      deleteRequireCache(localPath);

      let returnValue = require(localPath);
      if (typeof returnValue === "function") {
        returnValue = await returnValue();
      }

      dataBench.after();
      aggregateDataBench.after();
      return returnValue;
    } else if (this.isUserDataExtension(extension)) {
      // Other extensions
      var parser = this.getUserDataParser(extension);
      return this._parseDataFile(path, rawImports, ignoreProcessing, parser);
    } else if (extension === "json") {
      // File to string, parse with JSON (preprocess)
      return this._parseDataFile(
        path,
        rawImports,
        ignoreProcessing,
        JSON.parse
      );
    } else {
      throw new TemplateDataParseError(
        `Could not find an appropriate data parser for ${path}. Do you need to add a plugin to your config file?`
      );
    }
  }

  _pushExtensionsToPaths(paths, curpath, extensions) {
    for (let extension of extensions) {
      paths.push(curpath + "." + extension);
    }
  }

  _addBaseToPaths(paths, base, extensions) {
    let dataSuffix = this.config.jsDataFileSuffix;

    // data suffix
    paths.push(base + dataSuffix + ".js");
    paths.push(base + dataSuffix + ".cjs");
    paths.push(base + dataSuffix + ".json");

    // inject user extensions
    this._pushExtensionsToPaths(paths, base + dataSuffix, extensions);

    // top level
    paths.push(base + ".json");
    this._pushExtensionsToPaths(paths, base, extensions);
  }

  async getLocalDataPaths(templatePath) {
    let paths = [];
    let parsed = parsePath(templatePath);
    let inputDir = TemplatePath.addLeadingDotSlash(
      TemplatePath.normalize(this.inputDir)
    );

    debugDev("getLocalDataPaths(%o)", templatePath);
    debugDev("parsed.dir: %o", parsed.dir);

    let userExtensions = this.getUserDataExtensions();

    if (parsed.dir) {
      let fileNameNoExt = this.extensionMap.removeTemplateExtension(
        parsed.base
      );

      let filePathNoExt = parsed.dir + "/" + fileNameNoExt;
      let dataSuffix = this.config.jsDataFileSuffix;
      debug("Using %o to find data files.", dataSuffix);

      this._addBaseToPaths(paths, filePathNoExt, userExtensions);

      let allDirs = TemplatePath.getAllDirs(parsed.dir);

      debugDev("allDirs: %o", allDirs);
      for (let dir of allDirs) {
        let lastDir = TemplatePath.getLastPathSegment(dir);
        let dirPathNoExt = dir + "/" + lastDir;

        if (inputDir) {
          debugDev("dirStr: %o; inputDir: %o", dir, inputDir);
        }
        if (!inputDir || (dir.indexOf(inputDir) === 0 && dir !== inputDir)) {
          this._addBaseToPaths(paths, dirPathNoExt, userExtensions);
        }
      }

      // 0.11.0+ include root input dir files
      // if using `docs/` as input dir, looks for docs/docs.json et al
      if (inputDir) {
        let lastInputDir = TemplatePath.addLeadingDotSlash(
          TemplatePath.join(inputDir, TemplatePath.getLastPathSegment(inputDir))
        );
        if (lastInputDir !== "./") {
          this._addBaseToPaths(paths, lastInputDir, userExtensions);
        }
      }
    }

    debug("getLocalDataPaths(%o): %o", templatePath, paths);
    return lodashUniq(paths).reverse();
  }

  static mergeDeep(config, target, ...source) {
    if (config.dataDeepMerge) {
      return TemplateData.merge(target, ...source);
    } else {
      return Object.assign(target, ...source);
    }
  }

  static merge(target, ...source) {
    return merge(target, ...source);
  }

  static cleanupData(data) {
    if (config.tagsCollection in data) {
      if (typeof data[config.tagsCollection] === "string") {
        data[config.tagsCollection] = data[config.tagsCollection]
          ? [data[config.tagsCollection]]
          : [];
      } else if (data[config.tagsCollection] === null) {
        data[config.tagsCollection] = [];
      }
    }

    return data;
  }
}

module.exports = TemplateData;
