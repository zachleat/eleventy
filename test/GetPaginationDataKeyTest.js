const test = require("ava");
const getPaginationDataKey = require("../src/Util/GetPaginationDataKey");

test("getPaginationDataKey when key is string", (t) => {
  t.is(getPaginationDataKey({pagination: {data: "foo"}}), "foo");
});

test("getPaginationDataKey when key is function", (t) => {
  t.is(
    getPaginationDataKey({foo: "bar", pagination: {data: (data) => data.foo}}),
    "bar"
  );
});
