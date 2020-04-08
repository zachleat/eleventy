class TemplateRenderCache {
  constructor() {
    this.cache = {};
    this.hitCount = 0;
    this.missCount = 0;
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
    return false;

    if (key in this.cache) {
      // console.log( "Cache hit count", ++this.hitCount );
      return true;
    }
    // console.log( "Cache miss count", ++this.missCount );
    return false;
  }

  get(key) {
    if (!this.has(key)) {
      throw new Error(`Could not find ${key} in TemplateRenderCache.`);
    }
    return this.cache[key];
  }
}

module.exports = TemplateRenderCache;
