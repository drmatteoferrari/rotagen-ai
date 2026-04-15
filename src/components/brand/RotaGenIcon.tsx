interface RotaGenIconProps {
  size?: number;
  variant?: "light" | "dark";
  className?: string;
}

export default function RotaGenIcon({ size = 44, variant = "light", className }: RotaGenIconProps) {
  const isLight = variant === "light";

  // Colour tokens
  const bg = isLight ? "#dbeafe" : "#1e3a8a";
  const frameStroke = isLight ? "#2563EB" : "white";
  const bodyFill = isLight ? "white" : "#2563EB";
  const cellFill = isLight ? "#dbeafe" : "#1e3a8a";
  const ecgStroke = isLight ? "#2563EB" : "white";
  const rotaFill = isLight ? "#0f172a" : "white";
  const genFill = isLight ? "#2563EB" : "#93c5fd";

  // Unique clip IDs per variant to avoid collisions when both are rendered on the same page
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
          <rect x="0" y="0" width="130" height="130" rx="20" />
        </clipPath>
        <clipPath id={cellsClipId}>
          <rect x="7" y="38" width="116" height="85" rx="17" />
        </clipPath>
      </defs>

      <g clipPath={`url(#${frameClipId})`}>
        {/* Background */}
        <rect x="0" y="0" width="130" height="130" fill={bg} />

        {/* Outer stroke — inside clip so it never bleeds */}
        <rect x="2" y="2" width="126" height="126" rx="19" fill="none" stroke={frameStroke} strokeWidth="2" />

        {/* ROTAGEN wordmark as vector outlines — no font dependency */}
        {/* ROTA */}
        <path
          fill={rotaFill}
          d="M19.615 28.178V12.172h6.896q1.783 0 3.121 0.65 1.337 0.649 2.061 1.845 0.723 1.196 0.723 2.793 0 1.499-0.64 2.622-0.64 1.123-1.807 1.821-1.165 0.698-2.73 0.87l-0.377 0.225h-4.785v5.18zm2.462-7.317h4.18q1.302 0 2.16-0.488 0.858-0.488 1.285-1.322 0.427-0.834 0.427-1.88 0-1.066-0.42-1.868-0.42-0.802-1.27-1.254-0.851-0.452-2.108-0.452h-4.254zm7.628 7.317l-3.799-6.021 2.567-0.384 4.074 6.405zM39.237 28.398q-1.783 0-3.194-0.737-1.411-0.737-2.23-2.085-0.818-1.348-0.818-3.158v-0.604q0-1.843 0.81-3.2 0.81-1.356 2.213-2.085 1.404-0.73 3.152-0.73 1.77 0 3.158 0.73 1.389 0.73 2.19 2.085 0.8 1.356 0.8 3.2v0.604q0 1.81-0.81 3.158-0.81 1.348-2.213 2.085-1.404 0.737-3.058 0.737zm0-2.054q1.045 0 1.843-0.46 0.799-0.46 1.25-1.316 0.452-0.856 0.452-2.024v-0.56q0-1.158-0.46-2.017-0.46-0.858-1.262-1.33-0.803-0.472-1.823-0.472-1.033 0-1.828 0.472-0.795 0.472-1.251 1.33-0.456 0.859-0.456 2.017v0.56q0 1.168 0.448 2.024 0.448 0.856 1.255 1.316 0.807 0.46 1.832 0.46zM50.664 28.178V14.226h-4.254v-2.054h10.97v2.054h-4.254v13.952zM60.523 28.178V12.172h9.9v2.054h-7.438v4.32h7.108v2.054h-7.108v5.524h7.438v2.054z"
        />
        {/* GEN */}
        <path
          fill={genFill}
          d="M83.763 28.398q-1.81 0-3.25-0.73-1.44-0.73-2.274-2.078-0.834-1.348-0.834-3.165v-0.77q0-1.865 0.81-3.213 0.81-1.348 2.25-2.062 1.44-0.714 3.298-0.714 1.52 0 2.73 0.48 1.21 0.48 2.017 1.389 0.806 0.91 1.09 2.19h-2.506q-0.236-0.846-0.847-1.37-0.61-0.524-1.527-0.747-0.917-0.223-2.017 0.04-1.1 0.263-1.89 0.944-0.79 0.681-1.234 1.62-0.444 0.94-0.444 2.044v0.77q0 1.18 0.448 2.1 0.448 0.92 1.285 1.449 0.838 0.528 1.976 0.528 0.78 0 1.494-0.212 0.714-0.212 1.254-0.628 0.54-0.416 0.858-1.025 0.318-0.61 0.318-1.385v-0.384h-3.882v-1.878h6.268v2.384q0 1.39-0.628 2.47-0.628 1.08-1.812 1.706-1.184 0.626-2.752 0.626zM94.72 28.178V12.172h2.396l7.548 11.73V12.172h2.462v16.006h-2.396l-7.548-11.73v11.73zM110.9 28.178V12.172h9.9v2.054h-7.438v4.32h7.108v2.054h-7.108v5.524h7.438v2.054z"
        />

        {/* White calendar body */}
        <rect x="7" y="38" width="116" height="85" rx="17" fill={bodyFill} />

        {/* Grid cells + ECG — clipped to white body */}
        <g clipPath={`url(#${cellsClipId})`}>
          {/* Row 1 */}
          <rect x="18" y="56" width="19" height="12" rx="2.5" fill={cellFill} />
          <rect x="43" y="56" width="19" height="12" rx="2.5" fill={cellFill} />
          <rect x="68" y="56" width="19" height="12" rx="2.5" fill={cellFill} />
          <rect x="93" y="56" width="19" height="12" rx="2.5" fill={cellFill} />
          {/* Row 2 */}
          <rect x="18" y="75" width="19" height="12" rx="2.5" fill={cellFill} />
          <rect x="43" y="75" width="19" height="12" rx="2.5" fill={cellFill} />
          <rect x="68" y="75" width="19" height="12" rx="2.5" fill={cellFill} />
          <rect x="93" y="75" width="19" height="12" rx="2.5" fill={cellFill} />
          {/* Row 3 */}
          <rect x="18" y="94" width="19" height="12" rx="2.5" fill={cellFill} />
          <rect x="43" y="94" width="19" height="12" rx="2.5" fill={cellFill} />
          <rect x="68" y="94" width="19" height="12" rx="2.5" fill={cellFill} />
          <rect x="93" y="94" width="19" height="12" rx="2.5" fill={cellFill} />
          {/* ECG */}
          <path
            d="M12,80 L30,80 L36,92 L43,57 L51,105 L59,80 L75,80 Q82,80 88,66 Q94,80 103,80 L118,80"
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
