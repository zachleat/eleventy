import test from "ava";
import path from "path";
import normalize from "normalize-path";
import TemplatePath from "../src/TemplatePath";

test("Working dir", t => {
  t.is(TemplatePath.getWorkingDir(), path.resolve("./"));
  t.is(TemplatePath.getModuleDir(), path.resolve(__dirname, ".."));
});

test("Normalizer", async t => {
  t.is(TemplatePath.normalize(""), ".");
  t.is(TemplatePath.normalize("."), ".");
  t.is(TemplatePath.normalize("/"), "/");
  t.is(TemplatePath.normalize("/testing"), "/testing");
  t.is(TemplatePath.normalize("/testing/"), "/testing");

  // v0.4.0 changed from `./` to `.`
  // normalize removes trailing slashes so it should probably be `.`
  t.is(TemplatePath.normalize("./"), ".");
  t.is(TemplatePath.normalize("./testing"), "testing");

  t.is(TemplatePath.normalize("../"), "..");
  t.is(TemplatePath.normalize("../testing"), "../testing");

  t.is(TemplatePath.normalize("testing", "hello"), "testing/hello");
  t.is(TemplatePath.normalize("testing", "hello/"), "testing/hello");
  t.is(TemplatePath.normalize("./testing", "hello"), "testing/hello");
  t.is(TemplatePath.normalize("./testing", "hello/"), "testing/hello");
  t.is(TemplatePath.normalize("./testing/hello"), "testing/hello");
  t.is(TemplatePath.normalize("./testing/hello/"), "testing/hello");

  t.is(normalize(".htaccess"), ".htaccess");
  t.is(TemplatePath.normalize(".htaccess"), ".htaccess");
});

test("stripLeadingDotSlash", t => {
  t.is(TemplatePath.stripLeadingDotSlash("./test/stubs"), "test/stubs");
  t.is(TemplatePath.stripLeadingDotSlash("./dist"), "dist");
  t.is(TemplatePath.stripLeadingDotSlash("../dist"), "../dist");
  t.is(TemplatePath.stripLeadingDotSlash("dist"), "dist");

  t.is(TemplatePath.stripLeadingDotSlash(".htaccess"), ".htaccess");
});

test("hasTrailingSlash", t => {
  t.is(TemplatePath.hasTrailingSlash(), false);
  t.is(TemplatePath.hasTrailingSlash(""), false);
  t.is(TemplatePath.hasTrailingSlash("dist"), false);
  t.is(TemplatePath.hasTrailingSlash("./test/stubs"), false);
  t.is(TemplatePath.hasTrailingSlash("/"), true);
  t.is(TemplatePath.hasTrailingSlash("dist/"), true);
  t.is(TemplatePath.hasTrailingSlash("./test/stubs/"), true);
});

test("addLeadingDotSlash", t => {
  t.is(TemplatePath.addLeadingDotSlash("."), "./");
  t.is(TemplatePath.addLeadingDotSlash(".."), "../");
  t.is(TemplatePath.addLeadingDotSlash("./test/stubs"), "./test/stubs");
  t.is(TemplatePath.addLeadingDotSlash("./dist"), "./dist");
  t.is(TemplatePath.addLeadingDotSlash("../dist"), "../dist");
  t.is(TemplatePath.addLeadingDotSlash("/dist"), "/dist");
  t.is(TemplatePath.addLeadingDotSlash("dist"), "./dist");
  t.is(TemplatePath.addLeadingDotSlash(".nyc_output"), "./.nyc_output");
});

test("addLeadingDotSlashArray", t => {
  t.deepEqual(TemplatePath.addLeadingDotSlashArray(["."]), ["./"]);
  t.deepEqual(TemplatePath.addLeadingDotSlashArray([".."]), ["../"]);
  t.deepEqual(TemplatePath.addLeadingDotSlashArray(["./test/stubs"]), [
    "./test/stubs"
  ]);
  t.deepEqual(TemplatePath.addLeadingDotSlashArray(["./dist"]), ["./dist"]);
  t.deepEqual(TemplatePath.addLeadingDotSlashArray(["../dist"]), ["../dist"]);
  t.deepEqual(TemplatePath.addLeadingDotSlashArray(["/dist"]), ["/dist"]);
  t.deepEqual(TemplatePath.addLeadingDotSlashArray(["dist"]), ["./dist"]);
  t.deepEqual(TemplatePath.addLeadingDotSlashArray([".nyc_output"]), [
    "./.nyc_output"
  ]);
});

test("contains", t => {
  t.false(TemplatePath.contains("./testing/hello", "./lskdjklfjz"));
  t.false(TemplatePath.contains("./testing/hello", "lskdjklfjz"));
  t.false(TemplatePath.contains("testing/hello", "./lskdjklfjz"));
  t.false(TemplatePath.contains("testing/hello", "lskdjklfjz"));

  t.true(TemplatePath.contains("./testing/hello", "./testing"));
  t.true(TemplatePath.contains("./testing/hello", "testing"));
  t.true(TemplatePath.contains("testing/hello", "./testing"));
  t.true(TemplatePath.contains("testing/hello", "testing"));

  t.true(TemplatePath.contains("testing/hello/subdir/test", "testing"));
  t.false(TemplatePath.contains("testing/hello/subdir/test", "hello"));
  t.false(TemplatePath.contains("testing/hello/subdir/test", "hello/subdir"));
  t.true(
    TemplatePath.contains("testing/hello/subdir/test", "testing/hello/subdir")
  );
  t.true(
    TemplatePath.contains(
      "testing/hello/subdir/test",
      "testing/hello/subdir/test"
    )
  );
});

test("stripPathFromDir", t => {
  t.is(
    TemplatePath.stripPathFromDir("./testing/hello", "./lskdjklfjz"),
    "testing/hello"
  );
  t.is(TemplatePath.stripPathFromDir("./test/stubs", "./test"), "stubs");
  t.is(TemplatePath.stripPathFromDir("./testing/hello", "testing"), "hello");
  t.is(TemplatePath.stripPathFromDir("testing/hello", "testing"), "hello");
  t.is(TemplatePath.stripPathFromDir("testing/hello", "./testing"), "hello");
  t.is(
    TemplatePath.stripPathFromDir("testing/hello/subdir/test", "testing"),
    "hello/subdir/test"
  );

  t.is(TemplatePath.stripPathFromDir(".htaccess", "./"), ".htaccess");
  t.is(TemplatePath.stripPathFromDir(".htaccess", "."), ".htaccess");
});

test("getLastDir", t => {
  t.is(TemplatePath.getLastDir("./testing/hello"), "hello");
  t.is(TemplatePath.getLastDir("./testing"), "testing");
  t.is(TemplatePath.getLastDir("./testing/"), "testing");
  t.is(TemplatePath.getLastDir("testing/"), "testing");
  t.is(TemplatePath.getLastDir("testing"), "testing");
});

test("getAllDirs", t => {
  t.deepEqual(TemplatePath.getAllDirs("."), ["."]);
  t.deepEqual(TemplatePath.getAllDirs("./testing/hello"), [
    "./testing/hello",
    "./testing"
  ]);
  t.deepEqual(TemplatePath.getAllDirs("./testing"), ["./testing"]);
  t.deepEqual(TemplatePath.getAllDirs("./testing/"), ["./testing"]);
  t.deepEqual(TemplatePath.getAllDirs("testing/"), ["testing"]);
  t.deepEqual(TemplatePath.getAllDirs("testing"), ["testing"]);
  t.deepEqual(TemplatePath.getAllDirs("./src/collections/posts"), [
    "./src/collections/posts",
    "./src/collections",
    "./src"
  ]);
});

test("Convert to glob", t => {
  t.is(TemplatePath.convertToGlob(""), "./**");
  t.is(TemplatePath.convertToGlob("test/stubs"), "./test/stubs/**");
  t.is(TemplatePath.convertToGlob("test/stubs/"), "./test/stubs/**");
  t.is(TemplatePath.convertToGlob("./test/stubs/"), "./test/stubs/**");
});

test("Remove extension", t => {
  t.is(TemplatePath.removeExtension(""), "");
  t.is(TemplatePath.removeExtension("", "hbs"), "");

  t.is(TemplatePath.removeExtension("test/stubs", "hbs"), "test/stubs");
  t.is(TemplatePath.removeExtension("test/stubs.njk"), "test/stubs.njk");
  t.is(TemplatePath.removeExtension("test/stubs.njk", "hbs"), "test/stubs.njk");
  t.is(TemplatePath.removeExtension("test/stubs.hbs", "hbs"), "test/stubs");

  t.is(TemplatePath.removeExtension("./test/stubs.njk"), "./test/stubs.njk");
  t.is(
    TemplatePath.removeExtension("./test/stubs.njk", "hbs"),
    "./test/stubs.njk"
  );
  t.is(TemplatePath.removeExtension("./test/stubs.hbs", "hbs"), "./test/stubs");

  t.is(TemplatePath.removeExtension("test/stubs", ".hbs"), "test/stubs");
  t.is(
    TemplatePath.removeExtension("test/stubs.njk", ".hbs"),
    "test/stubs.njk"
  );
  t.is(TemplatePath.removeExtension("test/stubs.hbs", ".hbs"), "test/stubs");
  t.is(
    TemplatePath.removeExtension("./test/stubs.njk", ".hbs"),
    "./test/stubs.njk"
  );
  t.is(
    TemplatePath.removeExtension("./test/stubs.hbs", ".hbs"),
    "./test/stubs"
  );
});
