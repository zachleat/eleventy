const TemplateLayoutPathResolver = require("./TemplateLayoutPathResolver");
const TemplateContent = require("./TemplateContent");

const templateCache = require("./TemplateCache");
const config = require("./Config");
const debug = require("debug")("Eleventy:TemplateLayout");
const debugDev = require("debug")("Dev:Eleventy:TemplateLayout");

class TemplateLayout extends TemplateContent {
  constructor(key, inputDir) {
    // TODO getConfig() is duplicated in TemplateContent (super)
    debugDev("new TemplateLayout(%o, %o)", key, inputDir);
    let cfg = config.getConfig();
    debugDev("config init");
    let layoutsDir = inputDir + "/" + cfg.dir.includes;
    let resolvedPath = new TemplateLayoutPathResolver(
      key,
      layoutsDir
    ).getFullPath();
    debugDev("TemplateLayoutPathResolver finished");
    super(resolvedPath, inputDir);
    debugDev("super()");

    this.dataKeyLayoutPath = key;
    this.inputPath = resolvedPath;
    this.inputDir = inputDir;
    this.config = cfg;
  }

  static resolveFullKey(key, inputDir) {
    return inputDir + key;
  }

  static getTemplate(key, inputDir) {
    debugDev("Looking for TemplateLayout");
    let fullKey = TemplateLayout.resolveFullKey(key, inputDir);
    if (templateCache.has(fullKey)) {
      debugDev("Found %o in TemplateCache", key);
      return templateCache.get(fullKey);
    }

    let tmpl = new TemplateLayout(key, inputDir);
    templateCache.add(fullKey, tmpl);
    debugDev("TemplateLayout.getTemplate(%o, %o)", key, inputDir);

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
      debugDev("TemplateLayout using cached data for %o", this.inputPath);
      return this.dataCache;
    }

    debugDev("TemplateLayout getData() for %o", this.inputPath);
    let data = {};
    let map = await this.getTemplateLayoutMap();
    for (let j = map.length - 1; j >= 0; j--) {
      Object.assign(data, map[j].frontMatterData);
    }
    delete data[this.config.keys.layout];

    this.dataCache = data;
    debugDev("TemplateLayout getData() finished for %o", this.inputPath);
    return data;
  }

  async getCompiledLayoutFunctions() {
    if (this.compileCache) {
      debugDev(
        "TemplateLayout using cached compiled template functions for %o",
        this.inputPath
      );
      return this.compileCache;
    }

    debugDev(
      "TemplateLayout.getCompiledLayoutFunctions() for %o",
      this.inputPath
    );
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
    debugDev(
      "TemplateLayout.getCompiledLayoutFunctions() finished for %o",
      this.inputPath
    );
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
    debugDev("TemplateLayout.render() for %o", this.inputPath);
    data = TemplateLayout.augmentDataWithContent(data, templateContent);

    let fns = await this.getCompiledLayoutFunctions();
    for (let fn of fns) {
      templateContent = await fn(data);
      data = TemplateLayout.augmentDataWithContent(data, templateContent);
    }

    debugDev("TemplateLayout.render() finished for %o", this.inputPath);
    return templateContent;
  }
}

module.exports = TemplateLayout;
