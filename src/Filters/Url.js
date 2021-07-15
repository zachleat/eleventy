const validUrl = require("valid-url");
const TemplatePath = require("../TemplatePath");

// This is also used in the Eleventy Navigation plugin
module.exports = function (url, pathPrefix) {
  // work with undefined
  url = url || "";

  if (
    validUrl.isUri(url) ||
    url.indexOf("http://") === 0 ||
    url.indexOf("https://") === 0 ||
    (url.indexOf("//") === 0 && url !== "//")
  ) {
    return url;
  }

  if (pathPrefix === undefined || typeof pathPrefix !== "string") {
    // When you retrieve this with config.getFilter("url") it
    // grabs the pathPrefix argument from your config for you.
    throw new Error("pathPrefix (String) is required in the `url` filter.");
  }

  let normUrl = TemplatePath.normalizeUrlPath(url);

  if (pathPrefix.startsWith("https://") || pathPrefix.startsWith("http://")) {
    // if pathPrefix is an absolute URL, normalize a trailing slash and resolve
    // with url. Standard path normalization can't be used here as it doesn't
    // comprehend URLs
    let isUrlLeadingSlash = normUrl.startsWith("/");
    let isPathPrefixTrailingSlash = pathPrefix.endsWith("/");
    if (isUrlLeadingSlash && isPathPrefixTrailingSlash) {
      // remove leading slash from url to join with trailing slash of pathPrefix
      return `${pathPrefix}${normUrl.slice(1)}`;
    }
    if (!isUrlLeadingSlash && !isPathPrefixTrailingSlash) {
      // add joining slash to normalize
      return `${pathPrefix}/${normUrl}`;
    }
    return `${pathPrefix}${normUrl}`;
  }

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
