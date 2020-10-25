const test = require("ava");
const fs = require("fs-extra");
const rimraf = require("rimraf");
const fastglob = require("fast-glob");
const parsePath = require("parse-filepath");
const EleventyFiles = require("../src/EleventyFiles");
const EleventyExtensionMap = require("../src/EleventyExtensionMap");
const TemplateWriter = require("../src/TemplateWriter");
// Not sure why but this import up `ava` and _createTemplate 👀
// import Template from "../src/Template";
const eleventyConfig = require("../src/EleventyConfig");
const normalizeNewLines = require("./Util/normalizeNewLines");
const templateConfig = require("../src/Config");

test.before(async () => {
  // This runs concurrently with the above
  await templateConfig.init();
});

// TODO make sure if output is a subdir of input dir that they don’t conflict.
test("Output is a subdir of input", async (t) => {
  let tw = new TemplateWriter(
    "./test/stubs/writeTest",
    "./test/stubs/writeTest/_writeTestSite",
    [],
    null,
    null,
    templateConfig
  );
  let evf = new EleventyFiles(
    "./test/stubs/writeTest",
    "./test/stubs/writeTest/_writeTestSite",
    ["ejs", "md"],
    null,
    templateConfig
  );
  evf.init();
  tw.setEleventyFiles(evf);

  let files = await fastglob(evf.getFileGlobs());
  t.is(evf.getRawFiles().length, 2);
  t.true(files.length > 0);

  let tmpl = tw._createTemplate(files[0]);
  t.is(tmpl.inputDir, "./test/stubs/writeTest");
  t.is(
    await tmpl.getOutputPath(),
    "./test/stubs/writeTest/_writeTestSite/test/index.html"
  );
});

test("_createTemplateMap", async (t) => {
  let tw = new TemplateWriter(
    "./test/stubs/writeTest",
    "./test/stubs/_writeTestSite",
    ["ejs", "md"],
    null,
    null,
    templateConfig
  );

  let paths = await tw._getAllPaths();
  t.true(paths.length > 0);
  t.is(paths[0], "./test/stubs/writeTest/test.md");

  let templateMap = await tw._createTemplateMap(paths);
  let map = templateMap.getMap();
  t.true(map.length > 0);
  t.truthy(map[0].template);
  t.truthy(map[0].data);
});

test("_createTemplateMap (no leading dot slash)", async (t) => {
  let tw = new TemplateWriter(
    "test/stubs/writeTest",
    "test/stubs/_writeTestSite",
    ["ejs", "md"],
    null,
    null,
    templateConfig
  );

  let paths = await tw._getAllPaths();
  t.true(paths.length > 0);
  t.is(paths[0], "./test/stubs/writeTest/test.md");
});

test("_testGetCollectionsData", async (t) => {
  let tw = new TemplateWriter(
    "./test/stubs/collection",
    "./test/stubs/_site",
    ["md"],
    null,
    null,
    templateConfig
  );

  let paths = await tw._getAllPaths();
  let templateMap = await tw._createTemplateMap(paths);
  let collectionsData = await templateMap._testGetCollectionsData();
  t.is(collectionsData.post.length, 2);
  t.is(collectionsData.cat.length, 2);
  t.is(collectionsData.dog.length, 1);
});

// TODO remove this (used by other test things)
test("_testGetAllTags", async (t) => {
  let tw = new TemplateWriter(
    "./test/stubs/collection",
    "./test/stubs/_site",
    ["md"],
    null,
    null,
    templateConfig
  );

  let paths = await tw._getAllPaths();
  let templateMap = await tw._createTemplateMap(paths);
  let tags = templateMap._testGetAllTags();

  t.deepEqual(tags.sort(), ["cat", "dog", "post"].sort());
});

test("Collection of files sorted by date", async (t) => {
  let tw = new TemplateWriter(
    "./test/stubs/dates",
    "./test/stubs/_site",
    ["md"],
    null,
    null,
    templateConfig
  );

  let paths = await tw._getAllPaths();
  let templateMap = await tw._createTemplateMap(paths);
  let collectionsData = await templateMap._testGetCollectionsData();
  t.is(collectionsData.dateTestTag.length, 6);
});

test("__testGetCollectionsData with custom collection (ascending)", async (t) => {
  let tw = new TemplateWriter(
    "./test/stubs/collection2",
    "./test/stubs/_site",
    ["md"],
    null,
    null,
    templateConfig
  );

  /* Careful here, eleventyConfig is a global */
  eleventyConfig.addCollection("customPostsAsc", function (collection) {
    return collection.getFilteredByTag("post").sort(function (a, b) {
      return a.date - b.date;
    });
  });

  let paths = await tw._getAllPaths();
  let templateMap = await tw._createTemplateMap(paths);
  let collectionsData = await templateMap._testGetCollectionsData();
  t.is(collectionsData.customPostsAsc.length, 2);
  t.is(parsePath(collectionsData.customPostsAsc[0].inputPath).base, "test1.md");
  t.is(parsePath(collectionsData.customPostsAsc[1].inputPath).base, "test2.md");
});

test("__testGetCollectionsData with custom collection (descending)", async (t) => {
  let tw = new TemplateWriter(
    "./test/stubs/collection2",
    "./test/stubs/_site",
    ["md"],
    null,
    null,
    templateConfig
  );

  /* Careful here, eleventyConfig is a global */
  eleventyConfig.addCollection("customPosts", function (collection) {
    return collection.getFilteredByTag("post").sort(function (a, b) {
      return b.date - a.date;
    });
  });

  let paths = await tw._getAllPaths();
  let templateMap = await tw._createTemplateMap(paths);
  let collectionsData = await templateMap._testGetCollectionsData();
  t.is(collectionsData.customPosts.length, 2);
  t.is(parsePath(collectionsData.customPosts[0].inputPath).base, "test2.md");
  t.is(parsePath(collectionsData.customPosts[1].inputPath).base, "test1.md");
});

test("__testGetCollectionsData with custom collection (filter only to markdown input)", async (t) => {
  let tw = new TemplateWriter(
    "./test/stubs/collection2",
    "./test/stubs/_site",
    ["md"],
    null,
    null,
    templateConfig
  );

  /* Careful here, eleventyConfig is a global */
  eleventyConfig.addCollection("onlyMarkdown", function (collection) {
    return collection.getAllSorted().filter(function (item) {
      let extension = item.inputPath.split(".").pop();
      return extension === "md";
    });
  });

  let paths = await tw._getAllPaths();
  let templateMap = await tw._createTemplateMap(paths);
  let collectionsData = await templateMap._testGetCollectionsData();
  t.is(collectionsData.onlyMarkdown.length, 2);
  t.is(parsePath(collectionsData.onlyMarkdown[0].inputPath).base, "test1.md");
  t.is(parsePath(collectionsData.onlyMarkdown[1].inputPath).base, "test2.md");
});

test("Pagination with a Collection", async (t) => {
  let tw = new TemplateWriter(
    "./test/stubs/paged/collection",
    "./test/stubs/_site",
    ["njk"],
    null,
    null,
    templateConfig
  );

  let paths = await tw._getAllPaths();
  let templateMap = await tw._createTemplateMap(paths);

  let collectionsData = await templateMap._testGetCollectionsData();
  t.is(collectionsData.tag1.length, 3);
  t.is(collectionsData.pagingtag.length, 1);

  let mapEntry = templateMap.getMapEntryForInputPath(
    "./test/stubs/paged/collection/main.njk"
  );
  t.truthy(mapEntry);
  t.is(mapEntry.inputPath, "./test/stubs/paged/collection/main.njk");
  t.is(mapEntry._pages.length, 2);
  t.is(mapEntry._pages[0].outputPath, "./test/stubs/_site/main/index.html");
  t.is(mapEntry._pages[1].outputPath, "./test/stubs/_site/main/1/index.html");

  t.is(
    mapEntry._pages[0].templateContent.trim(),
    "<ol><li>/test1/</li><li>/test2/</li></ol>"
  );
  t.is(mapEntry._pages[1].templateContent.trim(), "<ol><li>/test3/</li></ol>");
});

test("Pagination with a Collection from another Paged Template", async (t) => {
  let tw = new TemplateWriter(
    "./test/stubs/paged/cfg-collection-tag-cfg-collection",
    "./test/stubs/_site",
    ["njk"],
    null,
    null,
    templateConfig
  );

  let paths = await tw._getAllPaths();
  let templateMap = await tw._createTemplateMap(paths);

  let collectionsData = await templateMap._testGetCollectionsData();
  t.is(collectionsData.tag1.length, 3);
  t.is(collectionsData.pagingtag.length, 2);

  let map1 = templateMap.getMapEntryForInputPath(
    "./test/stubs/paged/cfg-collection-tag-cfg-collection/paged-main.njk"
  );
  t.is(
    map1._pages[0].templateContent.trim(),
    "<ol><li>/test1/</li><li>/test2/</li></ol>"
  );
  t.is(map1._pages[1].templateContent.trim(), "<ol><li>/test3/</li></ol>");

  let map2 = templateMap.getMapEntryForInputPath(
    "./test/stubs/paged/cfg-collection-tag-cfg-collection/paged-downstream.njk"
  );
  t.is(map2._pages[0].templateContent.trim(), "<ol><li>/paged-main/</li></ol>");
  t.is(
    map2._pages[1].templateContent.trim(),
    "<ol><li>/paged-main/1/</li></ol>"
  );
});

test("Pagination with a Collection (apply all pages to collections)", async (t) => {
  let tw = new TemplateWriter(
    "./test/stubs/paged/collection-apply-to-all",
    "./test/stubs/_site",
    ["njk"],
    null,
    null,
    templateConfig
  );

  let paths = await tw._getAllPaths();
  let templateMap = await tw._createTemplateMap(paths);

  let collectionsData = await templateMap._testGetCollectionsData();
  t.is(collectionsData.tag1.length, 3);
  t.is(collectionsData.pagingtag.length, 2);

  let mapEntry = templateMap.getMapEntryForInputPath(
    "./test/stubs/paged/collection-apply-to-all/main.njk"
  );
  t.truthy(mapEntry);
  t.is(
    mapEntry.inputPath,
    "./test/stubs/paged/collection-apply-to-all/main.njk"
  );

  let mainTmpl = tw._createTemplate(
    "./test/stubs/paged/collection-apply-to-all/main.njk"
  );
  let outputPath = await mainTmpl.getOutputPath();
  t.is(outputPath, "./test/stubs/_site/main/index.html");
  t.is(mapEntry.outputPath, "./test/stubs/_site/main/index.html");

  let templates = await mapEntry.template.getRenderedTemplates(mapEntry.data);
  t.is(templates.length, 2);
  t.is(
    await templates[0].template.getOutputPath(),
    "./test/stubs/_site/main/index.html"
  );
  t.is(templates[0].outputPath, "./test/stubs/_site/main/index.html");
  t.is(
    await templates[1].template.getOutputPath(),
    "./test/stubs/_site/main/1/index.html"
  );
  t.is(templates[1].outputPath, "./test/stubs/_site/main/1/index.html");

  // test content
  t.is(
    templates[0].templateContent.trim(),
    "<ol><li>/test1/</li><li>/test2/</li></ol>"
  );
  t.is(templates[1].templateContent.trim(), "<ol><li>/test3/</li></ol>");
});

test("Use a collection inside of a template", async (t) => {
  let tw = new TemplateWriter(
    "./test/stubs/collection-template",
    "./test/stubs/collection-template/_site",
    ["ejs"],
    null,
    null,
    templateConfig
  );

  let paths = await tw._getAllPaths();
  let templateMap = await tw._createTemplateMap(paths);

  let collectionsData = await templateMap._testGetCollectionsData();
  t.is(collectionsData.dog.length, 1);

  let mapEntry = templateMap.getMapEntryForInputPath(
    "./test/stubs/collection-template/template.ejs"
  );
  t.truthy(mapEntry);
  t.is(mapEntry.inputPath, "./test/stubs/collection-template/template.ejs");

  let mainTmpl = tw._createTemplate(
    "./test/stubs/collection-template/template.ejs"
  );
  let outputPath = await mainTmpl.getOutputPath();
  t.is(
    outputPath,
    "./test/stubs/collection-template/_site/template/index.html"
  );

  let templates = await mapEntry.template.getRenderedTemplates(mapEntry.data);

  // test content
  t.is(
    normalizeNewLines(templates[0].templateContent.trim()),
    `Layout

Template

All 2 templates
Template 1 dog`
  );
});

test("Use a collection inside of a layout", async (t) => {
  let tw = new TemplateWriter(
    "./test/stubs/collection-layout",
    "./test/stubs/collection-layout/_site",
    ["ejs"],
    null,
    null,
    templateConfig
  );

  let paths = await tw._getAllPaths();
  let templateMap = await tw._createTemplateMap(paths);

  let collectionsData = await templateMap._testGetCollectionsData();
  t.is(collectionsData.dog.length, 1);

  let mapEntry = templateMap.getMapEntryForInputPath(
    "./test/stubs/collection-layout/template.ejs"
  );
  t.truthy(mapEntry);
  t.is(mapEntry.inputPath, "./test/stubs/collection-layout/template.ejs");

  let mainTmpl = tw._createTemplate(
    "./test/stubs/collection-layout/template.ejs"
  );
  let outputPath = await mainTmpl.getOutputPath();
  t.is(outputPath, "./test/stubs/collection-layout/_site/template/index.html");

  let templates = await mapEntry.template.getRenderedTemplates(mapEntry.data);

  // test content
  t.is(
    normalizeNewLines(templates[0].templateContent.trim()),
    `Layout

Template

All 2 templates
Layout 1 dog`
  );
});

test("Glob Watcher Files with Passthroughs", async (t) => {
  let tw = new TemplateWriter(
    "test/stubs",
    "test/stubs/_site",
    ["njk", "png"],
    null,
    null,
    templateConfig
  );

  t.deepEqual(tw.eleventyFiles.passthroughGlobs, ["./test/stubs/**/*.png"]);
});

test("Pagination and TemplateContent", async (t) => {
  let tw = new TemplateWriter(
    "./test/stubs/pagination-templatecontent",
    "./test/stubs/pagination-templatecontent/_site",
    ["njk", "md"],
    null,
    null,
    templateConfig
  );

  tw.setVerboseOutput(false);
  await tw.write();

  let content = fs.readFileSync(
    "./test/stubs/pagination-templatecontent/_site/index.html",
    "utf-8"
  );
  t.is(
    content.trim(),
    `<h1>Post 1</h1>
<h1>Post 2</h1>`
  );

  rimraf.sync("./test/stubs/pagination-templatecontent/_site/");
});

test("Custom collection returns array", async (t) => {
  let tw = new TemplateWriter(
    "./test/stubs/collection2",
    "./test/stubs/_site",
    ["md"],
    null,
    null,
    templateConfig
  );

  /* Careful here, eleventyConfig is a global */
  eleventyConfig.addCollection("returnAllInputPaths", function (collection) {
    return collection.getAllSorted().map(function (item) {
      return item.inputPath;
    });
  });

  let paths = await tw._getAllPaths();
  let templateMap = await tw._createTemplateMap(paths);
  let collectionsData = await templateMap._testGetCollectionsData();
  t.is(collectionsData.returnAllInputPaths.length, 2);
  t.is(parsePath(collectionsData.returnAllInputPaths[0]).base, "test1.md");
  t.is(parsePath(collectionsData.returnAllInputPaths[1]).base, "test2.md");
});

test("Custom collection returns a string", async (t) => {
  let tw = new TemplateWriter(
    "./test/stubs/collection2",
    "./test/stubs/_site",
    ["md"],
    null,
    null,
    templateConfig
  );

  /* Careful here, eleventyConfig is a global */
  eleventyConfig.addCollection("returnATestString", function (collection) {
    return "test";
  });

  let paths = await tw._getAllPaths();
  let templateMap = await tw._createTemplateMap(paths);
  let collectionsData = await templateMap._testGetCollectionsData();
  t.is(collectionsData.returnATestString, "test");
});

test("Custom collection returns an object", async (t) => {
  let tw = new TemplateWriter(
    "./test/stubs/collection2",
    "./test/stubs/_site",
    ["md"],
    null,
    null,
    templateConfig
  );

  /* Careful here, eleventyConfig is a global */
  eleventyConfig.addCollection("returnATestObject", function () {
    return { test: "value" };
  });

  let paths = await tw._getAllPaths();
  let templateMap = await tw._createTemplateMap(paths);
  let collectionsData = await templateMap._testGetCollectionsData();
  t.deepEqual(collectionsData.returnATestObject, { test: "value" });
});

test("fileSlug should exist in a collection", async (t) => {
  let tw = new TemplateWriter(
    "./test/stubs/collection-slug",
    "./test/stubs/collection-slug/_site",
    ["njk"],
    null,
    null,
    templateConfig
  );

  let paths = await tw._getAllPaths();
  let templateMap = await tw._createTemplateMap(paths);

  let collectionsData = await templateMap._testGetCollectionsData();
  t.is(collectionsData.dog.length, 1);

  let mapEntry = templateMap.getMapEntryForInputPath(
    "./test/stubs/collection-slug/template.njk"
  );
  t.truthy(mapEntry);
  t.is(mapEntry.inputPath, "./test/stubs/collection-slug/template.njk");

  let templates = await mapEntry.template.getRenderedTemplates(mapEntry.data);
  t.is(templates[0].templateContent.trim(), "fileSlug:/dog1/:dog1");
});

test("renderData should exist and be resolved in a collection (Issue #289)", async (t) => {
  let tw = new TemplateWriter(
    "./test/stubs/collection-renderdata",
    "./test/stubs/collection-renderdata/_site",
    ["njk"],
    null,
    null,
    templateConfig
  );

  let paths = await tw._getAllPaths();
  let templateMap = await tw._createTemplateMap(paths);

  let collectionsData = await templateMap._testGetCollectionsData();
  t.is(collectionsData.dog.length, 1);

  let mapEntry = templateMap.getMapEntryForInputPath(
    "./test/stubs/collection-renderdata/template.njk"
  );
  t.truthy(mapEntry);
  t.is(mapEntry.inputPath, "./test/stubs/collection-renderdata/template.njk");

  let templates = await mapEntry.template.getRenderedTemplates(mapEntry.data);
  t.is(templates[0].templateContent.trim(), "value2-value1.css");
});

test("Write Test 11ty.js", async (t) => {
  let tw = new TemplateWriter(
    "./test/stubs/writeTestJS",
    "./test/stubs/_writeTestJSSite",
    [],
    null,
    null,
    templateConfig
  );
  let evf = new EleventyFiles(
    "./test/stubs/writeTestJS",
    "./test/stubs/_writeTestJSSite",
    ["11ty.js"],
    null,
    templateConfig
  );
  evf.init();
  tw.setEleventyFiles(evf);

  let files = await fastglob(evf.getFileGlobs());
  t.deepEqual(evf.getRawFiles(), [
    "./test/stubs/writeTestJS/**/*.11ty.js",
    "./test/stubs/writeTestJS/**/*.11ty.cjs",
  ]);
  t.deepEqual(files, ["./test/stubs/writeTestJS/test.11ty.js"]);

  let tmpl = tw._createTemplate(files[0]);
  t.is(
    await tmpl.getOutputPath(),
    "./test/stubs/_writeTestJSSite/test/index.html"
  );
});

test.skip("Markdown with alias", async (t) => {
  let map = new EleventyExtensionMap(["md"]);
  map.config = {
    templateExtensionAliases: {
      markdown: "md",
    },
  };

  let evf = new EleventyFiles(
    "./test/stubs/writeTestMarkdown",
    "./test/stubs/_writeTestMarkdownSite",
    ["md"]
  );
  evf._setExtensionMap(map);
  evf.init();

  let files = await fastglob(evf.getFileGlobs());
  t.deepEqual(evf.getRawFiles(), [
    "./test/stubs/writeTestMarkdown/**/*.md",
    "./test/stubs/writeTestMarkdown/**/*.markdown",
  ]);
  t.true(files.indexOf("./test/stubs/writeTestMarkdown/sample.md") > -1);
  t.true(files.indexOf("./test/stubs/writeTestMarkdown/sample2.markdown") > -1);

  let tw = new TemplateWriter(
    "./test/stubs/writeTestMarkdown",
    "./test/stubs/_writeTestMarkdownSite",
    [],
    null,
    null,
    templateConfig
  );
  tw.setEleventyFiles(evf);

  let tmpl = tw._createTemplate(files[0]);
  tmpl._setExtensionMap(map);
  t.is(
    await tmpl.getOutputPath(),
    "./test/stubs/_writeTestMarkdownSite/sample/index.html"
  );

  let tmpl2 = tw._createTemplate(files[1]);
  tmpl2._setExtensionMap(map);
  t.is(
    await tmpl2.getOutputPath(),
    "./test/stubs/_writeTestMarkdownSite/sample2/index.html"
  );
});

test.skip("JavaScript with alias", async (t) => {
  let map = new EleventyExtensionMap(["11ty.js"]);
  map.config = {
    templateExtensionAliases: {
      js: "11ty.js",
    },
  };

  let evf = new EleventyFiles(
    "./test/stubs/writeTestJS",
    "./test/stubs/_writeTestJSSite",
    ["11ty.js"],
    null,
    null,
    templateConfig
  );
  evf._setExtensionMap(map);
  evf.init();

  let files = await fastglob(evf.getFileGlobs());
  t.deepEqual(
    evf.getRawFiles().sort(),
    [
      "./test/stubs/writeTestJS/**/*.11ty.js",
      "./test/stubs/writeTestJS/**/*.js",
    ].sort()
  );
  t.deepEqual(
    files.sort(),
    [
      "./test/stubs/writeTestJS/sample.js",
      "./test/stubs/writeTestJS/test.11ty.js",
    ].sort()
  );

  let tw = new TemplateWriter(
    "./test/stubs/writeTestJS",
    "./test/stubs/_writeTestJSSite",
    [],
    null,
    null,
    templateConfig
  );
  tw.setEleventyFiles(evf);

  let tmpl = tw._createTemplate(files[0]);
  t.is(
    await tmpl.getOutputPath(),
    "./test/stubs/_writeTestJSSite/test/index.html"
  );
});

test("Passthrough file output", async (t) => {
  let tw = new TemplateWriter(
    "./test/stubs/template-passthrough/",
    "./test/stubs/template-passthrough/_site",
    ["njk", "md"],
    null,
    null,
    templateConfig
  );

  const mgr = tw.eleventyFiles.getPassthroughManager();
  mgr.setConfig({
    passthroughFileCopy: true,
    passthroughCopies: {
      "./test/stubs/template-passthrough/static": true,
      "./test/stubs/template-passthrough/static/": "./",
      "./test/stubs/template-passthrough/static/**/*": "./all/",
      "./test/stubs/template-passthrough/static/**/*.js": "./js/",
    },
  });

  await tw.write();

  const output = [
    "./test/stubs/template-passthrough/_site/static/nested/test-nested.css",
    "./test/stubs/template-passthrough/_site/all/test.js",
    "./test/stubs/template-passthrough/_site/all/test.css",
    "./test/stubs/template-passthrough/_site/all/test-nested.css",
    "./test/stubs/template-passthrough/_site/js/",
    "./test/stubs/template-passthrough/_site/js/test.js",
    "./test/stubs/template-passthrough/_site/nested/",
    "./test/stubs/template-passthrough/_site/nested/test-nested.css",
    "./test/stubs/template-passthrough/_site/test.css",
    "./test/stubs/template-passthrough/_site/test.js",
  ];

  let results = await Promise.all(
    output.map(function (path) {
      return fs.existsSync(path);
    })
  );

  for (let result of results) {
    t.true(result);
  }

  rimraf.sync("./test/stubs/template-passthrough/_site/");
});
