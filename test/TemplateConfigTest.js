import test from "ava";
import md from "markdown-it";
import TemplateConfig from "../src/TemplateConfig";
import eleventyConfig from "../src/EleventyConfig";

test("Template Config local config overrides base config", async t => {
  let templateCfg = new TemplateConfig(
    require("../config.js"),
    "./test/stubs/config.js"
  );
  let cfg = templateCfg.getConfig();

  t.is(cfg.markdownTemplateEngine, "ejs");
  t.is(cfg.templateFormats.join(","), "md,njk");

  // merged, not overwritten
  t.true(Object.keys(cfg.keys).length > 1);
  t.truthy(Object.keys(cfg.handlebarsHelpers).length);
  t.truthy(Object.keys(cfg.nunjucksFilters).length);

  t.is(Object.keys(cfg.filters).length, 1);

  t.is(
    cfg.filters.prettyHtml(
      `<html><body><div></div></body></html>`,
      "test.html"
    ),
    `<html>
  <body>
    <div></div>
  </body>
</html>`
  );
});

test("Add liquid tag", t => {
  eleventyConfig.addLiquidTag("myTagName", function() {});

  let templateCfg = new TemplateConfig(
    require("../config.js"),
    "./test/stubs/config.js"
  );
  let cfg = templateCfg.getConfig();
  t.not(Object.keys(cfg.liquidTags).indexOf("myTagName"), -1);
});

test("Add nunjucks tag", t => {
  eleventyConfig.addNunjucksTag("myNunjucksTag", function() {});

  let templateCfg = new TemplateConfig(
    require("../config.js"),
    "./test/stubs/config.js"
  );
  let cfg = templateCfg.getConfig();
  t.not(Object.keys(cfg.nunjucksTags).indexOf("myNunjucksTag"), -1);
});

test("Add liquid filter", t => {
  eleventyConfig.addLiquidFilter("myFilterName", function(liquidEngine) {
    return {};
  });

  let templateCfg = new TemplateConfig(
    require("../config.js"),
    "./test/stubs/config.js"
  );
  let cfg = templateCfg.getConfig();
  t.not(Object.keys(cfg.liquidFilters).indexOf("myFilterName"), -1);
});

test("Add handlebars helper", t => {
  eleventyConfig.addHandlebarsHelper("myHelperName", function() {});

  let templateCfg = new TemplateConfig(
    require("../config.js"),
    "./test/stubs/config.js"
  );
  let cfg = templateCfg.getConfig();
  t.not(Object.keys(cfg.handlebarsHelpers).indexOf("myHelperName"), -1);
});

test("Add nunjucks filter", t => {
  eleventyConfig.addNunjucksFilter("myFilterName", function() {});

  let templateCfg = new TemplateConfig(
    require("../config.js"),
    "./test/stubs/config.js"
  );
  let cfg = templateCfg.getConfig();
  t.not(Object.keys(cfg.nunjucksFilters).indexOf("myFilterName"), -1);
});

test("Add universal filter", t => {
  eleventyConfig.addFilter("myFilterName", function() {});

  let templateCfg = new TemplateConfig(
    require("../config.js"),
    "./test/stubs/config.js"
  );
  let cfg = templateCfg.getConfig();
  t.not(Object.keys(cfg.liquidFilters).indexOf("myFilterName"), -1);
  t.not(Object.keys(cfg.handlebarsHelpers).indexOf("myFilterName"), -1);
  t.not(Object.keys(cfg.nunjucksFilters).indexOf("myFilterName"), -1);
});

test("Add namespaced universal filter", t => {
  eleventyConfig.namespace("testNamespace", function() {
    eleventyConfig.addFilter("MyFilterName", function() {});
  });

  let templateCfg = new TemplateConfig(
    require("../config.js"),
    "./test/stubs/config.js"
  );
  let cfg = templateCfg.getConfig();
  t.not(
    Object.keys(cfg.liquidFilters).indexOf("testNamespaceMyFilterName"),
    -1
  );
  t.not(
    Object.keys(cfg.handlebarsHelpers).indexOf("testNamespaceMyFilterName"),
    -1
  );
  t.not(
    Object.keys(cfg.nunjucksFilters).indexOf("testNamespaceMyFilterName"),
    -1
  );
});

test("Add namespaced universal filter using underscore", t => {
  eleventyConfig.namespace("testNamespace_", function() {
    eleventyConfig.addFilter("myFilterName", function() {});
  });

  let templateCfg = new TemplateConfig(
    require("../config.js"),
    "./test/stubs/config.js"
  );
  let cfg = templateCfg.getConfig();
  t.not(
    Object.keys(cfg.liquidFilters).indexOf("testNamespace_myFilterName"),
    -1
  );
  t.not(
    Object.keys(cfg.handlebarsHelpers).indexOf("testNamespace_myFilterName"),
    -1
  );
  t.not(
    Object.keys(cfg.nunjucksFilters).indexOf("testNamespace_myFilterName"),
    -1
  );
});

test("Test url universal filter with custom pathPrefix (no slash)", t => {
  let templateCfg = new TemplateConfig(
    require("../config.js"),
    "./test/stubs/config.js"
  );
  templateCfg.setPathPrefix("/testdirectory/");
  let cfg = templateCfg.getConfig();
  t.is(cfg.pathPrefix, "/testdirectory/");
});

test("setTemplateFormats(string)", t => {
  eleventyConfig.setTemplateFormats("ejs,njk, liquid");

  let templateCfg = new TemplateConfig(
    require("../config.js"),
    "./test/stubs/config.js"
  );
  let cfg = templateCfg.getConfig();
  t.deepEqual(cfg.templateFormats, ["ejs", "njk", "liquid"]);
});

test("setTemplateFormats(array)", t => {
  eleventyConfig.setTemplateFormats(["ejs", "njk", "liquid"]);

  let templateCfg = new TemplateConfig(
    require("../config.js"),
    "./test/stubs/config.js"
  );
  let cfg = templateCfg.getConfig();
  t.deepEqual(cfg.templateFormats, ["ejs", "njk", "liquid"]);
});

test("setTemplateFormats(array, size 1)", t => {
  eleventyConfig.setTemplateFormats(["liquid"]);

  let templateCfg = new TemplateConfig(
    require("../config.js"),
    "./test/stubs/config.js"
  );
  let cfg = templateCfg.getConfig();
  t.deepEqual(cfg.templateFormats, ["liquid"]);
});

test("setTemplateFormats(empty array)", t => {
  eleventyConfig.setTemplateFormats([]);

  let templateCfg = new TemplateConfig(
    require("../config.js"),
    "./test/stubs/config.js"
  );
  let cfg = templateCfg.getConfig();
  t.deepEqual(cfg.templateFormats, []);
});

test("libraryOverrides", t => {
  let mdLib = md();
  eleventyConfig.setLibrary("md", mdLib);

  let templateCfg = new TemplateConfig(
    require("../config.js"),
    "./test/stubs/config.js"
  );
  let cfg = templateCfg.getConfig();
  t.falsy(cfg.libraryOverrides.ldkja);
  t.falsy(cfg.libraryOverrides.njk);
  t.truthy(cfg.libraryOverrides.md);
  t.deepEqual(mdLib, cfg.libraryOverrides.md);
});
