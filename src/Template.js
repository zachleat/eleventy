const fs = require("fs-extra");
const parsePath = require("parse-filepath");
const normalize = require("normalize-path");
const _isObject = require("lodash.isobject");
const { DateTime } = require("luxon");
const TemplateContent = require("./TemplateContent");
const TemplatePath = require("./TemplatePath");
const TemplatePermalink = require("./TemplatePermalink");
const TemplateLayout = require("./TemplateLayout");
const TemplateFileSlug = require("./TemplateFileSlug");
const Pagination = require("./Plugins/Pagination");
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

    this.transforms = [];
    this.plugins = {};
    this.templateData = templateData;
    if (this.templateData) {
      this.templateData.setInputDir(this.inputDir);
    }
    this.paginationData = {};

    // HTML output can’t overwrite the HTML input file.
    this.isHtmlIOException =
      this.inputDir === this.outputDir &&
      this.templateRender.isEngine("html") &&
      this.parsed.name === "index";

    this.isVerbose = true;
    this.isDryRun = false;
    this.writeCount = 0;
    this.wrapWithLayouts = true;
    this.fileSlug = new TemplateFileSlug(this.inputPath, this.inputDir);
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
    return TemplatePath.stripPathFromDir(this.parsed.dir, this.inputDir);
  }

  async _getLink(data) {
    if (!data) {
      data = await this.getData();
    }

    let permalink = data[this.config.keys.permalink];
    if (permalink) {
      // render variables inside permalink front matter, bypass markdown
      let permalinkValue;
      if (!this.config.dynamicPermalinks || data.dynamicPermalink === true) {
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
    }

    return TemplatePermalink.generate(
      this.getTemplateSubfolder(),
      this.parsed.name,
      this.extraOutputSubdirectory,
      this.isHtmlIOException ? this.config.htmlOutputSuffix : ""
    );
  }

  // TODO instead of isHTMLIOException, do a global search to check if output path = input path and then add extra suffix
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
    // TODO this only works with immediate front matter and not data files
    if ((await this.getFrontMatterData())[this.config.keys.permalinkRoot]) {
      return normalize(uri);
    } else {
      return normalize(this.outputDir + "/" + uri);
    }
  }

  setPaginationData(paginationData) {
    this.paginationData = paginationData;
  }

  isIgnored() {
    return this.outputDir === false;
  }

  async mapDataAsRenderedTemplates(data, templateData) {
    if (Array.isArray(data)) {
      let arr = [];
      for (let j = 0, k = data.length; j < k; j++) {
        arr.push(await this.mapDataAsRenderedTemplates(data[j], templateData));
      }
      return arr;
    } else if (_isObject(data)) {
      let obj = {};
      for (let value in data) {
        obj[value] = await this.mapDataAsRenderedTemplates(
          data[value],
          templateData
        );
      }
      return obj;
    } else if (typeof data === "string") {
      debug("rendering data.renderData for %o", this.inputPath);
      // bypassMarkdown
      let str = await super.render(data, templateData, true);
      return str;
    }

    return data;
  }

  async _testGetAllLayoutFrontMatterData() {
    let frontMatterData = await this.getFrontMatterData();
    if (frontMatterData[this.config.keys.layout]) {
      let layout = TemplateLayout.getTemplate(
        frontMatterData[this.config.keys.layout],
        this.getInputDir()
      );
      return await layout.getData();
    }
    return {};
  }

  async getData(localData) {
    if (!this.dataCache) {
      debugDev("%o getData()", this.inputPath);
      let localData = {};

      if (this.templateData) {
        localData = await this.templateData.getLocalData(this.inputPath);
        debugDev("%o getData() getLocalData", this.inputPath);
      }

      Object.assign(localData, await this.getFrontMatterData());

      let mergedLayoutData = {};
      if (localData[this.config.keys.layout]) {
        let layout = TemplateLayout.getTemplate(
          localData[this.config.keys.layout],
          this.getInputDir()
        );
        mergedLayoutData = await layout.getData();
        debugDev(
          "%o getData() get merged layout chain front matter",
          this.inputPath
        );
      }

      let mergedData = Object.assign({}, mergedLayoutData, localData);
      mergedData = await this.addPageDate(mergedData);
      mergedData = this.addPageData(mergedData);
      debugDev("%o getData() mergedData", this.inputPath);

      this.dataCache = mergedData;
    }

    return Object.assign({}, this.dataCache, localData, this.paginationData);
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
    data.page.fileSlug = this.fileSlug.getSlug();

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
    let layout = TemplateLayout.getTemplate(layoutKey, this.getInputDir());
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

  addTransform(callback) {
    this.transforms.push(callback);
  }

  async runTransforms(str, outputPath) {
    this.transforms.forEach(function(transform) {
      str = transform.call(this, str, outputPath);
    });

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
        data: data,
        date: data.page.date,
        outputPath: data.page.outputPath,
        url: data.page.url
      });
    } else {
      // needs collections for pagination items
      // but individual pagination entries won’t be part of a collection
      this.paging = new Pagination(data);
      this.paging.setTemplate(this);
      let templates = await this.paging.getPageTemplates();
      for (let page of templates) {
        let pageData = await page.getRenderedData();

        // Issue #115
        if (data.collections) {
          pageData.collections = data.collections;
        }

        // TODO try to reuse data instead of a new copy
        // let pageData = this.augmentDataWithRenderedContent(data);
        results.push({
          template: page,
          inputPath: this.inputPath,
          data: pageData,
          date: data.page.date,
          outputPath: await page.getOutputPath(pageData),
          url: await page.getOutputHref(pageData)
        });
      }
    }

    return results;
  }

  async getRenderedTemplates(data) {
    let pages = await this.getTemplates(data);
    for (let page of pages) {
      page.templateContent = await page.template._getContent(
        page.outputPath,
        page.data
      );
    }
    return pages;
  }

  async _getContent(outputPath, data) {
    let str = await this.render(data);
    let transformed = await this.runTransforms(str, outputPath);

    return transformed;
  }

  async _write(outputPath, finalContent) {
    this.writeCount++;

    let writeDesc = this.isDryRun ? "Pretending to write" : "Writing";
    if (this.isVerbose) {
      console.log(`${writeDesc} ${outputPath} from ${this.inputPath}.`);
    } else {
      debug(`${writeDesc} %o from %o.`, outputPath, this.inputPath);
    }

    if (!this.isDryRun) {
      return fs.outputFile(outputPath, finalContent).then(() => {
        debug(
          `${outputPath} ${
            !this.isDryRun ? "written" : "pretended to be written"
          }.`
        );
      });
    }
  }

  async writeContent(outputPath, templateContent) {
    return this._write(outputPath, templateContent);
  }

  async write(outputPath, data) {
    let templates = await this.getRenderedTemplates(data);
    let promises = [];
    for (let tmpl of templates) {
      promises.push(this._write(tmpl.outputPath, tmpl.templateContent));
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
              `date front matter value (${data.date}) is invalid for ${
                this.inputPath
              }`
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

  async getInitialMapEntry() {
    let data = await this.getData();

    // does not return outputPath or url, we don’t want to render permalinks yet
    return {
      template: this,
      inputPath: this.inputPath,
      data: data,
      date: data.page.date
    };
  }

  async getSecondaryMapEntry(page) {
    return {
      url: page.url,
      outputPath: page.outputPath
    };
  }

  async getTertiaryMapEntry(page) {
    this.setWrapWithLayouts(false);
    let mapEntry = {
      templateContent: await page.template._getContent(
        page.outputPath,
        page.data
      )
    };
    this.setWrapWithLayouts(true);

    return mapEntry;
  }

  async getMapped() {
    debugDev("%o getMapped()", this.inputPath);
    return await this.getInitialMapEntry();
  }
}

module.exports = Template;
