import test from "ava";
import TemplateRender from "../src/TemplateRender";

// ES6
test("ES6 Template Literal", t => {
  t.is(new TemplateRender("jstl").getEngineName(), "jstl");
});

test("ES6 Template Literal Render", async t => {
  // pass in a string here, we don’t want to compile the template in the test :O
  let fn = await new TemplateRender("jstl").getCompiledTemplate(
    "`<p>${name.toUpperCase()}</p>`"
  );
  t.is(await fn({ name: "Tim" }), "<p>TIM</p>");
});

test("ES6 Template Literal Render", async t => {
  // pass in a string here, we don’t want to compile the template in the test :O
  let fn = await new TemplateRender("jstl").getCompiledTemplate(
    "<p>${name.toUpperCase()}</p>"
  );
  t.is(await fn({ name: "Tim" }), "<p>TIM</p>");
});
