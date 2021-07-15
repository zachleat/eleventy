const lodashChunk = require("lodash/chunk");
const lodashGet = require("lodash/get");
const lodashSet = require("lodash/set");
const EleventyBaseError = require("../EleventyBaseError");

class PaginationConfigError extends EleventyBaseError {}
class PaginationError extends EleventyBaseError {}

class Pagination {
  constructor(data, config) {
    if (!config) {
      throw new PaginationConfigError(
        "Expected `config` argument to Pagination class."
      );
    }

    this.config = config;

    this.setData(data);
  }

  static hasPagination(data) {
    return "pagination" in data;
  }

  hasPagination() {
    if (!this.data) {
      throw new Error("Missing `setData` call for Pagination object.");
    }
    return Pagination.hasPagination(this.data);
  }

  circularReferenceCheck(data) {
    if (data.eleventyExcludeFromCollections) {
      return;
    }

    let key = data.pagination.data;
    let tags = data.tags || [];
    for (let tag of tags) {
      if (`collections.${tag}` === key) {
        throw new PaginationError(
          `Pagination circular reference${
            this.template ? ` on ${this.template.inputPath}` : ""
          }, data:\`${key}\` iterates over both the \`${tag}\` tag and also supplies pages to that tag.`
        );
      }
    }
  }

  setData(data) {
    this.data = data || {};
    this.target = [];

    if (!this.hasPagination()) {
      return;
    }

    if (!data.pagination) {
      throw new Error(
        "Misconfigured pagination data in template front matter (YAML front matter precaution: did you use tabs and not spaces for indentation?)."
      );
    } else if (!("size" in data.pagination)) {
      throw new Error("Missing pagination size in front matter data.");
    }
    this.circularReferenceCheck(data);

    this.size = data.pagination.size;
    this.alias = data.pagination.alias;
    // TODO do we need the full data set for serverless?
    this.fullDataSet = this._get(this.data, this._getDataKey());

    // truncate pagination data to one entry for serverless render
    if (
      data.pagination.serverless &&
      this._has(data, data.pagination.serverless)
    ) {
      // Warn: this doesn’t run filter/before/pagination transformations
      // Warn: `pagination.pages`, pageNumber, links, hrefs, etc
      let serverlessPaginationKey = this._get(data, data.pagination.serverless);
      this.chunkedItems = [
        [this._get(this.fullDataSet, serverlessPaginationKey)],
      ];
    } else {
      // this returns an array
      this.target = this._resolveItems();

      // Serverless Shortcut when key is not found in data set (probably running local build and expected a :path param in data)
      // Only collections are relevant for templates that don’t have a permalink.build, they don’t have a templateContent and aren’t written to disk
      if (
        data.pagination.serverless &&
        !data.pagination.addAllPagesToCollections
      ) {
        // use the first page only
        this.chunkedItems = [this.pagedItems[0]];
      } else {
        this.chunkedItems = this.pagedItems;
      }
    }
  }

  setTemplate(tmpl) {
    this.template = tmpl;
  }

  _getDataKey() {
    return this.data.pagination.data;
  }

  resolveDataToObjectValues() {
    if ("resolve" in this.data.pagination) {
      return this.data.pagination.resolve === "values";
    }
    return false;
  }

  isFiltered(value) {
    if ("filter" in this.data.pagination) {
      let filtered = this.data.pagination.filter;
      if (Array.isArray(filtered)) {
        return filtered.indexOf(value) > -1;
      }

      return filtered === value;
    }

    return false;
  }

  _has(target, key) {
    let notFoundValue = "__NOT_FOUND_ERROR__";
    let data = lodashGet(target, key, notFoundValue);
    return data !== notFoundValue;
  }

  _get(target, key) {
    let notFoundValue = "__NOT_FOUND_ERROR__";
    let data = lodashGet(target, key, notFoundValue);
    if (data === notFoundValue) {
      throw new Error(
        `Could not find pagination data, went looking for: ${key}`
      );
    }
    return data;
  }

  _resolveItems() {
    let keys;
    if (Array.isArray(this.fullDataSet)) {
      keys = this.fullDataSet;
    } else if (this.resolveDataToObjectValues()) {
      keys = Object.values(this.fullDataSet);
    } else {
      keys = Object.keys(this.fullDataSet);
    }

    // keys must be an array
    let result = keys.slice();

    if (
      this.data.pagination.before &&
      typeof this.data.pagination.before === "function"
    ) {
      // we don’t need to make a copy of this because we .slice() above to create a new copy
      result = this.data.pagination.before(result);
    }

    if (this.data.pagination.reverse === true) {
      result = result.reverse();
    }

    if (this.data.pagination.filter) {
      result = result.filter((value) => !this.isFiltered(value));
    }

    return result;
  }

  get pagedItems() {
    if (!this.data) {
      throw new Error("Missing `setData` call for Pagination object.");
    }

    return lodashChunk(this.target, this.size);
  }

  // TODO this name is not good
  // “To cancel” means to not write the original root template
  cancel() {
    return this.hasPagination();
  }

  getPageCount() {
    if (!this.hasPagination()) {
      return 0;
    }

    return this.chunkedItems.length;
  }

  getNormalizedItems(pageItems) {
    return this.size === 1 ? pageItems[0] : pageItems;
  }

  getOverrideData(pageItems) {
    let override = {
      pagination: {
        data: this.data.pagination.data,
        size: this.data.pagination.size,
        alias: this.alias,
        items: pageItems,
      },
    };

    if (this.alias) {
      lodashSet(override, this.alias, this.getNormalizedItems(pageItems));
    }

    return override;
  }

  getOverrideDataPages(items, pageNumber) {
    let obj = {
      pages: this.size === 1 ? items.map((entry) => entry[0]) : items,

      // See Issue #345 for more examples
      page: {
        previous:
          pageNumber > 0
            ? this.getNormalizedItems(items[pageNumber - 1])
            : null,
        next:
          pageNumber < items.length - 1
            ? this.getNormalizedItems(items[pageNumber + 1])
            : null,
        first: items.length ? this.getNormalizedItems(items[0]) : null,
        last: items.length
          ? this.getNormalizedItems(items[items.length - 1])
          : null,
      },

      pageNumber,
    };

    return obj;
  }

  getOverrideDataLinks(pageNumber, templates, links) {
    let obj = {};

    // links are okay but hrefs are better
    obj.previousPageLink = pageNumber > 0 ? links[pageNumber - 1] : null;
    obj.previous = obj.previousPageLink;

    obj.nextPageLink =
      pageNumber < templates.length - 1 ? links[pageNumber + 1] : null;
    obj.next = obj.nextPageLink;

    obj.firstPageLink = links.length > 0 ? links[0] : null;
    obj.lastPageLink = links.length > 0 ? links[links.length - 1] : null;

    obj.links = links;
    // todo deprecated, consistency with collections and use links instead
    obj.pageLinks = links;
    return obj;
  }

  getOverrideDataHrefs(pageNumber, templates, hrefs) {
    let obj = {};

    // hrefs are better than links
    obj.previousPageHref = pageNumber > 0 ? hrefs[pageNumber - 1] : null;
    obj.nextPageHref =
      pageNumber < templates.length - 1 ? hrefs[pageNumber + 1] : null;

    obj.firstPageHref = hrefs.length > 0 ? hrefs[0] : null;
    obj.lastPageHref = hrefs.length > 0 ? hrefs[hrefs.length - 1] : null;

    obj.hrefs = hrefs;

    // better names
    obj.href = {
      previous: obj.previousPageHref,
      next: obj.nextPageHref,
      first: obj.firstPageHref,
      last: obj.lastPageHref,
    };

    return obj;
  }

  async getPageTemplates() {
    if (!this.data) {
      throw new Error("Missing `setData` call for Pagination object.");
    }

    if (!this.hasPagination()) {
      return [];
    }

    let pages = [];
    let items = this.chunkedItems;
    let tmpl = this.template;
    let templates = [];
    let links = [];
    let hrefs = [];
    let overrides = [];

    const totalPages =
      items.length ? items.length : (
        this.data.pagination.pageOnEmptyData ? 1 : 0);

    for (let pageNumber = 0; pageNumber < totalPages; pageNumber++) {
      let cloned = tmpl.clone();

      // TODO maybe also move this permalink additions up into the pagination class
      if (pageNumber > 0 && !this.data[this.config.keys.permalink]) {
        cloned.setExtraOutputSubdirectory(pageNumber);
      }

      templates.push(cloned);

      let override = this.getOverrideData(items[pageNumber]);
      Object.assign(
        override.pagination,
        this.getOverrideDataPages(items, pageNumber)
      );

      overrides.push(override);
      cloned.setPaginationData(override);

      // TO DO subdirectory to links if the site doesn’t live at /
      // TODO missing data argument means Template.getData is regenerated, maybe doesn’t matter because of data cache?
      let { link, href } = await cloned.getOutputLocations();
      links.push("/" + link);
      hrefs.push(href);
    }

    // we loop twice to pass in the appropriate prev/next links (already full generated now)
    for (let pageNumber = 0; pageNumber < templates.length; pageNumber++) {
      let linksObj = this.getOverrideDataLinks(pageNumber, templates, links);
      Object.assign(overrides[pageNumber].pagination, linksObj);

      let hrefsObj = this.getOverrideDataHrefs(pageNumber, templates, hrefs);
      Object.assign(overrides[pageNumber].pagination, hrefsObj);

      let cloned = templates[pageNumber];
      cloned.setPaginationData(overrides[pageNumber]);

      pages.push(cloned);
    }

    return pages;
  }
}

module.exports = Pagination;
