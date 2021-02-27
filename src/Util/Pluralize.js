module.exports = function (count, singleWord, pluralWord) {
  return count === 1 ? singleWord : pluralWord;
};
