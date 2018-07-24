const TemplateCollection = require("./TemplateCollection");
const TemplateDependencies = require("./TemplateDependencies");
const eleventyConfig = require("./EleventyConfig");
const debug = require("debug")("Eleventy:TemplateMap");
const debugDev = require("debug")("Dev:Eleventy:TemplateMap");

class TemplateMap {
  constructor() {
    this.map = [];
    this.collection = new TemplateCollection();
    this.collectionsData = null;
    this.cached = false;
    this.configCollections = null;
  }

  async add(template) {
    // Adds keys for: template, inputPath, data, date
    let map = await template.getMapped();
    this.map.push(map);
    this.collection.add(map);
  }

  getMap() {
    let sorted = this.dependencies ? this.dependencies.getSortedReversed() : [];
    // console.log( sorted );
    let sortedMap = this.map.sort(function(a, b) {
      return sorted.indexOf(a.inputPath) - sorted.indexOf(b.inputPath);
    });
    // console.log( sortedMap.map(function(item) {
    //   return item.inputPath;
    // }) );
    return sortedMap;
  }

  getCollection() {
    return this.collection;
  }

  async cache() {
    this.dependencies = new TemplateDependencies();

    debug("Caching collections objects.");
    this.collectionsData = new Proxy(
      {},
      {
        get: function(target, property) {
          this.dependencies.add(target[property]);

          return target[property];
        }.bind(this)
      }
    );

    // Adds: data.collections (empty)
    await this.populateCollectionsDataInMap(this.collectionsData);

    // Adds: data.collections.all
    // Adds: data.collections.[Each individual tag entry]
    this.taggedCollectionsData = await this.getTaggedCollectionsData();
    Object.assign(this.collectionsData, this.taggedCollectionsData);

    // ** Except for pagination templates
    // Adds: _pages, url, outputPath
    await this.populateUrlDataInMap(true);

    // Adds: data.collections[*].url
    // Adds: data.collections[*].outputPath
    // await this.populateCollectionsWithOutputPaths(this.collectionsData);

    // Adds: data.collections.[Each .eleventy.js configuration specified collection]
    this.userConfigCollectionsData = await this.getUserConfigCollectionsData();
    Object.assign(this.collectionsData, this.userConfigCollectionsData);

    // ** Only for pagination templates (and only for the first page)
    // Adds: _pages, url, outputPath
    await this.populateUrlDataInMap();

    // Adds: data.collections[*].url
    // Adds: data.collections[*].outputPath
    // await this.populateCollectionsWithOutputPaths(this.collectionsData);

    // The order here is a problem if the root template
    // uses a collection that uses templateContent, it’ll be empty

    // Adds: templateContent
    await this.populateTemplateContentInMap();

    // Adds: data.collections[*].templateContent
    // this.populateCollectionsWithContent();

    this.cached = true;
  }

  _testGetMapEntryForPath(inputPath) {
    for (let j = 0, k = this.map.length; j < k; j++) {
      // inputPath should be unique (even with pagination?)
      if (this.map[j].inputPath === inputPath) {
        return this.map[j];
      }
    }
  }

  // getMapTemplateIndex(item) {
  //   let inputPath = item.inputPath;
  //   for (let j = 0, k = this.map.length; j < k; j++) {
  //     // inputPath should be unique (even with pagination?)
  //     if (this.map[j].inputPath === inputPath) {
  //       return j;
  //     }
  //   }

  //   return -1;
  // }

  async populateCollectionsDataInMap(collectionsData) {
    for (let map of this.map) {
      // TODO these collections shouldn’t be passed around in a cached data object like this
      map.data.collections = collectionsData;
    }
  }

  async populateUrlDataInMap(skipPagination) {
    for (let map of this.map) {
      if (map._pages) {
        continue;
      }
      if (skipPagination && "pagination" in map.data) {
        continue;
      }

      let pages = await map.template.getTemplates(map.data);
      if (pages.length) {
        map._pages = pages;

        Object.assign(
          map,
          await map.template.getSecondaryMapEntry(map._pages[0])
        );
      }
    }
  }

  getTemplateContentProxy(target) {
    return new Proxy(target, {
      get: function(target, property) {
        // if( property === "templateContent" ) {
        // console.log( "  ", property, ":", target.templateContent );
        // }
        return target[property];
      }
    });
  }

  async populateTemplateContentInMap() {
    for (let map of this.map) {
      if (map._pages) {
        this.dependencies.setActiveTemplatePath(map.inputPath);
        let tertiaryMapEntry = await map.template.getTertiaryMapEntry(
          map._pages[0]
        );
        Object.assign(map, this.getTemplateContentProxy(tertiaryMapEntry));

        // get all templateContents so we can build our TemplateDependency graph
        let pagedTemplateContent = [map.templateContent];
        for (let j = 1, k = map._pages.length; j < k; j++) {
          let pagedTertiaryMapEntry = await map.template.getTertiaryMapEntry(
            map._pages[j]
          );
          pagedTemplateContent.push(
            this.getTemplateContentProxy(pagedTertiaryMapEntry)
          );
        }
        map.pagedTemplateContent = pagedTemplateContent;

        debugDev(
          "Added this.map[...].templateContent, outputPath, et al for one map entry"
        );
        this.dependencies.resetActiveTemplatePath(map.inputPath);
      }
    }
  }

  getAllTags() {
    let allTags = {};
    for (let map of this.map) {
      let tags = map.data.tags;
      if (Array.isArray(tags)) {
        for (let tag of tags) {
          allTags[tag] = true;
        }
      } else if (tags) {
        allTags[tags] = true;
      }
    }
    return Object.keys(allTags);
  }

  async getTaggedCollectionsData() {
    let collections = {};
    collections.all = this.collection.getAllSorted();
    debug(`Collection: collections.all size: ${collections.all.length}`);

    let tags = this.getAllTags();
    debug(`Found: ${tags.length} tags.`);
    for (let tag of tags) {
      collections[tag] = this.collection.getFilteredByTag(tag);
      debug(`Collection: collections.${tag} size: ${collections[tag].length}`);
    }
    return collections;
  }

  setUserConfigCollections(configCollections) {
    return (this.configCollections = configCollections);
  }

  async getUserConfigCollectionsData() {
    let collections = {};
    let configCollections =
      this.configCollections || eleventyConfig.getCollections();
    for (let name in configCollections) {
      collections[name] = configCollections[name](this.collection).filter(
        () => true
      );
      debug(
        `Collection: collections.${name} size: ${collections[name].length}`
      );
    }
    return collections;
  }

  async _testGetAllCollectionsData() {
    let collections = {};
    let taggedCollections = await this.getTaggedCollectionsData();
    Object.assign(collections, taggedCollections);

    let userConfigCollections = await this.getUserConfigCollectionsData();
    Object.assign(collections, userConfigCollections);

    return collections;
  }

  // populateCollectionsWithOutputPaths(collections) {
  //   for (let collectionName in collections) {
  //     for (let item of collections[collectionName]) {
  //       let index = this.getMapTemplateIndex(item);
  //       if (index !== -1) {
  //         item.outputPath = this.map[index].outputPath;
  //         item.url = this.map[index].url;
  //       }
  //     }
  //   }
  // }

  // populateCollectionsWithContent() {
  //   for (let collectionName in this.collectionsData) {
  //     for (let item of this.collectionsData[collectionName]) {
  //       let index = this.getMapTemplateIndex(item);
  //       if (index !== -1) {
  //         item.templateContent = this.map[index].templateContent;
  //       }
  //     }
  //   }
  // }

  async getCollectionsData() {
    if (!this.cached) {
      await this.cache();
    }

    return this.collectionsData;
  }
}

module.exports = TemplateMap;
