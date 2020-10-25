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

// Pug
test("Pug", (t) => {
  t.is(getNewTemplateRender("pug").getEngineName(), "pug");
});

test("Pug Render", async (t) => {
  let fn = await getNewTemplateRender("pug").getCompiledTemplate("p= name");
  t.is(await fn({ name: "Zach" }), "<p>Zach</p>");
});

test("Pug Render Include (Absolute)", async (t) => {
  let fn = await getNewTemplateRender("pug", "./test/stubs/")
    .getCompiledTemplate(`p
	include /included.pug`);
  t.is(await fn({ name: "Zach" }), "<p><span>This is an include.</span></p>");
});

test("Pug Render Include with Data", async (t) => {
  let fn = await getNewTemplateRender("pug", "./test/stubs/")
    .getCompiledTemplate(`p
	include /includedvar.pug`);
  t.is(await fn({ name: "Zach" }), "<p><span>This is Zach.</span></p>");
});

test("Pug Render Include with Data, inline var overrides data", async (t) => {
  let fn = await getNewTemplateRender("pug", "./test/stubs/")
    .getCompiledTemplate(`
- var name = "Bill";
p
	include /includedvar.pug`);
  t.is(await fn({ name: "Zach" }), "<p><span>This is Bill.</span></p>");
});

test("Pug Render Extends (Layouts)", async (t) => {
  let fn = await getNewTemplateRender("pug", "./test/stubs/")
    .getCompiledTemplate(`extends /layout.pug
block content
  h1= name`);
  t.is(await fn({ name: "Zach" }), "<html><body><h1>Zach</h1></body></html>");
});

test("Pug Render Extends (Relative, Layouts)", async (t) => {
  let fn = await getNewTemplateRender(
    "./test/stubs/does_not_exist_and_thats_ok.pug",
    "./test/stubs/"
  ).getCompiledTemplate(`extends ./layout-relative.pug
block content
  h1= name`);
  t.is(await fn({ name: "Zach" }), "<html><body><h1>Zach</h1></body></html>");
});

test("Pug Render Include (Relative)", async (t) => {
  let fn = await getNewTemplateRender("pug", "./test/stubs/")
    .getCompiledTemplate(`p
  include _includes/included.pug`);
  t.is(await fn({ name: "Zach" }), "<p><span>This is an include.</span></p>");
});

test("Pug Render Include (Relative, again)", async (t) => {
  let fn = await getNewTemplateRender(
    "./test/stubs/does_not_exist_and_thats_ok.pug",
    "./test/stubs/"
  ).getCompiledTemplate(`p
  include included.pug`);
  t.is(
    await fn({ name: "Zach" }),
    "<p><span>This is a relative include.</span></p>"
  );
});

test("Pug Render Include (Relative, dot slash)", async (t) => {
  let fn = await getNewTemplateRender(
    "./test/stubs/does_not_exist_and_thats_ok.pug",
    "./test/stubs/"
  ).getCompiledTemplate(`p
  include ./included.pug`);
  t.is(
    await fn({ name: "Zach" }),
    "<p><span>This is a relative include.</span></p>"
  );
});

test("Pug Render Include (Relative, dot dot slash)", async (t) => {
  let fn = await getNewTemplateRender(
    "./test/stubs/dir/does_not_exist_and_thats_ok.pug",
    "./test/stubs/"
  ).getCompiledTemplate(`p
  include ../included.pug`);
  t.is(
    await fn({ name: "Zach" }),
    "<p><span>This is a relative include.</span></p>"
  );
});

test("Pug Options Overrides", async (t) => {
  let tr = getNewTemplateRender("pug", "./test/stubs/");
  tr.engine.setPugOptions({ testoption: "testoverride" });

  let options = tr.engine.getPugOptions();
  t.is(options.testoption, "testoverride");
});

test("Pug getEngineLib", async (t) => {
  let tr = getNewTemplateRender("pug", "./test/stubs/");
  t.truthy(tr.engine.getEngineLib());
});

test("Pug Render: with Library Override", async (t) => {
  let tr = getNewTemplateRender("pug");

  let lib = require("pug");
  tr.engine.setLibrary(lib);

  let fn = await tr.getCompiledTemplate("p= name");
  t.is(await fn({ name: "Zach" }), "<p>Zach</p>");
});

test("Pug Filter", async (t) => {
  let tr = getNewTemplateRender("pug", "./test/stubs/");
  tr.engine.setPugOptions({
    filters: {
      makeUppercase: function (text, options) {
        return text.toUpperCase();
      },
    },
  });

  let fn = await tr.getCompiledTemplate(`p
  :makeUppercase()
    Zach
`);
  t.is(await fn({ name: "Test" }), "<p>ZACH</p>");
});

test("Pug Render with Function", async (t) => {
  let fn = await getNewTemplateRender("pug").getCompiledTemplate("p= name()");
  t.is(
    await fn({
      name: function () {
        return "Zach2";
      },
    }),
    "<p>Zach2</p>"
  );
});
