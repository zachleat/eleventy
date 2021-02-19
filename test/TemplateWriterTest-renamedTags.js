const test = require("ava");
const util = require("util");
const fastglob = require("fast-glob");
const parsePath = require("parse-filepath");
const EleventyFiles = require("../src/EleventyFiles");
const EleventyExtensionMap = require("../src/EleventyExtensionMap");
const TemplateWriter = require("../src/TemplateWriter");
// Not sure why but this required `ava` and _createTemplate 👀
// const Template = require("../src/Template");
const eleventyConfig = require("../src/EleventyConfig");
const normalizeNewLines = require("./Util/normalizeNewLines");

const templateConfig = require("../src/Config");
const config = templateConfig.getConfig();

test.before((t) => {
  config.keys.tags = "categories";
});

test.after((t) => {
  config.keys.tags = "tags";
});

test("_testGetCollectionsData", async (t) => {
  let tw = new TemplateWriter("./test/stubs/collection", "./test/stubs/_site", [
    "md",
  ]);

  let paths = await tw._getAllPaths();
  let templateMap = await tw._createTemplateMap(paths);
  let collectionsData = await templateMap._testGetCollectionsData();

  t.is(collectionsData.post, undefined);
  t.is(collectionsData.cat, undefined);
  t.is(collectionsData.dog, undefined);
  t.is(collectionsData.all.length, 5);
  t.is(collectionsData.A.length, 1);
  t.is(collectionsData.B.length, 1);
});

// TODO remove this (used by other test things)
test("_testGetAllTags", async (t) => {
  let tw = new TemplateWriter("./test/stubs/collection", "./test/stubs/_site", [
    "md",
  ]);

  let paths = await tw._getAllPaths();
  let templateMap = await tw._createTemplateMap(paths);
  let tags = templateMap._testGetAllTags();

  t.deepEqual(tags.sort(), ["A", "B"].sort());
});

test("Pagination with a Collection", async (t) => {
  let tw = new TemplateWriter(
    "./test/stubs/paged/collection",
    "./test/stubs/_site",
    ["njk"]
  );

  let paths = await tw._getAllPaths();
  let templateMap = await tw._createTemplateMap(paths);

  let collectionsData = await templateMap._testGetCollectionsData();
  t.is(collectionsData.tag2.length, 3);
  t.is(collectionsData.pagingtag.length, 1);

  let mapEntry = templateMap.getMapEntryForInputPath(
    "./test/stubs/paged/collection/main-renamed.njk"
  );
  t.truthy(mapEntry);
  t.is(mapEntry.inputPath, "./test/stubs/paged/collection/main-renamed.njk");
  t.is(mapEntry._pages.length, 2);
  t.is(
    mapEntry._pages[0].outputPath,
    "./test/stubs/_site/main-renamed/index.html"
  );
  t.is(
    mapEntry._pages[1].outputPath,
    "./test/stubs/_site/main-renamed/1/index.html"
  );

  t.is(
    mapEntry._pages[0].templateContent.trim(),
    "<ol><li>/test1/</li><li>/test2/</li></ol>"
  );
  t.is(mapEntry._pages[1].templateContent.trim(), "<ol><li>/test3/</li></ol>");
});
