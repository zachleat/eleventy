const debug = require("debug")("Eleventy:CommandCheck");

class EleventyCommandCheck {
  constructor(argv) {
    this.valueArgs = [
      "input",
      "output",
      "formats",
      "config",
      "pathprefix",
      "port"
    ];

    this.booleanArgs = [
      "quiet",
      "version",
      "watch",
      "dryrun",
      "help",
      "serve",
      "passthroughall"
    ];

    this.args = argv;
    this.argsMap = this.getArgumentLookupMap();

    debug("command: eleventy ", this.toString());
  }

  toString() {
    let cmd = [];

    for (let valueArgName of this.valueArgs) {
      if (this.args[valueArgName]) {
        cmd.push(`--${valueArgName}=${this.args[valueArgName]}`);
      }
    }

    for (let booleanArgName of this.booleanArgs) {
      if (this.args[booleanArgName]) {
        cmd.push(`--${booleanArgName}`);
      }
    }

    return cmd.join(" ");
  }

  getArgumentLookupMap() {
    let obj = {};
    for (let valueArgName of this.valueArgs) {
      obj[valueArgName] = true;
    }
    for (let booleanArgName of this.booleanArgs) {
      obj[booleanArgName] = true;
    }
    return obj;
  }

  isKnownArgument(name) {
    // _ is the default keyless parameter
    if (name === "_") {
      return true;
    }

    return !!this.argsMap[name];
  }

  hasUnknownArguments() {
    for (let argName in this.args) {
      if (!this.isKnownArgument(argName)) {
        throw new Error(
          `Command does not compute! We don’t know what '${argName}' is. Use --help to see the list of supported commands.`
        );
      }
    }
  }
}

module.exports = EleventyCommandCheck;
