import { Page } from "playwright";
import { logger } from "../logger";

export class HumanSimulation {
  /**
   * Random delay between min and max ms
   */
  static async delay(min: number, max: number) {
    const duration = Math.floor(Math.random() * (max - min + 1) + min);
    await new Promise((resolve) => setTimeout(resolve, duration));
  }

  /**
   * Simulate realistic human-like mouse movements using Bezier curves
   */
  static async simulateMouseMove(page: Page) {
    try {
      const viewport = page.viewportSize() || { width: 1280, height: 720 };
      
      // Start from current position or a random point
      let startX = Math.random() * viewport.width;
      let startY = Math.random() * viewport.height;

      // Move to 2-4 random points
      const points = Math.floor(Math.random() * 3) + 2;
      
      for (let i = 0; i < points; i++) {
        const targetX = Math.random() * viewport.width;
        const targetY = Math.random() * viewport.height;
        
        await this.moveMouseBezier(page, startX, startY, targetX, targetY);
        
        startX = targetX;
        startY = targetY;
        
        // Small pause between movements
        await this.delay(100, 500);
      }
    } catch (error) {
      logger.warn("[HumanSimulation] Mouse movement simulation failed", { error });
    }
  }

  /**
   * Realistic scrolling: small adjustments and pauses
   */
  static async simulateScroll(page: Page) {
    try {
      const scrollPoints = Math.floor(Math.random() * 5) + 3;
      
      for (let i = 0; i < scrollPoints; i++) {
        const scrollAmount = Math.floor(Math.random() * 400) + 100;
        await page.evaluate((amount) => {
          window.scrollBy({
            top: amount,
            behavior: 'smooth'
          });
        }, scrollAmount);
        
        // Random pause during scrolling
        await this.delay(500, 2000);
      }
    } catch (error) {
      logger.warn("[HumanSimulation] Scroll simulation failed", { error });
    }
  }

  /**
   * Helper to move mouse along a Bezier curve
   */
  private static async moveMouseBezier(
    page: Page,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    steps: number = 25
  ) {
    // Control point for quadratic bezier
    const cpX = (startX + endX) / 2 + (Math.random() - 0.5) * 200;
    const cpY = (startY + endY) / 2 + (Math.random() - 0.5) * 200;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      // Quadratic Bezier formula: (1-t)^2*P0 + 2(1-t)t*P1 + t^2*P2
      const x = Math.pow(1 - t, 2) * startX + 2 * (1 - t) * t * cpX + Math.pow(t, 2) * endX;
      const y = Math.pow(1 - t, 2) * startY + 2 * (1 - t) * t * cpY + Math.pow(t, 2) * endY;
      
      await page.mouse.move(x, y);
      // Small jitter in speed
      if (i % 5 === 0) await this.delay(5, 15);
    }
  }

  /**
   * Click with a small jitter in timing and position
   */
  static async smartClick(page: Page, selector: string) {
    try {
      const element = await page.$(selector);
      if (!element) return;

      const box = await element.boundingBox();
      if (!box) return;

      // Random point within the element
      const x = box.x + Math.random() * box.width;
      const y = box.y + Math.random() * box.height;

      await page.mouse.move(x, y, { steps: 10 });
      await this.delay(100, 300);
      await page.mouse.click(x, y, { delay: Math.random() * 100 + 50 });
    } catch (error) {
      logger.warn(`[HumanSimulation] Smart click failed for ${selector}`, { error });
      // Fallback to standard click
      await page.click(selector).catch(() => {});
    }
  }

  /**
   * Type text character-by-character with realistic human-like delays
   * Requirements: 4.1, 4.6
   */
  static async typeText(page: Page, selector: string, text: string): Promise<void> {
    try {
      // Focus on the input element
      await page.focus(selector);
      await this.delay(100, 300);

      // Type each character with random delays between 50-150ms
      for (const char of text) {
        await page.keyboard.type(char);
        // Random delay between 50-150ms per character with variation
        const delay = Math.floor(Math.random() * 101) + 50; // 50-150ms
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    } catch (error) {
      logger.warn(`[HumanSimulation] Type text failed for ${selector}`, { error });
      // Fallback to standard type
      await page.fill(selector, text).catch(() => {});
    }
  }

  /**
   * Fill form with realistic patterns including pauses and focus changes
   * Requirements: 4.2
   */
  static async fillForm(page: Page, formData: Record<string, string>): Promise<void> {
    try {
      const fields = Object.entries(formData);
      
      for (let i = 0; i < fields.length; i++) {
        const [selector, value] = fields[i];
        
        // Pause before interacting with field
        await this.delay(200, 600);
        
        // Focus on the field (simulates user clicking/tabbing to field)
        await page.focus(selector);
        await this.delay(100, 300);
        
        // Type the value with realistic timing
        await this.typeText(page, selector, value);
        
        // Pause after filling field (simulates user thinking/reviewing)
        await this.delay(300, 800);
        
        // Simulate focus change to next field or blur
        if (i < fields.length - 1) {
          // Focus will naturally move to next field in next iteration
        } else {
          // Blur the last field
          await page.evaluate((sel) => {
            const element = document.querySelector(sel) as HTMLElement;
            if (element) element.blur();
          }, selector);
        }
      }
    } catch (error) {
      logger.warn("[HumanSimulation] Fill form failed", { error });
    }
  }

  /**
   * Simulate tab focus events on the page
   * Requirements: 4.3
   */
  static async simulateTabFocus(page: Page): Promise<void> {
    try {
      // Simulate window losing focus
      await page.evaluate(() => {
        window.dispatchEvent(new Event('blur'));
      });
      
      await this.delay(500, 1500);
      
      // Simulate window regaining focus
      await page.evaluate(() => {
        window.dispatchEvent(new Event('focus'));
      });
    } catch (error) {
      logger.warn("[HumanSimulation] Tab focus simulation failed", { error });
    }
  }

  /**
   * Hover over an element with natural mouse movement
   * Requirements: 4.5
   */
  static async hoverElement(page: Page, selector: string): Promise<void> {
    try {
      const element = await page.$(selector);
      if (!element) {
        logger.warn(`[HumanSimulation] Element not found for hover: ${selector}`);
        return;
      }

      const box = await element.boundingBox();
      if (!box) {
        logger.warn(`[HumanSimulation] Could not get bounding box for: ${selector}`);
        return;
      }

      // Get current mouse position (or use a random starting point)
      const viewport = page.viewportSize() || { width: 1280, height: 720 };
      const startX = Math.random() * viewport.width;
      const startY = Math.random() * viewport.height;

      // Target point within the element
      const targetX = box.x + box.width / 2 + (Math.random() - 0.5) * box.width * 0.5;
      const targetY = box.y + box.height / 2 + (Math.random() - 0.5) * box.height * 0.5;

      // Move mouse with natural Bezier curve
      await this.moveMouseBezier(page, startX, startY, targetX, targetY);
      
      // Pause briefly while hovering
      await this.delay(200, 600);
    } catch (error) {
      logger.warn(`[HumanSimulation] Hover element failed for ${selector}`, { error });
    }
  }

  /**
   * Random pause with weighted distribution favoring shorter pauses
   * Requirements: 4.4
   */
  static async randomPause(min: number = 100, max: number = 2000): Promise<void> {
    try {
      // Use weighted distribution favoring shorter pauses
      // Generate random number between 0 and 1
      const random = Math.random();
      
      // Apply exponential distribution to favor shorter pauses
      // Using power of 2 to create stronger bias toward shorter values
      const weighted = Math.pow(random, 2);
      
      // Map to range [min, max]
      const duration = Math.floor(weighted * (max - min) + min);
      
      await new Promise((resolve) => setTimeout(resolve, duration));
    } catch (error) {
      logger.warn("[HumanSimulation] Random pause failed", { error });
    }
  }
}
