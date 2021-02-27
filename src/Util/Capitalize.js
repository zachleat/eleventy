module.exports = function (str, options) {
  options = Object.assign(
    {
      lowercaseRestOfWord: false,
    },
    options
  );

  return str
    .split(" ")
    .map(function (word) {
      return (
        word.substr(0, 1).toUpperCase() +
        (options.lowercaseRestOfWord
          ? word.substr(1).toLowerCase()
          : word.substr(1))
      );
    })
    .join(" ");
};
