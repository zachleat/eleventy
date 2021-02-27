const path = require("path");
const normalize = require("normalize-path");
const parsePath = require("parse-filepath");
const fs = require("fs");

function TemplatePath() {}

/**
 * @returns {String} the absolute path to Eleventy’s project directory.
 */
TemplatePath.getWorkingDir = function () {
  return TemplatePath.normalize(path.resolve("."));
};

/**
 * Returns the directory portion of a path.
 * Works for directory and file paths and paths ending in a glob pattern.
 *
 * @param {String} path A path
 * @returns {String} the directory portion of a path.
 */
TemplatePath.getDir = function (path) {
  if (TemplatePath.isDirectorySync(path)) {
    return path;
  }

  return TemplatePath.getDirFromFilePath(path);
};

/**
 * Returns the directory portion of a path that either points to a file
 * or ends in a glob pattern. If `path` points to a directory,
 * the returned value will have its last path segment stripped
 * due to how [`parsePath`][1] works.
 *
 * [1]: https://www.npmjs.com/package/parse-filepath
 *
 * @param {String} path A path
 * @returns {String} the directory portion of a path.
 */
TemplatePath.getDirFromFilePath = function (path) {
  return parsePath(path).dir || ".";
};

/**
 * Returns the last path segment in a path (no leading/trailing slashes).
 *
 * Assumes [`parsePath`][1] was called on `path` before.
 *
 * [1]: https://www.npmjs.com/package/parse-filepath
 *
 * @param {String} path A path
 * @returns {String} the last path segment in a path
 */
TemplatePath.getLastPathSegment = function (path) {
  if (!path.includes("/")) {
    return path;
  }

  // Trim a trailing slash if there is one
  path = path.replace(/\/$/, "");

  return path.substr(path.lastIndexOf("/") + 1);
};

/**
 * @param {String} path A path
 * @returns {String[]} an array of paths pointing to each path segment of the
 * provided `path`.
 */
TemplatePath.getAllDirs = function (path) {
  // Trim a trailing slash if there is one
  path = path.replace(/\/$/, "");

  if (!path.includes("/")) {
    return [path];
  }

  return path
    .split("/")
    .map((segment, index, array) => array.slice(0, index + 1).join("/"))
    .filter(path => path !== ".")
    .reverse();
};

/**
 * Normalizes a path, resolving single-dot and double-dot segments.
 *
 * Node.js’ [`path.normalize`][1] is called to strip a possible leading `"./"` segment.
 *
 * [1]: https://nodejs.org/api/path.html#path_path_normalize_path
 *
 * @param {String} thePath The path that should be normalized.
 * @returns {String} the normalized path.
 */
TemplatePath.normalize = function (thePath) {
  return normalize(path.normalize(thePath));
};

/**
 * Joins all given path segments together.
 *
 * It uses Node.js’ [`path.join`][1] method and the [normalize-path][2] package.
 *
 * [1]: https://nodejs.org/api/path.html#path_path_join_paths
 * [2]: https://www.npmjs.com/package/normalize-path
 *
 * @param {String[]} paths An arbitrary amount of path segments.
 * @returns {String} the normalized and joined path.
 */
TemplatePath.join = function (...paths) {
  return normalize(path.join(...paths));
};

/**
 * Joins the given URL path segments and normalizes the resulting path.
 * Maintains traling a single trailing slash if the last URL path argument
 * had atleast one.
 *
 * @param {String[]} urlPaths
 * @returns {String} a normalized URL path described by the given URL path segments.
 */
TemplatePath.normalizeUrlPath = function (...urlPaths) {
  const urlPath = path.posix.join(...urlPaths);
  return urlPath.replace(/\/+$/, "/");
};

/**
 * Joins the given path segments. Since the first path is absolute,
 * the resulting path will be absolute as well.
 *
 * @param {String[]} paths
 * @returns {String} the absolute path described by the given path segments.
 */
TemplatePath.absolutePath = function (...paths) {
  return TemplatePath.join(TemplatePath.getWorkingDir(), ...paths);
};

/**
 * Turns an absolute path into a path relative Eleventy’s project directory.
 *
 * @param {String} absolutePath
 * @returns {String} the relative path.
 */
TemplatePath.relativePath = function (absolutePath) {
  return TemplatePath.stripLeadingSubPath(
    absolutePath,
    TemplatePath.getWorkingDir()
  );
};

/**
 * Adds a leading dot-slash segment to each path in the `paths` array.
 *
 * @param {String[]} paths
 * @returns {String[]}
 */
TemplatePath.addLeadingDotSlashArray = function (paths) {
  return paths.map(path => TemplatePath.addLeadingDotSlash(path));
};

/**
 * Adds a leading dot-slash segment to `path`.
 *
 * @param {String} path
 * @returns {String}
 */
TemplatePath.addLeadingDotSlash = function (path) {
  if (path === "." || path === "..") {
    return path + "/";
  }

  if (path.startsWith("/") || path.startsWith("./") || path.startsWith("../")) {
    return path;
  }

  return "./" + path;
};

/**
 * Removes a leading dot-slash segment.
 *
 * @param {String} path
 * @returns {String} the `path` without a leading dot-slash segment.
 */
TemplatePath.stripLeadingDotSlash = function (path) {
  return typeof path === "string" ? path.replace(/^\.\//, "") : path;
};

/**
 * Determines whether a path starts with a given sub path.
 *
 * @param {String} path A path
 * @param {String} subPath A path
 * @returns {Boolean} whether `path` starts with `subPath`.
 */
TemplatePath.startsWithSubPath = function (path, subPath) {
  path = TemplatePath.normalize(path);
  subPath = TemplatePath.normalize(subPath);

  return path.startsWith(subPath);
};

/**
 * Removes the `subPath` at the start of `path` if present
 * and returns the remainding path.
 *
 * @param {String} path A path
 * @param {String} subPath A path
 * @returns {String} the `path` without `subPath` at the start of it.
 */
TemplatePath.stripLeadingSubPath = function (path, subPath) {
  path = TemplatePath.normalize(path);
  subPath = TemplatePath.normalize(subPath);

  if (subPath !== "." && path.startsWith(subPath)) {
    return path.substr(subPath.length + 1);
  }

  return path;
};

/**
 * @param {String} path A path
 * @returns {Boolean} whether `path` points to an existing directory.
 */
TemplatePath.isDirectorySync = function (path) {
  return fs.existsSync(path) && fs.statSync(path).isDirectory();
};

/**
 * @param {String} path A path
 * @returns {Boolean} whether `path` points to an existing directory.
 */
TemplatePath.isDirectory = async function (path) {
  return new Promise(resolve => {
    fs.stat(path, (err, stats) => {
      if (stats) {
        resolve(stats.isDirectory());
      }
      resolve(false);
    });
  });
};

/**
 * @param {String} path A path
 * @returns {Boolean} whether `path` points to a existing directory or file.
 */
TemplatePath.exists = async function (path) {
  return new Promise(resolve => {
    fs.stat(path, (err, stats) => {
      if (stats) {
        resolve(true);
      }
      resolve(false);
    });
  });
};

/**
 * Appends a recursive wildcard glob pattern to `path`
 * unless `path` is not a directory; then, `path` is assumed to be a file path
 * and is left unchaged.
 *
 * @param {String} path
 * @returns {String}
 */
TemplatePath.convertToRecursiveGlobSync = function (path) {
  if (path === "") {
    return "./**";
  }

  path = TemplatePath.addLeadingDotSlash(path);

  if (TemplatePath.isDirectorySync(path)) {
    return path + (!path.endsWith("/") ? "/" : "") + "**";
  }

  return path;
};

/**
 * Appends a recursive wildcard glob pattern to `path`
 * unless `path` is not a directory; then, `path` is assumed to be a file path
 * and is left unchaged.
 *
 * @param {String} path
 * @returns {String}
 */
TemplatePath.convertToRecursiveGlob = async function (path) {
  if (path === "") {
    return "./**";
  }

  path = TemplatePath.addLeadingDotSlash(path);

  if (await TemplatePath.isDirectory(path)) {
    return path + (!path.endsWith("/") ? "/" : "") + "**";
  }

  return path;
};

/**
 * Returns the extension of the path without the leading dot.
 * If the path has no extensions, the empty string is returned.
 *
 * @param {String} thePath
 * @returns {String} the path’s extension if it exists;
 * otherwise, the empty string.
 */
TemplatePath.getExtension = function (thePath) {
  return path.extname(thePath).replace(/^\./, "");
};

/**
 * Removes the extension from a path.
 *
 * @param {String} path
 * @param {String} extension
 * @returns {String}
 */
TemplatePath.removeExtension = function (path, extension = undefined) {
  if (extension === undefined) {
    return path;
  }

  const pathExtension = TemplatePath.getExtension(path);
  if (pathExtension !== "" && extension.endsWith(pathExtension)) {
    return path.substring(0, path.lastIndexOf(pathExtension) - 1);
  }

  return path;
};

module.exports = TemplatePath;
