/**
 * Standardized API Response formatting helper
 */
export class ApiResponse {
  /**
   * Send a successful response
   * @param {import('express').Response} res
   * @param {Object} [data={}] - Response payload
   * @param {string} [message="Success"] - Optional message
   * @param {number} [statusCode=200] - HTTP status code
   */
  static success(res, data = {}, message = "Success", statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      statusCode,
      data,
    });
  }

  /**
   * Send an error response
   * @param {import('express').Response} res
   * @param {string} message - Error message
   * @param {number} [statusCode=500] - HTTP status code
   * @param {Array|Object} [details=null] - Extra diagnostic or validation details
   */
  static error(res, message = "Internal Server Error", statusCode = 500, details = null) {
    const payload = {
      success: false,
      error: message,
      statusCode,
    };

    if (details) {
      payload.details = details;
    }

    return res.status(statusCode).json(payload);
  }
}

