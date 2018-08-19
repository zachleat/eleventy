import test from "ava";
import TemplateData from "../src/TemplateData";
import Template from "../src/Template";
import pretty from "pretty";
import templateConfig from "../src/Config";

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

test("HTML files output to the same as the input directory have a file suffix added (only if index, this _is_ index).", async t => {
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

test("More advanced getData()", async t => {
  let dataObj = new TemplateData("./test/stubs/");
  let tmpl = new Template(
    "./test/stubs/templateFrontMatter.ejs",
    "./test/stubs/",
    "dist",
    dataObj
  );
  let data = await tmpl.getData({
    key1: "value1override",
    key2: "value2"
  });

  t.is(data[config.keys.package].name, "@11ty/eleventy");
  t.is(
    data.key1,
    "value1override",
    "local data argument overrides front matter"
  );
  t.is(data.key2, "value2", "local data argument, no front matter");
  t.is(data.key3, "value3", "front matter only");
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
    cleanHtml(await tmpl.renderLayout(tmpl, data)),
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
    cleanHtml(await tmpl.renderLayout(tmpl, data)),
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
    cleanHtml(await tmpl.renderLayout(tmpl, data)),
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
    cleanHtml(await tmpl.renderLayout(tmpl, data)),
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
    cleanHtml(await tmpl.renderLayout(tmpl, data)),
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
  let dataObj = new TemplateData();
  await dataObj.cacheData();

  let tmpl = new Template(
    "./test/stubs/component/component.njk",
    "./test/stubs/",
    "./dist",
    dataObj
  );

  let data = await tmpl.getData();
  t.deepEqual(dataObj.getLocalDataPaths(tmpl.getInputPath()), [
    "./test/stubs/component/component.json"
  ]);
  t.is(data.localdatakey1, "localdatavalue1");
  t.is(await tmpl.render(), "localdatavalue1");
});

test("Local template data file import (two subdirectories deep)", async t => {
  let dataObj = new TemplateData();
  await dataObj.cacheData();

  let tmpl = new Template(
    "./test/stubs/firstdir/seconddir/component.njk",
    "./test/stubs/",
    "./dist",
    dataObj
  );

  t.deepEqual(dataObj.getLocalDataPaths(tmpl.getInputPath()), [
    "./test/stubs/firstdir/firstdir.json",
    "./test/stubs/firstdir/seconddir/seconddir.json",
    "./test/stubs/firstdir/seconddir/component.json"
  ]);
});

test("Posts inherits local JSON, layouts", async t => {
  let dataObj = new TemplateData();
  await dataObj.cacheData();

  let tmpl = new Template(
    "./test/stubs/posts/post1.njk",
    "./test/stubs/",
    "./dist",
    dataObj
  );

  let localDataPaths = dataObj.getLocalDataPaths(tmpl.getInputPath());
  t.deepEqual(localDataPaths, [
    "./test/stubs/posts/posts.json",
    "./test/stubs/posts/post1.json"
  ]);

  let localData = await dataObj.getLocalData(tmpl.getInputPath());
  t.is(localData.layout, "mylocallayout.njk");
  t.truthy(localData.pkg);

  let data = await tmpl.getData();
  t.is(localData.layout, "mylocallayout.njk");

  t.is(
    (await tmpl.render(data)).trim(),
    `<div id="locallayout">Post1
</div>`
  );
});

test("Template and folder name are the same, make sure data imports work ok", async t => {
  let dataObj = new TemplateData();
  await dataObj.cacheData();

  let tmpl = new Template(
    "./test/stubs/posts/posts.njk",
    "./test/stubs/",
    "./dist",
    dataObj
  );

  let localDataPaths = dataObj.getLocalDataPaths(tmpl.getInputPath());
  t.deepEqual(localDataPaths, ["./test/stubs/posts/posts.json"]);

  let localData = await dataObj.getLocalData(tmpl.getInputPath());
  t.is(localData.layout, "mylocallayout.njk");
  t.truthy(localData.pkg);

  let data = await tmpl.getData();
  t.is(localData.layout, "mylocallayout.njk");

  t.is(
    (await tmpl.render(data)).trim(),
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

test("getRenderedData() has page.url", async t => {
  let tmpl = new Template(
    "./test/stubs/template.ejs",
    "./test/stubs/",
    "./dist"
  );
  let data = await tmpl.getRenderedData();

  t.truthy(data.page.url);
});

test("getTemplates() data has page.url", async t => {
  let tmpl = new Template(
    "./test/stubs/template.ejs",
    "./test/stubs/",
    "./dist"
  );
  let data = await tmpl.getData();
  let templates = await tmpl.getTemplates(data);

  t.is(templates[0].data.page.url, "/template/");
  t.is(templates[0].data.page.outputPath, "./dist/template/index.html");
});

test("getRenderedTemplates() data has page.url", async t => {
  let tmpl = new Template(
    "./test/stubs/template.ejs",
    "./test/stubs/",
    "./dist"
  );
  let data = await tmpl.getData();

  let templates = await tmpl.getRenderedTemplates(data);
  t.is(templates[0].data.page.url, "/template/");
  t.is(templates[0].data.page.outputPath, "./dist/template/index.html");
});

test("getRenderedData() has page.url", async t => {
  let tmpl = new Template(
    "./test/stubs/template.ejs",
    "./test/stubs/",
    "./dist"
  );
  let data = await tmpl.getRenderedData();

  t.truthy(data.page.url);
  t.truthy(data.page.date);
  t.is(data.page.inputPath, "./test/stubs/template.ejs");
  t.is(data.page.fileSlug, "template");
  t.truthy(data.page.outputPath);
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

  await t.throws(tmpl.render());
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
    (await tmpl.render()).trim(),
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
    (await tmpl.render()).trim(),
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
