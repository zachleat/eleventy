const capitalize = require("./Capitalize");

class Sortable {
  constructor() {
    this.sortAscending = true;
    this.sortNumeric = false;
    this.items = [];

    this.sortFunctionStringMap = {
      "A-Z": "Ascending",
      "Z-A": "Descending",
      "0-9": "NumericAscending",
      "9-0": "NumericDescending"
    };
  }

  get length() {
    return this.items.length;
  }

  add(item) {
    this.items.push(item);
  }

  sort(sortFunction) {
    if (!sortFunction) {
      sortFunction = this.getSortFunction();
    } else if (typeof sortFunction === "string") {
      if (sortFunction in this.sortFunctionStringMap) {
        sortFunction = this.sortFunctionStringMap[sortFunction];
      }

      sortFunction = Sortable["sortFunction" + capitalize(sortFunction)];
    }

    return this.items.filter(() => true).sort(sortFunction);
  }

  sortAscending() {
    return this.sort(this.getSortFunctionAscending);
  }

  sortDescending() {
    return this.sort(this.getSortFunctionDescending);
  }

  isSortAscending() {
    return this.sortAscending;
  }

  isSortNumeric() {
    return this.sortNumeric;
  }

  setSortDescending() {
    this.sortAscending = false;
  }

  setSortAscending(isAscending) {
    this.sortAscending = isAscending;
  }

  setSortNumeric(isNumeric) {
    this.sortNumeric = isNumeric;
  }

  /* Sort functions */
  static sortFunctionNumericAscending(a, b) {
    return a - b;
  }

  static sortFunctionNumericDescending(a, b) {
    return b - a;
  }

  static sortFunctionAscending(a, b) {
    if (a > b) {
      return 1;
    } else if (a < b) {
      return -1;
    }
    return 0;
  }

  static sortFunctionDescending(a, b) {
    return Sortable.sortFunctionAscending(b, a);
  }

  static sortFunctionAlphabeticAscending(a, b) {
    return Sortable.sortFunctionAscending(a, b);
  }

  static sortFunctionAlphabeticDescending(a, b) {
    return Sortable.sortFunctionAscending(b, a);
  }

  static sortFunctionDate(mapA, mapB) {
    return Sortable.sortFunctionNumericAscending(
      mapA.date.getTime(),
      mapB.date.getTime()
    );
  }

  static sortFunctionDateInputPath(mapA, mapB) {
    let sortDate = Sortable.sortFunctionNumericAscending(
      mapA.date.getTime(),
      mapB.date.getTime()
    );
    if (sortDate === 0) {
      return Sortable.sortFunctionAlphabeticAscending(
        mapA.inputPath,
        mapB.inputPath
      );
    }
    return sortDate;
  }
  /* End sort functions */

  getSortFunction() {
    if (this.sortAscending) {
      return this.getSortFunctionAscending();
    } else {
      return this.getSortFunctionDescending();
    }
  }

  getSortFunctionAscending() {
    if (this.sortNumeric) {
      return Sortable.sortFunctionNumericAscending;
    } else {
      return Sortable.sortFunctionAlphabeticAscending;
    }
  }

  getSortFunctionDescending() {
    if (this.sortNumeric) {
      return Sortable.sortFunctionNumericDescending;
    } else {
      return Sortable.sortFunctionAlphabeticDescending;
    }
  }
}

module.exports = Sortable;
