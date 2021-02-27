const TemplateLayoutPathResolver = require("./TemplateLayoutPathResolver");
const TemplateContent = require("./TemplateContent");
const TemplateData = require("./TemplateData");
const TemplatePath = require("./TemplatePath");

// TODO move this into the constructor
const templateCache = require("./TemplateCache");
const config = require("./Config");
// const debug = require("debug")("Eleventy:TemplateLayout");
const debugDev = require("debug")("Dev:Eleventy:TemplateLayout");

class TemplateLayout extends TemplateContent {
  constructor(key, inputDir, extensionMap) {
    // TODO getConfig() is duplicated in TemplateContent (super)
    let cfg = config.getConfig();
    let resolvedPath = new TemplateLayoutPathResolver(
      key,
      inputDir,
      extensionMap
    ).getFullPath();
    super(resolvedPath, inputDir);

    if (!extensionMap) {
      throw new Error("Expected `extensionMap` in TemplateLayout constructor.");
    }
    this.extensionMap = extensionMap;
    this.dataKeyLayoutPath = key;
    this.inputPath = resolvedPath;
    this.inputDir = inputDir;
    this.config = cfg;
  }

  static resolveFullKey(key, inputDir) {
    return TemplatePath.join(inputDir, key);
  }

  static getTemplate(key, inputDir, config, extensionMap) {
    let fullKey = TemplateLayout.resolveFullKey(key, inputDir);
    if (templateCache.has(fullKey)) {
      debugDev("Found %o in TemplateCache", key);
      return templateCache.get(fullKey);
    }

    let tmpl = new TemplateLayout(key, inputDir, extensionMap);
    tmpl.config = config;
    templateCache.add(fullKey, tmpl);

    return tmpl;
  }

  async getTemplateLayoutMapEntry() {
    return {
      key: this.dataKeyLayoutPath,
      template: this,
      frontMatterData: await this.getFrontMatterData(),
    };
  }

  async getTemplateLayoutMap() {
    if (this.mapCache) {
      return this.mapCache;
    }

    let cfgKey = this.config.keys.layout;
    let map = [];
    let mapEntry = await this.getTemplateLayoutMapEntry();
    map.push(mapEntry);

    while (mapEntry.frontMatterData && cfgKey in mapEntry.frontMatterData) {
      let layout = TemplateLayout.getTemplate(
        mapEntry.frontMatterData[cfgKey],
        this.inputDir,
        this.config,
        this.extensionMap
      );
      mapEntry = await layout.getTemplateLayoutMapEntry();
      map.push(mapEntry);
    }

    this.mapCache = map;
    return map;
  }

  async getData() {
    if (this.dataCache) {
      return this.dataCache;
    }

    let map = await this.getTemplateLayoutMap();
    let dataToMerge = [];
    let layoutChain = [];
    for (let j = map.length - 1; j >= 0; j--) {
      layoutChain.push(map[j].template.inputPath);
      dataToMerge.push(map[j].frontMatterData);
    }

    // Deep merge of layout front matter
    let data = TemplateData.mergeDeep(this.config, {}, ...dataToMerge);
    delete data[this.config.keys.layout];

    this.layoutChain = layoutChain.reverse();
    this.dataCache = data;
    return data;
  }

  async getLayoutChain() {
    if (!this.layoutChain) {
      await this.getData();
    }
    return this.layoutChain;
  }

  async getCompiledLayoutFunctions() {
    if (this.compileCache) {
      return this.compileCache;
    }

    let map = await this.getTemplateLayoutMap();
    let fns = [];
    for (let layoutMap of map) {
      fns.push(
        await layoutMap.template.compile(
          await layoutMap.template.getPreRender()
        )
      );
    }
    this.compileCache = fns;
    return fns;
  }

  static augmentDataWithContent(data, templateContent) {
    data = data || {};

    if (templateContent !== undefined) {
      data.content = templateContent;
      data.layoutContent = templateContent;

      // deprecated
      data._layoutContent = templateContent;
    }

    return data;
  }

  // Inefficient? We want to compile all the templatelayouts into a single reusable callback?
  // Trouble: layouts may need data variables present downstream/upstream
  async render(data, templateContent) {
    data = TemplateLayout.augmentDataWithContent(data, templateContent);

    let fns = await this.getCompiledLayoutFunctions();
    for (let fn of fns) {
      templateContent = await fn(data);
      data = TemplateLayout.augmentDataWithContent(data, templateContent);
    }

    return templateContent;
  }
}

module.exports = TemplateLayout;
