interface RotaGenIconProps {
  size?: number;
  variant?: "light" | "dark";
  className?: string;
  animated?: boolean;
}

const ANIM_STYLES = `@keyframes rg-stroke-1{0%{stroke-dashoffset:470.19px;stroke-dasharray:470.19px}100%{stroke-dashoffset:0;stroke-dasharray:470.19px}}
.rg-anim .svg-elem-1{animation:rg-stroke-1 1s ease-in-out 0s both}
@keyframes rg-stroke-2{0%{stroke-dashoffset:347.34px;stroke-dasharray:347.34px}100%{stroke-dashoffset:0;stroke-dasharray:347.34px}}
.rg-anim .svg-elem-2{animation:rg-stroke-2 1s ease-in-out 0.05s both}
@keyframes rg-stroke-3{0%{stroke-dashoffset:522px;stroke-dasharray:522px}100%{stroke-dashoffset:0;stroke-dasharray:522px}}
@keyframes rg-fill-3{0%{fill:transparent}100%{fill:#2563EB}}
.rg-anim .svg-elem-3{animation:rg-stroke-3 1s ease-in-out 0.1s both,rg-fill-3 0.2s cubic-bezier(0.25,0.46,0.45,0.94) 0.18s both}
@keyframes rg-fill-4{0%{fill:transparent}100%{fill:#ffffff}}
.rg-anim .svg-elem-4{animation:rg-fill-4 0.2s cubic-bezier(0.25,0.46,0.45,0.94) 0.27s both}
@keyframes rg-fill-5{0%{fill:transparent}100%{fill:#dbeafe}}
.rg-anim .svg-elem-5{animation:rg-fill-5 0.2s cubic-bezier(0.25,0.46,0.45,0.94) 0.36s both}
@keyframes rg-fill-6{0%{fill:transparent}100%{fill:#2563EB}}
.rg-anim .svg-elem-6{animation:rg-fill-6 0.2s cubic-bezier(0.25,0.46,0.45,0.94) 0.45s both}
@keyframes rg-fill-7{0%{fill:transparent}100%{fill:#2563EB}}
.rg-anim .svg-elem-7{animation:rg-fill-7 0.2s cubic-bezier(0.25,0.46,0.45,0.94) 0.54s both}
@keyframes rg-fill-8{0%{fill:transparent}100%{fill:#dbeafe}}
.rg-anim .svg-elem-8{animation:rg-fill-8 0.2s cubic-bezier(0.25,0.46,0.45,0.94) 0.63s both}
@keyframes rg-fill-9{0%{fill:transparent}100%{fill:#dbeafe}}
.rg-anim .svg-elem-9{animation:rg-fill-9 0.2s cubic-bezier(0.25,0.46,0.45,0.94) 0.72s both}
@keyframes rg-fill-10{0%{fill:transparent}100%{fill:#dbeafe}}
.rg-anim .svg-elem-10{animation:rg-fill-10 0.2s cubic-bezier(0.25,0.46,0.45,0.94) 0.81s both}
@keyframes rg-fill-11{0%{fill:transparent}100%{fill:#dbeafe}}
.rg-anim .svg-elem-11{animation:rg-fill-11 0.2s cubic-bezier(0.25,0.46,0.45,0.94) 0.9s both}
@keyframes rg-fill-12{0%{fill:transparent}100%{fill:#dbeafe}}
.rg-anim .svg-elem-12{animation:rg-fill-12 0.2s cubic-bezier(0.25,0.46,0.45,0.94) 0.99s both}
@keyframes rg-fill-13{0%{fill:transparent}100%{fill:#dbeafe}}
.rg-anim .svg-elem-13{animation:rg-fill-13 0.2s cubic-bezier(0.25,0.46,0.45,0.94) 1.08s both}
@keyframes rg-fill-14{0%{fill:transparent}100%{fill:#dbeafe}}
.rg-anim .svg-elem-14{animation:rg-fill-14 0.2s cubic-bezier(0.25,0.46,0.45,0.94) 1.17s both}
@keyframes rg-fill-15{0%{fill:transparent}100%{fill:#dbeafe}}
.rg-anim .svg-elem-15{animation:rg-fill-15 0.2s cubic-bezier(0.25,0.46,0.45,0.94) 1.26s both}
@keyframes rg-fill-16{0%{fill:transparent}100%{fill:#dbeafe}}
.rg-anim .svg-elem-16{animation:rg-fill-16 0.2s cubic-bezier(0.25,0.46,0.45,0.94) 1.35s both}
@keyframes rg-fill-17{0%{fill:transparent}100%{fill:#dbeafe}}
.rg-anim .svg-elem-17{animation:rg-fill-17 0.2s cubic-bezier(0.25,0.46,0.45,0.94) 1.44s both}
@keyframes rg-fill-18{0%{fill:transparent}100%{fill:#dbeafe}}
.rg-anim .svg-elem-18{animation:rg-fill-18 0.2s cubic-bezier(0.25,0.46,0.45,0.94) 1.53s both}
@keyframes rg-fill-19{0%{fill:transparent}100%{fill:#dbeafe}}
.rg-anim .svg-elem-19{animation:rg-fill-19 0.2s cubic-bezier(0.25,0.46,0.45,0.94) 1.62s both}
@keyframes rg-stroke-20{0%{stroke-dashoffset:231.37px;stroke-dasharray:231.37px}100%{stroke-dashoffset:0;stroke-dasharray:231.37px}}
.rg-anim .svg-elem-20{animation:rg-stroke-20 1s ease-in-out 0.95s both}`;

export default function RotaGenIcon({ size = 44, variant = "light", className, animated = false }: RotaGenIconProps) {
  const isLight = variant === "light";

  const bg          = isLight ? "#2563EB" : "#1e3a8a";
  const bodyFill    = isLight ? "white"   : "#2563EB";
  const headerFill  = isLight ? "#dbeafe" : "#1e3a8a";
  const cellFill    = isLight ? "#dbeafe" : "#1e3a8a";
  const ecgStroke   = isLight ? "#2563EB" : "white";

  const frameClipId    = `rg-frame-${variant}`;
  const calendarClipId = `rg-cal-${variant}`;

  const cn = (idx: number) => (animated ? `svg-elem-${idx}` : undefined);
  const rootClass = [animated ? "rg-anim" : "", className ?? ""].filter(Boolean).join(" ") || undefined;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 130 130"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={rootClass}
    >
      {animated && <style>{ANIM_STYLES}</style>}
      <defs>
        <clipPath id={frameClipId}>
          <rect x="0" y="0" width="130" height="130" rx="30" className={cn(1)} />
        </clipPath>
        <clipPath id={calendarClipId}>
          <rect x="17" y="17" width="96" height="96" rx="22" className={cn(2)} />
        </clipPath>
      </defs>

      <g clipPath={`url(#${frameClipId})`}>
        {/* Background */}
        <rect width="130" height="130" fill={bg} className={cn(3)} />

        {/* Calendar body */}
        <rect x="17" y="17" width="96" height="96" rx="22" fill={bodyFill} className={cn(4)} />

        {/* Header band — clipped to calendar rounded corners */}
        <g clipPath={`url(#${calendarClipId})`}>
          <rect x="17" y="17" width="96" height="18" fill={headerFill} className={cn(5)} />
        </g>

        {/* Binder tabs — same colour as frame so they notch into the header */}
        <rect x="43" y="9"  width="11" height="17" rx="5" fill={bg} className={cn(6)} />
        <rect x="79" y="9"  width="11" height="17" rx="5" fill={bg} className={cn(7)} />

        {/* Grid cells: 4 cols × 3 rows — inside calendar clip */}
        <g clipPath={`url(#${calendarClipId})`}>
          {/* Row 1 */}
          <rect x="22" y="46" width="18" height="14" rx="3" fill={cellFill} className={cn(8)} />
          <rect x="44" y="46" width="18" height="14" rx="3" fill={cellFill} className={cn(9)} />
          <rect x="66" y="46" width="18" height="14" rx="3" fill={cellFill} className={cn(10)} />
          <rect x="88" y="46" width="18" height="14" rx="3" fill={cellFill} className={cn(11)} />
          {/* Row 2 */}
          <rect x="22" y="67" width="18" height="14" rx="3" fill={cellFill} className={cn(12)} />
          <rect x="44" y="67" width="18" height="14" rx="3" fill={cellFill} className={cn(13)} />
          <rect x="66" y="67" width="18" height="14" rx="3" fill={cellFill} className={cn(14)} />
          <rect x="88" y="67" width="18" height="14" rx="3" fill={cellFill} className={cn(15)} />
          {/* Row 3 */}
          <rect x="22" y="88" width="18" height="14" rx="3" fill={cellFill} className={cn(16)} />
          <rect x="44" y="88" width="18" height="14" rx="3" fill={cellFill} className={cn(17)} />
          <rect x="66" y="88" width="18" height="14" rx="3" fill={cellFill} className={cn(18)} />
          <rect x="88" y="88" width="18" height="14" rx="3" fill={cellFill} className={cn(19)} />
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
          className={cn(20)}
        />
      </g>
    </svg>
  );
}
