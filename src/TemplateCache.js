// Note: this is only used for TemplateLayout right now but could be used for more
// Just be careful because right now the TemplateLayout cache keys are not directly mapped to paths
// So you may get collisions if you use this for other things.
class TemplateCache {
  constructor() {
    this.cache = {};
  }

  clear() {
    this.cache = {};
  }

  size() {
    return Object.keys(this.cache).length;
  }

  add(key, template) {
    this.cache[key] = template;
  }

  has(key) {
    return key in this.cache;
  }

  get(key) {
    if (!this.has(key)) {
      throw new Error(`Could not find ${key} in TemplateCache.`);
    }

    return this.cache[key];
  }
}

// singleton
module.exports = new TemplateCache();
