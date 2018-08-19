class Benchmark {
  constructor() {
    this.reset();
  }

  reset() {
    this.timeSpent = 0;
    this.beforeDates = [];
  }

  before() {
    this.beforeDates.push(new Date());
  }

  after() {
    if (!this.beforeDates.length) {
      throw new Error("You called Benchmark after() without a before().");
    }

    let before = this.beforeDates.pop();
    if (!this.beforeDates.length) {
      this.timeSpent += new Date().getTime() - before.getTime();
    }
  }

  getTotal() {
    return this.timeSpent;
  }

  getTotalString() {
    return this.timeSpent > 0 ? ` (${this.timeSpent}ms)` : "";
  }
}

module.exports = Benchmark;
