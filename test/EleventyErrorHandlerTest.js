import test from "ava";
import EleventyErrorHandler from "../src/EleventyErrorHandler";

let output = [];

test.beforeEach(t => {
  output = [];

  EleventyErrorHandler.isChalkEnabled = false;
  EleventyErrorHandler.logger = {
    log: function(str) {
      output.push(str);
    },
    warn: function(str) {
      output.push(str);
    },
    error: function(str) {
      output.push(str);
    }
  };
});

test.afterEach(t => {
  EleventyErrorHandler.isChalkEnabled = true;
  EleventyErrorHandler.logger = null;
});

test("Disable chalk", t => {
  EleventyErrorHandler.isChalkEnabled = false;
  t.is(EleventyErrorHandler.isChalkEnabled, false);
});

test("Log a warning, error", t => {
  EleventyErrorHandler.warn(new Error("Test warning"), "Hello");

  let expected = `Hello: (more in DEBUG output)
> Test warning

\`Error\` was thrown:
    Error: Test warning`;
  t.is(output.join("\n").substr(0, expected.length), expected);

  // normally this would be multiple tests but we do this garbage because
  // tests run async and it doesn’t work with the static methods in
  // EleventyErrorHandler
  output = [];

  EleventyErrorHandler.error(new Error("Test error"), "It’s me");

  expected = `It’s me: (more in DEBUG output)
> Test error

\`Error\` was thrown:
    Error: Test error`;
  t.is(output.join("\n").substr(0, expected.length), expected);
});

test.cb("Events", t => {
  const testError = new Error();

  EleventyErrorHandler.events.on("errorLogged", function(error) {
    t.is(error, testError);
    t.end();
  });

  EleventyErrorHandler.error(testError);
});
