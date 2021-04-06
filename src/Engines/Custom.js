const TemplateEngine = require("./TemplateEngine");
const getJavaScriptData = require("../Util/GetJavaScriptData");

class CustomEngine extends TemplateEngine {
  constructor(name, includesDir, config) {
    super(name, includesDir, config);

    this.entry = this.getExtensionMapEntry();
    this.needsInit =
      "init" in this.entry && typeof this.entry.init === "function";
    this.initStarted = false;
    this.initFinished = false;
  }

  getExtensionMapEntry() {
    if ("extensionMap" in this.config) {
      for (let entry of this.config.extensionMap) {
        if (entry.key.toLowerCase() === this.name.toLowerCase()) {
          return entry;
        }
      }
    }

    throw Error(
      `Could not find a custom extension for ${this.name}. Did you add it to your config file?`
    );
  }

  /**
   * @override
   */
  needsToReadFileContents() {
    if ("read" in this.entry) {
      return this.entry.read;
    }
    return true;
  }

  // If we init from multiple places, wait for the first init to finish
  // before continuing on.
  async _runningInit() {
    if (this.needsInit) {
      if (this.initStarted) {
        await this.initStarted;
      } else if (!this.initFinished) {
        this.initStarted = this.entry.init.bind({ config: this.config })();
        await this.initStarted;
        this.initFinished = true;
      }
    }
  }

  async getExtraDataFromFile(inputPath) {
    await this._runningInit();

    if ("getData" in this.entry) {
      if (typeof this.entry.getData === "function") {
        return await this.entry.getData(inputPath);
      } else {
        if (!("getInstanceFromInputPath" in this.entry)) {
          return Promise.reject(
            new Error(
              `getInstanceFromInputPath callback missing from ${this.name} template engine plugin.`
            )
          );
        }
        let inst = await this.entry.getInstanceFromInputPath(inputPath);
        return await getJavaScriptData(inst, inputPath);
      }
    }
  }

  async compile(str, inputPath) {
    await this._runningInit();

    // TODO generalize this (look at JavaScript.js)
    return this.entry.compile.bind({ config: this.config })(str, inputPath);
  }

  get defaultTemplateFileExtension() {
    return this.entry.outputFileExtension;
  }
}

module.exports = CustomEngine;
