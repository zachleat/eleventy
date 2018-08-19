import test from "ava";
import TemplateLayoutPathResolver from "../src/TemplateLayoutPathResolver";

test("Layout", t => {
  t.is(
    new TemplateLayoutPathResolver("default", "./test/stubs").getFileName(),
    "default.ejs"
  );
});

test("Layout already has extension", t => {
  t.is(
    new TemplateLayoutPathResolver("default.ejs", "./test/stubs").getFileName(),
    "default.ejs"
  );
});

test("Layout subdir", t => {
  t.is(
    new TemplateLayoutPathResolver(
      "layouts/inasubdir",
      "./test/stubs/_includes"
    ).getFileName(),
    "layouts/inasubdir.njk"
  );
});

test("Layout subdir already has extension", t => {
  t.is(
    new TemplateLayoutPathResolver(
      "layouts/inasubdir.njk",
      "./test/stubs/_includes"
    ).getFileName(),
    "layouts/inasubdir.njk"
  );
});

test("Multiple layouts exist with the same file base, pick one", t => {
  // pick the first one if multiple exist.
  t.is(
    new TemplateLayoutPathResolver("multiple", "./test/stubs").getFileName(),
    "multiple.ejs"
  );
});

test("Multiple layouts exist but we are being explicit—layout already has extension", t => {
  t.is(
    new TemplateLayoutPathResolver(
      "multiple.ejs",
      "./test/stubs"
    ).getFileName(),
    "multiple.ejs"
  );
  t.is(
    new TemplateLayoutPathResolver("multiple.md", "./test/stubs").getFileName(),
    "multiple.md"
  );
});

test("Layout is aliased to a new location", t => {
  let tl = new TemplateLayoutPathResolver("post", "./test/stubs/_includes");
  tl.addLayoutAlias("post", "layouts/post.ejs");
  tl.init();

  t.is(tl.getFileName(), "layouts/post.ejs");
});

test("Global default with empty string alias", t => {
  let tl = new TemplateLayoutPathResolver("", "./test/stubs/_includes");
  tl.addLayoutAlias("", "layouts/post.ejs");
  tl.init();

  t.is(tl.getFileName(), "layouts/post.ejs");
});

test("Global default with empty string alias (but no alias exists for this instance)", t => {
  let tl = new TemplateLayoutPathResolver(
    "layout.ejs",
    "./test/stubs/_includes"
  );
  tl.addLayoutAlias("", "layouts/post.ejs");
  tl.init();

  t.throws(() => {
    tl.getFileName();
  });
});

test("Layout has no alias and does not exist", async t => {
  let tl = new TemplateLayoutPathResolver("default", "./test/stubs/_includes");
  tl.addLayoutAlias("post", "layouts/post.ejs");
  tl.init();

  t.throws(() => {
    tl.getFileName();
  });

  t.throws(() => {
    tl.getFullPath();
  });
});
