const multimatch = require("multimatch");
const Sortable = require("./Util/Sortable");
const TemplatePath = require("./TemplatePath");

class TemplateCollection extends Sortable {
  constructor() {
    super();
  }

  // right now this is only used by the tests
  async _testAddTemplate(template) {
    let templateMap = await template.getMapped();
    this.add(templateMap);
  }

  getAll() {
    return this.items.filter(() => true);
  }

  getAllSorted() {
    return this.sort(Sortable.sortFunctionDateInputPath);
  }

  getSortedByDate() {
    return this.sort(Sortable.sortFunctionDate);
  }

  getGlobs(globs) {
    if (typeof globs === "string") {
      globs = [globs];
    }

    globs = globs.map(glob => TemplatePath.addLeadingDotSlash(glob));

    return globs;
  }

  getFilteredByGlob(globs) {
    globs = this.getGlobs(globs);

    return this.getAllSorted().filter(item => {
      if (multimatch([item.inputPath], globs).length) {
        return true;
      }

      return false;
    });
  }

  getFilteredByTag(tagName) {
    return this.getAllSorted().filter(function(item) {
      let match = false;
      if (!tagName) {
        return true;
      } else if (Array.isArray(item.data.tags)) {
        item.data.tags.forEach(tag => {
          if (tag === tagName) {
            match = true;
          }
        });
      } else if (typeof item.data.tags === "string") {
        match = item.data.tags === tagName;
      }
      return match;
    });
  }
}

module.exports = TemplateCollection;
