import { CaptchaSolver } from '@/lib/services/captcha-solver';

describe('CaptchaSolver', () => {
    let solver: CaptchaSolver;

    beforeEach(() => {
        solver = new CaptchaSolver({
            apiKey: 'test-api-key',
            pollingInterval: 100, // Faster for tests
            timeout: 5000
        });
    });

    describe('constructor', () => {
        it('should initialize with default options', () => {
            const defaultSolver = new CaptchaSolver({ apiKey: 'test-key' });
            expect(defaultSolver).toBeDefined();
        });

        it('should initialize with custom options', () => {
            const customSolver = new CaptchaSolver({
                apiKey: 'test-key',
                pollingInterval: 3000,
                timeout: 60000,
                apiBaseUrl: 'https://custom.api.com'
            });
            expect(customSolver).toBeDefined();
        });
    });

    describe('getStats', () => {
        it('should return initial stats', () => {
            const stats = solver.getStats();
            expect(stats).toEqual({
                totalSolves: 0,
                successfulSolves: 0,
                failedSolves: 0,
                avgSolveTime: 0,
                totalCost: 0,
                solvesByType: {}
            });
        });
    });

    describe('detectCaptchaType', () => {
        it('should detect Turnstile captcha', async () => {
            const mockPage = {
                url: () => 'https://example.com',
                evaluate: jest.fn().mockImplementation((fn) => {
                    // Simulate Turnstile detection
                    if (fn.toString().includes('cf-turnstile')) {
                        return { type: 'turnstile', siteKey: 'test-site-key' };
                    }
                    return null;
                })
            } as any;

            const result = await solver.detectCaptchaType(mockPage);
            expect(result).toEqual({
                type: 'turnstile',
                siteKey: 'test-site-key',
                pageUrl: 'https://example.com'
            });
        });

        it('should detect reCAPTCHA v2', async () => {
            const mockPage = {
                url: () => 'https://example.com',
                evaluate: jest.fn()
                    .mockResolvedValueOnce(null) // Turnstile check
                    .mockResolvedValueOnce({ type: 'recaptcha_v2', siteKey: 'test-site-key' }) // reCAPTCHA v2 check
            } as any;

            const result = await solver.detectCaptchaType(mockPage);
            expect(result).toEqual({
                type: 'recaptcha_v2',
                siteKey: 'test-site-key',
                pageUrl: 'https://example.com'
            });
        });

        it('should return null when no captcha detected', async () => {
            const mockPage = {
                url: () => 'https://example.com',
                evaluate: jest.fn().mockResolvedValue(null)
            } as any;

            const result = await solver.detectCaptchaType(mockPage);
            expect(result).toBeNull();
        });
    });

    describe('injectSolution', () => {
        it('should inject reCAPTCHA v2 solution', async () => {
            const mockPage = {
                evaluate: jest.fn().mockResolvedValue(undefined)
            } as any;

            await solver.injectSolution(mockPage, 'test-token', 'recaptcha_v2');
            expect(mockPage.evaluate).toHaveBeenCalledWith(expect.any(Function), 'test-token');
        });

        it('should inject hCaptcha solution', async () => {
            const mockPage = {
                evaluate: jest.fn().mockResolvedValue(undefined)
            } as any;

            await solver.injectSolution(mockPage, 'test-token', 'hcaptcha');
            expect(mockPage.evaluate).toHaveBeenCalledWith(expect.any(Function), 'test-token');
        });

        it('should inject Turnstile solution', async () => {
            const mockPage = {
                evaluate: jest.fn().mockResolvedValue(undefined)
            } as any;

            await solver.injectSolution(mockPage, 'test-token', 'turnstile');
            expect(mockPage.evaluate).toHaveBeenCalledWith(expect.any(Function), 'test-token');
        });

        it('should handle unknown captcha type', async () => {
            const mockPage = {
                evaluate: jest.fn().mockResolvedValue(undefined)
            } as any;

            await solver.injectSolution(mockPage, 'test-token', 'unknown');
            expect(mockPage.evaluate).not.toHaveBeenCalled();
        });
    });
});
