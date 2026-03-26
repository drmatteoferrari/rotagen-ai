interface RotaGenTaglineProps {
  variant?: "full" | "short";
}

function ShortLine() {
  return (
    <span>
      One <span style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700, color: "#1e293b" }}>ROTA</span>.{" "}
      <span style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700, color: "#2563EB" }}>GEN</span>erated for you.
    </span>
  );
}

export default function RotaGenTagline({ variant = "full" }: RotaGenTaglineProps) {
  if (variant === "short") {
    return (
      <p style={{ color: "var(--muted-foreground)", lineHeight: 1.9 }}>
        <ShortLine />
      </p>
    );
  }

  return (
    <>
      <div style={{ color: "var(--muted-foreground)", lineHeight: 1.9 }}>Your doctors' preferences.</div>
      <div style={{ color: "var(--muted-foreground)", lineHeight: 1.9 }}>Your department's rules.</div>
      <div style={{ color: "var(--muted-foreground)", lineHeight: 1.9 }}>
        <ShortLine />
      </div>
    </>
  );
}
