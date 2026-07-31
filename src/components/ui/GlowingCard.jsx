import React, { useState } from 'react';

export const GlowingCard = ({ children, className = "", glowColor = "rgba(16, 185, 129, 0.15)" }) => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative overflow-hidden rounded-3xl bg-white dark:bg-[#0e1321]/80 border border-slate-200/90 dark:border-white/10 p-6 md:p-8 backdrop-blur-xl transition-all duration-300 shadow-sm dark:shadow-none ${className}`}
    >
      {/* Interactive mouse hover spotlight */}
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-500 z-0"
        style={{
          opacity: isHovered ? 1 : 0,
          background: `radial-gradient(circle 600px at ${mousePosition.x}px ${mousePosition.y}px, ${glowColor}, transparent 40%)`,
        }}
      />

      {/* Subtle hairline edge glow */}
      <div
        className="pointer-events-none absolute inset-0 rounded-3xl border border-emerald-500/20 transition-opacity duration-300"
        style={{
          opacity: isHovered ? 1 : 0,
        }}
      />

      <div className="relative z-10">{children}</div>
    </div>
  );
};

export default GlowingCard;
