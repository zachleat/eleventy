const missingModule = require("this-is-a-module-that-does-not-exist");

module.exports = function (eleventyConfig) {
  eleventyConfig.addFilter("cssmin", function (code) {
    return missingModule(code);
  });

  return {};
};
