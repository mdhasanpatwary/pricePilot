# 📋 PricePilot Roadmap & Master Plan

> **Last Updated:** January 2026
> **Version:** 1.0.0 (Beta)
Note:  don't execute the todo.md task from your own decision. ask me first.

---

## 🧩 3. Missing Parts (The "Gap")

| Feature | Status | Notes |
| :--- | :--- | :--- |
| **API Docs** | ✅ Complete | OpenAPI 3.0 spec + Interactive Reference at `/dashboard/developers/docs`. |
| **Scheduled Reports** | ❌ Missing | Cannot schedule PDF/CSV dumps via email. |

---

## issues
* [x] should show searching full url in tenant & admin terminal.
* [x] on tenant terminal this ">Awaiting next telemetry packet..." text has contrast issue. not showing properly.
* [x] tenant panel competitor table product column content will be like this: (successfully fetched products / total products).
* [x] from super admin panel need to monitor what background process is running. and what is the status of that process. and also need to see logs of that process. - Implemented in Live Sync Monitor (Job Details + Fail Logs)

## request feature
* [x] Add a Debug page to the Admin Panel that centrally displays all system diagnostics—runtime errors, warnings, logs, failed requests, and detected inconsistencies—with clear categorization and timestamps for efficient debugging. diffentiate the monitor page with this page. if those serve same purpose then merge them. - Implemented (Unified Debug Hub & Health Assessment)
* should care lint error warnings, test errors & build errors in code writing time.
* integration site data kibabe update hove?


* [x] in Match Approval page, should add competitor wise product filter tab. (Backend support added)
* [x] Most of the e-commerce sites have different search systems. Add an admin panel option to configure each site’s search pattern. For every site, store: (1) Website link and (2) Search pattern URL. Example: Website: https://www.techlandbd.com, Search pattern: https://www.techlandbd.com/search/advance/product/result/A4TECH+KRS-82+Wired+Multimedia.”
* [x] match approval page search is very unresponsive & laggy. (Fixed: Server-Side Search + Correct Debounce Hook)
* [x] startech, ryans & techlandbd sob gulo jonno search pattern add kora ache in codebase but the default value is not showing on 'Configure Search Pattern' modal for them!. also tenant from dashboard,  competitor website er search pattern add korte parbe & tenant er jonno proper instruction add korte hove. (Fixed: Added Defaults & Config Modal)


## Just Asking
* jokhon scraper ekta url search diye multiple result pai, tokhon oi result gulo theke kivabe best result ta select kore?


## 🔧 Scraper Improvements (High Priority)
* [x] Implement weighted scoring system for product link selection instead of simple first-match approach
* [x] Add brand recognition logic to prioritize products from known brands (Samsung, Apple, Dell, etc.)
* [x] Add model number pattern matching for tech products (A4TECH-KRS-82, Galaxy-S23, etc.) - Implemented Regex Matcher
* [x] Add price indicator detection to boost links that have nearby price information - Implemented
* [x] Add image quality check to prioritize products with images and matching alt text - Implemented
* [x] Implement fallback strategies: query simplification, brand-only search, fuzzy matching - Implemented (Token Ratio + Fuzzy)
* [x] Add URL structure analysis scoring (deeper URLs, product-specific patterns) - Implemented
* [x] Add position-based scoring (higher on page = better score) - Implemented
* [x] Add text quality scoring based on link text length and relevance - Implemented

## ⚡ Advanced Scraper Optimizations (Performance Focused)
* [x] Implement Smart Pre-Flight Analysis: HEAD requests, robots.txt checks, and quick API probes before full scraping (90% faster decisions) - Implemented
* [ ] Add Progressive Data Extraction: HTML-only parsing first, then light JS, then full browser as fallback (60% faster average)
* [x] Implement Intelligent Caching Strategy: Site-aware cache invalidation with different TTLs per site type (95% faster repeated queries)
* [x] Create Site-Specific Optimization Profiles: Pre-configured performance profiles for StarTech, Ryans, TechLand (tailored performance per site)
* [ ] Add Edge Computing Integration: Use CDN edge functions for geographically optimized scraping (lower latency, auto-scaling)

## 🏗 Tech-Product Ecommerce Improvements (Core Features)

### 📊 Data Model & Schema Enhancements
* [x] **Product Specifications Schema**: Add technical specifications table with key-value pairs for CPU, RAM, storage, display, etc.
  - **Pros**: Better product comparison, accurate matching, rich product data
  - **Cons**: Database complexity, migration overhead, storage increase
  - **Complexity**: High (schema changes, data migration)
  - **Impact**: Medium (existing queries need updates)
* [x] **Product Categories & Taxonomy**: Implement hierarchical category system (Electronics > Laptops > Gaming Laptops) - Implemented `Category` Model & Relations
  - **Pros**: Better organization, category-based pricing rules, improved search
  - **Cons**: Complex hierarchy management, category mapping challenges
  - **Complexity**: Medium (new tables, UI updates)
  - **Impact**: Low (additive feature)
* [x] **Brand Ecosystem**: Create brand management with aliases, logos, and brand-specific rules - Implemented `Brand` Model & Relations
  - **Pros**: Better brand recognition, consistent naming, brand analytics
  - **Cons**: Maintenance overhead, brand data management
  - **Complexity**: Medium (new tables, brand data seeding)
  - **Impact**: Low (additive feature)

### 🎯 Advanced Matching
* [x] **Tech-Specific Matching Algorithm**: Enhance matching with model numbers, specifications comparison, and tech jargon handling - Implemented (Spec Comparison + Jargon Normalizer)
  - **Pros**: 90%+ accurate matches for tech products, reduced manual intervention
  - **Cons**: Complex algorithm development, false positives
  - **Complexity**: High (ML algorithms, testing)
  - **Impact**: Medium (existing matching logic replacement)
* [x] **Semantic Product Understanding**: Use NLP to understand product descriptions and specifications - Implemented (Heuristic Spec Matching)
  - **Pros**: Better matching across different description styles, handles synonyms
  - **Cons**: Computational overhead, model training requirements
  - **Complexity**: Very High (NLP integration, model training)
  - **Impact**: Medium (enhanced matching service)

### 🚀 Performance & Scalability
* [x] **Database Indexing Strategy**: Add composite indexes for common tech product queries (brand+model, category+price)
  - **Pros**: 10x faster queries, better user experience
  - **Cons**: Write performance impact, index maintenance
  - **Complexity**: Low (index additions)
  - **Impact**: Low (performance improvement)
* [x] **Caching Layer**: Implement Redis caching for product data, search results, and specifications
  - **Pros**: Sub-second response times, reduced database load
  - **Cons**: Cache invalidation complexity, memory usage
  - **Complexity**: Medium (Redis integration, cache management)
  - **Impact**: Low (performance layer addition)
* [x] **Background Processing Optimization**: Optimize BullMQ queues for tech product batch processing - Implemented Distributed Site Sync & Priorities
  - **Pros**: Handle large catalogs efficiently, better resource utilization
  - **Cons**: Queue management complexity, monitoring requirements
  - **Complexity**: Medium (queue optimization, monitoring)
  - **Impact**: Low (existing queue enhancement)

### 🔍 Search & Discovery
* [x] **Advanced Search Filters**: Add tech-specific filters (RAM, storage, processor, screen size, etc.)
  - **Pros**: Better user experience, precise product finding
  - **Cons**: Complex UI, filter state management
  - **Complexity**: Medium (UI components, query building)
  - **Impact**: Low (additive feature)
* [x] **Product Comparison Engine**: Build side-by-side comparison for tech specifications - Implemented Side-by-Side Specs Drawer
  - **Pros**: Better decision making, competitive analysis
  - **Cons**: Complex UI, data normalization challenges
  - **Complexity**: High (comparison logic, UI design)
  - **Impact**: Low (additive feature)

### 📈 Analytics & Insights
* [x] **Tech Market Intelligence**: Price trends by specifications, brand performance analysis - Implemented (Brand Matrix & Spec Hub)
  - **Pros**: Strategic insights, better pricing decisions
  - **Cons**: Complex analytics queries, data aggregation
  - **Complexity**: Medium (analytics queries, dashboard updates)
  - **Impact**: Low (additive feature)
* [x] **Competitor Analysis Dashboard**: Visual comparison of competitor offerings by category - Implemented (Market Landscape & Catalog Density)
  - **Pros**: Market understanding, competitive positioning
  - **Cons**: Data visualization complexity, real-time updates
  - **Complexity**: Medium (charts, data processing)
  - **Impact**: Low (additive feature)
* [x] **Price Elasticity Analysis**: Analyze how prices change with specifications and market conditions - Implemented (Reactivity Index & Spec Premium Map)
  - **Pros**: Optimal pricing strategies, demand prediction
  - **Cons**: Statistical analysis complexity, historical data requirements
  - **Complexity**: High (statistical modeling, data analysis)
  - **Impact**: Low (additive feature)

### 🔌 Integrations & APIs
* [x] **Tech Platform Integrations**: Add support for Shopify, WooCommerce, Magento with tech-specific features - Implemented (API Sync & Spec Extraction)
  - **Pros**: More customers, better data integration
  - **Cons**: Platform-specific development, API maintenance
  - **Complexity**: High (multiple platform support)
  - **Impact**: Medium (existing integration enhancement)
* [x] **Bulk Data Import/Export**: Support for Excel/CSV import with tech product templates - Implemented (Tech Templates & Bulk API)
  - **Pros**: Easy onboarding, bulk operations
  - **Cons**: Data validation complexity, error handling
  - **Complexity**: Medium (file processing, validation)
  - **Impact**: Low (additive feature)

### 🛡️ Data Quality & Validation
* [x] **Tech Product Validation**: Validate specifications, model numbers, and technical data
  - **Pros**: Data accuracy, reduced errors
  - **Cons**: Validation rule complexity, false rejections
  - **Complexity**: Medium (validation logic, rules engine)
  - **Impact**: Low (additive feature)
* [x] **Duplicate Detection**: Identify and merge duplicate products across competitors - Implemented (Cleansed Insights & Duplicate Hub)
  - **Pros**: Clean data, better analytics
  - **Cons**: Duplicate detection algorithm complexity
  - **Complexity**: Medium (similarity algorithms, merge logic)
  - **Impact**: Low (additive feature)