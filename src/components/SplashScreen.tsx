import { useState, useEffect } from "react";
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
} from "@/hooks/useAdminQueries";
import RotaGenIcon from "@/components/brand/RotaGenIcon";

export default function SplashScreen() {
  const { restoredFromDb } = useAdminSetup();
  const { currentRotaConfigId } = useRotaContext();

  const { status: preRotaStatus } = usePreRotaResultQuery();
  const { status: shiftTypesStatus } = useCalendarShiftTypesQuery();
  const { status: bankHolidaysStatus } = useCalendarBankHolidaysQuery();
  const { status: surveysStatus } = useCalendarSurveysQuery();
  const { status: doctorsStatus } = useDoctorsQuery();

  // Called to prime cache — not blocking
  useInactiveDoctorsQuery();
  useRotaConfigDetailsQuery();

  const allQueriesSettled =
    (preRotaStatus === "success" || preRotaStatus === "error") &&
    (shiftTypesStatus === "success" || shiftTypesStatus === "error") &&
    (bankHolidaysStatus === "success" || bankHolidaysStatus === "error") &&
    (surveysStatus === "success" || surveysStatus === "error") &&
    (doctorsStatus === "success" || doctorsStatus === "error");

  // No config = new user, nothing to load
  const isDataReady = restoredFromDb && (!currentRotaConfigId || allQueriesSettled);

  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMinTimeElapsed(true), 2000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (isDataReady && minTimeElapsed && visible && !fading) {
      setFading(true);
      const t = setTimeout(() => setVisible(false), 400);
      return () => clearTimeout(t);
    }
  }, [isDataReady, minTimeElapsed, visible, fading]);

  if (!visible) return null;

  const letters = ["R", "O", "T", "A", "G", "E", "N"];

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
      <style>{`@keyframes rgLetterIn {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}`}</style>
      <div
        style={{
          width: "clamp(140px, 35vw, 200px)",
          height: "clamp(140px, 35vw, 200px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <RotaGenIcon animated size={200} variant="dark" style={{ width: "100%", height: "100%" }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        {letters.map((ch, i) => (
          <span
            key={i}
            style={{
              display: "inline-block",
              fontFamily: "Poppins, system-ui, sans-serif",
              fontWeight: 700,
              fontSize: "clamp(28px, 7vw, 42px)",
              color: i < 4 ? "#ffffff" : "#dbeafe",
              animation: "rgLetterIn 0.35s ease-out both",
              animationDelay: `${0.30 + i * 0.07}s`,
            }}
          >
            {ch}
          </span>
        ))}
      </div>
    </div>
  );
}
