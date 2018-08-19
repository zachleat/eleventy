const fs = require("fs-extra");
const chalk = require("chalk");
const parsePath = require("parse-filepath");

const TemplatePath = require("./TemplatePath");
const TemplateData = require("./TemplateData");
const TemplateWriter = require("./TemplateWriter");
const EleventyServe = require("./EleventyServe");
const templateCache = require("./TemplateCache");
const EleventyError = require("./EleventyError");
const simplePlural = require("./Util/Pluralize");
const eleventyConfig = require("./EleventyConfig");
const config = require("./Config");
const debug = require("debug")("Eleventy");

function Eleventy(input, output) {
  this.config = config.getConfig();
  this.configPath = null;
  this.isVerbose = true;
  this.isDebug = false;
  this.isDryRun = false;

  this.start = new Date();
  this.formatsOverride = null;
  this.eleventyServe = new EleventyServe();

  this.setRawDirs(input, output);
  this.initDirs();
}

Eleventy.prototype.setRawDirs = function(input, output) {
  this.rawInput = input;
  this.rawOutput = output;
};

Eleventy.prototype.initDirs = function() {
  this.input = this.rawInput || this.config.dir.input;
  this.inputDir = this._getDir(this.input) || ".";
  this.outputDir = this.rawOutput || this.config.dir.output;

  this.eleventyServe.setOutputDir(this.getOutputDir());
};

Eleventy.prototype._getDir = function(inputPath) {
  if (!fs.statSync(inputPath).isDirectory()) {
    return parsePath(inputPath).dir;
  }
  return inputPath;
};

Eleventy.prototype.getOutputDir = function() {
  return this.outputDir;
};

Eleventy.prototype.setDryRun = function(isDryRun) {
  this.isDryRun = !!isDryRun;
};

Eleventy.prototype.setPassthroughAll = function(isPassthroughAll) {
  this.isPassthroughAll = !!isPassthroughAll;
};

Eleventy.prototype.setPathPrefix = function(pathPrefix) {
  if (pathPrefix || pathPrefix === "") {
    config.setPathPrefix(pathPrefix);
    this.config = config.getConfig();
  }
};

Eleventy.prototype.setConfigPath = function(configPath) {
  if (configPath) {
    this.configPath = configPath;

    config.setProjectConfigPath(configPath);
    this.config = config.getConfig();

    this.initDirs();
  }
};

Eleventy.prototype.restart = async function() {
  debug("Restarting");
  this.start = new Date();
  templateCache.clear();

  this.initDirs();
  await this.init();
};

Eleventy.prototype.finish = function() {
  eleventyConfig.logSlowConfigOptions(new Date() - this.start, this.isVerbose);

  console.log(this.logFinished());
  debug("Finished writing templates.");
};

Eleventy.prototype.logFinished = function() {
  if (!this.writer) {
    throw new Error(
      "Did you call Eleventy.init to create the TemplateWriter instance? Hint: you probably didn’t."
    );
  }

  let ret = [];

  let writeCount = this.writer.getWriteCount();
  let copyCount = this.writer.getCopyCount();
  if (this.isDryRun) {
    ret.push("Pretended to");
  }
  if (copyCount) {
    ret.push(
      `${this.isDryRun ? "Copy" : "Copied"} ${copyCount} ${simplePlural(
        copyCount,
        "item",
        "items"
      )} and`
    );
  }
  ret.push(
    `${this.isDryRun ? "Process" : "Processed"} ${writeCount} ${simplePlural(
      writeCount,
      "file",
      "files"
    )}`
  );

  let time = ((new Date() - this.start) / 1000).toFixed(2);
  ret.push(`in ${time} ${simplePlural(time, "second", "seconds")}`);

  if (writeCount >= 10) {
    ret.push(`(${((time * 1000) / writeCount).toFixed(1)}ms each)`);
  }

  return ret.join(" ");
};

Eleventy.prototype.init = async function() {
  this.data = new TemplateData(this.inputDir);

  let formats = this.formatsOverride || this.config.templateFormats;

  this.writer = new TemplateWriter(
    this.input,
    this.outputDir,
    formats,
    this.data,
    this.isPassthroughAll
  );

  // TODO maybe isVerbose -> console.log?
  debug(`Directories:
Input: ${this.inputDir}
Data: ${this.data.getDataDir()}
Includes: ${this.writer.getIncludesDir()}
Output: ${this.outputDir}
Template Formats: ${formats.join(",")}`);

  this.writer.setVerboseOutput(this.isVerbose);
  this.writer.setDryRun(this.isDryRun);

  return this.data.cacheData();
};

Eleventy.prototype.setIsDebug = function(isDebug) {
  this.isDebug = !!isDebug;
};

Eleventy.prototype.setIsVerbose = function(isVerbose) {
  this.isVerbose = !!isVerbose;

  if (this.writer) {
    this.writer.setVerboseOutput(this.isVerbose);
  }
};

Eleventy.prototype.setFormats = function(formats) {
  if (formats && formats !== "*") {
    this.formatsOverride = formats.split(",");
  }
};

Eleventy.prototype.getVersion = function() {
  return require("../package.json").version;
};

Eleventy.prototype.getHelp = function() {
  let out = [];
  out.push("usage: eleventy");
  out.push("       eleventy --watch");
  out.push("       eleventy --input=. --output=./_site");
  out.push("");
  out.push("Arguments: ");
  out.push("  --version");
  out.push("  --serve");
  out.push("       Run web server on --port (default 8080) and --watch too");
  out.push("  --watch");
  out.push("       Wait for files to change and automatically rewrite");
  out.push("  --input=.");
  out.push("       Input template files (default: `.`)");
  out.push("  --output=_site");
  out.push("       Write HTML output to this folder (default: `_site`)");
  out.push("  --formats=liquid,md");
  out.push("       Whitelist only certain template types (default: `*`)");
  out.push("  --quiet");
  out.push("       Don’t print all written files (default: `false`)");
  out.push("  --pathprefix='/'");
  out.push("       Change all url template filters to use this subdirectory.");
  out.push("  --config=filename.js");
  out.push(
    "      Override the eleventy config file path (default: `.eleventy.js`)"
  );
  out.push("  --dryrun");
  out.push("       Don’t write any files.");
  out.push("  --help");
  return out.join("\n");
};

Eleventy.prototype.resetConfig = function() {
  config.reset();

  this.config = config.getConfig();
  this.eleventyServe.updateConfig(this.config);
};

Eleventy.prototype._watch = async function(path) {
  if (this.active) {
    this.queuedToRun = path;
    return;
  }

  this.active = true;

  // reset and reload global configuration :O
  if (path === config.getLocalProjectConfigFile()) {
    this.resetConfig();
  } else {
    // a lighter config reset (mostly benchmarks)
    config.resetOnWatch();
  }

  await this.restart();
  await this.write();

  let isInclude =
    path && TemplatePath.contains(path, this.writer.getIncludesDir());
  this.eleventyServe.reload(path, isInclude);

  this.active = false;

  if (this.queuedToRun) {
    console.log("You saved while Eleventy was running, let’s run again.");
    this.queuedToRun = false;
    await this._watch(this.queuedToRun);
  } else {
    console.log("Watching…");
  }
};

Eleventy.prototype.watch = async function() {
  this.active = false;
  this.queuedToRun = false;

  await this.write();

  const watch = require("glob-watcher");

  let rawFiles = await this.writer.getGlobWatcherFiles();
  // Watch the local project config file
  rawFiles.push(config.getLocalProjectConfigFile());
  debug("Eleventy.watch rawFiles: %o", rawFiles);

  console.log("Watching…");
  let watcher = watch(rawFiles, {
    ignored: this.writer.getGlobWatcherIgnores()
  });

  watcher.on("change", async path => {
    console.log("File changed:", path);
    this._watch(path);
  });

  watcher.on("add", async path => {
    console.log("File added:", path);
    this._watch(path);
  });
};

Eleventy.prototype.serve = function(port) {
  this.eleventyServe.serve(port);
};

Eleventy.prototype.write = async function() {
  try {
    let ret = await this.writer.write();
    this.finish();

    debug(`
Getting frustrated? Have a suggestion/feature request/feedback?
I want to hear it! Open an issue: https://github.com/11ty/eleventy/issues/new`);

    return ret;
  } catch (e) {
    console.log(
      "\n" +
        chalk.red(
          "Problem writing eleventy templates (more info in DEBUG output): "
        )
    );
    if (e instanceof EleventyError) {
      console.log(chalk.red(e.log()));
      for (let err of e.getAll()) {
        debug("%o", err);
      }
    } else {
      console.log(e);
    }
  }
};

module.exports = Eleventy;
