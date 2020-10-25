const test = require("ava");
const Template = require("../src/Template");
const TemplateMap = require("../src/TemplateMap");
const TemplateCollection = require("../src/TemplateCollection");
const UsingCircularTemplateContentReferenceError = require("../src/Errors/UsingCircularTemplateContentReferenceError");
const normalizeNewLines = require("./Util/normalizeNewLines");
const templateConfig = require("../src/Config");

const getNewTemplate = (...args) => {
  // monkey patching to add templateConfig to the end of every call
  args = args.concat(Array(5).fill(null)).slice(0, 5).concat(templateConfig);
  return new Template(...args);
};

let tmpl1, tmpl2, tmpl4, tmpl5;
test.before(async () => {
  // This runs concurrently with the above
  await templateConfig.init();

  tmpl1 = getNewTemplate(
    "./test/stubs/templateMapCollection/test1.md",
    "./test/stubs/",
    "./test/stubs/_site"
  );
  tmpl2 = getNewTemplate(
    "./test/stubs/templateMapCollection/test2.md",
    "./test/stubs/",
    "./test/stubs/_site"
  );
  tmpl4 = getNewTemplate(
    "./test/stubs/templateMapCollection/test4.md",
    "./test/stubs/",
    "./test/stubs/_site"
  );
  tmpl5 = getNewTemplate(
    "./test/stubs/templateMapCollection/test5.md",
    "./test/stubs/",
    "./test/stubs/_site"
  );
});

test("TemplateMap has collections added", async (t) => {
  let tm = new TemplateMap();
  await tm.add(tmpl1);
  await tm.add(tmpl2);
  await tm.cache();

  t.is(tm.getMap().length, 2);
  t.is(tm.collection.getAll().length, 2);
});

test("TemplateMap compared to Collection API", async (t) => {
  let tm = new TemplateMap();
  await tm.add(tmpl1);
  await tm.add(tmpl4);
  await tm.cache();

  let map = tm.getMap();
  t.deepEqual(map[0].template, tmpl1);
  t.deepEqual(map[0].data.collections.post[0].template, tmpl1);
  t.deepEqual(map[1].template, tmpl4);
  t.deepEqual(map[1].data.collections.post[1].template, tmpl4);

  let c = new TemplateCollection();
  await c._testAddTemplate(tmpl1);
  await c._testAddTemplate(tmpl4);

  let posts = c.getFilteredByTag("post");
  t.is(posts.length, 2);
  t.deepEqual(posts[0].template, tmpl1);
  t.deepEqual(posts[1].template, tmpl4);
});

test("populating the collection twice should clear the previous values (--watch was making it cumulative)", async (t) => {
  let tm = new TemplateMap();
  await tm.add(tmpl1);
  await tm.add(tmpl2);

  await tm.cache();
  await tm.cache();

  t.is(tm.getMap().length, 2);
});

test("TemplateMap adds collections data and has templateContent values", async (t) => {
  let tm = new TemplateMap();
  await tm.add(tmpl1);
  await tm.add(tmpl2);

  let map = tm.getMap();
  t.falsy(map[0].data.collections);
  t.falsy(map[1].data.collections);

  await tm.cache();

  t.truthy(map[0]._pages[0].templateContent);
  t.truthy(map[1]._pages[0].templateContent);
  t.truthy(map[0].data.collections);
  t.truthy(map[1].data.collections);
  t.is(map[0].data.collections.post.length, 1);
  t.is(map[0].data.collections.all.length, 2);
  t.is(map[1].data.collections.post.length, 1);
  t.is(map[1].data.collections.all.length, 2);

  t.is(
    await map[0].template._testRenderWithoutLayouts(map[0].data),
    map[0]._pages[0].templateContent
  );
  t.is(
    await map[1].template._testRenderWithoutLayouts(map[1].data),
    map[1]._pages[0].templateContent
  );
});

test("TemplateMap circular references (map without templateContent)", async (t) => {
  let tm = new TemplateMap();
  await tm.add(
    getNewTemplate(
      "./test/stubs/templateMapCollection/test3.md",
      "./test/stubs/",
      "./test/stubs/_site"
    )
  );

  let map = tm.getMap();
  t.falsy(map[0].data.collections);

  await tm.cache();
  t.truthy(map[0]._pages[0].templateContent);
  t.truthy(map[0].data.collections);
  t.is(map[0].data.collections.all.length, 1);

  t.is(
    await map[0].template._testRenderWithoutLayouts(map[0].data),
    map[0]._pages[0].templateContent
  );
});

test("TemplateMap circular references (map.templateContent)", async (t) => {
  let tm = new TemplateMap();
  await tm.add(
    getNewTemplate(
      "./test/stubs/templateMapCollection/templateContent.md",
      "./test/stubs/",
      "./test/stubs/_site"
    )
  );

  let map = tm.getMap();
  t.falsy(map[0].data.collections);

  await t.throwsAsync(
    async () => {
      await tm.cache();
    },
    {
      instanceOf: UsingCircularTemplateContentReferenceError,
    }
  );
});

test("Issue #115, mixing pagination and collections", async (t) => {
  let tmplFoos = getNewTemplate(
    "./test/stubs/issue-115/template-foos.liquid",
    "./test/stubs/",
    "./test/stubs/_site"
  );
  let tmplBars = getNewTemplate(
    "./test/stubs/issue-115/template-bars.liquid",
    "./test/stubs/",
    "./test/stubs/_site"
  );
  let tmplIndex = getNewTemplate(
    "./test/stubs/issue-115/index.liquid",
    "./test/stubs/",
    "./test/stubs/_site"
  );

  let tm = new TemplateMap();
  await tm.add(tmplFoos);
  await tm.add(tmplBars);
  await tm.add(tmplIndex);
  await tm.cache();

  let map = tm.getMap();
  t.is(map.length, 3);
  t.deepEqual(map[2].template, tmplIndex);

  let collections = await tm._testGetAllCollectionsData();
  t.is(Object.keys(collections.all).length, 3);
  t.is(Object.keys(collections.foos).length, 1);
  t.is(Object.keys(collections.bars).length, 1);
  t.is(Object.keys((await tm._testGetCollectionsData()).all).length, 3);
  t.is(Object.keys((await tm._testGetCollectionsData()).foos).length, 1);
  t.is(Object.keys((await tm._testGetCollectionsData()).bars).length, 1);

  t.truthy(map[0].data.collections);
  t.truthy(map[1].data.collections);
  t.truthy(map[2].data.collections);
  t.truthy(Object.keys(map[2].data.collections).length);

  t.is(Object.keys(map[0].data.collections.all).length, 3);
  t.is(Object.keys(map[0].data.collections.foos).length, 1);
  t.is(Object.keys(map[0].data.collections.bars).length, 1);

  t.is(Object.keys(map[1].data.collections.all).length, 3);
  t.is(Object.keys(map[1].data.collections.foos).length, 1);
  t.is(Object.keys(map[1].data.collections.bars).length, 1);

  t.is(Object.keys(map[2].data.collections.all).length, 3);
  t.is(Object.keys(map[2].data.collections.foos).length, 1);
  t.is(Object.keys(map[2].data.collections.bars).length, 1);

  let entry = await map[2].template.getRenderedTemplates(map[2].data);
  t.deepEqual(
    normalizeNewLines(entry[0].templateContent),
    `This page is foos
This page is bars
`
  );
});

test("Issue #115 with layout, mixing pagination and collections", async (t) => {
  let tmplFoos = getNewTemplate(
    "./test/stubs/issue-115/template-foos.liquid",
    "./test/stubs/",
    "./test/stubs/_site"
  );
  let tmplBars = getNewTemplate(
    "./test/stubs/issue-115/template-bars.liquid",
    "./test/stubs/",
    "./test/stubs/_site"
  );
  let tmplIndex = getNewTemplate(
    "./test/stubs/issue-115/index-with-layout.liquid",
    "./test/stubs/",
    "./test/stubs/_site"
  );

  let tm = new TemplateMap();
  await tm.add(tmplFoos);
  await tm.add(tmplBars);
  await tm.add(tmplIndex);
  await tm.cache();

  let map = tm.getMap();
  t.is(map.length, 3);
  t.deepEqual(map[2].template, tmplIndex);

  let collections = await tm._testGetAllCollectionsData();
  t.is(Object.keys(collections.all).length, 3);
  t.is(Object.keys(collections.foos).length, 1);
  t.is(Object.keys(collections.bars).length, 1);
  t.is(Object.keys((await tm._testGetCollectionsData()).all).length, 3);
  t.is(Object.keys((await tm._testGetCollectionsData()).foos).length, 1);
  t.is(Object.keys((await tm._testGetCollectionsData()).bars).length, 1);

  t.truthy(map[0].data.collections);
  t.truthy(map[1].data.collections);
  t.truthy(map[2].data.collections);
  t.truthy(Object.keys(map[2].data.collections).length);

  t.is(Object.keys(map[0].data.collections.all).length, 3);
  t.is(Object.keys(map[0].data.collections.foos).length, 1);
  t.is(Object.keys(map[0].data.collections.bars).length, 1);

  t.is(Object.keys(map[1].data.collections.all).length, 3);
  t.is(Object.keys(map[1].data.collections.foos).length, 1);
  t.is(Object.keys(map[1].data.collections.bars).length, 1);

  t.is(Object.keys(map[2].data.collections.all).length, 3);
  t.is(Object.keys(map[2].data.collections.foos).length, 1);
  t.is(Object.keys(map[2].data.collections.bars).length, 1);

  let entry = await map[2].template.getRenderedTemplates(map[2].data);
  t.deepEqual(
    normalizeNewLines(entry[0].templateContent),
    `This page is foos
This page is bars
`
  );
});

test("TemplateMap adds collections data and has page data values using .cache()", async (t) => {
  let tm = new TemplateMap();
  await tm.add(tmpl1);
  await tm.add(tmpl2);

  let map = tm.getMap();
  await tm.cache();
  t.is(map[0].data.page.url, "/templateMapCollection/test1/");
  t.is(
    map[0].data.page.outputPath,
    "./test/stubs/_site/templateMapCollection/test1/index.html"
  );
  t.is(
    map[0].data.page.inputPath,
    "./test/stubs/templateMapCollection/test1.md"
  );
  t.is(map[0].data.page.fileSlug, "test1");
  t.truthy(map[0].data.page.date);
});

test("TemplateMap adds collections data and has page data values using ._testGetCollectionsData()", async (t) => {
  let tm = new TemplateMap();
  await tm.add(tmpl1);
  await tm.add(tmpl2);

  let collections = await tm._testGetCollectionsData();
  t.is(collections.all[0].url, "/templateMapCollection/test1/");
  t.is(
    collections.all[0].outputPath,
    "./test/stubs/_site/templateMapCollection/test1/index.html"
  );

  t.is(collections.all[0].data.page.url, "/templateMapCollection/test1/");
  t.is(
    collections.all[0].data.page.outputPath,
    "./test/stubs/_site/templateMapCollection/test1/index.html"
  );
  t.is(
    collections.all[0].data.page.inputPath,
    "./test/stubs/templateMapCollection/test1.md"
  );
  t.is(collections.all[0].data.page.fileSlug, "test1");
});

test("Url should be available in user config collections API calls", async (t) => {
  let tm = new TemplateMap();
  await tm.add(tmpl1);
  await tm.add(tmpl2);
  tm.setUserConfigCollections({
    userCollection: function (collection) {
      let all = collection.getAll();
      return all;
    },
  });

  let collections = await tm._testGetCollectionsData();
  t.truthy(collections.userCollection);
  t.truthy(collections.userCollection.length);
  t.is(collections.userCollection[0].url, "/templateMapCollection/test1/");
  t.is(
    collections.userCollection[0].outputPath,
    "./test/stubs/_site/templateMapCollection/test1/index.html"
  );

  t.is(
    collections.userCollection[0].data.page.url,
    "/templateMapCollection/test1/"
  );
  t.is(
    collections.userCollection[0].data.page.outputPath,
    "./test/stubs/_site/templateMapCollection/test1/index.html"
  );
});

test("Url should be available in user config collections API calls (test in callback)", async (t) => {
  let tm = new TemplateMap();
  tm.setUserConfigCollections({
    userCollection: function (collection) {
      let all = collection.getAll();
      t.is(all[0].url, "/templateMapCollection/test1/");
      t.is(
        all[0].outputPath,
        "./test/stubs/_site/templateMapCollection/test1/index.html"
      );
      t.is(all[1].url, "/templateMapCollection/test2/");
      t.is(
        all[1].outputPath,
        "./test/stubs/_site/templateMapCollection/test2/index.html"
      );

      return all;
    },
  });

  await tm.add(tmpl1);
  await tm.add(tmpl2);
  await tm.cache();
});

test("Should be able to paginate a tag generated collection", async (t) => {
  let tm = new TemplateMap();
  await tm.add(tmpl1);
  await tm.add(tmpl2);

  let pagedTmpl = getNewTemplate(
    "./test/stubs/templateMapCollection/paged-tag.md",
    "./test/stubs/",
    "./test/stubs/_site"
  );
  await tm.add(pagedTmpl);

  let collections = await tm._testGetCollectionsData();
  t.truthy(collections.dog);
  t.truthy(collections.dog.length);
});

test("Should be able to paginate a user config collection", async (t) => {
  let tm = new TemplateMap();
  await tm.add(tmpl1);
  await tm.add(tmpl2);

  let pagedTmpl = getNewTemplate(
    "./test/stubs/templateMapCollection/paged-cfg.md",
    "./test/stubs/",
    "./test/stubs/_site"
  );
  await tm.add(pagedTmpl);

  tm.setUserConfigCollections({
    userCollection: function (collection) {
      let all = collection.getFilteredByTag("dog");
      return all;
    },
  });

  let collections = await tm._testGetCollectionsData();
  t.truthy(collections.userCollection);
  t.truthy(collections.userCollection.length);
});

test("Should be able to paginate a user config collection (uses rendered permalink)", async (t) => {
  let tm = new TemplateMap();
  await tm.add(tmpl1);
  await tm.add(tmpl2);

  let pagedTmpl = getNewTemplate(
    "./test/stubs/templateMapCollection/paged-cfg-permalink.md",
    "./test/stubs/",
    "./test/stubs/_site"
  );
  await tm.add(pagedTmpl);

  tm.setUserConfigCollections({
    userCollection: function (collection) {
      let all = collection.getFilteredByTag("dog");
      t.is(all[0].url, "/templateMapCollection/test1/");
      t.is(
        all[0].outputPath,
        "./test/stubs/_site/templateMapCollection/test1/index.html"
      );
      return all;
    },
  });

  let collections = await tm._testGetCollectionsData();
  t.truthy(collections.userCollection);
  t.truthy(collections.userCollection.length);

  let urls = [];
  for (let item of collections.all) {
    urls.push(item.url);
  }
  t.is(urls.indexOf("/test-title/hello/") > -1, true);
});

test("Should be able to paginate a user config collection (paged template is also tagged)", async (t) => {
  let tm = new TemplateMap();
  await tm.add(tmpl1); // has dog tag
  await tm.add(tmpl2); // does not have dog tag
  await tm.add(tmpl4); // has dog tag

  let pagedTmpl = getNewTemplate(
    "./test/stubs/templateMapCollection/paged-cfg-tagged.md",
    "./test/stubs/",
    "./test/stubs/_site"
  );
  await tm.add(pagedTmpl);

  tm.setUserConfigCollections({
    userCollection: function (collection) {
      let all = collection.getFilteredByTag("dog");
      return all;
    },
  });

  let collections = await tm._testGetCollectionsData();
  t.is(collections.dog.length, 2);

  t.truthy(collections.haha);
  t.is(collections.haha.length, 1);
  t.is(collections.haha[0].url, "/templateMapCollection/paged-cfg-tagged/");
});

test("Should be able to paginate a user config collection (paged template is also tagged, add all pages to collections)", async (t) => {
  let tm = new TemplateMap();
  await tm.add(tmpl1); // has dog tag
  await tm.add(tmpl2); // does not have dog tag
  await tm.add(tmpl4); // has dog tag

  let pagedTmpl = getNewTemplate(
    "./test/stubs/templateMapCollection/paged-cfg-tagged-apply-to-all.md",
    "./test/stubs/",
    "./test/stubs/_site"
  );
  await tm.add(pagedTmpl);

  tm.setUserConfigCollections({
    userCollection: function (collection) {
      let all = collection.getFilteredByTag("dog");
      return all;
    },
  });

  let collections = await tm._testGetCollectionsData();
  t.is(collections.dog.length, 2);

  t.truthy(collections.haha);
  t.is(collections.haha.length, 2);
  t.is(
    collections.haha[0].url,
    "/templateMapCollection/paged-cfg-tagged-apply-to-all/"
  );
  t.is(
    collections.haha[1].url,
    "/templateMapCollection/paged-cfg-tagged-apply-to-all/1/"
  );
});

test("Should be able to paginate a user config collection (paged template is also tagged, uses custom rendered permalink)", async (t) => {
  let tm = new TemplateMap();
  await tm.add(tmpl1); // has dog tag
  await tm.add(tmpl2); // does not have dog tag
  await tm.add(tmpl4); // has dog tag

  let pagedTmpl = getNewTemplate(
    "./test/stubs/templateMapCollection/paged-cfg-tagged-permalink.md",
    "./test/stubs/",
    "./test/stubs/_site"
  );
  await tm.add(pagedTmpl);

  tm.setUserConfigCollections({
    userCollection: function (collection) {
      let all = collection.getFilteredByTag("dog");
      return all;
    },
  });

  let collections = await tm._testGetCollectionsData();
  t.truthy(collections.haha);
  t.is(collections.haha.length, 1);
  t.is(collections.haha[0].url, "/test-title/goodbye/");
});

test("Should be able to paginate a user config collection (paged template is also tagged, uses custom rendered permalink, add all pages to collections)", async (t) => {
  let tm = new TemplateMap();
  await tm.add(tmpl1); // has dog tag
  await tm.add(tmpl2); // does not have dog tag
  await tm.add(tmpl4); // has dog tag

  let pagedTmpl = getNewTemplate(
    "./test/stubs/templateMapCollection/paged-cfg-tagged-permalink-apply-to-all.md",
    "./test/stubs/",
    "./test/stubs/_site"
  );
  await tm.add(pagedTmpl);

  tm.setUserConfigCollections({
    userCollection: function (collection) {
      let all = collection.getFilteredByTag("dog");
      return all;
    },
  });

  let collections = await tm._testGetCollectionsData();
  t.truthy(collections.haha);
  t.is(collections.haha.length, 2);
  t.is(collections.haha[0].url, "/test-title/goodbye/");
  t.is(collections.haha[1].url, "/test-title-4/goodbye/");
});

test("TemplateMap render and templateContent are the same (templateContent doesn’t have layout but makes proper use of layout front matter data)", async (t) => {
  let tm = new TemplateMap();
  let tmplLayout = getNewTemplate(
    "./test/stubs/templateMapCollection/testWithLayout.md",
    "./test/stubs/",
    "./test/stubs/_site"
  );

  await tm.add(tmplLayout);

  let map = tm.getMap();
  await tm.cache();
  t.is(map[0]._pages[0].templateContent.trim(), "<p>Inherited</p>");
  t.is((await map[0].template.render(map[0].data)).trim(), "<p>Inherited</p>");
});

test("Should be able to paginate a tag generated collection (and it has templateContent)", async (t) => {
  let tm = new TemplateMap();
  await tm.add(tmpl1); // has dog tag
  await tm.add(tmpl2); // does not have dog tag
  await tm.add(tmpl4); // has dog tag

  let pagedTmpl = getNewTemplate(
    "./test/stubs/templateMapCollection/paged-tag-dogs-templateContent.md",
    "./test/stubs/",
    "./test/stubs/_site"
  );
  await tm.add(pagedTmpl);

  await tm.cache();

  let pagedMapEntry = tm.getMapEntryForInputPath(
    "./test/stubs/templateMapCollection/paged-tag-dogs-templateContent.md"
  );

  let templates = await pagedMapEntry.template.getRenderedTemplates(
    pagedMapEntry.data
  );
  t.is(templates.length, 2);
  t.is(templates[0].data.pagination.pageNumber, 0);
  t.is(templates[1].data.pagination.pageNumber, 1);

  t.is(
    templates[0].templateContent.trim(),
    `<p>Before</p>
<h1>Test 1</h1>
<p>After</p>`
  );
  t.is(
    templates[1].templateContent.trim(),
    `<p>Before</p>
<h1>Test 4</h1>
<p>After</p>`
  );
});

test("Should be able to paginate a tag generated collection when aliased (and it has templateContent)", async (t) => {
  let tm = new TemplateMap();
  await tm.add(tmpl1); // has dog tag
  await tm.add(tmpl2); // does not have dog tag
  await tm.add(tmpl4); // has dog tag

  let pagedTmpl = getNewTemplate(
    "./test/stubs/templateMapCollection/paged-tag-dogs-templateContent-alias.md",
    "./test/stubs/",
    "./test/stubs/_site"
  );
  await tm.add(pagedTmpl);

  await tm.cache();

  let pagedMapEntry = tm.getMapEntryForInputPath(
    "./test/stubs/templateMapCollection/paged-tag-dogs-templateContent-alias.md"
  );

  let templates = await pagedMapEntry.template.getRenderedTemplates(
    pagedMapEntry.data
  );

  t.is(templates.length, 1);
  t.is(templates[0].data.pagination.pageNumber, 0);
  t.is(
    templates[0].templateContent.trim(),
    `<p>Before</p>
<h1>Test 1</h1>
<h1>Test 4</h1>
<p>After</p>`
  );
});

test("Issue #253: Paginated template with a tag should put multiple pages into a collection", async (t) => {
  let tm = new TemplateMap();
  await tm.add(tmpl1);
  await tm.add(tmpl2);
  await tm.add(tmpl4);

  let pagedTmpl = getNewTemplate(
    "./test/stubs/tagged-pagination-multiples/test.njk",
    "./test/stubs/",
    "./test/stubs/_site"
  );
  await tm.add(pagedTmpl);

  // TODO test user config collections (no actual tests against this collection yet)
  tm.setUserConfigCollections({
    userCollection: function (collection) {
      let all = collection.getFilteredByTag("dog");
      return all;
    },
  });

  let collections = await tm._testGetCollectionsData();
  t.is(collections.dog.length, 2);

  t.truthy(collections.haha);
  t.is(collections.haha.length, 2);
  t.is(collections.haha[0].url, "/tagged-pagination-multiples/test/");
  t.is(collections.haha[1].url, "/tagged-pagination-multiples/test/1/");
});

test("getUserConfigCollectionNames", async (t) => {
  let tm = new TemplateMap();

  tm.setUserConfigCollections({
    userCollection: function (collection) {
      return collection.getAll();
    },
    otherUserCollection: function (collection) {
      return collection.getAll();
    },
  });

  t.deepEqual(tm.getUserConfigCollectionNames(), [
    "userCollection",
    "otherUserCollection",
  ]);
});

test("isUserConfigCollectionName", (t) => {
  let tm = new TemplateMap();
  tm.setUserConfigCollections({
    userCollection: function (collection) {
      return collection.getAll();
    },
  });

  t.is(tm.isUserConfigCollectionName("userCollection"), true);
  t.is(tm.isUserConfigCollectionName("userCollection2"), false);
});

test("Dependency Map should have nodes that have no dependencies and no dependents", async (t) => {
  let tm = new TemplateMap();
  await tm.add(tmpl1);
  await tm.add(tmpl5);

  await tm.cache();

  let deps = await tm.getMappedDependencies();
  t.true(deps.filter((dep) => dep.indexOf("test5.md") > -1).length > 0);

  let collections = await tm._testGetCollectionsData();
  t.is(collections.all.length, 2);
});

test("Dependency Map should have include orphan user config collections (in the correct order)", async (t) => {
  let tm = new TemplateMap();
  await tm.add(tmpl1);
  await tm.add(tmpl5);

  tm.setUserConfigCollections({
    userCollection: function (collection) {
      return collection.getAll();
    },
  });

  await tm.cache();

  let deps = await tm.getMappedDependencies();
  t.true(deps.filter((dep) => dep.indexOf("userCollection") > -1).length === 0);

  let delayedDeps = await tm.getDelayedMappedDependencies();
  t.true(
    delayedDeps.filter((dep) => dep.indexOf("userCollection") > -1).length > 0
  );

  let collections = await tm._testGetCollectionsData();
  t.is(collections.all.length, 2);
  t.is(collections.userCollection.length, 2);
});

test("Template pages should not have layouts when added to collections", async (t) => {
  let tm = new TemplateMap();
  let tmpl = getNewTemplate(
    "./test/stubs/collection-layout-wrap.njk",
    "./test/stubs/",
    "./test/stubs/_site"
  );
  await tm.add(tmpl);
  t.is(await tmpl.render(await tmpl.getData()), "<div>Layout Test</div>");

  let collections = await tm._testGetCollectionsData();
  t.is(collections.all.length, 1);
  t.is(collections.all[0].templateContent, "Layout Test");
});

test("Paginated template pages should not have layouts when added to collections", async (t) => {
  let tm = new TemplateMap();

  let pagedTmpl = getNewTemplate(
    "./test/stubs/tagged-pagination-multiples-layout/test.njk",
    "./test/stubs/",
    "./test/stubs/_site"
  );
  await tm.add(pagedTmpl);

  let collections = await tm._testGetCollectionsData();

  t.is(collections.all.length, 3);
  t.is(collections.all[0].templateContent, "one");
  t.is(collections.all[1].templateContent, "two");
  t.is(collections.all[2].templateContent, "three");
});

test("Tag pages. Allow pagination over all collections a la `data: collections`", async (t) => {
  let tm = new TemplateMap();

  let pagedTmpl = getNewTemplate(
    "./test/stubs/page-target-collections/tagpages.njk",
    "./test/stubs/",
    "./test/stubs/_site"
  );
  await tm.add(pagedTmpl);
  await tm.add(tmpl1);
  await tm.add(tmpl2);

  let collections = await tm._testGetCollectionsData();
  t.is(collections.all.length, 3);

  let collectionTagPagesTemplateContents = new Set(
    collections.all
      .filter(function (entry) {
        return entry.inputPath.endsWith("tagpages.njk");
      })
      .map(function (entry) {
        return entry.templateContent.trim();
      })
  );
  t.deepEqual(collectionTagPagesTemplateContents, new Set(["post"]));
});

test("Tag pages (all pages added to collections). Allow pagination over all collections a la `data: collections`", async (t) => {
  let tm = new TemplateMap();

  let pagedTmpl = getNewTemplate(
    "./test/stubs/page-target-collections/tagpagesall.njk",
    "./test/stubs/",
    "./test/stubs/_site"
  );
  await tm.add(pagedTmpl);
  await tm.add(tmpl1);
  await tm.add(tmpl2);

  let collections = await tm._testGetCollectionsData();
  t.is(collections.all.length, 5);

  let collectionTagPagesTemplateContents = new Set(
    collections.all
      .filter(function (entry) {
        return entry.inputPath.endsWith("tagpagesall.njk");
      })
      .map(function (entry) {
        return entry.templateContent.trim();
      })
  );
  t.deepEqual(
    collectionTagPagesTemplateContents,
    new Set(["post", "dog", "cat"])
  );
});

test("eleventyExcludeFromCollections", async (t) => {
  let tm = new TemplateMap();
  await tm.add(tmpl1);

  let excludedTmpl = getNewTemplate(
    "./test/stubs/eleventyExcludeFromCollections.njk",
    "./test/stubs/",
    "./test/stubs/_site"
  );
  await tm.add(excludedTmpl);

  await tm.cache();

  t.is(tm.getMap().length, 2);

  let collections = await tm._testGetCollectionsData();
  t.is(collections.all.length, 1);
  t.is(collections.post.length, 1);
  t.is(collections.dog.length, 1);
});

test("Paginate over collections.all", async (t) => {
  let tm = new TemplateMap();

  let pagedTmpl = getNewTemplate(
    "./test/stubs/page-target-collections/paginateall.njk",
    "./test/stubs/",
    "./test/stubs/_site"
  );
  await tm.add(pagedTmpl);
  await tm.add(tmpl1);
  await tm.add(tmpl2);

  let collections = await tm._testGetCollectionsData();
  t.is(collections.all.length, 4);
  t.is(
    collections.all.filter(function (entry) {
      return entry.inputPath.endsWith("test1.md");
    }).length,
    1
  );
  t.is(
    collections.all.filter(function (entry) {
      return entry.inputPath.endsWith("test2.md");
    }).length,
    1
  );
  t.is(
    collections.all.filter(function (entry) {
      return entry.inputPath.endsWith("paginateall.njk");
    }).length,
    2
  );

  let map = tm.getMap();
  t.is(
    map[0].inputPath,
    "./test/stubs/page-target-collections/paginateall.njk"
  );
  t.is(map[0]._pages.length, 2);
  t.is(
    map[0]._pages[0].templateContent,
    "INPUT PATH:./test/stubs/templateMapCollection/test1.md"
  );
  t.is(
    map[0]._pages[1].templateContent,
    "INPUT PATH:./test/stubs/templateMapCollection/test2.md"
  );
  t.is(map[1].inputPath, "./test/stubs/templateMapCollection/test1.md");
  t.is(map[1]._pages[0].templateContent.trim(), "<h1>Test 1</h1>");
  t.is(map[2].inputPath, "./test/stubs/templateMapCollection/test2.md");
  t.is(map[2]._pages[0].templateContent.trim(), "<h1>Test 2</h1>");
});

test("Paginate over collections.all WITH a paginate over collections (tag pages)", async (t) => {
  let tm = new TemplateMap();

  let pagedTmpl = getNewTemplate(
    "./test/stubs/page-target-collections/paginateall.njk",
    "./test/stubs/",
    "./test/stubs/_site"
  );
  let tagPagesTmpl = getNewTemplate(
    "./test/stubs/page-target-collections/tagpagesall.njk",
    "./test/stubs/",
    "./test/stubs/_site"
  );
  await tm.add(pagedTmpl);
  await tm.add(tagPagesTmpl);
  await tm.add(tmpl1);
  await tm.add(tmpl2);

  let collections = await tm._testGetCollectionsData();
  // 2 individual templates, 3 pages for tagpagesall, 5 pages from paginateall to paginate the 2+3
  t.is(collections.all.length, 10);
});

test("Test a transform with a layout (via templateMap)", async (t) => {
  t.plan(7);
  let tm = new TemplateMap();
  let tmpl = getNewTemplate(
    "./test/stubs-475/transform-layout/transform-layout.njk",
    "./test/stubs-475/",
    "./test/stubs-475/_site"
  );

  tmpl.addLinter(function (content, inputPath, outputPath) {
    // should be pre-transform content
    t.is(content, "<html><body>This is content.</body></html>");
    t.true(inputPath.endsWith("transform-layout.njk"));
    t.true(outputPath.endsWith("transform-layout/index.html"));
  });

  tmpl.addTransform(function (content, outputPath) {
    t.is(content, "<html><body>This is content.</body></html>");
    t.true(outputPath.endsWith("transform-layout/index.html"));
    return "OVERRIDE BY A TRANSFORM";
  });

  await tm.add(tmpl);

  await tm.cache();
  t.is(tm.getMap().length, 1);

  for (let entry of tm.getMap()) {
    for (let page of entry._pages) {
      t.is(
        await entry.template.renderPageEntry(entry, page),
        "OVERRIDE BY A TRANSFORM"
      );
    }
  }
});

test("Async user collection addCollection method", async (t) => {
  let tm = new TemplateMap();
  await tm.add(tmpl1);
  tm.setUserConfigCollections({
    userCollection: async function (collection) {
      return new Promise((resolve, reject) => {
        setTimeout(function () {
          resolve(collection.getAll());
        }, 50);
      });
    },
  });

  let collections = await tm._testGetCollectionsData();
  t.is(collections.userCollection[0].url, "/templateMapCollection/test1/");

  t.is(collections.userCollection[0].data.collections.userCollection.length, 1);
});

test("Duplicate permalinks in template map", async (t) => {
  let tmpl1 = getNewTemplate(
    "./test/stubs/permalink-conflicts/test1.md",
    "./test/stubs/",
    "./test/stubs/_site"
  );
  let tmpl2 = getNewTemplate(
    "./test/stubs/permalink-conflicts/test2.md",
    "./test/stubs/",
    "./test/stubs/_site"
  );

  let tm = new TemplateMap();
  await tm.add(tmpl1);
  await tm.add(tmpl2);
  await t.throwsAsync(async () => {
    await tm.cache();
  });
});

test("No duplicate permalinks in template map, using false", async (t) => {
  let tmpl1 = getNewTemplate(
    "./test/stubs/permalink-conflicts-false/test1.md",
    "./test/stubs/",
    "./test/stubs/_site"
  );
  let tmpl2 = getNewTemplate(
    "./test/stubs/permalink-conflicts-false/test2.md",
    "./test/stubs/",
    "./test/stubs/_site"
  );

  let tm = new TemplateMap();
  await tm.add(tmpl1);
  await tm.add(tmpl2);
  await tm.cache();
  t.true(true);
});

test("Duplicate permalinks in template map, no leading slash", async (t) => {
  let tmpl1 = getNewTemplate(
    "./test/stubs/permalink-conflicts/test1.md",
    "./test/stubs/",
    "./test/stubs/_site"
  );
  let tmpl3 = getNewTemplate(
    "./test/stubs/permalink-conflicts/test3.md",
    "./test/stubs/",
    "./test/stubs/_site"
  );

  let tm = new TemplateMap();
  await tm.add(tmpl1);
  await tm.add(tmpl3);

  await t.throwsAsync(async () => {
    await tm.cache();
  });
});

test("TemplateMap circular references (map.templateContent) using eleventyExcludeFromCollections and collections.all", async (t) => {
  let tm = new TemplateMap();
  await tm.add(
    getNewTemplate(
      "./test/stubs/issue-522/excluded.md",
      "./test/stubs/",
      "./test/stubs/_site"
    )
  );

  await tm.add(
    getNewTemplate(
      "./test/stubs/issue-522/template.md",
      "./test/stubs/",
      "./test/stubs/_site"
    )
  );

  let map = tm.getMap();
  t.falsy(map[0].data.collections);

  t.deepEqual(tm.getMappedDependencies(), [
    "./test/stubs/issue-522/template.md",
    "___TAG___all",
    "./test/stubs/issue-522/excluded.md",
  ]);

  await tm.cache();
  t.is(tm.getMap().length, 2);

  let collections = await tm._testGetCollectionsData();
  t.is(collections.all.length, 1);
});
