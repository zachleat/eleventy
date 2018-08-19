import test from "ava";
import TemplatePassthroughManager from "../src/TemplatePassthroughManager";

test("Get paths from Config", async t => {
  let mgr = new TemplatePassthroughManager();
  mgr.setConfig({
    passthroughFileCopy: true,
    passthroughCopies: {
      img: true
    }
  });

  t.deepEqual(mgr.getConfigPaths(), ["./img"]);
});

test("Empty config paths when disabled in config", async t => {
  let mgr = new TemplatePassthroughManager();
  mgr.setConfig({
    passthroughFileCopy: false,
    passthroughCopies: {
      img: true
    }
  });

  t.deepEqual(mgr.getConfigPaths(), []);
});

test("Get glob paths from Config", async t => {
  let mgr = new TemplatePassthroughManager();
  mgr.setConfig({
    passthroughFileCopy: true,
    passthroughCopies: {
      "test/stubs/img": true
    }
  });

  t.deepEqual(mgr.getConfigPathGlobs(), ["./test/stubs/img/**"]);
});

test("Get file paths", async t => {
  let mgr = new TemplatePassthroughManager();
  mgr.setConfig({
    passthroughFileCopy: true
  });

  t.deepEqual(mgr.getFilePaths(["test.png"]), ["test.png"]);
});

test("Get file paths (filter out real templates)", async t => {
  let mgr = new TemplatePassthroughManager();
  mgr.setConfig({
    passthroughFileCopy: true
  });

  t.deepEqual(mgr.getFilePaths(["test.njk"]), []);
});

test("Get file paths (filter out real templates), multiple", async t => {
  let mgr = new TemplatePassthroughManager();
  mgr.setConfig({
    passthroughFileCopy: true
  });

  t.deepEqual(mgr.getFilePaths(["test.njk", "test.png"]), ["test.png"]);
});

test("Get file paths with a js file (filter out real templates), multiple", async t => {
  let mgr = new TemplatePassthroughManager();
  mgr.setConfig({
    passthroughFileCopy: true
  });

  t.deepEqual(mgr.getFilePaths(["test.njk", "test.js"]), ["test.js"]);
});

test("Get file paths when disabled in config", async t => {
  let mgr = new TemplatePassthroughManager();
  mgr.setConfig({
    passthroughFileCopy: false
  });

  t.deepEqual(mgr.getFilePaths(["test.png"]), []);
});
