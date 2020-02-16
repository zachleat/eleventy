const lodashGet = require("lodash/get");
const lodashSet = require("lodash/set");
const lodashHas = require("lodash/has");
const DependencyGraph = require("dependency-graph").DepGraph;

const config = require("./Config");

class DataGraph {
  constructor() {
    this.config = config.getConfig();
    this.dataGraph = new DependencyGraph();
  }

  addConsumerOfInclude(src, target, srcType = "template") {
    this.dataGraph.addNode(src, { type: srcType });
    this.dataGraph.addNode(target, { type: "include" });

    this.dataGraph.addDependency(src, target);
  }

  addSourceOfData(filename, sourceDataPath) {
    this.dataGraph.addNode(filename, { type: "template" });
    this.dataGraph.addNode(sourceDataPath, { type: "path" });

    // metadata.json supplies metadata
    this.dataGraph.addDependency(sourceDataPath, filename);
  }

  addConsumerOfData(filename, consumerDataPath) {
    this.dataGraph.addNode(filename, { type: "template" });
    this.dataGraph.addNode(consumerDataPath, { type: "path" });

    // test.md uses metadata
    this.dataGraph.addDependency(filename, consumerDataPath);
  }

  filterNodeTypes(nodes, type) {
    return nodes.filter(
      entry => this.dataGraph.getNodeData(entry).type === type
    );
  }

  // only return files, not includes or layouts
  getConsumersOf(node) {
    return this.filterNodeTypes(this.dataGraph.dependantsOf(node), "template");
  }

  async addGraphForTemplateMap(templateMap) {
    if (!templateMap.cached) {
      await templateMap.cache();
    }
    let map = templateMap.getMap();
    let promises = [];
    for (let mapEntry of map) {
      promises.push(this.addGraphForTemplate(mapEntry.template, mapEntry.data));
    }
    return Promise.all(promises);
  }

  async addGraphForTemplate(template, data) {
    let { inputPath } = template;

    if (!data) {
      data = await template.getData();
    }

    if (data.layout) {
      let layoutChain = await template.getLayoutChain();
      layoutChain.unshift(inputPath);

      while (layoutChain.length > 1) {
        this.addConsumerOfInclude(layoutChain.shift(), layoutChain[0]);
      }
    }

    if (data.collections) {
      this.addProxyToChildren(data, "collections", target => {
        this.addConsumerOfData(inputPath, target);
      });
    }
  }

  addDirectProxy(data, target, callback = () => {}) {
    return this.addProxy(data, target, false, callback);
  }

  addProxyToChildren(data, target, callback = () => {}) {
    return this.addProxy(data, target, true, callback);
  }

  addProxy(data, target, targetChildren = true, callback = () => {}) {
    if (!lodashHas(data, target)) {
      throw new Error(`Target ${target} not found in addProxy data object.`);
    }

    let targetData = lodashGet(data, target);
    let proxy = new Proxy(targetData, {
      get: (obj, prop) => {
        if (obj[prop]) {
          callback(targetChildren ? `${target}.${prop}` : target);
        }
        return obj[prop];
      }
    });
    lodashSet(data, target, proxy);
    return data;
  }
}

module.exports = DataGraph;
