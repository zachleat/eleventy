const test = require("ava");
const Template = require("../src/Template");
const semver = require("semver");
const templateConfig = require("../src/Config");

test.before(async () => {
  // This runs concurrently with the above
  await templateConfig.init();
});

const getNewTemplate = (...args) => {
  // monkey patching to add templateConfig to the end of every call
  args = args.concat(Array(5).fill(null)).slice(0, 5).concat(templateConfig);
  return new Template(...args);
};

test("JavaScript template type (function)", async (t) => {
  let tmpl = getNewTemplate(
    "./test/stubs/function.11ty.js",
    "./test/stubs/",
    "./dist"
  );

  t.is(await tmpl.getOutputPath(), "./dist/function/index.html");
  let data = await tmpl.getData();
  data.name = "Zach";

  let pages = await tmpl.getRenderedTemplates(data);
  t.is(pages[0].templateContent.trim(), "<p>Zach</p>");
});

test("JavaScript template type (class with data getter)", async (t) => {
  let tmpl = getNewTemplate(
    "./test/stubs/class-data.11ty.js",
    "./test/stubs/",
    "./dist"
  );

  t.is(await tmpl.getOutputPath(), "./dist/class-data/index.html");
  let data = await tmpl.getData();

  let pages = await tmpl.getRenderedTemplates(data);
  t.is(pages[0].templateContent.trim(), "<p>Ted</p>");
});

test("JavaScript template type (class with data method)", async (t) => {
  let tmpl = getNewTemplate(
    "./test/stubs/class-data-fn.11ty.js",
    "./test/stubs/",
    "./dist"
  );

  t.is(await tmpl.getOutputPath(), "./dist/class-data-fn/index.html");
  let data = await tmpl.getData();

  let pages = await tmpl.getRenderedTemplates(data);
  t.is(pages[0].templateContent.trim(), "<p>Ted</p>");
});

if (semver.gte(process.version, "12.4.0")) {
  test("JavaScript template type (class fields)", async (t) => {
    let tmpl = getNewTemplate(
      "./test/stubs/classfields-data.11ty.js",
      "./test/stubs/",
      "./dist"
    );

    t.is(await tmpl.getOutputPath(), "./dist/classfields-data/index.html");
    let data = await tmpl.getData();

    let pages = await tmpl.getRenderedTemplates(data);
    t.is(pages[0].templateContent.trim(), "<p>Ted</p>");
  });
}

test("JavaScript template type (class with shorthand data method)", async (t) => {
  let tmpl = getNewTemplate(
    "./test/stubs/class-data-fn-shorthand.11ty.js",
    "./test/stubs/",
    "./dist"
  );

  t.is(await tmpl.getOutputPath(), "./dist/class-data-fn-shorthand/index.html");
  let data = await tmpl.getData();

  let pages = await tmpl.getRenderedTemplates(data);
  t.is(pages[0].templateContent.trim(), "<p>Ted</p>");
});

test("JavaScript template type (class with async data method)", async (t) => {
  let tmpl = getNewTemplate(
    "./test/stubs/class-async-data-fn.11ty.js",
    "./test/stubs/",
    "./dist"
  );

  t.is(await tmpl.getOutputPath(), "./dist/class-async-data-fn/index.html");
  let data = await tmpl.getData();

  let pages = await tmpl.getRenderedTemplates(data);
  t.is(pages[0].templateContent.trim(), "<p>Ted</p>");
});

test("JavaScript template type (class with data getter and a javascriptFunction)", async (t) => {
  let tmpl = getNewTemplate(
    "./test/stubs/class-data-filter.11ty.js",
    "./test/stubs/",
    "./dist"
  );
  tmpl.templateRender.config = {
    javascriptFunctions: {
      upper: function (val) {
        return new String(val).toUpperCase();
      },
    },
  };

  t.is(await tmpl.getOutputPath(), "./dist/class-data-filter/index.html");
  let data = await tmpl.getData();
  let pages = await tmpl.getRenderedTemplates(data);
  t.is(pages[0].templateContent.trim(), "<p>TED</p>");
});

test("JavaScript template type (class with data method and a javascriptFunction)", async (t) => {
  let tmpl = getNewTemplate(
    "./test/stubs/class-data-fn-filter.11ty.js",
    "./test/stubs/",
    "./dist"
  );
  tmpl.templateRender.config = {
    javascriptFunctions: {
      upper: function (val) {
        return new String(val).toUpperCase();
      },
    },
  };

  t.is(await tmpl.getOutputPath(), "./dist/class-data-fn-filter/index.html");
  let data = await tmpl.getData();
  let pages = await tmpl.getRenderedTemplates(data);
  t.is(pages[0].templateContent.trim(), "<p>TED</p>");
});

test("JavaScript template type (class with data permalink)", async (t) => {
  let tmpl = getNewTemplate(
    "./test/stubs/class-data-permalink.11ty.js",
    "./test/stubs/",
    "./dist"
  );

  t.is(await tmpl.getOutputPath(), "./dist/my-permalink/index.html");
});

test("JavaScript template type (class with data permalink using a buffer)", async (t) => {
  let tmpl = getNewTemplate(
    "./test/stubs/class-data-permalink-buffer.11ty.js",
    "./test/stubs/",
    "./dist"
  );

  t.is(await tmpl.getOutputPath(), "./dist/my-permalink/index.html");
});

test("JavaScript template type (class with data permalink function)", async (t) => {
  let tmpl = getNewTemplate(
    "./test/stubs/class-data-permalink-fn.11ty.js",
    "./test/stubs/",
    "./dist"
  );

  t.is(await tmpl.getOutputPath(), "./dist/my-permalink/value1/index.html");
});

test("JavaScript template type (class with data permalink function using a buffer)", async (t) => {
  let tmpl = getNewTemplate(
    "./test/stubs/class-data-permalink-fn-buffer.11ty.js",
    "./test/stubs/",
    "./dist"
  );

  t.is(await tmpl.getOutputPath(), "./dist/my-permalink/value1/index.html");
});

test("JavaScript template type (class with data permalink async function)", async (t) => {
  let tmpl = getNewTemplate(
    "./test/stubs/class-data-permalink-async-fn.11ty.js",
    "./test/stubs/",
    "./dist"
  );

  t.is(await tmpl.getOutputPath(), "./dist/my-permalink/value1/index.html");
});

test("JavaScript template type (class with data permalink function using a filter)", async (t) => {
  let tmpl = getNewTemplate(
    "./test/stubs/class-data-permalink-fn-filter.11ty.js",
    "./test/stubs/",
    "./dist"
  );

  t.is(
    await tmpl.getOutputPath(),
    "./dist/my-permalink/my-super-cool-title/index.html"
  );
});

test("JavaScript template type (class with renderData)", async (t) => {
  let tmpl = getNewTemplate(
    "./test/stubs/class-data-renderdata.11ty.js",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let pages = await tmpl.getRenderedTemplates(data);
  t.is(
    pages[0].templateContent.trim(),
    "<p>StringTesthowdy Zach, meet Thanos</p>"
  );
});

test("JavaScript template type (should use the same class instance for data and render)", async (t) => {
  let tmpl = getNewTemplate(
    "./test/stubs/oneinstance.11ty.js",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let pages = await tmpl.getRenderedTemplates(data);
  // the template renders the random number created in the class constructor
  // the data returns the random number created in the class constructor
  // if they are different, the class is not reused.
  t.is(pages[0].templateContent.trim(), `<p>Ted${data.rand}</p>`);
});

test("JavaScript template type (multiple exports)", async (t) => {
  let tmpl = getNewTemplate(
    "./test/stubs/multipleexports.11ty.js",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  let pages = await tmpl.getRenderedTemplates(data);
  t.is(pages[0].templateContent.trim(), "<p>Ted</p>");
});

test("JavaScript template type (multiple exports, promises)", async (t) => {
  let tmpl = getNewTemplate(
    "./test/stubs/multipleexports-promises.11ty.js",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  t.is(data.name, "Ted");

  let pages = await tmpl.getRenderedTemplates(data);
  t.is(pages[0].templateContent.trim(), "<p>Ted</p>");
});

test("JavaScript template type (object)", async (t) => {
  let tmpl = getNewTemplate(
    "./test/stubs/object.11ty.js",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  t.is(data.name, "Ted");

  let pages = await tmpl.getRenderedTemplates(data);
  t.is(pages[0].templateContent.trim(), "<p>Ted</p>");
});

test("JavaScript template type (object, no render method)", async (t) => {
  let tmpl = getNewTemplate(
    "./test/stubs/object-norender.11ty.js",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  t.is(data.name, "Ted");

  let pages = await tmpl.getRenderedTemplates(data);
  t.is(pages[0].templateContent.trim(), "");
});

test("JavaScript template type (class, no render method)", async (t) => {
  let tmpl = getNewTemplate(
    "./test/stubs/class-norender.11ty.js",
    "./test/stubs/",
    "./dist"
  );

  let data = await tmpl.getData();
  t.is(data.name, "Ted");

  let pages = await tmpl.getRenderedTemplates(data);
  t.is(pages[0].templateContent.trim(), "");
});
test("JavaScript template type (data returns a string)", async (t) => {
  let tmpl = getNewTemplate(
    "./test/stubs/exports-flatdata.11ty.js",
    "./test/stubs/",
    "./dist"
  );

  await t.throwsAsync(async () => {
    await tmpl.getData();
  });
});
