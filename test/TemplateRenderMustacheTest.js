import test from "ava";
import TemplateRender from "../src/TemplateRender";

// Mustache
test("Mustache", async t => {
  t.is(new TemplateRender("mustache").getEngineName(), "mustache");
});

test("Mustache Render", async t => {
  let fn = await new TemplateRender("mustache").getCompiledTemplate(
    "<p>{{name}}</p>"
  );
  t.is(await fn({ name: "Zach" }), "<p>Zach</p>");
});

test("Mustache Render Partial", async t => {
  let fn = await new TemplateRender(
    "mustache",
    "./test/stubs/"
  ).getCompiledTemplate("<p>{{> included}}</p>");
  t.is(await fn(), "<p>This is an include.</p>");
});

test("Mustache Render Partial", async t => {
  let fn = await new TemplateRender(
    "mustache",
    "./test/stubs/"
  ).getCompiledTemplate("<p>{{> includedvar}}</p>");
  t.is(await fn({ name: "Zach" }), "<p>This is a Zach.</p>");
});

test("Mustache Render Partial (Subdirectory)", async t => {
  let fn = await new TemplateRender(
    "mustache",
    "./test/stubs/"
  ).getCompiledTemplate("<p>{{> subfolder/included}}</p>");
  t.is(await fn({ name: "Zach" }), "<p>This is an include.</p>");
});

test("Mustache Render: with Library Override", async t => {
  let tr = new TemplateRender("mustache");

  let lib = require("mustache");
  tr.engine.setLibrary(lib);

  let fn = await tr.getCompiledTemplate("<p>{{name}}</p>");
  t.is(await fn({ name: "Zach" }), "<p>Zach</p>");
});

test("Mustache Render Unescaped Output (no HTML)", async t => {
  let fn = await new TemplateRender("mustache").getCompiledTemplate(
    "<p>{{{name}}}</p>"
  );
  t.is(await fn({ name: "Zach" }), "<p>Zach</p>");
});

test("Mustache Render Escaped Output", async t => {
  let fn = await new TemplateRender("mustache").getCompiledTemplate(
    "<p>{{name}}</p>"
  );
  t.is(
    await fn({ name: "<b>Zach</b>" }),
    "<p>&lt;b&gt;Zach&lt;&#x2F;b&gt;</p>"
  );
});

test("Mustache Render Unescaped Output (HTML)", async t => {
  let fn = await new TemplateRender("mustache").getCompiledTemplate(
    "<p>{{{name}}}</p>"
  );
  t.is(await fn({ name: "<b>Zach</b>" }), "<p><b>Zach</b></p>");
});
