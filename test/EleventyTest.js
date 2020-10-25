const test = require("ava");
const Eleventy = require("../src/Eleventy");
const EleventyWatchTargets = require("../src/EleventyWatchTargets");
const templateConfig = require("../src/Config");

let config = {};

test.before(async () => {
  // This runs concurrently with the above
  await templateConfig.init();
  config = templateConfig.getConfig();
});

test("Eleventy, defaults inherit from config", async (t) => {
  let elev = new Eleventy();
  await elev.init();

  t.truthy(elev.input);
  t.truthy(elev.outputDir);
  t.is(elev.input, config.dir.input);
  t.is(elev.outputDir, config.dir.output);
});

test("Eleventy, get version", async (t) => {
  let elev = new Eleventy();
  await elev.init();

  t.truthy(elev.getVersion());
});

test("Eleventy, get help", async (t) => {
  let elev = new Eleventy();
  await elev.init();

  t.truthy(elev.getHelp());
});

test("Eleventy, set is verbose", async (t) => {
  let elev = new Eleventy();
  elev.setIsVerbose(true);
  await elev.init();

  t.true(elev.isVerbose);
});

test("Eleventy set input/output", async (t) => {
  let elev = new Eleventy("./test/stubs", "./test/stubs/_site");
  await elev.init();

  t.is(elev.input, "./test/stubs");
  t.is(elev.outputDir, "./test/stubs/_site");

  t.truthy(elev.templateData);
  t.truthy(elev.writer);
});

test("Eleventy file watching", async (t) => {
  let elev = new Eleventy("./test/stubs", "./test/stubs/_site");
  elev.setFormats("njk");
  await elev.init();

  await elev.eleventyFiles.getFiles();
  await elev.initWatch();
  t.deepEqual(await elev.getWatchedFiles(), [
    "./test/stubs/**/*.njk",
    "./test/stubs/_includes/**",
    "./test/stubs/_data/**",
    "./.eleventy.js",
    "./test/stubs/**/*.json",
    "./test/stubs/**/*.11tydata.cjs",
    "./test/stubs/**/*.11tydata.js",
    "./test/stubs/deps/dep1.js",
    "./test/stubs/deps/dep2.js",
  ]);
});

test("Eleventy file watching (don’t watch deps of passthrough copy .js files)", async (t) => {
  let elev = new Eleventy("./test/stubs-1325", "./test/stubs-1325/_site");
  elev.setFormats("11ty.js,js");
  await elev.init();

  await elev.eleventyFiles.getFiles();
  await elev.initWatch();

  t.deepEqual(await elev.eleventyFiles.getWatchPathCache(), [
    "./test/stubs-1325/test.11ty.js",
  ]);
});

test.only("Eleventy file watching (no JS dependencies)", async (t) => {
  let elev = new Eleventy("./test/stubs", "./test/stubs/_site");
  elev.setFormats("njk");
  await elev.init();

  let wt = new EleventyWatchTargets();
  wt.watchJavaScriptDependencies = false;
  elev.setWatchTargets(wt);

  await elev.eleventyFiles.getFiles();
  await elev.initWatch();
  const watchedFiles = await elev.getWatchedFiles();
  t.deepEqual(watchedFiles, [
    "./test/stubs/**/*.njk",
    "./test/stubs/_includes/**",
    "./test/stubs/_data/**",
    "./.eleventy.js",
    "./test/stubs/**/*.json",
    "./test/stubs/**/*.11tydata.cjs",
    "./test/stubs/**/*.11tydata.js",
  ]);
});

test("Eleventy set input/output, one file input", async (t) => {
  let elev = new Eleventy("./test/stubs/index.html", "./test/stubs/_site");
  await elev.init();

  t.is(elev.input, "./test/stubs/index.html");
  t.is(elev.inputDir, "./test/stubs");
  t.is(elev.outputDir, "./test/stubs/_site");
});

test("Eleventy set input/output, one file input root dir", async (t) => {
  let elev = new Eleventy("./README.md", "./test/stubs/_site");
  await elev.init();
  t.is(elev.input, "./README.md");
  t.is(elev.inputDir, ".");
  t.is(elev.outputDir, "./test/stubs/_site");
});

test("Eleventy set input/output, one file input root dir without leading dot/slash", async (t) => {
  let elev = new Eleventy("README.md", "./test/stubs/_site");
  await elev.init();

  t.is(elev.input, "README.md");
  t.is(elev.inputDir, ".");
  t.is(elev.outputDir, "./test/stubs/_site");
});

test("Eleventy set input/output, one file input exitCode", async (t) => {
  let previousExitCode = process.exitCode;
  let elev = new Eleventy(
    "./test/stubs/exitCode/failure.njk",
    "./test/stubs/exitCode/_site"
  );

  // TODO make this output quieter
  elev.setLogger({
    log: function () {},
    warn: function () {},
    error: function () {},
  });

  await elev.init();
  await elev.write();

  t.is(process.exitCode, 1);

  process.exitCode = previousExitCode;
});
