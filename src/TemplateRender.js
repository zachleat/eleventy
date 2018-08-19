const parsePath = require("parse-filepath");
const TemplatePath = require("./TemplatePath");
const TemplateEngine = require("./Engines/TemplateEngine");
const config = require("./Config");
// const debug = require("debug")("Eleventy:TemplateRender");

// works with full path names or short engine name
function TemplateRender(tmplPath, inputDir) {
  if (!tmplPath) {
    throw new Error(
      `TemplateRender requires a tmplPath argument, instead of ${tmplPath}`
    );
  }

  this.config = config.getConfig();
  this.path = tmplPath;

  // optional
  this.inputDir = this._normalizeInputDir(inputDir);

  this.parseMarkdownWith = this.config.markdownTemplateEngine;
  this.parseHtmlWith = this.config.htmlTemplateEngine;

  this.init(tmplPath);

  this.useMarkdown = this.engineName === "md";
}

TemplateRender.prototype.init = function(engineNameOrPath) {
  this.engineName = TemplateRender.cleanupEngineName(engineNameOrPath);
  this.engine = TemplateEngine.getEngine(this.engineName, this.inputDir);
};

TemplateRender.cleanupEngineName = function(tmplPath) {
  tmplPath = tmplPath.toLowerCase();

  let parsed = tmplPath ? parsePath(tmplPath) : undefined;
  return parsed && parsed.ext ? parsed.ext.substr(1) : tmplPath;
};

TemplateRender.hasEngine = function(tmplPath) {
  let name = TemplateRender.cleanupEngineName(tmplPath);
  return TemplateEngine.hasEngine(name);
};

TemplateRender.parseEngineOverrides = function(engineName) {
  let overlappingEngineWarningCount = 0;
  let engines = [];
  let uniqueLookup = {};
  let usingMarkdown = false;
  (engineName || "")
    .split(",")
    .map(name => {
      return name.toLowerCase().trim();
    })
    .forEach(name => {
      // html is assumed (treated as plaintext by the system)
      if (!name || name === "html") {
        return;
      }

      if (name === "md") {
        usingMarkdown = true;
        return;
      }

      if (!uniqueLookup[name]) {
        engines.push(name);
        uniqueLookup[name] = true;

        // we already short circuit md and html types above
        overlappingEngineWarningCount++;
      }
    });

  if (overlappingEngineWarningCount > 1) {
    throw new Error(
      `Don’t mix multiple templating engines in your front matter overrides (exceptions for HTML and Markdown). You used: ${engineName}`
    );
  }

  // markdown should always be first
  if (usingMarkdown) {
    // todo use unshift or something (no wifi here to look up docs :D)
    engines = ["md"].concat(engines);
  }

  return engines;
};

TemplateRender.prototype.setEngineOverride = function(
  engineName,
  bypassMarkdown
) {
  let engines = TemplateRender.parseEngineOverrides(engineName);

  // when overriding, Template Engines with HTML will instead use the Template Engine as primary and output HTML
  // So any HTML engine usage here will never use a preprocessor templating engine.
  this.setHtmlEngine(false);

  if (!engines.length) {
    this.init("html");
    return;
  }

  this.init(engines[0]);

  let usingMarkdown = engines[0] === "md" && !bypassMarkdown;

  this.setUseMarkdown(usingMarkdown);

  if (usingMarkdown) {
    // false means only parse markdown and not with a preprocessor template engine
    this.setMarkdownEngine(engines.length > 1 ? engines[1] : false);
  }
};

TemplateRender.prototype.getEngineName = function() {
  return this.engineName;
};

TemplateRender.prototype._normalizeInputDir = function(dir) {
  return dir
    ? TemplatePath.normalize(dir, this.config.dir.includes)
    : TemplatePath.normalize(this.config.dir.input, this.config.dir.includes);
};

TemplateRender.prototype.getInputDir = function() {
  return this.inputDir;
};

TemplateRender.prototype.isEngine = function(engine) {
  return this.engineName === engine;
};

TemplateRender.prototype.setUseMarkdown = function(useMarkdown) {
  this.useMarkdown = !!useMarkdown;
};

TemplateRender.prototype.setMarkdownEngine = function(markdownEngine) {
  this.parseMarkdownWith = markdownEngine;
};

TemplateRender.prototype.setHtmlEngine = function(htmlEngineName) {
  this.parseHtmlWith = htmlEngineName;
};

TemplateRender.prototype.render = async function(str, data) {
  return this.engine.render(str, data);
};

TemplateRender.prototype.getCompiledTemplate = async function(str) {
  // TODO refactor better, move into TemplateEngine logic
  if (this.engineName === "md") {
    return this.engine.compile(
      str,
      this.path,
      this.parseMarkdownWith,
      !this.useMarkdown
    );
  } else if (this.engineName === "html") {
    return this.engine.compile(str, this.path, this.parseHtmlWith);
  } else {
    return this.engine.compile(str, this.path);
  }
};

module.exports = TemplateRender;
