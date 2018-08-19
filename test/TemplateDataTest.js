import test from "ava";
import TemplateData from "../src/TemplateData";
import templateConfig from "../src/Config";

const config = templateConfig.getConfig();

test("Create", async t => {
  let dataObj = new TemplateData("./test/stubs/");
  let data = await dataObj.getData();

  t.true(Object.keys(data[config.keys.package]).length > 0);
});

// test("Create (old method, file name not dir)", async t => {
//   let dataObj = new TemplateData("./test/stubs/globalData.json");
//   let data = await dataObj.getData();

//   t.true(Object.keys(data[config.keys.package]).length > 0);
// });

test("getData()", async t => {
  let dataObj = new TemplateData("./test/stubs/");

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

test("Data dir does not exist", async t => {
  let dataObj = new TemplateData("./test/thisdirectorydoesnotexist");

  await t.throws(dataObj.getData());
});

test("addLocalData()", async t => {
  let dataObj = new TemplateData("./test/stubs/");
  let data = await dataObj.getData();

  t.is(data.globalData.datakey1, "datavalue1");
  t.is(data.globalData.datakey2, "@11ty/eleventy");

  let withLocalData = await dataObj.getLocalData(
    "./test/stubs/component/component.json"
  );
  t.is(withLocalData.globalData.datakey1, "datavalue1");
  t.is(withLocalData.globalData.datakey2, "@11ty/eleventy");
  t.is(withLocalData.localdatakey1, "localdatavalue1");
});

test("addLocalData() doesn’t exist but doesn’t fail (template file does exist)", async t => {
  let dataObj = new TemplateData("./test/stubs/");
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

test("addLocalData() doesn’t exist but doesn’t fail (template file does not exist)", async t => {
  let dataObj = new TemplateData("./test/stubs/");
  let data = await dataObj.getData();
  let beforeDataKeyCount = Object.keys(data);

  let withLocalData = await dataObj.getLocalData(
    "./test/stubs/datafiledoesnotexist/templatedoesnotexist.njk"
  );
  t.is(withLocalData.globalData.datakey1, "datavalue1");
  t.is(withLocalData.globalData.datakey2, "@11ty/eleventy");
  t.deepEqual(Object.keys(withLocalData), beforeDataKeyCount);
});

test("Global Dir Directory", async t => {
  let dataObj = new TemplateData();

  t.is(await dataObj.getGlobalDataGlob(), "./_data/**/*.json");
});

test("Global Dir Directory with Constructor Path Arg", async t => {
  let dataObj = new TemplateData("./test/stubs/");

  t.is(await dataObj.getGlobalDataGlob(), "./test/stubs/_data/**/*.json");
});

test("getAllGlobalData() with other data files", async t => {
  let dataObj = new TemplateData("./test/stubs/");
  let data = await dataObj.cacheData();
  let dataFilePaths = await dataObj.getGlobalDataFiles();

  t.true(dataFilePaths.length > 0);
  t.true(
    dataFilePaths.filter(path => {
      return path.indexOf("./test/stubs/_data/globalData.json") === 0;
    }).length > 0
  );
  t.not(typeof data.testData, "undefined");

  t.deepEqual(data.testData, {
    testdatakey1: "testdatavalue1"
  });

  t.deepEqual(data.subdir.testDataSubdir, {
    subdirkey: "subdirvalue"
  });
});

test("getJson() without a dataTemplateEngine", async t => {
  let dataObj = new TemplateData("./test/stubs/");
  dataObj.setDataTemplateEngine(false);

  let data = await dataObj.getJson("./test/stubs/_data/testDataEjs.json", {
    pkg: { name: "pkgname" }
  });

  t.deepEqual(data, {
    datakey1: "datavalue1",
    datakey2: "<%= pkg.name %>"
  });
});

test("getJson() without dataTemplateEngine changed to `ejs`", async t => {
  let dataObj = new TemplateData("./test/stubs/");
  dataObj.setDataTemplateEngine("ejs");

  let data = await dataObj.getJson("./test/stubs/_data/testDataEjs.json", {
    pkg: { name: "pkgname" }
  });

  t.deepEqual(data, {
    datakey1: "datavalue1",
    datakey2: "pkgname"
  });
});

test("getLocalDataPaths", async t => {
  let dataObj = new TemplateData("./test/stubs/");
  let paths = dataObj.getLocalDataPaths(
    "./test/stubs/component/component.liquid"
  );

  t.deepEqual(paths, ["./test/stubs/component/component.json"]);
});

test("getLocalDataPaths with inputDir passed in (trailing slash)", async t => {
  let dataObj = new TemplateData("./test/stubs/");
  let paths = dataObj.getLocalDataPaths(
    "./test/stubs/component/component.liquid"
  );

  t.deepEqual(paths, ["./test/stubs/component/component.json"]);
});

test("getLocalDataPaths with inputDir passed in (no trailing slash)", async t => {
  let dataObj = new TemplateData("./test/stubs/");
  let paths = dataObj.getLocalDataPaths(
    "./test/stubs/component/component.liquid"
  );

  t.deepEqual(paths, ["./test/stubs/component/component.json"]);
});

test("getLocalDataPaths with inputDir passed in (no leading slash)", async t => {
  let dataObj = new TemplateData("test/stubs");
  let paths = dataObj.getLocalDataPaths(
    "./test/stubs/component/component.liquid"
  );

  t.deepEqual(paths, ["./test/stubs/component/component.json"]);
});
