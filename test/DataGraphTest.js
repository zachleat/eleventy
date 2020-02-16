import test from "ava";
import DataGraph from "../src/DataGraph";
import Template from "../src/Template";
import TemplateMap from "../src/TemplateMap";
import { DepGraph } from "dependency-graph";

test("Simple dependency graph", t => {
  let depGraph = new DepGraph();
  depGraph.addNode("test.js");
  depGraph.addNode("test.js");
  t.is(depGraph.size(), 1);
});

test("Simple DataGraph", t => {
  let datagraph = new DataGraph();
  datagraph.addSourceOfData("_data/metadata.json", "metadata");
  t.deepEqual(datagraph.getConsumersOf("metadata"), []);
  t.deepEqual(datagraph.getConsumersOf("_data/metadata.json"), []);

  datagraph.addConsumerOfData("test.md", "metadata");
  t.deepEqual(datagraph.getConsumersOf("metadata"), ["test.md"]);
  t.deepEqual(datagraph.getConsumersOf("_data/metadata.json"), ["test.md"]);

  datagraph.addConsumerOfData("test.njk", "metadata");
  t.deepEqual(datagraph.getConsumersOf("metadata"), ["test.md", "test.njk"]);
  t.deepEqual(datagraph.getConsumersOf("_data/metadata.json"), [
    "test.md",
    "test.njk"
  ]);
});

test("Collections Example", t => {
  let datagraph = new DataGraph();
  datagraph.addSourceOfData("test.md", "collections.all");
  datagraph.addSourceOfData("test.njk", "collections.all");

  t.deepEqual(datagraph.getConsumersOf("collections.all"), []);
  t.deepEqual(datagraph.getConsumersOf("test.md"), []);
  t.deepEqual(datagraph.getConsumersOf("test.njk"), []);

  datagraph.addConsumerOfData("feed.xml", "collections.all");
  t.deepEqual(datagraph.getConsumersOf("collections.all"), ["feed.xml"]);
  t.deepEqual(datagraph.getConsumersOf("test.md"), ["feed.xml"]);
  t.deepEqual(datagraph.getConsumersOf("test.njk"), ["feed.xml"]);
});

test("Blog Posts Example", t => {
  let datagraph = new DataGraph();
  // blog tag
  datagraph.addSourceOfData("post1.md", "collections.blog");
  datagraph.addSourceOfData("post2.md", "collections.blog");
  datagraph.addSourceOfData("post3.md", "collections.blog");

  // default all
  datagraph.addSourceOfData("post1.md", "collections.all");
  datagraph.addSourceOfData("post2.md", "collections.all");
  datagraph.addSourceOfData("post3.md", "collections.all");
  datagraph.addSourceOfData("blogposts.njk", "collections.all");

  // consumers
  datagraph.addConsumerOfData("blogposts.njk", "collections.blog");
  datagraph.addConsumerOfData("feed.xml", "collections.all");

  t.deepEqual(datagraph.getConsumersOf("post1.md"), [
    "feed.xml",
    "blogposts.njk"
  ]);
  t.deepEqual(datagraph.getConsumersOf("post2.md"), [
    "feed.xml",
    "blogposts.njk"
  ]);
  t.deepEqual(datagraph.getConsumersOf("post3.md"), [
    "feed.xml",
    "blogposts.njk"
  ]);
  t.deepEqual(datagraph.getConsumersOf("blogposts.njk"), ["feed.xml"]);
  t.deepEqual(datagraph.getConsumersOf("feed.xml"), []);
});

test("DataGraph layouts", t => {
  let datagraph = new DataGraph();
  datagraph.addConsumerOfInclude("post1.md", "_includes/layout.njk");
  datagraph.addConsumerOfInclude("post2.md", "_includes/layout.njk");
  // chained
  datagraph.addConsumerOfInclude(
    "_includes/layout.njk",
    "_includes/base.njk",
    "include"
  );

  t.deepEqual(datagraph.getConsumersOf("_includes/layout.njk"), [
    "post1.md",
    "post2.md"
  ]);
  t.deepEqual(datagraph.getConsumersOf("_includes/base.njk"), [
    "post1.md",
    "post2.md"
  ]);
});

test("Simple proxy", t => {
  let datagraph = new DataGraph();
  let data = {
    collections: {
      all: [1, 2, 3]
    }
  };

  let references = new Set();
  datagraph.addProxy(data, "collections.all", false, target => {
    references.add(target);
  });

  data.collections;
  t.deepEqual(Array.from(references), []);

  data.collections.all[0];
  t.deepEqual(Array.from(references), ["collections.all"]);

  data.collections.all[1];
  t.deepEqual(Array.from(references), ["collections.all"]);
});

test("Apply proxy to all collections", t => {
  let datagraph = new DataGraph();
  let data = {
    collections: {
      all: [1, 2, 3],
      blog: [4, 5, 6]
    }
  };

  let references = new Set();
  datagraph.addProxy(data, "collections", true, target => {
    references.add(target);
  });

  data.collections;
  t.deepEqual(Array.from(references), []);

  data.collections.all[0];
  t.deepEqual(Array.from(references), ["collections.all"]);

  data.collections.all[1];
  t.deepEqual(Array.from(references), ["collections.all"]);

  data.collections.blog;
  t.deepEqual(Array.from(references), ["collections.all", "collections.blog"]);
});

test("Add graph for Template", async t => {
  let datagraph = new DataGraph();
  let tmpl = new Template(
    "./test/stubs-incremental/datagraph/test.njk",
    "./test/stubs-incremental/datagraph/",
    "./dist"
  );

  await datagraph.addGraphForTemplate(tmpl);
  t.deepEqual(
    datagraph.getConsumersOf("./test/stubs-incremental/datagraph/test.njk"),
    []
  );
  t.deepEqual(
    datagraph.getConsumersOf(
      "./test/stubs-incremental/datagraph/_includes/baselayout.njk"
    ),
    ["./test/stubs-incremental/datagraph/test.njk"]
  );
  t.deepEqual(
    datagraph.getConsumersOf(
      "./test/stubs-incremental/datagraph/_includes/parentlayout.njk"
    ),
    ["./test/stubs-incremental/datagraph/test.njk"]
  );
  t.deepEqual(
    datagraph.getConsumersOf(
      "./test/stubs-incremental/datagraph/_includes/grandparentlayout.njk"
    ),
    ["./test/stubs-incremental/datagraph/test.njk"]
  );
});

test("Add graph for TemplateMap", async t => {
  let datagraph = new DataGraph();
  let tmpl = new Template(
    "./test/stubs-incremental/datagraph/test.njk",
    "./test/stubs-incremental/datagraph/",
    "./dist"
  );
  let tm = new TemplateMap();
  await tm.add(tmpl);

  await datagraph.addGraphForTemplateMap(tm);
  t.deepEqual(
    datagraph.getConsumersOf("./test/stubs-incremental/datagraph/test.njk"),
    []
  );
  t.deepEqual(
    datagraph.getConsumersOf(
      "./test/stubs-incremental/datagraph/_includes/baselayout.njk"
    ),
    ["./test/stubs-incremental/datagraph/test.njk"]
  );
  t.deepEqual(
    datagraph.getConsumersOf(
      "./test/stubs-incremental/datagraph/_includes/parentlayout.njk"
    ),
    ["./test/stubs-incremental/datagraph/test.njk"]
  );
  t.deepEqual(
    datagraph.getConsumersOf(
      "./test/stubs-incremental/datagraph/_includes/grandparentlayout.njk"
    ),
    ["./test/stubs-incremental/datagraph/test.njk"]
  );
});
