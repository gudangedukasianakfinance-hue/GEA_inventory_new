// Netlify Function - API Gateway
// Handles all /api/* requests

export default async function handler(event, context) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  try {
    // Dynamic import for ES modules
    const { default: apiRouter } = await import('../api/index.js');

    // Create mock request object
    const mockReq = {
      method: event.httpMethod,
      url: event.path,
      path: event.path,
      query: {
        ...event.queryStringParameters,
        route: event.path.replace('/api/', '').replace(/^\/+/, '')
      },
      params: [],
      body: event.body ? JSON.parse(event.body) : {},
      headers: event.headers || {}
    };

    // Create mock response object
    let responseBody = '';
    const mockRes = {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      json: function(data) {
        responseBody = JSON.stringify(data);
        return this;
      },
      setHeader: function(name, value) {
        this.headers[name] = value;
        return this;
      }
    };

    // Call the API router
    await apiRouter(mockReq, mockRes);

    return {
      statusCode: mockRes.statusCode,
      headers: mockRes.headers,
      body: responseBody
    };

  } catch (error) {
    console.error('API Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({ error: error.message })
    };
  }
}
