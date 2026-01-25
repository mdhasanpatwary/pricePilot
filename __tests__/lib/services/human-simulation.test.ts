import { HumanSimulation } from '@/lib/services/human-simulation';
import { Page } from 'playwright';

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('HumanSimulation', () => {
  describe('randomPause', () => {
    it('should pause within the specified range', async () => {
      const min = 100;
      const max = 2000;
      
      const startTime = Date.now();
      await HumanSimulation.randomPause(min, max);
      const duration = Date.now() - startTime;

      expect(duration).toBeGreaterThanOrEqual(min);
      expect(duration).toBeLessThanOrEqual(max + 50); // Allow small margin for execution time
    });

    it('should use default range of 100-2000ms when no parameters provided', async () => {
      const startTime = Date.now();
      await HumanSimulation.randomPause();
      const duration = Date.now() - startTime;

      expect(duration).toBeGreaterThanOrEqual(100);
      expect(duration).toBeLessThanOrEqual(2050); // Allow small margin
    });

    it('should favor shorter pauses with weighted distribution', async () => {
      const samples = 50;
      const durations: number[] = [];
      
      // Collect multiple samples
      for (let i = 0; i < samples; i++) {
        const startTime = Date.now();
        await HumanSimulation.randomPause(100, 2000);
        const duration = Date.now() - startTime;
        durations.push(duration);
      }

      // Calculate median
      const sorted = durations.sort((a, b) => a - b);
      const median = sorted[Math.floor(samples / 2)];

      // With weighted distribution favoring shorter pauses,
      // median should be closer to min than max
      const midpoint = (100 + 2000) / 2; // 1050
      expect(median).toBeLessThan(midpoint);
    }, 60000); // Increase timeout for multiple iterations

    it('should produce varying pause durations', async () => {
      const samples = 10;
      const durations: number[] = [];
      
      for (let i = 0; i < samples; i++) {
        const startTime = Date.now();
        await HumanSimulation.randomPause(100, 500);
        const duration = Date.now() - startTime;
        durations.push(duration);
      }

      // Check that not all durations are the same (allowing for some duplicates)
      const uniqueDurations = new Set(durations);
      expect(uniqueDurations.size).toBeGreaterThan(1);
    }, 30000);

    it('should handle custom min and max values', async () => {
      const min = 500;
      const max = 1000;
      
      const startTime = Date.now();
      await HumanSimulation.randomPause(min, max);
      const duration = Date.now() - startTime;

      expect(duration).toBeGreaterThanOrEqual(min);
      expect(duration).toBeLessThanOrEqual(max + 50);
    });
  });

  describe('typeText', () => {
    it('should type text character by character', async () => {
      const mockPage = {
        focus: jest.fn().mockResolvedValue(undefined),
        keyboard: {
          type: jest.fn().mockResolvedValue(undefined),
        },
      } as unknown as Page;

      const text = 'test';
      await HumanSimulation.typeText(mockPage, '#input', text);

      expect(mockPage.focus).toHaveBeenCalledWith('#input');
      expect(mockPage.keyboard.type).toHaveBeenCalledTimes(text.length);
    });
  });

  describe('fillForm', () => {
    it('should fill form fields with pauses', async () => {
      const mockPage = {
        focus: jest.fn().mockResolvedValue(undefined),
        keyboard: {
          type: jest.fn().mockResolvedValue(undefined),
        },
        evaluate: jest.fn().mockResolvedValue(undefined),
      } as unknown as Page;

      const formData = {
        '#name': 'John',
        '#email': 'john@example.com',
      };

      const startTime = Date.now();
      await HumanSimulation.fillForm(mockPage, formData);
      const duration = Date.now() - startTime;

      // Focus is called for each field, plus typeText calls focus again
      expect(mockPage.focus).toHaveBeenCalled();
      // Should take some time due to pauses
      expect(duration).toBeGreaterThan(100);
    }, 10000);
  });

  describe('simulateTabFocus', () => {
    it('should dispatch blur and focus events', async () => {
      const mockPage = {
        evaluate: jest.fn().mockResolvedValue(undefined),
      } as unknown as Page;

      await HumanSimulation.simulateTabFocus(mockPage);

      expect(mockPage.evaluate).toHaveBeenCalledTimes(2);
    });
  });

  describe('hoverElement', () => {
    it('should hover over element with natural movement', async () => {
      const mockElement = {
        boundingBox: jest.fn().mockResolvedValue({
          x: 100,
          y: 100,
          width: 50,
          height: 30,
        }),
      };

      const mockPage = {
        $: jest.fn().mockResolvedValue(mockElement),
        viewportSize: jest.fn().mockReturnValue({ width: 1280, height: 720 }),
        mouse: {
          move: jest.fn().mockResolvedValue(undefined),
        },
      } as unknown as Page;

      await HumanSimulation.hoverElement(mockPage, '#button');

      expect(mockPage.$).toHaveBeenCalledWith('#button');
      expect(mockPage.mouse.move).toHaveBeenCalled();
    });

    it('should handle missing element gracefully', async () => {
      const mockPage = {
        $: jest.fn().mockResolvedValue(null),
      } as unknown as Page;

      await expect(
        HumanSimulation.hoverElement(mockPage, '#missing')
      ).resolves.not.toThrow();
    });
  });
});
