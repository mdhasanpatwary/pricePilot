/**
 * Detection Engine for Bot Protection Handling
 *
 * Analyzes HTTP responses to detect and classify bot protection mechanisms.
 * Implements Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.8
 */

import { logger } from "@/lib/logger";

/**
 * Types of bot protection mechanisms that can be detected
 */
export enum ProtectionType {
  IP_BLOCK = "ip_block",
  RATE_LIMIT = "rate_limit",
  CAPTCHA = "captcha",
  FAKE_DATA = "fake_data",
  REDIRECT_BLOCK = "redirect_block",
  DELAYED_RESPONSE = "delayed_response",
  EMPTY_RESPONSE = "empty_response",
  JAVASCRIPT_CHALLENGE = "javascript_challenge",
  UNKNOWN = "unknown",
}

/**
 * HTTP response data for analysis
 */
export interface HttpResponse {
  /** Original request URL (before redirects). Used for redirect heuristics. */
  requestUrl?: string;
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  redirectUrl?: string;
  responseTime: number;
  finalUrl?: string;
}

/**
 * Indicators extracted from response analysis
 */
export interface ProtectionIndicators {
  statusCode: number;
  hasExpectedContent: boolean;
  hasCaptchaKeywords: boolean;
  isRedirected: boolean;
  isSuspiciousRedirect: boolean;
  responseTime: number;
  priceValue?: number;
  contentLength: number;
  hasJavaScriptChallenge: boolean;
  hasCloudflareIndicators: boolean;
  errorMessages: string[];
}

/**
 * Result of bot protection detection
 */
export interface DetectionResult {
  protectionDetected: boolean;
  protectionType?: ProtectionType;
  confidence: number;
  indicators: string[];
  reasoning: string;
}

/**
 * Detection Engine Class
 *
 * Responsible for analyzing HTTP responses and detecting bot protection mechanisms.
 */
export class DetectionEngine {
  // CAPTCHA-related keywords to detect in HTML
  private static readonly CAPTCHA_KEYWORDS = [
    "captcha",
    "recaptcha",
    "hcaptcha",
    "g-recaptcha",
    "h-captcha",
    "cf-captcha",
    "cloudflare-captcha",
    "challenge-form",
    "captcha-box",
    "verify you are human",
    "prove you are human",
    "security check",
    "are you a robot",
  ];

  // JavaScript challenge patterns
  private static readonly JS_CHALLENGE_PATTERNS = [
    "checking your browser",
    "please wait while we verify",
    "ddos protection",
    "cf-browser-verification",
    "just a moment",
    "enable javascript",
    "javascript is required",
  ];

  // Suspicious redirect path patterns (same-domain redirects can still be blocks)
  private static readonly SUSPICIOUS_REDIRECT_PATH_PATTERNS = [
    "/login",
    "/signin",
    "/sign-in",
    "/account/login",
    "/customer/account/login",
    "/captcha",
    "/challenge",
    "/verify",
    "/access-denied",
    "/forbidden",
  ];

  // IP block error messages
  private static readonly IP_BLOCK_MESSAGES = [
    "access denied",
    "forbidden",
    "blocked",
    "ip banned",
    "your ip has been blocked",
    "access from your location",
    "not available in your region",
  ];

  // Rate limit error messages
  private static readonly RATE_LIMIT_MESSAGES = [
    "too many requests",
    "rate limit",
    "slow down",
    "try again later",
    "request limit exceeded",
  ];

  // Timeout threshold in milliseconds (30 seconds)
  private static readonly TIMEOUT_THRESHOLD = 30000;

  // Minimum content length for valid response (100 bytes)
  private static readonly MIN_CONTENT_LENGTH = 100;

  // Fake price patterns
  private static readonly FAKE_PRICE_VALUES = [
    0, 0.0, 999999, 999999.99, 9999999,
  ];

  /**
   * Analyze an HTTP response for bot protection indicators
   * Requirement 1.1, 1.2
   *
   * @param response - The HTTP response to analyze
   * @returns Detection result with protection type and confidence
   */
  analyzeResponse(response: HttpResponse): DetectionResult {
    logger.debug("[DetectionEngine] Analyzing response", {
      statusCode: response.statusCode,
      responseTime: response.responseTime,
      contentLength: response.body.length,
    });

    // Extract indicators from the response
    const indicators = this.extractIndicators(response);

    // Classify the protection type based on indicators
    const protectionType = this.classifyProtection(indicators);

    // Calculate confidence score
    const confidence = this.calculateConfidence(indicators, protectionType);

    // Build reasoning string
    const reasoning = this.buildReasoning(indicators, protectionType);

    // Determine if protection was detected
    const protectionDetected =
      protectionType !== ProtectionType.UNKNOWN && confidence > 0;

    const result: DetectionResult = {
      protectionDetected,
      protectionType: protectionDetected ? protectionType : undefined,
      confidence,
      indicators: this.getIndicatorsList(indicators),
      reasoning,
    };

    if (protectionDetected) {
      logger.info("[DetectionEngine] Bot protection detected", {
        type: protectionType,
        confidence,
        indicators: result.indicators,
      });
    }

    return result;
  }

  /**
   * Extract protection indicators from HTTP response
   * Requirement 1.2
   *
   * @param response - The HTTP response
   * @returns Extracted indicators
   */
  private extractIndicators(response: HttpResponse): ProtectionIndicators {
    const bodyLower = response.body.toLowerCase();
    const contentLength = response.body.length;

    // Check for CAPTCHA keywords (Requirement 1.3)
    const hasCaptchaKeywords = DetectionEngine.CAPTCHA_KEYWORDS.some(
      (keyword) => bodyLower.includes(keyword),
    );

    // Check for JavaScript challenge patterns
    const hasJavaScriptChallenge = DetectionEngine.JS_CHALLENGE_PATTERNS.some(
      (pattern) => bodyLower.includes(pattern),
    );

    // Cloudflare indicators from headers (works even if body is minimized)
    const hasCloudflareIndicators = this.hasCloudflareIndicators(
      response.headers,
    );

    // Check for redirect patterns (Requirement 1.4)
    const { isRedirected, isSuspiciousRedirect } = this.analyzeRedirect(
      response.requestUrl,
      response.finalUrl,
      response.redirectUrl,
    );

    // Extract error messages
    const errorMessages = this.extractErrorMessages(bodyLower);

    // Check if response has expected content (basic heuristic)
    const hasExpectedContent = this.hasExpectedContent(response.body);

    // Try to extract price value for fake data detection (Requirement 1.6)
    const priceValue = this.extractPriceValue(response.body);

    return {
      statusCode: response.statusCode,
      hasExpectedContent,
      hasCaptchaKeywords,
      isRedirected,
      isSuspiciousRedirect,
      responseTime: response.responseTime,
      priceValue,
      contentLength,
      hasJavaScriptChallenge,
      hasCloudflareIndicators,
      errorMessages,
    };
  }

  /**
   * Classify the protection type based on indicators
   * Requirement 1.1, 1.3, 1.4, 1.5, 1.6
   *
   * @param indicators - Extracted indicators
   * @returns Classified protection type
   */
  classifyProtection(indicators: ProtectionIndicators): ProtectionType {
    // Priority 1: CAPTCHA detection (Requirement 1.3)
    if (indicators.hasCaptchaKeywords) {
      // Avoid false positives on sites that naturally contain "captcha" in metadata or login forms
      if (
        indicators.statusCode >= 400 ||
        indicators.contentLength < 30000 ||
        indicators.hasCloudflareIndicators
      ) {
        return ProtectionType.CAPTCHA;
      }
    }

    // Priority 2: JavaScript challenge (often Cloudflare)
    const isCloudflareBlock =
      indicators.hasCloudflareIndicators &&
      (indicators.statusCode === 403 || indicators.statusCode === 503);
    if (indicators.hasJavaScriptChallenge || isCloudflareBlock) {
      // Avoid <noscript>enable javascript</noscript> false positives on 200 OK sites
      if (
        indicators.statusCode >= 400 ||
        indicators.contentLength < 30000 ||
        isCloudflareBlock
      ) {
        return ProtectionType.JAVASCRIPT_CHALLENGE;
      }
    }

    // Priority 3: Suspicious redirects (same-domain redirect blocks)
    if (indicators.isSuspiciousRedirect) {
      return ProtectionType.REDIRECT_BLOCK;
    }

    // Priority 4: Rate limit detection (Requirement 1.1)
    if (indicators.statusCode === 429) {
      return ProtectionType.RATE_LIMIT;
    }

    // Check for rate limit messages in other status codes
    const hasRateLimitMessage = indicators.errorMessages.some((msg) =>
      DetectionEngine.RATE_LIMIT_MESSAGES.some((pattern) =>
        msg.includes(pattern),
      ),
    );
    if (hasRateLimitMessage) {
      return ProtectionType.RATE_LIMIT;
    }

    // Priority 5: IP block detection (Requirement 1.1)
    if (indicators.statusCode === 403 || indicators.statusCode === 401) {
      const hasIpBlockMessage = indicators.errorMessages.some((msg) =>
        DetectionEngine.IP_BLOCK_MESSAGES.some((pattern) =>
          msg.includes(pattern),
        ),
      );
      if (hasIpBlockMessage) return ProtectionType.IP_BLOCK;
      return ProtectionType.IP_BLOCK;
    }

    // Priority 6: Redirect block detection (Requirement 1.4)
    if (indicators.isSuspiciousRedirect) return ProtectionType.REDIRECT_BLOCK;

    // Priority 7: Delayed response detection (Requirement 1.5)
    if (indicators.responseTime > DetectionEngine.TIMEOUT_THRESHOLD) {
      return ProtectionType.DELAYED_RESPONSE;
    }

    // Priority 8: Empty response detection (Requirement 1.5)
    if (indicators.contentLength < DetectionEngine.MIN_CONTENT_LENGTH) {
      return ProtectionType.EMPTY_RESPONSE;
    }

    // Priority 9: Fake data detection (Requirement 1.6)
    if (indicators.priceValue !== undefined) {
      if (this.isFakePrice(indicators.priceValue)) {
        return ProtectionType.FAKE_DATA;
      }
    }

    // Priority 9: Missing expected content
    if (
      !indicators.hasExpectedContent &&
      indicators.statusCode === 200 &&
      indicators.contentLength < DetectionEngine.MIN_CONTENT_LENGTH
    ) {
      // Only flag as empty if it lacks structure AND is very small
      return ProtectionType.EMPTY_RESPONSE;
    }

    // No protection detected
    return ProtectionType.UNKNOWN;
  }

  /**
   * Calculate confidence score for the detection
   * Requirement 1.8
   *
   * @param indicators - Extracted indicators
   * @param protectionType - Classified protection type
   * @returns Confidence score (0-100)
   */
  calculateConfidence(
    indicators: ProtectionIndicators,
    protectionType: ProtectionType,
  ): number {
    if (protectionType === ProtectionType.UNKNOWN) {
      return 0;
    }

    let confidence = 0;
    const indicatorCount = this.getIndicatorsList(indicators).length;

    // Base confidence based on protection type
    switch (protectionType) {
      case ProtectionType.CAPTCHA:
        // High confidence for CAPTCHA (clear indicator)
        confidence = 90;
        break;

      case ProtectionType.IP_BLOCK:
        // High confidence for 403/401 status codes
        confidence =
          indicators.statusCode === 403 || indicators.statusCode === 401
            ? 85
            : 70;
        break;

      case ProtectionType.RATE_LIMIT:
        // Very high confidence for 429 status code
        confidence = indicators.statusCode === 429 ? 95 : 75;
        break;

      case ProtectionType.JAVASCRIPT_CHALLENGE:
        // High confidence for JS challenge patterns
        confidence = 80;
        break;

      case ProtectionType.REDIRECT_BLOCK:
        // Medium confidence (could be legitimate redirect)
        confidence = 70;
        break;

      case ProtectionType.DELAYED_RESPONSE:
        // Medium confidence (could be slow server)
        confidence = 65;
        break;

      case ProtectionType.EMPTY_RESPONSE:
        // Medium confidence (could be error)
        confidence = 60;
        break;

      case ProtectionType.FAKE_DATA:
        // Medium-high confidence
        confidence = 75;
        break;

      default:
        confidence = 50;
    }

    // Increase confidence based on number of indicators (Requirement 1.8)
    // Each additional indicator adds 5% confidence, up to 100%
    const indicatorBonus = Math.min((indicatorCount - 1) * 5, 15);
    confidence = Math.min(confidence + indicatorBonus, 100);

    return Math.round(confidence);
  }

  private analyzeRedirect(
    requestUrl?: string,
    finalUrl?: string,
    redirectUrl?: string,
  ): { isRedirected: boolean; isSuspiciousRedirect: boolean } {
    // "redirectUrl" is optional; some strategies only report finalUrl.
    const from = requestUrl || undefined;
    const to = finalUrl || redirectUrl || undefined;

    if (!from || !to)
      return { isRedirected: false, isSuspiciousRedirect: false };

    try {
      const fromUrl = new URL(from);
      const toUrl = new URL(to);

      const isRedirected = fromUrl.toString() !== toUrl.toString();
      const domainChanged = fromUrl.hostname !== toUrl.hostname;

      // If domain changed, it's a redirect, but only suspicious if it matches patterns
      // or if it's a completely different root domain.
      if (domainChanged) {
        const isDifferentRoot =
          this.getRootDomain(fromUrl.hostname) !==
          this.getRootDomain(toUrl.hostname);
        return { isRedirected, isSuspiciousRedirect: isDifferentRoot };
      }

      // Same-domain suspicious redirects: login/captcha/challenge, or forced home redirect.
      const toPath = (toUrl.pathname || "/").toLowerCase();
      const fromPath = (fromUrl.pathname || "/").toLowerCase();

      const matchesSuspiciousPath =
        DetectionEngine.SUSPICIOUS_REDIRECT_PATH_PATTERNS.some(
          (p) => toPath === p || toPath.startsWith(`${p}/`),
        );

      const forcedHomeRedirect =
        fromPath !== "/" &&
        (toPath === "/" || toPath === "/home" || toPath === "/index.php") &&
        // Avoid flagging legitimate canonicalization (e.g. trailing slash)
        !fromPath.startsWith("/home");

      return {
        isRedirected,
        isSuspiciousRedirect: Boolean(
          isRedirected && (matchesSuspiciousPath || forcedHomeRedirect),
        ),
      };
    } catch {
      return { isRedirected: false, isSuspiciousRedirect: false };
    }
  }

  private hasCloudflareIndicators(headers: Record<string, string>): boolean {
    const h = headers || {};

    // Normalize keys to lowercase.
    const keys = Object.keys(h).map((k) => k.toLowerCase());
    const server = (h["server"] || h["Server"] || "").toLowerCase();

    if (server.includes("cloudflare")) return true;

    // Common Cloudflare headers
    if (keys.includes("cf-ray")) return true;
    if (keys.includes("cf-cache-status")) return true;
    if (keys.some((k) => k.startsWith("cf-"))) return true;

    return false;
  }

  /**
   * Extract error messages from response body
   *
   * @param bodyLower - Lowercase response body
   * @returns Array of detected error messages
   */
  private extractErrorMessages(bodyLower: string): string[] {
    const messages: string[] = [];

    // Check for IP block messages
    DetectionEngine.IP_BLOCK_MESSAGES.forEach((pattern) => {
      if (bodyLower.includes(pattern)) {
        messages.push(pattern);
      }
    });

    // Check for rate limit messages
    DetectionEngine.RATE_LIMIT_MESSAGES.forEach((pattern) => {
      if (bodyLower.includes(pattern)) {
        messages.push(pattern);
      }
    });

    return messages;
  }

  /**
   * Check if response has expected content (basic heuristic)
   *
   * @param body - Response body
   * @returns True if response appears to have expected content
   */
  private hasExpectedContent(body: string): boolean {
    // Basic heuristic: check for common HTML elements
    const hasHtmlStructure =
      body.includes("<html") || body.includes("<!DOCTYPE");
    const hasBody = body.includes("<body");
    const hasContent = body.length > DetectionEngine.MIN_CONTENT_LENGTH;

    return hasHtmlStructure && hasBody && hasContent;
  }

  /**
   * Extract price value from response body
   * Simple extraction for fake data detection
   *
   * @param body - Response body
   * @returns Extracted price value or undefined
   */
  private extractPriceValue(body: string): number | undefined {
    // Simple regex to find price patterns
    // Matches: $123.45, 123.45, $123, etc.
    const priceRegex = /\$?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/g;
    const matches = body.match(priceRegex);

    if (!matches || matches.length === 0) {
      return undefined;
    }

    // Take the first match and parse it
    const priceStr = matches[0].replace(/[$,\s]/g, "");
    const price = parseFloat(priceStr);

    return isNaN(price) ? undefined : price;
  }

  /**
   * Check if a price value is fake/suspicious
   *
   * @param price - Price value to check
   * @returns True if price appears to be fake
   */
  private isFakePrice(price: number): boolean {
    // Check against known fake price values
    if (DetectionEngine.FAKE_PRICE_VALUES.includes(price)) {
      return true;
    }

    // Round prices are common in retail, don't flag them as fake.
    return false;
  }

  /**
   * Helper to get root domain (e.g., example.com from www.example.com)
   */
  private getRootDomain(hostname: string): string {
    const parts = hostname.split(".");
    if (parts.length <= 2) return hostname;
    return parts.slice(-2).join(".");
  }

  /**
   * Get list of indicator names that were detected
   *
   * @param indicators - Extracted indicators
   * @returns Array of indicator names
   */
  private getIndicatorsList(indicators: ProtectionIndicators): string[] {
    const list: string[] = [];

    if (indicators.statusCode >= 400) {
      list.push(`HTTP ${indicators.statusCode}`);
    }

    if (indicators.hasCaptchaKeywords) {
      list.push("CAPTCHA keywords detected");
    }

    if (indicators.hasJavaScriptChallenge) {
      list.push("JavaScript challenge detected");
    }

    if (indicators.hasCloudflareIndicators) {
      list.push("Cloudflare headers detected");
    }

    if (indicators.isRedirected) {
      list.push("Redirected to different domain");
    }

    if (indicators.isSuspiciousRedirect) {
      list.push("Suspicious redirect detected");
    }

    if (indicators.responseTime > DetectionEngine.TIMEOUT_THRESHOLD) {
      list.push(`Slow response (${indicators.responseTime}ms)`);
    }

    if (indicators.contentLength < DetectionEngine.MIN_CONTENT_LENGTH) {
      list.push(`Empty response (${indicators.contentLength} bytes)`);
    }

    if (
      indicators.priceValue !== undefined &&
      this.isFakePrice(indicators.priceValue)
    ) {
      list.push(`Suspicious price ($${indicators.priceValue})`);
    }

    if (!indicators.hasExpectedContent) {
      list.push("Missing expected content");
    }

    if (indicators.errorMessages.length > 0) {
      list.push(`Error messages: ${indicators.errorMessages.join(", ")}`);
    }

    return list;
  }

  /**
   * Build reasoning string explaining the detection
   *
   * @param indicators - Extracted indicators
   * @param protectionType - Classified protection type
   * @returns Human-readable reasoning
   */
  private buildReasoning(
    indicators: ProtectionIndicators,
    protectionType: ProtectionType,
  ): string {
    if (protectionType === ProtectionType.UNKNOWN) {
      return "No bot protection detected. Response appears normal.";
    }

    const reasons: string[] = [];

    switch (protectionType) {
      case ProtectionType.CAPTCHA:
        reasons.push("CAPTCHA challenge detected in response content.");
        break;

      case ProtectionType.IP_BLOCK:
        reasons.push(
          `HTTP ${indicators.statusCode} status code indicates access denied.`,
        );
        if (indicators.errorMessages.length > 0) {
          reasons.push(
            `Error messages suggest IP blocking: ${indicators.errorMessages.join(", ")}`,
          );
        }
        break;

      case ProtectionType.RATE_LIMIT:
        reasons.push("Rate limiting detected.");
        if (indicators.statusCode === 429) {
          reasons.push("HTTP 429 Too Many Requests status code.");
        }
        break;

      case ProtectionType.JAVASCRIPT_CHALLENGE:
        reasons.push(
          "JavaScript challenge detected (likely Cloudflare or similar).",
        );
        if (indicators.hasCloudflareIndicators) {
          reasons.push("Cloudflare headers present.");
        }
        break;

      case ProtectionType.REDIRECT_BLOCK:
        if (indicators.isSuspiciousRedirect) {
          reasons.push(
            "Suspicious redirect detected (login/captcha/home redirect).",
          );
        } else {
          reasons.push("Request was redirected, indicating blocking.");
        }
        break;

      case ProtectionType.DELAYED_RESPONSE:
        reasons.push(
          `Response took ${indicators.responseTime}ms, exceeding timeout threshold.`,
        );
        break;

      case ProtectionType.EMPTY_RESPONSE:
        reasons.push(
          `Response is too small (${indicators.contentLength} bytes) to contain valid content.`,
        );
        break;

      case ProtectionType.FAKE_DATA:
        if (indicators.priceValue !== undefined) {
          reasons.push(
            `Suspicious price value detected: $${indicators.priceValue}`,
          );
        }
        break;
    }

    return reasons.join(" ");
  }
}
