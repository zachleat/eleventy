import test from "ava";
import fs from "fs-extra";
import fastglob from "fast-glob";
import parsePath from "parse-filepath";
import TemplateWriter from "../src/TemplateWriter";
import TemplatePassthroughManager from "../src/TemplatePassthroughManager";
// Not sure why but this import up `ava` and _createTemplate 👀
// import Template from "../src/Template";
import eleventyConfig from "../src/EleventyConfig";

test("Mutually exclusive Input and Output dirs", async t => {
  let tw = new TemplateWriter(
    "./test/stubs/writeTest",
    "./test/stubs/_writeTestSite",
    ["ejs", "md"]
  );

  let files = await fastglob.async(tw.getFiles());
  t.is(tw.getRawFiles().length, 2);
  t.true(files.length > 0);
  t.is(files[0], "./test/stubs/writeTest/test.md");
});

test("Single File Input (deep path)", async t => {
  let tw = new TemplateWriter("./test/stubs/index.html", "./test/stubs/_site", [
    "ejs",
    "md"
  ]);

  let files = await fastglob.async(tw.getFiles());
  t.is(tw.getRawFiles().length, 1);
  t.is(files.length, 1);
  t.is(files[0], "./test/stubs/index.html");
});

test("Single File Input (shallow path)", async t => {
  let tw = new TemplateWriter("README.md", "./test/stubs/_site", ["md"]);
  let globs = tw.getFiles().filter(path => path !== "!./README.md");
  let files = await fastglob.async(globs);
  t.is(tw.getRawFiles().length, 1);
  t.is(files.length, 1);
  t.is(files[0], "./README.md");
});

test("Single File Input (shallow path)", async t => {
  let tw = new TemplateWriter("README.md", ".", ["md"]);
  t.is(tw._getInputPathDir("README.md"), ".");
});

// TODO make sure if output is a subdir of input dir that they don’t conflict.
test("Output is a subdir of input", async t => {
  let tw = new TemplateWriter(
    "./test/stubs/writeTest",
    "./test/stubs/writeTest/_writeTestSite",
    ["ejs", "md"]
  );

  let files = await fastglob.async(tw.getFiles());
  t.is(tw.getRawFiles().length, 2);
  t.true(files.length > 0);

  let tmpl = tw._createTemplate(files[0]);
  t.is(tmpl.inputDir, "./test/stubs/writeTest");
  t.is(
    await tmpl.getOutputPath(),
    "./test/stubs/writeTest/_writeTestSite/test/index.html"
  );
});

test(".eleventyignore parsing", t => {
  let ignores = new TemplateWriter.getFileIgnores(
    "./test/stubs/.eleventyignore"
  );
  t.is(ignores.length, 2);
  t.is(ignores[0], "!./test/stubs/ignoredFolder/**");
  t.is(ignores[1], "!./test/stubs/ignoredFolder/ignored.md");
});

test("defaults if passed file name does not exist", t => {
  let ignores = new TemplateWriter.getFileIgnores(
    ".thisfiledoesnotexist",
    "node_modules/"
  );
  t.truthy(ignores.length);
  t.is(ignores[0], "!./node_modules/**");
});

test(".eleventyignore files", async t => {
  let tw = new TemplateWriter("test/stubs", "test/stubs/_site", ["ejs", "md"]);
  let ignoredFiles = await fastglob.async("test/stubs/ignoredFolder/*.md");
  t.is(ignoredFiles.length, 1);

  let files = await fastglob.async(tw.getFiles());
  t.true(files.length > 0);

  t.is(
    files.filter(file => {
      return file.indexOf("./test/stubs/ignoredFolder") > -1;
    }).length,
    0
  );
});

test("_createTemplateMap", async t => {
  let tw = new TemplateWriter(
    "./test/stubs/writeTest",
    "./test/stubs/_writeTestSite",
    ["ejs", "md"]
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

test("_createTemplateMap (no leading dot slash)", async t => {
  let tw = new TemplateWriter(
    "test/stubs/writeTest",
    "test/stubs/_writeTestSite",
    ["ejs", "md"]
  );

  let paths = await tw._getAllPaths();
  t.true(paths.length > 0);
  t.is(paths[0], "./test/stubs/writeTest/test.md");
});

test("getCollectionsData", async t => {
  let tw = new TemplateWriter("./test/stubs/collection", "./test/stubs/_site", [
    "md"
  ]);

  let paths = await tw._getAllPaths();
  let templateMap = await tw._createTemplateMap(paths);
  let collectionsData = await templateMap.getCollectionsData();
  t.is(collectionsData.post.length, 2);
  t.is(collectionsData.cat.length, 2);
  t.is(collectionsData.dog.length, 1);
});

test("_getAllTags", async t => {
  let tw = new TemplateWriter("./test/stubs/collection", "./test/stubs/_site", [
    "md"
  ]);

  let paths = await tw._getAllPaths();
  let templateMap = await tw._createTemplateMap(paths);
  let tags = templateMap.getAllTags();

  t.deepEqual(tags.sort(), ["cat", "dog", "post"].sort());
});

test("Collection of files sorted by date", async t => {
  let tw = new TemplateWriter("./test/stubs/dates", "./test/stubs/_site", [
    "md"
  ]);

  let paths = await tw._getAllPaths();
  let templateMap = await tw._createTemplateMap(paths);
  let collectionsData = await templateMap.getCollectionsData();
  t.is(collectionsData.dateTestTag.length, 6);
});

test("_getCollectionsData with custom collection (ascending)", async t => {
  let tw = new TemplateWriter(
    "./test/stubs/collection2",
    "./test/stubs/_site",
    ["md"]
  );

  eleventyConfig.addCollection("customPostsAsc", function(collection) {
    return collection.getFilteredByTag("post").sort(function(a, b) {
      return a.date - b.date;
    });
  });

  let paths = await tw._getAllPaths();
  let templateMap = await tw._createTemplateMap(paths);
  let collectionsData = await templateMap.getCollectionsData();
  t.is(collectionsData.customPostsAsc.length, 2);
  t.is(parsePath(collectionsData.customPostsAsc[0].inputPath).base, "test1.md");
  t.is(parsePath(collectionsData.customPostsAsc[1].inputPath).base, "test2.md");
});

test("_getCollectionsData with custom collection (descending)", async t => {
  let tw = new TemplateWriter(
    "./test/stubs/collection2",
    "./test/stubs/_site",
    ["md"]
  );

  eleventyConfig.addCollection("customPosts", function(collection) {
    return collection.getFilteredByTag("post").sort(function(a, b) {
      return b.date - a.date;
    });
  });

  let paths = await tw._getAllPaths();
  let templateMap = await tw._createTemplateMap(paths);
  let collectionsData = await templateMap.getCollectionsData();
  t.is(collectionsData.customPosts.length, 2);
  t.is(parsePath(collectionsData.customPosts[0].inputPath).base, "test2.md");
  t.is(parsePath(collectionsData.customPosts[1].inputPath).base, "test1.md");
});

test("_getCollectionsData with custom collection (filter only to markdown input)", async t => {
  let tw = new TemplateWriter(
    "./test/stubs/collection2",
    "./test/stubs/_site",
    ["md"]
  );

  eleventyConfig.addCollection("onlyMarkdown", function(collection) {
    return collection.getAllSorted().filter(function(item) {
      let extension = item.inputPath.split(".").pop();
      return extension === "md";
    });
  });

  let paths = await tw._getAllPaths();
  let templateMap = await tw._createTemplateMap(paths);
  let collectionsData = await templateMap.getCollectionsData();
  t.is(collectionsData.onlyMarkdown.length, 2);
  t.is(parsePath(collectionsData.onlyMarkdown[0].inputPath).base, "test1.md");
  t.is(parsePath(collectionsData.onlyMarkdown[1].inputPath).base, "test2.md");
});

test("Pagination with a Collection", async t => {
  let tw = new TemplateWriter(
    "./test/stubs/paged/collection",
    "./test/stubs/_site",
    ["njk"]
  );

  let paths = await tw._getAllPaths();
  let templateMap = await tw._createTemplateMap(paths);
  await templateMap.cache();

  let collectionsData = await templateMap.getCollectionsData();
  t.is(collectionsData.tag1.length, 3);
  t.is(collectionsData.pagingtag.length, 1);

  let mapEntry = templateMap.getMapEntryForPath(
    "./test/stubs/paged/collection/main.njk"
  );
  t.truthy(mapEntry);
  t.is(mapEntry.inputPath, "./test/stubs/paged/collection/main.njk");

  let mainTmpl = tw._createTemplate("./test/stubs/paged/collection/main.njk");
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

test("Use a collection inside of a template", async t => {
  let tw = new TemplateWriter(
    "./test/stubs/collection-template",
    "./test/stubs/collection-template/_site",
    ["ejs"]
  );

  let paths = await tw._getAllPaths();
  let templateMap = await tw._createTemplateMap(paths);
  await templateMap.cache();

  let collectionsData = await templateMap.getCollectionsData();
  t.is(collectionsData.dog.length, 1);

  let mapEntry = templateMap.getMapEntryForPath(
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
    templates[0].templateContent.trim(),
    `Layout

Template

All 2 templates
Template 1 dog`
  );
});

test("Use a collection inside of a layout", async t => {
  let tw = new TemplateWriter(
    "./test/stubs/collection-layout",
    "./test/stubs/collection-layout/_site",
    ["ejs"]
  );

  let paths = await tw._getAllPaths();
  let templateMap = await tw._createTemplateMap(paths);
  await templateMap.cache();

  let collectionsData = await templateMap.getCollectionsData();
  t.is(collectionsData.dog.length, 1);

  let mapEntry = templateMap.getMapEntryForPath(
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
    templates[0].templateContent.trim(),
    `Layout

Template

All 2 templates
Layout 1 dog`
  );
});

/* .eleventyignore and .gitignore combos */
test("Get ignores (no .eleventyignore no .gitignore)", t => {
  let tw = new TemplateWriter(
    "test/stubs/ignore1",
    "test/stubs/ignore1/_site",
    []
  );

  t.deepEqual(tw.getIgnores(), [
    "!./test/stubs/ignore1/node_modules",
    "!./test/stubs/ignore1/_site/**"
  ]);
});

test("Get ignores (no .eleventyignore)", t => {
  let tw = new TemplateWriter(
    "test/stubs/ignore2",
    "test/stubs/ignore2/_site",
    []
  );

  t.deepEqual(tw.getIgnores(), [
    "!./test/stubs/ignore2/thisshouldnotexist12345",
    "!./test/stubs/ignore2/_site/**"
  ]);
});

test("Get ignores (no .eleventyignore, using setUseGitIgnore(false))", t => {
  let tw = new TemplateWriter(
    "test/stubs/ignore2",
    "test/stubs/ignore2/_site",
    []
  );

  tw.overrideConfig({
    useGitIgnore: false
  });

  t.deepEqual(tw.getIgnores(), ["!./test/stubs/ignore2/_site/**"]);
});

test("Get ignores (no .gitignore)", t => {
  let tw = new TemplateWriter(
    "test/stubs/ignore3",
    "test/stubs/ignore3/_site",
    []
  );

  t.deepEqual(tw.getIgnores(), [
    "!./test/stubs/ignore3/node_modules",
    "!./test/stubs/ignore3/ignoredFolder/**",
    "!./test/stubs/ignore3/ignoredFolder/ignored.md",
    "!./test/stubs/ignore3/_site/**"
  ]);
});

test("Get ignores (both .eleventyignore and .gitignore)", t => {
  let tw = new TemplateWriter(
    "test/stubs/ignore4",
    "test/stubs/ignore4/_site",
    []
  );

  t.deepEqual(tw.getIgnores(), [
    "!./test/stubs/ignore4/thisshouldnotexist12345",
    "!./test/stubs/ignore4/ignoredFolder/**",
    "!./test/stubs/ignore4/ignoredFolder/ignored.md",
    "!./test/stubs/ignore4/_site/**"
  ]);
});

test("Get ignores (both .eleventyignore and .gitignore, using setUseGitIgnore(false))", t => {
  let tw = new TemplateWriter(
    "test/stubs/ignore4",
    "test/stubs/ignore4/_site",
    []
  );

  tw.overrideConfig({
    useGitIgnore: false
  });

  t.deepEqual(tw.getIgnores(), [
    "!./test/stubs/ignore4/ignoredFolder/**",
    "!./test/stubs/ignore4/ignoredFolder/ignored.md",
    "!./test/stubs/ignore4/_site/**"
  ]);
});
/* End .eleventyignore and .gitignore combos */

test("Include and Data Dirs", t => {
  let tw = new TemplateWriter("test/stubs", "test/stubs/_site", []);

  t.deepEqual(tw.getIncludesAndDataDirs(), [
    "./test/stubs/_includes/**",
    "./test/stubs/_data/**"
  ]);
});

test("Ignore Include and Data Dirs", t => {
  let tw = new TemplateWriter("test/stubs", "test/stubs/_site", []);

  t.deepEqual(tw.getTemplateIgnores(), [
    "!./test/stubs/_includes/**",
    "!./test/stubs/_data/**"
  ]);
});

test("Glob Watcher Files", async t => {
  let tw = new TemplateWriter("test/stubs", "test/stubs/_site", ["njk"]);

  t.deepEqual(tw.getGlobWatcherFiles(), [
    "./test/stubs/**/*.njk",
    "./test/stubs/_includes/**",
    "./test/stubs/_data/**"
  ]);
});

test("Glob Watcher Files with Passthroughs", t => {
  let tw = new TemplateWriter("test/stubs", "test/stubs/_site", ["njk", "png"]);
  t.deepEqual(tw.getPassthroughPaths(), []);
});

test("Glob Watcher Files with File Extension Passthroughs", async t => {
  let tw = new TemplateWriter("test/stubs", "test/stubs/_site", ["njk", "png"]);

  t.deepEqual(tw.getGlobWatcherFiles(), [
    "./test/stubs/**/*.njk",
    "./test/stubs/**/*.png",
    "./test/stubs/_includes/**",
    "./test/stubs/_data/**"
  ]);
});

test("Glob Watcher Files with Config Passthroughs", async t => {
  let tw = new TemplateWriter("test/stubs", "test/stubs/_site", ["njk"]);

  let mgr = new TemplatePassthroughManager();
  mgr.setInputDir("test/stubs");
  mgr.setOutputDir("test/stubs/_site");
  mgr.setConfig({
    passthroughFileCopy: true,
    passthroughCopies: {
      "test/stubs/img/": true
    }
  });
  tw.setPassthroughManager(mgr);

  t.deepEqual(tw.getGlobWatcherFiles(), [
    "./test/stubs/**/*.njk",
    "./test/stubs/_includes/**",
    "./test/stubs/_data/**",
    "./test/stubs/img/**"
  ]);
});

test("Pagination and TemplateContent", async t => {
  let tw = new TemplateWriter(
    "./test/stubs/pagination-templatecontent",
    "./test/stubs/pagination-templatecontent/_site",
    ["njk", "md"]
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

  fs.unlinkSync("./test/stubs/pagination-templatecontent/_site/index.html");
  fs.unlinkSync(
    "./test/stubs/pagination-templatecontent/_site/post-1/index.html"
  );
  fs.unlinkSync(
    "./test/stubs/pagination-templatecontent/_site/post-2/index.html"
  );
});
