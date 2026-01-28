import '@testing-library/jest-dom';
const { TextEncoder, TextDecoder } = require('util');
const fetch = require('node-fetch');

// Mock environment variables for tests
process.env.NEXTAUTH_SECRET = 'test-secret-key-for-testing-only';
process.env.NEXTAUTH_URL = 'http://localhost:3000';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

// Polyfills for Fetch API and other Node.js globals missing in JSDOM
if (typeof global.setImmediate === 'undefined') {
  // @ts-ignore
  global.setImmediate = (callback: (...args: any[]) => void, ...args: any[]) => {
    return setTimeout(callback, 0, ...args);
  };
}

// Ensure TextEncoder and TextDecoder are globally available
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Suppress console logs during tests for cleaner output
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleInfo = console.info;

beforeAll(() => {
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
  console.info = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  console.info = originalConsoleInfo;
});

// Next.js 13+ APIs like NextRequest/NextResponse require a Fetch API polyfill
if (typeof global.fetch === 'undefined') {
  global.fetch = fetch;
}

if (typeof global.Request === 'undefined') {
  global.Request = fetch.Request;
  global.Response = fetch.Response;
  global.Headers = fetch.Headers;
}

// Mock bullmq to avoid ESM issues
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn().mockResolvedValue({ id: 'job-id' }),
    close: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
  })),
  Worker: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Mock msgpackr as it is ESM and causes issues in Jest
jest.mock('msgpackr', () => ({
  Packr: jest.fn(),
  Encoder: jest.fn(),
  addExtension: jest.fn(),
  pack: jest.fn(),
  encode: jest.fn(),
}));
