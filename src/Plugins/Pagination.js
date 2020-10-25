const lodashChunk = require("lodash/chunk");
const lodashGet = require("lodash/get");
const lodashSet = require("lodash/set");
const EleventyBaseError = require("../EleventyBaseError");

class PaginationError extends EleventyBaseError {}

class Pagination {
  constructor(data, eleventyConfig) {
    this.config = eleventyConfig.getConfig();

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

    this.target = this._resolveItems();
    this.items = this.getPagedItems();
  }

  setTemplate(tmpl) {
    this.template = tmpl;
  }

  _getDataKey() {
    return this.data.pagination.data;
  }

  doResolveToObjectValues() {
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

  _resolveItems() {
    let notFoundValue = "__NOT_FOUND_ERROR__";
    let key = this._getDataKey();
    let fullDataSet = lodashGet(this.data, key, notFoundValue);
    if (fullDataSet === notFoundValue) {
      throw new Error(
        `Could not resolve pagination key in template data: ${key}`
      );
    }

    let keys;
    if (Array.isArray(fullDataSet)) {
      keys = fullDataSet;
    } else if (this.doResolveToObjectValues()) {
      keys = Object.values(fullDataSet);
    } else {
      keys = Object.keys(fullDataSet);
    }

    let result = keys.slice();

    if (
      this.data.pagination.before &&
      typeof this.data.pagination.before === "function"
    ) {
      // we don’t need to make a copy of this because we already .filter() above
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

  getPagedItems() {
    // TODO switch to a getter
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

    return this.items.length;
  }

  async getPageTemplates() {
    if (!this.data) {
      throw new Error("Missing `setData` call for Pagination object.");
    }

    if (!this.hasPagination()) {
      return [];
    }

    if (this.pagesCache) {
      return this.pagesCache;
    }

    let pages = [];
    let items = this.items;
    let tmpl = this.template;
    let templates = [];
    let links = [];
    let hrefs = [];
    let overrides = [];

    for (let pageNumber = 0, k = items.length; pageNumber < k; pageNumber++) {
      let cloned = tmpl.clone();

      // TODO maybe also move this permalink additions up into the pagination class
      if (pageNumber > 0 && !this.data[this.config.keys.permalink]) {
        cloned.setExtraOutputSubdirectory(pageNumber);
      }

      templates.push(cloned);

      let override = {
        pagination: {
          data: this.data.pagination.data,
          size: this.data.pagination.size,
          alias: this.alias,

          pages: this.size === 1 ? items.map((entry) => entry[0]) : items,

          // See Issue #345 for more examples
          page: {
            previous:
              pageNumber > 0
                ? this.size === 1
                  ? items[pageNumber - 1][0]
                  : items[pageNumber - 1]
                : null,
            next:
              pageNumber < items.length - 1
                ? this.size === 1
                  ? items[pageNumber + 1][0]
                  : items[pageNumber + 1]
                : null,
            first: items.length
              ? this.size === 1
                ? items[0][0]
                : items[0]
              : null,
            last: items.length
              ? this.size === 1
                ? items[items.length - 1][0]
                : items[items.length - 1]
              : null,
          },

          items: items[pageNumber],
          pageNumber: pageNumber,
        },
      };

      if (this.alias) {
        lodashSet(
          override,
          this.alias,
          this.size === 1 ? items[pageNumber][0] : items[pageNumber]
        );
      }

      overrides.push(override);
      cloned.setPaginationData(override);

      // TO DO subdirectory to links if the site doesn’t live at /
      links.push("/" + (await cloned.getOutputLink()));
      hrefs.push(await cloned.getOutputHref());
    }

    // we loop twice to pass in the appropriate prev/next links (already full generated now)
    templates.forEach(
      function (cloned, pageNumber) {
        let pageObj = {};

        // links are okay but hrefs are better
        pageObj.previousPageLink =
          pageNumber > 0 ? links[pageNumber - 1] : null;
        pageObj.previous = pageObj.previousPageLink;

        pageObj.nextPageLink =
          pageNumber < templates.length - 1 ? links[pageNumber + 1] : null;
        pageObj.next = pageObj.nextPageLink;

        pageObj.firstPageLink = links.length > 0 ? links[0] : null;
        pageObj.lastPageLink =
          links.length > 0 ? links[links.length - 1] : null;

        pageObj.links = links;
        // todo deprecated, consistency with collections and use links instead
        pageObj.pageLinks = links;

        // hrefs are better than links
        pageObj.previousPageHref =
          pageNumber > 0 ? hrefs[pageNumber - 1] : null;
        pageObj.nextPageHref =
          pageNumber < templates.length - 1 ? hrefs[pageNumber + 1] : null;

        pageObj.firstPageHref = hrefs.length > 0 ? hrefs[0] : null;
        pageObj.lastPageHref =
          hrefs.length > 0 ? hrefs[hrefs.length - 1] : null;

        pageObj.hrefs = hrefs;

        // better names
        pageObj.href = {
          previous: pageObj.previousPageHref,
          next: pageObj.nextPageHref,
          first: pageObj.firstPageHref,
          last: pageObj.lastPageHref,
        };

        Object.assign(overrides[pageNumber].pagination, pageObj);

        cloned.setPaginationData(overrides[pageNumber]);

        pages.push(cloned);
      }.bind(this)
    );

    this.pagesCache = pages;

    return pages;
  }
}

module.exports = Pagination;
