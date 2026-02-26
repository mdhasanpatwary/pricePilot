---
title: "User Satisfaction Guide"
description: "User satisfaction metrics and feedback"
category: "system-monitoring"
author: "PricePilot Team"
lastReviewed: "2024-05-20"
tags: ["metrics", "satisfaction", "monitoring"]
audience: "admin"
relatedDocs: ["/docs/troubleshooting/user-satisfaction-guide.md"]
---

# User Satisfaction Tracking Guide

## Overview

PricePilot includes a comprehensive user satisfaction tracking system designed to measure and improve user experience. The system collects feedback, calculates satisfaction scores, and provides actionable insights to maintain a satisfaction score above 4.5/5.

## Key Features

### 1. Feedback Collection
- **5-Star Rating System**: Users rate their experience on a scale of 1-5 stars
- **Category-Based Feedback**: Feedback organized by categories (Overall Experience, Features, Performance, etc.)
- **Optional Comments**: Users can provide detailed feedback
- **Context Tracking**: System captures context (page, action, feature) for better insights

### 2. Satisfaction Metrics
- **Average Rating**: Overall satisfaction score across all feedback
- **Net Promoter Score (NPS)**: Industry-standard metric for customer loyalty
- **Rating Distribution**: Breakdown of 1-5 star ratings
- **Category Breakdown**: Satisfaction scores by feature category
- **Trend Analysis**: Historical satisfaction trends over time

### 3. Smart Prompting
- **Automatic Prompts**: System intelligently prompts users at appropriate times
- **Frequency Control**: Prevents over-prompting (max once per 7 days)
- **Action-Based Triggers**: Prompts after key actions (price updates, syncs, etc.)
- **User Respect**: Stops prompting users who consistently ignore feedback requests

## Feedback Categories

The system tracks satisfaction across these categories:

- **OVERALL_EXPERIENCE**: General satisfaction with PricePilot
- **EASE_OF_USE**: How easy the platform is to use
- **PERFORMANCE**: System speed and reliability
- **FEATURES**: Satisfaction with available features
- **SUPPORT**: Quality of customer support
- **DOCUMENTATION**: Helpfulness of documentation
- **PRICE_UPDATES**: Price update functionality
- **PRODUCT_MATCHING**: Product matching accuracy
- **SCRAPING_ACCURACY**: Competitor data accuracy
- **DASHBOARD_UI**: Dashboard user interface
- **NOTIFICATIONS**: Notification system
- **SECURITY**: Security features
- **RELIABILITY**: System uptime and stability

## For Users

### Providing Feedback

1. **Automatic Prompts**: You'll occasionally see a feedback prompt in the bottom-right corner
2. **Manual Feedback**: Click the "Give Feedback" button (if available on your page)
3. **Rate Your Experience**: Select 1-5 stars
4. **Add Comments** (Optional): Share specific feedback or suggestions
5. **Submit**: Click "Submit" to send your feedback

### Feedback Best Practices

- **Be Specific**: Mention specific features or issues
- **Be Constructive**: Suggest improvements rather than just complaints
- **Be Honest**: Your genuine feedback helps us improve
- **Include Context**: Mention what you were doing when you encountered an issue

## For Administrators

### Viewing Satisfaction Metrics

Navigate to **Admin > Satisfaction** to view:

1. **Key Metrics Dashboard**
   - Average rating (target: >4.5/5)
   - Total responses
   - Net Promoter Score
   - Trend direction

2. **Satisfaction Trend Chart**
   - Historical satisfaction over time
   - Identify patterns and changes
   - View 7, 30, or 90-day trends

3. **Rating Distribution**
   - See how many users gave each rating
   - Identify areas of concern (low ratings)

4. **Category Breakdown**
   - Satisfaction by feature category
   - Identify strongest and weakest areas

5. **Recent Feedback**
   - Read user comments
   - Understand specific issues
   - Track sentiment

### Interpreting Metrics

#### Average Rating
- **5.0 - 4.5**: Excellent (Target achieved)
- **4.4 - 4.0**: Good (Room for improvement)
- **3.9 - 3.0**: Fair (Action needed)
- **< 3.0**: Poor (Urgent action required)

#### Net Promoter Score (NPS)
- **> 50**: Excellent
- **30 - 50**: Good
- **0 - 30**: Fair
- **< 0**: Poor

#### Rating Distribution
- **Promoters** (5 stars): Loyal, enthusiastic users
- **Passives** (4 stars): Satisfied but not enthusiastic
- **Detractors** (1-3 stars): Unhappy users at risk of churning

### Taking Action on Feedback

1. **Monitor Trends**: Check satisfaction dashboard weekly
2. **Read Comments**: Review recent feedback for specific issues
3. **Identify Patterns**: Look for recurring themes in feedback
4. **Prioritize Issues**: Focus on categories with lowest scores
5. **Track Improvements**: Monitor if changes improve satisfaction
6. **Respond to Detractors**: Reach out to users with low ratings

### Improving Satisfaction Scores

#### Quick Wins
- Fix reported bugs promptly
- Improve documentation for confusing features
- Optimize slow-performing pages
- Enhance error messages
- Add requested features

#### Long-Term Strategies
- Regular user surveys
- Beta testing new features
- User onboarding improvements
- Performance optimization
- Feature education

## API Endpoints

### Submit Feedback
```
POST /api/v1/feedback/submit
```

**Request Body:**
```json
{
  "rating": 5,
  "category": "OVERALL_EXPERIENCE",
  "feature": "price-updates",
  "comment": "Love the new rollback feature!",
  "context": {
    "page": "/dashboard/products",
    "action": "price_update"
  }
}
```

### Get Satisfaction Score
```
GET /api/v1/feedback/score?startDate=2026-01-01&endDate=2026-02-01
```

**Response:**
```json
{
  "success": true,
  "data": {
    "averageRating": 4.65,
    "totalResponses": 150,
    "nps": 62.5,
    "promoters": 120,
    "passives": 20,
    "detractors": 10,
    "ratingDistribution": {
      "1": 5,
      "2": 3,
      "3": 2,
      "4": 20,
      "5": 120
    }
  }
}
```

### Get Satisfaction Trend
```
GET /api/v1/feedback/trend?days=30
```

### Get Feedback by Category
```
GET /api/v1/feedback/by-category
```

### Get Recent Feedback
```
GET /api/v1/feedback/recent?limit=50
```

### Check if Should Prompt User
```
GET /api/v1/feedback/should-prompt
```

## Database Schema

### UserFeedback
Stores individual feedback submissions:
- `rating`: 1-5 star rating
- `category`: Feedback category
- `feature`: Specific feature (optional)
- `comment`: User comment (optional)
- `sentiment`: positive/neutral/negative
- `context`: Additional context data
- `resolved`: Whether feedback has been addressed

### SatisfactionMetric
Daily aggregated metrics:
- `date`: Metric date
- `averageRating`: Average rating for the day
- `totalResponses`: Number of responses
- `nps`: Net Promoter Score
- `ratingDistribution`: Count of each rating
- `categoryBreakdown`: Scores by category
- `featureBreakdown`: Scores by feature

### UserFeedbackHistory
Tracks user feedback patterns:
- `lastPromptedAt`: When user was last prompted
- `promptCount`: Total prompts shown
- `responseCount`: Total responses submitted
- `averageRating`: User's average rating

## Best Practices

### For Development Team
1. **Monitor Daily**: Check satisfaction dashboard daily
2. **Act on Feedback**: Address issues raised in comments
3. **Track Changes**: Monitor impact of updates on satisfaction
4. **Celebrate Wins**: Share positive feedback with team
5. **Learn from Detractors**: Use negative feedback to improve

### For Product Team
1. **Feature Prioritization**: Use feedback to prioritize features
2. **User Research**: Follow up with users who provide detailed feedback
3. **A/B Testing**: Test changes with subset of users first
4. **Communication**: Keep users informed of improvements

### For Support Team
1. **Proactive Outreach**: Contact users with low ratings
2. **Issue Resolution**: Help users resolve their concerns
3. **Feedback Loop**: Share common issues with development team
4. **Follow-up**: Check if users are satisfied after resolution

## Success Criteria

The project aims to maintain:
- **Average Rating**: > 4.5/5 stars
- **NPS**: > 50
- **Response Rate**: > 10% of active users
- **Trend**: Positive or stable over time

## Troubleshooting

### Low Satisfaction Scores

**Problem**: Average rating below 4.5

**Solutions**:
1. Review recent feedback comments
2. Identify common complaints
3. Prioritize fixes for most-mentioned issues
4. Communicate improvements to users
5. Follow up with detractors

### Low Response Rate

**Problem**: Not enough users providing feedback

**Solutions**:
1. Increase prompt frequency (carefully)
2. Add feedback buttons to more pages
3. Incentivize feedback (if appropriate)
4. Make feedback process easier
5. Explain value of feedback to users

### Negative Trend

**Problem**: Satisfaction declining over time

**Solutions**:
1. Identify when decline started
2. Correlate with recent changes/updates
3. Review feedback from that period
4. Roll back problematic changes
5. Communicate with users about issues

## Related Documentation

- [Admin Dashboard Guide](./ADMIN_GUIDE.md)
- [Monitoring System](./MONITORING_SYSTEM.md)
- [User Documentation](../DOCUMENTATION.md)
- [API Documentation](./API_DOCUMENTATION_INDEX.md)

## Support

For questions about the satisfaction tracking system:
- Review this documentation
- Check the admin dashboard
- Contact the development team
- Review API documentation

---

**Last Updated**: February 2026
**Version**: 1.5
