interface RotaGenIconProps {
  size?: number;
  variant?: "light" | "dark";
  className?: string;
}

export default function RotaGenIcon({ size = 44, variant = "light", className }: RotaGenIconProps) {
  const isLight = variant === "light";
  const frameStroke = isLight ? "#2563EB" : "white";
  const topBandFill = isLight ? "#dbeafe" : "#1e3a8a";
  const bodyFill = isLight ? "white" : "#2563EB";
  const cellFill = isLight ? "#dbeafe" : "#1e3a8a";
  const ecgStroke = isLight ? "#2563EB" : "white";
  const notchFill = isLight ? "#2563EB" : "white";
  const headerStroke = isLight ? "#2563EB" : "white";
  const clipId = `rotagen-icon-clip-${variant}`;

  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <clipPath id={clipId}>
          <rect x="2" y="4" width="40" height="36" rx="6" />
        </clipPath>
      </defs>

      {/* Top band */}
      <rect x="2" y="4" width="40" height="14" rx="6" fill={topBandFill} clipPath={`url(#${clipId})`} />

      {/* Calendar body */}
      <rect x="2" y="14" width="40" height="26" fill={bodyFill} clipPath={`url(#${clipId})`} />

      {/* Inner cell area */}
      <rect x="5" y="16" width="34" height="22" rx="2" fill={bodyFill} />

      {/* Grid cells - 4 cols × 3 rows */}
      <g>
        {/* Row 1 */}
        <rect x="6.5" y="17.5" width="6.5" height="5.5" rx="1" fill={cellFill} />
        <rect x="14.5" y="17.5" width="6.5" height="5.5" rx="1" fill={cellFill} />
        <rect x="22.5" y="17.5" width="6.5" height="5.5" rx="1" fill={cellFill} />
        <rect x="30.5" y="17.5" width="6.5" height="5.5" rx="1" fill={cellFill} />
        {/* Row 2 */}
        <rect x="6.5" y="24.5" width="6.5" height="5.5" rx="1" fill={cellFill} />
        <rect x="14.5" y="24.5" width="6.5" height="5.5" rx="1" fill={cellFill} />
        <rect x="22.5" y="24.5" width="6.5" height="5.5" rx="1" fill={cellFill} />
        <rect x="30.5" y="24.5" width="6.5" height="5.5" rx="1" fill={cellFill} />
        {/* Row 3 */}
        <rect x="6.5" y="31.5" width="6.5" height="5.5" rx="1" fill={cellFill} />
        <rect x="14.5" y="31.5" width="6.5" height="5.5" rx="1" fill={cellFill} />
        <rect x="22.5" y="31.5" width="6.5" height="5.5" rx="1" fill={cellFill} />
        <rect x="30.5" y="31.5" width="6.5" height="5.5" rx="1" fill={cellFill} />

        {/* ECG path */}
        <polyline
          points="6,28 12,28 15,22 18,34 21,25 24,28 28,28 31,24 34,28 38,28"
          fill="none"
          stroke={ecgStroke}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      {/* Left notch */}
      <rect x="12" y="1" width="3" height="7" rx="1.5" fill={notchFill} />
      {/* Right notch */}
      <rect x="29" y="1" width="3" height="7" rx="1.5" fill={notchFill} />

      {/* Header line */}
      <line x1="2" y1="14" x2="42" y2="14" stroke={headerStroke} strokeWidth="0.5" />

      {/* Outer frame - always on top */}
      <rect x="2" y="4" width="40" height="36" rx="6" stroke={frameStroke} strokeWidth="2" fill="none" />
    </svg>
  );
}
