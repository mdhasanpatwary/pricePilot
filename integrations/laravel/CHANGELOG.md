# Changelog

All notable changes to the PricePilot Laravel Client will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-01-15

### Added
- Initial release of PricePilot Laravel integration package
- Automatic service provider registration via Laravel package discovery
- `pricepilot:install` artisan command for easy setup
- Secure token-based authentication middleware
- Product sync endpoint (`GET /api/pricepilot/sync`)
- Price update endpoint (`POST /api/pricepilot/update`)
- Health check endpoint (`GET /api/pricepilot/health`)
- Comprehensive configuration file with customizable options:
  - Custom table names
  - Column mapping for flexible database schemas
  - Active product filtering
  - Logging toggle
  - Event firing toggle
- Detailed error handling and validation
- Laravel event support for price updates
- Comprehensive logging for debugging
- Pagination support for large product catalogs
- Full documentation and quick start guide

### Security
- Token-based authentication for all API endpoints
- Request logging for security monitoring
- Environment-based configuration (no hardcoded secrets)

### Documentation
- Complete README with installation and usage instructions
- Quick start guide for rapid setup
- Example .env file with all configuration options
- Troubleshooting guide
- API reference documentation

## [Unreleased]

### Planned Features
- Eloquent model support (optional alternative to Query Builder)
- Webhook support for real-time price change notifications
- Batch price update endpoint
- Product filtering by category/brand
- Custom validation rules
- Rate limiting configuration
- Multi-language support
- GraphQL endpoint (optional)

---

[1.0.0]: https://github.com/pricepilot/laravel-client/releases/tag/v1.0.0
