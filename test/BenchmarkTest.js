import test from "ava";
import Benchmark from "../src/Benchmark";

function between(t, value, lowerBound, upperBound) {
  t.truthy(value >= lowerBound);
  t.truthy(value <= upperBound);
}

test.cb("Standard Benchmark", t => {
  let b = new Benchmark();
  b.before();
  setTimeout(function() {
    b.after();
    t.truthy(b.getTotal() >= 10);
    t.end();
  }, 10);
});

test.cb(
  "Nested Benchmark (nested calls are ignored while a parent is measuring)",
  t => {
    let b = new Benchmark();
    b.before();

    setTimeout(function() {
      b.before();
      b.after();
      t.is(b.getTotal(), 0);

      b.after();
      t.truthy(b.getTotal() >= 10);
      t.end();
    }, 10);
  }
);

test.cb("Reset Benchmark", t => {
  let b = new Benchmark();
  b.before();
  b.reset();

  setTimeout(function() {
    b.before();
    b.after();
    t.is(b.getTotal(), 0);

    t.throws(function() {
      // throws because we reset
      b.after();
    });
    t.end();
  }, 10);
});
