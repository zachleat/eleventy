const test = require("ava");
const TemplateRender = require("../src/TemplateRender");
const EleventyExtensionMap = require("../src/EleventyExtensionMap");
const templateConfig = require("../src/Config");

test.before(async () => {
  // This runs concurrently with the above
  await templateConfig.init();
});

function getNewTemplateRender(name, inputDir) {
  let tr = new TemplateRender(name, inputDir, templateConfig);
  tr.extensionMap = new EleventyExtensionMap([], templateConfig);
  return tr;
}

test("JS", (t) => {
  t.is(getNewTemplateRender("11ty.js").getEngineName(), "11ty.js");
  t.is(
    getNewTemplateRender("./test/stubs/filename.11ty.js").getEngineName(),
    "11ty.js"
  );
  t.is(
    new TemplateRender("11ty.cjs", null, templateConfig).getEngineName(),
    "11ty.js"
  );
  t.is(
    new TemplateRender(
      "./test/stubs/filename.11ty.cjs",
      null,
      templateConfig
    ).getEngineName(),
    "11ty.js"
  );
});

test("JS Render a string (no data)", async (t) => {
  let fn = await getNewTemplateRender(
    "./test/stubs/string.11ty.js"
  ).getCompiledTemplate();
  t.is(await fn({ name: "Bill" }), "<p>Zach</p>");
});

test("JS Render a promise (no data)", async (t) => {
  let fn = await getNewTemplateRender(
    "./test/stubs/promise.11ty.js"
  ).getCompiledTemplate();
  t.is(await fn({ name: "Bill" }), "<p>Zach</p>");
});

test("JS Render a buffer (no data)", async (t) => {
  let fn = await getNewTemplateRender(
    "./test/stubs/buffer.11ty.js"
  ).getCompiledTemplate();
  t.is(await fn({ name: "Bill" }), "<p>tést</p>");
});

test("JS Render a function", async (t) => {
  let fn = await getNewTemplateRender(
    "./test/stubs/function.11ty.js"
  ).getCompiledTemplate();
  t.is(await fn({ name: "Zach" }), "<p>Zach</p>");
  t.is(await fn({ name: "Bill" }), "<p>Bill</p>");
});

test("JS Render a function (arrow syntax)", async (t) => {
  let fn = await getNewTemplateRender(
    "./test/stubs/function-arrow.11ty.js"
  ).getCompiledTemplate();
  t.is(await fn({ name: "Zach" }), "<p>Zach</p>");
  t.is(await fn({ name: "Bill" }), "<p>Bill</p>");
});

test("JS Render a function, returns a Buffer", async (t) => {
  let fn = await getNewTemplateRender(
    "./test/stubs/function-buffer.11ty.js"
  ).getCompiledTemplate();
  t.is(await fn({ name: "tést" }), "<p>tést</p>");
  t.is(await fn({ name: "Zach" }), "<p>Zach</p>");
  t.is(await fn({ name: "Bill" }), "<p>Bill</p>");
});

test("JS Render a function (Markdown)", async (t) => {
  let tr = getNewTemplateRender("./test/stubs/function-markdown.11ty.js");
  tr.setEngineOverride("11ty.js,md");
  let fn = await tr.getCompiledTemplate();
  t.is((await fn({ name: "Zach" })).trim(), "<h1>Zach</h1>");
  t.is((await fn({ name: "Bill" })).trim(), "<h1>Bill</h1>");
});

test("JS Render a function (Collections)", async (t) => {
  let tr = getNewTemplateRender("./test/stubs/use-collection.11ty.js");
  let fn = await tr.getCompiledTemplate();
  t.is(
    (
      await fn({
        collections: {
          post: [
            {
              data: {
                title: "Testing",
              },
            },
            {
              data: {
                title: "Testing2",
              },
            },
          ],
        },
      })
    ).trim(),
    `<ul><li>Testing</li><li>Testing2</li></ul>`
  );
});

test("JS Render an async function", async (t) => {
  let fn = await getNewTemplateRender(
    "./test/stubs/function-async.11ty.js"
  ).getCompiledTemplate();
  t.is(await fn({ name: "Zach" }), "<p>Zach</p>");
  t.is(await fn({ name: "Bill" }), "<p>Bill</p>");
});

test("JS Render with a Class", async (t) => {
  let fn = await getNewTemplateRender(
    "./test/stubs/class.11ty.js"
  ).getCompiledTemplate();
  t.is(await fn({ name: "Zach" }), "<p>ZachBillTed</p>");
  t.is(await fn({ name: "Bill" }), "<p>BillBillTed</p>");
});

test("JS Render with a Class, returns a buffer", async (t) => {
  let fn = await getNewTemplateRender(
    "./test/stubs/class-buffer.11ty.js"
  ).getCompiledTemplate();
  t.is(await fn({ name: "Zách" }), "<p>ZáchBillTed</p>");
  t.is(await fn({ name: "Zach" }), "<p>ZachBillTed</p>");
  t.is(await fn({ name: "Bill" }), "<p>BillBillTed</p>");
});

test("JS Render with a Class, async render", async (t) => {
  let fn = await getNewTemplateRender(
    "./test/stubs/class-async.11ty.js"
  ).getCompiledTemplate();
  t.is(await fn({ name: "Zach" }), "<p>Zach</p>");
  t.is(await fn({ name: "Bill" }), "<p>Bill</p>");
});

test("JS Render using Vue", async (t) => {
  let fn = await getNewTemplateRender(
    "./test/stubs/vue.11ty.js"
  ).getCompiledTemplate();
  t.is(
    await fn({ name: "Zach" }),
    '<p data-server-rendered="true">Hello Zach, this is a Vue template.</p>'
  );
  t.is(
    await fn({ name: "Bill" }),
    '<p data-server-rendered="true">Hello Bill, this is a Vue template.</p>'
  );
});

test("JS Render using Vue (with a layout)", async (t) => {
  let fn = await getNewTemplateRender(
    "./test/stubs/vue-layout.11ty.js"
  ).getCompiledTemplate();
  t.is(
    await fn({ name: "Zach" }),
    `<!doctype html>
<title>Test</title>
<p data-server-rendered="true">Hello Zach, this is a Vue template.</p>`
  );
});

test("JS Render using ViperHTML", async (t) => {
  let fn = await getNewTemplateRender(
    "./test/stubs/viperhtml.11ty.js"
  ).getCompiledTemplate();
  t.is(
    await fn({ name: "Zach", html: "<strong>Hi</strong>" }),
    `<div>
  This is a viper template, Zach
  <strong>Hi</strong>
</div>`
  );
});

test("JS Render with a function", async (t) => {
  t.plan(8);

  let tr = getNewTemplateRender("./test/stubs/function-filter.11ty.js");
  tr.config = {
    javascriptFunctions: {
      upper: function (val) {
        t.is(this.page.url, "/hi/");
        // sanity check to make sure data didn’t propagate
        t.not(this.name, "Zach");
        t.not(this.name, "Bill");
        return new String(val).toUpperCase();
      },
    },
  };

  let fn = await tr.getCompiledTemplate();
  t.is(await fn({ name: "Zach", page: { url: "/hi/" } }), "<p>ZACHT9000</p>");
  t.is(await fn({ name: "Bill", page: { url: "/hi/" } }), "<p>BILLT9000</p>");
});

// This doesn’t work, per arrow functions
test.skip("Issue #934: JS Render with an arrow function and javascript function", async (t) => {
  let tr = new TemplateRender("./test/stubs/function-filter-arrow.11ty.js");
  tr.config = {
    javascriptFunctions: {
      upper: function (val) {
        return new String(val).toUpperCase();
      },
    },
  };

  let fn = await tr.getCompiledTemplate();
  t.is(await fn({ name: "Zach" }), "<p>ZACH</p>");
  t.is(await fn({ name: "Bill" }), "<p>BILL</p>");
});

test("JS Render with a function and async filter", async (t) => {
  t.plan(4);

  let tr = new TemplateRender(
    "./test/stubs/function-async-filter.11ty.js",
    null,
    templateConfig
  );
  tr.config = {
    javascriptFunctions: {
      upper: function (val) {
        return new Promise((resolve) => {
          t.is(this.page.url, "/hi/");
          resolve(new String(val).toUpperCase());
        });
      },
    },
  };

  let fn = await tr.getCompiledTemplate();
  t.is(await fn({ name: "Zach", page: { url: "/hi/" } }), "<p>ZACH</p>");
  t.is(await fn({ name: "Bill", page: { url: "/hi/" } }), "<p>BILL</p>");
});

test("JS Render with a function prototype", async (t) => {
  t.plan(4);
  let tr = getNewTemplateRender("./test/stubs/function-prototype.11ty.js");
  tr.config = {
    javascriptFunctions: {
      upper: function (val) {
        t.is(this.page.url, "/hi/");
        return new String(val).toUpperCase();
      },
    },
  };

  let fn = await tr.getCompiledTemplate();
  t.is(
    await fn({ name: "Zach", page: { url: "/hi/" } }),
    "<p>ZACHBillT9001</p>"
  );
  t.is(
    await fn({ name: "Bill", page: { url: "/hi/" } }),
    "<p>BILLBillT9001</p>"
  );
});

test("JS Class Render with a function", async (t) => {
  t.plan(4);

  let tr = getNewTemplateRender("./test/stubs/class-filter.11ty.js");
  tr.config = {
    javascriptFunctions: {
      upper: function (val) {
        t.is(this.page.url, "/hi/");
        return new String(val).toUpperCase();
      },
    },
  };

  let fn = await tr.getCompiledTemplate();
  t.is(await fn({ name: "Zach", page: { url: "/hi/" } }), "<p>ZACHBillTed</p>");
  t.is(await fn({ name: "Bill", page: { url: "/hi/" } }), "<p>BILLBillTed</p>");
});

test("JS Class Async Render with a function", async (t) => {
  t.plan(4);

  let tr = getNewTemplateRender("./test/stubs/class-async-filter.11ty.js");
  tr.config = {
    javascriptFunctions: {
      upper: function (val) {
        t.is(this.page.url, "/hi/");
        return new String(val).toUpperCase();
      },
    },
  };

  let fn = await tr.getCompiledTemplate();
  // Overrides all names to Ted
  t.is(await fn({ name: "Zach", page: { url: "/hi/" } }), "<p>ZACHBillTed</p>");
  t.is(await fn({ name: "Bill", page: { url: "/hi/" } }), "<p>BILLBillTed</p>");
});

test("JS Class Async Render with a function (sync function, throws error)", async (t) => {
  let tr = new TemplateRender(
    "./test/stubs/function-throws.11ty.js",
    null,
    templateConfig
  );
  tr.config = {
    javascriptFunctions: {
      upper: function (val) {
        throw new Error(
          "JS Class Async Render with a function (sync function, throws error)"
        );
      },
    },
  };

  let error = await t.throwsAsync(async () => {
    let fn = await tr.getCompiledTemplate();
    await fn({ name: "Zach" });
  });
  t.true(
    error.message.indexOf(
      "JS Class Async Render with a function (sync function, throws error)"
    ) > -1
  );
});

test("JS Class Async Render with a function (async function, throws error)", async (t) => {
  let tr = new TemplateRender(
    "./test/stubs/function-throws-async.11ty.js",
    null,
    templateConfig
  );
  tr.config = {
    javascriptFunctions: {
      upper: async function (val) {
        throw new Error(
          "JS Class Async Render with a function (async function, throws error)"
        );
      },
    },
  };

  let error = await t.throwsAsync(async () => {
    let fn = await tr.getCompiledTemplate();
    await fn({ name: "Zach" });
  });
  t.true(
    error.message.indexOf(
      "JS Class Async Render with a function (async function, throws error)"
    ) > -1
  );
});

test("JS function has access to built in filters", async (t) => {
  t.plan(6);
  let tr = getNewTemplateRender("./test/stubs/function-fns.11ty.js");

  let fn = await tr.getCompiledTemplate();
  await fn({ avaTest: t, page: { url: "/hi/" } });
});

test("Class has access to built in filters", async (t) => {
  t.plan(6);
  let tr = getNewTemplateRender("./test/stubs/class-fns.11ty.js");

  let fn = await tr.getCompiledTemplate();
  await fn({ avaTest: t, page: { url: "/hi/" } });
});

test("Class has page property already and keeps it", async (t) => {
  t.plan(2);
  let tr = getNewTemplateRender("./test/stubs/class-fns-has-page.11ty.js");

  let fn = await tr.getCompiledTemplate();
  await fn({ avaTest: t, page: { url: "/hi/" } });
});
