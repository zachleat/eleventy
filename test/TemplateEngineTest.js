const test = require("ava");
const TemplateEngine = require("../src/Engines/TemplateEngine");
const templateConfig = require("../src/Config");

test.before(async () => {
  // This runs concurrently with the above
  await templateConfig.init();
});

test("Unsupported engine", async (t) => {
  t.is(
    new TemplateEngine("doesnotexist", null, templateConfig).getName(),
    "doesnotexist"
  );
});

test("Supported engine", async (t) => {
  t.is(new TemplateEngine("ejs", null, templateConfig).getName(), "ejs");
});
