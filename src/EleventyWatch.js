const TemplatePath = require("./TemplatePath");

/* Decides when to watch and in what mode to watch
 * Incremental builds don’t batch changes, they queue.
 * Nonincremental builds batch.
 */

class EleventyWatch {
  constructor() {
    this.incremental = false;
    this.isActive = false;
    this.activeQueue = [];
  }

  isBuildRunning() {
    return this.isActive;
  }

  setBuildRunning() {
    this.isActive = true;

    // pop waiting queue into the active queue
    this.activeQueue = this.popNextActiveQueue();
  }

  setBuildFinished() {
    this.isActive = false;
    this.activeQueue = [];
  }

  getIncrementalFile() {
    if (!this.isActive || !this.incremental || this.activeQueue.length === 0) {
      return false;
    }

    return this.activeQueue[0];
  }

  /* Returns the changed files currently being operated on in the current `watch` build
   * Works with or without incremental (though in incremental only one file per time will be processed)
   */
  getActiveQueue() {
    if (!this.isActive) {
      return [];
    } else if (this.incremental) {
      return [this.activeQueue[0]];
    }

    return this.activeQueue;
  }

  _queueMatches(file) {
    let filterCallback;
    if (typeof file === "function") {
      filterCallback = file;
    } else {
      filterCallback = path => path === file;
    }

    return this.activeQueue.filter(filterCallback);
  }

  hasAllQueueFiles(file) {
    return (
      this.activeQueue.length > 0 &&
      this.activeQueue.length === this._queueMatches(file).length
    );
  }

  hasQueuedFile(file) {
    return this._queueMatches(file).length > 0;
  }

  get pendingQueue() {
    if (!this._queue) {
      this._queue = [];
    }
    return this._queue;
  }

  set pendingQueue(value) {
    this._queue = value;
  }

  addToPendingQueue(path) {
    if (path) {
      path = TemplatePath.addLeadingDotSlash(path);
      this.pendingQueue.push(path);
    }
  }

  getPendingQueueSize() {
    return this.pendingQueue.length;
  }

  getPendingQueue() {
    return this.pendingQueue;
  }

  getActiveQueueSize() {
    return this.activeQueue.length;
  }

  // returns array
  popNextActiveQueue() {
    if (this.incremental) {
      return this.pendingQueue.length ? [this.pendingQueue.shift()] : [];
    }

    let ret = this.pendingQueue.slice();
    this.pendingQueue = [];
    return ret;
  }
}

module.exports = EleventyWatch;
