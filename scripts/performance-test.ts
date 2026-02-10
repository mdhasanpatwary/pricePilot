import axios from 'axios';

const ENDPOINT = 'http://localhost:3000/api/v1/competitors';
const CONCURRENT_REQUESTS = 50;
const TOTAL_REQUESTS = 200;

async function runTest() {
  console.log(`Starting performance test on ${ENDPOINT}...`);
  console.log(`Concurrent: ${CONCURRENT_REQUESTS}, Total: ${TOTAL_REQUESTS}`);

  const start = Date.now();
  const latencies: number[] = [];

  const runBatch = async (size: number) => {
    const promises = Array.from({ length: size }).map(async () => {
      const reqStart = Date.now();
      try {
        await axios.get(ENDPOINT, {
          headers: {
            'Cookie': process.env.TEST_SESSION_COOKIE // Need a valid session for testing
          }
        });
        latencies.push(Date.now() - reqStart);
      } catch (error: any) {
        console.error(`Request failed: ${error.message}`);
      }
    });
    await Promise.all(promises);
  };

  for (let i = 0; i < TOTAL_REQUESTS; i += CONCURRENT_REQUESTS) {
    await runBatch(CONCURRENT_REQUESTS);
  }

  const duration = Date.now() - start;
  latencies.sort((a, b) => a - b);

  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];

  console.log('\nResults:');
  console.log(`- Total Duration: ${duration}ms`);
  console.log(`- Average Latency: ${avg.toFixed(2)}ms`);
  console.log(`- p95 Latency: ${p95}ms`);
  console.log(`- p99 Latency: ${p99}ms`);
}

runTest().catch(console.error);
