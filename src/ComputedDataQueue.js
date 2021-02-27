const DependencyGraph = require("dependency-graph").DepGraph;

/* Keeps track of the dependency graph between computed data variables
 * Removes keys from the graph when they are computed.
 */
class ComputedDataQueue {
  constructor() {
    this.graph = new DependencyGraph();
  }

  getOrder() {
    return this.graph.overallOrder();
  }

  getOrderFor(name) {
    return this.graph.dependenciesOf(name);
  }

  getDependsOn(name) {
    return this.graph.dependantsOf(name);
  }

  isUsesStartsWith(name, prefix) {
    if (name.startsWith(prefix)) {
      return true;
    }
    return (
      this.graph.dependenciesOf(name).filter(entry => {
        return entry.startsWith(prefix);
      }).length > 0
    );
  }

  addNode(name) {
    if (!this.graph.hasNode(name)) {
      this.graph.addNode(name);
    }
  }

  _uses(graph, name, varsUsed = []) {
    if (!graph.hasNode(name)) {
      graph.addNode(name);
    }

    for (let varUsed of varsUsed) {
      if (!graph.hasNode(varUsed)) {
        graph.addNode(varUsed);
      }
      graph.addDependency(name, varUsed);
    }
  }

  uses(name, varsUsed = []) {
    this._uses(this.graph, name, varsUsed);
  }

  markComputed(varsComputed = []) {
    for (let varComputed of varsComputed) {
      this.graph.removeNode(varComputed);
    }
  }
}

module.exports = ComputedDataQueue;
