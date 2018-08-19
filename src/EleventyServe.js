const fs = require("fs-extra");

const TemplatePath = require("./TemplatePath");
const config = require("./Config");
const debug = require("debug")("EleventyServe");

class EleventyServe {
  constructor() {
    this.updateConfig();
  }

  updateConfig() {
    this.config = config.getConfig();
  }

  setOutputDir(outputDir) {
    this.outputDir = outputDir;
  }

  getPathPrefix() {
    return this.config.pathPrefix;
  }

  getRedirectDir(dirName) {
    return TemplatePath.normalize(this.outputDir, dirName);
  }

  getRedirectFilename(dirName) {
    return TemplatePath.normalize(this.getRedirectDir(dirName), "index.html");
  }

  cleanupRedirect(dirName) {
    if (dirName && dirName !== "/") {
      let savedPathFilename = this.getRedirectFilename(dirName);

      setTimeout(function() {
        if (!fs.existsSync(savedPathFilename)) {
          debug(`Cleanup redirect: Could not find ${savedPathFilename}`);
          return;
        }

        let savedPathContent = fs.readFileSync(savedPathFilename, "utf-8");
        if (
          savedPathContent.indexOf("Browsersync pathPrefix Redirect") === -1
        ) {
          debug(
            `Cleanup redirect: Found ${savedPathFilename} but it wasn’t an eleventy redirect.`
          );
          return;
        }

        fs.unlink(savedPathFilename, err => {
          if (!err) {
            debug(`Cleanup redirect: Deleted ${savedPathFilename}`);
          }
        });
      }, 2000);
    }
  }

  serveRedirect(dirName) {
    fs.outputFile(
      this.getRedirectFilename(dirName),
      `<!doctype html>
  <meta http-equiv="refresh" content="0; url=${this.config.pathPrefix}">
  <title>Browsersync pathPrefix Redirect</title>
  <a href="${this.config.pathPrefix}">Go to ${this.config.pathPrefix}</a>`
    );
  }

  serve(port) {
    // only load on serve—this is pretty expensive
    const browserSync = require("browser-sync");
    this.server = browserSync.create();

    let pathPrefix = this.getPathPrefix();

    if (this.savedPathPrefix && pathPrefix !== this.savedPathPrefix) {
      let redirectFilename = this.getRedirectFilename(this.savedPathPrefix);
      if (!fs.existsSync(redirectFilename)) {
        debug(
          `Redirecting BrowserSync from ${
            this.savedPathPrefix
          } to ${pathPrefix}`
        );
        this.serveRedirect(this.savedPathPrefix);
      } else {
        debug(
          `Config updated with a new pathPrefix. Tried to set up a transparent redirect but found a template already existing at ${redirectFilename}. You’ll have to navigate manually.`
        );
      }
    }

    // TODO customize this in Configuration API?
    let serverConfig = {
      baseDir: this.outputDir
    };

    // has a pathPrefix, add a /index.html template to redirect to /pathPrefix/
    if (pathPrefix !== "/") {
      let redirectDirName = "_eleventy_redirect";
      this.serveRedirect(redirectDirName);
      serverConfig.baseDir = this.getRedirectDir(redirectDirName);
      serverConfig.routes = {};
      serverConfig.routes[pathPrefix] = this.outputDir;

      // if has a savedPathPrefix, use the /savedPathPrefix/index.html template to redirect to /pathPrefix/
      if (this.savedPathPrefix) {
        serverConfig.routes[this.savedPathPrefix] = TemplatePath.normalize(
          this.outputDir,
          this.savedPathPrefix
        );
      }
    }

    this.cleanupRedirect(this.savedPathPrefix);
    this.savedPathPrefix = pathPrefix;

    this.server.init({
      server: serverConfig,
      port: port || 8080,
      ignore: ["node_modules"],
      watch: false,
      open: false,
      notify: false,
      index: "index.html"
    });

    process.on(
      "SIGINT",
      function() {
        this.server.exit();
        process.exit();
      }.bind(this)
    );
  }

  reload(path, isInclude) {
    if (this.server) {
      if (this.getPathPrefix() !== this.savedPathPrefix) {
        this.server.exit();
        this.serve();
      } else {
        // Is a CSS input file and is not in the includes folder
        // TODO check output path file extension of this template (not input path)
        if (path && path.split(".").pop() === "css" && !isInclude) {
          this.server.reload("*.css");
        } else {
          this.server.reload();
        }
      }
    }
  }
}

module.exports = EleventyServe;
