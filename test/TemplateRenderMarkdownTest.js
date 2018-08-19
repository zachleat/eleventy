import test from "ava";
import TemplateRender from "../src/TemplateRender";
import md from "markdown-it";
import mdEmoji from "markdown-it-emoji";
import UserConfig from "../src/UserConfig";
import eleventySyntaxHighlightPlugin from "@11ty/eleventy-plugin-syntaxhighlight";

// Markdown
test("Markdown", t => {
  t.is(new TemplateRender("md").getEngineName(), "md");
});

test("Markdown Render: Parses base markdown, no data", async t => {
  let fn = await new TemplateRender("md").getCompiledTemplate("# My Title");
  t.is((await fn()).trim(), "<h1>My Title</h1>");
});

test("Markdown Render: Markdown should work with HTML too", async t => {
  let fn = await new TemplateRender("md").getCompiledTemplate(
    "<h1>My Title</h1>"
  );
  t.is((await fn()).trim(), "<h1>My Title</h1>");
});

test("Markdown Render: Parses markdown using liquid engine (default, with data)", async t => {
  let fn = await new TemplateRender("md").getCompiledTemplate("# {{title}}");
  t.is((await fn({ title: "My Title" })).trim(), "<h1>My Title</h1>");
});

test("Markdown Render: Parses markdown using ejs engine", async t => {
  let tr = new TemplateRender("md");
  tr.setMarkdownEngine("ejs");
  let fn = await tr.getCompiledTemplate("<%=title %>");
  t.is((await fn({ title: "My Title" })).trim(), "<p>My Title</p>");
});

test("Markdown Render: Ignore markdown, use only preprocess engine (useful for variable resolution in permalinks)", async t => {
  let tr = new TemplateRender("md");
  tr.setUseMarkdown(false);
  let fn = await tr.getCompiledTemplate("{{title}}");
  t.is((await fn({ title: "My Title" })).trim(), "My Title");
});

test("Markdown Render: Set markdown engine to false, don’t parse", async t => {
  let tr = new TemplateRender("md");
  tr.setMarkdownEngine(false);
  let fn = await tr.getCompiledTemplate("# {{title}}");
  t.is((await fn()).trim(), "<h1>{{title}}</h1>");
});

test("Markdown Render: Set markdown engine to false, don’t parse (test with HTML input)", async t => {
  let tr = new TemplateRender("md");
  tr.setMarkdownEngine(false);
  let fn = await tr.getCompiledTemplate("<h1>{{title}}</h1>");

  t.is((await fn()).trim(), "<h1>{{title}}</h1>");
});

test("Markdown Render: Pass in engine override (ejs)", async t => {
  let tr = new TemplateRender("md");
  tr.setMarkdownEngine("ejs");
  let fn = await tr.getCompiledTemplate("# <%= title %>");
  t.is((await fn({ title: "My Title" })).trim(), "<h1>My Title</h1>");
});

test("Markdown Render: Pass in an override (liquid)", async t => {
  let tr = new TemplateRender("md");
  tr.setMarkdownEngine("liquid");
  let fn = await tr.getCompiledTemplate("# {{title}}");

  t.is((await fn({ title: "My Title" })).trim(), "<h1>My Title</h1>");
});

test("Markdown Render: Strikethrough", async t => {
  let fn = await new TemplateRender("md").getCompiledTemplate("~~No~~");
  t.is((await fn()).trim(), "<p><s>No</s></p>");
});

test("Markdown Render: Strikethrough in a Header", async t => {
  let fn = await new TemplateRender("md").getCompiledTemplate("# ~~No~~");
  t.is((await fn()).trim(), "<h1><s>No</s></h1>");
});

test("Markdown Render: with Library Override", async t => {
  let tr = new TemplateRender("md");

  let mdLib = md();
  tr.engine.setLibrary(mdLib);
  t.is(mdLib.render(":)").trim(), "<p>:)</p>");

  let fn = await tr.getCompiledTemplate(":)");
  t.is((await fn()).trim(), "<p>:)</p>");
});

test("Markdown Render: with Library Override and a Plugin", async t => {
  let tr = new TemplateRender("md");

  let mdLib = md().use(mdEmoji);
  tr.engine.setLibrary(mdLib);
  t.is(mdLib.render(":)").trim(), "<p>😃</p>");

  let fn = await tr.getCompiledTemplate(":)");
  t.is((await fn()).trim(), "<p>😃</p>");
});

test("Markdown Render: use a custom highlighter", async t => {
  let tr = new TemplateRender("md");

  let mdLib = md();
  mdLib.set({
    highlight: function(str, lang) {
      return "This is overrrrrrride";
    }
  });
  tr.engine.setLibrary(mdLib);

  let fn = await tr.getCompiledTemplate(`\`\`\`
This is some code.
\`\`\``);
  t.is((await fn()).trim(), "<pre><code>This is overrrrrrride</code></pre>");
});

test("Markdown Render: use prism highlighter (no language)", async t => {
  let tr = new TemplateRender("md");
  let userConfig = new UserConfig();
  userConfig.addPlugin(eleventySyntaxHighlightPlugin);

  let markdownHighlight = userConfig.getMergingConfigObject()
    .markdownHighlighter;

  let mdLib = md();
  mdLib.set({
    highlight: markdownHighlight
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

test("Markdown Render: use prism highlighter", async t => {
  let tr = new TemplateRender("md");
  let userConfig = new UserConfig();
  userConfig.addPlugin(eleventySyntaxHighlightPlugin);

  let markdownHighlight = userConfig.getMergingConfigObject()
    .markdownHighlighter;

  let mdLib = md();
  mdLib.set({
    highlight: markdownHighlight
  });
  tr.engine.setLibrary(mdLib);

  let fn = await tr.getCompiledTemplate(`\`\`\` js
var key = "value";
\`\`\``);
  t.is(
    (await fn()).trim(),
    `<pre class="language-js"><code class="language-js"><div class="highlight-line"><span class="token keyword">var</span> key <span class="token operator">=</span> <span class="token string">"value"</span><span class="token punctuation">;</span></div></code></pre>`
  );
});

test("Markdown Render: use prism highlighter (no space before language)", async t => {
  let tr = new TemplateRender("md");
  let userConfig = new UserConfig();
  userConfig.addPlugin(eleventySyntaxHighlightPlugin);

  let markdownHighlight = userConfig.getMergingConfigObject()
    .markdownHighlighter;

  let mdLib = md();
  mdLib.set({
    highlight: markdownHighlight
  });
  tr.engine.setLibrary(mdLib);

  let fn = await tr.getCompiledTemplate(`\`\`\`js
var key = "value";
\`\`\``);
  t.is(
    (await fn()).trim(),
    `<pre class="language-js"><code class="language-js"><div class="highlight-line"><span class="token keyword">var</span> key <span class="token operator">=</span> <span class="token string">"value"</span><span class="token punctuation">;</span></div></code></pre>`
  );
});

test("Markdown Render: use prism highlighter, line highlighting", async t => {
  let tr = new TemplateRender("md");
  let userConfig = new UserConfig();
  userConfig.addPlugin(eleventySyntaxHighlightPlugin);

  let markdownHighlight = userConfig.getMergingConfigObject()
    .markdownHighlighter;

  let mdLib = md();
  mdLib.set({
    highlight: markdownHighlight
  });
  tr.engine.setLibrary(mdLib);

  let fn = await tr.getCompiledTemplate(`\`\`\`js/0
var key = "value";
\`\`\``);
  t.is(
    (await fn()).trim(),
    `<pre class="language-js"><code class="language-js"><div class="highlight-line highlight-line-active"><span class="token keyword">var</span> key <span class="token operator">=</span> <span class="token string">"value"</span><span class="token punctuation">;</span></div></code></pre>`
  );
});

test("Markdown Render: use prism highlighter, line highlighting with fallback `text` language.", async t => {
  let tr = new TemplateRender("md");
  let userConfig = new UserConfig();
  userConfig.addPlugin(eleventySyntaxHighlightPlugin);

  let markdownHighlight = userConfig.getMergingConfigObject()
    .markdownHighlighter;

  let mdLib = md();
  mdLib.set({
    highlight: markdownHighlight
  });
  tr.engine.setLibrary(mdLib);

  let fn = await tr.getCompiledTemplate(`\`\`\` text/0
var key = "value";
\`\`\``);
  t.is(
    (await fn()).trim(),
    `<pre class="language-text"><code class="language-text"><div class="highlight-line highlight-line-active">var key = "value";</div></code></pre>`
  );
});
