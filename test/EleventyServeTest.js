const test = require("ava");
const EleventyServe = require("../src/EleventyServe");
const templateConfig = require("../src/Config");

test.before(async () => {
  // This runs concurrently with the above
  await templateConfig.init();
});

test("Constructor", (t) => {
  let es = new EleventyServe();
  es.config = templateConfig;
  t.is(es.getPathPrefix(), "/");
});

test("Directories", (t) => {
  let es = new EleventyServe();
  es.config = templateConfig;
  es.setOutputDir("_site");
  t.is(es.getRedirectDir("test"), "_site/test");
  t.is(es.getRedirectFilename("test"), "_site/test/index.html");
});

test("Get Options", (t) => {
  let es = new EleventyServe();
  es.config = templateConfig;
  es.config = {
    pathPrefix: "/",
  };
  es.setOutputDir("_site");

  t.deepEqual(es.getOptions(), {
    ignore: ["node_modules"],
    index: "index.html",
    notify: false,
    open: false,
    port: 8080,
    server: {
      baseDir: "_site",
    },
    watch: false,
  });
});

test("Get Options (with a pathPrefix)", (t) => {
  let es = new EleventyServe();
  es.config = templateConfig;
  es.config = {
    pathPrefix: "/web/",
  };
  es.setOutputDir("_site");

  t.deepEqual(es.getOptions(), {
    ignore: ["node_modules"],
    index: "index.html",
    notify: false,
    open: false,
    port: 8080,
    server: {
      baseDir: "_site/_eleventy_redirect",
      routes: {
        "/web/": "_site",
      },
    },
    watch: false,
  });
});

test("Get Options (override in config)", (t) => {
  let es = new EleventyServe();
  es.config = templateConfig;
  es.config = {
    pathPrefix: "/",
    browserSyncConfig: {
      notify: true,
    },
  };
  es.setOutputDir("_site");

  t.deepEqual(es.getOptions(), {
    ignore: ["node_modules"],
    index: "index.html",
    notify: true,
    open: false,
    port: 8080,
    server: {
      baseDir: "_site",
    },
    watch: false,
  });
});
