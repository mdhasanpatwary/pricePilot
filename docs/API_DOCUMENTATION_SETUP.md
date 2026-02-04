# API Documentation Setup

## Overview

Interactive API documentation is now available using Swagger UI, providing a user-friendly interface to explore and test all PricePilot API endpoints.

## Access Points

### Production
- **URL**: `https://yourdomain.com/api/docs`
- **Direct HTML**: `https://yourdomain.com/api-docs.html`

### Development
- **URL**: `http://localhost:3000/api/docs`
- **Direct HTML**: `http://localhost:3000/api-docs.html`

## Features

### Interactive Testing
- **Try It Out**: Test API endpoints directly from the browser
- **Authentication**: Configure API keys and test authenticated requests
- **Request/Response Examples**: View example requests and responses for each endpoint
- **Schema Validation**: See request/response schemas with validation rules

### Documentation Features
- **Search**: Filter endpoints by name or tag
- **Expandable Sections**: Collapse/expand endpoint groups for easy navigation
- **Model Schemas**: View detailed data models and their properties
- **Error Codes**: See all possible error responses for each endpoint
- **Authentication Guide**: Built-in authentication examples

### User Experience
- **Clean Interface**: Professional, easy-to-read design
- **Syntax Highlighting**: Color-coded JSON examples
- **Persistent Authorization**: API keys are saved in browser session
- **Request Duration**: See how long each request takes
- **Deep Linking**: Share direct links to specific endpoints

## File Structure

```
public/
├── api-docs.html          # Swagger UI HTML page
└── openapi.json           # OpenAPI 3.0 specification

app/
└── api/
    └── docs/
        └── page.tsx       # Next.js route for /api/docs
```

## OpenAPI Specification

The API documentation is generated from the OpenAPI 3.0 specification located at:
- **File**: `public/openapi.json`
- **Accessible at**: `/openapi.json`

### Specification Features
- Complete endpoint definitions
- Request/response schemas
- Authentication methods
- Error code documentation
- Example requests and responses
- Data model definitions

## Authentication in Swagger UI

### Using API Key Authentication

1. Click the **"Authorize"** button at the top of the page
2. Enter your API key in the `x-api-key` field
3. Click **"Authorize"**
4. Click **"Close"**

Your API key will be automatically included in all subsequent requests.

### Generating API Keys

API keys can be generated from your dashboard:
1. Navigate to **Settings > API Keys**
2. Click **"Generate New Key"**
3. Copy the key (it will only be shown once)
4. Use the key in the Swagger UI authorization

## Testing Endpoints

### Step-by-Step Guide

1. **Navigate to an endpoint** (e.g., GET /products)
2. Click **"Try it out"** button
3. **Fill in parameters** (query params, request body, etc.)
4. Click **"Execute"**
5. **View the response** below (status code, headers, body)

### Example: Testing GET /products

```bash
# 1. Authorize with your API key
# 2. Navigate to "Products" section
# 3. Click on "GET /products"
# 4. Click "Try it out"
# 5. Set parameters:
#    - page: 1
#    - limit: 20
#    - q: laptop
# 6. Click "Execute"
# 7. View response with product list
```

## Customization

### Styling

The Swagger UI is styled with custom CSS in `public/api-docs.html`:
- Custom header with branding
- Color-coded HTTP methods
- Improved readability
- Professional appearance

### Configuration

Swagger UI configuration options in `api-docs.html`:
```javascript
{
  deepLinking: true,              // Enable deep linking
  docExpansion: "list",           // Show endpoints collapsed
  filter: true,                   // Enable search filter
  tryItOutEnabled: true,          // Enable "Try it out" by default
  persistAuthorization: true,     // Remember API keys
  displayRequestDuration: true,   // Show request timing
  syntaxHighlight: {
    activate: true,
    theme: "monokai"
  }
}
```

## Updating Documentation

### Modifying the OpenAPI Spec

1. Edit `public/openapi.json`
2. Add/modify endpoints, schemas, or examples
3. Validate the spec using [Swagger Editor](https://editor.swagger.io/)
4. Refresh the documentation page

### Adding New Endpoints

```json
{
  "paths": {
    "/your-new-endpoint": {
      "get": {
        "tags": ["Your Tag"],
        "summary": "Endpoint summary",
        "description": "Detailed description",
        "parameters": [...],
        "responses": {...}
      }
    }
  }
}
```

### Adding New Schemas

```json
{
  "components": {
    "schemas": {
      "YourNewModel": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "description": "Unique identifier"
          }
        }
      }
    }
  }
}
```

## Troubleshooting

### Documentation Not Loading

**Problem**: Swagger UI shows blank page or loading error

**Solutions**:
1. Check browser console for errors
2. Verify `openapi.json` is accessible at `/openapi.json`
3. Validate OpenAPI spec syntax
4. Clear browser cache and reload

### API Requests Failing

**Problem**: "Try it out" requests return 401 Unauthorized

**Solutions**:
1. Verify API key is entered correctly in Authorization
2. Check API key is active in dashboard
3. Ensure API key has correct permissions
4. Check rate limits haven't been exceeded

### CORS Errors

**Problem**: Requests blocked by CORS policy

**Solutions**:
1. Ensure CORS is configured in `next.config.ts`
2. Add your domain to allowed origins
3. Check API endpoint CORS headers

### Endpoints Not Showing

**Problem**: Some endpoints missing from documentation

**Solutions**:
1. Verify endpoints are defined in `openapi.json`
2. Check JSON syntax is valid
3. Ensure endpoints have required fields (summary, responses)
4. Refresh the page

## Best Practices

### For API Consumers

1. **Read the description** before testing endpoints
2. **Check required parameters** and their formats
3. **Review example requests** for proper structure
4. **Test with valid data** to avoid validation errors
5. **Check rate limits** before bulk testing

### For API Maintainers

1. **Keep OpenAPI spec up to date** with code changes
2. **Add detailed descriptions** for all endpoints
3. **Include example requests/responses** for clarity
4. **Document all error codes** and their meanings
5. **Update version numbers** when making breaking changes

## Integration with CI/CD

### Automated Validation

Add OpenAPI spec validation to your CI pipeline:

```bash
# Install validator
npm install -g @apidevtools/swagger-cli

# Validate spec
swagger-cli validate public/openapi.json
```

### Automated Deployment

The documentation is automatically deployed with your Next.js application:
1. Build process includes static files
2. `public/` directory is served automatically
3. No additional deployment steps needed

## Security Considerations

### API Key Protection

- **Never commit API keys** to version control
- **Use environment variables** for sensitive data
- **Rotate keys regularly** for security
- **Limit key permissions** to minimum required

### Rate Limiting

- Documentation respects rate limits
- Excessive testing may trigger rate limiting
- Use test environment for extensive testing

### HTTPS Only

- Always use HTTPS in production
- API keys transmitted over secure connection
- Swagger UI enforces secure protocols

## Additional Resources

### External Links

- [OpenAPI Specification](https://swagger.io/specification/)
- [Swagger UI Documentation](https://swagger.io/tools/swagger-ui/)
- [Swagger Editor](https://editor.swagger.io/)
- [OpenAPI Generator](https://openapi-generator.tech/)

### Internal Documentation

- [API Authentication Guide](./AUTHENTICATION_GUIDE.md)
- [API Error Codes](./API_ERROR_CODES.md)
- [API Usage Examples](./API_USAGE_EXAMPLES.md)
- [Rate Limiting Guide](./RATE_LIMITING.md)

## Support

For issues with API documentation:
- **Email**: support@pricepilot.com
- **GitHub**: [Report an issue](https://github.com/pricepilot/issues)
- **Documentation**: [View guides](https://pricepilot.com/docs)

---

**Last Updated**: January 2026  
**Version**: 1.0.0  
**Status**: Active
