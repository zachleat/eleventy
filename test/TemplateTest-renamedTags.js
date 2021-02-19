const test = require("ava");
const templateConfig = require("../src/Config");
const config = templateConfig.getConfig();

test.before((t) => {
  config.keys.tags = "categories";
});

test.after((t) => {
  config.keys.tags = "tags";
});

const getNewTemplate = require("./_getNewTemplateForTests");

test("Front Matter Tags (Single)", async (t) => {
  let tmpl = getNewTemplate(
    "./test/stubs/templatetest-frontmatter/single.njk",
    "./test/stubs/",
    "dist"
  );
  let frontmatter = await tmpl.getFrontMatterData();
  t.deepEqual(frontmatter.tags, "single-tag");
  t.deepEqual(frontmatter.categories, ["single-category"]);

  let fulldata = await tmpl.getData();
  t.deepEqual(fulldata.tags, "single-tag");
  t.deepEqual(fulldata.categories, ["single-category"]);

  let pages = await tmpl.getRenderedTemplates(fulldata);
  t.is(pages[0].templateContent.trim(), "Has single-tagHas single-category");
});

test("Front Matter Tags (Multiple)", async (t) => {
  let tmpl = getNewTemplate(
    "./test/stubs/templatetest-frontmatter/multiple.njk",
    "./test/stubs/",
    "dist"
  );
  let frontmatter = await tmpl.getFrontMatterData();
  t.deepEqual(frontmatter.tags, ["multi-tag", "multi-tag-2"]);

  let fulldata = await tmpl.getData();
  t.deepEqual(fulldata.tags, ["multi-tag", "multi-tag-2"]);
  t.deepEqual(fulldata.categories, ["multi-category", "multi-category-2"]);

  let pages = await tmpl.getRenderedTemplates(fulldata);
  t.is(pages[0].templateContent.trim(), "Has multi-tag-2Has multi-category-2");
});
