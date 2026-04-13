import type { ValidationIssue } from "./preRotaTypes";
import type { ShiftSlotEntry } from "./rotaGenInput";
import { canonicalGrade, GRADE_ORDER } from "./gradeOptions";

// ─── ValidationInputs ─────────────────────────────────────────
// shiftSlots: one entry per (shiftKey × dayKey) — from buildPreRotaInput.
// doctors: built by preRotaGenerator from DB rows + survey data.

export interface ValidationInputs {
  rotaConfig: {
    startDate: string;
    endDate: string;
    durationWeeks: number;
    globalOncallPct: number;
    globalNonOncallPct: number;
    surveyDeadline: string | null;
  };
  shiftSlots: ShiftSlotEntry[];
  doctors: ValidationDoctor[];
  bankHolidays: string[];
}

export interface ValidationDoctor {
  id: string;
  firstName: string;
  lastName: string;
  grade: string | null;
  surveyStatus: string; // 'not_started' | 'in_progress' | 'submitted'
  survey: {
    wtePercent: number | null;
    annualLeave: { startDate: string; endDate: string }[];
    studyLeave: { startDate: string; endDate: string }[];
    nocDates: { startDate: string; endDate: string }[];
    rotations: { startDate: string; endDate: string; location: string }[];
    ltftDaysOff: string[];
    ltftNightFlexibility: {
      day: string;
      canStart: boolean | null;
      canEnd: boolean | null;
    }[];
    alEntitlement: number | null;
    parentalLeaveExpected: boolean;
    parentalLeaveStart: string | null;
    competencies: {
      iacAchieved: boolean | null;
      iaocAchieved: boolean | null;
      icuAchieved: boolean | null;
      transferAchieved: boolean | null;
    };
  } | null;
}

// ─── runPreRotaValidation ─────────────────────────────────────

export function runPreRotaValidation(inputs: ValidationInputs): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { rotaConfig, shiftSlots, doctors } = inputs;

  const rotaStart = new Date(rotaConfig.startDate);
  const rotaEnd = new Date(rotaConfig.endDate);
  const rotaDays = Math.round((rotaEnd.getTime() - rotaStart.getTime()) / 86_400_000) + 1;

  // ── Pure helpers ──────────────────────────────────────────

  const inPeriod = (d: string): boolean => {
    const dt = new Date(d);
    return dt >= rotaStart && dt <= rotaEnd;
  };

  const countDays = (periods: { startDate: string; endDate: string }[]): number =>
    periods.reduce((sum, p) => {
      if (!p.startDate || !p.endDate) return sum;
      return (
        sum +
        Math.max(0, Math.round((new Date(p.endDate).getTime() - new Date(p.startDate).getTime()) / 86_400_000) + 1)
      );
    }, 0);

  const checkOverlap = (
    doctorId: string,
    doctorName: string,
    periods: { startDate: string; endDate: string }[],
    type: string,
  ): void => {
    for (let i = 0; i < periods.length; i++) {
      for (let j = i + 1; j < periods.length; j++) {
        const a = periods[i],
          b = periods[j];
        if (!a.startDate || !a.endDate || !b.startDate || !b.endDate) continue;
        if (new Date(a.startDate) <= new Date(b.endDate) && new Date(b.startDate) <= new Date(a.endDate)) {
          issues.push({
            severity: "critical",
            code: "LEAVE_DATE_OVERLAP",
            doctorId,
            doctorName,
            message: `${doctorName}: Two ${type} periods overlap (${a.startDate}–${a.endDate} and ${b.startDate}–${b.endDate}).`,
          });
        }
      }
    }
  };

  // ── Pre-compute team competency counts ────────────────────
  // Only submitted surveys contribute to competency counts.
  const submitted = doctors.filter((d) => d.surveyStatus === "submitted" && d.survey !== null);
  const teamIac = submitted.filter((d) => d.survey!.competencies.iacAchieved === true).length;
  const teamIaoc = submitted.filter((d) => d.survey!.competencies.iaocAchieved === true).length;
  const teamIcu = submitted.filter((d) => d.survey!.competencies.icuAchieved === true).length;
  const teamTransfer = submitted.filter((d) => d.survey!.competencies.transferAchieved === true).length;

  // ── Pre-compute team grade set (canonical) ────────────────
  const teamGrades = new Set(submitted.map((d) => canonicalGrade(d.grade)).filter((g): g is string => g !== ""));

  // ─────────────────────────────────────────────────────────
  // CRITICAL CHECKS
  // ─────────────────────────────────────────────────────────

  // C1: on-call / non-oncall split must total 100%
  if (Math.round(rotaConfig.globalOncallPct + rotaConfig.globalNonOncallPct) !== 100) {
    issues.push({
      severity: "critical",
      code: "ONCALL_SPLIT_INVALID",
      doctorId: null,
      doctorName: null,
      message: `On-call split (${rotaConfig.globalOncallPct}%) + non-oncall (${rotaConfig.globalNonOncallPct}%) must equal 100%. Update in department setup.`,
    });
  }

  // C2–C7: per-doctor checks
  for (const doctor of doctors) {
    const name = `Dr ${doctor.firstName} ${doctor.lastName}`;

    // C2: no survey submitted
    if (!doctor.survey || doctor.surveyStatus === "not_started") {
      issues.push({
        severity: "critical",
        code: "MISSING_SURVEY",
        doctorId: doctor.id,
        doctorName: name,
        message: `${name} has not submitted a survey.`,
      });
      continue; // skip remaining checks — no survey data to validate
    }

    // C3: WTE missing or zero
    if (!doctor.survey.wtePercent || doctor.survey.wtePercent === 0) {
      issues.push({
        severity: "critical",
        code: "MISSING_WTE",
        doctorId: doctor.id,
        doctorName: name,
        message: `${name} has no WTE percentage recorded.`,
        field: "wte_percent",
      });
    }

    // C4: leave dates outside rota period
    const allLeave = [
      ...doctor.survey.annualLeave.map((l) => ({ ...l, type: "AL" })),
      ...doctor.survey.studyLeave.map((l) => ({ ...l, type: "SL" })),
      ...doctor.survey.nocDates.map((l) => ({ ...l, type: "NOC" })),
    ];
    for (const leave of allLeave) {
      if (leave.startDate && !inPeriod(leave.startDate)) {
        issues.push({
          severity: "critical",
          code: "LEAVE_OUTSIDE_PERIOD",
          doctorId: doctor.id,
          doctorName: name,
          message: `${name}: ${leave.type} start date ${leave.startDate} is outside the rota period.`,
        });
      }
      if (leave.endDate && !inPeriod(leave.endDate)) {
        issues.push({
          severity: "critical",
          code: "LEAVE_OUTSIDE_PERIOD",
          doctorId: doctor.id,
          doctorName: name,
          message: `${name}: ${leave.type} end date ${leave.endDate} is outside the rota period.`,
        });
      }
    }

    // C5: total AL + SL exceeds full rota length
    const totalLeaveDays = countDays(doctor.survey.annualLeave) + countDays(doctor.survey.studyLeave);
    if (totalLeaveDays > rotaDays) {
      issues.push({
        severity: "critical",
        code: "LEAVE_EXCEEDS_PERIOD",
        doctorId: doctor.id,
        doctorName: name,
        message: `${name}: Total AL + SL (${totalLeaveDays} days) exceeds the rota length (${rotaDays} days).`,
      });
    }

    // C6: rotation covers the entire rota period → no availability
    for (const rot of doctor.survey.rotations) {
      if (!rot.startDate || !rot.endDate) continue;
      if (new Date(rot.startDate) <= rotaStart && new Date(rot.endDate) >= rotaEnd) {
        issues.push({
          severity: "critical",
          code: "ROTATION_FULL_OVERLAP",
          doctorId: doctor.id,
          doctorName: name,
          message: `${name}: Rotation to ${rot.location} covers the entire rota period — doctor has no availability.`,
        });
      }
    }

    // C7: overlapping leave periods for the same doctor
    checkOverlap(doctor.id, name, doctor.survey.annualLeave, "AL");
    checkOverlap(doctor.id, name, doctor.survey.studyLeave, "SL");
  }

  // C8: no shift slots defined at all
  if (shiftSlots.length === 0) {
    issues.push({
      severity: "critical",
      code: "NO_SHIFT_SLOTS_DEFINED",
      doctorId: null,
      doctorName: null,
      message: "No shift slots are defined. Complete department setup (Step 2) before generating.",
    });
  }

  // C9: slot-level grade eligibility — for each constrained slot,
  // at least one submitted doctor must be eligible.
  // We check per unique (shiftKey × dayKey × slotIndex) combination.
  // This catches configurations that are impossible to fill.
  for (const entry of shiftSlots) {
    for (const slot of entry.slots) {
      if (slot.permittedGrades.length === 0) continue; // unconstrained — skip

      const hasEligibleDoctor = submitted.some((d) => {
        const canonical = canonicalGrade(d.grade);
        return canonical !== "" && slot.permittedGrades.includes(canonical);
      });

      if (!hasEligibleDoctor) {
        const gradeList = slot.permittedGrades.join(", ");
        const label = slot.label ? `"${slot.label}"` : `slot ${slot.slotIndex + 1}`;
        issues.push({
          severity: "critical",
          code: "SLOT_GRADE_IMPOSSIBLE",
          doctorId: null,
          doctorName: null,
          message:
            `${entry.name} (${entry.dayKey}), ${label}: ` +
            `requires grade [${gradeList}] but no doctor in the team holds any of these grades.`,
        });
      }
    }
  }

  // ─────────────────────────────────────────────────────────
  // WARNING CHECKS
  // ─────────────────────────────────────────────────────────

  for (const doctor of doctors) {
    if (!doctor.survey || doctor.surveyStatus === "not_started") continue;
    const name = `Dr ${doctor.firstName} ${doctor.lastName}`;
    const wte = doctor.survey.wtePercent ?? 100;

    // W1: AL significantly exceeds pro-rata entitlement
    const entitlement = doctor.survey.alEntitlement ?? 27;
    const proRata = Math.round((rotaConfig.durationWeeks / 52) * entitlement * (wte / 100));
    const alDays = countDays(doctor.survey.annualLeave);
    if (alDays > proRata * 1.25) {
      issues.push({
        severity: "warning",
        code: "AL_EXCEEDS_ENTITLEMENT",
        doctorId: doctor.id,
        doctorName: name,
        message:
          `${name}: AL entered (${alDays} days) significantly exceeds ` +
          `estimated pro-rata entitlement (${proRata} days).`,
        field: "annual_leave",
      });
    }

    // W2: LTFT days off missing night flexibility answers
    for (const day of doctor.survey.ltftDaysOff) {
      const flex = doctor.survey.ltftNightFlexibility.find((f) => f.day === day);
      if (!flex || flex.canStart === null || flex.canEnd === null) {
        issues.push({
          severity: "warning",
          code: "LTFT_MISSING_NIGHT_FLEX",
          doctorId: doctor.id,
          doctorName: name,
          message: `${name}: LTFT day off '${day}' is missing night flexibility answers.`,
          field: "ltft_night_flexibility",
        });
      }
    }

    // W3: all competencies blank on submitted survey
    const { iacAchieved, iaocAchieved, icuAchieved, transferAchieved } = doctor.survey.competencies;
    if (iacAchieved === null && iaocAchieved === null && icuAchieved === null && transferAchieved === null) {
      issues.push({
        severity: "warning",
        code: "COMPETENCIES_BLANK",
        doctorId: doctor.id,
        doctorName: name,
        message: `${name}: All competency fields are blank — ` + `survey step 2 may not have been completed.`,
        field: "competencies_json",
      });
    }
  }

  // W4–W7: team-level shift slot requirement checks.
  // For each unique (shiftKey × dayKey), aggregate the maximum
  // competency requirement across all slots in that entry,
  // then check team capacity.
  // We deduplicate by shiftKey to avoid one warning per day
  // when the same shift runs identically all week.
  const warnedShiftKeys = new Set<string>();

  for (const entry of shiftSlots) {
    if (warnedShiftKeys.has(entry.shiftKey)) continue;

    // Aggregate max competency requirement across all slots for this entry
    // (worst-case day for this shift key, used for team-level check)
    let maxReqIac = 0;
    let maxReqIaoc = 0;
    let maxReqIcu = 0;
    let maxReqTransfer = 0;

    // Collect all entries for this shiftKey to find the highest requirements
    const allEntriesForShift = shiftSlots.filter((s) => s.shiftKey === entry.shiftKey);
    for (const e of allEntriesForShift) {
      for (const slot of e.slots) {
        maxReqIac = Math.max(maxReqIac, slot.reqIac);
        maxReqIaoc = Math.max(maxReqIaoc, slot.reqIaoc);
        maxReqIcu = Math.max(maxReqIcu, slot.reqIcu);
        maxReqTransfer = Math.max(maxReqTransfer, slot.reqTransfer);
      }
    }

    if (maxReqIac > 0 && teamIac < maxReqIac) {
      issues.push({
        severity: "warning",
        code: "SHIFT_UNREACHABLE_IAC",
        doctorId: null,
        doctorName: null,
        message:
          `Shift "${entry.name}" requires up to ${maxReqIac} IAC-competent ` +
          `doctor(s) per slot but only ${teamIac} in the team have IAC.`,
      });
    }
    if (maxReqIaoc > 0 && teamIaoc < maxReqIaoc) {
      issues.push({
        severity: "warning",
        code: "SHIFT_UNREACHABLE_IAOC",
        doctorId: null,
        doctorName: null,
        message:
          `Shift "${entry.name}" requires up to ${maxReqIaoc} IAOC-competent ` +
          `doctor(s) per slot but only ${teamIaoc} in the team have IAOC.`,
      });
    }
    if (maxReqIcu > 0 && teamIcu < maxReqIcu) {
      issues.push({
        severity: "warning",
        code: "SHIFT_UNREACHABLE_ICU",
        doctorId: null,
        doctorName: null,
        message:
          `Shift "${entry.name}" requires up to ${maxReqIcu} ICU-competent ` +
          `doctor(s) per slot but only ${teamIcu} in the team have ICU.`,
      });
    }
    if (maxReqTransfer > 0 && teamTransfer < maxReqTransfer) {
      issues.push({
        severity: "warning",
        code: "SHIFT_UNREACHABLE_TRANSFER",
        doctorId: null,
        doctorName: null,
        message:
          `Shift "${entry.name}" requires up to ${maxReqTransfer} ` +
          `transfer-trained doctor(s) per slot but only ${teamTransfer} ` +
          `in the team have transfer competency.`,
      });
    }

    // W5: grade requirement check — are any permitted grade lists
    // in the slots for this shift entirely unrepresented in the team?
    for (const e of allEntriesForShift) {
      for (const slot of e.slots) {
        if (slot.permittedGrades.length === 0) continue;
        const teamHasGrade = slot.permittedGrades.some((g) => teamGrades.has(g));
        if (!teamHasGrade) {
          // Already raised as C9 (critical) if no eligible doctor exists.
          // Only raise warning here if at least one eligible doctor exists
          // but the grade coverage is thin (1 doctor only).
          const eligibleCount = submitted.filter((d) => {
            const canonical = canonicalGrade(d.grade);
            return canonical !== "" && slot.permittedGrades.includes(canonical);
          }).length;
          if (eligibleCount === 1) {
            const label = slot.label ? `"${slot.label}"` : `slot ${slot.slotIndex + 1}`;
            issues.push({
              severity: "warning",
              code: "SLOT_GRADE_THIN_COVERAGE",
              doctorId: null,
              doctorName: null,
              message:
                `${entry.name} (${e.dayKey}), ${label}: ` +
                `only 1 doctor is eligible for grades [${slot.permittedGrades.join(", ")}]. ` +
                `Leave or absence may make this shift impossible to fill.`,
            });
          }
        }
      }
    }

    warnedShiftKeys.add(entry.shiftKey);
  }

  // W6: survey deadline passed with unsubmitted doctors
  if (rotaConfig.surveyDeadline) {
    const unsubmitted = doctors.filter((d) => d.surveyStatus !== "submitted").length;
    if (new Date() > new Date(rotaConfig.surveyDeadline) && unsubmitted > 0) {
      issues.push({
        severity: "warning",
        code: "DEADLINE_PASSED_MISSING",
        doctorId: null,
        doctorName: null,
        message: `Survey deadline has passed but ${unsubmitted} doctor(s) ` + `have not submitted.`,
      });
    }
  }

  // ─────────────────────────────────────────────────────────
  // INFO CHECKS
  // ─────────────────────────────────────────────────────────

  for (const doctor of doctors) {
    if (!doctor.survey) continue;
    const name = `Dr ${doctor.firstName} ${doctor.lastName}`;
    const wte = doctor.survey.wtePercent ?? 100;

    // I1: parental leave expected during rota period
    if (doctor.survey.parentalLeaveExpected && doctor.survey.parentalLeaveStart) {
      issues.push({
        severity: "info",
        code: "PARENTAL_LEAVE_FLAGGED",
        doctorId: doctor.id,
        doctorName: name,
        message: `${name}: Parental leave expected from ${doctor.survey.parentalLeaveStart}.`,
      });
    }

    // I2: LTFT day count mismatch vs WTE
    if (doctor.survey.ltftDaysOff.length > 0 && wte < 100) {
      const expectedDays = Math.round((1 - wte / 100) * 5);
      if (doctor.survey.ltftDaysOff.length !== expectedDays) {
        issues.push({
          severity: "info",
          code: "LTFT_DAY_COUNT_MISMATCH",
          doctorId: doctor.id,
          doctorName: name,
          message:
            `${name}: ${doctor.survey.ltftDaysOff.length} LTFT day(s) off selected ` +
            `but ${expectedDays} expected for ${wte}% WTE.`,
          field: "ltft_days_off",
        });
      }
    }
  }

  // I3: high leave concentration — 4+ doctors on AL/SL in same week
  const leaveCountByDate: Record<string, number> = {};
  for (const doctor of doctors) {
    if (!doctor.survey) continue;
    for (const leave of [...doctor.survey.annualLeave, ...doctor.survey.studyLeave]) {
      if (!leave.startDate || !leave.endDate) continue;
      const cur = new Date(leave.startDate);
      const end = new Date(leave.endDate);
      while (cur <= end) {
        const key = cur.toISOString().split("T")[0];
        leaveCountByDate[key] = (leaveCountByDate[key] ?? 0) + 1;
        cur.setDate(cur.getDate() + 1);
      }
    }
  }
  const flaggedWeeks = new Set<string>();
  for (const [date, count] of Object.entries(leaveCountByDate)) {
    if (count >= 4) {
      const d = new Date(date);
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // rewind to Monday
      flaggedWeeks.add(d.toISOString().split("T")[0]);
    }
  }
  for (const weekStart of flaggedWeeks) {
    issues.push({
      severity: "info",
      code: "HIGH_LEAVE_CONCENTRATION",
      doctorId: null,
      doctorName: null,
      message: `Week starting ${weekStart}: 4 or more doctors have AL/SL — ` + `check coverage is sufficient.`,
    });
  }

  return issues;
}
