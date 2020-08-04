import test from "ava";
import ErrorOverlayMiddleware from "../src/Middleware/ErrorOverlayMiddleware";

test("Aborts rendering and shows the error when one exists", t => {
  const error = new Error("hey it's me");

  const middleware = ErrorOverlayMiddleware(() => error);

  let headers = {};
  let response = "";
  let continuedRendering = false;

  const res = {
    status: 200,
    setHeader(key, value) {
      headers[key] = value;
    },
    end(body) {
      response = body;
    }
  };

  function next() {
    continuedRendering = true;
  }

  middleware(undefined, res, next);

  t.truthy(response.includes("Error"));
  t.truthy(response.includes("hey it's me"));
  t.is(headers["content-type"], "text/html");
  t.is(res.status, 500);
  t.falsy(continuedRendering);
});

test("Acts as a no-op when there's no error", t => {
  const middleware = ErrorOverlayMiddleware(() => null);

  let headers = {};
  let response = "";
  let continuedRendering = false;

  const res = {
    status: 200,
    setHeader(key, value) {
      headers[key] = value;
    },
    end(body) {
      response = body;
    }
  };

  function next() {
    continuedRendering = true;
  }

  middleware(undefined, res, next);

  t.is(response, "");
  t.truthy(continuedRendering);
});
