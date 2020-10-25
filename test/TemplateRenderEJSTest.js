const test = require("ava");
const TemplateRender = require("../src/TemplateRender");
const EleventyExtensionMap = require("../src/EleventyExtensionMap");
const templateConfig = require("../src/Config");

test.before(async () => {
  // This runs concurrently with the above
  await templateConfig.init();
});

function getNewTemplateRender(name, inputDir) {
  let tr = new TemplateRender(name, inputDir, templateConfig);
  tr.extensionMap = new EleventyExtensionMap([], templateConfig);
  return tr;
}

// EJS
test("EJS", (t) => {
  t.is(getNewTemplateRender("ejs").getEngineName(), "ejs");
  t.is(
    getNewTemplateRender("./test/stubs/filename.ejs").getEngineName(),
    "ejs"
  );
});

test("EJS Render", async (t) => {
  let fn = await getNewTemplateRender("ejs").getCompiledTemplate(
    "<p><%= name %></p>"
  );
  t.is(await fn({ name: "Zach" }), "<p>Zach</p>");
});

test("EJS Render Absolute Include, Fxn no Data", async (t) => {
  // includes require a full filename passed in
  let fn = await getNewTemplateRender(
    "./test/stubs/filename.ejs",
    "./test/stubs/"
  ).getCompiledTemplate("<p><%- include('/included') %></p>");
  t.is(await fn(), "<p>This is an include.</p>");
});

test("EJS Render Absolute Include, Fxn with Data", async (t) => {
  // includes require a full filename passed in
  let fn = await getNewTemplateRender(
    "./test/stubs/filename.ejs",
    "./test/stubs/"
  ).getCompiledTemplate(
    "<p><%- include('/includedvar', { name: 'Bill' }) %></p>"
  );
  t.is(await fn(), "<p>This is an Bill.</p>");
});

test("EJS Render Relative Include (no leading dot-slash for current dir)", async (t) => {
  // includes require a full filename passed in
  let fn = await getNewTemplateRender(
    "./test/stubs/relative-ejs/dir/filename.ejs",
    "./test/stubs/"
  ).getCompiledTemplate("<p><%- include('included') -%></p>");
  t.is(await fn(), "<p>This is an include.</p>");
});

test("EJS Render Relative Include Current dir to Subdir", async (t) => {
  // includes require a full filename passed in
  let fn = await getNewTemplateRender(
    "./test/stubs/relative-ejs/filename.ejs",
    "./test/stubs/"
  ).getCompiledTemplate("<p><%- include('./dir/included') -%></p>");
  t.is(await fn(), "<p>This is an include.</p>");
});

test("EJS Render Relative Include Parent dir to Subdir", async (t) => {
  // includes require a full filename passed in
  let fn = await getNewTemplateRender(
    "./test/stubs/relative-ejs/dir/filename.ejs",
    "./test/stubs/"
  ).getCompiledTemplate("<p><%- include('../dir/included') -%></p>");
  t.is(await fn(), "<p>This is an include.</p>");
});

test("EJS Render Relative Include, Fxn no Data", async (t) => {
  // includes require a full filename passed in
  let fn = await getNewTemplateRender(
    "./test/stubs/filename.ejs",
    "./test/stubs/"
  ).getCompiledTemplate("<p><%- include('_includes/included', {}) %></p>");
  t.is(await fn(), "<p>This is an include.</p>");
});

test("EJS Render Relative Include current dir to subdir, Fxn no Data", async (t) => {
  // includes require a full filename passed in
  let fn = await getNewTemplateRender(
    "./test/stubs/relative-ejs/filename.ejs",
    "./test/stubs/"
  ).getCompiledTemplate("<p><%- include('./dir/included', {}) %></p>");
  t.is(await fn(), "<p>This is an include.</p>");
});

test("EJS Render Relative Include, Fxn with Data", async (t) => {
  // includes require a full filename passed in
  let fn = await getNewTemplateRender(
    "./test/stubs/filename.ejs",
    "./test/stubs/"
  ).getCompiledTemplate(
    "<p><%- include('_includes/includedvar', { name: 'Bill' }) %></p>"
  );
  t.is(await fn(), "<p>This is an Bill.</p>");
});

test("EJS Render: with Library Override", async (t) => {
  let tr = getNewTemplateRender("ejs");

  let lib = require("ejs");
  tr.engine.setLibrary(lib);

  let fn = await tr.getCompiledTemplate("<p><%= name %></p>");
  t.is(await fn({ name: "Zach" }), "<p>Zach</p>");
});
