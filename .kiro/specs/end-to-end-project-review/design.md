# Design Document: End-to-End Project Review

## Overview

This design document provides a comprehensive analysis of the PricePilot platform, identifying gaps, missing features, improvement opportunities, and critical issues across all system components. The review is organized by priority and impact to guide implementation planning.

## System Architecture Analysis

### Current State

PricePilot is a multi-tenant SaaS platform built on:
- **Frontend**: Next.js 16 with App Router, React 19, Tailwind CSS
- **Backend**: Next.js API Routes (serverless)
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis for sessions and metrics
- **Scraping**: Playwright with stealth capabilities
- **Authentication**: NextAuth.js with JWT

### Architecture Strengths

1. **Modern Tech Stack**: Uses current, well-supported technologies
2. **Multi-Tenant Design**: Proper tenant isolation with row-level security
3. **Scalable Architecture**: Serverless functions can scale horizontally
4. **Advanced Scraping**: Sophisticated stealth and anti-bot evasion
5. **Comprehensive Monitoring**: Real-time admin dashboards with full visibility

### Architecture Weaknesses

1. **No Message Queue**: Long-running tasks block API responses
2. **No CDN**: Static assets served directly from application
3. **Single Region**: No geographic distribution for global users
4. **No Service Mesh**: Direct service-to-service communication
5. **Limited Caching**: Could benefit from more aggressive caching strategies


## Critical Gaps Analysis

### 1. Manual Price Approval Workflow (CRITICAL - P0)

**Current State**: Prices are automatically pushed to stores immediately after pricing rules are applied, without any approval step.

**Problem**: This is a critical business risk. Merchants have no opportunity to review price changes before they go live, which could result in:
- Incorrect prices being published
- Loss of revenue from pricing errors
- Damage to brand reputation
- Violation of pricing policies

**Impact**: HIGH - Affects all tenants, core business functionality

**Solution Design**:

```
┌─────────────────────────────────────────────────────────────┐
│           PRICE APPROVAL WORKFLOW ARCHITECTURE               │
└─────────────────────────────────────────────────────────────┘

1. PRICING RULES EVALUATION
   ↓
   RulesEngine.executePriceChanges()
   - Calculate new prices
   - Create PendingPriceChange records
   - Set status = PENDING
   - Set expiresAt = now + 7 days
   - DO NOT push to store yet

2. TENANT NOTIFICATION
   ↓
   NotificationService.notifyPendingApprovals()
   - Send email notification
   - Create in-app notification
   - Show badge count in UI

3. TENANT REVIEW
   ↓
   /dashboard/price-approvals
   - Display pending changes in table
   - Show: Product, Current Price, New Price, Change %, Reason
   - Allow: Approve, Reject, Bulk Approve, Bulk Reject

4. APPROVAL ACTION
   ↓
   PriceApprovalService.approveChanges()
   - Update status = APPROVED
   - Set reviewedBy, reviewedAt
   - Push to store via SyncService
   - Create audit log entry

5. REJECTION ACTION
   ↓
   PriceApprovalService.rejectChanges()
   - Update status = REJECTED
   - Set reviewedBy, reviewedAt
   - DO NOT push to store
   - Create audit log entry

6. AUTO-EXPIRATION
   ↓
   Cron job (daily at 2 AM)
   - Find changes where expiresAt < now
   - Update status = EXPIRED
   - Send notification to tenant
```

**Database Schema**:

```prisma
model PendingPriceChange {
  id                String         @id @default(uuid())
  productId         String
  tenantId          String
  currentPrice      Decimal        @db.Decimal(10, 2)
  recommendedPrice  Decimal        @db.Decimal(10, 2)
  changePercent     Decimal        @db.Decimal(5, 2)
  reason            String
  appliedRule       String?
  status            ApprovalStatus @default(PENDING)
  createdAt         DateTime       @default(now())
  reviewedAt        DateTime?
  reviewedBy        String?
  expiresAt         DateTime
  
  product           Product        @relation(...)
  tenant            Tenant         @relation(...)
  
  @@index([tenantId, status])
  @@index([productId])
  @@index([expiresAt])
}

enum ApprovalStatus {
  PENDING
  APPROVED
  REJECTED
  EXPIRED
}
```

**API Endpoints**:

```typescript
GET  /api/v1/price-approvals
     - List pending price changes
     - Query params: status, page, limit
     - Returns: { changes: [], total, page, limit }

POST /api/v1/price-approvals
     - Approve or reject changes
     - Body: { action: 'approve' | 'reject', changeIds: [] }
     - Returns: { approved: number, rejected: number }

GET  /api/v1/price-approvals/count
     - Get count of pending changes
     - Returns: { count: number }

GET  /api/v1/cron/cleanup-expired-approvals
     - Cron job to expire old changes
     - Requires CRON_SECRET
     - Returns: { expired: number }
```

**UI Component**:

```typescript
// app/dashboard/price-approvals/page.tsx
- Table with columns: Product, Current Price, New Price, Change %, Reason, Actions
- Checkbox for bulk selection
- "Approve Selected" button
- "Reject Selected" button
- "Approve All" button
- Filter by status dropdown
- Pagination controls
- Real-time updates after actions
```

**Settings Toggle**:

```prisma
model Tenant {
  // ... existing fields
  autoApprovePrices Boolean @default(false)
}
```

If `autoApprovePrices = true`, skip approval workflow (backward compatibility)
If `autoApprovePrices = false`, require manual approval (default)

**Implementation Priority**: P0 - Must implement before production launch


### 2. Documentation Accuracy Issues (HIGH - P1)

**Current State**: Documentation contains multiple inaccuracies that mislead users and developers.

**Problems Identified**:

1. **Scraping Frequency Mismatch**:
   - README.md states: "every 15 minutes"
   - DOCUMENTATION.md states: "every 15 minutes"
   - Actual implementation: every 24 hours (vercel.json cron: "0 0 * * *")

2. **Platform Support Overstatement**:
   - Docs claim support for: Shopify, WooCommerce, Laravel, Magento, PrestaShop, BigCommerce, OpenCart
   - Actually implemented: OpenCart (full), Laravel (basic)
   - Not implemented: Shopify, WooCommerce, Magento, PrestaShop, BigCommerce

3. **Feature Availability Confusion**:
   - Docs mention features that don't exist yet
   - No clear indication of what's implemented vs planned

**Impact**: MEDIUM - Causes confusion, sets wrong expectations, wastes support time

**Solution Design**:

```markdown
# Documentation Update Strategy

## 1. Scraping Frequency Corrections

Files to update:
- README.md: Change "every 15 minutes" → "every 24 hours"
- DOCUMENTATION.md: Change "every 15 minutes" → "every 24 hours"
- docs/ARCHITECTURE.md: Verify cron schedule documentation
- Any marketing materials or user guides

## 2. Platform Support Clarity

Add status indicators:
- ✅ OpenCart - Fully Implemented
- ⚠️ Laravel - Basic Implementation (API only)
- 📅 Shopify - Planned for v1.2
- 📅 WooCommerce - Planned for v1.3
- 📅 Magento - Planned for v2.0
- ❌ PrestaShop - Not planned
- ❌ BigCommerce - Not planned

## 3. Feature Status Legend

Add to all documentation:
- ✅ Implemented and tested
- 🚧 In development
- 📅 Planned (with version)
- 💡 Under consideration
- ❌ Not planned

## 4. Version-Specific Documentation

Create versioned docs:
- docs/v1.0/ - Current release
- docs/v1.1/ - Next release (planned features)
- docs/roadmap.md - Long-term plans
```

**Implementation Priority**: P1 - High priority, low effort


### 3. Scraping Log Management (MEDIUM - P2)

**Current State**: Scraping logs accumulate across sessions, making it difficult to distinguish current from historical logs.

**Problem**: When viewing real-time scraping logs, users see mixed logs from multiple sessions, causing confusion about what's happening now vs what happened before.

**Impact**: MEDIUM - Affects debugging and monitoring experience

**Solution Design**:

```typescript
// Enhanced Session-Based Log Management

interface ScrapingLog {
  id: string;
  sessionId: string;  // Link to ScrapingSession
  tenantId: string;
  siteId: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  message: string;
  context?: Record<string, any>;
  timestamp: Date;
  archived: boolean;  // New field
}

// When new session starts
async function startNewSession(tenantId: string, siteId: string) {
  // 1. Archive previous session logs
  await prisma.scrapingLog.updateMany({
    where: {
      tenantId,
      siteId,
      archived: false
    },
    data: {
      archived: true
    }
  });
  
  // 2. Create new session
  const session = await prisma.scrapingSession.create({
    data: {
      tenantId,
      siteId,
      status: 'initializing',
      startTime: new Date()
    }
  });
  
  return session;
}

// Get current session logs only
async function getCurrentSessionLogs(sessionId: string) {
  return await prisma.scrapingLog.findMany({
    where: {
      sessionId,
      archived: false
    },
    orderBy: { timestamp: 'desc' }
  });
}

// Get historical logs with session grouping
async function getHistoricalLogs(tenantId: string, filters: LogFilters) {
  return await prisma.scrapingLog.findMany({
    where: {
      tenantId,
      archived: true,
      ...filters
    },
    include: {
      session: true  // Include session info
    },
    orderBy: { timestamp: 'desc' }
  });
}

// Auto-cleanup old logs (retention policy)
async function cleanupOldLogs() {
  const retentionDays = 90;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  
  await prisma.scrapingLog.deleteMany({
    where: {
      archived: true,
      timestamp: { lt: cutoffDate }
    }
  });
}
```

**UI Changes**:

```typescript
// Real-Time Monitor: Show only current session logs
<LogViewer 
  sessionId={currentSessionId}
  archived={false}
  autoRefresh={true}
/>

// Historical Logs: Show archived logs grouped by session
<HistoricalLogViewer
  tenantId={tenantId}
  archived={true}
  groupBy="session"
  filters={{ dateRange, level, site }}
/>
```

**Implementation Priority**: P2 - Medium priority, improves UX


### 4. Product Matching Algorithm Documentation (MEDIUM - P2)

**Current State**: Product matching logic exists but is not well-documented, making it difficult to understand, debug, or improve.

**Problem**: When scraper finds multiple search results, the selection logic is unclear. No documented scoring algorithm or confidence calculation.

**Impact**: MEDIUM - Affects matching accuracy and maintainability

**Solution Design**:

```typescript
// Comprehensive Product Matching Algorithm

interface MatchingResult {
  competitorProduct: Product;
  confidenceScore: number;  // 0-100
  matchReasons: MatchReason[];
  warnings: string[];
}

interface MatchReason {
  criterion: string;
  score: number;
  weight: number;
  details: string;
}

class ProductMatchingService {
  
  /**
   * Match user product with competitor search results
   * 
   * Algorithm:
   * 1. Exact SKU match (100% confidence)
   * 2. Brand + Model match (90% confidence)
   * 3. Fuzzy title match (60-80% confidence)
   * 4. Manual override (100% confidence)
   * 
   * Scoring Criteria (weighted):
   * - SKU similarity: 40%
   * - Brand match: 20%
   * - Model match: 20%
   * - Title similarity: 15%
   * - Price range validation: 5%
   */
  async matchProduct(
    userProduct: Product,
    searchResults: Product[]
  ): Promise<MatchingResult | null> {
    
    const candidates = searchResults.map(competitor => {
      const reasons: MatchReason[] = [];
      let totalScore = 0;
      
      // 1. SKU Matching (Weight: 40%)
      const skuScore = this.calculateSKUSimilarity(
        userProduct.sku,
        competitor.sku
      );
      reasons.push({
        criterion: 'SKU Similarity',
        score: skuScore,
        weight: 0.4,
        details: `User SKU: ${userProduct.sku}, Competitor SKU: ${competitor.sku}`
      });
      totalScore += skuScore * 0.4;
      
      // 2. Brand Matching (Weight: 20%)
      const brandScore = this.calculateBrandMatch(
        userProduct.brand,
        competitor.brand
      );
      reasons.push({
        criterion: 'Brand Match',
        score: brandScore,
        weight: 0.2,
        details: `User Brand: ${userProduct.brand}, Competitor Brand: ${competitor.brand}`
      });
      totalScore += brandScore * 0.2;
      
      // 3. Model Matching (Weight: 20%)
      const modelScore = this.calculateModelMatch(
        userProduct.model,
        competitor.model
      );
      reasons.push({
        criterion: 'Model Match',
        score: modelScore,
        weight: 0.2,
        details: `User Model: ${userProduct.model}, Competitor Model: ${competitor.model}`
      });
      totalScore += modelScore * 0.2;
      
      // 4. Title Similarity (Weight: 15%)
      const titleScore = this.calculateTitleSimilarity(
        userProduct.title,
        competitor.title
      );
      reasons.push({
        criterion: 'Title Similarity',
        score: titleScore,
        weight: 0.15,
        details: `Levenshtein distance: ${titleScore}`
      });
      totalScore += titleScore * 0.15;
      
      // 5. Price Range Validation (Weight: 5%)
      const priceScore = this.validatePriceRange(
        userProduct.currentPrice,
        competitor.currentPrice
      );
      reasons.push({
        criterion: 'Price Range',
        score: priceScore,
        weight: 0.05,
        details: `User: $${userProduct.currentPrice}, Competitor: $${competitor.currentPrice}`
      });
      totalScore += priceScore * 0.05;
      
      // Calculate warnings
      const warnings: string[] = [];
      if (totalScore < 70) {
        warnings.push('Low confidence match - manual review recommended');
      }
      if (Math.abs(userProduct.currentPrice - competitor.currentPrice) > userProduct.currentPrice * 0.5) {
        warnings.push('Price difference exceeds 50% - verify product match');
      }
      if (!brandScore && !modelScore) {
        warnings.push('No brand or model match - high risk of incorrect match');
      }
      
      return {
        competitorProduct: competitor,
        confidenceScore: totalScore,
        matchReasons: reasons,
        warnings
      };
    });
    
    // Sort by confidence score
    candidates.sort((a, b) => b.confidenceScore - a.confidenceScore);
    
    // Return best match if confidence >= 60%
    const bestMatch = candidates[0];
    if (bestMatch && bestMatch.confidenceScore >= 60) {
      return bestMatch;
    }
    
    return null;  // No confident match found
  }
  
  private calculateSKUSimilarity(sku1: string, sku2: string): number {
    if (!sku1 || !sku2) return 0;
    if (sku1.toLowerCase() === sku2.toLowerCase()) return 100;
    
    // Fuzzy match using Levenshtein distance
    const distance = levenshtein(sku1.toLowerCase(), sku2.toLowerCase());
    const maxLength = Math.max(sku1.length, sku2.length);
    return Math.max(0, 100 - (distance / maxLength) * 100);
  }
  
  private calculateBrandMatch(brand1: string, brand2: string): number {
    if (!brand1 || !brand2) return 0;
    
    // Normalize brands (handle aliases)
    const normalized1 = this.normalizeBrand(brand1);
    const normalized2 = this.normalizeBrand(brand2);
    
    return normalized1 === normalized2 ? 100 : 0;
  }
  
  private calculateModelMatch(model1: string, model2: string): number {
    if (!model1 || !model2) return 0;
    
    // Exact match
    if (model1.toLowerCase() === model2.toLowerCase()) return 100;
    
    // Partial match (one contains the other)
    if (model1.toLowerCase().includes(model2.toLowerCase()) ||
        model2.toLowerCase().includes(model1.toLowerCase())) {
      return 80;
    }
    
    return 0;
  }
  
  private calculateTitleSimilarity(title1: string, title2: string): number {
    if (!title1 || !title2) return 0;
    
    // Use string-similarity library
    const similarity = stringSimilarity.compareTwoStrings(
      title1.toLowerCase(),
      title2.toLowerCase()
    );
    
    return similarity * 100;
  }
  
  private validatePriceRange(price1: number, price2: number): number {
    const difference = Math.abs(price1 - price2);
    const average = (price1 + price2) / 2;
    const percentDiff = (difference / average) * 100;
    
    // Score based on price similarity
    if (percentDiff < 10) return 100;  // Within 10%
    if (percentDiff < 25) return 80;   // Within 25%
    if (percentDiff < 50) return 60;   // Within 50%
    return 40;  // More than 50% difference
  }
  
  private normalizeBrand(brand: string): string {
    // Handle common brand aliases
    const aliases: Record<string, string> = {
      'hp': 'hewlett packard',
      'hewlett packard': 'hewlett packard',
      'hewlett-packard': 'hewlett packard',
      // Add more aliases
    };
    
    const normalized = brand.toLowerCase().trim();
    return aliases[normalized] || normalized;
  }
}
```

**Documentation**:

Create `docs/PRODUCT_MATCHING_ALGORITHM.md` with:
- Detailed algorithm explanation
- Scoring criteria and weights
- Examples with step-by-step calculations
- Edge cases and how they're handled
- Configuration options
- Troubleshooting guide

**Implementation Priority**: P2 - Medium priority, improves accuracy


## Feature Gaps and Enhancements

### 5. Tenant Onboarding Wizard (MEDIUM - P2)

**Current State**: New tenants must manually navigate through multiple pages to set up their account.

**Problem**: Steep learning curve, high abandonment rate, poor first-time user experience.

**Solution Design**:

```typescript
// Multi-Step Onboarding Wizard

interface OnboardingState {
  currentStep: number;
  totalSteps: number;
  completed: boolean;
  data: {
    storeConnection?: StoreConnectionData;
    competitors?: CompetitorData[];
    pricingRules?: PricingRuleData[];
  };
}

const ONBOARDING_STEPS = [
  {
    id: 1,
    title: 'Welcome to PricePilot',
    description: 'Let\'s get you set up in 5 minutes',
    component: WelcomeStep
  },
  {
    id: 2,
    title: 'Connect Your Store',
    description: 'Link your e-commerce platform',
    component: StoreConnectionStep,
    validation: validateStoreConnection
  },
  {
    id: 3,
    title: 'Add Competitors',
    description: 'Who do you want to monitor?',
    component: CompetitorSetupStep,
    validation: validateCompetitors
  },
  {
    id: 4,
    title: 'Create Pricing Rules',
    description: 'Define your pricing strategy',
    component: PricingRulesStep,
    validation: validatePricingRules
  },
  {
    id: 5,
    title: 'Review & Launch',
    description: 'Confirm your settings',
    component: ReviewStep
  }
];

// Onboarding Wizard Component
function OnboardingWizard() {
  const [state, setState] = useState<OnboardingState>({
    currentStep: 1,
    totalSteps: ONBOARDING_STEPS.length,
    completed: false,
    data: {}
  });
  
  const currentStepConfig = ONBOARDING_STEPS[state.currentStep - 1];
  const StepComponent = currentStepConfig.component;
  
  const handleNext = async () => {
    // Validate current step
    if (currentStepConfig.validation) {
      const isValid = await currentStepConfig.validation(state.data);
      if (!isValid) return;
    }
    
    // Move to next step
    if (state.currentStep < state.totalSteps) {
      setState(prev => ({
        ...prev,
        currentStep: prev.currentStep + 1
      }));
    } else {
      // Complete onboarding
      await completeOnboarding(state.data);
      setState(prev => ({ ...prev, completed: true }));
    }
  };
  
  const handleBack = () => {
    if (state.currentStep > 1) {
      setState(prev => ({
        ...prev,
        currentStep: prev.currentStep - 1
      }));
    }
  };
  
  const handleSkip = () => {
    // Save progress and allow resumption later
    saveOnboardingProgress(state);
    router.push('/dashboard');
  };
  
  return (
    <div className="onboarding-wizard">
      <ProgressBar 
        current={state.currentStep} 
        total={state.totalSteps} 
      />
      
      <StepComponent
        data={state.data}
        onUpdate={(data) => setState(prev => ({ ...prev, data }))}
      />
      
      <NavigationButtons
        onNext={handleNext}
        onBack={handleBack}
        onSkip={handleSkip}
        showBack={state.currentStep > 1}
        showSkip={state.currentStep < state.totalSteps}
        nextLabel={state.currentStep === state.totalSteps ? 'Launch' : 'Next'}
      />
    </div>
  );
}

// Store Connection Step with Live Testing
function StoreConnectionStep({ data, onUpdate }) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  
  const handleTest = async () => {
    setTesting(true);
    try {
      const result = await testStoreConnection({
        platform: data.platform,
        url: data.url,
        apiToken: data.apiToken
      });
      setTestResult(result);
    } catch (error) {
      setTestResult({ success: false, error: error.message });
    } finally {
      setTesting(false);
    }
  };
  
  return (
    <div>
      <h2>Connect Your Store</h2>
      <PlatformSelector 
        value={data.platform}
        onChange={(platform) => onUpdate({ ...data, platform })}
      />
      <Input
        label="Store URL"
        value={data.url}
        onChange={(url) => onUpdate({ ...data, url })}
        placeholder="https://yourstore.com"
      />
      <Input
        label="API Token"
        value={data.apiToken}
        onChange={(apiToken) => onUpdate({ ...data, apiToken })}
        type="password"
      />
      <Button onClick={handleTest} loading={testing}>
        Test Connection
      </Button>
      {testResult && (
        <TestResult result={testResult} />
      )}
    </div>
  );
}

// Competitor Setup with Auto-Discovery
function CompetitorSetupStep({ data, onUpdate }) {
  const [discovering, setDiscovering] = useState(false);
  
  const handleAutoDiscover = async () => {
    setDiscovering(true);
    try {
      const suggestions = await discoverCompetitors({
        industry: data.industry,
        products: data.sampleProducts
      });
      onUpdate({ ...data, competitorSuggestions: suggestions });
    } finally {
      setDiscovering(false);
    }
  };
  
  return (
    <div>
      <h2>Add Competitors</h2>
      <p>Who do you want to monitor?</p>
      
      <Button onClick={handleAutoDiscover} loading={discovering}>
        Auto-Discover Competitors
      </Button>
      
      <CompetitorList
        competitors={data.competitors || []}
        suggestions={data.competitorSuggestions || []}
        onAdd={(competitor) => {
          const updated = [...(data.competitors || []), competitor];
          onUpdate({ ...data, competitors: updated });
        }}
        onRemove={(index) => {
          const updated = data.competitors.filter((_, i) => i !== index);
          onUpdate({ ...data, competitors: updated });
        }}
      />
    </div>
  );
}

// Pricing Rules with Templates
function PricingRulesStep({ data, onUpdate }) {
  const RULE_TEMPLATES = [
    {
      name: 'Always Cheapest',
      description: 'Stay 5% below the lowest competitor',
      strategy: 'UNDERCUT',
      parameter: 5
    },
    {
      name: 'Match Competitor',
      description: 'Match the average competitor price',
      strategy: 'MATCH',
      parameter: 0
    },
    {
      name: 'Maintain Margin',
      description: 'Never go below 20% profit margin',
      strategy: 'MARGIN_LOCK',
      parameter: 20
    }
  ];
  
  return (
    <div>
      <h2>Create Pricing Rules</h2>
      <p>Choose a template or create custom rules</p>
      
      <TemplateGrid
        templates={RULE_TEMPLATES}
        onSelect={(template) => {
          const updated = [...(data.pricingRules || []), template];
          onUpdate({ ...data, pricingRules: updated });
        }}
      />
      
      <RuleBuilder
        rules={data.pricingRules || []}
        onChange={(rules) => onUpdate({ ...data, pricingRules: rules })}
      />
    </div>
  );
}

// Complete Onboarding and Trigger Initial Sync
async function completeOnboarding(data: OnboardingData) {
  // 1. Create store connection
  const store = await createStoreConnection(data.storeConnection);
  
  // 2. Add competitors
  await Promise.all(
    data.competitors.map(c => createCompetitorSite(c))
  );
  
  // 3. Create pricing rules
  await Promise.all(
    data.pricingRules.map(r => createPricingRule(r))
  );
  
  // 4. Trigger initial sync
  await triggerInitialSync();
  
  // 5. Mark onboarding as complete
  await updateTenantSettings({ onboardingCompleted: true });
  
  // 6. Send welcome email
  await sendWelcomeEmail();
}
```

**Implementation Priority**: P2 - Improves user experience significantly


### 6. Enhanced Notification System (MEDIUM - P2)

**Current State**: Basic in-app notifications exist, but no email notifications or comprehensive notification preferences.

**Problem**: Users miss important events, no way to customize notification preferences.

**Solution Design**:

```typescript
// Comprehensive Notification System

interface Notification {
  id: string;
  tenantId: string;
  type: NotificationType;
  severity: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  link?: string;
  data?: Record<string, any>;
  channels: NotificationChannel[];
  isRead: boolean;
  createdAt: Date;
  expiresAt?: Date;
}

enum NotificationType {
  PRICE_APPROVAL_PENDING = 'price_approval_pending',
  SCRAPING_FAILED = 'scraping_failed',
  COMPETITOR_PRICE_CHANGED = 'competitor_price_changed',
  PRICING_RULE_TRIGGERED = 'pricing_rule_triggered',
  API_CONNECTION_FAILED = 'api_connection_failed',
  SYNC_COMPLETED = 'sync_completed',
  QUOTA_WARNING = 'quota_warning',
  SYSTEM_MAINTENANCE = 'system_maintenance'
}

enum NotificationChannel {
  IN_APP = 'in_app',
  EMAIL = 'email',
  SLACK = 'slack',
  WEBHOOK = 'webhook'
}

interface NotificationPreferences {
  tenantId: string;
  preferences: {
    [key in NotificationType]: {
      enabled: boolean;
      channels: NotificationChannel[];
      frequency: 'immediate' | 'hourly' | 'daily';
    };
  };
}

class NotificationService {
  
  async send(notification: Omit<Notification, 'id' | 'createdAt'>) {
    // 1. Get tenant notification preferences
    const prefs = await this.getPreferences(notification.tenantId);
    const typePrefs = prefs.preferences[notification.type];
    
    if (!typePrefs.enabled) {
      return; // Notifications disabled for this type
    }
    
    // 2. Create notification record
    const created = await prisma.notification.create({
      data: {
        ...notification,
        channels: typePrefs.channels
      }
    });
    
    // 3. Send via configured channels
    await Promise.all(
      typePrefs.channels.map(channel => 
        this.sendViaChannel(created, channel, typePrefs.frequency)
      )
    );
    
    return created;
  }
  
  private async sendViaChannel(
    notification: Notification,
    channel: NotificationChannel,
    frequency: string
  ) {
    switch (channel) {
      case NotificationChannel.IN_APP:
        // Already stored in database
        break;
        
      case NotificationChannel.EMAIL:
        if (frequency === 'immediate') {
          await this.sendEmail(notification);
        } else {
          await this.queueForDigest(notification, frequency);
        }
        break;
        
      case NotificationChannel.SLACK:
        await this.sendSlackMessage(notification);
        break;
        
      case NotificationChannel.WEBHOOK:
        await this.sendWebhook(notification);
        break;
    }
  }
  
  private async sendEmail(notification: Notification) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: notification.tenantId },
      include: { users: true }
    });
    
    const template = this.getEmailTemplate(notification.type);
    
    await Promise.all(
      tenant.users
        .filter(u => u.emailNotifications)
        .map(user => 
          emailService.send({
            to: user.email,
            subject: notification.title,
            template,
            data: {
              user,
              notification,
              actionUrl: `${process.env.NEXTAUTH_URL}${notification.link}`
            }
          })
        )
    );
  }
  
  private async sendSlackMessage(notification: Notification) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: notification.tenantId }
    });
    
    if (!tenant.slackEnabled || !tenant.slackWebhookUrl) {
      return;
    }
    
    await axios.post(tenant.slackWebhookUrl, {
      text: notification.title,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${notification.title}*\n${notification.message}`
          }
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'View Details' },
              url: `${process.env.NEXTAUTH_URL}${notification.link}`
            }
          ]
        }
      ]
    });
  }
  
  private async queueForDigest(notification: Notification, frequency: string) {
    // Queue notification for digest email
    await prisma.notificationDigestQueue.create({
      data: {
        notificationId: notification.id,
        tenantId: notification.tenantId,
        frequency,
        scheduledFor: this.calculateDigestTime(frequency)
      }
    });
  }
  
  private calculateDigestTime(frequency: string): Date {
    const now = new Date();
    switch (frequency) {
      case 'hourly':
        now.setHours(now.getHours() + 1, 0, 0, 0);
        break;
      case 'daily':
        now.setDate(now.getDate() + 1);
        now.setHours(9, 0, 0, 0); // 9 AM next day
        break;
    }
    return now;
  }
  
  // Send digest emails (cron job)
  async sendDigests() {
    const now = new Date();
    const pending = await prisma.notificationDigestQueue.findMany({
      where: {
        scheduledFor: { lte: now },
        sent: false
      },
      include: {
        notification: true
      }
    });
    
    // Group by tenant and frequency
    const grouped = this.groupBy(pending, 'tenantId');
    
    for (const [tenantId, notifications] of Object.entries(grouped)) {
      await this.sendDigestEmail(tenantId, notifications);
      
      // Mark as sent
      await prisma.notificationDigestQueue.updateMany({
        where: {
          id: { in: notifications.map(n => n.id) }
        },
        data: { sent: true }
      });
    }
  }
}

// Notification Preferences UI
function NotificationPreferencesPage() {
  const [preferences, setPreferences] = useState<NotificationPreferences>();
  
  return (
    <div>
      <h1>Notification Preferences</h1>
      
      {Object.entries(NotificationType).map(([key, type]) => (
        <PreferenceRow
          key={type}
          type={type}
          preference={preferences?.preferences[type]}
          onChange={(updated) => {
            setPreferences(prev => ({
              ...prev,
              preferences: {
                ...prev.preferences,
                [type]: updated
              }
            }));
          }}
        />
      ))}
      
      <Button onClick={() => savePreferences(preferences)}>
        Save Preferences
      </Button>
    </div>
  );
}

function PreferenceRow({ type, preference, onChange }) {
  return (
    <div className="preference-row">
      <div>
        <h3>{formatNotificationType(type)}</h3>
        <p>{getNotificationDescription(type)}</p>
      </div>
      
      <Switch
        checked={preference.enabled}
        onChange={(enabled) => onChange({ ...preference, enabled })}
      />
      
      {preference.enabled && (
        <>
          <ChannelSelector
            selected={preference.channels}
            onChange={(channels) => onChange({ ...preference, channels })}
          />
          
          <FrequencySelector
            selected={preference.frequency}
            onChange={(frequency) => onChange({ ...preference, frequency })}
          />
        </>
      )}
    </div>
  );
}
```

**Email Templates**:

Create templates for each notification type:
- `templates/email/price-approval-pending.html`
- `templates/email/scraping-failed.html`
- `templates/email/competitor-price-changed.html`
- etc.

**Implementation Priority**: P2 - Improves user engagement


## Priority Matrix

### P0 - Critical (Must Fix Before Production)

1. **Manual Price Approval Workflow**
   - Impact: HIGH - Core business functionality
   - Effort: MEDIUM - 3-5 days
   - Risk: HIGH - Automatic price updates without approval

### P1 - High Priority (Fix Soon)

2. **Documentation Accuracy**
   - Impact: MEDIUM - User confusion, support burden
   - Effort: LOW - 1-2 days
   - Risk: LOW - Misleading information

### P2 - Medium Priority (Plan for Next Sprint)

3. **Scraping Log Management**
   - Impact: MEDIUM - UX improvement
   - Effort: MEDIUM - 2-3 days
   - Risk: LOW - Debugging difficulty

4. **Product Matching Algorithm Documentation**
   - Impact: MEDIUM - Maintainability, accuracy
   - Effort: MEDIUM - 2-3 days
   - Risk: MEDIUM - Poor matching quality

5. **Tenant Onboarding Wizard**
   - Impact: MEDIUM - User acquisition
   - Effort: HIGH - 5-7 days
   - Risk: LOW - High abandonment rate

6. **Enhanced Notification System**
   - Impact: MEDIUM - User engagement
   - Effort: MEDIUM - 3-4 days
   - Risk: LOW - Missed important events

### P3 - Low Priority (Future Enhancements)

7. **Multi-Currency Support**
8. **A/B Testing for Pricing**
9. **Mobile Application**
10. **Advanced Analytics**
11. **Webhook System**
12. **Bulk Operations Enhancement**

## Implementation Roadmap

### Phase 1: Critical Fixes (Week 1-2)
- ✅ Manual Price Approval Workflow
- ✅ Documentation Accuracy Updates

### Phase 2: Core Improvements (Week 3-4)
- ✅ Scraping Log Management
- ✅ Product Matching Algorithm Documentation
- ✅ Enhanced Notification System

### Phase 3: UX Enhancements (Week 5-6)
- ✅ Tenant Onboarding Wizard
- ✅ Bulk Operations Enhancement
- ✅ Advanced Analytics

### Phase 4: Platform Expansion (Month 2-3)
- ✅ Additional Platform Integrations (Shopify, WooCommerce)
- ✅ Multi-Currency Support
- ✅ Webhook System

### Phase 5: Advanced Features (Month 4+)
- ✅ A/B Testing for Pricing
- ✅ Mobile Application
- ✅ AI-Powered Pricing Optimization

## Technical Debt Assessment

### Code Quality Issues

1. **Missing Property-Based Tests**
   - Status: 52 optional PBT tasks not implemented
   - Impact: LOW - E2E tests provide coverage
   - Recommendation: Implement incrementally for critical paths

2. **Performance Optimization Opportunities**
   - Metrics calculation occasionally exceeds 500ms
   - Recommendation: Implement materialized views

3. **Error Handling Consistency**
   - Some endpoints lack structured error responses
   - Recommendation: Standardize error format across all APIs

4. **Code Duplication**
   - Some scraping logic duplicated across services
   - Recommendation: Extract common patterns to shared utilities

### Architecture Improvements

1. **Message Queue Integration**
   - Current: Long-running tasks block API responses
   - Recommendation: Implement BullMQ for background jobs

2. **CDN Integration**
   - Current: Static assets served from application
   - Recommendation: Use Vercel Edge Network or Cloudflare CDN

3. **Database Connection Pooling**
   - Current: Direct Prisma connections
   - Recommendation: Implement PgBouncer for connection pooling

4. **Caching Strategy**
   - Current: Basic Redis caching
   - Recommendation: Implement multi-tier caching (L1: memory, L2: Redis)

## Security Recommendations

### Immediate Actions

1. **API Token Rotation**
   - Implement automatic token rotation every 90 days
   - Add token expiration warnings

2. **Rate Limiting Enhancement**
   - Add per-endpoint rate limits
   - Implement adaptive rate limiting based on tenant plan

3. **Audit Log Retention**
   - Implement automated audit log archival
   - Add audit log export functionality

### Future Enhancements

1. **Two-Factor Authentication**
   - Add 2FA support for admin accounts
   - Implement backup codes

2. **IP Whitelisting**
   - Allow tenants to whitelist IP addresses
   - Add geo-blocking capabilities

3. **Encryption at Rest**
   - Encrypt sensitive database columns
   - Implement key rotation

## Performance Targets

### Current Performance

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Dashboard load time | < 2s | 600-800ms | ✅ Pass |
| API response time (p95) | < 500ms | 400-600ms | ⚠️ Acceptable |
| Real-time update latency | < 2s | 50-300ms | ✅ Pass |
| Concurrent users | 50+ | 50+ | ✅ Pass |
| Database query time (p95) | < 100ms | 80-120ms | ⚠️ Acceptable |

### Performance Improvement Plan

1. **Database Optimization**
   - Add missing indexes
   - Implement query result caching
   - Use read replicas for analytics

2. **API Optimization**
   - Implement response compression
   - Add HTTP/2 support
   - Use edge caching for static data

3. **Frontend Optimization**
   - Implement code splitting
   - Add service worker for offline support
   - Optimize bundle size

## Monitoring and Observability

### Current Monitoring

- ✅ Admin dashboard with real-time metrics
- ✅ Session tracking and lifecycle visualization
- ✅ Proxy health monitoring
- ✅ Challenge detection tracking
- ✅ System health checks

### Missing Monitoring

- ❌ Application Performance Monitoring (APM)
- ❌ Error tracking and aggregation
- ❌ User behavior analytics
- ❌ Business metrics dashboard
- ❌ SLA monitoring and alerting

### Recommended Tools

1. **APM**: Datadog, New Relic, or Sentry
2. **Error Tracking**: Sentry or Rollbar
3. **Analytics**: Mixpanel or Amplitude
4. **Logging**: Logtail or Papertrail
5. **Uptime Monitoring**: Pingdom or UptimeRobot

## Conclusion

PricePilot is a well-architected platform with strong foundations, but has several critical gaps that must be addressed before production launch:

### Critical Issues (P0)
1. **Manual Price Approval Workflow** - Must implement to prevent automatic price updates without review

### High Priority Issues (P1)
2. **Documentation Accuracy** - Fix misleading information about scraping frequency and platform support

### Medium Priority Improvements (P2)
3. **Scraping Log Management** - Improve session-based log filtering
4. **Product Matching Documentation** - Document and enhance matching algorithm
5. **Tenant Onboarding** - Add guided setup wizard
6. **Notification System** - Add email notifications and preferences

### Future Enhancements (P3)
- Multi-currency support
- A/B testing for pricing
- Mobile application
- Advanced analytics
- Additional platform integrations

The platform is production-ready after addressing P0 and P1 issues. P2 improvements should be planned for the next sprint to enhance user experience and system maintainability.

