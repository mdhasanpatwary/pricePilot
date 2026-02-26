# Subsystem Failure Policy Matrix

This document defines the expected behavior of PricePilot subsystems when a failure occurs (e.g., database unavailable, Redis timeout, external service down).

## Policy Definitions

*   **Fail-Closed (Secure)**: Access is denied, or the operation is aborted if a failure occurs in the control path. This is used for security-critical components.
*   **Fail-Soft (Graceful Degradation)**: The system provides partial functionality or skips non-critical updates if a failure occurs. This is used for analytics and non-critical background tasks.

## Matrix

| Subsystem | Policy | Behavior on Failure | Rationale |
| :--- | :--- | :--- | :--- |
| **Authentication (Auth)** | Fail-Closed | Deny access, invalidate session, reject token. | Prevent unauthorized access if the session store or database is down. |
| **Admin Operations** | Fail-Closed | Deny endpoint access, block sensitive UI. | Protect administrative controls from unauthenticated/unauthorized access. |
| **Cron Jobs (Critical)** | Fail-Closed | Abort execution, log error, notify monitoring. | Prevent data corruption or inconsistent state from partial execution. |
| **Scrapers** | Fail-Soft | Retry with exponential backoff, mark job as delayed. | Maximize data collection efficiency; failures are expected and recoverable. |
| **Analytics** | Fail-Soft | Skip update, serve stale data if available. | Ensure user interface remains responsive even if live metrics are unavailable. |
| **Global Security** | Fail-Closed | Reject request if threat analysis or IP check fails. | Ensure protection layers are always active; do not bypass security filters on error. |

## Implementation Roadmap

1.  **Phase 0**: Enforce policies in middlewares and critical entry points.
2.  **Phase 1**: Standardize error handling in Auth/Admin services.
3.  **Phase 3**: Refine distributed lock behavior (Critical vs. Non-critical).
