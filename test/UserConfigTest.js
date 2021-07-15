const test = require("ava");
const UserConfig = require("../src/UserConfig");

test("Template Formats", (t) => {
  let userCfg = new UserConfig();

  t.falsy(userCfg.getMergingConfigObject().templateFormats);

  userCfg.setTemplateFormats("njk,liquid");
  t.deepEqual(userCfg.getMergingConfigObject().templateFormats, [
    "njk",
    "liquid",
  ]);

  // setting multiple times takes the last one
  userCfg.setTemplateFormats("njk,liquid,pug");
  userCfg.setTemplateFormats("njk,liquid");
  t.deepEqual(userCfg.getMergingConfigObject().templateFormats, [
    "njk",
    "liquid",
  ]);
});

test("Template Formats (Arrays)", (t) => {
  let userCfg = new UserConfig();

  t.falsy(userCfg.getMergingConfigObject().templateFormats);

  userCfg.setTemplateFormats(["njk", "liquid"]);
  t.deepEqual(userCfg.getMergingConfigObject().templateFormats, [
    "njk",
    "liquid",
  ]);

  // setting multiple times takes the last one
  userCfg.setTemplateFormats(["njk", "liquid", "pug"]);
  userCfg.setTemplateFormats(["njk", "liquid"]);
  t.deepEqual(userCfg.getMergingConfigObject().templateFormats, [
    "njk",
    "liquid",
  ]);
});

// more in TemplateConfigTest.js

test.cb("Events", (t) => {
  let userCfg = new UserConfig();
  userCfg.on("testEvent", function (arg1, arg2, arg3) {
    t.is(arg1, "arg1");
    t.is(arg2, "arg2");
    t.is(arg3, "arg3");
    t.end();
  });

  userCfg.emit("testEvent", "arg1", "arg2", "arg3");
});

test.cb("Async Events", (t) => {
  let userCfg = new UserConfig();
  let arg1;

  userCfg.on(
    "asyncTestEvent",
    (_arg1) =>
      new Promise((resolve) => {
        setTimeout(() => {
          arg1 = _arg1;
          resolve();
        }, 10);
      })
  );

  userCfg.emit("asyncTestEvent", "arg1").then(() => {
    t.is(arg1, "arg1");
    t.end();
  });
});

test("Add Collections", (t) => {
  let userCfg = new UserConfig();
  userCfg.addCollection("myCollection", function (collection) {});
  t.deepEqual(Object.keys(userCfg.getCollections()), ["myCollection"]);
});

test("Add Collections throws error on key collision", (t) => {
  let userCfg = new UserConfig();
  userCfg.addCollection("myCollectionCollision", function (collection) {});

  t.throws(() => {
    userCfg.addCollection("myCollectionCollision", function (collection) {});
  });
});

test("Set manual Pass-through File Copy (single call)", (t) => {
  let userCfg = new UserConfig();
  userCfg.addPassthroughCopy("img");

  t.deepEqual(userCfg.passthroughCopies["img"], { outputPath: true, copyOptions: {} });
});

test("Set manual Pass-through File Copy (chained calls)", (t) => {
  let userCfg = new UserConfig();
  userCfg
    .addPassthroughCopy("css")
    .addPassthroughCopy("js")
    .addPassthroughCopy({ "./src/static": "static" })
    .addPassthroughCopy({ "./src/empty": "./" });

  t.deepEqual(userCfg.passthroughCopies["css"], { outputPath: true, copyOptions: {} });
  t.deepEqual(userCfg.passthroughCopies["js"], { outputPath: true, copyOptions: {} });
  t.deepEqual(userCfg.passthroughCopies["./src/static"], { outputPath: "static", copyOptions: {} });
  t.deepEqual(userCfg.passthroughCopies["./src/empty"], { outputPath: "./", copyOptions: {} });
});

test("Set manual Pass-through File Copy (glob patterns)", (t) => {
  let userCfg = new UserConfig();
  userCfg.addPassthroughCopy({
    "./src/static/**/*": "renamed",
    "./src/markdown/*.md": "",
  });

  // does not exist
  t.is(userCfg.passthroughCopies["css/**"], undefined);
  t.is(userCfg.passthroughCopies["js/**"], undefined);

  // exists
  t.deepEqual(userCfg.passthroughCopies["./src/static/**/*"], { outputPath: "renamed", copyOptions: {} });
  t.deepEqual(userCfg.passthroughCopies["./src/markdown/*.md"], { outputPath: "", copyOptions: {} });
});

test("Set Template Formats (string)", (t) => {
  let userCfg = new UserConfig();
  userCfg.setTemplateFormats("ejs, njk, liquid");
  t.deepEqual(userCfg.templateFormats, ["ejs", "njk", "liquid"]);
});

test("Set Template Formats (array)", (t) => {
  let userCfg = new UserConfig();
  userCfg.setTemplateFormats(["ejs", "njk", "liquid"]);
  t.deepEqual(userCfg.templateFormats, ["ejs", "njk", "liquid"]);
});

test("Set Template Formats (js passthrough copy)", (t) => {
  let userCfg = new UserConfig();
  userCfg.setTemplateFormats("ejs, njk, liquid, js");
  t.deepEqual(userCfg.templateFormats, ["ejs", "njk", "liquid", "js"]);
});

test("Set Template Formats (11ty.js)", (t) => {
  let userCfg = new UserConfig();
  userCfg.setTemplateFormats("ejs, njk, liquid, 11ty.js");
  t.deepEqual(userCfg.templateFormats, ["ejs", "njk", "liquid", "11ty.js"]);
});
