const EventEmitter = require("events");
const chalk = require("chalk");
const EleventyErrorUtil = require("./EleventyErrorUtil");
const debug = require("debug")("Eleventy:EleventyErrorHandler");

class EleventyErrorHandler {
  static get isChalkEnabled() {
    if (this._isChalkEnabled !== undefined) {
      return this._isChalkEnabled;
    }
    return true;
  }

  static set isChalkEnabled(enabled) {
    this._isChalkEnabled = !!enabled;
  }

  static warn(e, msg) {
    if (msg) {
      EleventyErrorHandler.initialMessage(msg, "warn", "yellow");
    }
    EleventyErrorHandler.log(e, "warn");
  }

  static fatal(e, msg) {
    EleventyErrorHandler.error(e, msg);
    process.exitCode = 1;
  }

  static error(e, msg) {
    EleventyErrorHandler.events.emit("errorLogged", e);

    if (msg) {
      EleventyErrorHandler.initialMessage(msg, "error", "red");
    }
    EleventyErrorHandler.log(e, "error");
  }

  //https://nodejs.org/api/process.html
  static log(e, type = "log", prefix = ">") {
    let ref = e;
    while (ref) {
      let nextRef = ref.originalError;
      if (!nextRef && EleventyErrorUtil.hasEmbeddedError(ref.message)) {
        nextRef = EleventyErrorUtil.deconvertErrorToObject(ref);
      }

      EleventyErrorHandler.message(
        (process.env.DEBUG ? "" : `${prefix} `) +
          `${(
            EleventyErrorUtil.cleanMessage(ref.message) ||
            "(No error message provided)"
          ).trim()}

\`${ref.name}\` was thrown${!nextRef && ref.stack ? ":" : ""}`,
        type
      );

      if (process.env.DEBUG) {
        debug(`(${type} stack): ${ref.stack}`);
      } else if (!nextRef) {
        // last error in the loop
        let prefix = "    ";

        // remove duplicate error messages if the stack contains the original message output above
        let stackStr = ref.stack || "";
        if (e.removeDuplicateErrorStringFromOutput) {
          stackStr = stackStr.replace(
            `${ref.name}: ${ref.message}`,
            "(Repeated output has been truncated…)"
          );
        }
        EleventyErrorHandler.message(
          prefix + stackStr.split("\n").join("\n" + prefix)
        );
      }
      ref = nextRef;
    }
  }

  static initialMessage(message, type = "log", chalkColor = "blue") {
    if (message) {
      EleventyErrorHandler.message(
        message + ":" + (process.env.DEBUG ? "" : " (more in DEBUG output)"),
        type,
        chalkColor
      );
    }
  }

  static message(message, type = "log", chalkColor) {
    if (process.env.DEBUG) {
      debug(message);
    } else {
      let logger = EleventyErrorHandler.logger || console;
      if (chalkColor && EleventyErrorHandler.isChalkEnabled) {
        logger[type](chalk[chalkColor](message));
      } else {
        logger[type](message);
      }
    }
  }
}

EleventyErrorHandler.events = new EventEmitter();

module.exports = EleventyErrorHandler;
