const test = require("ava");
const TemplateData = require("../src/TemplateData");
let yaml = require("js-yaml");
const templateConfig = require("../src/Config");

test.before(async () => {
  // This runs concurrently with the above
  await templateConfig.init();
});

function injectDataExtensions(dataObj) {
  dataObj.config.dataExtensions = new Map([
    ["yaml", (s) => yaml.safeLoad(s)],
    ["nosj", JSON.parse],
  ]);
}

test("Local data", async (t) => {
  let dataObj = new TemplateData("./test/stubs-630/", templateConfig);
  injectDataExtensions(dataObj);
  dataObj.setDataTemplateEngine("liquid");

  let data = await dataObj.getData();

  // YAML GLOBAL DATA
  t.is(data.globalData3.datakey1, "datavalue3");
  t.is(data.globalData3.datakey2, "@11ty/eleventy--yaml");

  // NOSJ (JSON) GLOBAL DATA
  t.is(data.globalData4.datakey1, "datavalue4");
  t.is(data.globalData4.datakey2, "@11ty/eleventy--nosj");

  let withLocalData = await dataObj.getLocalData(
    "./test/stubs-630/component-yaml/component.njk"
  );
  // console.log("localdata", withLocalData);

  t.is(withLocalData.yamlKey1, "yaml1");
  t.is(withLocalData.yamlKey2, "yaml2");
  t.is(withLocalData.yamlKey3, "yaml3");
  t.is(withLocalData.nosjKey1, "nosj1");
  t.is(withLocalData.jsonKey1, "json1");
  t.is(withLocalData.jsonKey2, "json2");
  t.is(withLocalData.jsKey1, "js1");
});

test("Local files", async (t) => {
  let dataObj = new TemplateData("./test/stubs-630/", templateConfig);
  injectDataExtensions(dataObj);
  let files = await dataObj.getLocalDataPaths(
    "./test/stubs-630/component-yaml/component.njk"
  );
  t.deepEqual(files, [
    "./test/stubs-630/stubs-630.yaml",
    "./test/stubs-630/stubs-630.nosj",
    "./test/stubs-630/stubs-630.json",
    "./test/stubs-630/stubs-630.11tydata.yaml",
    "./test/stubs-630/stubs-630.11tydata.nosj",
    "./test/stubs-630/stubs-630.11tydata.json",
    "./test/stubs-630/stubs-630.11tydata.cjs",
    "./test/stubs-630/stubs-630.11tydata.js",
    "./test/stubs-630/component-yaml/component-yaml.yaml",
    "./test/stubs-630/component-yaml/component-yaml.nosj",
    "./test/stubs-630/component-yaml/component-yaml.json",
    "./test/stubs-630/component-yaml/component-yaml.11tydata.yaml",
    "./test/stubs-630/component-yaml/component-yaml.11tydata.nosj",
    "./test/stubs-630/component-yaml/component-yaml.11tydata.json",
    "./test/stubs-630/component-yaml/component-yaml.11tydata.cjs",
    "./test/stubs-630/component-yaml/component-yaml.11tydata.js",
    "./test/stubs-630/component-yaml/component.yaml",
    "./test/stubs-630/component-yaml/component.nosj",
    "./test/stubs-630/component-yaml/component.json",
    "./test/stubs-630/component-yaml/component.11tydata.yaml",
    "./test/stubs-630/component-yaml/component.11tydata.nosj",
    "./test/stubs-630/component-yaml/component.11tydata.json",
    "./test/stubs-630/component-yaml/component.11tydata.cjs",
    "./test/stubs-630/component-yaml/component.11tydata.js",
  ]);
});

test("Global data", async (t) => {
  let dataObj = new TemplateData("./test/stubs-630/", templateConfig);
  injectDataExtensions(dataObj);
  dataObj.setDataTemplateEngine("liquid");

  t.deepEqual(await dataObj.getGlobalDataGlob(), [
    "./test/stubs-630/_data/**/*.(nosj|yaml|json|cjs|js)",
  ]);

  let data = await dataObj.getData();

  // JS GLOBAL DATA
  t.is(data.globalData0.datakey1, "datavalue0");

  // CJS GLOBAL DATA
  t.is(data.globalData1.datakey1, "datavalue1");

  // JSON GLOBAL DATA
  t.is(data.globalData2.datakey1, "datavalue2");
  t.is(data.globalData2.datakey2, "@11ty/eleventy--json");

  // YAML GLOBAL DATA
  t.is(data.globalData3.datakey1, "datavalue3");
  t.is(data.globalData3.datakey2, "@11ty/eleventy--yaml");

  // NOSJ (JSON) GLOBAL DATA
  t.is(data.globalData4.datakey1, "datavalue4");
  t.is(data.globalData4.datakey2, "@11ty/eleventy--nosj");

  t.is(data.subdir.globalDataSubdir.keyyaml, "yaml");
});

test("Global data merging and priority", async (t) => {
  let dataObj = new TemplateData("./test/stubs-630/", templateConfig);
  injectDataExtensions(dataObj);

  let data = await dataObj.getData();

  // TESTING GLOBAL DATA PRIORITY AND MERGING
  t.is(data.mergingGlobalData.datakey0, "js-value0");
  t.is(data.mergingGlobalData.datakey1, "cjs-value1");
  t.is(data.mergingGlobalData.datakey2, "json-value2");
  t.is(data.mergingGlobalData.datakey3, "yaml-value3");
  t.is(data.mergingGlobalData.datakey4, "nosj-value4");

  t.is(data.mergingGlobalData.jskey, "js");
  t.is(data.mergingGlobalData.cjskey, "cjs");
  t.is(data.mergingGlobalData.jsonkey, "json");
  t.is(data.mergingGlobalData.yamlkey, "yaml");
  t.is(data.mergingGlobalData.nosjkey, "nosj");
});
