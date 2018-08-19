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
  t.is(paging.getPagedItems().length, 2);
});

test("Paginate data in frontmatter", async t => {
  let tmpl = new Template(
    "./test/stubs/paged/pagedinlinedata.njk",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let paging = new Pagination(data);
  paging.setTemplate(tmpl);
  let pages = await paging.getPageTemplates();
  t.is(pages.length, 2);

  t.is(
    await pages[0].getOutputPath(),
    "./dist/paged/pagedinlinedata/index.html"
  );
  t.is(
    (await pages[0].render()).trim(),
    "<ol><li>item1</li><li>item2</li><li>item3</li><li>item4</li></ol>"
  );

  t.is(
    await pages[1].getOutputPath(),
    "./dist/paged/pagedinlinedata/1/index.html"
  );
  t.is(
    (await pages[1].render()).trim(),
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

  let paging = new Pagination(data);
  paging.setTemplate(tmpl);
  let pages = await paging.getPageTemplates();
  t.is(pages.length, 2);

  t.is(await pages[0].getOutputPath(), "./dist/paged/index.html");
  t.is(
    (await pages[0].render()).trim(),
    "<ol><li>item1</li><li>item2</li><li>item3</li><li>item4</li><li>item5</li></ol>"
  );

  t.is(await pages[1].getOutputPath(), "./dist/paged/1/index.html");
  t.is(
    (await pages[1].render()).trim(),
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
  let paging = new Pagination(data);
  paging.setTemplate(tmpl);
  let pages = await paging.getPageTemplates();

  t.is(
    await pages[0].getOutputPath(),
    "./dist/paged/slug-candidate/index.html"
  );
  t.is(
    await pages[1].getOutputPath(),
    "./dist/paged/another-slug-candidate/index.html"
  );
});

test("Permalink with pagination variables (numeric)", async t => {
  let tmpl = new Template(
    "./test/stubs/paged/pagedpermalinknumeric.njk",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let paging = new Pagination(data);
  paging.setTemplate(tmpl);
  let pages = await paging.getPageTemplates();

  let page0Data = await pages[0].getData();
  t.is(await pages[0].getOutputPath(), "./dist/paged/page-0/index.html");
  t.falsy(page0Data.pagination.previousPageLink);
  t.is(page0Data.pagination.nextPageLink, "/paged/page-1/index.html");
  t.is(page0Data.pagination.pageLinks.length, 2);

  let page1Data = await pages[1].getData();
  t.is(await pages[1].getOutputPath(), "./dist/paged/page-1/index.html");
  t.is(page1Data.pagination.previousPageLink, "/paged/page-0/index.html");
  t.falsy(page1Data.pagination.nextPageLink);
  t.is(page1Data.pagination.pageLinks.length, 2);
});

test("Permalink with pagination variables (numeric, one indexed)", async t => {
  let tmpl = new Template(
    "./test/stubs/paged/pagedpermalinknumericoneindexed.njk",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let paging = new Pagination(data);
  paging.setTemplate(tmpl);
  let pages = await paging.getPageTemplates();

  let page0Data = await pages[0].getData();
  t.is(await pages[0].getOutputPath(), "./dist/paged/page-1/index.html");
  t.falsy(page0Data.pagination.previousPageLink);
  t.is(page0Data.pagination.nextPageLink, "/paged/page-2/index.html");
  t.is(page0Data.pagination.pageLinks.length, 2);

  let page1Data = await pages[1].getData();
  t.is(await pages[1].getOutputPath(), "./dist/paged/page-2/index.html");
  t.is(page1Data.pagination.previousPageLink, "/paged/page-1/index.html");
  t.falsy(page1Data.pagination.nextPageLink);
  t.is(page1Data.pagination.pageLinks.length, 2);
});

test("Alias to page data", async t => {
  let tmpl = new Template(
    "./test/stubs/paged/pagedalias.njk",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let paging = new Pagination(data);
  paging.setTemplate(tmpl);
  let pages = await paging.getPageTemplates();

  t.is(await pages[0].getOutputPath(), "./dist/pagedalias/item1/index.html");
  t.is(await pages[1].getOutputPath(), "./dist/pagedalias/item2/index.html");

  t.is((await pages[0].render()).trim(), "item1");
  t.is((await pages[1].render()).trim(), "item2");
});

test("Alias to page data (size 2)", async t => {
  let tmpl = new Template(
    "./test/stubs/paged/pagedaliassize2.njk",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let paging = new Pagination(data);
  paging.setTemplate(tmpl);
  let pages = await paging.getPageTemplates();

  t.is(await pages[0].getOutputPath(), "./dist/pagedalias/item1/index.html");
  t.is(await pages[1].getOutputPath(), "./dist/pagedalias/item3/index.html");

  t.is((await pages[0].render()).trim(), "item1");
  t.is((await pages[1].render()).trim(), "item3");
});

test("Permalink with pagination variables (and an if statement, nunjucks)", async t => {
  let tmpl = new Template(
    "./test/stubs/paged/pagedpermalinkif.njk",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let paging = new Pagination(data);
  paging.setTemplate(tmpl);
  let pages = await paging.getPageTemplates();

  t.is(await pages[0].getOutputPath(), "./dist/paged/index.html");
  t.is(await pages[1].getOutputPath(), "./dist/paged/page-1/index.html");
});

test("Permalink with pagination variables (and an if statement, liquid)", async t => {
  let tmpl = new Template(
    "./test/stubs/paged/pagedpermalinkif.liquid",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let paging = new Pagination(data);
  paging.setTemplate(tmpl);
  let pages = await paging.getPageTemplates();

  t.is(await pages[0].getOutputPath(), "./dist/paged/index.html");
  t.is(await pages[1].getOutputPath(), "./dist/paged/page-1/index.html");
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

  let paging = new Pagination(data);
  paging.setTemplate(tmpl);
  let pages = await paging.getPageTemplates();
  t.is(pages.length, 1);
  t.is(
    await pages[0].getOutputPath(),
    "./dist/blog/do-you-even-paginate-bro/index.html"
  );
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
  let templates = await tmpl.getRenderedTemplates(data);
  t.is(templates[0].data.page.url, "/paged/");
  t.is(templates[0].data.page.outputPath, "./dist/paged/index.html");

  t.is(templates[1].data.page.url, "/paged/page-1/");
  t.is(templates[1].data.page.outputPath, "./dist/paged/page-1/index.html");
});

test("Page over an object (use keys)", async t => {
  let tmpl = new Template(
    "./test/stubs/paged/pagedobject.njk",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let paging = new Pagination(data);
  paging.setTemplate(tmpl);
  let pages = await paging.getPageTemplates();
  t.is(pages.length, 3);

  t.is(await pages[0].getOutputPath(), "./dist/paged/pagedobject/index.html");
  t.is(
    (await pages[0].render()).trim(),
    "<ol><li>item1</li><li>item2</li><li>item3</li><li>item4</li></ol>"
  );

  t.is(await pages[1].getOutputPath(), "./dist/paged/pagedobject/1/index.html");
  t.is(
    (await pages[1].render()).trim(),
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
  let paging = new Pagination(data);
  paging.setTemplate(tmpl);
  let pages = await paging.getPageTemplates();
  t.is(pages.length, 3);

  t.is(
    await pages[0].getOutputPath(),
    "./dist/paged/pagedobjectvalues/index.html"
  );
  t.is(
    (await pages[0].render()).trim(),
    "<ol><li>itemvalue1</li><li>itemvalue2</li><li>itemvalue3</li><li>itemvalue4</li></ol>"
  );

  t.is(
    await pages[1].getOutputPath(),
    "./dist/paged/pagedobjectvalues/1/index.html"
  );
  t.is(
    (await pages[1].render()).trim(),
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
  let paging = new Pagination(data);
  paging.setTemplate(tmpl);
  let pages = await paging.getPageTemplates();
  t.is(pages.length, 2);

  t.is(
    (await pages[0].render()).trim(),
    "<ol><li>item1</li><li>item2</li><li>item3</li><li>item5</li></ol>"
  );

  t.is(
    (await pages[1].render()).trim(),
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
  let paging = new Pagination(data);
  paging.setTemplate(tmpl);
  let pages = await paging.getPageTemplates();
  t.is(pages.length, 2);

  t.is(
    (await pages[0].render()).trim(),
    "<ol><li>item1</li><li>item2</li><li>item3</li><li>item5</li></ol>"
  );

  t.is(
    (await pages[1].render()).trim(),
    "<ol><li>item6</li><li>item7</li><li>item8</li><li>item9</li></ol>"
  );
});
