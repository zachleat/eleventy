const EleventyBaseError = require("./EleventyBaseError");
class TemplateEngineManagerConfigError extends EleventyBaseError {}

class TemplateEngineManager {
  constructor(config) {
    if (!config) {
      throw new TemplateEngineManagerConfigError("Missing `config` argument.");
    }
    this.config = config;

    this.engineCache = {};
  }

  get keyToClassNameMap() {
    if (!this._keyToClassNameMap) {
      this._keyToClassNameMap = {
        ejs: "Ejs",
        md: "Markdown",
        html: "Html",
        hbs: "Handlebars",
        mustache: "Mustache",
        haml: "Haml",
        pug: "Pug",
        njk: "Nunjucks",
        liquid: "Liquid",
        "11ty.js": "JavaScript",
      };

      if ("extensionMap" in this.config) {
        for (let entry of this.config.extensionMap) {
          this._keyToClassNameMap[entry.key] = "Custom";
        }
      }
    }
    return this._keyToClassNameMap;
  }

  reset() {
    this.engineCache = {};
  }

  getClassNameFromTemplateKey(key) {
    let keys = this.keyToClassNameMap;

    return keys[key];
  }

  hasEngine(name) {
    return !!this.getClassNameFromTemplateKey(name);
  }

  getEngineClassByExtension(extension) {
    // We include these as raw strings (and not more readable variables) so they’re parsed by the bundler.
    if (extension === "ejs") {
      return require("./Engines/Ejs");
    } else if (extension === "md") {
      return require("./Engines/Markdown");
    } else if (extension === "html") {
      return require("./Engines/Html");
    } else if (extension === "hbs") {
      return require("./Engines/Handlebars");
    } else if (extension === "mustache") {
      return require("./Engines/Mustache");
    } else if (extension === "haml") {
      return require("./Engines/Haml");
    } else if (extension === "pug") {
      return require("./Engines/Pug");
    } else if (extension === "njk") {
      return require("./Engines/Nunjucks");
    } else if (extension === "liquid") {
      return require("./Engines/Liquid");
    } else if (extension === "11ty.js") {
      return require("./Engines/JavaScript");
    } else {
      return require("./Engines/Custom");
    }
  }

  getEngine(name, includesDir, extensionMap) {
    if (!this.hasEngine(name)) {
      throw new Error(
        `Template Engine ${name} does not exist in getEngine (includes dir: ${includesDir})`
      );
    }

    if (this.engineCache[name]) {
      return this.engineCache[name];
    }

    let cls = this.getEngineClassByExtension(name);

    let instance = new cls(name, includesDir, this.config);
    instance.extensionMap = extensionMap;
    instance.engineManager = this;

    // If the user providers a "Custom" engine using addExtension,
    // But that engine's instance is *not* custom,
    // The user must be overriding an existing engine
    // i.e. addExtension('md', { ...overrideBehavior })
    if (
      this.getClassNameFromTemplateKey(name) === "Custom" &&
      instance.constructor.name !== "CustomEngine"
    ) {
      const CustomEngine = require("./Engines/Custom");
      const overrideCustomEngine = new CustomEngine(
        name,
        includesDir,
        this.config
      );
      // Keep track of the "default" engine 11ty would normally use
      // This allows the user to access the default engine in their override
      overrideCustomEngine.setDefaultEngine(instance);
      instance = overrideCustomEngine;
    }

    // Make sure cache key is based on name and not path
    // Custom class is used for all plugins, cache once per plugin
    this.engineCache[name] = instance;
    return instance;
  }
}

module.exports = TemplateEngineManager;
