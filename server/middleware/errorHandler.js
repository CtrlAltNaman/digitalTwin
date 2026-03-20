const errorHandler = (err, req, res, next) => {
  console.error(`Error: ${err.message}`);

  // Multer file size error
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      success: false,
      error: "File size exceeds 10 MB limit",
    });
  }

  // Multer file type error
  if (err.message && err.message.includes("Only")) {
    return res.status(400).json({
      success: false,
      error: err.message,
    });
  }

  res.status(500).json({
    success: false,
    error: "Internal server error",
  });
};

module.exports = errorHandler;
