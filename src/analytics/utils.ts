/**
 * Shared utility functions for analytics modules.
 */

/**
 * Round a number to 2 decimal places.
 * Extracted from 17 analytics modules to eliminate duplication.
 */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
