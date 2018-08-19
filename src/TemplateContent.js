const fs = require("fs-extra");
const normalize = require("normalize-path");
const matter = require("gray-matter");

const TemplateRender = require("./TemplateRender");
const EleventyError = require("./EleventyError");
const config = require("./Config");
const debug = require("debug")("Eleventy:TemplateContent");
const debugDev = require("debug")("Dev:Eleventy:TemplateContent");

class TemplateContent {
  constructor(inputPath, inputDir) {
    this.config = config.getConfig();
    this.inputPath = inputPath;

    if (inputDir) {
      this.inputDir = normalize(inputDir);
    } else {
      this.inputDir = false;
    }

    this.templateRender = new TemplateRender(this.inputPath, this.inputDir);
  }

  getInputPath() {
    return this.inputPath;
  }

  getInputDir() {
    return this.inputDir;
  }

  async read() {
    this.inputContent = await this.getInputContent();
    this.frontMatter = matter(this.inputContent);
  }

  async getInputContent() {
    return fs.readFile(this.inputPath, "utf-8");
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

    return this.frontMatter.data || {};
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

  async compile(str, bypassMarkdown) {
    await this.setupTemplateRender(bypassMarkdown);

    debugDev(
      "%o compile() using engine: %o",
      this.inputPath,
      this.templateRender.engineName
    );

    try {
      let fn = await this.templateRender.getCompiledTemplate(str);
      debugDev("%o getCompiledTemplate function created", this.inputPath);
      return fn;
    } catch (e) {
      throw EleventyError.make(
        new Error(
          `Having trouble compiling template ${this.inputPath}: ${str}`
        ),
        e
      );
    }
  }

  async render(str, data, bypassMarkdown) {
    try {
      let fn = await this.compile(str, bypassMarkdown);
      let rendered = await fn(data);
      debugDev(
        "%o getCompiledTemplate called, rendered content created",
        this.inputPath
      );
      return rendered;
    } catch (e) {
      throw EleventyError.make(
        new Error(
          `Having trouble rendering template ${this.inputPath}: ${str}`
        ),
        e
      );
    }
  }
}

module.exports = TemplateContent;
