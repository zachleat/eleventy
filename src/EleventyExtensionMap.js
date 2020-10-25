const TemplateEngineManager = require("./TemplateEngineManager");
const TemplatePath = require("./TemplatePath");

class EleventyExtensionMap {
  constructor(formatKeys, templateConfig) {
    this.formatKeys = formatKeys;
    this.config = templateConfig.getConfig();
    this.templateConfig = templateConfig;
    this.setFormats(formatKeys);
  }

  setFormats(formatKeys = []) {
    this.unfilteredFormatKeys = formatKeys.map(function (key) {
      return key.trim().toLowerCase();
    });

    this.validTemplateLanguageKeys = this.unfilteredFormatKeys.filter((key) =>
      this.hasExtension(key)
    );

    this.passthroughCopyKeys = this.unfilteredFormatKeys.filter(
      (key) => !this.hasExtension(key)
    );
  }

  get config() {
    return this.configOverride || this.config;
  }
  set config(cfg) {
    this.configOverride = cfg;
  }

  get engineManager() {
    if (!this._engineManager) {
      this._engineManager = new TemplateEngineManager(this.templateConfig);
      this._engineManager.config = this.config;
    }

    return this._engineManager;
  }

  /* Used for layout path resolution */
  getFileList(path, dir) {
    if (!path) {
      return [];
    }

    let files = [];
    this.validTemplateLanguageKeys.forEach(
      function (key) {
        this.getExtensionsFromKey(key).forEach(function (extension) {
          files.push((dir ? dir + "/" : "") + path + "." + extension);
        });
      }.bind(this)
    );

    return files;
  }

  isFullTemplateFilename(path) {
    for (let extension of this.validTemplateLanguageKeys) {
      if (path.endsWith(`.${extension}`)) {
        return true;
      }
    }
    return false;
  }

  getPassthroughCopyGlobs(inputDir) {
    return this._getGlobs(this.passthroughCopyKeys, inputDir);
  }

  getValidGlobs(inputDir) {
    return this._getGlobs(this.validTemplateLanguageKeys, inputDir);
  }

  getGlobs(inputDir) {
    if (this.config.passthroughFileCopy) {
      return this._getGlobs(this.unfilteredFormatKeys, inputDir);
    }

    return this._getGlobs(this.validTemplateLanguageKeys, inputDir);
  }

  _getGlobs(formatKeys, inputDir) {
    let dir = TemplatePath.convertToRecursiveGlobSync(inputDir);
    let globs = [];
    formatKeys.forEach(
      function (key) {
        if (this.hasExtension(key)) {
          this.getExtensionsFromKey(key).forEach(function (extension) {
            globs.push(dir + "/*." + extension);
          });
        } else {
          globs.push(dir + "/*." + key);
        }
      }.bind(this)
    );
    return globs;
  }

  hasExtension(key) {
    for (var extension in this.extensionToKeyMap) {
      if (this.extensionToKeyMap[extension] === key) {
        return true;
      }
    }
    return false;
  }

  getExtensionsFromKey(key) {
    let extensions = [];
    for (var extension in this.extensionToKeyMap) {
      if (this.extensionToKeyMap[extension] === key) {
        extensions.push(extension);
      }
    }
    return extensions;
  }

  hasEngine(pathOrKey) {
    return !!this.getKey(pathOrKey);
  }

  getKey(pathOrKey) {
    pathOrKey = (pathOrKey || "").toLowerCase();

    for (var extension in this.extensionToKeyMap) {
      let key = this.extensionToKeyMap[extension];
      if (pathOrKey === extension) {
        return key;
      } else if (pathOrKey.endsWith("." + extension)) {
        return key;
      }
    }
  }

  removeTemplateExtension(path) {
    for (var extension in this.extensionToKeyMap) {
      if (path === extension || path.endsWith("." + extension)) {
        return path.substr(0, path.length - 1 - extension.length);
      }
    }
    return path;
  }

  // keys are file extensions
  // values are template language keys
  get extensionToKeyMap() {
    if (!this._extensionToKeyMap) {
      this._extensionToKeyMap = {
        ejs: "ejs",
        md: "md",
        html: "html",
        hbs: "hbs",
        mustache: "mustache",
        haml: "haml",
        pug: "pug",
        njk: "njk",
        liquid: "liquid",
        "11ty.js": "11ty.js",
        "11ty.cjs": "11ty.js",
      };

      if ("extensionMap" in this.config) {
        for (let entry of this.config.extensionMap) {
          this._extensionToKeyMap[entry.extension] = entry.key;
        }
      }
    }

    return this._extensionToKeyMap;
  }
}

module.exports = EleventyExtensionMap;
