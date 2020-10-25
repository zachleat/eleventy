const test = require("ava");
const TemplateEngineManager = require("../src/TemplateEngineManager");
const templateConfig = require("../src/Config");

let config = {};

test.before(async () => {
  // This runs concurrently with the above
  await templateConfig.init();
  config = templateConfig.getConfig();
});

test("Unsupported engine", async (t) => {
  t.throws(() => {
    let tem = new TemplateEngineManager(templateConfig);
    tem.getEngine("doesnotexist");
  });
});

test("Supported engine", async (t) => {
  let tem = new TemplateEngineManager(templateConfig);
  t.truthy(tem.hasEngine("ejs"));
});

test("Supported custom engine", async (t) => {
  let tem = new TemplateEngineManager(templateConfig);
  tem.config = Object.assign({}, config);
  tem.config.extensionMap.add({
    extension: "txt",
    key: "txt",
    compile: function (str, inputPath) {
      // plaintext
      return function (data) {
        return str;
      };
    },
  });

  t.truthy(tem.hasEngine("txt"));
  let engine = tem.getEngine("txt");
  let fn = await engine.compile("<p>This is plaintext</p>");
  t.is(await fn({ author: "zach" }), "<p>This is plaintext</p>");
});

test("Custom engine with custom init", async (t) => {
  let initCount = 0;
  let compileCount = 0;
  let tem = new TemplateEngineManager(templateConfig);
  tem.config = Object.assign({}, config);
  tem.config.extensionMap.add({
    extension: "custom1",
    key: "custom1",
    init: async function () {
      // do custom things, but only once
      initCount++;
    },
    compile: function (str, inputPath) {
      compileCount++;
      return () => str;
    },
  });

  t.truthy(tem.hasEngine("custom1"));
  let engine = tem.getEngine("custom1");
  let fn = await engine.compile("<p>This is plaintext</p>");
  t.is(await fn({}), "<p>This is plaintext</p>");

  let engine2 = tem.getEngine("custom1");
  t.is(engine, engine2);

  let fn2 = await engine2.compile("<p>This is plaintext</p>");
  t.is(await fn2({}), "<p>This is plaintext</p>");

  t.is(initCount, 1, "Should have only run the init callback once");
  t.is(compileCount, 2, "Should have only run the compile callback twice");
});

test("Handlebars Helpers", async (t) => {
  let tem = new TemplateEngineManager(templateConfig);
  let engine = tem.getEngine("hbs");
  engine.addHelpers({
    uppercase: function (name) {
      return name.toUpperCase();
    },
  });

  let fn = await engine.compile("<p>{{uppercase author}}</p>");
  t.is(await fn({ author: "zach" }), "<p>ZACH</p>");
});

test("getEngineLib", async (t) => {
  let tem = new TemplateEngineManager(templateConfig);
  t.truthy(tem.getEngine("md").getEngineLib());
});
