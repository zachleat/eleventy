const urlFilter = require("./src/Filters/Url");
const slugFilter = require("./src/Filters/Slug");

module.exports = function(config) {
  config.addFilter("slug", slugFilter);
  config.addFilter("url", urlFilter);

  return {
    templateFormats: [
      "liquid",
      "ejs",
      "md",
      "hbs",
      "mustache",
      "haml",
      "pug",
      "njk",
      "html",
      "jstl"
    ],
    // if your site lives in a subdirectory, change this
    pathPrefix: "/",
    markdownTemplateEngine: "liquid",
    htmlTemplateEngine: "liquid",
    dataTemplateEngine: "liquid",
    passthroughFileCopy: true,
    htmlOutputSuffix: "-o",
    keys: {
      package: "pkg",
      layout: "layout",
      permalink: "permalink",
      permalinkRoot: "permalinkBypassOutputDir",
      engineOverride: "templateEngineOverride"
    },
    dir: {
      input: ".",
      includes: "_includes",
      data: "_data",
      output: "_site"
    },
    // deprecated, use config.addTransform
    filters: {},
    // deprecated, use config.addHandlebarsHelper
    handlebarsHelpers: {},
    // deprecated, use config.addNunjucksFilter
    nunjucksFilters: {}
  };
};
