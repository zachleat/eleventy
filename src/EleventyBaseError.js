/**
 * This class serves as basis for all Eleventy-specific errors.
 */
class EleventyBaseError extends Error {
  /**
   * @param {string} message - The error message to display.
   * @param {Error} originalError - The original error catched.
   */
  constructor(message, originalError) {
    super(message);

    /** @type {string} - The error message to display. */
    this.name = this.constructor.name;

    Error.captureStackTrace(this, this.constructor);

    if (originalError) {
      /** @type {Error} - The original error catched. */
      this.originalError = originalError;
    }
  }
}
module.exports = EleventyBaseError;
