# Add Scrape Failure Types

Adds structured failure classification to scraping attempt logs.

## Changes

- Introduces `ScrapeFailureType` enum.
- Adds nullable `failureType` to `ScrapeAttempt`.
- Adds `failureTypeCounts` JSONB rollup to `ScrapingMetric` for hourly aggregation.

