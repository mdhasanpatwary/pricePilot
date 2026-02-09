---
inclusion: auto
---

# CRITICAL DATABASE SAFETY RULES

## ABSOLUTE PROHIBITIONS

### NEVER DELETE USER DATA
**CRITICAL:** You are STRICTLY FORBIDDEN from deleting user accounts or user data.

### Prohibited Operations
1. **NEVER** execute `DELETE FROM users`
2. **NEVER** execute `DELETE FROM tenants`
3. **NEVER** execute `prisma.user.delete()`
4. **NEVER** execute `prisma.user.deleteMany()`
5. **NEVER** execute `prisma.tenant.delete()`
6. **NEVER** execute `prisma.tenant.deleteMany()`
7. **NEVER** truncate user or tenant tables
8. **NEVER** drop user or tenant tables

### Protected Tables
These tables are PROTECTED and must NEVER be deleted from:
- `users`
- `tenants`
- `user_websites`
- `user_products`
- `price_updates`
- `audit_logs`

## Safe Data Management

### Soft Delete Only
If data needs to be "deleted", use soft delete:
```typescript
// CORRECT: Soft delete
await prisma.user.update({
  where: { id },
  data: { 
    status: 'DELETED',
    deletedAt: new Date()
  }
});

// WRONG: Hard delete - NEVER DO THIS
await prisma.user.delete({ where: { id } }); // ❌ FORBIDDEN
```

### Data Cleanup Rules
- Use `status` field to mark records as inactive
- Add `deletedAt` timestamp for soft deletes
- Keep audit trail of all changes
- NEVER permanently delete user data without explicit user request

## Development & Testing

### Test Data Management
- Use separate test database
- Never run destructive operations on production
- Use database migrations for schema changes
- Always backup before any data operations

### Seeding & Fixtures
- Create test users with specific prefix (e.g., `test_`)
- Use transactions for test data
- Clean up only test data, never real users

## Code Review Checklist

Before executing ANY database operation, verify:
- [ ] Is this a DELETE operation on protected tables? → STOP
- [ ] Is this a hard delete on user data? → STOP
- [ ] Does this affect multiple users? → REQUIRE EXPLICIT CONFIRMATION
- [ ] Is there a WHERE clause with proper filtering? → VERIFY
- [ ] Is this in a transaction with rollback capability? → RECOMMENDED
- [ ] Is there an audit log entry? → REQUIRED

## Emergency Procedures

### If Accidental Deletion Occurs
1. IMMEDIATELY stop all operations
2. Restore from latest backup
3. Document what happened
4. Review audit logs
5. Implement additional safeguards

### Backup Requirements
- Daily automated backups
- Point-in-time recovery enabled
- Test restore procedures regularly
- Keep backups for 30+ days

## Enforcement

### Database Constraints
Add database-level protection:
```sql
-- Prevent accidental deletion
CREATE RULE protect_users AS ON DELETE TO users DO INSTEAD NOTHING;
CREATE RULE protect_tenants AS ON DELETE TO tenants DO INSTEAD NOTHING;
```

### Application-Level Guards
```typescript
// Add middleware to block dangerous operations
const protectedTables = ['users', 'tenants', 'user_websites'];

function validateQuery(query: string) {
  const dangerous = /DELETE\s+FROM\s+(users|tenants)/i;
  if (dangerous.test(query)) {
    throw new Error('FORBIDDEN: Cannot delete from protected tables');
  }
}
```

## When User Deletion IS Allowed

Only under these strict conditions:
1. User explicitly requests account deletion
2. Proper authentication and authorization verified
3. Confirmation dialog completed
4. Audit log entry created BEFORE deletion
5. Data exported for user (GDPR compliance)
6. Soft delete performed first
7. Hard delete only after retention period

## Summary

**REMEMBER:** When in doubt, DO NOT DELETE. Use soft deletes, status flags, and archiving instead of permanent deletion.

**GOLDEN RULE:** Treat user data as sacred. Deletion is irreversible and catastrophic.
