const fs = require("fs-extra");
const parsePath = require("parse-filepath");
const normalize = require("normalize-path");
const lodashIsObject = require("lodash/isObject");
const { DateTime } = require("luxon");

const EleventyExtensionMap = require("./EleventyExtensionMap");
const TemplateData = require("./TemplateData");
const TemplateContent = require("./TemplateContent");
const TemplatePath = require("./TemplatePath");
const TemplatePermalink = require("./TemplatePermalink");
const TemplatePermalinkNoWrite = require("./TemplatePermalinkNoWrite");
const TemplateLayout = require("./TemplateLayout");
const TemplateFileSlug = require("./TemplateFileSlug");
const Pagination = require("./Plugins/Pagination");
const TemplateContentPrematureUseError = require("./Errors/TemplateContentPrematureUseError");
const debug = require("debug")("Eleventy:Template");
const debugDev = require("debug")("Dev:Eleventy:Template");

class Template extends TemplateContent {
  constructor(path, inputDir, outputDir, templateData) {
    debugDev("new Template(%o)", path);
    super(path, inputDir);

    this.parsed = parsePath(path);

    // for pagination
    this.extraOutputSubdirectory = "";

    if (outputDir) {
      this.outputDir = normalize(outputDir);
    } else {
      this.outputDir = false;
    }

    this.linters = [];
    this.transforms = [];
    this.plugins = {};
    this.templateData = templateData;
    if (this.templateData) {
      this.templateData.setInputDir(this.inputDir);
    }
    this.paginationData = {};

    this.isVerbose = true;
    this.isDryRun = false;
    this.writeCount = 0;
    this.wrapWithLayouts = true;
    this.fileSlug = new TemplateFileSlug(this.inputPath, this.inputDir);
    this.fileSlugStr = this.fileSlug.getSlug();
    this.filePathStem = this.fileSlug.getFullPathWithoutExtension();
  }

  setIsVerbose(isVerbose) {
    this.isVerbose = isVerbose;
  }

  setDryRun(isDryRun) {
    this.isDryRun = !!isDryRun;
  }

  setWrapWithLayouts(wrap) {
    this.wrapWithLayouts = wrap;
  }

  setExtraOutputSubdirectory(dir) {
    this.extraOutputSubdirectory = dir + "/";
  }

  getTemplateSubfolder() {
    return TemplatePath.stripLeadingSubPath(this.parsed.dir, this.inputDir);
  }

  get baseFile() {
    return (this._extensionMap || EleventyExtensionMap).removeTemplateExtension(
      this.parsed.base
    );
  }

  get htmlIOException() {
    // HTML output can’t overwrite the HTML input file.
    return (
      this.inputDir === this.outputDir &&
      this.templateRender.isEngine("html") &&
      this.baseFile === "index"
    );
  }

  async _getLink(data) {
    if (!data) {
      data = await this.getData();
    }

    let permalink = data[this.config.keys.permalink];
    if (permalink) {
      // render variables inside permalink front matter, bypass markdown
      let permalinkValue;
      if (!this.config.dynamicPermalinks || data.dynamicPermalink === false) {
        debugDev("Not using dynamicPermalinks, using %o", permalink);
        permalinkValue = permalink;
      } else {
        permalinkValue = await super.render(permalink, data, true);
        debug(
          "Rendering permalink for %o: %s becomes %o",
          this.inputPath,
          permalink,
          permalinkValue
        );
        debugDev("Permalink rendered with data: %o", data);
      }

      let perm = new TemplatePermalink(
        permalinkValue,
        this.extraOutputSubdirectory
      );

      return perm;
    } else if (permalink === false) {
      return new TemplatePermalinkNoWrite();
    }

    return TemplatePermalink.generate(
      this.getTemplateSubfolder(),
      this.baseFile,
      this.extraOutputSubdirectory,
      this.htmlIOException ? this.config.htmlOutputSuffix : ""
    );
  }

  // TODO instead of htmlIOException, do a global search to check if output path = input path and then add extra suffix
  async getOutputLink(data) {
    let link = await this._getLink(data);
    return link.toString();
  }

  async getOutputHref(data) {
    let link = await this._getLink(data);
    return link.toHref();
  }

  // TODO check for conflicts, see if file already exists?
  async getOutputPath(data) {
    let uri = await this.getOutputLink(data);

    if (uri === false) {
      return false;
    } else if (
      (await this.getFrontMatterData())[this.config.keys.permalinkRoot]
    ) {
      // TODO this only works with immediate front matter and not data files
      return normalize(uri);
    } else {
      return normalize(this.outputDir + "/" + uri);
    }
  }

  setPaginationData(paginationData) {
    this.paginationData = paginationData;
  }

  async mapDataAsRenderedTemplates(data, templateData) {
    // function supported in JavaScript type
    if (typeof data === "string" || typeof data === "function") {
      debug("rendering data.renderData for %o", this.inputPath);
      // bypassMarkdown
      let str = await super.render(data, templateData, true);
      return str;
    } else if (Array.isArray(data)) {
      let arr = [];
      for (let j = 0, k = data.length; j < k; j++) {
        arr.push(await this.mapDataAsRenderedTemplates(data[j], templateData));
      }
      return arr;
    } else if (lodashIsObject(data)) {
      let obj = {};
      for (let value in data) {
        obj[value] = await this.mapDataAsRenderedTemplates(
          data[value],
          templateData
        );
      }
      return obj;
    }

    return data;
  }

  async _testGetAllLayoutFrontMatterData() {
    let frontMatterData = await this.getFrontMatterData();
    if (frontMatterData[this.config.keys.layout]) {
      let layout = TemplateLayout.getTemplate(
        frontMatterData[this.config.keys.layout],
        this.getInputDir(),
        this.config
      );
      return await layout.getData();
    }
    return {};
  }

  async getData() {
    if (!this.dataCache) {
      debugDev("%o getData()", this.inputPath);
      let localData = {};

      if (this.templateData) {
        localData = await this.templateData.getLocalData(this.inputPath);
        debugDev("%o getData() getLocalData", this.inputPath);
      }

      let frontMatterData = await this.getFrontMatterData();
      let foundLayout =
        frontMatterData[this.config.keys.layout] ||
        localData[this.config.keys.layout];

      let mergedLayoutData = {};
      if (foundLayout) {
        let layout = TemplateLayout.getTemplate(
          foundLayout,
          this.getInputDir(),
          this.config
        );
        mergedLayoutData = await layout.getData();
        debugDev(
          "%o getData() get merged layout chain front matter",
          this.inputPath
        );
      }

      let mergedData = TemplateData.mergeDeep(
        this.config,
        {},
        mergedLayoutData,
        localData,
        frontMatterData
      );
      mergedData = await this.addPageDate(mergedData);
      mergedData = this.addPageData(mergedData);
      debugDev("%o getData() mergedData", this.inputPath);

      this.dataCache = mergedData;
    }

    // Don’t deep merge pagination data! See https://github.com/11ty/eleventy/issues/147#issuecomment-440802454
    return Object.assign(
      TemplateData.mergeDeep(this.config, {}, this.dataCache),
      this.paginationData
    );
  }

  async addPageDate(data) {
    if (!("page" in data)) {
      data.page = {};
    }

    let newDate = await this.getMappedDate(data);

    if ("page" in data && "date" in data.page) {
      debug(
        "Warning: data.page.date is in use (%o) will be overwritten with: %o",
        data.page.date,
        newDate
      );
    }

    data.page.date = newDate;

    return data;
  }

  addPageData(data) {
    if (!("page" in data)) {
      data.page = {};
    }

    data.page.inputPath = this.inputPath;
    data.page.fileSlug = this.fileSlugStr;
    data.page.filePathStem = this.filePathStem;

    return data;
  }

  async addPageRenderedData(data) {
    if (!("page" in data)) {
      data.page = {};
    }

    let newUrl = await this.getOutputHref(data);
    if ("page" in data && "url" in data.page) {
      if (data.page.url !== newUrl) {
        debug(
          "Warning: data.page.url is in use (%o) will be overwritten with: %o",
          data.page.url,
          newUrl
        );
      }
    }

    data.page.url = newUrl;
    data.page.outputPath = await this.getOutputPath(data);

    return data;
  }

  // getData (with renderData and page.url added)
  async getRenderedData() {
    let data = await this.getData();
    data = await this.addPageRenderedData(data);

    if (data.renderData) {
      data.renderData = await this.mapDataAsRenderedTemplates(
        data.renderData,
        data
      );
    }
    return data;
  }

  async renderLayout(tmpl, tmplData) {
    let layoutKey = tmplData[tmpl.config.keys.layout];
    let layout = TemplateLayout.getTemplate(
      layoutKey,
      this.getInputDir(),
      this.config
    );
    debug("%o is using layout %o", this.inputPath, layoutKey);

    // TODO reuse templateContent from templateMap
    let templateContent = await super.render(
      await this.getPreRender(),
      tmplData
    );
    return layout.render(tmplData, templateContent);
  }

  async _testRenderWithoutLayouts(data) {
    this.setWrapWithLayouts(false);
    let ret = await this.render(data);
    this.setWrapWithLayouts(true);
    return ret;
  }

  async renderContent(str, data, bypassMarkdown) {
    return super.render(str, data, bypassMarkdown);
  }

  async render(data) {
    debugDev("%o render()", this.inputPath);
    if (!data) {
      data = await this.getRenderedData();
    }

    if (!this.wrapWithLayouts && data[this.config.keys.layout]) {
      debugDev("Template.render is bypassing layouts for %o.", this.inputPath);
    }

    if (this.wrapWithLayouts && data[this.config.keys.layout]) {
      debugDev(
        "Template.render found layout: %o",
        data[this.config.keys.layout]
      );
      return this.renderLayout(this, data);
    } else {
      debugDev("Template.render renderContent for %o", this.inputPath);
      return super.render(await this.getPreRender(), data);
    }
  }

  addLinter(callback) {
    this.linters.push(callback);
  }

  async runLinters(str, inputPath, outputPath) {
    this.linters.forEach(function(linter) {
      // these can be asynchronous but no guarantee of order when they run
      linter.call(this, str, inputPath, outputPath);
    });
  }

  addTransform(callback) {
    this.transforms.push(callback);
  }

  async runTransforms(str, outputPath, inputPath) {
    for (let transform of this.transforms) {
      str = await transform.call(this, str, outputPath, inputPath);
    }

    return str;
  }

  async getTemplates(data) {
    // TODO cache this
    let results = [];

    if (!Pagination.hasPagination(data)) {
      data.page.url = await this.getOutputHref(data);
      data.page.outputPath = await this.getOutputPath(data);

      results.push({
        template: this,
        inputPath: this.inputPath,
        fileSlug: this.fileSlugStr,
        filePathStem: this.filePathStem,
        data: data,
        date: data.page.date,
        outputPath: data.page.outputPath,
        url: data.page.url,
        set templateContent(content) {
          this._templateContent = content;
        },
        get templateContent() {
          if (this._templateContent === undefined) {
            // should at least warn here
            throw new TemplateContentPrematureUseError(
              `Tried to use templateContent too early (${this.inputPath})`
            );
          }
          return this._templateContent;
        }
      });
    } else {
      // needs collections for pagination items
      // but individual pagination entries won’t be part of a collection
      this.paging = new Pagination(data);
      this.paging.setTemplate(this);
      let templates = await this.paging.getPageTemplates();
      let pageNumber = 0;
      for (let page of templates) {
        // TODO try to reuse data instead of a new copy
        let pageData = await page.getRenderedData();

        // Issue #115
        if (data.collections) {
          pageData.collections = data.collections;
        }

        pageData.page.url = await page.getOutputHref(pageData);
        pageData.page.outputPath = await page.getOutputPath(pageData);

        results.push({
          template: page,
          inputPath: this.inputPath,
          fileSlug: this.fileSlugStr,
          filePathStem: this.filePathStem,
          data: pageData,
          date: pageData.page.date,
          pageNumber: pageNumber++,
          outputPath: pageData.page.outputPath,
          url: pageData.page.url,
          set templateContent(content) {
            this._templateContent = content;
          },
          get templateContent() {
            if (this._templateContent === undefined) {
              throw new TemplateContentPrematureUseError(
                `Tried to use templateContent too early (${this.inputPath} page ${this.pageNumber})`
              );
            }
            return this._templateContent;
          }
        });
      }
    }

    return results;
  }

  async getRenderedTemplates(data) {
    let pages = await this.getTemplates(data);
    for (let page of pages) {
      let content = await page.template._getContent(page.outputPath, page.data);

      page.templateContent = content;
    }
    return pages;
  }

  async _getContent(outputPath, data) {
    return await this.render(data);
  }

  async _write(outputPath, finalContent, data) {
    if (outputPath === false) {
      debug(
        "Ignored %o from %o (permalink: false).",
        outputPath,
        this.inputPath
      );
      return;
    }

    this.writeCount++;

    let lang = {
      start: "Writing",
      finished: "written."
    };

    if (this.isDryRun) {
      lang = {
        start: "Pretending to write",
        finished: "" // not used
      };
    }

    if (this.isVerbose) {
      console.log(`${lang.start} ${outputPath} from ${this.inputPath}.`); // (${this.getTemplateLanguageString(data)})
    } else {
      debug(`${lang.start} %o from %o.`, outputPath, this.inputPath);
    }
    if (!this.isDryRun) {
      return fs.outputFile(outputPath, finalContent).then(() => {
        debug(`${outputPath} ${lang.finished}.`);
      });
    }
  }

  async renderPageEntry(mapEntry, page) {
    let content;
    let layoutKey = mapEntry.data[this.config.keys.layout];
    if (layoutKey) {
      let layout = TemplateLayout.getTemplate(
        layoutKey,
        this.getInputDir(),
        this.config
      );
      content = await layout.render(page.data, page.templateContent);
      await this.runLinters(content, page.inputPath, page.outputPath);
      content = await this.runTransforms(content, page.outputPath); // pass in page.inputPath?
      return content;
    } else {
      content = page.templateContent;
      await this.runLinters(
        page.templateContent,
        page.inputPath,
        page.outputPath
      );
      content = await this.runTransforms(content, page.outputPath); // pass in page.inputPath?
    }
    return content;
  }

  async writeMapEntry(mapEntry) {
    let promises = [];
    for (let page of mapEntry._pages) {
      let content = await this.renderPageEntry(mapEntry, page);
      promises.push(this._write(page.outputPath, content, page.data));
    }

    return Promise.all(promises);
  }

  async write(outputPath, data) {
    let templates = await this.getRenderedTemplates(data);
    let promises = [];
    for (let tmpl of templates) {
      promises.push(
        this._write(tmpl.outputPath, tmpl.templateContent, tmpl.data)
      );
    }

    return Promise.all(promises);
  }

  // TODO this but better
  clone() {
    let tmpl = new Template(
      this.inputPath,
      this.inputDir,
      this.outputDir,
      this.templateData
    );
    tmpl.config = this.config;

    for (let transform of this.transforms) {
      tmpl.addTransform(transform);
    }
    for (let linter of this.linters) {
      tmpl.addLinter(linter);
    }
    tmpl.setIsVerbose(this.isVerbose);
    tmpl.setDryRun(this.isDryRun);

    return tmpl;
  }

  getWriteCount() {
    return this.writeCount;
  }

  async getMappedDate(data) {
    // should we use Luxon dates everywhere? Right now using built-in `Date`
    if ("date" in data) {
      debug(
        "getMappedDate: using a date in the data for %o of %o",
        this.inputPath,
        data.date
      );
      if (data.date instanceof Date) {
        // YAML does its own date parsing
        debug("getMappedDate: YAML parsed it: %o", data.date);
        return data.date;
      } else {
        let stat = await fs.stat(this.inputPath);
        // string
        if (data.date.toLowerCase() === "last modified") {
          return new Date(stat.ctimeMs);
        } else if (data.date.toLowerCase() === "created") {
          return new Date(stat.birthtimeMs);
        } else {
          // try to parse with Luxon
          let date = DateTime.fromISO(data.date, { zone: "utc" });
          if (!date.isValid) {
            throw new Error(
              `date front matter value (${data.date}) is invalid for ${this.inputPath}`
            );
          }
          debug(
            "getMappedDate: Luxon parsed %o: %o and %o",
            data.date,
            date,
            date.toJSDate()
          );

          return date.toJSDate();
        }
      }
    } else {
      let filenameRegex = this.inputPath.match(/(\d{4}-\d{2}-\d{2})/);
      if (filenameRegex !== null) {
        let dateObj = DateTime.fromISO(filenameRegex[1]).toJSDate();
        debug(
          "getMappedDate: using filename regex time for %o of %o: %o",
          this.inputPath,
          filenameRegex[1],
          dateObj
        );
        return dateObj;
      }

      let stat = await fs.stat(this.inputPath);
      let createdDate = new Date(stat.birthtimeMs);
      debug(
        "getMappedDate: using file created time for %o of %o (from %o)",
        this.inputPath,
        createdDate,
        stat.birthtimeMs
      );

      // CREATED
      return createdDate;
    }
  }

  async getTemplateMapContent(pageMapEntry) {
    pageMapEntry.template.setWrapWithLayouts(false);
    let content = await pageMapEntry.template._getContent(
      pageMapEntry.outputPath,
      pageMapEntry.data
    );
    pageMapEntry.template.setWrapWithLayouts(true);

    return content;
  }

  async getTemplateMapEntries() {
    debugDev("%o getMapped()", this.inputPath);

    let data = await this.getData();
    let entries = [];
    // does not return outputPath or url, we don’t want to render permalinks yet
    entries.push({
      template: this,
      inputPath: this.inputPath,
      data: data
    });
    return entries;
  }

  async _testCompleteRender() {
    let entries = await this.getTemplateMapEntries();
    let contents = [];

    for (let entry of entries) {
      entry._pages = await entry.template.getTemplates(entry.data);

      let page;
      for (page of entry._pages) {
        page.templateContent = await entry.template.getTemplateMapContent(page);
      }
      for (page of entry._pages) {
        contents.push(await this.renderPageEntry(entry, page));
      }
    }
    return contents;
  }
}

module.exports = Template;
