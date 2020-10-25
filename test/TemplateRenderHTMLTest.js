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
// HTML
test("HTML", (t) => {
  t.is(getNewTemplateRender("html").getEngineName(), "html");
});

test("HTML Render", async (t) => {
  let fn = await getNewTemplateRender("html").getCompiledTemplate(
    "<p>Paragraph</p>"
  );
  t.is(await fn(), "<p>Paragraph</p>");
  t.is(await fn({}), "<p>Paragraph</p>");
});

test("HTML Render: Parses HTML using liquid engine (default, with data)", async (t) => {
  let fn = await getNewTemplateRender("html").getCompiledTemplate(
    "<h1>{{title}}</h1>"
  );
  t.is((await fn({ title: "My Title" })).trim(), "<h1>My Title</h1>");
});

test("HTML Render: Parses HTML using ejs engine", async (t) => {
  let tr = getNewTemplateRender("html");
  tr.setHtmlEngine("ejs");
  let fn = await tr.getCompiledTemplate("<h1><%=title %></h1>");
  t.is((await fn({ title: "My Title" })).trim(), "<h1>My Title</h1>");
});

test("HTML Render: Set HTML engine to false, don’t parse", async (t) => {
  let tr = getNewTemplateRender("html");
  tr.setHtmlEngine(false);
  let fn = await tr.getCompiledTemplate("<h1>{{title}}</h1>");
  t.is((await fn()).trim(), "<h1>{{title}}</h1>");
});

test("HTML Render: Pass in an override (ejs)", async (t) => {
  let tr = getNewTemplateRender("html");
  tr.setHtmlEngine("ejs");
  let fn = await tr.getCompiledTemplate("<h1><%= title %></h1>");
  t.is((await fn({ title: "My Title" })).trim(), "<h1>My Title</h1>");
});

test("HTML Render: Pass in an override (liquid)", async (t) => {
  let tr = getNewTemplateRender("html");
  tr.setHtmlEngine("liquid");
  let fn = await tr.getCompiledTemplate("<h1>{{title}}</h1>");

  t.is((await fn({ title: "My Title" })).trim(), "<h1>My Title</h1>");
});
