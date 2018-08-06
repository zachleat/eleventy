const TemplatePath = require("./TemplatePath");
const config = require("./Config");

class EleventyExtensionMap {
  constructor(formats) {
    this.config = config.getConfig();

    this.unfilteredFormats = formats.map(function(key) {
      return key.trim().toLowerCase();
    });

    this.formats = this.unfilteredFormats.filter(
      function(key) {
        return this.hasExtension(key);
      }.bind(this)
    );

    this.prunedFormats = this.unfilteredFormats.filter(
      function(key) {
        return !this.hasExtension(key);
      }.bind(this)
    );
  }

  setConfig(configOverride) {
    this.config = configOverride || {};
  }

  getFileList(path, dir) {
    if (!path) {
      return [];
    }
    return this.formats.map(
      function(key) {
        return (dir ? dir + "/" : "") + path + "." + this.getExtension(key);
      }.bind(this)
    );
  }

  getPrunedGlobs(inputDir) {
    return this._getGlobs(this.prunedFormats, inputDir);
  }

  getGlobs(inputDir) {
    if (this.config.passthroughFileCopy) {
      return this._getGlobs(this.unfilteredFormats, inputDir);
    }

    return this._getGlobs(this.formats, inputDir);
  }

  _getGlobs(formats, inputDir) {
    return formats.map(
      function(key) {
        return (
          TemplatePath.convertToGlob(inputDir) +
          "/*." +
          (this.hasExtension(key) ? this.getExtension(key) : key)
        );
      }.bind(this)
    );
  }

  hasExtension(key) {
    return key in this.keyMapToExtension;
  }

  getExtension(key) {
    return this.keyMapToExtension[key];
  }

  get keyMapToExtension() {
    return {
      ejs: "ejs",
      md: "md",
      jstl: "jstl",
      html: "html",
      hbs: "hbs",
      mustache: "mustache",
      haml: "haml",
      pug: "pug",
      njk: "njk",
      liquid: "liquid",
      "11ty.js": "11ty.js"
    };
  }
}

module.exports = EleventyExtensionMap;
