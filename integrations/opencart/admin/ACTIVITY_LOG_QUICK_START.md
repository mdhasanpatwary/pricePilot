# Activity Log Viewer - Quick Start Guide

## Overview

The Activity Log Viewer provides a comprehensive interface for monitoring and auditing all price changes in your OpenCart store. This guide will help you quickly get started with using the activity log feature.

## Accessing the Activity Log

### From Dashboard
1. Navigate to **Extensions > Modules > PricePilot**
2. Click the **Dashboard** button
3. Scroll to the "Recent Price Changes" section
4. Click **View Full Activity Log** button

### Direct URL
```
admin/index.php?route=extension/module/pricepilot/activityLog&user_token=YOUR_TOKEN
```

## Features Overview

### 1. Filter Activity Log

The activity log supports multiple filter criteria:

#### Filter by Product ID
- Enter a specific product ID to see all price changes for that product
- Example: `123` will show all changes for product ID 123

#### Filter by Date Range
- **Date From**: Select the start date for the range
- **Date To**: Select the end date for the range
- Leave either field empty to filter from beginning or to present

#### Filter by Change Source
- **All Sources**: Show all price changes
- **API**: Show only changes made via API
- **Admin**: Show only changes made by administrators
- **System**: Show only system-generated changes

#### Combining Filters
- All filters use AND logic
- Example: Product ID 123 + Date From 2024-01-01 = All changes for product 123 since Jan 1, 2024

### 2. View Activity Log

The activity log table displays:
- **Log ID**: Unique identifier for each log entry
- **Product ID**: The product that was updated
- **Product Name**: Name of the product
- **Old Price**: Price before the change
- **New Price**: Price after the change
- **Change**: Price difference with color coding:
  - 🟢 Green with ↑ arrow = Price increase
  - 🔴 Red with ↓ arrow = Price decrease
  - ⚪ Gray = No change
- **Changed By**: Source of the change (labeled badge)
- **Store ID**: Store where the change occurred
- **Date**: Timestamp of the change

### 3. Navigate Pages

- **50 entries per page** (as per requirements)
- Use pagination controls at the bottom
- Results counter shows: "Showing 1 to 50 of 150 entries"
- Filters are preserved when navigating pages

### 4. Export to CSV

#### Export Current View
1. Apply desired filters
2. Click **Export CSV** button in the page header
3. CSV file will download automatically

#### CSV File Format
- Filename: `pricepilot_activity_log_YYYY-MM-DD_HHMMSS.csv`
- Includes all columns from the table
- Respects current filter settings
- Limited to 10,000 records

#### CSV Columns
```
Log ID, Product ID, Product Name, Old Price, New Price, Price Change, Changed By, Store ID, Date
```

## Common Use Cases

### Use Case 1: Audit Recent Price Changes
**Goal**: Review all price changes from the last 7 days

**Steps**:
1. Go to Activity Log page
2. Set **Date From** to 7 days ago
3. Leave other filters empty
4. Click **Filter**
5. Review the results

### Use Case 2: Track Specific Product
**Goal**: See all price changes for a specific product

**Steps**:
1. Go to Activity Log page
2. Enter the **Product ID** in the filter
3. Click **Filter**
4. Review all changes for that product

### Use Case 3: Monitor API Changes
**Goal**: See only changes made via API

**Steps**:
1. Go to Activity Log page
2. Select **API** from the **Changed By** dropdown
3. Click **Filter**
4. Review API-initiated changes

### Use Case 4: Export Monthly Report
**Goal**: Export all price changes for the current month

**Steps**:
1. Go to Activity Log page
2. Set **Date From** to first day of month
3. Set **Date To** to last day of month
4. Click **Filter**
5. Click **Export CSV**
6. Open CSV file in Excel or Google Sheets

### Use Case 5: Investigate Price Discrepancy
**Goal**: Find when a product's price was changed

**Steps**:
1. Go to Activity Log page
2. Enter the **Product ID**
3. Set **Date From** to when you suspect the change occurred
4. Click **Filter**
5. Review the log entries to find the change

## Tips and Best Practices

### Filtering Tips
- **Start broad, then narrow**: Begin with date range, then add more filters
- **Use date presets**: Common ranges like "Today", "This Week", "This Month"
- **Clear filters**: Click "Clear" button to reset all filters

### Performance Tips
- **Use date ranges**: Filtering by date improves query performance
- **Limit exports**: Large exports (>10,000 records) are automatically limited
- **Paginate results**: Use pagination instead of exporting everything

### Audit Tips
- **Regular reviews**: Check activity log weekly for unusual changes
- **Monitor API changes**: Track automated price updates
- **Export for records**: Keep monthly CSV exports for compliance

### Troubleshooting

#### No Results Found
- Check if filters are too restrictive
- Verify the product ID exists
- Ensure date range includes the expected period
- Click "Clear" to reset filters

#### Export Not Working
- Check browser pop-up blocker
- Verify you have permission to download files
- Try a different browser
- Check if there are results to export

#### Pagination Not Working
- Verify user token is valid
- Check if filters are preserved in URL
- Try refreshing the page
- Clear browser cache

## Integration with Dashboard

The Activity Log integrates seamlessly with the PricePilot Dashboard:

### Dashboard Features
- **Recent Changes**: Shows last 10 price changes
- **Quick Link**: "View Full Activity Log" button
- **Statistics**: Today's update count

### Navigation Flow
```
Configuration → Dashboard → Activity Log
     ↑              ↓            ↓
     ←──────────────←────────────←
```

## API Integration

The Activity Log automatically captures price changes from:
- **API Endpoints**: `/api/pricepilot/update`, `/api/pricepilot/bulk-update`
- **Admin Panel**: Manual price updates
- **System Events**: Automated price adjustments

### Logged Information
- Product details (ID, name)
- Price changes (old, new)
- Change source (API, Admin, System)
- Store information
- Timestamp

## Security and Permissions

### Access Control
- Requires admin login
- User token validation
- Permission checking via OpenCart

### Data Privacy
- Logs stored in database
- No sensitive information exposed
- CSV exports require authentication

## Database Information

### Table: pricepilot_activity_log
```sql
Columns:
- log_id (Primary Key)
- product_id (Indexed)
- product_name
- old_price
- new_price
- changed_by
- store_id (Indexed)
- date_added (Indexed)
```

### Retention Policy
- Logs retained for 90 days by default
- Automatic cleanup via LoggingService
- Manual export for long-term storage

## Next Steps

After mastering the Activity Log, explore:
1. **API Connection Testing** (Task 17)
2. **Token Management** (Task 18)
3. **Webhook Configuration** (Task 19)

## Support

For issues or questions:
1. Check the verification checklist
2. Review the implementation summary
3. Consult the design document
4. Test with sample data

## Summary

The Activity Log Viewer provides:
- ✅ Comprehensive price change history
- ✅ Flexible filtering options
- ✅ Easy pagination (50 entries per page)
- ✅ CSV export functionality
- ✅ Professional user interface
- ✅ Integration with dashboard

**You're now ready to use the Activity Log Viewer!**
