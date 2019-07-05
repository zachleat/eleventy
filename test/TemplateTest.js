import test from "ava";
import fs from "fs-extra";
import pretty from "pretty";
import TemplateData from "../src/TemplateData";
import Template from "../src/Template";
import EleventyErrorUtil from "../src/EleventyErrorUtil";
import TemplateContentPrematureUseError from "../src/Errors/TemplateContentPrematureUseError";
import templateConfig from "../src/Config";
import normalizeNewLines from "./Util/normalizeNewLines";

const config = templateConfig.getConfig();

function cleanHtml(str) {
  return pretty(str, { ocd: true });
}

test("getTemplateSubFolder", t => {
  let tmpl = new Template(
    "./test/stubs/template.ejs",
    "./test/stubs/",
    "./dist"
  );
  t.is(tmpl.getTemplateSubfolder(), "");
});

test("getTemplateSubFolder, output is a subdir of input", t => {
  let tmpl = new Template(
    "./test/stubs/template.ejs",
    "./test/stubs/",
    "./test/stubs/_site"
  );
  t.is(tmpl.getTemplateSubfolder(), "");
});

test("output path maps to an html file", async t => {
  let tmpl = new Template(
    "./test/stubs/template.ejs",
    "./test/stubs/",
    "./dist"
  );
  t.is(tmpl.parsed.dir, "./test/stubs");
  t.is(tmpl.inputDir, "./test/stubs");
  t.is(tmpl.outputDir, "./dist");
  t.is(tmpl.getTemplateSubfolder(), "");
  t.is(await tmpl.getOutputPath(), "./dist/template/index.html");
});

test("subfolder outputs to a subfolder", async t => {
  let tmpl = new Template(
    "./test/stubs/subfolder/subfolder.ejs",
    "./test/stubs/",
    "./dist"
  );
  t.is(tmpl.parsed.dir, "./test/stubs/subfolder");
  t.is(tmpl.getTemplateSubfolder(), "subfolder");
  t.is(await tmpl.getOutputPath(), "./dist/subfolder/index.html");
});

test("subfolder outputs to double subfolder", async t => {
  let tmpl = new Template(
    "./test/stubs/subfolder/subfolder/subfolder.ejs",
    "./test/stubs/",
    "./dist"
  );
  t.is(tmpl.parsed.dir, "./test/stubs/subfolder/subfolder");
  t.is(tmpl.getTemplateSubfolder(), "subfolder/subfolder");
  t.is(await tmpl.getOutputPath(), "./dist/subfolder/subfolder/index.html");
});

test("HTML files output to the same as the input directory have a file suffix added (only if index, this is not index).", async t => {
  let tmpl = new Template(
    "./test/stubs/testing.html",
    "./test/stubs",
    "./test/stubs"
  );
  t.is(await tmpl.getOutputPath(), "./test/stubs/testing/index.html");
});

test("HTML files output to the same as the input directory have a file suffix added (only if index, this _is_ index).", async t => {
  let tmpl = new Template(
    "./test/stubs/index.html",
    "./test/stubs",
    "./test/stubs"
  );
  t.is(await tmpl.getOutputPath(), "./test/stubs/index-o.html");
});

test("HTML files output to the same as the input directory have a file suffix added (only if index, this _is_ index, subfolder).", async t => {
  let tmpl = new Template(
    "./test/stubs/subfolder/index.html",
    "./test/stubs",
    "./test/stubs"
  );
  t.is(await tmpl.getOutputPath(), "./test/stubs/subfolder/index-o.html");
});

test("Test raw front matter from template (yaml)", async t => {
  // https://github.com/jonschlinkert/gray-matter/blob/master/examples/yaml.js
  let tmpl = new Template(
    "./test/stubs/templateFrontMatter.ejs",
    "./test/stubs/",
    "./dist"
  );
  t.truthy(await tmpl.getInputContent(), "template exists and can be opened.");

  t.is((await tmpl.getFrontMatter()).data.key1, "value1");
  t.is((await tmpl.getFrontMatter()).data.key3, "value3");

  let data = await tmpl.getData();
  t.is(data.key1, "value1");
  t.is(data.key3, "value3");

  let pages = await tmpl.getRenderedTemplates(data);
  t.is(pages[0].templateContent.trim(), "c:value1:value2:value3");
});

test("Test raw front matter from template (json)", async t => {
  // https://github.com/jonschlinkert/gray-matter/blob/master/examples/json.js
  let tmpl = new Template(
    "./test/stubs/templateFrontMatterJson.ejs",
    "./test/stubs/",
    "./dist"
  );

  t.is((await tmpl.getFrontMatter()).data.key1, "value1");
  t.is((await tmpl.getFrontMatter()).data.key3, "value3");

  let data = await tmpl.getData();
  t.is(data.key1, "value1");
  t.is(data.key3, "value3");

  let pages = await tmpl.getRenderedTemplates(data);
  t.is(pages[0].templateContent.trim(), "c:value1:value2:value3");
});

test("Test raw front matter from template (js)", async t => {
  // https://github.com/jonschlinkert/gray-matter/blob/master/examples/javascript.js
  let tmpl = new Template(
    "./test/stubs/templateFrontMatterJs.ejs",
    "./test/stubs/",
    "./dist"
  );

  t.is((await tmpl.getFrontMatter()).data.key1, "value1");
  t.is((await tmpl.getFrontMatter()).data.key3, "value3");

  let data = await tmpl.getData();
  t.is(data.key1, "value1");
  t.is(data.key3, "value3");

  let pages = await tmpl.getRenderedTemplates(data);
  t.is(pages[0].templateContent.trim(), "c:value1:VALUE2:value3");
});

test("Test that getData() works", async t => {
  let tmpl = new Template(
    "./test/stubs/templateFrontMatter.ejs",
    "./test/stubs/",
    "./dist"
  );
  let data = await tmpl.getData();

  t.is(data.key1, "value1");
  t.is(data.key3, "value3");
});

test("One Layout (using new content var)", async t => {
  let dataObj = new TemplateData("./test/stubs/");
  let tmpl = new Template(
    "./test/stubs/templateWithLayout.ejs",
    "./test/stubs/",
    "dist",
    dataObj
  );

  t.is((await tmpl.getFrontMatter()).data[config.keys.layout], "defaultLayout");

  let data = await tmpl.getData();
  t.is(data[config.keys.layout], "defaultLayout");

  t.is(
    normalizeNewLines(cleanHtml(await tmpl.renderLayout(tmpl, data))),
    `<div id="layout">
  <p>Hello.</p>
</div>`
  );

  t.is(data.keymain, "valuemain");
  t.is(data.keylayout, "valuelayout");
});

test("One Layout (using layoutContent)", async t => {
  let dataObj = new TemplateData("./test/stubs/");
  let tmpl = new Template(
    "./test/stubs/templateWithLayoutContent.ejs",
    "./test/stubs/",
    "dist",
    dataObj
  );

  t.is(
    (await tmpl.getFrontMatter()).data[config.keys.layout],
    "defaultLayoutLayoutContent"
  );

  let data = await tmpl.getData();
  t.is(data[config.keys.layout], "defaultLayoutLayoutContent");

  t.is(
    normalizeNewLines(cleanHtml(await tmpl.renderLayout(tmpl, data))),
    `<div id="layout">
  <p>Hello.</p>
</div>`
  );

  t.is(data.keymain, "valuemain");
  t.is(data.keylayout, "valuelayout");
});

test("One Layout (layouts disabled)", async t => {
  let dataObj = new TemplateData("./test/stubs/");
  let tmpl = new Template(
    "./test/stubs/templateWithLayoutContent.ejs",
    "./test/stubs/",
    "dist",
    dataObj
  );

  tmpl.setWrapWithLayouts(false);

  t.is(
    (await tmpl.getFrontMatter()).data[config.keys.layout],
    "defaultLayoutLayoutContent"
  );

  let data = await tmpl.getData();
  t.is(data[config.keys.layout], "defaultLayoutLayoutContent");

  t.is(cleanHtml(await tmpl.render(data)), "<p>Hello.</p>");

  t.is(data.keymain, "valuemain");
  t.is(data.keylayout, "valuelayout");
});

test("One Layout (_layoutContent deprecated but supported)", async t => {
  let dataObj = new TemplateData("./test/stubs/");
  let tmpl = new Template(
    "./test/stubs/templateWithLayoutBackCompat.ejs",
    "./test/stubs/",
    "dist",
    dataObj
  );

  t.is(
    (await tmpl.getFrontMatter()).data[config.keys.layout],
    "defaultLayout_layoutContent"
  );

  let data = await tmpl.getData();
  t.is(data[config.keys.layout], "defaultLayout_layoutContent");

  t.is(
    normalizeNewLines(cleanHtml(await tmpl.renderLayout(tmpl, data))),
    `<div id="layout">
  <p>Hello.</p>
</div>`
  );

  t.is(data.keymain, "valuemain");
  t.is(data.keylayout, "valuelayout");
});

test("One Layout (liquid test)", async t => {
  let dataObj = new TemplateData("./test/stubs/");
  let tmpl = new Template(
    "./test/stubs/templateWithLayout.liquid",
    "./test/stubs/",
    "dist",
    dataObj
  );

  t.is(
    (await tmpl.getFrontMatter()).data[config.keys.layout],
    "layoutLiquid.liquid"
  );

  let data = await tmpl.getData();
  t.is(data[config.keys.layout], "layoutLiquid.liquid");

  t.is(
    normalizeNewLines(cleanHtml(await tmpl.renderLayout(tmpl, data))),
    `<div id="layout">
  <p>Hello.</p>
</div>`
  );

  t.is(data.keymain, "valuemain");
  t.is(data.keylayout, "valuelayout");
});

test("Two Layouts", async t => {
  let dataObj = new TemplateData("./test/stubs/");
  let tmpl = new Template(
    "./test/stubs/templateTwoLayouts.ejs",
    "./test/stubs/",
    "dist",
    dataObj
  );

  t.is((await tmpl.getFrontMatter()).data[config.keys.layout], "layout-a");

  let data = await tmpl.getData();
  t.is(data[config.keys.layout], "layout-a");
  t.is(data.key1, "value1");

  t.is(
    normalizeNewLines(cleanHtml(await tmpl.renderLayout(tmpl, data))),
    `<div id="layout-b">
  <div id="layout-a">
    <p>value2-a</p>
  </div>
</div>`
  );

  t.is(data.daysPosted, 152);
});

test("Liquid template", async t => {
  let dataObj = new TemplateData("./test/stubs/");
  let tmpl = new Template(
    "./test/stubs/formatTest.liquid",
    "./test/stubs/",
    "dist",
    dataObj
  );

  t.is(await tmpl.render(), `<p>Zach</p>`);
});

test("Liquid template with include", async t => {
  let tmpl = new Template(
    "./test/stubs/includer.liquid",
    "./test/stubs/",
    "dist"
  );

  t.is((await tmpl.render()).trim(), "<p>This is an include.</p>");
});

test("ES6 Template Literal (No Backticks)", async t => {
  let dataObj = new TemplateData("./test/stubs/");
  let tmpl = new Template(
    "./test/stubs/formatTest.jstl",
    "./test/stubs/",
    "dist",
    dataObj
  );

  t.is((await tmpl.render()).trim(), `<p>ZACH</p>`);
});

test("ES6 Template Literal (with Backticks)", async t => {
  let dataObj = new TemplateData("./test/stubs/");
  let tmpl = new Template(
    "./test/stubs/formatTestBackticks.jstl",
    "./test/stubs/",
    "dist",
    dataObj
  );

  t.is((await tmpl.render()).trim(), `<p>ZACH</p>`);
});

test("Permalink output directory", async t => {
  let tmpl = new Template(
    "./test/stubs/permalinked.ejs",
    "./test/stubs/",
    "./dist"
  );
  t.is(await tmpl.getOutputPath(), "./dist/permalinksubfolder/index.html");
});

test("Permalink output directory from layout", async t => {
  let tmpl = new Template(
    "./test/stubs/permalink-in-layout.ejs",
    "./test/stubs/",
    "./dist"
  );
  t.is(await tmpl.getOutputPath(), "./dist/hello/index.html");
});

test("Permalink output directory from layout (fileslug)", async t => {
  let tmpl = new Template(
    "./test/stubs/permalink-in-layout-fileslug.ejs",
    "./test/stubs/",
    "./dist"
  );
  t.is(
    await tmpl.getOutputPath(),
    "./dist/test/permalink-in-layout-fileslug/index.html"
  );
});

test("Layout from template-data-file that has a permalink (fileslug) Issue #121", async t => {
  let dataObj = new TemplateData("./test/stubs/");
  let tmpl = new Template(
    "./test/stubs/permalink-data-layout/test.njk",
    "./test/stubs/",
    "./dist",
    dataObj
  );

  let data = await tmpl.getData();
  let renderedTmpl = (await tmpl.getRenderedTemplates(data))[0];
  t.is(renderedTmpl.templateContent, "Wrapper:Test 1:test");
  t.is(await tmpl.getOutputPath(), "./dist/test/index.html");
});

test("Local template data file import (without a global data json)", async t => {
  let dataObj = new TemplateData("./test/stubs/");
  await dataObj.cacheData();

  let tmpl = new Template(
    "./test/stubs/component/component.njk",
    "./test/stubs/",
    "./dist",
    dataObj
  );

  let data = await tmpl.getData();
  t.deepEqual(await dataObj.getLocalDataPaths(tmpl.getInputPath()), [
    "./test/stubs/component/component.json",
    "./test/stubs/component/component.11tydata.json",
    "./test/stubs/component/component.11tydata.js"
  ]);
  t.is(data.localdatakey1, "localdatavalue1");
  t.is(await tmpl.render(), "localdatavalue1");
});

test("Local template data file import (two subdirectories deep)", async t => {
  let dataObj = new TemplateData("./test/stubs/");
  await dataObj.cacheData();

  let tmpl = new Template(
    "./test/stubs/firstdir/seconddir/component.njk",
    "./test/stubs/",
    "./dist",
    dataObj
  );

  t.deepEqual(await dataObj.getLocalDataPaths(tmpl.getInputPath()), [
    "./test/stubs/firstdir/firstdir.json",
    "./test/stubs/firstdir/firstdir.11tydata.json",
    "./test/stubs/firstdir/firstdir.11tydata.js",
    "./test/stubs/firstdir/seconddir/seconddir.json",
    "./test/stubs/firstdir/seconddir/seconddir.11tydata.json",
    "./test/stubs/firstdir/seconddir/seconddir.11tydata.js",
    "./test/stubs/firstdir/seconddir/component.json",
    "./test/stubs/firstdir/seconddir/component.11tydata.json",
    "./test/stubs/firstdir/seconddir/component.11tydata.js"
  ]);
});

test("Posts inherits local JSON, layouts", async t => {
  let dataObj = new TemplateData("./test/stubs/");
  await dataObj.cacheData();

  let tmpl = new Template(
    "./test/stubs/posts/post1.njk",
    "./test/stubs/",
    "./dist",
    dataObj
  );

  let localDataPaths = await dataObj.getLocalDataPaths(tmpl.getInputPath());
  t.deepEqual(localDataPaths, [
    "./test/stubs/posts/posts.json",
    "./test/stubs/posts/posts.11tydata.json",
    "./test/stubs/posts/posts.11tydata.js",
    "./test/stubs/posts/post1.json",
    "./test/stubs/posts/post1.11tydata.json",
    "./test/stubs/posts/post1.11tydata.js"
  ]);

  let localData = await dataObj.getLocalData(tmpl.getInputPath());
  t.is(localData.layout, "mylocallayout.njk");
  t.truthy(localData.pkg);

  let data = await tmpl.getData();
  t.is(localData.layout, "mylocallayout.njk");

  t.is(
    normalizeNewLines((await tmpl.render(data)).trim()),
    `<div id="locallayout">Post1
</div>`
  );
});

test("Template and folder name are the same, make sure data imports work ok", async t => {
  let dataObj = new TemplateData("./test/stubs/");
  await dataObj.cacheData();

  let tmpl = new Template(
    "./test/stubs/posts/posts.njk",
    "./test/stubs/",
    "./dist",
    dataObj
  );

  let localDataPaths = await dataObj.getLocalDataPaths(tmpl.getInputPath());
  t.deepEqual(localDataPaths, [
    "./test/stubs/posts/posts.json",
    "./test/stubs/posts/posts.11tydata.json",
    "./test/stubs/posts/posts.11tydata.js"
  ]);

  let localData = await dataObj.getLocalData(tmpl.getInputPath());
  t.is(localData.layout, "mylocallayout.njk");
  t.truthy(localData.pkg);

  let data = await tmpl.getData();
  t.is(localData.layout, "mylocallayout.njk");

  t.is(
    normalizeNewLines((await tmpl.render(data)).trim()),
    `<div id="locallayout">Posts
</div>`
  );
});

test("Clone the template", async t => {
  let tmpl = new Template(
    "./test/stubs/default.ejs",
    "./test/stubs/",
    "./dist"
  );

  let cloned = tmpl.clone();

  t.is(await tmpl.getOutputPath(), "./dist/default/index.html");
  t.is(await cloned.getOutputPath(), "./dist/default/index.html");
});

test("Permalink with variables!", async t => {
  let tmpl = new Template(
    "./test/stubs/permalinkdata.njk",
    "./test/stubs/",
    "./dist"
  );

  t.is(await tmpl.getOutputPath(), "./dist/subdir/slug-candidate/index.html");
});

test("Permalink with dates!", async t => {
  let tmpl = new Template(
    "./test/stubs/permalinkdate.liquid",
    "./test/stubs/",
    "./dist"
  );

  t.is(await tmpl.getOutputPath(), "./dist/2016/01/01/index.html");
});

test("Permalink with dates on file name regex!", async t => {
  let tmpl = new Template(
    "./test/stubs/2016-02-01-permalinkdate.liquid",
    "./test/stubs/",
    "./dist"
  );

  t.is(await tmpl.getOutputPath(), "./dist/2016/02/01/index.html");
});

test("Reuse permalink in directory specific data file", async t => {
  let dataObj = new TemplateData("./test/stubs/");
  let tmpl = new Template(
    "./test/stubs/reuse-permalink/test1.liquid",
    "./test/stubs/",
    "./dist",
    dataObj
  );

  t.is(await tmpl.getOutputPath(), "./dist/2016/01/01/index.html");
});

test("mapDataAsRenderedTemplates", async t => {
  let tmpl = new Template(
    "./test/stubs/default.ejs",
    "./test/stubs/",
    "./dist"
  );

  t.deepEqual(
    await tmpl.mapDataAsRenderedTemplates(
      {
        key1: "value1",
        key2: "value2",
        key3: "value3"
      },
      { parsedKey: "parsedValue" }
    ),
    {
      key1: "value1",
      key2: "value2",
      key3: "value3"
    }
  );

  t.deepEqual(
    await tmpl.mapDataAsRenderedTemplates(
      {
        key1: "value1",
        key2: "<%= parsedKey %>"
      },
      { parsedKey: "parsedValue" }
    ),
    {
      key1: "value1",
      key2: "parsedValue"
    }
  );

  t.deepEqual(
    await tmpl.mapDataAsRenderedTemplates(
      {
        key1: "value1",
        key2: ["<%= parsedKey %>", 2]
      },
      { parsedKey: "parsedValue" }
    ),
    {
      key1: "value1",
      key2: ["parsedValue", 2]
    }
  );
});

test("renderData", async t => {
  let tmpl = new Template(
    "./test/stubs/renderData/renderData.njk",
    "./test/stubs/",
    "./dist"
  );

  t.is((await tmpl.render()).trim(), "hi:value2-value1.css");
});

test("renderData markdown (issue #40)", async t => {
  let tmpl = new Template(
    "./test/stubs/renderData/renderData.md",
    "./test/stubs/",
    "./dist"
  );

  t.is((await tmpl.render()).trim(), "<title>value2-value1.css</title>");
});

test("getMappedDate (empty, assume created)", async t => {
  let tmpl = new Template(
    "./test/stubs/dates/file1.md",
    "./test/stubs/",
    "./dist"
  );
  let data = await tmpl.getRenderedData();
  let date = await tmpl.getMappedDate(data);

  t.true(date instanceof Date);
  t.truthy(date.getTime());
});

test("getMappedDate (explicit date, yaml String)", async t => {
  let tmpl = new Template(
    "./test/stubs/dates/file2.md",
    "./test/stubs/",
    "./dist"
  );
  let data = await tmpl.getRenderedData();
  let date = await tmpl.getMappedDate(data);

  t.true(date instanceof Date);
  t.truthy(date.getTime());
});

test("getMappedDate (explicit date, yaml Date)", async t => {
  let tmpl = new Template(
    "./test/stubs/dates/file2b.md",
    "./test/stubs/",
    "./dist"
  );
  let data = await tmpl.getRenderedData();
  let date = await tmpl.getMappedDate(data);

  t.true(date instanceof Date);
  t.truthy(date.getTime());
});

test("getMappedDate (explicit date, yaml Date and string should be the same)", async t => {
  let tmplA = new Template(
    "./test/stubs/dates/file2.md",
    "./test/stubs/",
    "./dist"
  );
  let dataA = await tmplA.getRenderedData();
  let stringDate = await tmplA.getMappedDate(dataA);

  let tmplB = new Template(
    "./test/stubs/dates/file2b.md",
    "./test/stubs/",
    "./dist"
  );
  let dataB = await tmplB.getRenderedData();
  let yamlDate = await tmplB.getMappedDate(dataB);

  t.truthy(stringDate);
  t.truthy(yamlDate);
  t.deepEqual(stringDate, yamlDate);
});

test("getMappedDate (modified date)", async t => {
  let tmpl = new Template(
    "./test/stubs/dates/file3.md",
    "./test/stubs/",
    "./dist"
  );
  let data = await tmpl.getRenderedData();
  let date = await tmpl.getMappedDate(data);

  t.true(date instanceof Date);
  t.truthy(date.getTime());
});

test("getMappedDate (created date)", async t => {
  let tmpl = new Template(
    "./test/stubs/dates/file4.md",
    "./test/stubs/",
    "./dist"
  );
  let data = await tmpl.getRenderedData();
  let date = await tmpl.getMappedDate(data);

  t.true(date instanceof Date);
  t.truthy(date.getTime());
});

test("getMappedDate (falls back to filename date)", async t => {
  let tmpl = new Template(
    "./test/stubs/dates/2018-01-01-file5.md",
    "./test/stubs/",
    "./dist"
  );
  let data = await tmpl.getRenderedData();
  let date = await tmpl.getMappedDate(data);

  t.true(date instanceof Date);
  t.truthy(date.getTime());
});

test("getRenderedData() has all the page variables", async t => {
  let tmpl = new Template(
    "./test/stubs/template.ejs",
    "./test/stubs/",
    "./dist"
  );
  let data = await tmpl.getRenderedData();

  t.truthy(data.page.url);
  t.is(data.page.url, "/template/");
  t.is(data.page.fileSlug, "template");
  t.truthy(data.page.date.getTime());
  t.is(data.page.inputPath, "./test/stubs/template.ejs");
  t.is(data.page.outputPath, "./dist/template/index.html");
});

test("getTemplates() data has all the root variables", async t => {
  let tmpl = new Template(
    "./test/stubs/template.ejs",
    "./test/stubs/",
    "./dist"
  );
  let data = await tmpl.getData();
  let templates = await tmpl.getTemplates(data);

  t.is(templates[0].url, "/template/");
  t.is(templates[0].fileSlug, "template");
  t.truthy(templates[0].date.getTime());
  t.is(templates[0].inputPath, "./test/stubs/template.ejs");
  t.is(templates[0].outputPath, "./dist/template/index.html");
});

test("getTemplates() data has all the page variables", async t => {
  let tmpl = new Template(
    "./test/stubs/template.ejs",
    "./test/stubs/",
    "./dist"
  );
  let data = await tmpl.getData();
  let templates = await tmpl.getTemplates(data);

  t.is(templates[0].data.page.url, "/template/");
  t.is(templates[0].data.page.fileSlug, "template");
  t.truthy(templates[0].data.page.date.getTime());
  t.is(templates[0].data.page.inputPath, "./test/stubs/template.ejs");
  t.is(templates[0].data.page.outputPath, "./dist/template/index.html");
});

test("getRenderedTemplates() data has all the page variables", async t => {
  let tmpl = new Template(
    "./test/stubs/template.ejs",
    "./test/stubs/",
    "./dist"
  );
  let data = await tmpl.getData();

  let templates = await tmpl.getRenderedTemplates(data);
  t.is(templates[0].data.page.url, "/template/");
  t.is(templates[0].data.page.fileSlug, "template");
  t.truthy(templates[0].data.page.date.getTime());
  t.is(templates[0].data.page.inputPath, "./test/stubs/template.ejs");
  t.is(templates[0].data.page.outputPath, "./dist/template/index.html");
});

test("getRenderedData() has good slug (empty, index)", async t => {
  let tmpl = new Template("./test/stubs/index.ejs", "./test/stubs/", "./dist");
  let data = await tmpl.getRenderedData();
  t.is(data.page.fileSlug, "");
});

test("getRenderedData() has good slug", async t => {
  let tmpl = new Template(
    "./test/stubs/includer.liquid",
    "./test/stubs/",
    "./dist"
  );
  let data = await tmpl.getRenderedData();
  t.is(data.page.fileSlug, "includer");
});

test("Override base templating engine from .liquid to ejs", async t => {
  let tmpl = new Template(
    "./test/stubs/overrides/test-ejs.liquid",
    "./test/stubs/",
    "./dist"
  );

  t.is((await tmpl.render()).trim(), "My Title");
});

test("Override base templating engine from markdown to 11ty.js, then markdown", async t => {
  let tmpl = new Template(
    "./test/stubs/test-override-js-markdown.11ty.js",
    "./test/stubs/",
    "./dist"
  );

  t.is((await tmpl.render()).trim(), "<h1>This is markdown</h1>");
});

test("Override base templating engine from .liquid to md", async t => {
  let tmpl = new Template(
    "./test/stubs/overrides/test-md.liquid",
    "./test/stubs/",
    "./dist"
  );

  t.is((await tmpl.render()).trim(), "<h1>My Title</h1>");
});

test("Override base templating engine from .liquid to ejs,md", async t => {
  let tmpl = new Template(
    "./test/stubs/overrides/test-multiple.md",
    "./test/stubs/",
    "./dist"
  );

  t.is((await tmpl.render()).trim(), "<h1>My Title</h1>");
});

test("Override base templating engine from .njk to ejs,md", async t => {
  let tmpl = new Template(
    "./test/stubs/overrides/test-multiple2.njk",
    "./test/stubs/",
    "./dist"
  );

  t.is((await tmpl.render()).trim(), "<h1>My Title</h1>");
});

test("Override base templating engine from .html to ejs", async t => {
  let tmpl = new Template(
    "./test/stubs/overrides/test.html",
    "./test/stubs/",
    "./dist"
  );

  t.is((await tmpl.render()).trim(), "<h2>My Title</h2>");
});

test("Override base templating engine from .html to (nothing)", async t => {
  let tmpl = new Template(
    "./test/stubs/overrides/test-empty.html",
    "./test/stubs/",
    "./dist"
  );

  t.is((await tmpl.render()).trim(), "<h2><%= title %></h2>");
});

test("Override base templating engine should error with bad string", async t => {
  let tmpl = new Template(
    "./test/stubs/overrides/test-error.njk",
    "./test/stubs/",
    "./dist"
  );

  await t.throwsAsync(async () => {
    await tmpl.render();
  });
});

test("Override base templating engine (bypasses markdown)", async t => {
  let tmpl = new Template(
    "./test/stubs/overrides/test-bypass.md",
    "./test/stubs/",
    "./dist"
  );

  t.is((await tmpl.render()).trim(), "# My Title");
});

test("Override base templating engine to (nothing)", async t => {
  let tmpl = new Template(
    "./test/stubs/overrides/test-empty.md",
    "./test/stubs/",
    "./dist"
  );

  // not parsed
  t.is((await tmpl.render()).trim(), "# <%= title %>");
});

test("Override base templating engine from .ejs to njk", async t => {
  let tmpl = new Template(
    "./test/stubs/overrides/test.ejs",
    "./test/stubs/",
    "./dist"
  );

  t.is((await tmpl.render()).trim(), "My Title");
});

test("Override base templating engine from .njk to ejs (with a layout that uses njk)", async t => {
  let tmpl = new Template(
    "./test/stubs/overrides/layout.njk",
    "./test/stubs/",
    "./dist"
  );

  t.is(
    (await tmpl.render()).trim(),
    '<div id="layoutvalue"><h2>My Title</h2></div>'
  );
});

test("Override base templating engine from .njk to nothing (with a layout that uses njk)", async t => {
  let tmpl = new Template(
    "./test/stubs/overrides/layoutfalse.njk",
    "./test/stubs/",
    "./dist"
  );

  t.is(
    (await tmpl.render()).trim(),
    `<div id="layoutvalue"><h2><%= title %></h2></div>`
  );
});

test("Using a markdown source file (with a layout that uses njk), markdown shouldn’t render in layout file", async t => {
  let tmpl = new Template(
    "./test/stubs/overrides/test.md",
    "./test/stubs/",
    "./dist"
  );

  t.is(
    normalizeNewLines((await tmpl.render()).trim()),
    `# Layout header

<div id="layoutvalue"><h1>My Title</h1>
</div>`
  );
});

test("Override base templating engine from .md to ejs,md (with a layout that uses njk), markdown shouldn’t render in layout file", async t => {
  let tmpl = new Template(
    "./test/stubs/overrides/test2.md",
    "./test/stubs/",
    "./dist"
  );

  t.is(
    normalizeNewLines((await tmpl.render()).trim()),
    `# Layout header

<div id="layoutvalue"><h1>My Title</h1>
</div>`
  );
});

test("renderContent on a markdown file, permalink should not render markdown", async t => {
  let tmpl = new Template(
    "./test/stubs/permalink-markdown.md",
    "./test/stubs/",
    "./dist"
  );

  t.is(
    await tmpl.renderContent("/news/my-test-file/index.html", {}, true),
    "/news/my-test-file/index.html"
  );

  t.is(await tmpl.getOutputLink(), "/news/my-test-file/index.html");
});

test("renderContent on a markdown file, permalink should not render markdown (with variable)", async t => {
  let tmpl = new Template(
    "./test/stubs/permalink-markdown-var.md",
    "./test/stubs/",
    "./dist"
  );

  t.is(
    await tmpl.renderContent(
      "/news/{{ slug }}/index.html",
      { slug: "my-title" },
      true
    ),
    "/news/my-title/index.html"
  );

  t.is(await tmpl.getOutputLink(), "/news/my-title/index.html");
});

test("renderContent on a markdown file, permalink should not render markdown (has override)", async t => {
  let tmpl = new Template(
    "./test/stubs/permalink-markdown-override.md",
    "./test/stubs/",
    "./dist"
  );

  t.is(
    await tmpl.renderContent("/news/my-test-file/index.html", {}, true),
    "/news/my-test-file/index.html"
  );

  t.is(await tmpl.getOutputLink(), "/news/my-test-file/index.html");
});

/* Transforms */
test("Test a transform", async t => {
  t.plan(2);

  let tmpl = new Template(
    "./test/stubs/template.ejs",
    "./test/stubs/",
    "./test/stubs/_site"
  );

  tmpl.addTransform(function(content, outputPath) {
    t.true(outputPath.endsWith(".html"));
    return "OVERRIDE BY A TRANSFORM";
  });

  let renders = await tmpl._testCompleteRender();
  t.is(renders[0], "OVERRIDE BY A TRANSFORM");
});

test("Test a transform with pages", async t => {
  t.plan(5);

  let tmpl = new Template(
    "./test/stubs/transform-pages/template.njk",
    "./test/stubs/",
    "./test/stubs/_site"
  );

  tmpl.addTransform(function(content, outputPath) {
    // should run twice, one for each page
    t.true(content.length > 0);
    t.true(outputPath.endsWith(".html"));
    return "OVERRIDE BY A TRANSFORM";
  });

  let renders = await tmpl._testCompleteRender();
  t.is(renders[0], "OVERRIDE BY A TRANSFORM");
});

test("Test a transform with a layout", async t => {
  t.plan(3);

  let tmpl = new Template(
    "./test/stubs-475/transform-layout/transform-layout.njk",
    "./test/stubs-475/",
    "./test/stubs-475/_site"
  );

  tmpl.addTransform(function(content, outputPath) {
    t.is(content, "<html><body>This is content.</body></html>");
    t.true(outputPath.endsWith(".html"));
    return "OVERRIDE BY A TRANSFORM";
  });

  let renders = await tmpl._testCompleteRender();
  t.is(renders[0], "OVERRIDE BY A TRANSFORM");
});

test("Test a single asynchronous transform", async t => {
  t.plan(2);

  let tmpl = new Template(
    "./test/stubs/template.ejs",
    "./test/stubs/",
    "./test/stubs/_site"
  );

  tmpl.addTransform(async function(content, outputPath) {
    t.true(outputPath.endsWith("template/index.html"));

    return new Promise((resolve, reject) => {
      setTimeout(function(str, outputPath) {
        resolve("OVERRIDE BY A TRANSFORM");
      }, 50);
    });
  });

  let renders = await tmpl._testCompleteRender();
  t.is(renders[0], "OVERRIDE BY A TRANSFORM");
});

test("Test multiple asynchronous transforms", async t => {
  t.plan(3);

  let tmpl = new Template(
    "./test/stubs/template.ejs",
    "./test/stubs/",
    "./test/stubs/_site"
  );

  tmpl.addTransform(async function(content, outputPath) {
    t.true(outputPath.endsWith("template/index.html"));

    return new Promise((resolve, reject) => {
      setTimeout(function(str, outputPath) {
        resolve("lowercase transform");
      }, 50);
    });
  });

  // uppercase
  tmpl.addTransform(async function(str, outputPath) {
    t.true(outputPath.endsWith("template/index.html"));

    return new Promise((resolve, reject) => {
      setTimeout(function() {
        resolve(str.toUpperCase());
      }, 50);
    });
  });

  let renders = await tmpl._testCompleteRender();
  t.is(renders[0], "LOWERCASE TRANSFORM");
});

test("Test a linter", async t => {
  t.plan(4);

  let tmpl = new Template(
    "./test/stubs/transform-pages/template.njk",
    "./test/stubs/",
    "./test/stubs/_site"
  );

  tmpl.addLinter(function(str, inputPath, outputPath) {
    t.true(inputPath.endsWith("template.njk"));
    t.true(outputPath.endsWith("index.html"));
  });

  await tmpl._testCompleteRender();
});

test("permalink: false", async t => {
  let tmpl = new Template(
    "./test/stubs/permalink-false/test.md",
    "./test/stubs/",
    "./test/stubs/_site"
  );

  t.is(await tmpl.getOutputLink(), false);
  t.is(await tmpl.getOutputHref(), false);

  let data = await tmpl.getData();
  await tmpl.write(false, data);

  // Input file exists (sanity check for paths)
  t.is(fs.existsSync("./test/stubs/permalink-false/"), true);
  t.is(fs.existsSync("./test/stubs/permalink-false/test.md"), true);

  // Output does not exist
  t.is(fs.existsSync("./test/stubs/_site/permalink-false/"), false);
  t.is(fs.existsSync("./test/stubs/_site/permalink-false/test/"), false);
  t.is(
    fs.existsSync("./test/stubs/_site/permalink-false/test/index.html"),
    false
  );
});

test("Disable dynamic permalinks", async t => {
  let tmpl = new Template(
    "./test/stubs/dynamic-permalink/test.njk",
    "./test/stubs/",
    "./test/stubs/_site"
  );

  t.is(await tmpl.getOutputLink(), "/{{justastring}}/index.html");
  t.is(await tmpl.getOutputHref(), "/{{justastring}}/");
});

test("Front Matter Tags (Single)", async t => {
  let tmpl = new Template(
    "./test/stubs/templatetest-frontmatter/single.njk",
    "./test/stubs/",
    "dist"
  );
  let frontmatter = await tmpl.getFrontMatterData();
  t.deepEqual(frontmatter.tags, ["single-tag"]);

  let fulldata = await tmpl.getData();
  t.deepEqual(fulldata.tags, ["single-tag"]);

  let pages = await tmpl.getRenderedTemplates(fulldata);
  t.is(pages[0].templateContent.trim(), "Has single-tag");
});

test("Front Matter Tags (Multiple)", async t => {
  let tmpl = new Template(
    "./test/stubs/templatetest-frontmatter/multiple.njk",
    "./test/stubs/",
    "dist"
  );
  let frontmatter = await tmpl.getFrontMatterData();
  t.deepEqual(frontmatter.tags, ["multi-tag", "multi-tag-2"]);

  let fulldata = await tmpl.getData();
  t.deepEqual(fulldata.tags, ["multi-tag", "multi-tag-2"]);

  let pages = await tmpl.getRenderedTemplates(fulldata);
  t.is(pages[0].templateContent.trim(), "Has multi-tag-2");
});

test("Front matter date with quotes (liquid), issue #258", async t => {
  let tmpl = new Template(
    "./test/stubs/frontmatter-date/test.liquid",
    "./test/stubs/",
    "dist"
  );

  let data = await tmpl.getData();
  t.is(data.mydate.toISOString(), "2009-04-15T11:34:34.000Z");

  let pages = await tmpl.getRenderedTemplates(data);
  t.is(pages[0].templateContent.trim(), "2009-04-15");
});

test("Front matter date with quotes (njk), issue #258", async t => {
  let tmpl = new Template(
    "./test/stubs/frontmatter-date/test.njk",
    "./test/stubs/",
    "dist"
  );

  let data = await tmpl.getData();
  t.is(data.mydate.toISOString(), "2009-04-15T00:34:34.000Z");

  let pages = await tmpl.getRenderedTemplates(data);
  t.is(pages[0].templateContent.trim(), "2009-04-15T00:34:34.000Z");
});

test("Data Cascade (Deep merge)", async t => {
  let newConfig = Object.assign({}, config);
  newConfig.dataDeepMerge = true;

  let dataObj = new TemplateData("./test/");
  dataObj._setConfig(newConfig);
  await dataObj.cacheData();

  let tmpl = new Template(
    "./test/stubs/data-cascade/template.njk",
    "./test/stubs/",
    "./dist",
    dataObj
  );
  tmpl.config = newConfig;

  let data = await tmpl.getData();
  t.deepEqual(Object.keys(data).sort(), [
    "datafile",
    "frontmatter",
    "page",
    "parent",
    "pkg",
    "tags"
  ]);

  t.deepEqual(Object.keys(data.parent).sort(), [
    "child",
    "datafile",
    "frontmatter"
  ]);

  t.is(data.parent.child, -2);
});

test("Data Cascade (Shallow merge)", async t => {
  let dataObj = new TemplateData("./test/");
  await dataObj.cacheData();

  let tmpl = new Template(
    "./test/stubs/data-cascade/template.njk",
    "./test/stubs/",
    "./dist",
    dataObj
  );

  let data = await tmpl.getData();
  t.deepEqual(Object.keys(data).sort(), [
    "datafile",
    "frontmatter",
    "page",
    "parent",
    "pkg",
    "tags"
  ]);

  t.deepEqual(Object.keys(data.parent).sort(), ["child", "frontmatter"]);

  t.is(data.parent.child, -2);
});

test("Data Cascade Tag Merge (Deep merge)", async t => {
  let newConfig = Object.assign({}, config);
  newConfig.dataDeepMerge = true;

  let dataObj = new TemplateData("./test/stubs/");
  dataObj._setConfig(newConfig);
  await dataObj.cacheData();

  let tmpl = new Template(
    "./test/stubs/data-cascade/template.njk",
    "./test/stubs/",
    "./dist",
    dataObj
  );
  tmpl.config = newConfig;

  let data = await tmpl.getData();
  t.deepEqual(data.tags.sort(), ["tagA", "tagB", "tagC", "tagD"]);
});

test("Data Cascade Tag Merge (Shallow merge)", async t => {
  let dataObj = new TemplateData("./test/stubs/");
  await dataObj.cacheData();

  let tmpl = new Template(
    "./test/stubs/data-cascade/template.njk",
    "./test/stubs/",
    "./dist",
    dataObj
  );

  let data = await tmpl.getData();
  t.deepEqual(data.tags.sort(), ["tagA", "tagB"]);
});

test('Local data inherits tags string ([tags] vs "tags") Shallow Merge', async t => {
  let dataObj = new TemplateData("./test/stubs/");
  await dataObj.cacheData();

  let tmpl = new Template(
    "./test/stubs/local-data-tags/component.njk",
    "./test/stubs/",
    "./dist",
    dataObj
  );

  let data = await tmpl.getData();
  t.deepEqual(data.tags.sort(), ["tag1", "tag2"]);
});

test('Local data inherits tags string ([tags] vs "tags") Deep Merge', async t => {
  let newConfig = Object.assign({}, config);
  newConfig.dataDeepMerge = true;

  let dataObj = new TemplateData("./test/stubs/");
  dataObj._setConfig(newConfig);
  await dataObj.cacheData();

  let tmpl = new Template(
    "./test/stubs/local-data-tags/component.njk",
    "./test/stubs/",
    "./dist",
    dataObj
  );
  tmpl.config = newConfig;

  let data = await tmpl.getData();
  t.deepEqual(data.tags.sort(), ["tag1", "tag2", "tag3"]);
});

test("Throws a Premature Template Content Error (njk)", async t => {
  let tmpl = new Template(
    "./test/stubs/prematureTemplateContent/test.njk",
    "./test/stubs/",
    "./test/stubs/_site"
  );

  let data = await tmpl.getData();
  let mapEntries = await tmpl.getTemplates(data);
  let error = t.throws(() => {
    mapEntries[0].templateContent;
  });
  t.is(EleventyErrorUtil.isPrematureTemplateContentError(error), true);
});

test("Throws a Premature Template Content Error from rendering (njk)", async t => {
  let tmpl = new Template(
    "./test/stubs/prematureTemplateContent/test.njk",
    "./test/stubs/",
    "./test/stubs/_site"
  );

  let mapEntries = await tmpl.getTemplateMapEntries();
  let pageEntries = await tmpl.getTemplates({
    page: {},
    sample: {
      get templateContent() {
        throw new TemplateContentPrematureUseError(
          "Tried to use templateContent too early (test.njk)"
        );
      }
    }
  });
  let error = await t.throwsAsync(async () => {
    await tmpl.renderPageEntry(mapEntries[0], pageEntries[0]);
  });
  console.log(error);
  t.is(EleventyErrorUtil.isPrematureTemplateContentError(error), true);
});

test("Throws a Premature Template Content Error (liquid)", async t => {
  let tmpl = new Template(
    "./test/stubs/prematureTemplateContent/test.liquid",
    "./test/stubs/",
    "./test/stubs/_site"
  );

  let data = await tmpl.getData();
  let mapEntries = await tmpl.getTemplates(data);
  let error = t.throws(() => {
    mapEntries[0].templateContent;
  });
  t.is(EleventyErrorUtil.isPrematureTemplateContentError(error), true);
});

test("Throws a Premature Template Content Error (11ty.js)", async t => {
  let tmpl = new Template(
    "./test/stubs/prematureTemplateContent/test.11ty.js",
    "./test/stubs/",
    "./test/stubs/_site"
  );

  let data = await tmpl.getData();
  let mapEntries = await tmpl.getTemplates(data);
  let error = t.throws(() => {
    mapEntries[0].templateContent;
  });
  t.is(EleventyErrorUtil.isPrematureTemplateContentError(error), true);
});

test("Throws a Premature Template Content Error (pug)", async t => {
  let tmpl = new Template(
    "./test/stubs/prematureTemplateContent/test.pug",
    "./test/stubs/",
    "./test/stubs/_site"
  );

  let data = await tmpl.getData();
  let mapEntries = await tmpl.getTemplates(data);
  let error = t.throws(() => {
    mapEntries[0].templateContent;
  });
  t.is(EleventyErrorUtil.isPrematureTemplateContentError(error), true);
});

test("Throws a Premature Template Content Error from rendering (pug)", async t => {
  let tmpl = new Template(
    "./test/stubs/prematureTemplateContent/test.pug",
    "./test/stubs/",
    "./test/stubs/_site"
  );

  let mapEntries = await tmpl.getTemplateMapEntries();
  let pageEntries = await tmpl.getTemplates({
    page: {},
    sample: {
      get templateContent() {
        throw new TemplateContentPrematureUseError(
          "Tried to use templateContent too early (test.pug)"
        );
      }
    }
  });
  let error = await t.throwsAsync(async () => {
    await tmpl.renderPageEntry(mapEntries[0], pageEntries[0]);
  });
  t.is(EleventyErrorUtil.isPrematureTemplateContentError(error), true);
});

test("Throws a Premature Template Content Error (md)", async t => {
  let tmpl = new Template(
    "./test/stubs/prematureTemplateContent/test.md",
    "./test/stubs/",
    "./test/stubs/_site"
  );

  let data = await tmpl.getData();
  let mapEntries = await tmpl.getTemplates(data);
  let error = t.throws(() => {
    mapEntries[0].templateContent;
  });
  t.is(EleventyErrorUtil.isPrematureTemplateContentError(error), true);
});

test("Throws a Premature Template Content Error from rendering (md)", async t => {
  let tmpl = new Template(
    "./test/stubs/prematureTemplateContent/test.md",
    "./test/stubs/",
    "./test/stubs/_site"
  );

  let mapEntries = await tmpl.getTemplateMapEntries();
  let pageEntries = await tmpl.getTemplates({
    page: {},
    sample: {
      get templateContent() {
        throw new TemplateContentPrematureUseError(
          "Tried to use templateContent too early (test.md)"
        );
      }
    }
  });
  let error = await t.throwsAsync(async () => {
    await tmpl.renderPageEntry(mapEntries[0], pageEntries[0]);
  });
  t.is(EleventyErrorUtil.isPrematureTemplateContentError(error), true);
});

test("Throws a Premature Template Content Error (hbs)", async t => {
  let tmpl = new Template(
    "./test/stubs/prematureTemplateContent/test.hbs",
    "./test/stubs/",
    "./test/stubs/_site"
  );

  let data = await tmpl.getData();
  let mapEntries = await tmpl.getTemplates(data);
  let error = t.throws(() => {
    mapEntries[0].templateContent;
  });
  t.is(EleventyErrorUtil.isPrematureTemplateContentError(error), true);
});

test("Throws a Premature Template Content Error from rendering (hbs)", async t => {
  let tmpl = new Template(
    "./test/stubs/prematureTemplateContent/test.hbs",
    "./test/stubs/",
    "./test/stubs/_site"
  );

  let mapEntries = await tmpl.getTemplateMapEntries();
  let pageEntries = await tmpl.getTemplates({
    page: {},
    sample: {
      get templateContent() {
        throw new TemplateContentPrematureUseError(
          "Tried to use templateContent too early (test.hbs)"
        );
      }
    }
  });
  let error = await t.throwsAsync(async () => {
    await tmpl.renderPageEntry(mapEntries[0], pageEntries[0]);
  });
  t.is(EleventyErrorUtil.isPrematureTemplateContentError(error), true);
});

test("Throws a Premature Template Content Error (mustache)", async t => {
  let tmpl = new Template(
    "./test/stubs/prematureTemplateContent/test.mustache",
    "./test/stubs/",
    "./test/stubs/_site"
  );

  let data = await tmpl.getData();
  let mapEntries = await tmpl.getTemplates(data);
  let error = t.throws(() => {
    mapEntries[0].templateContent;
  });
  t.is(EleventyErrorUtil.isPrematureTemplateContentError(error), true);
});

test("Throws a Premature Template Content Error (ejs)", async t => {
  let tmpl = new Template(
    "./test/stubs/prematureTemplateContent/test.ejs",
    "./test/stubs/",
    "./test/stubs/_site"
  );

  let data = await tmpl.getData();
  let mapEntries = await tmpl.getTemplates(data);
  let error = t.throws(() => {
    mapEntries[0].templateContent;
  });
  t.is(EleventyErrorUtil.isPrematureTemplateContentError(error), true);
});

test("Throws a Premature Template Content Error (haml)", async t => {
  let tmpl = new Template(
    "./test/stubs/prematureTemplateContent/test.haml",
    "./test/stubs/",
    "./test/stubs/_site"
  );

  let data = await tmpl.getData();
  let mapEntries = await tmpl.getTemplates(data);
  let error = t.throws(() => {
    mapEntries[0].templateContent;
  });
  t.is(EleventyErrorUtil.isPrematureTemplateContentError(error), true);
});

test.skip("Issue 413 weird date format", async t => {
  let tmpl = new Template(
    "./test/stubs-413/date-frontmatter.md",
    "./test/stubs-413/",
    "./dist"
  );

  let data = await tmpl.getData();
  t.is(data.page.date, "");
});

test("Custom Front Matter Parsing Options", async t => {
  let newConfig = Object.assign({}, config);
  newConfig.frontMatterParsingOptions = {
    excerpt: true
  };

  let tmpl = new Template(
    "./test/stubs/custom-frontmatter/template.njk",
    "./test/stubs/",
    "./dist"
  );
  tmpl.config = newConfig;

  let frontmatter = await tmpl.getFrontMatter();
  t.is(frontmatter.data.front, "hello");
  t.is(frontmatter.data.page.excerpt.trim(), "This is an excerpt.");

  t.is(frontmatter.excerpt.trim(), "This is an excerpt.");
  t.is(frontmatter.content.trim(), "This is content.");

  let fulldata = await tmpl.getData();
  t.is(fulldata.page.excerpt.trim(), "This is an excerpt.");
});

test("Custom Front Matter Parsing Options (using alias)", async t => {
  let newConfig = Object.assign({}, config);
  newConfig.frontMatterParsingOptions = {
    excerpt: true,
    excerpt_alias: "my_excerpt"
  };

  let tmpl = new Template(
    "./test/stubs/custom-frontmatter/template.njk",
    "./test/stubs/",
    "./dist"
  );
  tmpl.config = newConfig;

  let frontmatter = await tmpl.getFrontMatter();
  t.is(frontmatter.data.front, "hello");
  t.is(frontmatter.data.my_excerpt.trim(), "This is an excerpt.");
  t.is(frontmatter.content.trim(), "This is content.");

  let fulldata = await tmpl.getData();
  t.is(fulldata.my_excerpt.trim(), "This is an excerpt.");
});

test("Custom Front Matter Parsing Options (no newline after excerpt separator)", async t => {
  let newConfig = Object.assign({}, config);
  newConfig.frontMatterParsingOptions = {
    excerpt: true
  };

  let tmpl = new Template(
    "./test/stubs/custom-frontmatter/template-nonewline.njk",
    "./test/stubs/",
    "./dist"
  );
  tmpl.config = newConfig;

  let frontmatter = await tmpl.getFrontMatter();
  t.is(frontmatter.data.front, "hello");
  t.is(frontmatter.data.page.excerpt.trim(), "This is an excerpt.");

  t.is(frontmatter.excerpt.trim(), "This is an excerpt.");
  t.is(frontmatter.content.trim(), "This is content.");

  let fulldata = await tmpl.getData();
  t.is(fulldata.page.excerpt.trim(), "This is an excerpt.");
});

test.skip("Custom Front Matter Parsing Options (using TOML)", async t => {
  // Depends on https://github.com/jonschlinkert/gray-matter/issues/92 for Windows
  let newConfig = Object.assign({}, config);
  let toml = require("toml");

  newConfig.frontMatterParsingOptions = {
    engines: {
      toml: toml.parse.bind(toml)
    }
  };

  let tmpl = new Template(
    "./test/stubs/custom-frontmatter/template-toml.njk",
    "./test/stubs/",
    "./dist"
  );
  tmpl.config = newConfig;

  let frontmatter = await tmpl.getFrontMatter();
  t.deepEqual(frontmatter.data, {
    front: "hello"
  });
  t.is(frontmatter.content.trim(), "This is content.");

  let fulldata = await tmpl.getData();
  t.is(fulldata.front, "hello");
});

test.skip("__dirname in njk Issue #581", async t => {
  // https://github.com/jonschlinkert/gray-matter/blob/master/examples/javascript.js
  let tmpl = new Template(
    "./test/stubs/dirname/dirname.njk",
    "./test/stubs/",
    "./dist"
  );

  // let fm = await tmpl.getFrontMatter();
  // t.is(fm.data.dirfn(), "value1");
  // t.is(fm.data.file, "value1");
  // t.is(fm.data.dir, "value1");

  let data = await tmpl.getData();
  // t.is(data.dir, "value1");

  let pages = await tmpl.getRenderedTemplates(data);
  t.is(pages[0].templateContent.trim(), "value1");
});

test.skip("__dirname in ejs Issue #581", async t => {
  // https://github.com/jonschlinkert/gray-matter/blob/master/examples/javascript.js
  let tmpl = new Template(
    "./test/stubs/dirname/dirname.ejs",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let pages = await tmpl.getRenderedTemplates(data);
  t.is(pages[0].templateContent.trim(), "value1");
});

test("global variable with dashes Issue #567 (liquid)", async t => {
  let tmpl = new Template(
    "./test/stubs/global-dash-variable.liquid",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  t.is(data["is-it-tasty"], "Yes");

  let pages = await tmpl.getRenderedTemplates(data);
  t.is(pages[0].templateContent.trim(), "Yes");
});
