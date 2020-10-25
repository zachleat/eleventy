const EleventyExtensionMap = require("../src/EleventyExtensionMap");
const Template = require("../src/Template");

module.exports = function getNewTemplate(
  path,
  inputDir,
  outputDir,
  templateData = null,
  map = null,
  templateConfig
) {
  if (!map) {
    map = new EleventyExtensionMap(
      [
        "liquid",
        "ejs",
        "md",
        "hbs",
        "mustache",
        "haml",
        "pug",
        "njk",
        "html",
        "11ty.js",
      ],
      templateConfig
    );
  }
  let tmpl = new Template(
    path,
    inputDir,
    outputDir,
    templateData,
    map,
    templateConfig
  );
  return tmpl;
};
