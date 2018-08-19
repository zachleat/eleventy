import test from "ava";
import TemplateRender from "../src/TemplateRender";

// Nunjucks
test("Nunjucks", t => {
  t.is(new TemplateRender("njk").getEngineName(), "njk");
});

test("Nunjucks Render", async t => {
  let fn = await new TemplateRender("njk").getCompiledTemplate(
    "<p>{{ name }}</p>"
  );
  t.is(await fn({ name: "Zach" }), "<p>Zach</p>");
});

test("Nunjucks Render Extends", async t => {
  let fn = await new TemplateRender("njk", "test/stubs").getCompiledTemplate(
    "{% extends 'base.njk' %}{% block content %}This is a child.{% endblock %}"
  );
  t.is(await fn(), "<p>This is a child.</p>");
});

test("Nunjucks Render Include", async t => {
  let fn = await new TemplateRender("njk", "test/stubs").getCompiledTemplate(
    "<p>{% include 'included.njk' %}</p>"
  );
  t.is(await fn(), "<p>This is an include.</p>");
});

test("Nunjucks Render Include Subfolder", async t => {
  let fn = await new TemplateRender("njk", "test/stubs").getCompiledTemplate(
    "<p>{% include 'subfolder/included.html' %}</p>"
  );
  t.is(await fn(), "<p>This is an include.</p>");
});

test("Nunjucks Render Include Double Quotes", async t => {
  let fn = await new TemplateRender("njk", "test/stubs").getCompiledTemplate(
    `<p>{% include "included.njk" %}</p>`
  );
  t.is(await fn(), "<p>This is an include.</p>");
});

test("Nunjucks Render Include Subfolder Double Quotes", async t => {
  let fn = await new TemplateRender("njk", "test/stubs").getCompiledTemplate(
    `<p>{% include "subfolder/included.html" %}</p>`
  );
  t.is(await fn(), "<p>This is an include.</p>");
});

test("Nunjucks Render Imports", async t => {
  let fn = await new TemplateRender("njk", "test/stubs").getCompiledTemplate(
    "{% import 'imports.njk' as forms %}<div>{{ forms.label('Name') }}</div>"
  );
  t.is(await fn(), "<div><label>Name</label></div>");
});

test("Nunjucks Render Imports From", async t => {
  let fn = await new TemplateRender("njk", "test/stubs").getCompiledTemplate(
    "{% from 'imports.njk' import label %}<div>{{ label('Name') }}</div>"
  );
  t.is(await fn(), "<div><label>Name</label></div>");
});

test("Nunjucks getEngineLib", async t => {
  let tr = new TemplateRender("njk", "./test/stubs/");
  t.truthy(tr.engine.getEngineLib());
});

test("Nunjucks Render: with Library Override", async t => {
  let tr = new TemplateRender("njk");

  let lib = require("nunjucks");
  let env = new lib.Environment(
    new lib.FileSystemLoader("./test/stubs/_includes/")
  );
  tr.engine.setLibrary(env);

  let fn = await tr.getCompiledTemplate("<p>{{ name }}</p>");
  t.is(await fn({ name: "Zach" }), "<p>Zach</p>");
});

test("Nunjucks Shortcode", async t => {
  let tr = new TemplateRender("njk", "./test/stubs/");
  tr.engine.addShortcode("postfixWithZach", function(str) {
    return str + "Zach";
  });

  t.is(
    await tr.render("{% postfixWithZach name %}", { name: "test" }),
    "testZach"
  );
});

test("Nunjucks Shortcode Safe Output", async t => {
  let tr = new TemplateRender("njk", "./test/stubs/");
  tr.engine.addShortcode("postfixWithZach", function(str) {
    return `<span>${str}</span>`;
  });

  t.is(
    await tr.render("{% postfixWithZach name %}", { name: "test" }),
    "<span>test</span>"
  );
});

test("Nunjucks Paired Shortcode", async t => {
  let tr = new TemplateRender("njk", "./test/stubs/");
  tr.engine.addPairedShortcode("postfixWithZach", function(content, str) {
    return str + content + "Zach";
  });

  t.is(
    await tr.render(
      "{% postfixWithZach name %}Content{% endpostfixWithZach %}",
      { name: "test" }
    ),
    "testContentZach"
  );
});

test("Nunjucks Paired Shortcode with Tag Inside", async t => {
  let tr = new TemplateRender("njk", "./test/stubs/");
  tr.engine.addPairedShortcode("postfixWithZach", function(content, str) {
    return str + content + "Zach";
  });

  t.is(
    await tr.render(
      "{% postfixWithZach name %}Content{% if tester %}If{% endif %}{% endpostfixWithZach %}",
      { name: "test", tester: true }
    ),
    "testContentIfZach"
  );
});

test("Nunjucks Nested Paired Shortcode", async t => {
  let tr = new TemplateRender("njk", "./test/stubs/");
  tr.engine.addPairedShortcode("postfixWithZach", function(content, str) {
    return str + content + "Zach";
  });

  t.is(
    await tr.render(
      "{% postfixWithZach name %}Content{% postfixWithZach name2 %}Content{% endpostfixWithZach %}{% endpostfixWithZach %}",
      { name: "test", name2: "test2" }
    ),
    "testContenttest2ContentZachZach"
  );
});

test("Nunjucks Shortcode Multiple Args", async t => {
  let tr = new TemplateRender("njk", "./test/stubs/");
  tr.engine.addShortcode("postfixWithZach", function(str, str2) {
    return str + str2 + "Zach";
  });

  t.is(
    await tr.render("{% postfixWithZach name, other %}", {
      name: "test",
      other: "howdy"
    }),
    "testhowdyZach"
  );
});

test("Nunjucks Shortcode Named Args", async t => {
  let tr = new TemplateRender("njk", "./test/stubs/");
  tr.engine.addShortcode("postfixWithZach", function(arg) {
    return arg.arg1 + arg.arg2 + "Zach";
  });

  t.is(
    await tr.render("{% postfixWithZach arg1=name, arg2=other %}", {
      name: "test",
      other: "howdy"
    }),
    "testhowdyZach"
  );
});

test("Nunjucks Shortcode Named Args (Reverse Order)", async t => {
  let tr = new TemplateRender("njk", "./test/stubs/");
  tr.engine.addShortcode("postfixWithZach", function(arg) {
    return arg.arg1 + arg.arg2 + "Zach";
  });

  t.is(
    await tr.render("{% postfixWithZach arg2=other, arg1=name %}", {
      name: "test",
      other: "howdy"
    }),
    "testhowdyZach"
  );
});

test("Nunjucks Shortcode Named Args (JS notation)", async t => {
  let tr = new TemplateRender("njk", "./test/stubs/");
  tr.engine.addShortcode("postfixWithZach", function(arg) {
    return arg.arg1 + arg.arg2 + "Zach";
  });

  t.is(
    await tr.render("{% postfixWithZach { arg1: name, arg2: other } %}", {
      name: "test",
      other: "howdy"
    }),
    "testhowdyZach"
  );
});
