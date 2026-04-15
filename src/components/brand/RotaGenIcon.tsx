// src/components/brand/RotaGenIcon.tsx

interface RotaGenIconProps {
  size?: number;
  variant?: "light" | "dark";
  className?: string;
}

export default function RotaGenIcon({ size = 44, variant = "light", className }: RotaGenIconProps) {
  const isLight = variant === "light";

  const bg = isLight ? "#2563EB" : "#1e3a8a";
  const bodyFill = isLight ? "white" : "#2563EB";
  const cellFill = isLight ? "#dbeafe" : "#1e3a8a";
  const ecgStroke = isLight ? "#2563EB" : "white";
  const sparkle = "white";

  const frameClipId = `rg-frame-${variant}`;
  const cellsClipId = `rg-cells-${variant}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 130 130"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <clipPath id={frameClipId}>
          <rect x="0" y="0" width="130" height="130" rx="30" />
        </clipPath>
        <clipPath id={cellsClipId}>
          <rect x="7" y="40" width="116" height="83" rx="27" />
        </clipPath>
      </defs>

      <g clipPath={`url(#${frameClipId})`}>
        {/* Background */}
        <rect x="0" y="0" width="130" height="130" fill={bg} />

        {/* Curved 4-point AI sparkle */}
        <path
          d="M93,10 C93.8,16 96.5,19 103,21 C96.5,23 93.8,26 93,32 C92.2,26 89.5,23 83,21 C89.5,19 92.2,16 93,10 Z"
          fill={sparkle}
        />

        {/* Dot trail fading left */}
        <circle cx="68" cy="21" r="4.5" fill={sparkle} opacity="0.60" />
        <circle cx="52" cy="21" r="3.5" fill={sparkle} opacity="0.40" />
        <circle cx="38" cy="21" r="2.5" fill={sparkle} opacity="0.24" />
        <circle cx="26" cy="21" r="1.8" fill={sparkle} opacity="0.13" />

        {/* Calendar body */}
        <rect x="7" y="40" width="116" height="83" rx="27" fill={bodyFill} />

        {/* Grid cells + ECG */}
        <g clipPath={`url(#${cellsClipId})`}>
          {/* Row 1 */}
          <rect x="18" y="56" width="19" height="13" rx="3" fill={cellFill} />
          <rect x="43" y="56" width="19" height="13" rx="3" fill={cellFill} />
          <rect x="68" y="56" width="19" height="13" rx="3" fill={cellFill} />
          <rect x="93" y="56" width="19" height="13" rx="3" fill={cellFill} />
          {/* Row 2 */}
          <rect x="18" y="75" width="19" height="13" rx="3" fill={cellFill} />
          <rect x="43" y="75" width="19" height="13" rx="3" fill={cellFill} />
          <rect x="68" y="75" width="19" height="13" rx="3" fill={cellFill} />
          <rect x="93" y="75" width="19" height="13" rx="3" fill={cellFill} />
          {/* Row 3 */}
          <rect x="18" y="94" width="19" height="13" rx="3" fill={cellFill} />
          <rect x="43" y="94" width="19" height="13" rx="3" fill={cellFill} />
          <rect x="68" y="94" width="19" height="13" rx="3" fill={cellFill} />
          <rect x="93" y="94" width="19" height="13" rx="3" fill={cellFill} />
          {/* ECG centred at y=82 */}
          <path
            d="M12,82 L30,82 L36,93 L43,59 L51,106 L59,82 L75,82 Q82,82 88,68 Q94,82 103,82 L118,82"
            fill="none"
            stroke={ecgStroke}
            strokeWidth="3.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </g>
    </svg>
  );
}
