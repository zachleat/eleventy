const TemplatePath = require("./TemplatePath");
const TemplateEngineManager = require("./TemplateEngineManager");
const EleventyBaseError = require("./EleventyBaseError");
const EleventyExtensionMap = require("./EleventyExtensionMap");
const TemplateRenderCache = require("./TemplateRenderCache");
const globalTemplateRenderCache = new TemplateRenderCache();
// const debug = require("debug")("Eleventy:TemplateRender");

class TemplateRenderUnknownEngineError extends EleventyBaseError {}

// works with full path names or short engine name
class TemplateRender {
  constructor(tmplPath, inputDir, extensionMap) {
    if (!tmplPath) {
      throw new Error(
        `TemplateRender requires a tmplPath argument, instead of ${tmplPath}`
      );
    }

    this.extensionMap = extensionMap;
    this.engineNameOrPath = tmplPath;
    this.inputDir = inputDir;

    // optional
    this.includesDir = this._normalizeIncludesDir(inputDir);

    this.parseMarkdownWith = this.config.markdownTemplateEngine;
    this.parseHtmlWith = this.config.htmlTemplateEngine;
  }

  get config() {
    if (!this._config) {
      this._config = require("./Config").getConfig();
    }
    return this._config;
  }

  set config(config) {
    this._config = config;
  }

  set extensionMap(extensionMap) {
    this._extensionMap = extensionMap;
  }

  get extensionMap() {
    if (!this._extensionMap) {
      this._extensionMap = new EleventyExtensionMap();
    }
    return this._extensionMap;
  }

  init(engineNameOrPath) {
    this.extensionMap.config = this.config;
    this._engineName = this.extensionMap.getKey(engineNameOrPath);
    if (!this._engineName) {
      throw new TemplateRenderUnknownEngineError(
        `Unknown engine for ${engineNameOrPath}`
      );
    }

    this._engineManager = new TemplateEngineManager();
    this._engineManager.config = this.config;

    this._engine = this._engineManager.getEngine(
      this._engineName,
      this.includesDir
    );
    this._engine.config = this.config;
    this._engine.initRequireCache(engineNameOrPath);

    if (this.useMarkdown === undefined) {
      this.setUseMarkdown(this._engineName === "md");
    }
  }

  get engineName() {
    if (!this._engineName) {
      this.init(this.engineNameOrPath);
    }
    return this._engineName;
  }

  get engine() {
    if (!this._engine) {
      this.init(this.engineNameOrPath);
    }
    return this._engine;
  }

  get engineManager() {
    if (!this._engineManager) {
      this.init(this.engineNameOrPath);
    }
    return this._engineManager;
  }

  static parseEngineOverrides(engineName) {
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
      engines.unshift("md");
    }

    return engines;
  }

  // used for error logging.
  getEnginesStr() {
    if (this.engineName === "md" && this.useMarkdown) {
      return this.parseMarkdownWith + " (and markdown)";
    }
    return this.engineName;
  }

  setEngineOverride(engineName, bypassMarkdown) {
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
  }

  getEngineName() {
    return this.engineName;
  }

  getIncludesDir() {
    return this.includesDir;
  }

  _normalizeIncludesDir(dir) {
    return TemplatePath.join(
      dir ? dir : this.config.dir.input,
      this.config.dir.includes
    );
  }

  isEngine(engine) {
    return this.engineName === engine;
  }

  setUseMarkdown(useMarkdown) {
    this.useMarkdown = !!useMarkdown;
  }

  setMarkdownEngine(markdownEngine) {
    this.parseMarkdownWith = markdownEngine;
  }

  setHtmlEngine(htmlEngineName) {
    this.parseHtmlWith = htmlEngineName;
  }

  async _testRender(str, data) {
    return this.engine._testRender(str, data);
  }

  _getCacheKey(str) {
    if (this.engineName === "md") {
      return `${this.engineNameOrPath}|${this.parseMarkdownWith}|${this.useMarkdown}|${str}`;
    } else if (this.engineName === "html") {
      return `${this.engineNameOrPath}|${this.parseHtmlWith}|${str}`;
    }
    return `${this.engineNameOrPath}|${str}`;
  }

  _getCachedFn(str) {
    let key = this._getCacheKey(str);
    if (globalTemplateRenderCache.has(key)) {
      return globalTemplateRenderCache.get(key);
    }
  }

  _addCachedFn(str, fn) {
    let key = this._getCacheKey(str);
    globalTemplateRenderCache.add(key, fn);
  }

  async getCompiledTemplate(str) {
    let cachedFn = this._getCachedFn(str);
    if (cachedFn) {
      return cachedFn;
    }

    let fn;
    // TODO refactor better, move into TemplateEngine logic
    if (this.engineName === "md") {
      fn = this.engine.compile(
        str,
        this.engineNameOrPath,
        this.parseMarkdownWith,
        !this.useMarkdown
      );
    } else if (this.engineName === "html") {
      fn = this.engine.compile(str, this.engineNameOrPath, this.parseHtmlWith);
    } else {
      fn = this.engine.compile(str, this.engineNameOrPath);
    }
    this._addCachedFn(str, fn);
    return fn;
  }
}

module.exports = TemplateRender;
