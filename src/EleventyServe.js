const fs = require("fs-extra");
const path = require("path");

const TemplatePath = require("./TemplatePath");
const config = require("./Config");
const debug = require("debug")("EleventyServe");

class EleventyServe {
  constructor() {}

  get config() {
    return this.configOverride || config.getConfig();
  }
  set config(config) {
    this.configOverride = config;
  }

  setOutputDir(outputDir) {
    this.outputDir = outputDir;
  }

  getPathPrefix() {
    let cfgPrefix = this.config.pathPrefix;
    if (cfgPrefix) {
      // add leading / (for browsersync), see #1454
      // path.join uses \\ for Windows so we split and rejoin
      return path.join("/", cfgPrefix).split(path.sep).join("/");
    }
    return "/";
  }

  getRedirectDir(dirName) {
    return TemplatePath.join(this.outputDir, dirName);
  }
  getRedirectDirOverride() {
    // has a pathPrefix, add a /index.html template to redirect to /pathPrefix/
    if (this.getPathPrefix() !== "/") {
      return "_eleventy_redirect";
    }
  }

  getRedirectFilename(dirName) {
    return TemplatePath.join(this.getRedirectDir(dirName), "index.html");
  }

  getOptions(port) {
    let pathPrefix = this.getPathPrefix();

    // TODO customize this in Configuration API?
    let serverConfig = {
      baseDir: this.outputDir,
    };

    let redirectDirName = this.getRedirectDirOverride();
    // has a pathPrefix, add a /index.html template to redirect to /pathPrefix/
    if (redirectDirName) {
      serverConfig.baseDir = this.getRedirectDir(redirectDirName);
      serverConfig.routes = {};
      serverConfig.routes[pathPrefix] = this.outputDir;

      // if has a savedPathPrefix, use the /savedPathPrefix/index.html template to redirect to /pathPrefix/
      if (this.savedPathPrefix) {
        serverConfig.routes[this.savedPathPrefix] = TemplatePath.join(
          this.outputDir,
          this.savedPathPrefix
        );
      }
    }

    return Object.assign(
      {
        server: serverConfig,
        port: port || 8080,
        ignore: ["node_modules"],
        watch: false,
        open: false,
        notify: false,
        ui: false, // Default changed in 1.0
        ghostMode: false, // Default changed in 1.0
        index: "index.html",
      },
      this.config.browserSyncConfig
    );
  }

  cleanupRedirect(dirName) {
    if (dirName && dirName !== "/") {
      let savedPathFilename = this.getRedirectFilename(dirName);

      setTimeout(function () {
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
    this.server = browserSync.create("eleventy-server");

    let pathPrefix = this.getPathPrefix();

    if (this.savedPathPrefix && pathPrefix !== this.savedPathPrefix) {
      let redirectFilename = this.getRedirectFilename(this.savedPathPrefix);
      if (!fs.existsSync(redirectFilename)) {
        debug(
          `Redirecting BrowserSync from ${this.savedPathPrefix} to ${pathPrefix}`
        );
        this.serveRedirect(this.savedPathPrefix);
      } else {
        debug(
          `Config updated with a new pathPrefix. Tried to set up a transparent redirect but found a template already existing at ${redirectFilename}. You’ll have to navigate manually.`
        );
      }
    }

    let redirectDirName = this.getRedirectDirOverride();
    // has a pathPrefix, add a /index.html template to redirect to /pathPrefix/
    if (redirectDirName) {
      this.serveRedirect(redirectDirName);
    }

    this.cleanupRedirect(this.savedPathPrefix);

    let options = this.getOptions(port);
    this.server.init(options);

    // this needs to happen after `.getOptions`
    this.savedPathPrefix = pathPrefix;
  }

  close() {
    if (this.server) {
      this.server.exit();
    }
  }

  /* filesToReload is optional */
  reload(filesToReload) {
    if (this.server) {
      if (this.getPathPrefix() !== this.savedPathPrefix) {
        this.server.exit();
        this.serve();
      } else {
        this.server.reload(filesToReload);
      }
    }
  }
}

module.exports = EleventyServe;
