import React from 'react';

/**
 * Soft ambient light. A static radial gradient instead of an animated SVG
 * Gaussian blur: same look, but no per-frame repaints (the old version
 * pulsed a 150px blur over a huge area and made scrolling janky).
 */
export const Spotlight = ({ className = '', fill = '#10b981' }) => (
  <div
    aria-hidden="true"
    className={`pointer-events-none absolute z-0 h-[70vh] w-[70vw] rounded-full ${className}`}
    style={{ background: `radial-gradient(closest-side, ${fill}40, transparent)` }}
  />
);

export default Spotlight;
