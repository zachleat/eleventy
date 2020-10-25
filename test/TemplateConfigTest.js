const test = require("ava");
const md = require("markdown-it");
const TemplateConfig = require("../src/TemplateConfig");
const eleventyConfig = require("../src/EleventyConfig");

test.serial("Template Config local config overrides base config", async (t) => {
  let templateCfg = new TemplateConfig(
    require("../src/defaultConfig.js"),
    "./test/stubs/config.js"
  );
  await templateCfg.init();
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

test.serial("Add liquid tag", async (t) => {
  eleventyConfig.reset();
  eleventyConfig.addLiquidTag("myTagName", function () {});

  let templateCfg = new TemplateConfig(
    require("../src/defaultConfig.js"),
    "./test/stubs/config.js"
  );
  await templateCfg.init();
  let cfg = templateCfg.getConfig();
  t.not(Object.keys(cfg.liquidTags).indexOf("myTagName"), -1);
});

test.serial("Add nunjucks tag", async (t) => {
  eleventyConfig.reset();
  eleventyConfig.addNunjucksTag("myNunjucksTag", function () {});

  let templateCfg = new TemplateConfig(
    require("../src/defaultConfig.js"),
    "./test/stubs/config.js"
  );
  await templateCfg.init();
  let cfg = templateCfg.getConfig();
  t.not(Object.keys(cfg.nunjucksTags).indexOf("myNunjucksTag"), -1);
});

test.serial("Add liquid filter", async (t) => {
  eleventyConfig.reset();
  eleventyConfig.addLiquidFilter("myFilterName", function (liquidEngine) {
    return {};
  });

  let templateCfg = new TemplateConfig(
    require("../src/defaultConfig.js"),
    "./test/stubs/config.js"
  );
  await templateCfg.init();
  let cfg = templateCfg.getConfig();
  t.not(Object.keys(cfg.liquidFilters).indexOf("myFilterName"), -1);
});

test.serial("Add handlebars helper", async (t) => {
  eleventyConfig.reset();
  eleventyConfig.addHandlebarsHelper("myHelperName", function () {});

  let templateCfg = new TemplateConfig(
    require("../src/defaultConfig.js"),
    "./test/stubs/config.js"
  );
  await templateCfg.init();
  let cfg = templateCfg.getConfig();
  t.not(Object.keys(cfg.handlebarsHelpers).indexOf("myHelperName"), -1);
});

test.serial("Add nunjucks filter", async (t) => {
  eleventyConfig.reset();
  eleventyConfig.addNunjucksFilter("myFilterName", function () {});

  let templateCfg = new TemplateConfig(
    require("../src/defaultConfig.js"),
    "./test/stubs/config.js"
  );
  await templateCfg.init();
  let cfg = templateCfg.getConfig();
  t.not(Object.keys(cfg.nunjucksFilters).indexOf("myFilterName"), -1);
});

test.serial("Add universal filter", async (t) => {
  eleventyConfig.reset();
  eleventyConfig.addFilter("myFilterName", function () {});

  let templateCfg = new TemplateConfig(
    require("../src/defaultConfig.js"),
    "./test/stubs/config.js"
  );
  await templateCfg.init();
  let cfg = templateCfg.getConfig();
  t.not(Object.keys(cfg.liquidFilters).indexOf("myFilterName"), -1);
  t.not(Object.keys(cfg.handlebarsHelpers).indexOf("myFilterName"), -1);
  t.not(Object.keys(cfg.nunjucksFilters).indexOf("myFilterName"), -1);
});
test.serial("Add namespaced universal filter", async (t) => {
  eleventyConfig.reset();
  eleventyConfig.namespace("testNamespace", function () {
    eleventyConfig.addFilter("MyFilterName", function () {});
  });

  let templateCfg = new TemplateConfig(
    require("../src/defaultConfig.js"),
    "./test/stubs/config.js"
  );
  await templateCfg.init();
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

test.serial("Add namespaced universal filter using underscore", async (t) => {
  eleventyConfig.reset();
  eleventyConfig.namespace("testNamespace_", function () {
    eleventyConfig.addFilter("myFilterName", function () {});
  });

  let templateCfg = new TemplateConfig(
    require("../src/defaultConfig.js"),
    "./test/stubs/config.js"
  );
  await templateCfg.init();
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

test.serial("Empty namespace", async (t) => {
  eleventyConfig.reset();
  eleventyConfig.namespace("", function () {
    eleventyConfig.addNunjucksFilter("myFilterName", function () {});
  });

  let templateCfg = new TemplateConfig(
    require("../src/defaultConfig.js"),
    "./test/stubs/config.js"
  );
  await templateCfg.init();
  let cfg = templateCfg.getConfig();
  t.not(Object.keys(cfg.nunjucksFilters).indexOf("myFilterName"), -1);
});

test.serial("Nested Empty Inner namespace", async (t) => {
  eleventyConfig.reset();
  eleventyConfig.namespace("testNs", function () {
    eleventyConfig.namespace("", function () {
      eleventyConfig.addNunjucksFilter("myFilterName", function () {});
    });
  });

  let templateCfg = new TemplateConfig(
    require("../src/defaultConfig.js"),
    "./test/stubs/config.js"
  );
  await templateCfg.init();
  let cfg = templateCfg.getConfig();
  t.not(Object.keys(cfg.nunjucksFilters).indexOf("testNsmyFilterName"), -1);
});

test.serial("Nested Empty Outer namespace", async (t) => {
  eleventyConfig.reset();
  eleventyConfig.namespace("", function () {
    eleventyConfig.namespace("testNs", function () {
      eleventyConfig.addNunjucksFilter("myFilterName", function () {});
    });
  });

  let templateCfg = new TemplateConfig(
    require("../src/defaultConfig.js"),
    "./test/stubs/config.js"
  );
  await templateCfg.init();
  let cfg = templateCfg.getConfig();
  t.not(Object.keys(cfg.nunjucksFilters).indexOf("testNsmyFilterName"), -1);
});

// important for backwards compatibility with old
// `module.exports = function (eleventyConfig, pluginNamespace) {`
// plugin code
test.serial("Non-string namespaces are ignored", async (t) => {
  eleventyConfig.reset();
  eleventyConfig.namespace(["lkdsjflksd"], function () {
    eleventyConfig.addNunjucksFilter("myFilterName", function () {});
  });

  let templateCfg = new TemplateConfig(
    require("../src/defaultConfig.js"),
    "./test/stubs/config.js"
  );
  await templateCfg.init();
  let cfg = templateCfg.getConfig();
  t.not(Object.keys(cfg.nunjucksFilters).indexOf("myFilterName"), -1);
});

test.serial(
  ".addPlugin oddity: I don’t think pluginNamespace was ever passed in here, but we don’t want this to break",
  async (t) => {
    eleventyConfig.reset();
    eleventyConfig.addPlugin(function (eleventyConfig, pluginNamespace) {
      eleventyConfig.namespace(pluginNamespace, () => {
        eleventyConfig.addNunjucksFilter("myFilterName", function () {});
      });
    });

    let templateCfg = new TemplateConfig(
      require("../src/defaultConfig.js"),
      "./test/stubs/config.js"
    );
    await templateCfg.init();
    let cfg = templateCfg.getConfig();
    t.not(Object.keys(cfg.nunjucksFilters).indexOf("myFilterName"), -1);
  }
);

test.serial(
  "Test url universal filter with custom pathPrefix (no slash)",
  async (t) => {
    let templateCfg = new TemplateConfig(
      require("../src/defaultConfig.js"),
      "./test/stubs/config.js"
    );
    await templateCfg.init();
    templateCfg.setPathPrefix("/testdirectory/");
    let cfg = templateCfg.getConfig();
    t.is(cfg.pathPrefix, "/testdirectory/");
  }
);

test.serial("setTemplateFormats(string)", async (t) => {
  eleventyConfig.reset();
  // 0.11.0 removes dupes
  eleventyConfig.setTemplateFormats("ejs,njk, liquid, njk");

  let templateCfg = new TemplateConfig(
    require("../src/defaultConfig.js"),
    "./test/stubs/config.js"
  );
  await templateCfg.init();
  let cfg = templateCfg.getConfig();
  t.deepEqual(cfg.templateFormats, ["ejs", "njk", "liquid"]);
});

test.serial("setTemplateFormats(array)", async (t) => {
  eleventyConfig.reset();
  eleventyConfig.setTemplateFormats(["ejs", "njk", "liquid"]);

  let templateCfg = new TemplateConfig(
    require("../src/defaultConfig.js"),
    "./test/stubs/config.js"
  );
  await templateCfg.init();
  let cfg = templateCfg.getConfig();
  t.deepEqual(cfg.templateFormats, ["ejs", "njk", "liquid"]);
});

test.serial("setTemplateFormats(array, size 1)", async (t) => {
  eleventyConfig.reset();
  eleventyConfig.setTemplateFormats(["liquid"]);

  let templateCfg = new TemplateConfig(
    require("../src/defaultConfig.js"),
    "./test/stubs/config.js"
  );
  await templateCfg.init();
  let cfg = templateCfg.getConfig();
  t.deepEqual(cfg.templateFormats, ["liquid"]);
});

test.serial("setTemplateFormats(empty array)", async (t) => {
  eleventyConfig.reset();
  eleventyConfig.setTemplateFormats([]);

  let templateCfg = new TemplateConfig(
    require("../src/defaultConfig.js"),
    "./test/stubs/config.js"
  );
  await templateCfg.init();
  let cfg = templateCfg.getConfig();
  t.deepEqual(cfg.templateFormats, []);
});

test.serial("setTemplateFormats(null)", async (t) => {
  eleventyConfig.reset();
  eleventyConfig.setTemplateFormats(null);

  let templateCfg = new TemplateConfig(
    require("../src/defaultConfig.js"),
    "./test/stubs/config.js"
  );
  await templateCfg.init();
  let cfg = templateCfg.getConfig();
  t.true(cfg.templateFormats.length > 0);
});

test.serial("multiple setTemplateFormats calls", async (t) => {
  eleventyConfig.reset();
  eleventyConfig.setTemplateFormats("njk");
  eleventyConfig.setTemplateFormats("pug");

  let templateCfg = new TemplateConfig(
    require("../src/defaultConfig.js"),
    "./test/stubs/config.js"
  );

  await templateCfg.init();
  let cfg = templateCfg.getConfig();
  t.deepEqual(cfg.templateFormats, ["pug"]);
});

test.serial("addTemplateFormats()", async (t) => {
  eleventyConfig.reset();
  eleventyConfig.addTemplateFormats("vue");

  let templateCfg = new TemplateConfig(
    require("../src/defaultConfig.js"),
    "./test/stubs/config.js"
  );
  await templateCfg.init();
  let cfg = templateCfg.getConfig();
  // should have ALL of the original defaults
  t.deepEqual(cfg.templateFormats, ["md", "njk", "vue"]);
});

test.serial("both setTemplateFormats and addTemplateFormats", async (t) => {
  // Template Formats can come from three places
  // defaultConfig.js config API (not used yet)
  // defaultConfig.js config return object
  // project config file config API
  // project config file config return object

  eleventyConfig.reset();
  eleventyConfig.addTemplateFormats("vue");
  eleventyConfig.setTemplateFormats("pug");

  let templateCfg = new TemplateConfig(
    require("../src/defaultConfig.js"),
    "./test/stubs/config.js"
  );
  await templateCfg.init();
  let cfg = templateCfg.getConfig();
  t.deepEqual(cfg.templateFormats, ["pug", "vue"]);
});

test.serial("libraryOverrides", async (t) => {
  let mdLib = md();
  eleventyConfig.setLibrary("md", mdLib);

  let templateCfg = new TemplateConfig(
    require("../src/defaultConfig.js"),
    "./test/stubs/config.js"
  );
  await templateCfg.init();
  await templateCfg.init();
  let cfg = templateCfg.getConfig();
  t.falsy(cfg.libraryOverrides.ldkja);
  t.falsy(cfg.libraryOverrides.njk);
  t.truthy(cfg.libraryOverrides.md);
  t.deepEqual(mdLib, cfg.libraryOverrides.md);
});

test.serial("addGlobalData", async (t) => {
  eleventyConfig.reset();
  eleventyConfig.addGlobalData("function", () => new Date());

  let templateCfg = new TemplateConfig(
    require("../src/defaultConfig.js"),
    "./test/stubs/config.js"
  );
  await templateCfg.init();
  let cfg = templateCfg.getConfig();
  t.not(Object.keys(cfg.globalData).indexOf("function"), -1);
});

test("Properly throws error on missing module #182", async (t) => {
  await t.throwsAsync(async () => {
    const cfg = new TemplateConfig(
      require("../src/defaultConfig.js"),
      "./test/stubs/broken-config.js"
    );
    return await cfg.init();
  });
});

test("Properly throws error when config returns a Promise", async (t) => {
  await t.throwsAsync(async () => {
    new TemplateConfig(
      require("../src/defaultConfig.js"),
      "./test/stubs/config-promise.js"
    );
    return await cfg.init();
  });
});

test.serial(".addWatchTarget adds a watch target", async (t) => {
  eleventyConfig.reset();
  eleventyConfig.addWatchTarget("/testdirectory/");

  let templateCfg = new TemplateConfig(
    require("../src/defaultConfig.js"),
    "./test/stubs/config.js"
  );
  await templateCfg.init();
  let cfg = templateCfg.getConfig();
  t.deepEqual(cfg.additionalWatchTargets, ["/testdirectory/"]);
});
