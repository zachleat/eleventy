const test = require("ava");
const TemplateRender = require("../src/TemplateRender");
const EleventyExtensionMap = require("../src/EleventyExtensionMap");
const md = require("markdown-it");
const mdEmoji = require("markdown-it-emoji");
const UserConfig = require("../src/UserConfig");
const eleventySyntaxHighlightPlugin = require("@11ty/eleventy-plugin-syntaxhighlight");
const templateConfig = require("../src/Config");

test.before(async () => {
  // This runs concurrently with the above
  await templateConfig.init();
});

function getNewTemplateRender(name, inputDir) {
  let tr = new TemplateRender(name, inputDir, templateConfig);
  tr.extensionMap = new EleventyExtensionMap([], templateConfig);
  return tr;
}

// Markdown
test("Markdown", (t) => {
  t.is(getNewTemplateRender("md").getEngineName(), "md");
});

test("Markdown Render: Parses base markdown, no data", async (t) => {
  let fn = await getNewTemplateRender("md").getCompiledTemplate("# My Title");
  t.is((await fn()).trim(), "<h1>My Title</h1>");
});

test("Markdown Render: Markdown should work with HTML too", async (t) => {
  let fn = await getNewTemplateRender("md").getCompiledTemplate(
    "<h1>My Title</h1>"
  );
  t.is((await fn()).trim(), "<h1>My Title</h1>");
});

test("Markdown Render: Parses markdown using liquid engine (default, with data)", async (t) => {
  let fn = await getNewTemplateRender("md").getCompiledTemplate("# {{title}}");
  t.is((await fn({ title: "My Title" })).trim(), "<h1>My Title</h1>");
});

test("Markdown Render: Parses markdown using ejs engine", async (t) => {
  let tr = getNewTemplateRender("md");
  tr.setMarkdownEngine("ejs");
  let fn = await tr.getCompiledTemplate("<%=title %>");
  t.is((await fn({ title: "My Title" })).trim(), "<p>My Title</p>");
});

test("Markdown Render: Ignore markdown, use only preprocess engine (useful for variable resolution in permalinks)", async (t) => {
  let tr = getNewTemplateRender("md");
  tr.setUseMarkdown(false);
  let fn = await tr.getCompiledTemplate("{{title}}");
  t.is((await fn({ title: "My Title" })).trim(), "My Title");
});

test("Markdown Render: Skip markdown and preprocess engine (issue #466)", async (t) => {
  let tr = getNewTemplateRender("md");
  tr.setMarkdownEngine(false);
  tr.setUseMarkdown(false);
  let fn = await tr.getCompiledTemplate("404.html");
  t.is((await fn({ title: "My Title" })).trim(), "404.html");
});

test("Markdown Render: Set markdown engine to false, don’t parse", async (t) => {
  let tr = getNewTemplateRender("md");
  tr.setMarkdownEngine(false);
  let fn = await tr.getCompiledTemplate("# {{title}}");
  t.is((await fn()).trim(), "<h1>{{title}}</h1>");
});

test("Markdown Render: Set markdown engine to false, don’t parse (test with HTML input)", async (t) => {
  let tr = getNewTemplateRender("md");
  tr.setMarkdownEngine(false);
  let fn = await tr.getCompiledTemplate("<h1>{{title}}</h1>");

  t.is((await fn()).trim(), "<h1>{{title}}</h1>");
});

test("Markdown Render: Pass in engine override (ejs)", async (t) => {
  let tr = getNewTemplateRender("md");
  tr.setMarkdownEngine("ejs");
  let fn = await tr.getCompiledTemplate("# <%= title %>");
  t.is((await fn({ title: "My Title" })).trim(), "<h1>My Title</h1>");
});

test("Markdown Render: Pass in an override (liquid)", async (t) => {
  let tr = getNewTemplateRender("md");
  tr.setMarkdownEngine("liquid");
  let fn = await tr.getCompiledTemplate("# {{title}}");

  t.is((await fn({ title: "My Title" })).trim(), "<h1>My Title</h1>");
});

test("Markdown Render: Strikethrough", async (t) => {
  let fn = await getNewTemplateRender("md").getCompiledTemplate("~~No~~");
  t.is((await fn()).trim(), "<p><s>No</s></p>");
});

test("Markdown Render: Strikethrough in a Header", async (t) => {
  let fn = await getNewTemplateRender("md").getCompiledTemplate("# ~~No~~");
  t.is((await fn()).trim(), "<h1><s>No</s></h1>");
});

test("Markdown Render: with Library Override", async (t) => {
  let tr = getNewTemplateRender("md");

  let mdLib = md();
  tr.engine.setLibrary(mdLib);
  t.is(mdLib.render(":)").trim(), "<p>:)</p>");

  let fn = await tr.getCompiledTemplate(":)");
  t.is((await fn()).trim(), "<p>:)</p>");
});

test("Markdown Render: with Library Override and a Plugin", async (t) => {
  let tr = getNewTemplateRender("md");

  let mdLib = md().use(mdEmoji);
  tr.engine.setLibrary(mdLib);
  t.is(mdLib.render(":)").trim(), "<p>😃</p>");

  let fn = await tr.getCompiledTemplate(":)");
  t.is((await fn()).trim(), "<p>😃</p>");
});

test("Markdown Render: use a custom highlighter", async (t) => {
  let tr = getNewTemplateRender("md");

  let mdLib = md();
  mdLib.set({
    highlight: function (str, lang) {
      return "This is overrrrrrride";
    },
  });
  tr.engine.setLibrary(mdLib);

  let fn = await tr.getCompiledTemplate(`\`\`\`
This is some code.
\`\`\``);
  t.is((await fn()).trim(), "<pre><code>This is overrrrrrride</code></pre>");
});

test("Markdown Render: use prism highlighter (no language)", async (t) => {
  let tr = getNewTemplateRender("md");
  let userConfig = new UserConfig();
  userConfig.addPlugin(eleventySyntaxHighlightPlugin);
  await userConfig.applyPlugins();

  let markdownHighlight = userConfig.getMergingConfigObject()
    .markdownHighlighter;

  let mdLib = md();
  mdLib.set({
    highlight: markdownHighlight,
  });
  tr.engine.setLibrary(mdLib);

  let fn = await tr.getCompiledTemplate(`\`\`\`
This is some code.
\`\`\``);
  t.is(
    (await fn()).trim(),
    `<pre><code>This is some code.
</code></pre>`
  );
});

test("Markdown Render: use prism highlighter", async (t) => {
  let tr = getNewTemplateRender("md");
  let userConfig = new UserConfig();
  userConfig.addPlugin(eleventySyntaxHighlightPlugin);
  await userConfig.applyPlugins();

  let markdownHighlight = userConfig.getMergingConfigObject()
    .markdownHighlighter;

  let mdLib = md();
  mdLib.set({
    highlight: markdownHighlight,
  });
  tr.engine.setLibrary(mdLib);

  let fn = await tr.getCompiledTemplate(`\`\`\` js
var key = "value";
\`\`\``);
  t.is(
    (await fn()).trim(),
    `<pre class="language-js"><code class="language-js"><span class="token keyword">var</span> key <span class="token operator">=</span> <span class="token string">"value"</span><span class="token punctuation">;</span></code></pre>`
  );
});

test("Markdown Render: use prism highlighter (no space before language)", async (t) => {
  let tr = getNewTemplateRender("md");
  let userConfig = new UserConfig();
  userConfig.addPlugin(eleventySyntaxHighlightPlugin);
  await userConfig.applyPlugins();

  let markdownHighlight = userConfig.getMergingConfigObject()
    .markdownHighlighter;

  let mdLib = md();
  mdLib.set({
    highlight: markdownHighlight,
  });
  tr.engine.setLibrary(mdLib);

  let fn = await tr.getCompiledTemplate(`\`\`\`js
var key = "value";
\`\`\``);
  t.is(
    (await fn()).trim(),
    `<pre class="language-js"><code class="language-js"><span class="token keyword">var</span> key <span class="token operator">=</span> <span class="token string">"value"</span><span class="token punctuation">;</span></code></pre>`
  );
});

test("Markdown Render: use prism highlighter, line highlighting", async (t) => {
  let tr = getNewTemplateRender("md");
  let userConfig = new UserConfig();
  userConfig.addPlugin(eleventySyntaxHighlightPlugin);
  await userConfig.applyPlugins();

  let markdownHighlight = userConfig.getMergingConfigObject()
    .markdownHighlighter;

  let mdLib = md();
  mdLib.set({
    highlight: markdownHighlight,
  });
  tr.engine.setLibrary(mdLib);

  let fn = await tr.getCompiledTemplate(`\`\`\`js/0
var key = "value";
\`\`\``);
  t.is(
    (await fn()).trim(),
    `<pre class="language-js"><code class="language-js"><mark class="highlight-line highlight-line-active"><span class="token keyword">var</span> key <span class="token operator">=</span> <span class="token string">"value"</span><span class="token punctuation">;</span></mark></code></pre>`
  );
});

test("Markdown Render: use prism highlighter, line highlighting with fallback `text` language.", async (t) => {
  let tr = getNewTemplateRender("md");
  let userConfig = new UserConfig();
  userConfig.addPlugin(eleventySyntaxHighlightPlugin);
  await userConfig.applyPlugins();

  let markdownHighlight = userConfig.getMergingConfigObject()
    .markdownHighlighter;

  let mdLib = md();
  mdLib.set({
    highlight: markdownHighlight,
  });
  tr.engine.setLibrary(mdLib);

  let fn = await tr.getCompiledTemplate(`\`\`\` text/0
var key = "value";
\`\`\``);

  t.is(
    (await fn()).trim(),
    `<pre class="language-text"><code class="language-text"><mark class="highlight-line highlight-line-active">var key = "value";</mark></code></pre>`
  );
});

test("Markdown Render: use Markdown inside of a Liquid shortcode (Issue #536)", async (t) => {
  let tr = getNewTemplateRender("md");

  let cls = require("../src/Engines/Liquid");
  let liquidEngine = new cls("liquid", tr.getIncludesDir(), templateConfig);
  liquidEngine.addShortcode("testShortcode", function () {
    return "## My Other Title";
  });
  tr.setMarkdownEngine(liquidEngine);

  let fn = await tr.getCompiledTemplate(`# {{title}}
{% testShortcode %}`);
  t.is(
    (
      await fn({
        title: "My Title",
        otherTitle: "My Other Title",
      })
    ).trim(),
    `<h1>My Title</h1>
<h2>My Other Title</h2>`
  );
});

test("Markdown Render: use Markdown inside of a Nunjucks shortcode (Issue #536)", async (t) => {
  let tr = getNewTemplateRender("md");

  let cls = require("../src/Engines/Nunjucks");
  let nunjucksEngine = new cls("njk", tr.getIncludesDir(), templateConfig);
  nunjucksEngine.addShortcode("testShortcode", function () {
    return "## My Other Title";
  });
  tr.setMarkdownEngine(nunjucksEngine);

  let fn = await tr.getCompiledTemplate(`# {{title}}
{% testShortcode %}`);
  t.is(
    (
      await fn({
        title: "My Title",
        otherTitle: "My Other Title",
      })
    ).trim(),
    `<h1>My Title</h1>
<h2>My Other Title</h2>`
  );
});

test("Markdown Render: use Markdown inside of a Liquid paired shortcode (Issue #536)", async (t) => {
  let tr = getNewTemplateRender("md");

  let cls = require("../src/Engines/Liquid");
  let liquidEngine = new cls("liquid", tr.getIncludesDir(), templateConfig);
  liquidEngine.addPairedShortcode("testShortcode", function (content) {
    return content;
  });
  tr.setMarkdownEngine(liquidEngine);

  let fn = await tr.getCompiledTemplate(`# {{title}}
{% testShortcode %}## My Other Title{% endtestShortcode %}`);
  t.is(
    (
      await fn({
        title: "My Title",
        otherTitle: "My Other Title",
      })
    ).trim(),
    `<h1>My Title</h1>
<h2>My Other Title</h2>`
  );
});

test("Markdown Render: use Markdown inside of a Nunjucks paired shortcode (Issue #536)", async (t) => {
  let tr = getNewTemplateRender("md");

  let cls = require("../src/Engines/Nunjucks");
  let nunjucksEngine = new cls("njk", tr.getIncludesDir(), templateConfig);
  nunjucksEngine.addPairedShortcode("testShortcode", function (content) {
    return content;
  });
  tr.setMarkdownEngine(nunjucksEngine);

  let fn = await tr.getCompiledTemplate(`# {{title}}
{% testShortcode %}## My Other Title{% endtestShortcode %}`);
  t.is(
    (
      await fn({
        title: "My Title",
        otherTitle: "My Other Title",
      })
    ).trim(),
    `<h1>My Title</h1>
<h2>My Other Title</h2>`
  );
});
