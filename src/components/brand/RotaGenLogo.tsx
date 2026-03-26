import RotaGenIcon from "./RotaGenIcon";

interface RotaGenLogoProps {
  size?: "sm" | "md" | "lg";
  variant?: "light" | "dark";
  showIcon?: boolean;
}

const sizeConfig = {
  sm: { iconSize: 26, fontSize: "15px", gap: "8px" },
  md: { iconSize: 38, fontSize: "22px", gap: "9px" },
  lg: { iconSize: 56, fontSize: "36px", gap: "14px" },
};

export default function RotaGenLogo({ size = "md", variant = "light", showIcon = true }: RotaGenLogoProps) {
  const cfg = sizeConfig[size];
  const isLight = variant === "light";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: cfg.gap }}>
      {showIcon && <RotaGenIcon size={cfg.iconSize} variant={variant} />}
      <span style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: cfg.fontSize }}>
        {/* ROTA is black in light mode, white in dark mode */}
        <span style={{ color: isLight ? "#000000" : "white" }}>ROTA</span>
        {/* GEN is blue in both modes (lighter blue in dark mode) */}
        <span style={{ color: isLight ? "#2563EB" : "#dbeafe" }}>GEN</span>
      </span>
    </div>
  );
}
