import { classifyRetryError, maxRetriesForError, RetryErrorType } from "./retry-utils";

async function runTests() {
  console.log("🧪 Testing retry-utils classification and limits...");

  const cases: Array<{msg: string; expected: RetryErrorType}> = [
    {msg: "Validation failed on input", expected: "VALIDATION"},
    {msg: "Rate limit exceeded", expected: "RATE_LIMIT"},
    {msg: "Network timeout occurred", expected: "TRANSIENT"},
    {msg: "ECONNRESET" , expected: "TRANSIENT"},
    {msg: "Unknown server error 500", expected: "PERMANENT"},
  ];

  for (const c of cases) {
    const result = classifyRetryError(c.msg);
    console.log(`- '${c.msg}' -> ${result}`);
    if (result !== c.expected) {
      console.error(`❌ Expected ${c.expected} but got ${result}`);
      process.exit(1);
    }
  }

  // test limits
  const limits: Record<RetryErrorType, number> = {
    TRANSIENT: 5,
    RATE_LIMIT: 3,
    VALIDATION: 0,
    PERMANENT: 0,
  };

  for (const type of Object.keys(limits) as RetryErrorType[]) {
    const max = maxRetriesForError(type);
    console.log(`- max retries for ${type} = ${max}`);
    if (max !== limits[type]) {
      console.error(`❌ Unexpected maxRetries for ${type}`);
      process.exit(1);
    }
  }

  console.log("✅ retry-utils tests passed.");
}

runTests().catch(console.error);
