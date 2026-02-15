/**
 * Chunk Array Utility
 *
 * Splits a large array into smaller sub-arrays of a given size.
 * Useful for batching database queries to avoid oversized IN clauses.
 *
 * @param arr - Array to chunk
 * @param size - Maximum size of each chunk
 * @returns Array of chunks
 *
 * @example
 * ```typescript
 * const ids = ['a', 'b', 'c', 'd', 'e'];
 * const chunks = chunkArray(ids, 2);
 * // [['a', 'b'], ['c', 'd'], ['e']]
 * ```
 */
export function chunkArray<T>(arr: T[], size: number): T[][] {
  if (size <= 0) throw new Error('Chunk size must be positive');
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
