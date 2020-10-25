const test = require("ava");
const TemplateRender = require("../src/TemplateRender");
const EleventyExtensionMap = require("../src/EleventyExtensionMap");
const Vue = require("vue");
const renderer = require("vue-server-renderer").createRenderer();
const templateConfig = require("../src/Config");

let config = {};

test.before(async () => {
  // This runs concurrently with the above
  await templateConfig.init();
  config = templateConfig.getConfig();
});

function getNewTemplateRender(name, inputDir) {
  let tr = new TemplateRender(name, inputDir, templateConfig);
  tr.extensionMap = new EleventyExtensionMap([], templateConfig);
  return tr;
}

test("Custom plaintext Render", async (t) => {
  let tr = getNewTemplateRender("txt");

  tr.config = Object.assign({}, config);
  tr.config.extensionMap.add({
    extension: "txt",
    key: "txt",
    compile: function (str, inputPath) {
      // plaintext
      return function (data) {
        return str;
      };
    },
  });

  let fn = await tr.getCompiledTemplate("<p>Paragraph</p>");
  t.is(await fn(), "<p>Paragraph</p>");
  t.is(await fn({}), "<p>Paragraph</p>");
});

test("Custom Vue Render", async (t) => {
  let tr = getNewTemplateRender("vue");

  tr.config = Object.assign({}, config);
  tr.config.extensionMap.add({
    extension: "vue",
    key: "vue",
    compile: function (str, inputPath) {
      return async function (data) {
        const app = new Vue({
          template: str,
          data: data,
        });

        return renderer.renderToString(app);
      };
    },
  });

  let fn = await tr.getCompiledTemplate(`<p v-html="test">Paragraph</p>`);
  t.is(await fn({ test: "Hello" }), `<p data-server-rendered="true">Hello</p>`);
});

test("Custom Sass Render", async (t) => {
  const sass = require("node-sass");
  let tr = getNewTemplateRender("sass");

  tr.config = Object.assign({}, config);
  tr.config.extensionMap.add({
    extension: "sass",
    key: "sass",
    compile: function (str, inputPath) {
      // TODO declare data variables as SASS variables?
      return async function (data) {
        return new Promise(function (resolve, reject) {
          sass.render(
            {
              data: str,
              includePaths: [tr.inputDir, tr.includesDir],
              style: "expanded",
              // TODO
              // sourcemap: "file",
              outFile: "test_this_is_to_not_write_a_file.css",
            },
            function (error, result) {
              if (error) {
                reject(error);
              } else {
                resolve(result.css.toString("utf8"));
              }
            }
          );
        });
      };
    },
  });

  let fn = await tr.getCompiledTemplate(`$color: blue; p { color: $color; }`);
  t.is(
    (await fn({})).trim(),
    `p {
  color: blue; }`
  );
});
