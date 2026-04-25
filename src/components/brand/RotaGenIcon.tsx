interface RotaGenIconProps {
  size?: number;
  variant?: "light" | "dark";
  className?: string;
}

export default function RotaGenIcon({ size = 44, variant = "light", className }: RotaGenIconProps) {
  const isLight = variant === "light";

  const bg          = isLight ? "#2563EB" : "#1e3a8a";
  const bodyFill    = isLight ? "white"   : "#2563EB";
  const headerFill  = isLight ? "#dbeafe" : "#1e3a8a";
  const cellFill    = isLight ? "#dbeafe" : "#1e3a8a";
  const ecgStroke   = isLight ? "#2563EB" : "white";

  const frameClipId    = `rg-frame-${variant}`;
  const calendarClipId = `rg-cal-${variant}`;

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
        <clipPath id={calendarClipId}>
          <rect x="17" y="17" width="96" height="96" rx="22" />
        </clipPath>
      </defs>

      <g clipPath={`url(#${frameClipId})`}>
        {/* Background */}
        <rect width="130" height="130" fill={bg} />

        {/* Calendar body */}
        <rect x="17" y="17" width="96" height="96" rx="22" fill={bodyFill} />

        {/* Header band — clipped to calendar rounded corners */}
        <g clipPath={`url(#${calendarClipId})`}>
          <rect x="17" y="17" width="96" height="18" fill={headerFill} />
        </g>

        {/* Binder tabs — same colour as frame so they notch into the header */}
        <rect x="43" y="9"  width="11" height="17" rx="5" fill={bg} />
        <rect x="79" y="9"  width="11" height="17" rx="5" fill={bg} />

        {/* Grid cells: 4 cols × 3 rows — inside calendar clip */}
        <g clipPath={`url(#${calendarClipId})`}>
          {/* Row 1 */}
          <rect x="22" y="46" width="18" height="14" rx="3" fill={cellFill} />
          <rect x="44" y="46" width="18" height="14" rx="3" fill={cellFill} />
          <rect x="66" y="46" width="18" height="14" rx="3" fill={cellFill} />
          <rect x="88" y="46" width="18" height="14" rx="3" fill={cellFill} />
          {/* Row 2 */}
          <rect x="22" y="67" width="18" height="14" rx="3" fill={cellFill} />
          <rect x="44" y="67" width="18" height="14" rx="3" fill={cellFill} />
          <rect x="66" y="67" width="18" height="14" rx="3" fill={cellFill} />
          <rect x="88" y="67" width="18" height="14" rx="3" fill={cellFill} />
          {/* Row 3 */}
          <rect x="22" y="88" width="18" height="14" rx="3" fill={cellFill} />
          <rect x="44" y="88" width="18" height="14" rx="3" fill={cellFill} />
          <rect x="66" y="88" width="18" height="14" rx="3" fill={cellFill} />
          <rect x="88" y="88" width="18" height="14" rx="3" fill={cellFill} />
        </g>

        {/* ECG — outside calendar clip so it runs edge-to-edge and fuses with the frame.
            Stroke matches bg in light mode (blue-on-blue = invisible in frame areas).
            Shape: flat → Q dip → R spike → S dip → flat → T wave (tented) → flat */}
        <path
          d="M 0,72 L 32,72 L 39,83 L 48,49 L 58,96 L 68,72 L 76,72 Q 83,72 89,58 Q 98,72 105,72 L 130,72"
          fill="none"
          stroke={ecgStroke}
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}
