iIn src/components/brand/RotaGenIcon.tsx, replace the entire file contents with this:

import React from "react";

interface RotaGenIconProps {
  size?: number;
  variant?: "light" | "dark";
  className?: string;
}

export default function RotaGenIcon({ size = 44, variant = "light", className }: RotaGenIconProps) {
  const isLight = variant === "light";
  const bgFill        = isLight ? "#dbeafe" : "#1e3a8a";
  const bodyFill      = isLight ? "white"   : "#2563EB";
  const cellFill      = isLight ? "#dbeafe" : "#1e3a8a";
  const ecgStroke     = isLight ? "#2563EB" : "white";
  const frameStroke   = isLight ? "#2563EB" : "white";
  const rotaColor     = isLight ? "#0f172a" : "white";
  const genColor      = isLight ? "#2563EB" : "#93c5fd";

  const showText = size >= 32;

  // When showing text: header band = y 0–38, white section = y 38–123 (h=85)
  // When no text:      full area is white section with small top band for colour
  const headerH   = showText ? 38  : 18;
  const whiteY    = headerH;
  const whiteH    = 130 - headerH - 7;  // 7px bottom margin
  const whiteRx   = 17;

  // Grid: 4×3, cell 19×12, col-gap 6, row-gap 7
  // Grid w=94, centred in 130: x start = (130-94)/2 = 18
  // cols: 18, 43, 68, 93
  // Grid h=50, centred in white section
  const gridTop   = whiteY + Math.round((whiteH - 50) / 2);
  const rows      = [gridTop, gridTop + 19, gridTop + 38];
  const cols      = [18, 43, 68, 93];

  // ECG centred vertically in white section
  const ecgY      = whiteY + Math.round(whiteH / 2);
  const ecgAmp    = 23;  // amplitude preserved
  const ecgPath   = `M12,${ecgY} L30,${ecgY} L36,${ecgY+12} L43,${ecgY-23} L51,${ecgY+25} L59,${ecgY} L75,${ecgY} Q82,${ecgY} 88,${ecgY-14} Q94,${ecgY} 103,${ecgY} L118,${ecgY}`;

  const frameClipId = `rg-frame-${variant}-${size}`;
  const whiteClipId = `rg-white-${variant}-${size}`;

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
          <rect x="0" y="0" width="130" height="130" rx="20" />
        </clipPath>
        <clipPath id={whiteClipId}>
          <rect x="7" y={whiteY} width="116" height={whiteH} rx={whiteRx} />
        </clipPath>
      </defs>

      <g clipPath={`url(#${frameClipId})`}>
        {/* Background */}
        <rect x="0" y="0" width="130" height="130" fill={bgFill} />

        {/* Frame stroke — inside clip so it never bleeds */}
        <rect x="2" y="2" width="126" height="126" rx="19" fill="none" stroke={frameStroke} strokeWidth="2" />

        {/* ROTAGEN wordmark — only when large enough */}
        {showText && (
          <text
            x="65"
            y="22"
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="Inter, system-ui, sans-serif"
            fontSize="22"
            fontWeight="900"
            letterSpacing="1.5"
            strokeWidth="0.6"
            paintOrder="stroke fill"
          >
            <tspan fill={rotaColor} stroke={rotaColor}>ROTA</tspan>
            <tspan fill={genColor}  stroke={genColor}>GEN</tspan>
          </text>
        )}

        {/* White calendar body */}
        <rect x="7" y={whiteY} width="116" height={whiteH} rx={whiteRx} fill={bodyFill} />

        {/* Grid + ECG clipped to white section */}
        <g clipPath={`url(#${whiteClipId})`}>
          {rows.map((ry) =>
            cols.map((cx) => (
              <rect key={`${cx}-${ry}`} x={cx} y={ry} width="19" height="12" rx="2.5" fill={cellFill} />
            ))
          )}
          <path
            d={ecgPath}
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
