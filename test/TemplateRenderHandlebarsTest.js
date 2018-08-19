import test from "ava";
import TemplateRender from "../src/TemplateRender";

// Handlebars
test("Handlebars", t => {
  t.is(new TemplateRender("hbs").getEngineName(), "hbs");
});

test("Handlebars Render", async t => {
  let fn = await new TemplateRender("hbs").getCompiledTemplate(
    "<p>{{name}}</p>"
  );
  t.is(await fn({ name: "Zach" }), "<p>Zach</p>");
});

test("Handlebars Render Unescaped Output (no HTML)", async t => {
  let fn = await new TemplateRender("hbs").getCompiledTemplate(
    "<p>{{{name}}}</p>"
  );
  t.is(await fn({ name: "Zach" }), "<p>Zach</p>");
});

test("Handlebars Render Escaped Output", async t => {
  let fn = await new TemplateRender("hbs").getCompiledTemplate(
    "<p>{{name}}</p>"
  );
  t.is(await fn({ name: "<b>Zach</b>" }), "<p>&lt;b&gt;Zach&lt;/b&gt;</p>");
});

test("Handlebars Render Unescaped Output (HTML)", async t => {
  let fn = await new TemplateRender("hbs").getCompiledTemplate(
    "<p>{{{name}}}</p>"
  );
  t.is(await fn({ name: "<b>Zach</b>" }), "<p><b>Zach</b></p>");
});

test("Handlebars Render Partial", async t => {
  let fn = await new TemplateRender("hbs", "./test/stubs/").getCompiledTemplate(
    "<p>{{> included}}</p>"
  );
  t.is(await fn(), "<p>This is an include.</p>");
});

test("Handlebars Render Partial (Subdirectory)", async t => {
  let fn = await new TemplateRender("hbs", "./test/stubs/").getCompiledTemplate(
    "<p>{{> subfolder/included}}</p>"
  );
  t.is(await fn(), "<p>This is an include.</p>");
});

test("Handlebars Render Partial with variable", async t => {
  let fn = await new TemplateRender("hbs", "./test/stubs/").getCompiledTemplate(
    "<p>{{> includedvar}}</p>"
  );
  t.is(await fn({ name: "Zach" }), "<p>This is a Zach.</p>");
});

test("Handlebars Render: with Library Override", async t => {
  let tr = new TemplateRender("hbs");

  let lib = require("handlebars");
  tr.engine.setLibrary(lib);

  let fn = await tr.getCompiledTemplate("<p>{{name}}</p>");
  t.is(await fn({ name: "Zach" }), "<p>Zach</p>");
});

test("Handlebars Render Helper", async t => {
  let tr = new TemplateRender("hbs");
  tr.engine.addHelpers({
    helpername: function() {
      return "Zach";
    }
  });

  let fn = await tr.getCompiledTemplate(
    "<p>This is a {{helpername}} {{name}}.</p>"
  );
  t.is(await fn({ name: "Zach" }), "<p>This is a Zach Zach.</p>");
});

test("Handlebars Render Helper", async t => {
  let tr = new TemplateRender("hbs");
  tr.engine.addHelpers({
    helpername2: function(name) {
      return "Zach";
    }
  });

  let fn = await tr.getCompiledTemplate(
    "<p>This is a {{helpername2 name}}.</p>"
  );
  t.is(await fn({ name: "Zach" }), "<p>This is a Zach.</p>");
});

test("Handlebars Render Shortcode", async t => {
  let tr = new TemplateRender("hbs");
  tr.engine.addShortcodes({
    shortcodename: function(name) {
      return name.toUpperCase();
    }
  });

  let fn = await tr.getCompiledTemplate(
    "<p>This is a {{shortcodename name}}.</p>"
  );
  t.is(await fn({ name: "Howdy" }), "<p>This is a HOWDY.</p>");
});

test("Handlebars Render Shortcode (Multiple args)", async t => {
  let tr = new TemplateRender("hbs");
  tr.engine.addShortcodes({
    shortcodename2: function(name, name2) {
      return name.toUpperCase() + name2.toUpperCase();
    }
  });

  let fn = await tr.getCompiledTemplate(
    "<p>This is a {{shortcodename2 name name2}}.</p>"
  );
  t.is(
    await fn({ name: "Howdy", name2: "Zach" }),
    "<p>This is a HOWDYZACH.</p>"
  );
});

test("Handlebars Render Paired Shortcode", async t => {
  let tr = new TemplateRender("hbs");
  tr.engine.addPairedShortcodes({
    shortcodename3: function(content, name, options) {
      return (content + name).toUpperCase();
    }
  });

  let fn = await tr.getCompiledTemplate(
    "<p>This is a {{#shortcodename3 name}}Testing{{/shortcodename3}}.</p>"
  );
  t.is(await fn({ name: "Howdy" }), "<p>This is a TESTINGHOWDY.</p>");
});

test("Handlebars Render Paired Shortcode (Spaces)", async t => {
  let tr = new TemplateRender("hbs");
  tr.engine.addPairedShortcodes({
    shortcodename4: function(content, name, options) {
      return (content + name).toUpperCase();
    }
  });

  let fn = await tr.getCompiledTemplate(
    "<p>This is a {{# shortcodename4 name }}Testing{{/ shortcodename4 }}.</p>"
  );
  t.is(await fn({ name: "Howdy" }), "<p>This is a TESTINGHOWDY.</p>");
});

test("Handlebars Render Paired Shortcode with a Nested Single Shortcode", async t => {
  let tr = new TemplateRender("hbs");
  tr.engine.addShortcodes({
    shortcodechild: function(txt, options) {
      return txt;
    }
  });

  tr.engine.addPairedShortcodes({
    shortcodeparent: function(content, name, name2, options) {
      return (content + name + name2).toUpperCase();
    }
  });

  let fn = await tr.getCompiledTemplate(
    "<p>This is a {{# shortcodeparent name name2 }}{{shortcodechild 'CHILD CONTENT'}}{{/ shortcodeparent }}.</p>"
  );
  t.is(
    await fn({ name: "Howdy", name2: "Zach" }),
    "<p>This is a CHILD CONTENTHOWDYZACH.</p>"
  );
});
