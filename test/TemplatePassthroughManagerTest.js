const test = require("ava");
const fs = require("fs");
const TemplatePassthroughManager = require("../src/TemplatePassthroughManager");
const TemplateConfig = require("../src/TemplateConfig");
const EleventyFiles = require("../src/EleventyFiles");
const EleventyExtensionMap = require("../src/EleventyExtensionMap");

test("Get paths from Config", async (t) => {
  let eleventyConfig = new TemplateConfig();
  eleventyConfig.userConfig.passthroughCopies = {
    img: { outputPath: true },
  };
  let mgr = new TemplatePassthroughManager(eleventyConfig);

  t.deepEqual(mgr.getConfigPaths(), [
    { inputPath: "./img", outputPath: true, copyOptions: {} }
  ]);
});

test("isPassthroughCopyFile", async (t) => {
  let eleventyConfig = new TemplateConfig();
  eleventyConfig.userConfig.passthroughCopies = {
    img: { outputPath: true },
    fonts: { outputPath: true },
  };
  let mgr = new TemplatePassthroughManager(eleventyConfig);

  t.true(mgr.isPassthroughCopyFile([], "./img/test.png"));
  t.true(mgr.isPassthroughCopyFile([], "./fonts/Roboto.woff"));
  t.false(mgr.isPassthroughCopyFile([], "./docs/test.njk"));
  t.false(mgr.isPassthroughCopyFile([], "./other-dir/test.png"));
  t.true(
    mgr.isPassthroughCopyFile(
      ["hi", "./other-dir/test.png"],
      "./other-dir/test.png"
    )
  );
});

test("Get glob paths from config", async (t) => {
  let eleventyConfig = new TemplateConfig();
  eleventyConfig.userConfig.passthroughCopies = {
    "test/stubs/img": { outputPath: true },
    "test/stubs/img/**": { outputPath: "./" },
    "test/stubs/img/*.js": { outputPath: "./" },
  };
  let mgr = new TemplatePassthroughManager(eleventyConfig);

  t.deepEqual(mgr.getConfigPathGlobs(), [
    "./test/stubs/img/**",
    "./test/stubs/img/**",
    "./test/stubs/img/*.js",
  ]);
});

test("Get file paths", async (t) => {
  let eleventyConfig = new TemplateConfig();
  let mgr = new TemplatePassthroughManager(eleventyConfig);

  t.deepEqual(mgr.getNonTemplatePaths(["test.png"]), ["test.png"]);
});

test("Get file paths (filter out real templates)", async (t) => {
  let eleventyConfig = new TemplateConfig();
  let mgr = new TemplatePassthroughManager(eleventyConfig);

  t.deepEqual(mgr.getNonTemplatePaths(["test.njk"]), []);
});

test("Get file paths (filter out real templates), multiple", async (t) => {
  let eleventyConfig = new TemplateConfig();
  let mgr = new TemplatePassthroughManager(eleventyConfig);

  t.deepEqual(mgr.getNonTemplatePaths(["test.njk", "test.png"]), ["test.png"]);
});

test("Get file paths with a js file (filter out real templates), multiple", async (t) => {
  let eleventyConfig = new TemplateConfig();
  let mgr = new TemplatePassthroughManager(eleventyConfig);

  t.deepEqual(mgr.getNonTemplatePaths(["test.njk", "test.js"]), ["test.js"]);
});

// This test used to be for passthroughFileCopy: false in config
test("Get file paths (one image path)", async (t) => {
  let eleventyConfig = new TemplateConfig();
  let mgr = new TemplatePassthroughManager(eleventyConfig);

  t.deepEqual(mgr.getNonTemplatePaths(["test.png"]), ["test.png"]);
});

test("Naughty paths outside of project dir", async (t) => {
  let eleventyConfig = new TemplateConfig();
  eleventyConfig.userConfig.passthroughCopies = {
    "../static": { outputPath: true },
    "../*": { outputPath: "./" },
    "./test/stubs/template-passthrough2/static/*.css": { outputPath: "./" },
    "./test/stubs/template-passthrough2/static/*.js": { outputPath: "../../" },
    "./test/stubs/template-passthrough2/img.jpg": { outputPath: "../../" },
  };

  let mgr = new TemplatePassthroughManager(eleventyConfig);

  await t.throwsAsync(async function () {
    for (let path of mgr.getConfigPaths()) {
      let pass = mgr.getTemplatePassthroughForPath(path);
      await mgr.copyPassthrough(pass);
    }
  });

  const output = [
    "./test/stubs/template-passthrough2/_site/static",
    "./test/stubs/template-passthrough2/_site/nope.txt",
    "./test/stubs/template-passthrough2/_site/nope/",
    "./test/stubs/test.js",
    "./test/stubs/img.jpg",
  ];

  for (let path of output) {
    t.false(fs.existsSync(path));
  }
});

test("getAllNormalizedPaths", async (t) => {
  let eleventyConfig = new TemplateConfig();
  eleventyConfig.userConfig.passthroughCopies = {
    img: { outputPath: true },
  };

  let mgr = new TemplatePassthroughManager(eleventyConfig);
  t.deepEqual(mgr.getAllNormalizedPaths(), [
    { inputPath: "./img", outputPath: true, copyOptions: {} },
  ]);
});

test("getAllNormalizedPaths with globs", async (t) => {
  let eleventyConfig = new TemplateConfig();
  eleventyConfig.userConfig.passthroughCopies = {
    img: { outputPath: true },
    "img/**": { outputPath: "./" },
    "img/*.js": { outputPath: "./" },
  };

  let mgr = new TemplatePassthroughManager(eleventyConfig);
  t.deepEqual(mgr.getAllNormalizedPaths(), [
    { inputPath: "./img", outputPath: true, copyOptions: {} },
    { inputPath: "./img/**", outputPath: "", copyOptions: {} },
    { inputPath: "./img/*.js", outputPath: "", copyOptions: {} },
  ]);
});

test("Look for uniqueness on template passthrough paths #1677", async (t) => {
  let formats = [];
  let eleventyConfig = new TemplateConfig();
  eleventyConfig.userConfig.passthroughCopies = {
    "./test/stubs/template-passthrough-duplicates/**/*.png": { outputPath: "./", copyOptions: {} },
  };

  let files = new EleventyFiles(
    "test/stubs/template-passthrough-duplicates",
    "test/stubs/template-passthrough-duplicates/_site",
    formats,
    eleventyConfig
  );
  files.init();

  let mgr = files.getPassthroughManager();
  await t.throwsAsync(async function () {
    await mgr.copyAll();
  });

  fs.unlinkSync("test/stubs/template-passthrough-duplicates/_site/avatar.png");
});
