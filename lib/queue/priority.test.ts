import { calculateJobPriority } from "./priority";
import { TenantTier } from "@/lib/auth/types";

async function testPriority() {
  console.log("🧪 Testing Priority Engine...");

  const scenarios = [
    { name: "Enterprise Small Job", tenantTier: "ENTERPRISE", jobSize: 1, expected: "High Priority" },
    { name: "Free Large Job", tenantTier: "FREE", jobSize: 1000, expected: "Low Priority" },
    { name: "Pro Medium Job", tenantTier: "PRO", jobSize: 100, expected: "Medium Priority" },
    { name: "Manual Boost", tenantTier: "FREE", jobSize: 1000, manualBoost: 5, expected: "Medium-High Priority" },
  ];

  for (const s of scenarios) {
    const p = calculateJobPriority({
      tenantTier: s.tenantTier as any,
      jobSize: s.jobSize,
      manualBoost: s.manualBoost
    });
    console.log(`- ${s.name.padEnd(20)}: Priority Score = ${p}`);
  }

  // Assertion logic for key invariants
  const p1 = calculateJobPriority({ tenantTier: "ENTERPRISE", jobSize: 1 });
  const p2 = calculateJobPriority({ tenantTier: "FREE", jobSize: 1000 });

  if (p1 < p2) {
    console.log("✅ Assertion Passed: Enterprise Small Job has higher priority (lower score) than Free Large Job.");
  } else {
    console.error("❌ Assertion Failed: Priority inversion detected.");
    process.exit(1);
  }
}

testPriority().catch(console.error);
