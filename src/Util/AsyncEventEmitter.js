const EventEmitter = require("events");

class AsyncEventEmitter extends EventEmitter {
  async emit(type, ...args) {
    let listeners = this.listeners(type);
    if (!listeners.length) {
      return;
    }

    return await Promise.all(listeners.map(h => h.apply(this, args)));
  }
}

module.exports = AsyncEventEmitter;
