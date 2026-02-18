# Add Price Anomaly Flags

Adds anomaly flags and metadata to `Product` so scrapes can be flagged before saving price updates.

## Changes

- `Product.priceAnomalyActive` (boolean)
- `Product.priceAnomalyDetectedAt` (timestamp)
- `Product.priceAnomalyData` (jsonb)

