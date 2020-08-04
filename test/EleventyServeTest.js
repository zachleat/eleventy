import test from "ava";
import EleventyServe from "../src/EleventyServe";

test("Constructor", t => {
  let es = new EleventyServe();
  t.is(es.getPathPrefix(), "/");
});

test("Directories", t => {
  let es = new EleventyServe();
  es.setOutputDir("_site");
  t.is(es.getRedirectDir("test"), "_site/test");
  t.is(es.getRedirectFilename("test"), "_site/test/index.html");
});

test("Get Options", t => {
  let es = new EleventyServe();
  es.config = {
    pathPrefix: "/"
  };
  es.setOutputDir("_site");

  const options = es.getOptions();
  t.deepEqual(options, {
    ignore: ["node_modules"],
    index: "index.html",
    notify: false,
    open: false,
    port: 8080,
    server: {
      baseDir: "_site"
    },
    middleware: options.middleware,
    watch: false
  });
});

test("Get Options (with a pathPrefix)", t => {
  let es = new EleventyServe();
  es.config = {
    pathPrefix: "/web/"
  };
  es.setOutputDir("_site");

  const options = es.getOptions();
  t.deepEqual(options, {
    ignore: ["node_modules"],
    index: "index.html",
    notify: false,
    open: false,
    port: 8080,
    server: {
      baseDir: "_site/_eleventy_redirect",
      routes: {
        "/web/": "_site"
      }
    },
    middleware: options.middleware,
    watch: false
  });
});

test("Get Options (override in config)", t => {
  let es = new EleventyServe();
  es.config = {
    pathPrefix: "/",
    browserSyncConfig: {
      notify: true
    }
  };
  es.setOutputDir("_site");

  const options = es.getOptions();
  t.deepEqual(options, {
    ignore: ["node_modules"],
    index: "index.html",
    notify: true,
    open: false,
    port: 8080,
    server: {
      baseDir: "_site"
    },
    middleware: options.middleware,
    watch: false
  });
});
