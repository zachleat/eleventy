const test = require("ava");
const multimatch = require("multimatch");
const Template = require("../src/Template");
const Collection = require("../src/TemplateCollection");
const Sortable = require("../src/Util/Sortable");
const templateConfig = require("../src/Config");

let tmpl1, tmpl2, tmpl3, tmpl4, tmpl5, tmpl6, tmpl7;
test.before(async () => {
  // This runs concurrently with the above
  await templateConfig.init();

  tmpl1 = new Template(
    "./test/stubs/collection/test1.md",
    "./test/stubs/",
    "./test/stubs/_site",
    null,
    null,
    templateConfig
  );
  tmpl2 = new Template(
    "./test/stubs/collection/test2.md",
    "./test/stubs/",
    "./test/stubs/_site",
    null,
    null,
    templateConfig
  );
  tmpl3 = new Template(
    "./test/stubs/collection/test3.md",
    "./test/stubs/",
    "./test/stubs/_site",
    null,
    null,
    templateConfig
  );
  tmpl4 = new Template(
    "./test/stubs/collection/test4.md",
    "./test/stubs/",
    "./test/stubs/_site",
    null,
    null,
    templateConfig
  );
  tmpl5 = new Template(
    "./test/stubs/collection/test5.md",
    "./test/stubs/",
    "./test/stubs/_site",
    null,
    null,
    templateConfig
  );
  tmpl6 = new Template(
    "./test/stubs/collection/test6.html",
    "./test/stubs/",
    "./test/stubs/_site",
    null,
    null,
    templateConfig
  );
  tmpl7 = new Template(
    "./test/stubs/collection/test7.njk",
    "./test/stubs/",
    "./test/stubs/_site",
    null,
    null,
    templateConfig
  );
});

test("Basic setup", async (t) => {
  let c = new Collection();
  await c._testAddTemplate(tmpl1);
  await c._testAddTemplate(tmpl2);
  await c._testAddTemplate(tmpl3);

  t.is(c.length, 3);
});

test("sortFunctionDateInputPath", async (t) => {
  let c = new Collection();
  await c._testAddTemplate(tmpl1);
  await c._testAddTemplate(tmpl4);
  await c._testAddTemplate(tmpl5);

  let posts = c.sort(Sortable.sortFunctionDateInputPath);
  t.is(posts.length, 3);
  t.deepEqual(posts[0].template, tmpl4);
  t.deepEqual(posts[1].template, tmpl1);
  t.deepEqual(posts[2].template, tmpl5);
});

test("getFilteredByTag", async (t) => {
  let c = new Collection();
  await c._testAddTemplate(tmpl1);
  await c._testAddTemplate(tmpl2);
  await c._testAddTemplate(tmpl3);

  let posts = c.getFilteredByTag("post");
  t.is(posts.length, 2);
  t.deepEqual(posts[0].template, tmpl1);
  t.deepEqual(posts[1].template, tmpl3);

  let cats = c.getFilteredByTag("cat");
  t.is(cats.length, 2);
  t.deepEqual(cats[0].template, tmpl2);
  t.deepEqual(cats[1].template, tmpl3);

  let dogs = c.getFilteredByTag("dog");
  t.is(dogs.length, 1);
  t.deepEqual(dogs[0].template, tmpl1);
});

test("getFilteredByTag (added out of order, sorted)", async (t) => {
  let c = new Collection();
  await c._testAddTemplate(tmpl3);
  await c._testAddTemplate(tmpl2);
  await c._testAddTemplate(tmpl1);

  let posts = c.getFilteredByTag("post");
  t.is(posts.length, 2);
  t.deepEqual(posts[0].template, tmpl1);
  t.deepEqual(posts[1].template, tmpl3);

  let cats = c.getFilteredByTag("cat");
  t.truthy(cats.length);
  t.is(cats.length, 2);
  t.deepEqual(cats[0].template, tmpl2);
  t.deepEqual(cats[1].template, tmpl3);

  let dogs = c.getFilteredByTag("dog");
  t.truthy(dogs.length);
  t.deepEqual(dogs[0].template, tmpl1);
});

test("getFilteredByTags", async (t) => {
  let c = new Collection();
  await c._testAddTemplate(tmpl1);
  await c._testAddTemplate(tmpl2);
  await c._testAddTemplate(tmpl3);

  let postsAndCats = c.getFilteredByTags("post", "cat");
  t.is(postsAndCats.length, 1);
  t.deepEqual(postsAndCats[0].template, tmpl3);

  let cats = c.getFilteredByTags("cat");
  t.is(cats.length, 2);
  t.deepEqual(cats[0].template, tmpl2);
  t.deepEqual(cats[1].template, tmpl3);

  let dogs = c.getFilteredByTags("dog");
  t.is(dogs.length, 1);
  t.deepEqual(dogs[0].template, tmpl1);
});

test("getFilteredByTags (added out of order, sorted)", async (t) => {
  let c = new Collection();
  await c._testAddTemplate(tmpl3);
  await c._testAddTemplate(tmpl2);
  await c._testAddTemplate(tmpl1);

  let postsAndCats = c.getFilteredByTags("post", "cat");
  t.truthy(postsAndCats.length);
  t.is(postsAndCats.length, 1);
  t.deepEqual(postsAndCats[0].template, tmpl3);

  let cats = c.getFilteredByTags("cat");
  t.truthy(cats.length);
  t.is(cats.length, 2);
  t.deepEqual(cats[0].template, tmpl2);
  t.deepEqual(cats[1].template, tmpl3);

  let dogs = c.getFilteredByTags("dog");
  t.truthy(dogs.length);
  t.is(dogs.length, 1);
  t.deepEqual(dogs[0].template, tmpl1);
});

test("getFilteredByGlob", async (t) => {
  let c = new Collection();
  await c._testAddTemplate(tmpl1);
  await c._testAddTemplate(tmpl6);
  await c._testAddTemplate(tmpl7);

  let markdowns = c.getFilteredByGlob("./**/*.md");
  t.is(markdowns.length, 1);
  t.deepEqual(markdowns[0].template, tmpl1);
});

test("getFilteredByGlob no dash dot", async (t) => {
  let c = new Collection();
  await c._testAddTemplate(tmpl1);
  await c._testAddTemplate(tmpl6);
  await c._testAddTemplate(tmpl7);

  let markdowns = c.getFilteredByGlob("**/*.md");
  t.is(markdowns.length, 1);
  t.deepEqual(markdowns[0].template, tmpl1);

  let htmls = c.getFilteredByGlob("**/*.{html,njk}");
  t.is(htmls.length, 2);
  t.deepEqual(htmls[0].template, tmpl6);
  t.deepEqual(htmls[1].template, tmpl7);
});

test("partial match on tag string, issue 95", async (t) => {
  let cat = new Template(
    "./test/stubs/issue-95/cat.md",
    "./test/stubs/",
    "./test/stubs/_site",
    null,
    null,
    templateConfig
  );
  let notacat = new Template(
    "./test/stubs/issue-95/notacat.md",
    "./test/stubs/",
    "./test/stubs/_site",
    null,
    null,
    templateConfig
  );

  let c = new Collection();
  await c._testAddTemplate(cat);
  await c._testAddTemplate(notacat);

  let posts = c.getFilteredByTag("cat");
  t.is(posts.length, 1);
});

test("multimatch assumptions, issue #127", async (t) => {
  t.deepEqual(
    multimatch(
      ["src/bookmarks/test.md"],
      "**/+(bookmarks|posts|screencasts)/**/!(index)*.md"
    ),
    ["src/bookmarks/test.md"]
  );
  t.deepEqual(
    multimatch(
      ["./src/bookmarks/test.md"],
      "./**/+(bookmarks|posts|screencasts)/**/!(index)*.md"
    ),
    ["./src/bookmarks/test.md"]
  );

  let c = new Collection();
  let globs = c.getGlobs("**/+(bookmarks|posts|screencasts)/**/!(index)*.md");
  t.deepEqual(globs, ["./**/+(bookmarks|posts|screencasts)/**/!(index)*.md"]);

  t.deepEqual(multimatch(["./src/bookmarks/test.md"], globs), [
    "./src/bookmarks/test.md",
  ]);
  t.deepEqual(multimatch(["./src/bookmarks/index.md"], globs), []);
  t.deepEqual(multimatch(["./src/bookmarks/index2.md"], globs), []);
  t.deepEqual(
    multimatch(["./src/_content/bookmarks/2018-03-27-git-message.md"], globs),
    ["./src/_content/bookmarks/2018-03-27-git-message.md"]
  );
});

test("Sort in place (issue #352)", async (t) => {
  let c = new Collection();
  await c._testAddTemplate(tmpl1);
  await c._testAddTemplate(tmpl4);
  await c._testAddTemplate(tmpl5);

  let posts = c.getAllSorted();
  t.is(posts.length, 3);
  t.deepEqual(posts[0].template, tmpl4);
  t.deepEqual(posts[1].template, tmpl1);
  t.deepEqual(posts[2].template, tmpl5);

  let posts2 = c.getAllSorted().reverse();
  t.is(posts2.length, 3);
  t.deepEqual(posts2[0].template, tmpl5);
  t.deepEqual(posts2[1].template, tmpl1);
  t.deepEqual(posts2[2].template, tmpl4);

  let posts3 = c.getAllSorted().reverse();
  t.is(posts3.length, 3);
  t.deepEqual(posts3[0].template, tmpl5);
  t.deepEqual(posts3[1].template, tmpl1);
  t.deepEqual(posts3[2].template, tmpl4);
});
