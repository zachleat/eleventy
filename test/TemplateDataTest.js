const test = require("ava");
const TemplateData = require("../src/TemplateData");
const templateConfig = require("../src/Config");

let config = {};

test.before(async () => {
  // This runs concurrently with the above
  await templateConfig.init();
  config = templateConfig.getConfig();
});

test("Create", async (t) => {
  let dataObj = new TemplateData("./test/stubs/", templateConfig);
  let data = await dataObj.getData();

  t.true(Object.keys(data[config.keys.package]).length > 0);
});

test("getData()", async (t) => {
  let dataObj = new TemplateData("./test/stubs/", templateConfig);
  dataObj.setDataTemplateEngine("liquid");

  t.is(dataObj.getData().toString(), "[object Promise]");

  let data = await dataObj.getData();
  t.is(data.globalData.datakey1, "datavalue1", "simple data value");
  t.is(
    data.globalData.datakey2,
    "@11ty/eleventy",
    `variables, resolve ${config.keys.package} to its value.`
  );

  t.true(
    Object.keys(data[config.keys.package]).length > 0,
    `package.json imported to data in ${config.keys.package}`
  );
});

test("getData() use default processing (false)", async (t) => {
  let dataObj = new TemplateData("./test/stubs/", templateConfig);
  let data = await dataObj.getData();
  t.is(
    data.globalData.datakey2,
    "{{pkg.name}}",
    `variables should not resolve`
  );
});

test("Data dir does not exist", async (t) => {
  await t.throwsAsync(async () => {
    let dataObj = new TemplateData(
      "./test/thisdirectorydoesnotexist",
      templateConfig
    );
    await dataObj.getData();
  });
});

test("Add local data", async (t) => {
  let dataObj = new TemplateData("./test/stubs/", templateConfig);
  dataObj.setDataTemplateEngine("liquid");

  let data = await dataObj.getData();

  t.is(data.globalData.datakey1, "datavalue1");
  t.is(data.globalData.datakey2, "@11ty/eleventy");

  let withLocalData = await dataObj.getLocalData(
    "./test/stubs/component/component.njk"
  );
  t.is(withLocalData.globalData.datakey1, "datavalue1");
  t.is(withLocalData.globalData.datakey2, "@11ty/eleventy");
  t.is(withLocalData.localdatakey1, "localdatavalue1");

  // from the js file
  // this checks priority/overrides
  t.is(withLocalData.localdatakeyfromcjs, "common-js-howdydoody");
  t.is(withLocalData.localdatakeyfromjs, "howdydoody");
  t.is(withLocalData.localdatakeyfromjs2, "howdy2");
});

test("Get local data async JS", async (t) => {
  let dataObj = new TemplateData("./test/stubs/", templateConfig);

  let withLocalData = await dataObj.getLocalData(
    "./test/stubs/component-async/component.njk"
  );

  // from the js file
  t.is(withLocalData.localdatakeyfromjs, "howdydoody");
  t.is(withLocalData.localdatakeyfromcjs, "common-js-howdydoody");
});

test("addLocalData() doesn’t exist but doesn’t fail (template file does exist)", async (t) => {
  let dataObj = new TemplateData("./test/stubs/", templateConfig);
  dataObj.setDataTemplateEngine("liquid");

  let data = await dataObj.getData();
  let beforeDataKeyCount = Object.keys(data);

  // template file does exist
  let withLocalData = await dataObj.getLocalData(
    "./test/stubs/datafiledoesnotexist/template.njk"
  );
  t.is(withLocalData.globalData.datakey1, "datavalue1");
  t.is(withLocalData.globalData.datakey2, "@11ty/eleventy");
  t.deepEqual(Object.keys(withLocalData), beforeDataKeyCount);
});

test("addLocalData() doesn’t exist but doesn’t fail (template file does not exist)", async (t) => {
  let dataObj = new TemplateData("./test/stubs/", templateConfig);
  dataObj.setDataTemplateEngine("liquid");

  let data = await dataObj.getData();
  let beforeDataKeyCount = Object.keys(data);

  let withLocalData = await dataObj.getLocalData(
    "./test/stubs/datafiledoesnotexist/templatedoesnotexist.njk"
  );
  t.is(withLocalData.globalData.datakey1, "datavalue1");
  t.is(withLocalData.globalData.datakey2, "@11ty/eleventy");
  t.deepEqual(Object.keys(withLocalData), beforeDataKeyCount);
});

test("Global Dir Directory", async (t) => {
  let dataObj = new TemplateData("./", templateConfig);

  t.deepEqual(await dataObj.getGlobalDataGlob(), [
    "./_data/**/*.(json|cjs|js)",
  ]);
});

test("Global Dir Directory with Constructor Path Arg", async (t) => {
  let dataObj = new TemplateData("./test/stubs/", templateConfig);

  t.deepEqual(await dataObj.getGlobalDataGlob(), [
    "./test/stubs/_data/**/*.(json|cjs|js)",
  ]);
});

test("getAllGlobalData() with other data files", async (t) => {
  let dataObj = new TemplateData("./test/stubs/", templateConfig);
  let data = await dataObj.cacheData();
  let dataFilePaths = await dataObj.getGlobalDataFiles();

  t.true(dataFilePaths.length > 0);
  t.true(
    dataFilePaths.filter((path) => {
      return path.indexOf("./test/stubs/_data/globalData.json") === 0;
    }).length > 0
  );

  t.truthy(data.globalData);
  t.is(data.globalData.datakey1, "datavalue1");

  t.truthy(data.testData);
  t.deepEqual(data.testData, {
    testdatakey1: "testdatavalue1",
  });
  t.deepEqual(data.subdir.testDataSubdir, {
    subdirkey: "subdirvalue",
  });
});

test("getAllGlobalData() with js object data file", async (t) => {
  let dataObj = new TemplateData("./test/stubs/", templateConfig);
  let data = await dataObj.cacheData();
  let dataFilePaths = await dataObj.getGlobalDataFiles();

  t.true(
    dataFilePaths.filter((path) => {
      return path.indexOf("./test/stubs/_data/globalData2.js") === 0;
    }).length > 0
  );

  t.truthy(data.globalData2);
  t.is(data.globalData2.datakeyfromjs, "howdy");
});

test("getAllGlobalData() with js function data file", async (t) => {
  let dataObj = new TemplateData("./test/stubs/", templateConfig);
  let data = await dataObj.cacheData();
  let dataFilePaths = await dataObj.getGlobalDataFiles();

  t.true(
    dataFilePaths.filter((path) => {
      return path.indexOf("./test/stubs/_data/globalDataFn.js") === 0;
    }).length > 0
  );

  t.truthy(data.globalDataFn);
  t.is(data.globalDataFn.datakeyfromjsfn, "howdy");
});

test("getAllGlobalData() with config globalData", async (t) => {
  let dataObj = new TemplateData("./test/stubs/", templateConfig);

  dataObj._setConfig({
    ...dataObj.config,
    globalData: {
      example: () => {
        return "one";
      },
      example2: async () => {
        return "two";
      },
      example3: "static",
    },
  });

  let data = await dataObj.cacheData(true);

  t.is(data.example, "one");
  t.is(data.example2, "two");
  t.is(data.example3, "static");
});

test("getAllGlobalData() with common js function data file", async (t) => {
  let dataObj = new TemplateData("./test/stubs/", templateConfig);
  let data = await dataObj.cacheData();
  let dataFilePaths = await dataObj.getGlobalDataFiles();

  t.true(
    dataFilePaths.filter((path) => {
      return path.indexOf("./test/stubs/_data/globalDataFnCJS.cjs") === 0;
    }).length > 0
  );

  t.truthy(data.globalDataFnCJS);
  t.is(data.globalDataFnCJS.datakeyfromcjsfn, "common-cjs-howdy");
});

test("getDataValue() without a dataTemplateEngine", async (t) => {
  let dataObj = new TemplateData("./test/stubs/", templateConfig);
  dataObj.setDataTemplateEngine(false);

  let data = await dataObj.getDataValue("./test/stubs/_data/testDataEjs.json", {
    pkg: { name: "pkgname" },
  });

  t.deepEqual(data, {
    datakey1: "datavalue1",
    datakey2: "<%= pkg.name %>",
  });
});

test("getDataValue() without dataTemplateEngine changed to `ejs`", async (t) => {
  let dataObj = new TemplateData("./test/stubs/", templateConfig);
  dataObj.setDataTemplateEngine("ejs");

  let data = await dataObj.getDataValue("./test/stubs/_data/testDataEjs.json", {
    pkg: { name: "pkgname" },
  });

  t.deepEqual(data, {
    datakey1: "datavalue1",
    datakey2: "pkgname",
  });
});

test("getLocalDataPaths", async (t) => {
  let dataObj = new TemplateData("./test/stubs/", templateConfig);
  let paths = await dataObj.getLocalDataPaths(
    "./test/stubs/component/component.liquid"
  );

  t.deepEqual(paths, [
    "./test/stubs/stubs.json",
    "./test/stubs/stubs.11tydata.json",
    "./test/stubs/stubs.11tydata.cjs",
    "./test/stubs/stubs.11tydata.js",
    "./test/stubs/component/component.json",
    "./test/stubs/component/component.11tydata.json",
    "./test/stubs/component/component.11tydata.cjs",
    "./test/stubs/component/component.11tydata.js",
  ]);
});

test("Deeper getLocalDataPaths", async (t) => {
  let dataObj = new TemplateData("./", templateConfig);
  let paths = await dataObj.getLocalDataPaths(
    "./test/stubs/component/component.liquid"
  );

  t.deepEqual(paths, [
    "./test/test.json",
    "./test/test.11tydata.json",
    "./test/test.11tydata.cjs",
    "./test/test.11tydata.js",
    "./test/stubs/stubs.json",
    "./test/stubs/stubs.11tydata.json",
    "./test/stubs/stubs.11tydata.cjs",
    "./test/stubs/stubs.11tydata.js",
    "./test/stubs/component/component.json",
    "./test/stubs/component/component.11tydata.json",
    "./test/stubs/component/component.11tydata.cjs",
    "./test/stubs/component/component.11tydata.js",
  ]);
});

test("getLocalDataPaths with an 11ty js template", async (t) => {
  let dataObj = new TemplateData("./test/stubs/", templateConfig);
  let paths = await dataObj.getLocalDataPaths(
    "./test/stubs/component/component.11ty.js"
  );

  t.deepEqual(paths, [
    "./test/stubs/stubs.json",
    "./test/stubs/stubs.11tydata.json",
    "./test/stubs/stubs.11tydata.cjs",
    "./test/stubs/stubs.11tydata.js",
    "./test/stubs/component/component.json",
    "./test/stubs/component/component.11tydata.json",
    "./test/stubs/component/component.11tydata.cjs",
    "./test/stubs/component/component.11tydata.js",
  ]);
});

test("getLocalDataPaths with inputDir passed in (trailing slash)", async (t) => {
  let dataObj = new TemplateData("./test/stubs/", templateConfig);
  let paths = await dataObj.getLocalDataPaths(
    "./test/stubs/component/component.liquid"
  );

  t.deepEqual(paths, [
    "./test/stubs/stubs.json",
    "./test/stubs/stubs.11tydata.json",
    "./test/stubs/stubs.11tydata.cjs",
    "./test/stubs/stubs.11tydata.js",
    "./test/stubs/component/component.json",
    "./test/stubs/component/component.11tydata.json",
    "./test/stubs/component/component.11tydata.cjs",
    "./test/stubs/component/component.11tydata.js",
  ]);
});

test("getLocalDataPaths with inputDir passed in (no trailing slash)", async (t) => {
  let dataObj = new TemplateData("./test/stubs/", templateConfig);
  let paths = await dataObj.getLocalDataPaths(
    "./test/stubs/component/component.liquid"
  );

  t.deepEqual(paths, [
    "./test/stubs/stubs.json",
    "./test/stubs/stubs.11tydata.json",
    "./test/stubs/stubs.11tydata.cjs",
    "./test/stubs/stubs.11tydata.js",
    "./test/stubs/component/component.json",
    "./test/stubs/component/component.11tydata.json",
    "./test/stubs/component/component.11tydata.cjs",
    "./test/stubs/component/component.11tydata.js",
  ]);
});

test("getLocalDataPaths with inputDir passed in (no leading slash)", async (t) => {
  let dataObj = new TemplateData("test/stubs", templateConfig);
  let paths = await dataObj.getLocalDataPaths(
    "./test/stubs/component/component.liquid"
  );

  t.deepEqual(paths, [
    "./test/stubs/stubs.json",
    "./test/stubs/stubs.11tydata.json",
    "./test/stubs/stubs.11tydata.cjs",
    "./test/stubs/stubs.11tydata.js",
    "./test/stubs/component/component.json",
    "./test/stubs/component/component.11tydata.json",
    "./test/stubs/component/component.11tydata.cjs",
    "./test/stubs/component/component.11tydata.js",
  ]);
});

test("getRawImports", async (t) => {
  let dataObj = new TemplateData("test/stubs", templateConfig);
  let data = dataObj.getRawImports();

  t.is(data.pkg.name, "@11ty/eleventy");
});

test("getTemplateDataFileGlob", async (t) => {
  let tw = new TemplateData("test/stubs", templateConfig);

  t.deepEqual(await tw.getTemplateDataFileGlob(), [
    "./test/stubs/**/*.json",
    "./test/stubs/**/*.11tydata.cjs",
    "./test/stubs/**/*.11tydata.js",
  ]);
});

test("TemplateData.merge", (t) => {
  t.deepEqual(
    TemplateData.merge(
      {
        tags: [1, 2, 3],
      },
      {
        tags: [4, 5, 6],
      }
    ),
    { tags: [1, 2, 3, 4, 5, 6] }
  );
});

test("TemplateData.cleanupData", (t) => {
  t.deepEqual(TemplateData.cleanupData({}), {});
  t.deepEqual(TemplateData.cleanupData({ tags: null }), { tags: [] });
  t.deepEqual(TemplateData.cleanupData({ tags: "" }), { tags: [] });
  t.deepEqual(TemplateData.cleanupData({ tags: [] }), { tags: [] });
  t.deepEqual(TemplateData.cleanupData({ tags: "test" }), { tags: ["test"] });
  t.deepEqual(TemplateData.cleanupData({ tags: ["test1", "test2"] }), {
    tags: ["test1", "test2"],
  });
});

test("Parent directory for data (Issue #337)", async (t) => {
  let dataObj = new TemplateData(
    "./test/stubs-337/src/",
    templateConfig,
    templateConfig
  );
  dataObj._setConfig({
    dataTemplateEngine: false,
    dir: {
      input: "./test/stubs-337/src/",
      data: "../data/",
    },
  });
  dataObj.setInputDir("./test/stubs-337/src/");

  let data = await dataObj.getData();

  t.deepEqual(data, {
    xyz: {
      hi: "bye",
    },
  });
});
