const TemplateLayoutPathResolver = require("./TemplateLayoutPathResolver");
const TemplateContent = require("./TemplateContent");

const templateCache = require("./TemplateCache");
const config = require("./Config");
const debug = require("debug")("Eleventy:TemplateLayout");
const debugDev = require("debug")("Dev:Eleventy:TemplateLayout");

class TemplateLayout extends TemplateContent {
  constructor(key, inputDir) {
    // TODO getConfig() is duplicated in TemplateContent (super)
    let cfg = config.getConfig();
    let layoutsDir = inputDir + "/" + cfg.dir.includes;
    let resolvedPath = new TemplateLayoutPathResolver(
      key,
      layoutsDir
    ).getFullPath();
    super(resolvedPath, inputDir);

    this.dataKeyLayoutPath = key;
    this.inputPath = resolvedPath;
    this.inputDir = inputDir;
    this.config = cfg;
  }

  static resolveFullKey(key, inputDir) {
    return inputDir + key;
  }

  static getTemplate(key, inputDir) {
    let fullKey = TemplateLayout.resolveFullKey(key, inputDir);
    if (templateCache.has(fullKey)) {
      debugDev("Found %o in TemplateCache", key);
      return templateCache.get(fullKey);
    }

    let tmpl = new TemplateLayout(key, inputDir);
    templateCache.add(fullKey, tmpl);

    return tmpl;
  }

  async getTemplateLayoutMapEntry() {
    return {
      key: this.dataKeyLayoutPath,
      template: this,
      frontMatterData: await this.getFrontMatterData()
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
        this.inputDir
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

    let data = {};
    let map = await this.getTemplateLayoutMap();
    for (let j = map.length - 1; j >= 0; j--) {
      Object.assign(data, map[j].frontMatterData);
    }
    delete data[this.config.keys.layout];

    this.dataCache = data;
    return data;
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
