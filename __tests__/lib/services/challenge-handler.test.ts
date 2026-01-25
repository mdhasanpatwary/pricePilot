import { ChallengeHandler } from '@/lib/services/challenge-handler';
import { Page } from 'playwright';

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('ChallengeHandler', () => {
  let handler: ChallengeHandler;

  beforeEach(() => {
    handler = new ChallengeHandler();
  });

  describe('detectChallenge', () => {
    it('should detect Cloudflare challenge', async () => {
      const mockPage = {
        evaluate: jest.fn().mockResolvedValueOnce(true), // Cloudflare check
      } as unknown as Page;

      const result = await handler.detectChallenge(mockPage);

      expect(result.detected).toBe(true);
      expect(result.type).toBe('cloudflare');
      expect(result.solved).toBe(false);
    });

    it('should detect Turnstile challenge', async () => {
      const mockPage = {
        evaluate: jest.fn()
          .mockResolvedValueOnce(false) // Cloudflare check
          .mockResolvedValueOnce(true), // Turnstile check
      } as unknown as Page;

      const result = await handler.detectChallenge(mockPage);

      expect(result.detected).toBe(true);
      expect(result.type).toBe('turnstile');
      expect(result.solved).toBe(false);
    });

    it('should detect reCAPTCHA challenge', async () => {
      const mockPage = {
        evaluate: jest.fn()
          .mockResolvedValueOnce(false) // Cloudflare check
          .mockResolvedValueOnce(false) // Turnstile check
          .mockResolvedValueOnce(true), // reCAPTCHA check
      } as unknown as Page;

      const result = await handler.detectChallenge(mockPage);

      expect(result.detected).toBe(true);
      expect(result.type).toBe('recaptcha');
      expect(result.solved).toBe(false);
    });

    it('should detect PerimeterX challenge', async () => {
      const mockPage = {
        evaluate: jest.fn()
          .mockResolvedValueOnce(false) // Cloudflare check
          .mockResolvedValueOnce(false) // Turnstile check
          .mockResolvedValueOnce(false) // reCAPTCHA check
          .mockResolvedValueOnce(true), // PerimeterX check
      } as unknown as Page;

      const result = await handler.detectChallenge(mockPage);

      expect(result.detected).toBe(true);
      expect(result.type).toBe('perimeter-x');
      expect(result.solved).toBe(false);
    });

    it('should detect DataDome challenge', async () => {
      const mockPage = {
        evaluate: jest.fn()
          .mockResolvedValueOnce(false) // Cloudflare check
          .mockResolvedValueOnce(false) // Turnstile check
          .mockResolvedValueOnce(false) // reCAPTCHA check
          .mockResolvedValueOnce(false) // PerimeterX check
          .mockResolvedValueOnce(true), // DataDome check
      } as unknown as Page;

      const result = await handler.detectChallenge(mockPage);

      expect(result.detected).toBe(true);
      expect(result.type).toBe('datadome');
      expect(result.solved).toBe(false);
    });

    it('should return no challenge detected when no challenges present', async () => {
      const mockPage = {
        evaluate: jest.fn().mockResolvedValue(false), // All checks return false
      } as unknown as Page;

      const result = await handler.detectChallenge(mockPage);

      expect(result.detected).toBe(false);
      expect(result.type).toBe('unknown');
      expect(result.solved).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      const mockPage = {
        evaluate: jest.fn().mockRejectedValue(new Error('Page error')),
      } as unknown as Page;

      const result = await handler.detectChallenge(mockPage);

      expect(result.detected).toBe(false);
      expect(result.type).toBe('unknown');
      expect(result.solved).toBe(false);
    });
  });

  describe('waitForChallenge', () => {
    it('should return immediately if no challenge detected', async () => {
      const mockPage = {
        evaluate: jest.fn().mockResolvedValue(false),
      } as unknown as Page;

      const startTime = Date.now();
      const result = await handler.waitForChallenge(mockPage, 10000);
      const duration = Date.now() - startTime;

      expect(result.solved).toBe(true);
      expect(duration).toBeLessThan(1000);
    });

    it('should wait with exponential backoff when challenge detected', async () => {
      const mockPage = {
        evaluate: jest.fn()
          .mockResolvedValueOnce(true) // Initial detection - Cloudflare
          .mockResolvedValueOnce(true) // First check - still present
          .mockResolvedValueOnce(false), // Second check - solved
        url: jest.fn().mockReturnValue('https://example.com'),
      } as unknown as Page;

      const startTime = Date.now();
      const result = await handler.waitForChallenge(mockPage, 10000);
      const duration = Date.now() - startTime;

      expect(result.detected).toBe(true);
      expect(result.solved).toBe(true);
      expect(result.attempts).toBeGreaterThan(0);
      expect(duration).toBeGreaterThanOrEqual(2000); // At least first backoff delay
    });

    it('should timeout after max wait time', async () => {
      const mockPage = {
        evaluate: jest.fn().mockResolvedValue(true), // Always returns challenge present
        url: jest.fn().mockReturnValue('https://example.com/challenge'),
      } as unknown as Page;

      const maxWaitTime = 3000;
      const startTime = Date.now();
      const result = await handler.waitForChallenge(mockPage, maxWaitTime);
      const duration = Date.now() - startTime;

      expect(result.detected).toBe(true);
      expect(result.solved).toBe(false);
      expect(duration).toBeGreaterThanOrEqual(maxWaitTime);
    }, 10000); // Increase test timeout to 10 seconds
  });

  describe('recordChallengeAttempt and getChallengeStats', () => {
    it('should record challenge attempts', () => {
      handler.recordChallengeAttempt('example.com', {
        detected: true,
        type: 'cloudflare',
        solved: true,
        attempts: 2,
        duration: 5000,
      });

      const stats = handler.getChallengeStats('example.com');

      expect(stats).toHaveLength(1);
      expect(stats[0].site).toBe('example.com');
      expect(stats[0].challengeType).toBe('cloudflare');
      expect(stats[0].totalAttempts).toBe(1);
      expect(stats[0].successfulSolves).toBe(1);
    });

    it('should calculate solve rate correctly', () => {
      // Record 3 successful and 2 failed attempts
      handler.recordChallengeAttempt('example.com', {
        detected: true,
        type: 'turnstile',
        solved: true,
        attempts: 1,
        duration: 3000,
      });
      handler.recordChallengeAttempt('example.com', {
        detected: true,
        type: 'turnstile',
        solved: true,
        attempts: 2,
        duration: 4000,
      });
      handler.recordChallengeAttempt('example.com', {
        detected: true,
        type: 'turnstile',
        solved: true,
        attempts: 1,
        duration: 2000,
      });
      handler.recordChallengeAttempt('example.com', {
        detected: true,
        type: 'turnstile',
        solved: false,
        attempts: 5,
        duration: 30000,
      });
      handler.recordChallengeAttempt('example.com', {
        detected: true,
        type: 'turnstile',
        solved: false,
        attempts: 5,
        duration: 30000,
      });

      const stats = handler.getChallengeStats('example.com');

      expect(stats).toHaveLength(1);
      expect(stats[0].totalAttempts).toBe(5);
      expect(stats[0].successfulSolves).toBe(3);
      expect(stats[0].solveRate).toBeCloseTo(0.6, 2);
    });

    it('should calculate average solve time for successful attempts', () => {
      handler.recordChallengeAttempt('test.com', {
        detected: true,
        type: 'recaptcha',
        solved: true,
        attempts: 1,
        duration: 2000,
      });
      handler.recordChallengeAttempt('test.com', {
        detected: true,
        type: 'recaptcha',
        solved: true,
        attempts: 2,
        duration: 4000,
      });
      handler.recordChallengeAttempt('test.com', {
        detected: true,
        type: 'recaptcha',
        solved: false,
        attempts: 5,
        duration: 30000,
      });

      const stats = handler.getChallengeStats('test.com');

      expect(stats[0].avgSolveTime).toBe(3000); // (2000 + 4000) / 2
    });

    it('should return empty array for site with no attempts', () => {
      const stats = handler.getChallengeStats('nonexistent.com');

      expect(stats).toHaveLength(0);
    });

    it('should group stats by challenge type', () => {
      handler.recordChallengeAttempt('multi.com', {
        detected: true,
        type: 'cloudflare',
        solved: true,
        attempts: 1,
        duration: 3000,
      });
      handler.recordChallengeAttempt('multi.com', {
        detected: true,
        type: 'turnstile',
        solved: true,
        attempts: 2,
        duration: 4000,
      });

      const stats = handler.getChallengeStats('multi.com');

      expect(stats).toHaveLength(2);
      expect(stats.map(s => s.challengeType)).toContain('cloudflare');
      expect(stats.map(s => s.challengeType)).toContain('turnstile');
    });
  });

  describe('shouldTriggerFallback', () => {
    it('should return false when no attempts recorded', () => {
      const shouldTrigger = handler.shouldTriggerFallback('example.com');

      expect(shouldTrigger).toBe(false);
    });

    it('should return false when solve rate is above threshold', () => {
      // Record 8 successful and 2 failed (80% solve rate)
      for (let i = 0; i < 8; i++) {
        handler.recordChallengeAttempt('good.com', {
          detected: true,
          type: 'cloudflare',
          solved: true,
          attempts: 1,
          duration: 3000,
        });
      }
      for (let i = 0; i < 2; i++) {
        handler.recordChallengeAttempt('good.com', {
          detected: true,
          type: 'cloudflare',
          solved: false,
          attempts: 5,
          duration: 30000,
        });
      }

      const shouldTrigger = handler.shouldTriggerFallback('good.com');

      expect(shouldTrigger).toBe(false);
    });

    it('should return true when solve rate drops below threshold', () => {
      // Record 2 successful and 8 failed (20% solve rate, below 30% threshold)
      for (let i = 0; i < 2; i++) {
        handler.recordChallengeAttempt('bad.com', {
          detected: true,
          type: 'turnstile',
          solved: true,
          attempts: 1,
          duration: 3000,
        });
      }
      for (let i = 0; i < 8; i++) {
        handler.recordChallengeAttempt('bad.com', {
          detected: true,
          type: 'turnstile',
          solved: false,
          attempts: 5,
          duration: 30000,
        });
      }

      const shouldTrigger = handler.shouldTriggerFallback('bad.com');

      expect(shouldTrigger).toBe(true);
    });

    it('should not trigger fallback with less than 5 attempts', () => {
      // Record 1 successful and 3 failed (25% solve rate, but only 4 attempts)
      handler.recordChallengeAttempt('few.com', {
        detected: true,
        type: 'recaptcha',
        solved: true,
        attempts: 1,
        duration: 3000,
      });
      for (let i = 0; i < 3; i++) {
        handler.recordChallengeAttempt('few.com', {
          detected: true,
          type: 'recaptcha',
          solved: false,
          attempts: 5,
          duration: 30000,
        });
      }

      const shouldTrigger = handler.shouldTriggerFallback('few.com');

      expect(shouldTrigger).toBe(false);
    });
  });
});
