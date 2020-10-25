const test = require("ava");
const TemplateLayout = require("../src/TemplateLayout");
const EleventyExtensionMap = require("../src/EleventyExtensionMap");
const templateConfig = require("../src/Config");

test.before(async () => {
  // This runs concurrently with the above
  await templateConfig.init();
});

function getTemplateLayoutInstance(key, inputDir, map) {
  if (!map) {
    map = new EleventyExtensionMap(
      [
        "liquid",
        "ejs",
        "md",
        "hbs",
        "mustache",
        "haml",
        "pug",
        "njk",
        "html",
        "11ty.js",
      ],
      templateConfig
    );
  }
  let layout = new TemplateLayout(key, inputDir, map, templateConfig);
  return layout;
}

test("Creation", (t) => {
  t.is(
    getTemplateLayoutInstance("base", "./test/stubs").getInputPath(),
    "./test/stubs/_includes/base.njk"
  );

  t.throws(() => {
    getTemplateLayoutInstance("doesnotexist", "./test/stubs").getInputPath();
  });
});

test("Get Layout Chain", async (t) => {
  let tl = getTemplateLayoutInstance(
    "layouts/layout-inherit-a.njk",
    "./test/stubs"
  );

  t.deepEqual(await tl.getLayoutChain(), [
    "./test/stubs/_includes/layouts/layout-inherit-a.njk",
    "./test/stubs/_includes/layouts/layout-inherit-b.njk",
    "./test/stubs/_includes/layouts/layout-inherit-c.njk",
  ]);
});

test("Get Front Matter Data", async (t) => {
  let tl = getTemplateLayoutInstance(
    "layouts/layout-inherit-a.njk",
    "./test/stubs"
  );
  t.is(
    tl.getInputPath(),
    "./test/stubs/_includes/layouts/layout-inherit-a.njk"
  );

  let data = await tl.getData();

  t.deepEqual(data, {
    inherits: "a",
    secondinherits: "b",
    thirdinherits: "c",
  });
  t.deepEqual(await tl.getLayoutChain(), [
    "./test/stubs/_includes/layouts/layout-inherit-a.njk",
    "./test/stubs/_includes/layouts/layout-inherit-b.njk",
    "./test/stubs/_includes/layouts/layout-inherit-c.njk",
  ]);

  t.deepEqual(await tl.getData(), {
    inherits: "a",
    secondinherits: "b",
    thirdinherits: "c",
  });
});

test("Augment data with layoutContent", async (t) => {
  t.deepEqual(TemplateLayout.augmentDataWithContent(null, null), {
    content: null,
    layoutContent: null,
    _layoutContent: null,
  });

  t.deepEqual(TemplateLayout.augmentDataWithContent(null, "Test"), {
    content: "Test",
    layoutContent: "Test",
    _layoutContent: "Test",
  });

  t.deepEqual(TemplateLayout.augmentDataWithContent({}, "Test 2"), {
    content: "Test 2",
    layoutContent: "Test 2",
    _layoutContent: "Test 2",
  });

  t.deepEqual(
    TemplateLayout.augmentDataWithContent({ content: "Abc" }, "Test 3"),
    {
      content: "Test 3",
      layoutContent: "Test 3",
      _layoutContent: "Test 3",
    }
  );
});

test("Render Layout", async (t) => {
  let tl = getTemplateLayoutInstance(
    "layouts/layout-inherit-a.njk",
    "./test/stubs"
  );
  t.is(
    (
      await tl.render({
        inherits: "a",
        secondinherits: "b",
        thirdinherits: "c",
      })
    ).trim(),
    "a b a c"
  );
});

test("Render Layout (Pass in template content)", async (t) => {
  let tl = getTemplateLayoutInstance(
    "layouts/layout-inherit-a.njk",
    "./test/stubs"
  );
  t.is(
    (
      await tl.render(
        { inherits: "a", secondinherits: "b", thirdinherits: "c" },
        "TEMPLATE_CONTENT"
      )
    ).trim(),
    "TEMPLATE_CONTENT a b a c"
  );
});

test("Render Layout (Pass in undefined template content)", async (t) => {
  let tl = getTemplateLayoutInstance(
    "layouts/layout-contentdump.njk",
    "./test/stubs"
  );
  t.is(
    await tl.render(
      { inherits: "a", secondinherits: "b", thirdinherits: "c" },
      undefined
    ),
    "this is bad a b a c"
  );
});

test("Render Layout (Pass in null template content)", async (t) => {
  let tl = getTemplateLayoutInstance(
    "layouts/layout-contentdump.njk",
    "./test/stubs"
  );
  t.is(
    await tl.render(
      { inherits: "a", secondinherits: "b", thirdinherits: "c" },
      null
    ),
    " a b a c"
  );
});

test("Render Layout (Pass in empty template content)", async (t) => {
  let tl = getTemplateLayoutInstance(
    "layouts/layout-contentdump.njk",
    "./test/stubs"
  );
  t.is(
    await tl.render(
      { inherits: "a", secondinherits: "b", thirdinherits: "c" },
      ""
    ),
    " a b a c"
  );
});

test("Cache Duplicates (use full key for cache)", async (t) => {
  // if two different layouts used the same filename but had different inputdirs, make sure templatelayout cache is unique
  let tla = getTemplateLayoutInstance(
    "layout.njk",
    "./test/stubs/templateLayoutCacheDuplicates"
  );
  t.is((await tla.render({})).trim(), "Hello A");

  let tlb = getTemplateLayoutInstance(
    "layout.njk",
    "./test/stubs/templateLayoutCacheDuplicates-b"
  );
  t.is((await tlb.render({})).trim(), "Hello B");

  t.is((await tla.render({})).trim(), "Hello A");
});
