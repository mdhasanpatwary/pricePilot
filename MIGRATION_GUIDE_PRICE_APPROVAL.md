# Migration Guide: Price Approval Workflow

## Overview
This guide helps you migrate from the old auto-push system to the new manual approval workflow.

## Pre-Migration Checklist

- [ ] Backup your database
- [ ] Review current pricing rules
- [ ] Notify your team about the change
- [ ] Set up `CRON_SECRET` environment variable
- [ ] Test in staging environment first

## Migration Steps

### Step 1: Database Migration

Run the Prisma migration to create the new tables:

```bash
# Generate Prisma client with new schema
npx prisma generate

# Create and apply migration
npx prisma migrate dev --name add_price_approval_workflow

# Or for production
npx prisma migrate deploy
```

This creates:
- `PendingPriceChange` table
- `ApprovalStatus` enum
- Required indexes and foreign keys

### Step 2: Environment Variables

Add to your `.env` file:

```bash
# Secret for cron job authentication
CRON_SECRET=your-random-secret-key-here
```

Generate a secure secret:
```bash
openssl rand -base64 32
```

### Step 3: Deploy Code Changes

Deploy the updated code to your environment:

```bash
# For Vercel
vercel --prod

# Or your deployment method
git push origin main
```

### Step 4: Verify Cron Jobs

Check that Vercel cron jobs are configured:

1. Go to Vercel Dashboard
2. Select your project
3. Go to Settings → Cron Jobs
4. Verify these jobs exist:
   - `/api/cron/global-sync` - Daily at midnight
   - `/api/v1/cron/cleanup-expired-approvals` - Daily at 2 AM

### Step 5: Test the Workflow

1. **Trigger a sync:**
   ```bash
   curl -X POST https://your-domain.com/api/v1/sync/full \
     -H "Authorization: Bearer YOUR_API_KEY"
   ```

2. **Check pending approvals:**
   - Navigate to `/dashboard/price-approvals`
   - Verify changes are queued (not auto-applied)

3. **Test approval:**
   - Select a pending change
   - Click "Approve"
   - Verify it updates your store

4. **Test rejection:**
   - Select a pending change
   - Click "Reject"
   - Verify price stays unchanged

### Step 6: Update Documentation

Update your internal documentation to reflect:
- New approval workflow
- Daily review process
- Team responsibilities
- Escalation procedures

## Rollback Plan

If you need to rollback:

### Option 1: Revert Code (Recommended)
```bash
git revert <commit-hash>
git push origin main
```

### Option 2: Database Rollback
```bash
# Revert migration
npx prisma migrate resolve --rolled-back add_price_approval_workflow

# Drop tables manually if needed
psql $DATABASE_URL -c "DROP TABLE IF EXISTS \"PendingPriceChange\" CASCADE;"
psql $DATABASE_URL -c "DROP TYPE IF EXISTS \"ApprovalStatus\";"
```

### Option 3: Temporary Auto-Approve

Create a script to auto-approve all pending changes:

```typescript
// scripts/auto-approve-all.ts
import { prisma } from "@/lib/prisma";
import { RulesEngine } from "@/lib/services/rules-engine";

async function autoApproveAll() {
  const pending = await prisma.pendingPriceChange.findMany({
    where: { status: "PENDING" },
    select: { id: true },
  });

  const ids = pending.map(p => p.id);
  
  if (ids.length > 0) {
    await RulesEngine.applyApprovedChanges(ids, "auto-approve-script");
    console.log(`Auto-approved ${ids.length} changes`);
  }
}

autoApproveAll();
```

## Post-Migration

### Monitor for Issues

**Week 1:**
- Check pending approvals daily
- Monitor store price updates
- Verify sync logs
- Collect team feedback

**Week 2-4:**
- Review approval patterns
- Adjust pricing rules if needed
- Optimize approval workflow
- Train team members

### Common Issues

**Issue: Too many pending approvals**
- Solution: Adjust pricing rule thresholds
- Solution: Use bulk approve for trusted rules

**Issue: Changes not applying to store**
- Check: Store integration is connected
- Check: API token is valid
- Check: Sync logs for errors

**Issue: Expired changes piling up**
- Solution: Review more frequently
- Solution: Adjust expiration time (code change needed)

## Team Training

### For Admins
- How to review pending changes
- When to approve vs reject
- Bulk operations best practices
- Monitoring and reporting

### For Managers
- Understanding price change reasons
- Business impact of approvals
- Setting approval policies
- Escalation procedures

### For Developers
- API endpoints for automation
- Integration with other systems
- Custom approval rules (future)
- Troubleshooting guide

## Success Metrics

Track these metrics post-migration:

- **Approval Rate**: % of changes approved vs rejected
- **Response Time**: Time from queue to approval
- **Store Update Success**: % of approved changes successfully pushed
- **Expired Changes**: Number of changes expiring without action
- **Team Satisfaction**: Feedback from users

## Support

If you encounter issues:

1. Check the logs: `/dashboard/activity`
2. Review sync logs for the site
3. Check API responses in browser console
4. Contact support with:
   - Error messages
   - Steps to reproduce
   - Screenshots
   - Tenant ID

## Next Steps

After successful migration:

- [ ] Set up daily approval routine
- [ ] Configure Slack/email notifications (if available)
- [ ] Create approval policies for your team
- [ ] Document your specific workflow
- [ ] Plan for future enhancements (auto-approval rules)

## FAQ

**Q: Will existing price changes be affected?**
A: No, only new changes after migration will require approval.

**Q: Can we auto-approve certain rules?**
A: Not yet, but this feature is planned for a future release.

**Q: What happens during the migration?**
A: No downtime. Existing prices remain unchanged. New changes will be queued.

**Q: How long does migration take?**
A: Database migration: < 1 minute. Full deployment: 5-10 minutes.

**Q: Can we test without affecting production?**
A: Yes, test in a staging environment first with a copy of your data.

## Conclusion

The price approval workflow adds an important safety layer to your pricing automation. While it requires a bit more manual work, it gives you complete control over price changes and prevents unwanted updates.

Take your time with the migration, test thoroughly, and train your team. The benefits of controlled pricing far outweigh the small overhead of daily approvals.

Good luck! 🚀
