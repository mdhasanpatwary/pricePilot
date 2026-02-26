---
title: "Feedback Quick Reference"
description: "Quick reference for providing feedback on product matching"
category: "products"
tags: ["feedback", "products", "quick-reference"]
audience: "tenant"
author: "PricePilot Team"
lastReviewed: "2024-05-20"
---

# User Feedback System - Quick Reference

## For Users

### Providing Feedback

**When prompted:**
1. Rate your experience (1-5 stars)
2. Optionally add a comment
3. Click "Submit"

**Manual feedback:**
- Look for "Give Feedback" button
- Available on most pages
- Takes less than 30 seconds

### Feedback Categories
- Overall Experience
- Ease of Use
- Performance
- Features
- Support
- Documentation
- Price Updates
- Product Matching
- Scraping Accuracy
- Dashboard UI
- Notifications
- Security
- Reliability

## For Administrators

### Quick Access
Navigate to: **Admin > Satisfaction**

### Key Metrics at a Glance
- **Average Rating**: Target >4.5/5
- **NPS**: Target >50
- **Total Responses**: Number of feedback submissions
- **Trend**: Up/down indicator

### What to Monitor
1. **Daily**: Check average rating
2. **Weekly**: Review recent feedback comments
3. **Monthly**: Analyze trends and categories

### Taking Action
- **Rating <4.5**: Review recent feedback, identify issues
- **Negative trend**: Check what changed recently
- **Low category score**: Focus improvements on that area
- **Detractors**: Consider reaching out to unhappy users

## API Quick Reference

### Submit Feedback
```bash
POST /api/v1/feedback/submit
{
  "rating": 5,
  "category": "OVERALL_EXPERIENCE",
  "comment": "Great product!"
}
```

### Get Score
```bash
GET /api/v1/feedback/score
```

### Get Trend
```bash
GET /api/v1/feedback/trend?days=30
```

## Component Usage

### Auto-prompt Widget
```tsx
import { FeedbackWidget } from '@/components/feedback-widget';

<FeedbackWidget trigger="auto" />
```

### Manual Feedback Button
```tsx
<FeedbackWidget 
  trigger="manual"
  category="PRICE_UPDATES"
  feature="bulk-update"
/>
```

## Success Criteria

✅ Average rating >4.5/5  
✅ NPS >50  
✅ Positive or stable trend  
✅ >10% response rate

## Need Help?

See full documentation: [User Satisfaction Guide](./USER_SATISFACTION_GUIDE.md)

---

**Quick Tip**: The best feedback is specific, constructive, and honest!
