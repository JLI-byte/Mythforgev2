"use client";

import React from 'react';

/**
 * Stand-in creature: an egg drawn inline rather than shipped as an image, so it
 * inherits the current text colour, needs no asset request, and is trivially
 * replaced by real art per stage later.
 *
 * `cracked` shows the first fissure once the writer is past the egg stage.
 */
export function EggPlaceholder({ size = 34, cracked = false }: { size?: number; cracked?: boolean }) {
  return (
    <svg
      width={size}
      height={size * 1.24}
      viewBox="0 0 50 62"
      fill="none"
      role="img"
      aria-label={cracked ? 'A cracking egg' : 'An egg'}
    >
      <ellipse cx="25" cy="34" rx="23" ry="26" fill="currentColor" opacity="0.9" />
      <ellipse cx="17" cy="24" rx="6" ry="8" fill="#fff" opacity="0.22" />
      {cracked && (
        <path
          d="M12 34 L20 30 L16 40 L26 36 L22 46"
          stroke="#0f1116"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.55"
        />
      )}
    </svg>
  );
}
