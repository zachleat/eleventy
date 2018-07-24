const toposort = require("toposort");
const _uniqWith = require("lodash.uniqwith");
const _isEqual = require("lodash.isequal");

class TemplateDependencies {
  constructor() {
    this.deps = [];
  }

  setActiveTemplatePath(path) {
    this.activePath = path;
  }

  resetActiveTemplatePath() {
    this.activePath = undefined;
  }

  add(collection) {
    if (this.activePath) {
      for (let item of collection) {
        this.deps.push([this.activePath, item.inputPath]);
      }
      this.deps = _uniqWith(this.deps, _isEqual);
    }
  }

  getDependencies() {
    return this.deps;
  }

  getSorted() {
    return toposort(this.deps);
  }

  getSortedReversed() {
    return this.getSorted().reverse();
  }
}
module.exports = TemplateDependencies;
