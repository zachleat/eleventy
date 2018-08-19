const fs = require("fs-extra");
const fastglob = require("fast-glob");
const parsePath = require("parse-filepath");
const lodashSet = require("lodash.set");
const lodashMerge = require("lodash.merge");
const lodashUniq = require("lodash.uniq");
const TemplateRender = require("./TemplateRender");
const TemplatePath = require("./TemplatePath");
const TemplateGlob = require("./TemplateGlob");
const config = require("./Config");
const debug = require("debug")("Eleventy:TemplateData");
const debugDev = require("debug")("Dev:Eleventy:TemplateData");

function TemplateData(inputDir) {
  this.config = config.getConfig();
  this.dataTemplateEngine = this.config.dataTemplateEngine;

  this.setInputDir(inputDir);

  this.fetchedRawImports = false;
  this.rawImports = {};

  this.globalData = null;
}

TemplateData.prototype.setInputDir = function(inputDir) {
  this.inputDir = inputDir;
  this.dataDir =
    inputDir + "/" + (this.config.dir.data !== "." ? this.config.dir.data : "");
};

TemplateData.prototype.setDataTemplateEngine = function(engineName) {
  this.dataTemplateEngine = engineName;
};

TemplateData.prototype.getRawImports = async function() {
  if (!this.fetchedRawImports) {
    this.fetchedRawImports = true;

    this.rawImports[this.config.keys.package] = await this.getJsonRaw(
      TemplatePath.localPath("package.json")
    );
  }

  return this.rawImports;
};

TemplateData.prototype.getDataDir = function() {
  return this.dataDir;
};

TemplateData.prototype.clearData = function() {
  this.globalData = null;
};

TemplateData.prototype.cacheData = async function() {
  this.clearData();

  return this.getData();
};

TemplateData.prototype.getGlobalDataGlob = async function() {
  let dir = ".";

  if (this.inputDir) {
    let globalPathStat = await fs.stat(this.inputDir);

    if (!globalPathStat.isDirectory()) {
      throw new Error("Could not find data path directory: " + this.inputDir);
    }

    dir = this.inputDir;
  }

  return TemplateGlob.normalizePath(
    dir,
    "/",
    this.config.dir.data !== "." ? this.config.dir.data : "",
    "/**/*.json"
  );
};

TemplateData.prototype.getGlobalDataFiles = async function() {
  return fastglob.async(await this.getGlobalDataGlob());
};

TemplateData.prototype.getObjectPathForDataFile = function(path) {
  let reducedPath = TemplatePath.stripPathFromDir(path, this.dataDir);
  let parsed = parsePath(reducedPath);
  let folders = parsed.dir ? parsed.dir.split("/") : [];
  folders.push(parsed.name);

  return folders.join(".");
};

TemplateData.prototype.getConfigData = function() {
  let data = this.config.configData;
  if (typeof data === "function") {
    return data();
  } else if (typeof data === "object") {
    return data;
  }

  return {};
};

TemplateData.prototype.getAllGlobalData = async function() {
  let rawImports = await this.getRawImports();
  let globalData = {};
  let files = TemplatePath.addLeadingDotSlashArray(
    await this.getGlobalDataFiles()
  );

  for (let j = 0, k = files.length; j < k; j++) {
    let folders = await this.getObjectPathForDataFile(files[j]);
    debug(`Found global data file ${files[j]} and adding as: ${folders}`);
    let data = await this.getJson(files[j], rawImports);
    lodashSet(globalData, folders, data);
  }

  // add any data set in config
  lodashMerge(globalData, this.getConfigData());

  return globalData;
};

TemplateData.prototype.getData = async function() {
  let rawImports = await this.getRawImports();

  if (!this.globalData) {
    let globalJson = await this.getAllGlobalData();

    this.globalData = lodashMerge({}, globalJson, rawImports);
  }

  return this.globalData;
};

TemplateData.prototype.combineLocalData = async function(localDataPaths) {
  let rawImports = await this.getRawImports();
  let localData = {};
  if (!Array.isArray(localDataPaths)) {
    localDataPaths = [localDataPaths];
  }
  for (let path of localDataPaths) {
    let dataForPath = await this.getJson(path, rawImports, true);
    // debug("`combineLocalData` (dataForPath) for %o: %O", path, dataForPath);
    lodashMerge(localData, dataForPath);
    // debug("`combineLocalData` (post-merge) for %o: %O", path, localData);
  }
  return localData;
};

TemplateData.prototype.getLocalData = async function(templatePath) {
  let localDataPaths = this.getLocalDataPaths(templatePath);
  let importedData = await this.combineLocalData(localDataPaths);
  let globalData = await this.getData();

  let localData = lodashMerge({}, globalData, importedData);
  // debug("`getLocalData` for %o: %O", templatePath, localData);
  return localData;
};

TemplateData.prototype._getLocalJson = async function(path) {
  let rawInput;
  try {
    rawInput = await fs.readFile(path, "utf-8");
  } catch (e) {
    // if file does not exist, return nothing
  }
  return rawInput;
};

TemplateData.prototype.getJsonRaw = async function(path) {
  let rawContent = await this._getLocalJson(path);
  return rawContent ? JSON.parse(rawContent) : {};
};

TemplateData.prototype.getJson = async function(
  path,
  rawImports,
  ignoreProcessing
) {
  let rawInput = await this._getLocalJson(path);
  let engineName;

  if (!ignoreProcessing) {
    engineName = this.dataTemplateEngine;
  }

  if (rawInput) {
    let str;

    if (engineName) {
      let fn = await new TemplateRender(engineName).getCompiledTemplate(
        rawInput
      );

      // pass in rawImports, don’t pass in global data, that’s what we’re parsing
      str = await fn(rawImports);
    } else {
      str = rawInput;
    }

    return JSON.parse(str);
  }

  return {};
};

TemplateData.prototype.getLocalDataPaths = function(templatePath) {
  let paths = [];
  let parsed = parsePath(templatePath);
  let inputDir = TemplatePath.addLeadingDotSlash(
    TemplatePath.normalize(this.inputDir)
  );
  debugDev("getLocalDataPaths(%o)", templatePath);
  debugDev("parsed.dir: %o", parsed.dir);

  if (parsed.dir) {
    let filePath = parsed.dir + "/" + parsed.name + ".json";
    paths.push(filePath);

    let allDirs = TemplatePath.getAllDirs(parsed.dir);
    debugDev("allDirs: %o", allDirs);
    for (let dir of allDirs) {
      let lastDir = TemplatePath.getLastDir(dir);
      let dirPath = dir + "/" + lastDir + ".json";

      if (!inputDir) {
        paths.push(dirPath);
      } else {
        debugDev("dirStr: %o; inputDir: %o", dir, inputDir);
        if (dir.indexOf(inputDir) === 0 && dir !== inputDir) {
          paths.push(dirPath);
        }
      }
    }
  }
  debugDev("getLocalDataPaths(%o): %o", templatePath, paths);
  debug("getLocalDataPaths(%o): %o", templatePath, paths);
  return lodashUniq(paths).reverse();
};

module.exports = TemplateData;
