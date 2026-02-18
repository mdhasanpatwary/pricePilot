/**
 * Status Spike Tracker
 *
 * Tracks short-window HTTP 401/403 spikes per competitor website.
 * Used to detect bursts of access denials that suggest a block escalation.
 */

export class StatusSpikeTracker {
  private events: Map<string, number[]> = new Map();

  constructor(
    private readonly config: {
      windowMs: number;
      threshold: number;
    } = { windowMs: 2 * 60 * 1000, threshold: 3 },
  ) {}

  recordStatus(competitorWebsiteId: string, statusCode: number, at: Date = new Date()): void {
    if (statusCode !== 401 && statusCode !== 403) return;

    const key = competitorWebsiteId;
    const ts = at.getTime();
    const list = this.events.get(key) || [];
    list.push(ts);
    this.events.set(key, list);

    this.prune(key, ts);
  }

  is403Spike(competitorWebsiteId: string, at: Date = new Date()): boolean {
    const key = competitorWebsiteId;
    const ts = at.getTime();
    this.prune(key, ts);
    const list = this.events.get(key) || [];
    return list.length >= this.config.threshold;
  }

  private prune(key: string, nowMs: number): void {
    const list = this.events.get(key);
    if (!list || list.length === 0) return;

    const cutoff = nowMs - this.config.windowMs;
    const kept = list.filter((t) => t >= cutoff);
    if (kept.length === 0) {
      this.events.delete(key);
    } else {
      this.events.set(key, kept);
    }
  }
}

