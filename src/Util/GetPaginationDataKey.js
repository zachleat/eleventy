const lodashIsFunction = require("lodash/isFunction");

module.exports = function (data) {
  return lodashIsFunction(data.pagination.data)
    ? data.pagination.data(data)
    : data.pagination.data;
};
