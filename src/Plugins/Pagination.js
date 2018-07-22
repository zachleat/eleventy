const lodashChunk = require("lodash.chunk");
const lodashGet = require("lodash.get");
const lodashSet = require("lodash.set");
const config = require("../Config");

function Pagination(data) {
  this.config = config.getConfig();

  this.setData(data);
}

Pagination.hasPagination = function(data) {
  return "pagination" in data;
};

Pagination.prototype.hasPagination = function() {
  if (!this.data) {
    throw new Error("Missing `setData` call for Pagination object.");
  }
  return Pagination.hasPagination(this.data);
};

Pagination.prototype.setData = function(data) {
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

  this.size = data.pagination.size;
  this.alias = data.pagination.alias;

  this.target = this._resolveItems(data);
  this.items = this.getPagedItems();
};

Pagination.prototype.setTemplate = function(tmpl) {
  this.template = tmpl;
};

Pagination.prototype._getDataKey = function() {
  return this.data.pagination.data;
};

Pagination.prototype.resolveObjectToValues = function() {
  if ("resolve" in this.data.pagination) {
    return this.data.pagination.resolve === "values";
  }
  return false;
};

Pagination.prototype.isFiltered = function(value) {
  if ("filter" in this.data.pagination) {
    let filtered = this.data.pagination.filter;
    if (Array.isArray(filtered)) {
      return filtered.indexOf(value) > -1;
    }

    return filtered === value;
  }

  return false;
};

Pagination.prototype._resolveItems = function() {
  let notFoundValue = "__NOT_FOUND_ERROR__";
  let key = this._getDataKey();
  let ret = lodashGet(this.data, key, notFoundValue);
  if (ret === notFoundValue) {
    throw new Error(
      `Could not resolve pagination key in template data: ${key}`
    );
  }

  if (!Array.isArray(ret)) {
    if (this.resolveObjectToValues()) {
      ret = Object.values(ret);
    } else {
      ret = Object.keys(ret);
    }
  }

  return ret.filter(
    function(value) {
      return !this.isFiltered(value);
    }.bind(this)
  );
};

Pagination.prototype.getPagedItems = function() {
  if (!this.data) {
    throw new Error("Missing `setData` call for Pagination object.");
  }
  return lodashChunk(this.target, this.size);
};

// TODO this name is not good
// “To cancel” means to not write the original root template
Pagination.prototype.cancel = function() {
  return this.hasPagination();
};

Pagination.prototype.getPageTemplates = async function() {
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
        items: items[pageNumber],
        pageNumber: pageNumber
      }
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
  }

  // we loop twice to pass in the appropriate prev/next links (already full generated now)
  templates.forEach(
    function(cloned, pageNumber) {
      overrides[pageNumber].pagination.previousPageLink =
        pageNumber > 0 ? links[pageNumber - 1] : null;
      overrides[pageNumber].pagination.previous =
        overrides[pageNumber].pagination.previousPageLink;

      overrides[pageNumber].pagination.nextPageLink =
        pageNumber < templates.length - 1 ? links[pageNumber + 1] : null;
      overrides[pageNumber].pagination.next =
        overrides[pageNumber].pagination.nextPageLink;

      overrides[pageNumber].pagination.links = links;
      // todo deprecated, consistency with collections and use links instead
      overrides[pageNumber].pagination.pageLinks = links;

      cloned.setPaginationData(overrides[pageNumber]);

      pages.push(cloned);
    }.bind(this)
  );

  this.pagesCache = pages;

  return pages;
};

module.exports = Pagination;
