/**
 * Simple keyset pagination helpers using a base64-encoded cursor string.
 * The cursor encodes two values separated by `|`: `<timestamp-ms>|<id>`.
 * When decoded, the repository can use these values to implement a stable
 * descending ordering by startTime then id (both descending).
 *
 * Cursor format is intentionally minimal so we can add more fields later if
 * needed without breaking existing cursors (clients should treat it as opaque).
 */

export interface DecodedCursor {
    timestamp: number;
    id: string;
}

export function encodeCursor(cursor: DecodedCursor): string {
    const raw = `${cursor.timestamp}|${cursor.id}`;
    return Buffer.from(raw).toString('base64');
}

export function decodeCursor(cursor: string): DecodedCursor | null {
    try {
        const decoded = Buffer.from(cursor, 'base64').toString('utf8');
        const [tsStr, id] = decoded.split('|');
        const timestamp = parseInt(tsStr, 10);
        if (isNaN(timestamp) || !id) {
            return null;
        }
        return { timestamp, id };
    } catch (e) {
        return null;
    }
}
