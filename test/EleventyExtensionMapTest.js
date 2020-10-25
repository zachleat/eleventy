const test = require("ava");
const EleventyExtensionMap = require("../src/EleventyExtensionMap");
const templateConfig = require("../src/Config");

test.before(async () => {
  // This runs concurrently with the above
  await templateConfig.init();
});

test("Empty formats", (t) => {
  let map = new EleventyExtensionMap([], templateConfig);
  t.deepEqual(map.getGlobs("."), []);
});
test("Single format", (t) => {
  let map = new EleventyExtensionMap(["pug"], templateConfig);
  t.deepEqual(map.getGlobs("."), ["./**/*.pug"]);
  t.deepEqual(map.getGlobs("src"), ["./src/**/*.pug"]);
});
test("Multiple formats", (t) => {
  let map = new EleventyExtensionMap(["njk", "pug"], templateConfig);
  t.deepEqual(map.getGlobs("."), ["./**/*.njk", "./**/*.pug"]);
  t.deepEqual(map.getGlobs("src"), ["./src/**/*.njk", "./src/**/*.pug"]);
});

test("Invalid keys are filtered (no passthrough copy)", (t) => {
  let map = new EleventyExtensionMap(["lksdjfjlsk"], templateConfig);
  map.config = {
    passthroughFileCopy: false,
  };
  t.deepEqual(map.getGlobs("."), []);
});

test("Invalid keys are filtered (using passthrough copy)", (t) => {
  let map = new EleventyExtensionMap(["lksdjfjlsk"], templateConfig);
  map.config = {
    passthroughFileCopy: true,
  };
  t.deepEqual(map.getGlobs("."), ["./**/*.lksdjfjlsk"]);
});

test("Keys are mapped to lower case", (t) => {
  let map = new EleventyExtensionMap(["PUG", "NJK"], templateConfig);
  t.deepEqual(map.getGlobs("."), ["./**/*.pug", "./**/*.njk"]);
});

test("Pruned globs", (t) => {
  let map = new EleventyExtensionMap(["pug", "njk", "png"], templateConfig);
  t.deepEqual(map.getPassthroughCopyGlobs("."), ["./**/*.png"]);
});

test("Empty path for fileList", (t) => {
  let map = new EleventyExtensionMap(["njk", "pug"], templateConfig);
  t.deepEqual(map.getFileList(), []);
});

test("fileList", (t) => {
  let map = new EleventyExtensionMap(["njk", "pug"], templateConfig);
  t.deepEqual(map.getFileList("filename"), ["filename.njk", "filename.pug"]);
});

test("fileList with dir", (t) => {
  let map = new EleventyExtensionMap(["njk", "pug"], templateConfig);
  t.deepEqual(map.getFileList("filename", "_includes"), [
    "_includes/filename.njk",
    "_includes/filename.pug",
  ]);
});

test("fileList with dir in path", (t) => {
  let map = new EleventyExtensionMap(["njk", "pug"], templateConfig);
  t.deepEqual(map.getFileList("layouts/filename"), [
    "layouts/filename.njk",
    "layouts/filename.pug",
  ]);
});

test("fileList with dir in path and dir", (t) => {
  let map = new EleventyExtensionMap(["njk", "pug"], templateConfig);
  t.deepEqual(map.getFileList("layouts/filename", "_includes"), [
    "_includes/layouts/filename.njk",
    "_includes/layouts/filename.pug",
  ]);
});

test("removeTemplateExtension", (t) => {
  let map = new EleventyExtensionMap(["njk", "11ty.js"], templateConfig);
  t.is(map.removeTemplateExtension("component.njk"), "component");
  t.is(map.removeTemplateExtension("component.11ty.js"), "component");

  t.is(map.removeTemplateExtension(""), "");
  t.is(map.removeTemplateExtension("component"), "component");
  t.is(map.removeTemplateExtension("component.js"), "component.js");
});

test("hasEngine", (t) => {
  let map = new EleventyExtensionMap(
    ["liquid", "njk", "11ty.js", "ejs", "pug"],
    templateConfig
  );
  t.true(map.hasEngine("default.ejs"));
  t.is(map.getKey("default.ejs"), "ejs");
  t.falsy(map.getKey());
  t.is(map.getKey("EjS"), "ejs");
  t.true(map.hasEngine("EjS"));
  t.true(map.hasEngine("ejs"));
  t.falsy(map.getKey("sldkjfkldsj"));
  t.false(map.hasEngine("sldkjfkldsj"));

  t.is(map.getKey("11ty.js"), "11ty.js");
  t.true(map.hasEngine("11ty.js"));

  t.is(map.getKey("md"), "md");
  t.true(map.hasEngine("md"));
});

test("hasEngine no formats passed in", (t) => {
  let map = new EleventyExtensionMap([], templateConfig);
  t.true(map.hasEngine("default.ejs"));
  t.is(map.getKey("default.ejs"), "ejs");
  t.falsy(map.getKey());
  t.is(map.getKey("EjS"), "ejs");
  t.true(map.hasEngine("EjS"));
  t.true(map.hasEngine("ejs"));
  t.falsy(map.getKey("sldkjfkldsj"));
  t.false(map.hasEngine("sldkjfkldsj"));

  // should return keys for engines that exist but are not filtered
  t.is(map.getKey("11ty.js"), "11ty.js");
  t.true(map.hasEngine("11ty.js"));

  t.is(map.getKey("md"), "md");
  t.true(map.hasEngine("md"));
});

test("getKey", (t) => {
  let map = new EleventyExtensionMap(["njk", "11ty.js", "md"], templateConfig);
  t.is(map.getKey("component.njk"), "njk");
  t.is(map.getKey("component.11ty.js"), "11ty.js");
  t.is(map.getKey("11ty.js"), "11ty.js");
  t.is(map.getKey(".11ty.js"), "11ty.js");

  t.is(map.getKey("sample.md"), "md");

  t.is(map.getKey(""), undefined);
  t.is(map.getKey("js"), undefined);
  t.is(map.getKey("component"), undefined);
  t.is(map.getKey("component.js"), undefined);
});

test("isFullTemplateFilename (not a passthrough copy extension)", (t) => {
  let map = new EleventyExtensionMap(
    ["liquid", "njk", "11ty.js", "ejs", "pug", "js", "css"],
    templateConfig
  );
  t.true(map.isFullTemplateFilename("template.liquid"));
  t.true(map.isFullTemplateFilename("template.njk"));
  t.true(map.isFullTemplateFilename("template.11ty.js"));
  t.true(map.isFullTemplateFilename("template.ejs"));
  t.true(map.isFullTemplateFilename("template.pug"));
  t.false(map.isFullTemplateFilename("passthrough.js"));
  t.false(map.isFullTemplateFilename("passthrough.css"));
});
