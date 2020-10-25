const test = require("ava");
const TemplateData = require("../src/TemplateData");
const { cloneDeep } = require("lodash");
const templateConfig = require("../src/Config");
const Template = require("../src/Template");

test.before(async () => {
  // This runs concurrently with the above
  await templateConfig.init();
});

const getNewTemplate = (...args) => {
  // monkey patching to add templateConfig to the end of every call
  args = args.concat(Array(5).fill(null)).slice(0, 5).concat(templateConfig);
  return new Template(...args);
};

async function getRenderedData(tmpl, pageNumber = 0) {
  let data = await tmpl.getData();
  let templates = await tmpl.getTemplates(data);
  return templates[pageNumber].data;
}

test("eleventyComputed", async (t) => {
  let tmpl = getNewTemplate(
    "./test/stubs/eleventyComputed/first.njk",
    "./test/stubs/",
    "./dist",
    null,
    null,
    templateConfig
  );
  let data = await getRenderedData(tmpl);
  t.is((await tmpl.render(data)).trim(), "hi:value2-value1.css");
});

test("eleventyComputed overrides existing value.", async (t) => {
  let tmpl = getNewTemplate(
    "./test/stubs/eleventyComputed/override.njk",
    "./test/stubs/",
    "./dist",
    null,
    null,
    templateConfig
  );
  let data = await getRenderedData(tmpl);
  t.is(data.key1, "override");
  t.is((await tmpl.render(data)).trim(), "hi:override");
});

test("eleventyComputed overrides existing value and reuses that upstream value", async (t) => {
  let tmpl = getNewTemplate(
    "./test/stubs/eleventyComputed/override-reuse.njk",
    "./test/stubs/",
    "./dist",
    null,
    null,
    templateConfig
  );
  let data = await getRenderedData(tmpl);
  t.is(data.key1, "over(value1)ride");
  t.is((await tmpl.render(data)).trim(), "hi:over(value1)ride");
});

test("eleventyComputed permalink", async (t) => {
  let tmpl = getNewTemplate(
    "./test/stubs/eleventyComputed/permalink.njk",
    "./test/stubs/",
    "./dist",
    null,
    null,
    templateConfig
  );
  let templates = await tmpl.getTemplates(await tmpl.getData());
  let data = templates[0].data;
  t.is(data.page.url, "/haha-value1.html");
  t.is(data.page.outputPath, "./dist/haha-value1.html");
  t.is(data.permalink, "haha-value1.html");
  t.is(data.nested.key3, "value1");
  t.is(data.nested.key4, "depends on computed value1");
  t.is(data.dependsOnPage, "depends:/haha-value1.html");
});

test("eleventyComputed simple permalink", async (t) => {
  let tmpl = getNewTemplate(
    "./test/stubs/eleventyComputed/permalink-simple.njk",
    "./test/stubs/",
    "./dist",
    null,
    null,
    templateConfig
  );
  let templates = await tmpl.getTemplates(await tmpl.getData());
  let data = templates[0].data;
  t.is(data.page.url, "/haha-value1.html");
  t.is(data.page.outputPath, "./dist/haha-value1.html");
  t.is(data.permalink, "haha-value1.html");
});

test("eleventyComputed permalink using slug", async (t) => {
  let tmpl = getNewTemplate(
    "./test/stubs/eleventyComputed/permalink-slug.njk",
    "./test/stubs/",
    "./dist",
    null,
    null,
    templateConfig
  );
  let templates = await tmpl.getTemplates(await tmpl.getData());
  let data = templates[0].data;
  t.is(data.page.url, "/haha-this-is-a-string.html");
  t.is(data.page.outputPath, "./dist/haha-this-is-a-string.html");
  t.is(data.permalink, "haha-this-is-a-string.html");
});

test("eleventyComputed js front matter (function)", async (t) => {
  let tmpl = getNewTemplate(
    "./test/stubs/eleventyComputed/second.njk",
    "./test/stubs/",
    "./dist",
    null,
    null,
    templateConfig
  );
  let data = await getRenderedData(tmpl);
  t.is(data.key3, "value3-value2-value1.css");
  t.is((await tmpl.render(data)).trim(), "hi:value2-value1.css");
});

test("eleventyComputed js front matter key reuses and overrides", async (t) => {
  let tmpl = getNewTemplate(
    "./test/stubs/eleventyComputed/third.njk",
    "./test/stubs/",
    "./dist",
    null,
    null,
    templateConfig
  );
  let data = await getRenderedData(tmpl);
  t.is(data.key1, "value2-value1");
  t.is((await tmpl.render(data)).trim(), "hi:value2-value1");
});

test("eleventyComputed true primitive", async (t) => {
  let tmpl = getNewTemplate(
    "./test/stubs/eleventyComputed/true.njk",
    "./test/stubs/",
    "./dist",
    null,
    null,
    templateConfig
  );
  let data = await getRenderedData(tmpl);
  t.is(data.key1, "value1");
  t.is(data.key2, true);
  t.is(data.key3, false);
  t.is(data.key4, 324);
});

test("eleventyComputed relies on global data", async (t) => {
  let dataObj = new TemplateData("./test/stubs/", templateConfig);
  let tmpl = getNewTemplate(
    "./test/stubs/eleventyComputed/use-global-data.njk",
    "./test/stubs/",
    "./dist",
    dataObj,
    null,
    templateConfig
  );

  let fetchedData = await tmpl.getData();
  let templates = await tmpl.getTemplates(fetchedData);
  let data = templates[0].data;
  t.is(data.image, "datavalue1");
});

test("eleventyComputed intermixes with global data", async (t) => {
  let dataObj = new TemplateData(
    "./test/stubs-computed-global/",
    templateConfig
  );

  let config = cloneDeep(dataObj.config);
  config.dataDeepMerge = true;
  dataObj._setConfig(config);

  let tmpl = getNewTemplate(
    "./test/stubs-computed-global/intermix.njk",
    "./test/stubs-computed-global/",
    "./dist",
    dataObj,
    null,
    templateConfig
  );
  tmpl.config = config;

  let fetchedData = await tmpl.getData();
  t.truthy(fetchedData.eleventyComputed.image);
  t.truthy(fetchedData.eleventyComputed.image2);
  t.truthy(fetchedData.eleventyComputed.image3);
  t.truthy(fetchedData.eleventyComputed.eleventyNavigation.key);

  let templates = await tmpl.getTemplates(fetchedData);
  let data = templates[0].data;
  t.is(data.image, "first");
  t.is(data.image2, "second");
  t.is(data.image3, "third-global");
  t.is(data.eleventyNavigation.key, "nested-first-global");
});
