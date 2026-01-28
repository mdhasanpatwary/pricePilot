# OpenCart Plugin - Improvement Tasks

## 🔴 Critical Priority (Security & Stability)

### Security Fixes
- [ ] **Fix SQL Injection Vulnerability**
  - Replace direct DB queries with prepared statements
  - Use `$this->db->escape()` for all user inputs
  - File: `catalog/controller/api/pricepilot.php` (update method)

- [ ] **Add Input Validation**
  - Validate all API inputs (product_id, price, token)
  - Add data type checking
  - Implement request size limits

- [ ] **Add Rate Limiting**
  - Prevent API abuse
  - Implement request throttling (e.g., 100 requests/minute)
  - Add IP-based rate limiting

- [ ] **Token Security Enhancement**
  - Add token regeneration feature in admin panel
  - Add token expiry mechanism
  - Add IP whitelist option

### Error Handling
- [ ] **Implement Proper Error Responses**
  - Add HTTP status codes (200, 400, 401, 404, 500)
  - Return structured error messages
  - Add error logging

- [ ] **Add API Logging**
  - Log all API requests/responses
  - Track failed attempts
  - Store in database table `pricepilot_api_logs`

---

## 🟠 High Priority (Core Functionality)

### API Enhancements
- [ ] **Bulk Price Update Endpoint**
  - New endpoint: `POST /api/pricepilot/bulk-update`
  - Accept array of products: `[{product_id, price}, ...]`
  - Return success/failure count

- [ ] **Product Search/Filter API**
  - Add filters: SKU, category, manufacturer, status
  - Add search by product name
  - Improve pagination (add total count)

- [ ] **Webhook Support**
  - Add webhook configuration in admin
  - Trigger on product create/update/delete
  - Send real-time notifications to PricePilot

- [ ] **Stock Sync API**
  - Add quantity field in product list
  - Add stock update endpoint
  - Handle out-of-stock scenarios

### Admin Panel Improvements
- [ ] **Create Dashboard Tab**
  - Show sync statistics (last sync, total products, updates today)
  - Display recent price changes (last 10)
  - Show API usage stats

- [ ] **Add Activity Log**
  - Create database table `pricepilot_activity_log`
  - Log all price changes with timestamp
  - Show in admin panel with filters

- [ ] **Test Connection Feature**
  - Add "Test API" button in admin
  - Verify token validity
  - Show connection status (success/error)

- [ ] **Token Management**
  - Add "Regenerate Token" button
  - Show token creation date
  - Add copy-to-clipboard confirmation

### Documentation
- [ ] **Create README.md**
  - Installation instructions (manual + OCMOD)
  - Configuration steps with screenshots
  - API endpoint documentation
  - Troubleshooting guide

- [ ] **Create CHANGELOG.md**
  - Version history
  - Breaking changes
  - Migration guides

- [ ] **API Documentation**
  - Endpoint list with examples
  - Request/response formats
  - Error codes reference
  - Authentication guide

---

## 🟡 Medium Priority (Enhanced Features)

### Multi-Store Support
- [ ] **Add Store Selection**
  - Support multiple OpenCart stores
  - Add store_id in API requests
  - Filter products by store

### Product Variants
- [ ] **Handle Product Options**
  - Sync product options/variants
  - Update prices for specific variants
  - Handle option combinations

### Image Sync
- [ ] **Product Image Management**
  - Sync product images to PricePilot
  - Handle multiple images
  - Support image updates

### Category Mapping
- [ ] **Category Sync**
  - Export category tree structure
  - Map categories between systems
  - Update product categories

### Advanced Pricing
- [ ] **Special Price Handling**
  - Sync special/discount prices
  - Handle date-based pricing
  - Support customer group pricing

### Notification System
- [ ] **Admin Notifications**
  - Email alerts on sync failures
  - Dashboard notifications
  - Configurable alert settings

---

## 🟢 Low Priority (Nice to Have)

### Backup & Restore
- [ ] **Price Backup System**
  - Backup prices before bulk update
  - Restore previous prices
  - Export price history

### Advanced Mapping
- [ ] **Product Matching**
  - Map OpenCart products to competitors
  - Store mapping in database
  - Manual override option

### Scheduling
- [ ] **Sync Schedule Settings**
  - Configure auto-sync intervals
  - Set sync time windows
  - Pause/resume sync

### Reporting
- [ ] **Generate Reports**
  - Price change reports
  - Sync success/failure reports
  - Export to CSV/PDF

---

## 🔧 Technical Improvements

### Code Quality
- [ ] **Add Unit Tests**
  - Test API endpoints
  - Test authentication
  - Test data validation

- [ ] **Code Refactoring**
  - Separate business logic from controllers
  - Create service classes
  - Follow OpenCart coding standards

- [ ] **Add Caching**
  - Cache product lists
  - Cache configuration
  - Implement cache invalidation

### Performance
- [ ] **Optimize Database Queries**
  - Add indexes on product_id
  - Optimize product fetch query
  - Use query builder

- [ ] **Add Queue System**
  - Queue bulk updates
  - Process in background
  - Prevent timeout issues

### Compatibility
- [ ] **Version Compatibility**
  - Test with OpenCart 3.x
  - Test with OpenCart 4.x
  - Add version check on install

---

## 📋 Database Schema Changes

### New Tables Needed

```sql
-- API Activity Log
CREATE TABLE `pricepilot_activity_log` (
  `log_id` int(11) NOT NULL AUTO_INCREMENT,
  `product_id` int(11) NOT NULL,
  `old_price` decimal(15,4) NOT NULL,
  `new_price` decimal(15,4) NOT NULL,
  `changed_by` varchar(255) DEFAULT 'API',
  `date_added` datetime NOT NULL,
  PRIMARY KEY (`log_id`),
  KEY `product_id` (`product_id`)
);

-- API Request Log
CREATE TABLE `pricepilot_api_logs` (
  `log_id` int(11) NOT NULL AUTO_INCREMENT,
  `endpoint` varchar(255) NOT NULL,
  `method` varchar(10) NOT NULL,
  `ip_address` varchar(45) NOT NULL,
  `request_data` text,
  `response_code` int(3) NOT NULL,
  `date_added` datetime NOT NULL,
  PRIMARY KEY (`log_id`),
  KEY `date_added` (`date_added`)
);

-- Product Mapping
CREATE TABLE `pricepilot_product_mapping` (
  `mapping_id` int(11) NOT NULL AUTO_INCREMENT,
  `product_id` int(11) NOT NULL,
  `competitor_url` varchar(500) NOT NULL,
  `competitor_name` varchar(100) NOT NULL,
  `date_added` datetime NOT NULL,
  PRIMARY KEY (`mapping_id`),
  KEY `product_id` (`product_id`)
);

-- Webhook Configuration
CREATE TABLE `pricepilot_webhooks` (
  `webhook_id` int(11) NOT NULL AUTO_INCREMENT,
  `url` varchar(500) NOT NULL,
  `events` text NOT NULL,
  `status` tinyint(1) DEFAULT 1,
  `date_added` datetime NOT NULL,
  PRIMARY KEY (`webhook_id`)
);
```

---

## 🎯 Milestone Planning

### Version 1.1.0 (Security & Stability)
- All Critical Priority tasks
- Basic documentation (README)
- SQL injection fix
- Error handling
- Bulk update API
- Admin dashboard
- Activity logging
- Webhook support
- Multi-store support
- Product variants
- Image sync
- Advanced pricing
- Full test coverage
- Queue system
- Advanced reporting
- Multi-language support

---

## 📝 Notes

- Maintain backward compatibility
- Follow OpenCart extension guidelines
- Test on clean OpenCart installations
- Document all breaking changes
- Keep security as top priority

---
