const TemplatePath = require("./TemplatePath");

class TemplateGlob {
  static normalizePath(...paths) {
    if (paths[0].charAt(0) === "!") {
      throw new Error(
        `TemplateGlob.normalizePath does not accept ! glob paths like: ${paths.join(
          ""
        )}`
      );
    }
    return TemplatePath.addLeadingDotSlash(TemplatePath.join(...paths));
  }

  static normalize(path) {
    path = path.trim();
    if (path.charAt(0) === "!") {
      return "!" + TemplateGlob.normalizePath(path.substr(1));
    } else {
      return TemplateGlob.normalizePath(path);
    }
  }

  static map(files) {
    if (typeof files === "string") {
      return TemplateGlob.normalize(files);
    } else if (Array.isArray(files)) {
      return files.map(function (path) {
        return TemplateGlob.normalize(path);
      });
    } else {
      return files;
    }
  }
}

module.exports = TemplateGlob;
