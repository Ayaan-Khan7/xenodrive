/**
 * Validator for health check endpoint query parameters
 */
export const validateHealthQuery = (req) => {
  const errors = [];
  const { verbose } = req.query;

  if (verbose !== undefined && verbose !== "true" && verbose !== "false" && verbose !== "1" && verbose !== "0") {
    errors.push({
      field: "verbose",
      message: "The 'verbose' query parameter must be a boolean ('true' or 'false').",
    });
  }

  return errors.length > 0 ? errors : null;
};

