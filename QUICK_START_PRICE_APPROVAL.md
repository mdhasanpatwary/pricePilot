# Quick Start: Price Approval Workflow

## 🚀 Get Started in 5 Minutes

### Step 1: Run Database Migration (1 min)

```bash
# Generate Prisma client
npx prisma generate

# Run migration
npx prisma migrate dev --name add_price_approval_workflow
```

### Step 2: Set Environment Variable (30 sec)

Add to `.env`:
```bash
CRON_SECRET=your-random-secret-here
```

Generate a secure secret:
```bash
openssl rand -base64 32
```

### Step 3: Deploy (2 min)

```bash
# For Vercel
vercel --prod

# Or push to your deployment branch
git add .
git commit -m "Add price approval workflow"
git push origin main
```

### Step 4: Test (1 min)

1. Navigate to `/dashboard/price-approvals`
2. Run a sync (or wait for scheduled sync)
3. Check for pending approvals
4. Approve/reject a change
5. Verify it updates your store

### Step 5: Done! ✅

You're all set! Price changes now require manual approval.

---

## 📖 Common Tasks

### View Pending Approvals
```bash
# Via UI
https://your-domain.com/dashboard/price-approvals

# Via API
curl https://your-domain.com/api/v1/price-approvals?status=PENDING \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN"
```

### Approve Changes
```bash
# Via UI
Click "Approve" button in dashboard

# Via API
curl -X POST https://your-domain.com/api/v1/price-approvals \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN" \
  -d '{
    "action": "approve",
    "changeIds": ["change-id-1", "change-id-2"]
  }'
```

### Reject Changes
```bash
# Via UI
Click "Reject" button in dashboard

# Via API
curl -X POST https://your-domain.com/api/v1/price-approvals \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN" \
  -d '{
    "action": "reject",
    "changeIds": ["change-id-3"]
  }'
```

### Check Pending Count
```bash
curl https://your-domain.com/api/v1/price-approvals/count \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN"
```

### Manually Trigger Cleanup
```bash
curl https://your-domain.com/api/v1/cron/cleanup-expired-approvals \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

---

## 🔍 Troubleshooting

### No Pending Approvals?

**Check if sync has run:**
```sql
SELECT * FROM "SyncLog" ORDER BY "createdAt" DESC LIMIT 10;
```

**Check if rules are active:**
```sql
SELECT * FROM "PricingRule" WHERE "isActive" = true;
```

**Check if products are matched:**
```sql
SELECT COUNT(*) FROM "ProductMatch" WHERE status = 'APPROVED';
```

### Changes Not Applying?

**Check store integration:**
```sql
SELECT * FROM "Site" WHERE type = 'USER';
```

**Check API token:**
- Verify `apiToken` is set in Site record
- Test API endpoint manually

**Check sync logs:**
```sql
SELECT * FROM "SyncLog" WHERE level = 'ERROR' ORDER BY "createdAt" DESC;
```

### Database Issues?

**Check if table exists:**
```sql
SELECT * FROM "PendingPriceChange" LIMIT 1;
```

**Check indexes:**
```sql
SELECT indexname FROM pg_indexes WHERE tablename = 'PendingPriceChange';
```

**Verify foreign keys:**
```sql
SELECT * FROM information_schema.table_constraints 
WHERE table_name = 'PendingPriceChange' AND constraint_type = 'FOREIGN KEY';
```

---

## 💡 Pro Tips

### Bulk Approve Trusted Rules
If you have a rule you always approve (e.g., "Match competitor"), you can:
1. Filter by that rule in the UI
2. Select all
3. Bulk approve

### Set Up Daily Review Routine
- Check approvals every morning
- Approve/reject within 24 hours
- Prevents queue buildup

### Monitor Expiration Rate
If many changes expire without action:
- Your rules might be too aggressive
- Increase thresholds
- Focus on important products

### Use API for Automation
Build custom scripts to:
- Auto-approve small changes (< 5%)
- Send Slack notifications
- Generate reports
- Integrate with other systems

---

## 📚 Learn More

- **Technical Details:** `PRICE_APPROVAL_WORKFLOW.md`
- **Migration Guide:** `MIGRATION_GUIDE_PRICE_APPROVAL.md`
- **User Guide:** `docs/PRICE_APPROVAL_GUIDE.md`
- **Visual Flow:** `PRICE_APPROVAL_FLOW.md`
- **Implementation Summary:** `IMPLEMENTATION_SUMMARY.md`

---

## 🆘 Need Help?

1. Check the documentation (links above)
2. Review the code:
   - `lib/services/rules-engine.ts`
   - `app/api/v1/price-approvals/route.ts`
   - `app/dashboard/price-approvals/page.tsx`
3. Check database records
4. Review logs
5. Contact support

---

## ✅ Verification Checklist

After setup, verify:

- [ ] Database migration completed successfully
- [ ] `PendingPriceChange` table exists
- [ ] `CRON_SECRET` environment variable set
- [ ] Cron jobs configured in Vercel
- [ ] Dashboard accessible at `/dashboard/price-approvals`
- [ ] Navigation link appears in sidebar
- [ ] Sync creates pending changes (not auto-applies)
- [ ] Approve button works
- [ ] Reject button works
- [ ] Approved changes push to store
- [ ] Rejected changes stay unchanged
- [ ] API endpoints return correct data
- [ ] Tenant isolation works (can't see other tenants' changes)

---

## 🎉 Success!

You've successfully implemented the price approval workflow! Your store prices are now protected from automatic updates, and you have full control over every price change.

**What's Next?**
- Train your team on the new workflow
- Set up daily approval routine
- Monitor usage and gather feedback
- Plan for future enhancements (auto-approval rules, notifications, etc.)

Happy pricing! 💰
