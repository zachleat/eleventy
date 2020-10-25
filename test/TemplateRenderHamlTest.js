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
// Haml
test("Haml", (t) => {
  t.is(getNewTemplateRender("haml").getEngineName(), "haml");
});

test("Haml Render", async (t) => {
  let fn = await getNewTemplateRender("haml").getCompiledTemplate("%p= name");
  t.is((await fn({ name: "Zach" })).trim(), "<p>Zach</p>");
});

test("Haml Render: with Library Override", async (t) => {
  let tr = getNewTemplateRender("haml");

  let lib = require("hamljs");
  tr.engine.setLibrary(lib);

  let fn = await tr.getCompiledTemplate("%p= name");
  t.is((await fn({ name: "Zach" })).trim(), "<p>Zach</p>");
});
