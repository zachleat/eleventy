const validUrl = require("valid-url");
const TemplatePath = require("../TemplatePath");

module.exports = function(url, pathPrefix) {
  // work with undefined
  url = url || "";

  if (
    validUrl.isUri(url) ||
    url.indexOf("http://") === 0 ||
    url.indexOf("https://") === 0
  ) {
    return url;
  }

  if (pathPrefix === undefined || typeof pathPrefix !== "string") {
    let projectConfig = require("../Config").getConfig();
    pathPrefix = projectConfig.pathPrefix;
  }

  let normUrl = TemplatePath.normalizeUrlPath(url);
  let normRootDir = TemplatePath.normalizeUrlPath("/", pathPrefix);
  let normFull = TemplatePath.normalizeUrlPath("/", pathPrefix, url);
  let isRootDirTrailingSlash =
    normRootDir.length && normRootDir.charAt(normRootDir.length - 1) === "/";

  // minor difference with straight `normalize`, "" resolves to root dir and not "."
  // minor difference with straight `normalize`, "/" resolves to root dir
  if (normUrl === "/" || normUrl === normRootDir) {
    return normRootDir + (!isRootDirTrailingSlash ? "/" : "");
  } else if (normUrl.indexOf("/") === 0) {
    return normFull;
  }

  return normUrl;
};
