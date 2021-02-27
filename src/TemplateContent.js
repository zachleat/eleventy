const os = require("os");
const fs = require("fs-extra");
const normalize = require("normalize-path");
const matter = require("gray-matter");
const lodashSet = require("lodash/set");

const EleventyExtensionMap = require("./EleventyExtensionMap");
const TemplateData = require("./TemplateData");
const TemplateRender = require("./TemplateRender");
const TemplatePath = require("./TemplatePath");
const EleventyBaseError = require("./EleventyBaseError");
const EleventyErrorUtil = require("./EleventyErrorUtil");
const config = require("./Config");
const debug = require("debug")("Eleventy:TemplateContent");
const debugDev = require("debug")("Dev:Eleventy:TemplateContent");
const bench = require("./BenchmarkManager").get("Aggregate");
const eventBus = require("./EventBus");

class TemplateContentFrontMatterError extends EleventyBaseError {}
class TemplateContentCompileError extends EleventyBaseError {}
class TemplateContentRenderError extends EleventyBaseError {}

class TemplateContent {
  constructor(inputPath, inputDir) {
    this.inputPath = inputPath;

    if (inputDir) {
      this.inputDir = normalize(inputDir);
    } else {
      this.inputDir = false;
    }
  }

  /* Used by tests */
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

  set config(config) {
    this._config = config;
  }

  get config() {
    if (!this._config) {
      this._config = config.getConfig();
    }

    return this._config;
  }

  get engine() {
    return this.templateRender.engine;
  }

  get templateRender() {
    if (!this._templateRender) {
      this._templateRender = new TemplateRender(this.inputPath, this.inputDir);
      this._templateRender.extensionMap = this.extensionMap;
    }

    return this._templateRender;
  }

  getInputPath() {
    return this.inputPath;
  }

  getInputDir() {
    return this.inputDir;
  }

  async read() {
    this.inputContent = await this.getInputContent();

    if (this.inputContent) {
      let options = this.config.frontMatterParsingOptions || {};
      let fm;
      try {
        fm = matter(this.inputContent, options);
      } catch (e) {
        throw new TemplateContentFrontMatterError(
          `Having trouble reading front matter from template ${this.inputPath}`,
          e
        );
      }
      if (options.excerpt && fm.excerpt) {
        let excerptString = fm.excerpt + (options.excerpt_separator || "---");
        if (fm.content.startsWith(excerptString + os.EOL)) {
          // with a newline after excerpt separator
          fm.content =
            fm.excerpt.trim() +
            "\n" +
            fm.content.substr((excerptString + os.EOL).length);
        } else if (fm.content.startsWith(excerptString)) {
          // no newline after excerpt separator
          fm.content = fm.excerpt + fm.content.substr(excerptString.length);
        }

        // alias, defaults to page.excerpt
        let alias = options.excerpt_alias || "page.excerpt";
        lodashSet(fm.data, alias, fm.excerpt);
      }
      this.frontMatter = fm;
    } else {
      this.frontMatter = {
        data: {},
        content: "",
        excerpt: "",
      };
    }
  }

  static cache(path, content) {
    this._inputCache.set(TemplatePath.absolutePath(path), content);
  }

  static getCached(path) {
    return this._inputCache.get(TemplatePath.absolutePath(path));
  }

  static deleteCached(path) {
    this._inputCache.delete(TemplatePath.absolutePath(path));
  }

  async getInputContent() {
    if (!this.engine.needsToReadFileContents()) {
      return "";
    }

    let templateBenchmark = bench.get("Template Read");
    templateBenchmark.before();
    let content = TemplateContent.getCached(this.inputPath);
    if (!content) {
      content = await fs.readFile(this.inputPath, "utf-8");
      TemplateContent.cache(this.inputPath, content);
    }
    templateBenchmark.after();

    return content;
  }

  async getFrontMatter() {
    if (!this.frontMatter) {
      await this.read();
    }

    return this.frontMatter;
  }

  async getPreRender() {
    if (!this.frontMatter) {
      await this.read();
    }

    return this.frontMatter.content;
  }

  async getFrontMatterData() {
    if (!this.frontMatter) {
      await this.read();
    }

    let extraData = await this.engine.getExtraDataFromFile(this.inputPath);
    let data = TemplateData.mergeDeep({}, this.frontMatter.data, extraData);
    return TemplateData.cleanupData(data);
  }

  async getEngineOverride() {
    let frontMatterData = await this.getFrontMatterData();
    return frontMatterData[this.config.keys.engineOverride];
  }

  async setupTemplateRender(bypassMarkdown) {
    let engineOverride = await this.getEngineOverride();
    if (engineOverride !== undefined) {
      debugDev(
        "%o overriding template engine to use %o",
        this.inputPath,
        engineOverride
      );

      this.templateRender.setEngineOverride(engineOverride, bypassMarkdown);
    } else {
      this.templateRender.setUseMarkdown(!bypassMarkdown);
    }
  }

  _getCompileCache(str, bypassMarkdown) {
    let engineName = this.engine.getName() + "::" + !!bypassMarkdown;
    let engineMap = TemplateContent._compileEngineCache.get(engineName);
    if (!engineMap) {
      engineMap = new Map();
      TemplateContent._compileEngineCache.set(engineName, engineMap);
    }

    let cacheable = this.engine.cacheable;
    return [cacheable, str, engineMap];
  }

  async compile(str, bypassMarkdown) {
    await this.setupTemplateRender(bypassMarkdown);

    debugDev(
      "%o compile() using engine: %o",
      this.inputPath,
      this.templateRender.engineName
    );

    try {
      let [cacheable, key, cache] = this._getCompileCache(str, bypassMarkdown);
      if (cacheable && cache.has(key)) {
        return cache.get(key);
      }

      // Compilation is async, so we eagerly cache a Promise that eventually
      // resolves to the compiled function
      let res;
      cache.set(
        key,
        new Promise(resolve => {
          res = resolve;
        })
      );

      let templateBenchmark = bench.get("Template Compile");
      templateBenchmark.before();
      let fn = await this.templateRender.getCompiledTemplate(str);
      templateBenchmark.after();
      debugDev("%o getCompiledTemplate function created", this.inputPath);
      res(fn);
      return fn;
    } catch (e) {
      debug(`Having trouble compiling template ${this.inputPath}: %O`, str);
      throw new TemplateContentCompileError(
        `Having trouble compiling template ${this.inputPath}`,
        e
      );
    }
  }

  async render(str, data, bypassMarkdown) {
    try {
      let fn = await this.compile(str, bypassMarkdown);
      let templateBenchmark = bench.get("Template Render");
      templateBenchmark.before();
      let rendered = await fn(data);
      templateBenchmark.after();
      debugDev(
        "%o getCompiledTemplate called, rendered content created",
        this.inputPath
      );
      return rendered;
    } catch (e) {
      if (EleventyErrorUtil.isPrematureTemplateContentError(e)) {
        throw e;
      } else {
        let engine = this.templateRender.getReadableEnginesList();
        debug(
          `Having trouble rendering ${engine} template ${this.inputPath}: %O`,
          str
        );
        throw new TemplateContentRenderError(
          `Having trouble rendering ${engine} template ${this.inputPath}`,
          e
        );
      }
    }
  }
}

TemplateContent._inputCache = new Map();
TemplateContent._compileEngineCache = new Map();
eventBus.on("resourceModified", path => {
  TemplateContent.deleteCached(path);
});

module.exports = TemplateContent;
