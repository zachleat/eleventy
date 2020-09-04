import test from "ava";
import Template from "../src/Template";
import TemplateData from "../src/TemplateData";
import Pagination from "../src/Plugins/Pagination";

test("No data passed to pagination", async t => {
  let tmpl = new Template(
    "./test/stubs/paged/notpaged.njk",
    "./test/stubs/",
    "./dist"
  );

  let paging = new Pagination();
  paging.setTemplate(tmpl);

  t.is(paging.getPagedItems().length, 0);
  t.is((await paging.getPageTemplates()).length, 0);
});

test("No pagination", async t => {
  let tmpl = new Template(
    "./test/stubs/paged/notpaged.njk",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let paging = new Pagination(data);
  paging.setTemplate(tmpl);

  t.falsy(data.pagination);
  t.is(paging.getPageCount(), 0);
  t.is(paging.getPagedItems().length, 0);
  t.is((await paging.getPageTemplates()).length, 0);
});

test("Pagination enabled in frontmatter", async t => {
  let tmpl = new Template(
    "./test/stubs/paged/pagedresolve.njk",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let paging = new Pagination(data);
  paging.setTemplate(tmpl);

  t.truthy(data.testdata);
  t.truthy(data.testdata.sub);

  t.truthy(data.pagination);
  t.is(data.pagination.data, "testdata.sub");
  t.is(paging.getPageCount(), 2);
  t.is(data.pagination.size, 4);
});

test("Resolve paged data in frontmatter", async t => {
  let tmpl = new Template(
    "./test/stubs/paged/pagedresolve.njk",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let paging = new Pagination(data);
  paging.setTemplate(tmpl);
  t.is(paging._resolveItems().length, 8);
  t.is(paging.getPageCount(), 2);
  t.is(paging.getPagedItems().length, 2);
});

test("Paginate data in frontmatter", async t => {
  let tmpl = new Template(
    "./test/stubs/paged/pagedinlinedata.njk",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let pages = await tmpl.getTemplates(data);
  t.is(pages.length, 2);

  t.is(pages[0].outputPath, "./dist/paged/pagedinlinedata/index.html");
  t.is(
    (await pages[0].template.render(pages[0].data)).trim(),
    "<ol><li>item1</li><li>item2</li><li>item3</li><li>item4</li></ol>"
  );

  t.is(pages[1].outputPath, "./dist/paged/pagedinlinedata/1/index.html");
  t.is(
    (await pages[1].template.render(pages[1].data)).trim(),
    "<ol><li>item5</li><li>item6</li><li>item7</li><li>item8</li></ol>"
  );
});

test("Paginate external data file", async t => {
  let dataObj = new TemplateData("./test/stubs/");
  await dataObj.cacheData();

  let tmpl = new Template(
    "./test/stubs/paged/paged.njk",
    "./test/stubs/",
    "./dist",
    dataObj
  );

  let data = await tmpl.getData();

  // local data
  t.truthy(data.items.sub.length);

  let pages = await tmpl.getTemplates(data);
  t.is(pages.length, 2);

  t.is(pages[0].outputPath, "./dist/paged/index.html");
  t.is(
    (await pages[0].template.render(pages[0].data)).trim(),
    "<ol><li>item1</li><li>item2</li><li>item3</li><li>item4</li><li>item5</li></ol>"
  );

  t.is(pages[1].outputPath, "./dist/paged/1/index.html");
  t.is(
    (await pages[1].template.render(pages[1].data)).trim(),
    "<ol><li>item6</li><li>item7</li><li>item8</li></ol>"
  );
});

test("Slugify test", t => {
  const slugify = require("slugify");
  t.is(slugify("This is a test", { lower: true }), "this-is-a-test");
  t.is(slugify("This", { lower: true }), "this");
  t.is(slugify("ThisLKSDFDS", { lower: true }), "thislksdfds");
});

test("Permalink with pagination variables", async t => {
  let tmpl = new Template(
    "./test/stubs/paged/pagedpermalink.njk",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let pages = await tmpl.getTemplates(data);

  t.is(pages[0].outputPath, "./dist/paged/slug-candidate/index.html");
  t.is(pages[1].outputPath, "./dist/paged/another-slug-candidate/index.html");
});

test("Permalink with pagination variables (numeric)", async t => {
  let tmpl = new Template(
    "./test/stubs/paged/pagedpermalinknumeric.njk",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let pages = await tmpl.getTemplates(data);

  t.truthy(pages[0].data.pagination.firstPageLink);
  t.truthy(pages[0].data.pagination.firstPageHref);
  t.truthy(pages[0].data.pagination.lastPageLink);
  t.truthy(pages[0].data.pagination.lastPageHref);
  t.is(pages[0].outputPath, "./dist/paged/page-0/index.html");
  t.falsy(pages[0].data.pagination.previousPageLink);
  t.is(pages[0].data.pagination.nextPageLink, "/paged/page-1/index.html");
  t.is(pages[0].data.pagination.nextPageHref, "/paged/page-1/");
  t.is(pages[0].data.pagination.pageLinks.length, 2);
  t.is(pages[0].data.pagination.links.length, 2);
  t.is(pages[0].data.pagination.hrefs.length, 2);

  t.is(pages[1].outputPath, "./dist/paged/page-1/index.html");
  t.is(pages[1].data.pagination.previousPageLink, "/paged/page-0/index.html");
  t.is(pages[1].data.pagination.previousPageHref, "/paged/page-0/");
  t.falsy(pages[1].data.pagination.nextPageLink);
  t.is(pages[1].data.pagination.pageLinks.length, 2);
  t.is(pages[1].data.pagination.links.length, 2);
  t.is(pages[1].data.pagination.hrefs.length, 2);
});

test("Permalink with pagination variables (numeric, one indexed)", async t => {
  let tmpl = new Template(
    "./test/stubs/paged/pagedpermalinknumericoneindexed.njk",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let pages = await tmpl.getTemplates(data);

  t.is(pages[0].outputPath, "./dist/paged/page-1/index.html");
  t.falsy(pages[0].data.pagination.previousPageLink);
  t.is(pages[0].data.pagination.nextPageLink, "/paged/page-2/index.html");
  t.is(pages[0].data.pagination.nextPageHref, "/paged/page-2/");
  t.is(pages[0].data.pagination.pageLinks.length, 2);
  t.is(pages[0].data.pagination.links.length, 2);
  t.is(pages[0].data.pagination.hrefs.length, 2);

  t.is(pages[1].outputPath, "./dist/paged/page-2/index.html");
  t.is(pages[1].data.pagination.previousPageLink, "/paged/page-1/index.html");
  t.is(pages[1].data.pagination.previousPageHref, "/paged/page-1/");
  t.falsy(pages[1].data.pagination.nextPageLink);
  t.is(pages[1].data.pagination.pageLinks.length, 2);
  t.is(pages[1].data.pagination.links.length, 2);
  t.is(pages[1].data.pagination.hrefs.length, 2);
});

test("Permalink first and last page link with pagination variables (numeric)", async t => {
  let tmpl = new Template(
    "./test/stubs/paged/pagedpermalinknumeric.njk",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let pages = await tmpl.getTemplates(data);

  t.is(pages[0].data.pagination.firstPageLink, "/paged/page-0/index.html");
  t.is(pages[0].data.pagination.lastPageLink, "/paged/page-1/index.html");

  t.is(pages[1].data.pagination.firstPageLink, "/paged/page-0/index.html");
  t.is(pages[1].data.pagination.lastPageLink, "/paged/page-1/index.html");
});

test("Permalink first and last page link with pagination variables (numeric, one indexed)", async t => {
  let tmpl = new Template(
    "./test/stubs/paged/pagedpermalinknumericoneindexed.njk",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let pages = await tmpl.getTemplates(data);

  t.is(pages[0].data.pagination.firstPageLink, "/paged/page-1/index.html");
  t.is(pages[0].data.pagination.lastPageLink, "/paged/page-2/index.html");

  t.is(pages[1].data.pagination.firstPageLink, "/paged/page-1/index.html");
  t.is(pages[1].data.pagination.lastPageLink, "/paged/page-2/index.html");
});

test("Alias to page data", async t => {
  let tmpl = new Template(
    "./test/stubs/paged/pagedalias.njk",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let pages = await tmpl.getTemplates(data);

  t.is(pages[0].outputPath, "./dist/pagedalias/item1/index.html");
  t.is(pages[1].outputPath, "./dist/pagedalias/item2/index.html");

  t.is((await pages[0].template.render(pages[0].data)).trim(), "item1");
  t.is((await pages[1].template.render(pages[1].data)).trim(), "item2");
});

test("Alias to page data (size 2)", async t => {
  let tmpl = new Template(
    "./test/stubs/paged/pagedaliassize2.njk",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let pages = await tmpl.getTemplates(data);

  t.is(pages[0].outputPath, "./dist/pagedalias/item1/index.html");
  t.is(pages[1].outputPath, "./dist/pagedalias/item3/index.html");

  t.is((await pages[0].template.render(pages[0].data)).trim(), "item1");
  t.is((await pages[1].template.render(pages[1].data)).trim(), "item3");
});

test("Permalink with pagination variables (and an if statement, nunjucks)", async t => {
  let tmpl = new Template(
    "./test/stubs/paged/pagedpermalinkif.njk",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let pages = await tmpl.getTemplates(data);

  t.is(pages[0].outputPath, "./dist/paged/index.html");
  t.is(pages[1].outputPath, "./dist/paged/page-1/index.html");
});

test("Permalink with pagination variables (and an if statement, liquid)", async t => {
  let tmpl = new Template(
    "./test/stubs/paged/pagedpermalinkif.liquid",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let pages = await tmpl.getTemplates(data);

  t.is(pages[0].outputPath, "./dist/paged/index.html");
  t.is(pages[1].outputPath, "./dist/paged/page-1/index.html");
});

test("Template with Pagination, getRenderedTemplates", async t => {
  let tmpl = new Template(
    "./test/stubs/paged/pagedpermalinkif.njk",
    "./test/stubs/",
    "./dist"
  );

  let outputPath = await tmpl.getOutputPath();
  let data = await tmpl.getData();
  t.is(outputPath, "./dist/paged/index.html");

  let templates = await tmpl.getRenderedTemplates(data);
  t.is(templates.length, 2);
});

test("Issue 135", async t => {
  let dataObj = new TemplateData("./test/stubs/");
  await dataObj.cacheData();

  let tmpl = new Template(
    "./test/stubs/issue-135/template.njk",
    "./test/stubs/",
    "./dist",
    dataObj
  );

  let data = await tmpl.getData();
  let templates = await tmpl.getRenderedTemplates(data);
  t.is(data.articles.length, 1);
  t.is(data.articles[0].title, "Do you even paginate bro?");
  t.is(
    await templates[0].outputPath,
    "./dist/blog/do-you-even-paginate-bro/index.html"
  );

  let pages = await tmpl.getTemplates(data);
  t.is(pages.length, 1);
  t.is(pages[0].outputPath, "./dist/blog/do-you-even-paginate-bro/index.html");
});

test("Template with Pagination, getTemplates has page variables set", async t => {
  let tmpl = new Template(
    "./test/stubs/paged/pagedpermalinkif.njk",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let templates = await tmpl.getTemplates(data);
  t.is(templates[0].data.page.url, "/paged/");
  t.is(templates[0].data.page.outputPath, "./dist/paged/index.html");

  t.is(templates[1].data.page.url, "/paged/page-1/");
  t.is(templates[1].data.page.outputPath, "./dist/paged/page-1/index.html");
});

test("Template with Pagination, getRenderedTemplates has page variables set", async t => {
  let tmpl = new Template(
    "./test/stubs/paged/pagedpermalinkif.njk",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let pages = await tmpl.getRenderedTemplates(data);
  t.is(pages[0].data.page.url, "/paged/");
  t.is(pages[0].data.page.outputPath, "./dist/paged/index.html");

  t.is(pages[1].data.page.url, "/paged/page-1/");
  t.is(pages[1].data.page.outputPath, "./dist/paged/page-1/index.html");
});

test("Page over an object (use keys)", async t => {
  let tmpl = new Template(
    "./test/stubs/paged/pagedobject.njk",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let pages = await tmpl.getTemplates(data);
  t.is(pages.length, 3);

  t.is(pages[0].outputPath, "./dist/paged/pagedobject/index.html");
  t.is(
    (await pages[0].template.render(pages[0].data)).trim(),
    "<ol><li>item1</li><li>item2</li><li>item3</li><li>item4</li></ol>"
  );

  t.is(pages[1].outputPath, "./dist/paged/pagedobject/1/index.html");
  t.is(
    (await pages[1].template.render(pages[1].data)).trim(),
    "<ol><li>item5</li><li>item6</li><li>item7</li><li>item8</li></ol>"
  );
});

test("Page over an object (use values)", async t => {
  let tmpl = new Template(
    "./test/stubs/paged/pagedobjectvalues.njk",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let pages = await tmpl.getTemplates(data);
  t.is(pages.length, 3);

  t.is(pages[0].outputPath, "./dist/paged/pagedobjectvalues/index.html");
  t.is(
    (await pages[0].template.render(pages[0].data)).trim(),
    "<ol><li>itemvalue1</li><li>itemvalue2</li><li>itemvalue3</li><li>itemvalue4</li></ol>"
  );

  t.is(pages[1].outputPath, "./dist/paged/pagedobjectvalues/1/index.html");
  t.is(
    (await pages[1].template.render(pages[1].data)).trim(),
    "<ol><li>itemvalue5</li><li>itemvalue6</li><li>itemvalue7</li><li>itemvalue8</li></ol>"
  );
});

test("Page over an object (filtered, array)", async t => {
  let tmpl = new Template(
    "./test/stubs/paged/pagedobjectfilterarray.njk",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let pages = await tmpl.getTemplates(data);

  t.is(
    (await pages[0].template.render(pages[0].data)).trim(),
    "<ol><li>item1</li><li>item2</li><li>item3</li><li>item5</li></ol>"
  );

  t.is(
    (await pages[1].template.render(pages[1].data)).trim(),
    "<ol><li>item6</li><li>item7</li><li>item8</li><li>item9</li></ol>"
  );
});

test("Page over an object (filtered, string)", async t => {
  let tmpl = new Template(
    "./test/stubs/paged/pagedobjectfilterstring.njk",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let pages = await tmpl.getTemplates(data);
  t.is(pages.length, 2);

  t.is(
    (await pages[0].template.render(pages[0].data)).trim(),
    "<ol><li>item1</li><li>item2</li><li>item3</li><li>item5</li></ol>"
  );

  t.is(
    (await pages[1].template.render(pages[1].data)).trim(),
    "<ol><li>item6</li><li>item7</li><li>item8</li><li>item9</li></ol>"
  );
});

test("Pagination with deep data merge #147", async t => {
  let tmpl = new Template(
    "./test/stubs/paged/pagedinlinedata.njk",
    "./test/stubs/",
    "./dist"
  );
  tmpl.config = {
    keys: {
      layout: "layout"
    },
    dataDeepMerge: true
  };

  let data = await tmpl.getData();
  let pages = await tmpl.getTemplates(data);
  t.is(pages.length, 2);

  t.is(pages[0].outputPath, "./dist/paged/pagedinlinedata/index.html");
  t.is(
    (await pages[0].template.render(pages[0].data)).trim(),
    "<ol><li>item1</li><li>item2</li><li>item3</li><li>item4</li></ol>"
  );

  t.is(pages[1].outputPath, "./dist/paged/pagedinlinedata/1/index.html");
  t.is(
    (await pages[1].template.render(pages[1].data)).trim(),
    "<ol><li>item5</li><li>item6</li><li>item7</li><li>item8</li></ol>"
  );
});

test("Pagination with deep data merge with alias #147", async t => {
  let tmpl = new Template(
    "./test/stubs/paged/pagedalias.njk",
    "./test/stubs/",
    "./dist"
  );
  tmpl.config = {
    keys: {
      layout: "layout",
      permalink: "permalink"
    },
    dynamicPermalinks: true,
    dataDeepMerge: true
  };

  let data = await tmpl.getData();
  let pages = await tmpl.getTemplates(data);

  t.is(pages[0].outputPath, "./dist/pagedalias/item1/index.html");
  t.is(pages[1].outputPath, "./dist/pagedalias/item2/index.html");

  t.is((await pages[0].template.render(pages[0].data)).trim(), "item1");
  t.is((await pages[1].template.render(pages[1].data)).trim(), "item2");
});

test("Paginate data in frontmatter (reversed)", async t => {
  let tmpl = new Template(
    "./test/stubs/paged/pagedinlinedata-reverse.njk",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let pages = await tmpl.getTemplates(data);
  t.is(pages.length, 2);

  t.is(pages[0].outputPath, "./dist/paged/pagedinlinedata-reverse/index.html");
  t.is(
    (await pages[0].template.render(pages[0].data)).trim(),
    "<ol><li>item8</li><li>item7</li><li>item6</li><li>item5</li></ol>"
  );

  t.is(
    pages[1].outputPath,
    "./dist/paged/pagedinlinedata-reverse/1/index.html"
  );
  t.is(
    (await pages[1].template.render(pages[1].data)).trim(),
    "<ol><li>item4</li><li>item3</li><li>item2</li><li>item1</li></ol>"
  );
});

test("No circular dependency (does not throw)", t => {
  new Pagination({
    collections: {
      tag1: []
    },
    pagination: {
      data: "collections.tag1",
      size: 1
    },
    tags: ["tag2"]
  });

  t.true(true);
});

test("Circular dependency (pagination iterates over tag1 but also supplies pages to tag1)", t => {
  t.throws(() => {
    new Pagination({
      collections: {
        tag1: [],
        tag2: []
      },
      pagination: {
        data: "collections.tag1",
        size: 1
      },
      tags: ["tag1"]
    });
  });
});

test("Circular dependency but should not error because it uses eleventyExcludeFromCollections", t => {
  new Pagination({
    eleventyExcludeFromCollections: true,
    collections: {
      tag1: [],
      tag2: []
    },
    pagination: {
      data: "collections.tag1",
      size: 1
    },
    tags: ["tag1"]
  });

  t.true(true);
});

test("Pagination `before` Callback", async t => {
  let tmpl = new Template(
    "./test/stubs/paged/paged-before.njk",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let templates = await tmpl.getTemplates(data);
  t.deepEqual(templates[0].data.pagination.items, ["item6"]);
  t.deepEqual(templates[0].data.myalias, "item6");
});

test("Pagination `before` Callback with metadata", async t => {
  let tmpl = new Template(
    "./test/stubs/paged/paged-before-metadata.njk",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let templates = await tmpl.getTemplates(data);
  t.deepEqual(templates[0].data.pagination.items, ["item3"]);
});

test("Pagination `before` Callback with a Filter", async t => {
  let tmpl = new Template(
    "./test/stubs/paged/paged-before-filter.njk",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let templates = await tmpl.getTemplates(data);
  t.deepEqual(templates[0].data.pagination.items, ["item2"]);
  t.deepEqual(templates[0].data.myalias, "item2");
});

test("Pagination `before` Callback with `reverse: true` (test order of operations)", async t => {
  let tmpl = new Template(
    "./test/stubs/paged/paged-before-and-reverse.njk",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let templates = await tmpl.getTemplates(data);
  t.deepEqual(templates[0].data.pagination.items, ["item2"]);
});

test("Pagination new v0.10.0 href/hrefs", async t => {
  let dataObj = new TemplateData("./test/stubs/");
  await dataObj.cacheData();

  let tmpl = new Template(
    "./test/stubs/paged/paged.njk",
    "./test/stubs/",
    "./dist",
    dataObj
  );

  let data = await tmpl.getData();
  let templates = await tmpl.getTemplates(data);
  t.is(templates[0].data.pagination.hrefs.length, 2);
  t.truthy(templates[0].data.pagination.href.first);
  t.truthy(templates[0].data.pagination.href.last);
  t.falsy(templates[0].data.pagination.href.previous);
  t.truthy(templates[0].data.pagination.href.next);

  t.is(templates[1].data.pagination.hrefs.length, 2);
  t.truthy(templates[1].data.pagination.href.first);
  t.truthy(templates[1].data.pagination.href.last);
  t.truthy(templates[1].data.pagination.href.previous);
  t.falsy(templates[1].data.pagination.href.next);
});

test("Pagination new v0.10.0 page/pages", async t => {
  let dataObj = new TemplateData("./test/stubs/");
  await dataObj.cacheData();

  let tmpl = new Template(
    "./test/stubs/paged/paged.njk",
    "./test/stubs/",
    "./dist",
    dataObj
  );

  let data = await tmpl.getData();
  let templates = await tmpl.getTemplates(data);

  t.is(templates[0].data.pagination.pages.length, 2);
  t.is(templates[0].data.pagination.pages[0].length, 5);
  t.is(templates[0].data.pagination.pages[1].length, 3);
  t.truthy(templates[0].data.pagination.page.first);
  t.truthy(templates[0].data.pagination.page.last);
  t.falsy(templates[0].data.pagination.page.previous);
  t.truthy(templates[0].data.pagination.page.next);

  t.is(templates[1].data.pagination.pages.length, 2);
  t.is(templates[1].data.pagination.pages[0].length, 5);
  t.is(templates[1].data.pagination.pages[1].length, 3);
  t.truthy(templates[1].data.pagination.page.first);
  t.truthy(templates[1].data.pagination.page.last);
  t.truthy(templates[1].data.pagination.page.previous);
  t.falsy(templates[1].data.pagination.page.next);
});

test("Pagination new v0.10.0 alias", async t => {
  let tmpl = new Template(
    "./test/stubs/paged/pagedalias.njk",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let templates = await tmpl.getTemplates(data);

  t.is(templates[0].data.pagination.alias, "font.test");
  t.is(templates[1].data.pagination.alias, "font.test");
});

test("Pagination make sure pageNumber is numeric for {{ pageNumber + 1 }} Issue #760", async t => {
  let tmpl = new Template(
    "./test/stubs/paged/pagedinlinedata.njk",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let templates = await tmpl.getTemplates(data);
  t.is(templates[0].data.pagination.pageNumber, 0);
  t.not(templates[0].data.pagination.pageNumber, "0");
});
