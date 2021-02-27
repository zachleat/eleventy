const parsePath = require("parse-filepath");
const TemplatePath = require("./TemplatePath");

function TemplatePermalink(link, extraSubdir) {
  this.link = this._cleanLink(link);
  this.extraSubdir = extraSubdir || "";
}

TemplatePermalink.prototype._cleanLink = function (link) {
  return link + (link.substr(-1) === "/" ? "index.html" : "");
};

TemplatePermalink.prototype.resolve = function () {
  let parsed = parsePath(this.link);

  return TemplatePath.join(parsed.dir, this.extraSubdir, parsed.base);
};

TemplatePermalink.prototype.toString = function () {
  return this.resolve();
};

// remove all index.html’s from links
// index.html becomes /
// test/index.html becomes test/
TemplatePermalink.prototype.toHref = function () {
  let str = this.toString();
  let original = (str.charAt(0) !== "/" ? "/" : "") + this.toString();
  let needle = "/index.html";
  if (original === needle) {
    return "/";
  } else if (original.substr(-1 * needle.length) === needle) {
    return original.substr(0, original.length - needle.length) + "/";
  }
  return original;
};

TemplatePermalink._hasDuplicateFolder = function (dir, base) {
  let folders = dir.split("/");
  if (!folders[folders.length - 1]) {
    folders.pop();
  }
  return folders[folders.length - 1] === base;
};

TemplatePermalink.generate = function (
  dir,
  filenameNoExt,
  extraSubdir,
  suffix,
  fileExtension = "html"
) {
  let hasDupeFolder = TemplatePermalink._hasDuplicateFolder(dir, filenameNoExt);
  let path;
  if (fileExtension === "html") {
    path =
      (dir ? dir + "/" : "") +
      (filenameNoExt !== "index" && !hasDupeFolder ? filenameNoExt + "/" : "") +
      "index" +
      (suffix || "") +
      ".html";
  } else {
    path =
      (dir ? dir + "/" : "") +
      filenameNoExt +
      (suffix || "") +
      "." +
      fileExtension;
  }

  return new TemplatePermalink(path, extraSubdir);
};

module.exports = TemplatePermalink;
