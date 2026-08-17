module.exports = {
  secret: process.env.JWT_SECRET || "pharma-jwt-secret-key-2024",
  jwtExpiry: parseInt(process.env.JWT_EXPIRY, 10) || 86400
};