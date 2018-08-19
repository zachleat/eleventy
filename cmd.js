#!/usr/bin/env node
const pkg = require("./package.json");
const chalk = require("chalk"); // node 4+
require("please-upgrade-node")(pkg, {
  message: function(requiredVersion) {
    return chalk.red(
      `Eleventy requires Node ${requiredVersion}. You’ll need to upgrade to use it!`
    );
  }
});

if (process.env.DEBUG) {
  require("time-require");
}

const argv = require("minimist")(process.argv.slice(2));
const Eleventy = require("./src/Eleventy");
const EleventyCommandCheck = require("./src/EleventyCommandCheck");

try {
  let cmdCheck = new EleventyCommandCheck(argv);
  cmdCheck.hasUnknownArguments();
} catch (e) {
  console.log(chalk.red("Eleventy error:"), chalk.red(e.toString()));
  process.exitCode = 1;
  return;
}

try {
  let elev = new Eleventy(argv.input, argv.output);
  elev.setConfigPath(argv.config);
  elev.setPathPrefix(argv.pathprefix);
  elev.setDryRun(argv.dryrun);
  elev.setPassthroughAll(argv.passthroughall);
  elev.setFormats(argv.formats);

  let isVerbose = process.env.DEBUG ? false : !argv.quiet;
  elev.setIsVerbose(isVerbose);

  elev.init().then(function() {
    if (argv.version) {
      console.log(elev.getVersion());
    } else if (argv.help) {
      console.log(elev.getHelp());
    } else if (argv.serve) {
      elev.watch().then(function() {
        elev.serve(argv.port);
      });
    } else if (argv.watch) {
      elev.watch();
    } else {
      elev.write();
    }
  });
} catch (e) {
  console.log(chalk.red("Eleventy error:"), e);
  process.exitCode = 1;
}
