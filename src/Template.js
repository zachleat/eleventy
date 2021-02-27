const fs = require("fs-extra");
const parsePath = require("parse-filepath");
const normalize = require("normalize-path");
const lodashIsObject = require("lodash/isObject");
const { DateTime } = require("luxon");

const TemplateData = require("./TemplateData");
const TemplateContent = require("./TemplateContent");
const TemplatePath = require("./TemplatePath");
const TemplatePermalink = require("./TemplatePermalink");
const TemplatePermalinkNoWrite = require("./TemplatePermalinkNoWrite");
const TemplateLayout = require("./TemplateLayout");
const TemplateFileSlug = require("./TemplateFileSlug");
const ComputedData = require("./ComputedData");
const Pagination = require("./Plugins/Pagination");
const TemplateContentPrematureUseError = require("./Errors/TemplateContentPrematureUseError");
const ConsoleLogger = require("./Util/ConsoleLogger");

const debug = require("debug")("Eleventy:Template");
const debugDev = require("debug")("Dev:Eleventy:Template");
const bench = require("./BenchmarkManager").get("Aggregate");

class Template extends TemplateContent {
  constructor(path, inputDir, outputDir, templateData, extensionMap) {
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

    this.extensionMap = extensionMap;

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
    this.skippedCount = 0;
    this.wrapWithLayouts = true;
    this.fileSlug = new TemplateFileSlug(
      this.inputPath,
      this.inputDir,
      this.extensionMap
    );
    this.fileSlugStr = this.fileSlug.getSlug();
    this.filePathStem = this.fileSlug.getFullPathWithoutExtension();
  }

  get logger() {
    if (!this._logger) {
      this._logger = new ConsoleLogger();
      this._logger.isVerbose = this.isVerbose;
    }
    return this._logger;
  }

  /* Setter for Logger */
  set logger(logger) {
    this._logger = logger;
  }

  setIsVerbose(isVerbose) {
    this.isVerbose = isVerbose;
    this.logger.isVerbose = isVerbose;
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

  getLayout(layoutKey) {
    if (!this._layout || layoutKey !== this._layoutKey) {
      this._layoutKey = layoutKey;
      this._layout = TemplateLayout.getTemplate(
        layoutKey,
        this.getInputDir(),
        this.config,
        this.extensionMap
      );
    }
    return this._layout;
  }

  async getLayoutChain() {
    if (!this._layout) {
      await this.getData();
    }

    return this._layout.getLayoutChain();
  }

  get baseFile() {
    return this.extensionMap.removeTemplateExtension(this.parsed.base);
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
      this.htmlIOException ? this.config.htmlOutputSuffix : "",
      this.engine.defaultTemplateFileExtension
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
      return Promise.all(
        data.map(item => this.mapDataAsRenderedTemplates(item, templateData))
      );
    } else if (lodashIsObject(data)) {
      let obj = {};
      await Promise.all(
        Object.keys(data).map(async value => {
          obj[value] = await this.mapDataAsRenderedTemplates(
            data[value],
            templateData
          );
        })
      );
      return obj;
    }

    return data;
  }

  async _testGetAllLayoutFrontMatterData() {
    let frontMatterData = await this.getFrontMatterData();
    if (frontMatterData[this.config.keys.layout]) {
      let layout = this.getLayout(frontMatterData[this.config.keys.layout]);
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
      let layoutKey =
        frontMatterData[this.config.keys.layout] ||
        localData[this.config.keys.layout];

      let mergedLayoutData = {};
      if (layoutKey) {
        let layout = this.getLayout(layoutKey);

        mergedLayoutData = await layout.getData();
        debugDev(
          "%o getData() get merged layout chain front matter",
          this.inputPath
        );
      }

      let mergedData = TemplateData.mergeDeep(
        this.config,
        {},
        localData,
        mergedLayoutData,
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

  async renderLayout(tmpl, tmplData) {
    let layoutKey = tmplData[tmpl.config.keys.layout];
    let layout = this.getLayout(layoutKey);
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

  // TODO at least some of this isn’t being used in the normal build
  // Render is used for `renderData` and `permalink` but otherwise `renderPageEntry` is being used
  async render(data) {
    debugDev("%o render()", this.inputPath);
    if (!data) {
      throw new Error("`data` needs to be passed into render()");
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
    for (let linter of this.linters) {
      // these can be asynchronous but no guarantee of order when they run
      linter.call(
        {
          inputPath,
          outputPath,
        },
        str,
        inputPath,
        outputPath
      );
    }
  }

  addTransform(name, callback) {
    this.transforms.push({
      name,
      callback,
    });
  }

  // Warning: this argument list is the reverse of linters (inputPath then outputPath)
  async runTransforms(str, inputPath, outputPath) {
    for (let transform of this.transforms) {
      str = await transform.callback.call(
        {
          inputPath,
          outputPath,
        },
        str,
        outputPath
      );
      if (!str) {
        this.logger.warn(
          `Warning: Transform \`${transform.name}\` returned empty when writing ${outputPath} from ${inputPath}.`
        );
      }
    }

    return str;
  }

  _addComputedEntry(computedData, obj, parentKey, declaredDependencies) {
    // this check must come before lodashIsObject
    if (typeof obj === "function") {
      computedData.add(parentKey, obj, declaredDependencies);
    } else if (lodashIsObject(obj)) {
      for (let key in obj) {
        let keys = [];
        if (parentKey) {
          keys.push(parentKey);
        }
        keys.push(key);
        this._addComputedEntry(
          computedData,
          obj[key],
          keys.join("."),
          declaredDependencies
        );
      }
    } else if (typeof obj === "string") {
      computedData.addTemplateString(
        parentKey,
        async innerData => {
          return await super.render(obj, innerData, true);
        },
        declaredDependencies
      );
    } else {
      // Numbers, booleans, etc
      computedData.add(parentKey, obj, declaredDependencies);
    }
  }

  async addComputedData(data) {
    // will _not_ consume renderData
    this.computedData = new ComputedData();

    if (this.config.keys.computed in data) {
      // Note that `permalink` is only a thing that gets consumed—it does not go directly into generated data
      // this allows computed entries to use page.url or page.outputPath and they’ll be resolved properly
      this.computedData.addTemplateString(
        "page.url",
        async data => await this.getOutputHref(data),
        data.permalink ? ["permalink"] : undefined
      );

      this.computedData.addTemplateString(
        "page.outputPath",
        async data => await this.getOutputPath(data),
        data.permalink ? ["permalink"] : undefined
      );

      // actually add the computed data
      this._addComputedEntry(
        this.computedData,
        data[this.config.keys.computed]
      );

      // limited run of computed data—save the stuff that relies on collections for later.
      debug("First round of computed data for %o", this.inputPath);
      await this.computedData.setupData(data, function (entry) {
        return !this.isUsesStartsWith(entry, "collections.");

        // TODO possible improvement here is to only process page.url, page.outputPath, permalink
        // instead of only punting on things that rely on collections.
        // let firstPhaseComputedData = ["page.url", "page.outputPath", ...this.getOrderFor("page.url"), ...this.getOrderFor("page.outputPath")];
        // return firstPhaseComputedData.indexOf(entry) > -1;
      });
    } else {
      if (!("page" in data)) {
        data.page = {};
      }

      data.page.url = await this.getOutputHref(data);
      data.page.outputPath = await this.getOutputPath(data);
    }

    // Deprecated, use eleventyComputed instead.
    if ("renderData" in data) {
      data.renderData = await this.mapDataAsRenderedTemplates(
        data.renderData,
        data
      );
    }
  }

  async resolveRemainingComputedData(data) {
    debug("Second round of computed data for %o", this.inputPath);
    await this.computedData.processRemainingData(data);
  }

  async getTemplates(data) {
    if (!Pagination.hasPagination(data)) {
      await this.addComputedData(data);

      return [
        {
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
          },
        },
      ];
    } else {
      // needs collections for pagination items
      // but individual pagination entries won’t be part of a collection
      this.paging = new Pagination(data);
      this.paging.setTemplate(this);
      let pageTemplates = await this.paging.getPageTemplates();

      return await Promise.all(
        pageTemplates.map(async (page, pageNumber) => {
          let pageData = Object.assign({}, await page.getData());

          await page.addComputedData(pageData);

          // Issue #115
          if (data.collections) {
            pageData.collections = data.collections;
          }

          return {
            template: page,
            inputPath: this.inputPath,
            fileSlug: this.fileSlugStr,
            filePathStem: this.filePathStem,
            data: pageData,
            date: pageData.page.date,
            pageNumber: pageNumber,
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
            },
          };
        })
      );
    }
  }

  async getRenderedTemplates(data) {
    let pages = await this.getTemplates(data);
    await Promise.all(
      pages.map(async page => {
        let content = await page.template._getContent(
          page.outputPath,
          page.data
        );

        page.templateContent = content;
      })
    );
    return pages;
  }

  async _getContent(outputPath, data) {
    return await this.render(data);
  }

  async _write(outputPath, finalContent) {
    let shouldWriteFile = true;

    if (this.isDryRun) {
      shouldWriteFile = false;
    }

    if (outputPath === false) {
      debug(
        "Ignored %o from %o (permalink: false).",
        outputPath,
        this.inputPath
      );
      return;
    }

    let lang = {
      start: "Writing",
      finished: "written.",
    };

    if (!shouldWriteFile) {
      lang = {
        start: "Skipping",
        finished: "", // not used, promise doesn’t resolve
      };
    }

    let engineList = this.templateRender.getReadableEnginesListDifferingFromFileExtension();
    this.logger.log(
      `${lang.start} ${outputPath} from ${this.inputPath}${
        engineList ? ` (${engineList})` : ""
      }`
    );

    if (!shouldWriteFile) {
      this.skippedCount++;
    } else {
      let templateBenchmark = bench.get("Template Write");
      templateBenchmark.before();
      return fs.outputFile(outputPath, finalContent).then(() => {
        templateBenchmark.after();
        this.writeCount++;
        debug(`${outputPath} ${lang.finished}.`);
      });
    }
  }

  async renderPageEntry(mapEntry, page) {
    let content;
    let layoutKey = mapEntry.data[this.config.keys.layout];
    if (layoutKey) {
      let layout = this.getLayout(layoutKey);

      content = await layout.render(page.data, page.templateContent);
    } else {
      content = page.templateContent;
    }

    await this.runLinters(content, page.inputPath, page.outputPath);
    content = await this.runTransforms(
      content,
      page.inputPath,
      page.outputPath
    );
    return content;
  }

  async generateMapEntry(mapEntry, to) {
    return Promise.all(
      mapEntry._pages.map(async page => {
        let content = await this.renderPageEntry(mapEntry, page);
        if (to === "json" || to === "ndjson") {
          let obj = {
            url: page.url,
            inputPath: page.inputPath,
            content: content,
          };

          if (to === "ndjson") {
            let jsonString = JSON.stringify(obj);
            this.logger.toStream(jsonString + "\n");
            return;
          }

          // json
          return obj;
        }

        return this._write(page.outputPath, content);
      })
    );
  }

  // TODO this but better
  clone() {
    let tmpl = new Template(
      this.inputPath,
      this.inputDir,
      this.outputDir,
      this.templateData,
      this.extensionMap
    );
    tmpl.config = this.config;
    tmpl.logger = this.logger;

    for (let transform of this.transforms) {
      tmpl.addTransform(transform.name, transform.callback);
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

  getSkippedCount() {
    return this.skippedCount;
  }

  async getMappedDate(data) {
    // TODO(slightlyoff): lots of I/O!

    // should we use Luxon dates everywhere? Right now using built-in `Date`
    if ("date" in data && data.date) {
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
        let stat = fs.statSync(this.inputPath);
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

      let stat = fs.statSync(this.inputPath);
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
      data: data,
    });
    return entries;
  }

  async _testCompleteRender() {
    let entries = await this.getTemplateMapEntries();

    let nestedContent = await Promise.all(
      entries.map(async entry => {
        entry._pages = await entry.template.getTemplates(entry.data);
        return Promise.all(
          entry._pages.map(async page => {
            page.templateContent = await entry.template.getTemplateMapContent(
              page
            );
            return this.renderPageEntry(entry, page);
          })
        );
      })
    );

    let contents = [].concat(...nestedContent);
    return contents;
  }
}

module.exports = Template;
