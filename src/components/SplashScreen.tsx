import { useState, useEffect, useCallback } from "react";
import { useAdminSetup } from "@/contexts/AdminSetupContext";
import { useRotaContext } from "@/contexts/RotaContext";
import {
  usePreRotaResultQuery,
  useCalendarShiftTypesQuery,
  useCalendarBankHolidaysQuery,
  useCalendarSurveysQuery,
  useDoctorsQuery,
  useInactiveDoctorsQuery,
  useRotaConfigDetailsQuery,
  useRosterSurveysQuery,
} from "@/hooks/useAdminQueries";

const ANIM_CSS = `
@keyframes sp-f3{0%{fill:transparent}100%{fill:#2563EB}}
.sp-svg .sp-e3{animation:sp-f3 .2s ease .18s both}
@keyframes sp-f4{0%{fill:transparent}100%{fill:#ffffff}}
.sp-svg .sp-e4{animation:sp-f4 .2s ease .27s both}
@keyframes sp-f5{0%{fill:transparent}100%{fill:#dbeafe}}
.sp-svg .sp-e5{animation:sp-f5 .2s ease .36s both}
@keyframes sp-fb{0%{fill:transparent}100%{fill:#2563EB}}
.sp-svg .sp-e6{animation:sp-fb .2s ease .45s both}
.sp-svg .sp-e7{animation:sp-fb .2s ease .54s both}
@keyframes sp-fc{0%{fill:transparent}100%{fill:#dbeafe}}
.sp-svg .sp-e8{animation:sp-fc .18s ease .63s both}
.sp-svg .sp-e9{animation:sp-fc .18s ease .72s both}
.sp-svg .sp-e10{animation:sp-fc .18s ease .81s both}
.sp-svg .sp-e11{animation:sp-fc .18s ease .90s both}
.sp-svg .sp-e12{animation:sp-fc .18s ease .99s both}
.sp-svg .sp-e13{animation:sp-fc .18s ease 1.08s both}
.sp-svg .sp-e14{animation:sp-fc .18s ease 1.17s both}
.sp-svg .sp-e15{animation:sp-fc .18s ease 1.26s both}
.sp-svg .sp-e16{animation:sp-fc .18s ease 1.35s both}
.sp-svg .sp-e17{animation:sp-fc .18s ease 1.44s both}
.sp-svg .sp-e18{animation:sp-fc .18s ease 1.53s both}
.sp-svg .sp-e19{animation:sp-fc .18s ease 1.62s both}
@keyframes sp-ecg{0%{stroke-dashoffset:231px;stroke-dasharray:231px}100%{stroke-dashoffset:0;stroke-dasharray:231px}}
.sp-svg .sp-e20{animation:sp-ecg 1s ease-in-out .95s both}
@keyframes sp-li{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
`;

export default function SplashScreen() {
  const { restoredFromDb } = useAdminSetup();
  const { currentRotaConfigId } = useRotaContext();

  const { status: preRotaStatus }      = usePreRotaResultQuery();
  const { status: shiftTypesStatus }   = useCalendarShiftTypesQuery();
  const { status: bankHolidaysStatus } = useCalendarBankHolidaysQuery();
  const { status: surveysStatus }      = useCalendarSurveysQuery();
  const { status: doctorsStatus }      = useDoctorsQuery();
  const { status: rosterSurveysStatus } = useRosterSurveysQuery();

  // Prime cache only — do not use return values
  useInactiveDoctorsQuery();
  useRotaConfigDetailsQuery();

  const allQueriesSettled =
    (preRotaStatus       === "success" || preRotaStatus       === "error") &&
    (shiftTypesStatus    === "success" || shiftTypesStatus    === "error") &&
    (bankHolidaysStatus  === "success" || bankHolidaysStatus  === "error") &&
    (surveysStatus       === "success" || surveysStatus       === "error") &&
    (doctorsStatus       === "success" || doctorsStatus       === "error") &&
    (rosterSurveysStatus === "success" || rosterSurveysStatus === "error");

  const isDataReady = restoredFromDb && (!currentRotaConfigId || allQueriesSettled);

  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [visible, setVisible]               = useState(
    () => sessionStorage.getItem('rg_splash_shown') !== 'true'
  );
  const [fading, setFading]                 = useState(false);

  const dismiss = useCallback(() => {
    sessionStorage.setItem('rg_splash_shown', 'true');
    setFading(true);
    setTimeout(() => setVisible(false), 400);
  }, []);

  // 2s minimum — lets the full animation play
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setMinTimeElapsed(true), 2000);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 8s hard maximum — safety net if restoredFromDb never fires
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(dismiss, 8000);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Preferred dismissal path — with 300ms paint buffer
  useEffect(() => {
    if (isDataReady && minTimeElapsed && visible && !fading) {
      const buffer = setTimeout(dismiss, 300);
      return () => clearTimeout(buffer);
    }
  }, [isDataReady, minTimeElapsed, visible, fading, dismiss]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        backgroundColor: "#2563EB",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "clamp(16px, 4vw, 28px)",
        opacity: fading ? 0 : 1,
        transition: "opacity 0.4s ease-out",
      }}
    >
      <style>{ANIM_CSS}</style>

      <div
        style={{
          width: "clamp(140px, 38vw, 200px)",
          height: "clamp(140px, 38vw, 200px)",
        }}
      >
        <svg
          className="sp-svg"
          viewBox="0 0 130 130"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: "100%", height: "100%" }}
        >
          <defs>
            <clipPath id="sp-frame">
              <rect className="sp-e1" x="0" y="0" width="130" height="130" rx="30" />
            </clipPath>
            <clipPath id="sp-cal">
              <rect className="sp-e2" x="17" y="17" width="96" height="96" rx="22" />
            </clipPath>
          </defs>
          <g clipPath="url(#sp-frame)">
            <rect className="sp-e3" width="130" height="130" fill="#2563EB" />
            <rect className="sp-e4" x="17" y="17" width="96" height="96" rx="22" fill="white" />
            <g clipPath="url(#sp-cal)">
              <rect className="sp-e5" x="17" y="17" width="96" height="18" fill="#dbeafe" />
            </g>
            <rect className="sp-e6" x="43" y="9" width="11" height="17" rx="5" fill="#2563EB" />
            <rect className="sp-e7" x="79" y="9" width="11" height="17" rx="5" fill="#2563EB" />
            <g clipPath="url(#sp-cal)">
              <rect className="sp-e8"  x="22" y="46" width="18" height="14" rx="3" fill="#dbeafe" />
              <rect className="sp-e9"  x="44" y="46" width="18" height="14" rx="3" fill="#dbeafe" />
              <rect className="sp-e10" x="66" y="46" width="18" height="14" rx="3" fill="#dbeafe" />
              <rect className="sp-e11" x="88" y="46" width="18" height="14" rx="3" fill="#dbeafe" />
              <rect className="sp-e12" x="22" y="67" width="18" height="14" rx="3" fill="#dbeafe" />
              <rect className="sp-e13" x="44" y="67" width="18" height="14" rx="3" fill="#dbeafe" />
              <rect className="sp-e14" x="66" y="67" width="18" height="14" rx="3" fill="#dbeafe" />
              <rect className="sp-e15" x="88" y="67" width="18" height="14" rx="3" fill="#dbeafe" />
              <rect className="sp-e16" x="22" y="88" width="18" height="14" rx="3" fill="#dbeafe" />
              <rect className="sp-e17" x="44" y="88" width="18" height="14" rx="3" fill="#dbeafe" />
              <rect className="sp-e18" x="66" y="88" width="18" height="14" rx="3" fill="#dbeafe" />
              <rect className="sp-e19" x="88" y="88" width="18" height="14" rx="3" fill="#dbeafe" />
            </g>
            <path
              className="sp-e20"
              d="M 0,72 L 32,72 L 39,83 L 48,49 L 58,96 L 68,72 L 76,72 Q 83,72 89,58 Q 98,72 105,72 L 130,72"
              fill="none"
              stroke="#2563EB"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </svg>
      </div>

      <div style={{ display: "flex", gap: "1px", alignItems: "baseline" }}>
        {(["R","O","T","A","G","E","N"] as const).map((letter, i) => (
          <span
            key={i}
            style={{
              display: "inline-block",
              fontFamily: "Poppins, system-ui, sans-serif",
              fontWeight: 700,
              fontSize: "clamp(28px, 7vw, 42px)",
              color: i < 4 ? "#ffffff" : "#dbeafe",
              animation: "sp-li 0.35s ease-out both",
              animationDelay: `${0.30 + i * 0.07}s`,
            }}
          >
            {letter}
          </span>
        ))}
      </div>
    </div>
  );
}
