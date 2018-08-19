import test from "ava";
import TemplateRender from "../src/TemplateRender";

// EJS
test("EJS", t => {
  t.is(new TemplateRender("ejs").getEngineName(), "ejs");
  t.is(new TemplateRender("./test/stubs/filename.ejs").getEngineName(), "ejs");
});

test("EJS Render", async t => {
  let fn = await new TemplateRender("ejs").getCompiledTemplate(
    "<p><%= name %></p>"
  );
  t.is(await fn({ name: "Zach" }), "<p>Zach</p>");
});

test("EJS Render Absolute Include, Preprocessor Directive", async t => {
  // includes require a full filename passed in
  let fn = await new TemplateRender(
    "./test/stubs/filename.ejs",
    "./test/stubs/"
  ).getCompiledTemplate("<p><% include /included %></p>");
  t.is(await fn(), "<p>This is an include.</p>");
});

test("EJS Render Absolute Include, Fxn no Data", async t => {
  // includes require a full filename passed in
  let fn = await new TemplateRender(
    "./test/stubs/filename.ejs",
    "./test/stubs/"
  ).getCompiledTemplate("<p><%- include('/included') %></p>");
  t.is(await fn(), "<p>This is an include.</p>");
});

test("EJS Render Absolute Include, Fxn with Data", async t => {
  // includes require a full filename passed in
  let fn = await new TemplateRender(
    "./test/stubs/filename.ejs",
    "./test/stubs/"
  ).getCompiledTemplate(
    "<p><%- include('/includedvar', { name: 'Bill' }) %></p>"
  );
  t.is(await fn(), "<p>This is an Bill.</p>");
});

test("EJS Render Relative Include, Preprocessor Directive", async t => {
  // includes require a full filename passed in
  let fn = await new TemplateRender(
    "./test/stubs/filename.ejs",
    "./test/stubs/"
  ).getCompiledTemplate("<p><% include _includes/included %></p>");
  t.is(await fn(), "<p>This is an include.</p>");
});

test("EJS Render Relative Include, Fxn no Data", async t => {
  // includes require a full filename passed in
  let fn = await new TemplateRender(
    "./test/stubs/filename.ejs",
    "./test/stubs/"
  ).getCompiledTemplate("<p><%- include('_includes/included', {}) %></p>");
  t.is(await fn(), "<p>This is an include.</p>");
});

test("EJS Render Relative Include, Fxn with Data", async t => {
  // includes require a full filename passed in
  let fn = await new TemplateRender(
    "./test/stubs/filename.ejs",
    "./test/stubs/"
  ).getCompiledTemplate(
    "<p><%- include('_includes/includedvar', { name: 'Bill' }) %></p>"
  );
  t.is(await fn(), "<p>This is an Bill.</p>");
});

test("EJS Render: with Library Override", async t => {
  let tr = new TemplateRender("ejs");

  let lib = require("ejs");
  tr.engine.setLibrary(lib);

  let fn = await tr.getCompiledTemplate("<p><%= name %></p>");
  t.is(await fn({ name: "Zach" }), "<p>Zach</p>");
});
