import test from "ava";
import TemplateDependencies from "../src/TemplateDependencies";

test("Simple graph", t => {
  let deps = new TemplateDependencies();
  deps.add([{ inputPath: "navigation.md" }]);
  t.deepEqual(deps.getSorted(), []);
});

test("One vertice", t => {
  let deps = new TemplateDependencies();
  deps.setActiveTemplatePath("parent.md");
  deps.add([{ inputPath: "navigation.md" }]);
  t.deepEqual(deps.getSorted(), ["parent.md", "navigation.md"]);
});

test("One vertice, duplicate removed", t => {
  let deps = new TemplateDependencies();
  deps.setActiveTemplatePath("parent.md");
  deps.add([{ inputPath: "navigation.md" }, { inputPath: "navigation.md" }]);
  t.is(deps.getDependencies().length, 1);
});

test("One vertice, duplicate removed (two adds)", t => {
  let deps = new TemplateDependencies();
  deps.setActiveTemplatePath("parent.md");
  deps.add([{ inputPath: "navigation.md" }]);
  deps.add([{ inputPath: "navigation.md" }]);
  t.is(deps.getDependencies().length, 1);
});

test("Two vertices", t => {
  let deps = new TemplateDependencies();
  deps.setActiveTemplatePath("parent.md");
  deps.add([{ inputPath: "navigation.md" }, { inputPath: "navigation2.md" }]);
  t.deepEqual(deps.getSorted(), [
    "parent.md",
    "navigation.md",
    "navigation2.md"
  ]);
});

test("Two vertices, two active templates", t => {
  let deps = new TemplateDependencies();
  deps.setActiveTemplatePath("parent.md");
  deps.add([{ inputPath: "navigation.md" }]);
  deps.setActiveTemplatePath("parent-b.md");
  deps.add([{ inputPath: "navigation-b.md" }]);
  t.deepEqual(deps.getSorted(), [
    "parent.md",
    "navigation.md",
    "parent-b.md",
    "navigation-b.md"
  ]);
});

test("Four vertices, two active templates", t => {
  let deps = new TemplateDependencies();
  deps.setActiveTemplatePath("parent.md");
  deps.add([{ inputPath: "navigation.md" }, { inputPath: "navigation2.md" }]);
  deps.setActiveTemplatePath("parent-b.md");
  deps.add([
    { inputPath: "navigation-b.md" },
    { inputPath: "navigation-2b.md" }
  ]);
  t.deepEqual(deps.getSorted(), [
    "parent.md",
    "navigation.md",
    "navigation2.md",
    "parent-b.md",
    "navigation-b.md",
    "navigation-2b.md"
  ]);
});

test("Two vertices, connected", t => {
  let deps = new TemplateDependencies();
  deps.setActiveTemplatePath("parent.md");
  deps.add([{ inputPath: "navigation.md" }]);

  deps.setActiveTemplatePath("navigation.md");
  deps.add([{ inputPath: "child.md" }]);

  t.deepEqual(deps.getSorted(), ["parent.md", "navigation.md", "child.md"]);
});

test("Three vertices, connected", t => {
  let deps = new TemplateDependencies();
  deps.setActiveTemplatePath("parent.md");
  deps.add([{ inputPath: "navigation.md" }, { inputPath: "navigation2.md" }]);

  deps.setActiveTemplatePath("navigation.md");
  deps.add([{ inputPath: "child.md" }]);

  t.deepEqual(deps.getSorted(), [
    "parent.md",
    "navigation.md",
    "navigation2.md",
    "child.md"
  ]);
});

test("Circular graph", t => {
  let deps = new TemplateDependencies();
  deps.setActiveTemplatePath("a.md");
  deps.add([{ inputPath: "b.md" }]);

  deps.setActiveTemplatePath("b.md");
  deps.add([{ inputPath: "c.md" }]);

  deps.setActiveTemplatePath("c.md");
  deps.add([{ inputPath: "a.md" }]);

  t.throws(function() {
    deps.getSorted();
  });
});
