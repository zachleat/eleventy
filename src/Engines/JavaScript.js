const TemplateEngine = require("./TemplateEngine");
const TemplatePath = require("../TemplatePath");
const EleventyBaseError = require("../EleventyBaseError");
const deleteRequireCache = require("../Util/DeleteRequireCache");
const getJavaScriptData = require("../Util/GetJavaScriptData");

class JavaScriptTemplateNotDefined extends EleventyBaseError {}

class JavaScript extends TemplateEngine {
  constructor(name, includesDir, config) {
    super(name, includesDir, config);
    this.instances = {};
  }

  normalize(result) {
    if (Buffer.isBuffer(result)) {
      return result.toString();
    }

    return result;
  }

  // String, Buffer, Promise
  // Function, Class
  // Object
  _getInstance(mod) {
    let noop = function () {
      return "";
    };

    if (typeof mod === "string" || mod instanceof Buffer || mod.then) {
      return { render: () => mod };
    } else if (typeof mod === "function") {
      if (
        mod.prototype &&
        ("data" in mod.prototype || "render" in mod.prototype)
      ) {
        if (!("render" in mod.prototype)) {
          mod.prototype.render = noop;
        }
        return new mod();
      } else {
        return { render: mod };
      }
    } else if ("data" in mod || "render" in mod) {
      if (!("render" in mod)) {
        mod.render = noop;
      }
      return mod;
    }
  }

  getInstanceFromInputPath(inputPath) {
    if (this.instances[inputPath]) {
      return this.instances[inputPath];
    }

    const mod = this._getRequire(inputPath);
    let inst = this._getInstance(mod);

    if (inst) {
      this.instances[inputPath] = inst;
    } else {
      throw new JavaScriptTemplateNotDefined(
        `No JavaScript template returned from ${inputPath} (did you assign to module.exports?)`
      );
    }
    return inst;
  }

  _getRequire(inputPath) {
    let requirePath = TemplatePath.absolutePath(inputPath);
    return require(requirePath);
  }

  /**
   * JavaScript files defer to the module loader rather than read the files to strings
   *
   * @override
   */
  needsToReadFileContents() {
    return false;
  }

  // only remove from cache once on startup (if it already exists)
  initRequireCache(inputPath) {
    let requirePath = TemplatePath.absolutePath(inputPath);
    if (requirePath) {
      deleteRequireCache(requirePath);
    }

    if (inputPath in this.instances) {
      delete this.instances[inputPath];
    }
  }

  async getExtraDataFromFile(inputPath) {
    let inst = this.getInstanceFromInputPath(inputPath);
    return await getJavaScriptData(inst, inputPath);
  }

  getJavaScriptFunctions(inst) {
    let fns = {};
    let configFns = this.config.javascriptFunctions;

    for (let key in configFns) {
      // prefer pre-existing `page` javascriptFunction, if one exists
      if (key === "page") {
        // do nothing
      } else {
        fns[key] = configFns[key].bind(inst);
      }
    }
    return fns;
  }

  async compile(str, inputPath) {
    let inst;
    if (str) {
      // When str has a value, it's being used for permalinks in data
      inst = this._getInstance(str);
    } else {
      // For normal templates, str will be falsy.
      inst = this.getInstanceFromInputPath(inputPath);
    }
    if (inst && "render" in inst) {
      return function (data) {
        // only blow away existing inst.page if it has a page.url
        if (!inst.page || inst.page.url) {
          inst.page = data.page;
        }
        Object.assign(inst, this.getJavaScriptFunctions(inst));

        return this.normalize(inst.render.call(inst, data));
      }.bind(this);
    }
  }
}

module.exports = JavaScript;
