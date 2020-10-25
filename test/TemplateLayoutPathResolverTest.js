const test = require("ava");
const TemplateLayoutPathResolver = require("../src/TemplateLayoutPathResolver");
const EleventyExtensionMap = require("../src/EleventyExtensionMap");
const templateConfig = require("../src/Config");

test.before(async () => {
  // This runs concurrently with the above
  await templateConfig.init();
});

function getResolverInstance(path, inputDir, map) {
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
  return new TemplateLayoutPathResolver(path, inputDir, map, templateConfig);
}

test("Layout", (t) => {
  let res = getResolverInstance("default", "./test/stubs");
  t.is(res.getFileName(), "default.ejs");
});

test("Layout already has extension", (t) => {
  let res = getResolverInstance("default.ejs", "./test/stubs");
  t.is(res.getFileName(), "default.ejs");
});

test("Layout (uses empty string includes folder)", (t) => {
  let res = getResolverInstance("includesemptystring", "./test/stubs");
  res.config = {
    templateFormats: ["ejs"],
    dir: {
      includes: "",
    },
  };

  t.is(res.getFileName(), "includesemptystring.ejs");
});

test("Layout (uses empty string includes folder) already has extension", (t) => {
  let res = getResolverInstance("includesemptystring.ejs", "./test/stubs");
  res.config = {
    templateFormats: ["ejs"],
    dir: {
      includes: "",
    },
  };

  t.is(res.getFileName(), "includesemptystring.ejs");
});

test("Layout (uses layouts folder)", (t) => {
  let res = getResolverInstance("layoutsdefault", "./test/stubs");
  res.config = {
    templateFormats: ["ejs"],
    dir: {
      layouts: "_layouts",
      includes: "_includes",
    },
  };

  t.is(res.getFileName(), "layoutsdefault.ejs");
});

test("Layout (uses layouts folder) already has extension", (t) => {
  let res = getResolverInstance("layoutsdefault.ejs", "./test/stubs");
  res.config = {
    templateFormats: ["ejs"],
    dir: {
      layouts: "_layouts",
      includes: "_includes",
    },
  };

  t.is(res.getFileName(), "layoutsdefault.ejs");
});

test("Layout (uses empty string layouts folder)", (t) => {
  let res = getResolverInstance("layoutsemptystring", "./test/stubs");
  res.config = {
    templateFormats: ["ejs"],
    dir: {
      layouts: "",
      includes: "_includes",
    },
  };

  t.is(res.getFileName(), "layoutsemptystring.ejs");
});

test("Layout (uses empty string layouts folder) already has extension", (t) => {
  let res = getResolverInstance("layoutsemptystring.ejs", "./test/stubs");
  res.config = {
    templateFormats: ["ejs"],
    dir: {
      layouts: "",
      includes: "_includes",
    },
  };

  t.is(res.getFileName(), "layoutsemptystring.ejs");
});

test("Layout subdir", (t) => {
  let res = getResolverInstance("layouts/inasubdir", "./test/stubs");
  t.is(res.getFileName(), "layouts/inasubdir.njk");
});

test("Layout subdir already has extension", (t) => {
  let res = getResolverInstance("layouts/inasubdir.njk", "./test/stubs");
  t.is(res.getFileName(), "layouts/inasubdir.njk");
});

test("Multiple layouts exist with the same file base, pick one", (t) => {
  let res = getResolverInstance("multiple", "./test/stubs");
  // pick the first one if multiple exist.
  t.is(res.getFileName(), "multiple.ejs");
});

test("Multiple layouts exist but we are being explicit—layout already has extension", (t) => {
  let res = getResolverInstance("multiple.ejs", "./test/stubs");
  t.is(res.getFileName(), "multiple.ejs");

  let res2 = getResolverInstance("multiple.md", "./test/stubs");
  t.is(res2.getFileName(), "multiple.md");
});

test("Layout is aliased to a new location", (t) => {
  let tl = getResolverInstance("post", "./test/stubs");
  tl.addLayoutAlias("post", "layouts/post.ejs");
  tl.init();

  t.is(tl.getFileName(), "layouts/post.ejs");
});

test("Global default with empty string alias", (t) => {
  let tl = getResolverInstance("", "./test/stubs");
  tl.addLayoutAlias("", "layouts/post.ejs");
  tl.init();

  t.is(tl.getFileName(), "layouts/post.ejs");
});

test("Global default with empty string alias (but no alias exists for this instance)", (t) => {
  let tl = getResolverInstance("layout.ejs", "./test/stubs");
  tl.addLayoutAlias("", "layouts/post.ejs");
  tl.init();

  t.throws(() => {
    tl.getFileName();
  });
});

test("Layout has no alias and does not exist", async (t) => {
  let tl = getResolverInstance("shouldnotexist", "./test/stubs");
  tl.addLayoutAlias("post", "layouts/post.ejs");
  tl.init();

  t.throws(() => {
    tl.getFileName();
  });

  t.throws(() => {
    tl.getFullPath();
  });
});
