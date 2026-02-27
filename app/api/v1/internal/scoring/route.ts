/**
 * Score Validation API Endpoint
 *
 * Internal-only endpoint for running target score validation and retrieving results.
 * GET  /api/v1/internal/scoring/validate - Run validation
 * GET  /api/v1/internal/scoring/scorecard - Get latest scorecard
 * GET  /api/v1/internal/scoring/report - Get formatted report
 */

import { NextRequest, NextResponse } from "next/server";
import { withInternalGate } from "@/lib/middleware/internal-gate";
import { logger } from "@/lib/logger";
import {
  runTargetScoreValidation,
  getLatestScorecard,
  generateValidationReport,
} from "@/lib/scoring/target-score-validator";

/**
 * GET /api/v1/internal/scoring/validate
 * Run target score validation
 */
export async function GET(req: NextRequest) {
  // Check which endpoint is being called
  const url = new URL(req.url);
  const path = url.pathname;

  if (path.includes("/validate")) {
    return validateScores(req);
  } else if (path.includes("/scorecard")) {
    return getScorecardEndpoint(req);
  } else if (path.includes("/report")) {
    return getReportEndpoint(req);
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

async function validateScores(req: NextRequest) {
  return withInternalGate(req, async () => {
    try {
      logger.info("Starting target score validation from API");

      const scorecard = await runTargetScoreValidation();

      return NextResponse.json(
        {
          status: "validation_complete",
          timestamp: scorecard.timestamp,
          overall: {
            score: scorecard.overall.score.toFixed(1),
            target: scorecard.overall.target,
            passed: scorecard.overall.passed,
          },
          dimensions: {
            security: {
              score: scorecard.security.score.toFixed(1),
              target: scorecard.security.target,
              passed: scorecard.security.passed,
            },
            queue_stability: {
              score: scorecard.queueStability.score.toFixed(1),
              target: scorecard.queueStability.target,
              passed: scorecard.queueStability.passed,
            },
            scraper_stability: {
              score: scorecard.scraperStability.score.toFixed(1),
              target: scorecard.scraperStability.target,
              passed: scorecard.scraperStability.passed,
            },
            scalability: {
              score: scorecard.scalability.score.toFixed(1),
              target: scorecard.scalability.target,
              passed: scorecard.scalability.passed,
            },
            observability: {
              score: scorecard.observability.score.toFixed(1),
              target: scorecard.observability.target,
              passed: scorecard.observability.passed,
            },
          },
        },
        { status: 200 }
      );
    } catch (error) {
      logger.error("Score validation failed", { error });
      return NextResponse.json(
        { error: "Score validation failed" },
        { status: 500 }
      );
    }
  });
}

async function getScorecardEndpoint(req: NextRequest) {
  return withInternalGate(req, async () => {
    try {
      const scorecard = await getLatestScorecard();

      if (!scorecard) {
        return NextResponse.json(
          { error: "No scorecard available. Run validation first." },
          { status: 404 }
        );
      }

      return NextResponse.json(scorecard, { status: 200 });
    } catch (error) {
      logger.error("Failed to get scorecard", { error });
      return NextResponse.json(
        { error: "Failed to get scorecard" },
        { status: 500 }
      );
    }
  });
}

async function getReportEndpoint(req: NextRequest) {
  return withInternalGate(req, async () => {
    try {
      const scorecard = await getLatestScorecard();

      if (!scorecard) {
        return NextResponse.json(
          { error: "No scorecard available. Run validation first." },
          { status: 404 }
        );
      }

      const report = generateValidationReport(scorecard);

      return NextResponse.json(report, { status: 200 });
    } catch (error) {
      logger.error("Failed to generate report", { error });
      return NextResponse.json(
        { error: "Failed to generate report" },
        { status: 500 }
      );
    }
  });
}
