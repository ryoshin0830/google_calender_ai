const API_KEYS = process.env.API_KEYS ? process.env.API_KEYS.split(',') : [];

function validateApiKey(req, res, next) {
  console.log('Available API Keys:', API_KEYS);
  console.log('Received API Key:', req.headers['x-api-key']);

  if (!process.env.API_KEYS || API_KEYS.length === 0) {
    console.log('API_KEYS environment variable is not configured');
    return res.status(500).json({
      success: false,
      error: {
        code: 'API_KEYS_NOT_CONFIGURED',
        message: 'API keys are not configured on the server. Please configure API_KEYS in the environment variables.'
      }
    });
  }

  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'MISSING_API_KEY',
        message: 'API key is required. Please include X-API-Key in the request headers.'
      }
    });
  }

  if (!API_KEYS.includes(apiKey)) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'INVALID_API_KEY',
        message: 'The provided API key is invalid or has been revoked.'
      }
    });
  }

  next();
}

module.exports = validateApiKey; 