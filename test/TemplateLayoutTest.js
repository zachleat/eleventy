import test from "ava";
import TemplateLayout from "../src/TemplateLayout";

test("Creation", t => {
  t.is(
    new TemplateLayout("base", "./test/stubs").getInputPath(),
    "./test/stubs/_includes/base.njk"
  );

  t.throws(() => {
    new TemplateLayout("doesnotexist", "./test/stubs").getInputPath();
  });
});

test("Get Front Matter Data", async t => {
  let tl = new TemplateLayout("layouts/layout-inherit-a.njk", "./test/stubs");
  t.is(
    tl.getInputPath(),
    "./test/stubs/_includes/layouts/layout-inherit-a.njk"
  );

  t.deepEqual(await tl.getData(), {
    inherits: "a",
    secondinherits: "b",
    thirdinherits: "c"
  });
  t.deepEqual(await tl.getData(), {
    inherits: "a",
    secondinherits: "b",
    thirdinherits: "c"
  });
});

test("Augment data with layoutContent", async t => {
  t.deepEqual(TemplateLayout.augmentDataWithContent(null, null), {
    content: null,
    layoutContent: null,
    _layoutContent: null
  });

  t.deepEqual(TemplateLayout.augmentDataWithContent(null, "Test"), {
    content: "Test",
    layoutContent: "Test",
    _layoutContent: "Test"
  });

  t.deepEqual(TemplateLayout.augmentDataWithContent({}, "Test 2"), {
    content: "Test 2",
    layoutContent: "Test 2",
    _layoutContent: "Test 2"
  });

  t.deepEqual(
    TemplateLayout.augmentDataWithContent({ content: "Abc" }, "Test 3"),
    {
      content: "Test 3",
      layoutContent: "Test 3",
      _layoutContent: "Test 3"
    }
  );
});

test("Render Layout", async t => {
  let tl = new TemplateLayout("layouts/layout-inherit-a.njk", "./test/stubs");
  t.is(
    (await tl.render({
      inherits: "a",
      secondinherits: "b",
      thirdinherits: "c"
    })).trim(),
    "a b a c"
  );
});

test("Render Layout (Pass in template content)", async t => {
  let tl = new TemplateLayout("layouts/layout-inherit-a.njk", "./test/stubs");
  t.is(
    (await tl.render(
      { inherits: "a", secondinherits: "b", thirdinherits: "c" },
      "TEMPLATE_CONTENT"
    )).trim(),
    "TEMPLATE_CONTENT a b a c"
  );
});

test("Render Layout (Pass in undefined template content)", async t => {
  let tl = new TemplateLayout("layouts/layout-contentdump.njk", "./test/stubs");
  t.is(
    await tl.render(
      { inherits: "a", secondinherits: "b", thirdinherits: "c" },
      undefined
    ),
    "this is bad a b a c"
  );
});

test("Render Layout (Pass in null template content)", async t => {
  let tl = new TemplateLayout("layouts/layout-contentdump.njk", "./test/stubs");
  t.is(
    await tl.render(
      { inherits: "a", secondinherits: "b", thirdinherits: "c" },
      null
    ),
    " a b a c"
  );
});

test("Render Layout (Pass in empty template content)", async t => {
  let tl = new TemplateLayout("layouts/layout-contentdump.njk", "./test/stubs");
  t.is(
    await tl.render(
      { inherits: "a", secondinherits: "b", thirdinherits: "c" },
      ""
    ),
    " a b a c"
  );
});

test("Cache Duplicates (use full key for cache)", async t => {
  // if two different layouts used the same filename but had different inputdirs, make sure templatelayout cache is unique
  let tla = new TemplateLayout(
    "layout.njk",
    "./test/stubs/templateLayoutCacheDuplicates"
  );
  t.is((await tla.render({})).trim(), "Hello A");

  let tlb = new TemplateLayout(
    "layout.njk",
    "./test/stubs/templateLayoutCacheDuplicates-b"
  );
  t.is((await tlb.render({})).trim(), "Hello B");

  t.is((await tla.render({})).trim(), "Hello A");
});
