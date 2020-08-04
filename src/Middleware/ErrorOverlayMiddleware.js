const ErrorStackParser = require("error-stack-parser");
const debug = require("debug")("Eleventy:ErrorOverlayMiddleware");

/**
 * A browser-sync middleware that pipes build errors to a browser view regardless of the requested
 * path.
 *
 * @param {() => Error | null} getError a callback evaluated on every request that should return an
 *  error to be shown (if any). Returning `null` bypasses the middleware.
 *
 * @returns {Function} the middleware
 */
module.exports = function ErrorOverlayMiddleware(getError) {
  return function(_req, res, next) {
    const error = getError();

    if (!error) {
      next();
      return;
    }

    debug("Showing error", error);
    const stacktrace = ErrorStackParser.parse(error).map(item => ({
      ...item,
      fileName: item.fileName
        .replace(process.cwd(), ".")
        .replace(process.env.HOME, "~")
    }));

    res.status = 500;
    res.setHeader("content-type", "text/html");
    res.end(
      template({
        errorName: error.name,
        errorMessage: error.message,
        stacktrace
      })
    );
  };
};

const template = ({ errorName, errorMessage, stacktrace }) => `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${errorName}: ${errorMessage}</title>

    <style>
      :root {
        --foreground: 0, 0, 0;
        --background: 255, 255, 255;
      }

      @media (prefers-color-scheme: dark) {
        :root {
          --foreground: 204, 204, 204;
          --background: 34, 34, 34;
        }
      }

      *,
      *:before,
      *:after {
        box-sizing: border-box;
        position: relative;
        margin: 0;
        padding: 0;
      }

      body {
        border-top: 0.5em solid rgb(197, 26, 26);
        font-family: system-ui;
        font-size: 18px;
        background: rgb(var(--background));
        color: rgb(var(--foreground));
      }

      main {
        padding: 4em 2em;
        max-width: 40em;
        margin: 0 auto;
      }

      main > * + * {
        margin-block-start: 2em;
      }

      code {
        font-size: inherit;
        font-family: source-code-pro, monaco, monospace;
      }

      .stacktrace {
        border: 1px solid rgba(var(--foreground), 0.2);
        background: rgba(var(--foreground), 0.05);
        border-radius: 2px;
        list-style: none;
      }

      .stacktrace > * + * {
        border-block-start: 1px solid rgba(var(--foreground), 0.2);
      }

      .stacktrace li {
        padding: 0.5em;
        overflow-y: auto;
      }

      .stacktrace li > * + * {
        margin-block-start: 0.3em;
      }

      .stacktrace .source {
        font-size: 0.8em;
        color: rgba(var(--foreground), 0.6);
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${errorName}</h1>
      <p>${errorMessage}</p>

      <ul class="stacktrace">
        ${stacktrace
          .map(
            ({ fileName, functionName, lineNumber }) => `
          <li>
            <p>
              in <code>${functionName}</code>
            </p>
            <p class="source">
              <code>${fileName}:${lineNumber}</code>
            </p>
          </li>
        `
          )
          .join("\n")}
      </ul>
    </main>
  </body>
</html>
`;
