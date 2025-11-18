"use client";

import { useMemo, useState } from "react";

type Mode = "noDeadline" | "withDeadline";
type LaborMode = "perPage" | "salary";

interface InputState {
  pages: number;                 // จำนวนหน้าที่ลูกค้าจ้าง
  laborPerPage: number;          // ค่าจ้างสแกนต่อหน้า
  monthlySalaryPerWorker: number;// เงินเดือนต่อคน/เดือน (ใช้ถ้าเลือกจ้างแบบเงินเดือน)
  scannerMonthly: number;        // ค่าเช่าเครื่องสแกน/เดือน/เครื่อง
  pcMonthly: number;             // ค่าเช่าคอม/เดือน/เครื่อง
  workingDaysPerMonth: number;   // จำนวนวันทำงานต่อเดือน
  officePerJob: number;          // ค่าอุปกรณ์สำนักงาน/งาน
  riskRate: number;              // % ค่าความเสี่ยง (เช่น 0.03)
  gpRate: number;                // % GP เป้าหมาย (เช่น 0.35)
  capacityPerPersonPerDay: number; // ความสามารถสแกนต่อคน/วัน
  workersManual: number;         // จำนวนคน (ใช้ในโหมดไม่มี deadline)
  deadlineDays: number;          // จำนวนวันตามที่ลูกค้ากำหนด (โหมดมี deadline)
  trialPricePerPage: number;     // ใช้ทดลองราคาขายต่อหน้า
}

interface CalcResult {
  valid: boolean;
  modeUsed: Mode;
  workers: number;
  daysNeeded: number;
  monthsNeeded: number;
  monthlyRentalPerWorker: number;
  rentalTotal: number;
  laborCost: number;
  officeCost: number;
  baseCost: number;
  requiredRevenue: number | null;
  requiredPricePerPage: number | null;
  riskAmount: number | null;
  targetGPAmount: number | null;
  profitAfterRisk: number | null;
  trialRevenue: number | null;
  trialRiskAmount: number | null;
  trialProfit: number | null;
  trialGPPercent: number | null;
  errors: string[];
}

interface Scenario {
  id: number;
  name: string;
  pages: number;
  deadlineDays: number;
}

function safeNumber(value: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) return 0;
  return value;
}

function calculate(
  input: InputState,
  mode: Mode,
  laborMode: LaborMode
): CalcResult {
  const errors: string[] = [];

  const pages = safeNumber(input.pages);
  const laborPerPage = safeNumber(input.laborPerPage);
  const monthlySalaryPerWorker = safeNumber(input.monthlySalaryPerWorker);
  const scannerMonthly = safeNumber(input.scannerMonthly);
  const pcMonthly = safeNumber(input.pcMonthly);
  const workingDaysPerMonth = safeNumber(input.workingDaysPerMonth);
  const officePerJob = safeNumber(input.officePerJob);
  const riskRate = safeNumber(input.riskRate);
  const gpRate = safeNumber(input.gpRate);
  const capacity = safeNumber(input.capacityPerPersonPerDay);
  const workersManual = Math.max(1, safeNumber(input.workersManual));
  const deadlineDays = safeNumber(input.deadlineDays);
  const trialPricePerPage = safeNumber(input.trialPricePerPage);

  if (pages <= 0) errors.push("กรุณากรอกจำนวนหน้าให้มากกว่า 0");
  if (capacity <= 0) errors.push("กรุณากรอกความสามารถสแกนต่อคน/วันให้มากกว่า 0");
  if (workingDaysPerMonth <= 0) errors.push("กรุณากรอกจำนวนวันทำงานต่อเดือนให้มากกว่า 0");
  if (1 - riskRate - gpRate <= 0) {
    errors.push("ค่าความเสี่ยง + GP ต้องรวมน้อยกว่า 100%");
  }

  // 1) จำนวนคน
  let workers: number;
  if (mode === "withDeadline" && deadlineDays > 0) {
    const rawWorkers = pages / (capacity * deadlineDays);
    workers = Math.max(1, Math.ceil(rawWorkers));
  } else {
    workers = workersManual;
  }

  // 2) จำนวนวันทำงานจริง
  let daysNeeded = 0;
  if (capacity > 0 && workers > 0) {
    daysNeeded = pages / (capacity * workers);
  }

  // 3) จำนวนเดือนที่ต้องเช่าเครื่อง/คอม
  let monthsNeeded = 0;
  if (workingDaysPerMonth > 0 && daysNeeded > 0) {
    monthsNeeded = Math.ceil(daysNeeded / workingDaysPerMonth);
  }

  // 4) ค่าเช่าเครื่อง/คอม
  const monthlyRentalPerWorker = scannerMonthly + pcMonthly;
  const rentalTotal = monthlyRentalPerWorker * workers * monthsNeeded;

  // 5) ต้นทุนแรงงาน
  let laborCost = 0;
  if (laborMode === "perPage") {
    laborCost = pages * laborPerPage;
  } else {
    laborCost = monthlySalaryPerWorker * workers * monthsNeeded;
  }

  // 6) ต้นทุนอื่น ๆ
  const officeCost = officePerJob;
  const baseCost = rentalTotal + laborCost + officeCost;

  // 7) รายได้ที่ต้องการ
  let requiredRevenue: number | null = null;
  let requiredPricePerPage: number | null = null;
  let riskAmount: number | null = null;
  let targetGPAmount: number | null = null;
  let profitAfterRisk: number | null = null;

  if (baseCost > 0 && 1 - riskRate - gpRate > 0 && errors.length === 0) {
    requiredRevenue = baseCost / (1 - riskRate - gpRate);
    riskAmount = requiredRevenue * riskRate;
    targetGPAmount = requiredRevenue * gpRate;
    profitAfterRisk = requiredRevenue - baseCost - riskAmount;
    if (pages > 0) {
      requiredPricePerPage = requiredRevenue / pages;
    }
  }

  // 8) โหมดทดลองราคา
  let trialRevenue: number | null = null;
  let trialRiskAmount: number | null = null;
  let trialProfit: number | null = null;
  let trialGPPercent: number | null = null;

  if (trialPricePerPage > 0 && pages > 0 && baseCost > 0) {
    trialRevenue = trialPricePerPage * pages;
    trialRiskAmount = trialRevenue * riskRate;
    trialProfit = trialRevenue - baseCost - trialRiskAmount;
    if (trialRevenue !== 0) {
      trialGPPercent = trialProfit / trialRevenue;
    }
  }

  return {
    valid: errors.length === 0,
    modeUsed: mode,
    workers,
    daysNeeded,
    monthsNeeded,
    monthlyRentalPerWorker,
    rentalTotal,
    laborCost,
    officeCost,
    baseCost,
    requiredRevenue,
    requiredPricePerPage,
    riskAmount,
    targetGPAmount,
    profitAfterRisk,
    trialRevenue,
    trialRiskAmount,
    trialProfit,
    trialGPPercent,
    errors,
  };
}

export default function Page() {
  const [mode, setMode] = useState<Mode>("noDeadline");
  const [laborMode, setLaborMode] = useState<LaborMode>("perPage");

  const [input, setInput] = useState<InputState>({
    pages: 20000,
    laborPerPage: 0.3,
    monthlySalaryPerWorker: 15000,
    scannerMonthly: 4500,
    pcMonthly: 3000,
    workingDaysPerMonth: 22,
    officePerJob: 10000,
    riskRate: 0.03,
    gpRate: 0.35,
    capacityPerPersonPerDay: 1500,
    workersManual: 1,
    deadlineDays: 30,
    trialPricePerPage: 1.5,
  });

  const [scenarios, setScenarios] = useState<Scenario[]>([
    { id: 1, name: "Scenario A", pages: 20000, deadlineDays: 30 },
    { id: 2, name: "Scenario B", pages: 50000, deadlineDays: 45 },
    { id: 3, name: "Scenario C", pages: 100000, deadlineDays: 60 },
  ]);

  const result = useMemo(
    () => calculate(input, mode, laborMode),
    [input, mode, laborMode]
  );

  const scenarioResults = useMemo(
    () =>
      scenarios.map((s) => ({
        scenario: s,
        result: calculate(
          { ...input, pages: s.pages, deadlineDays: s.deadlineDays },
          mode,
          laborMode
        ),
      })),
    [scenarios, input, mode, laborMode]
  );

  const handleChangeNumber =
    (field: keyof InputState) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setInput((prev) => ({
        ...prev,
        [field]: value === "" ? 0 : Number(value),
      }));
    };

  const handleScenarioChange =
    (id: number, field: "pages" | "deadlineDays") =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value === "" ? 0 : Number(e.target.value);
      setScenarios((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, [field]: value } : s
        )
      );
    };

  const formatBaht = (n: number | null | undefined) =>
    n == null ? "-" : n.toLocaleString("th-TH", { maximumFractionDigits: 2 });

  const formatNumber = (n: number | null | undefined, digits = 2) =>
    n == null ? "-" : n.toLocaleString("th-TH", { maximumFractionDigits: digits });

  const formatPercent = (n: number | null | undefined) =>
    n == null
      ? "-"
      : (n * 100).toLocaleString("th-TH", { maximumFractionDigits: 2 }) + " %";

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-50 flex justify-center px-4 py-10">
      <div className="w-full max-w-6xl space-y-8">
        {/* Header */}
        <header className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Scan Cost Simulation Dashboard
          </div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Scan Cost Planner & Scenario Dashboard
          </h1>
          <p className="text-slate-300 text-sm md:text-base max-w-3xl">
            คำนวณต้นทุนและราคาขายงานสแกนเอกสารทั้งแบบราย Job และเปรียบเทียบ
            หลาย Scenario เช่น 20K / 50K / 100K หน้า เพื่อช่วยตัดสินใจตั้งราคาที่เหมาะสม
          </p>
        </header>

        {/* Mode selector */}
        <section className="bg-slate-900/70 backdrop-blur border border-slate-800/80 rounded-2xl p-4 md:p-6 space-y-4 shadow-[0_18px_45px_rgba(0,0,0,0.45)]">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <span className="inline-block h-6 w-1 rounded-full bg-emerald-400" />
            1. เลือกโหมดการคำนวณงาน 1 Job
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMode("noDeadline")}
              className={`rounded-xl px-4 py-3 text-left border text-sm md:text-base transition
              ${
                mode === "noDeadline"
                  ? "border-emerald-400 bg-emerald-500/10 shadow-[0_0_25px_rgba(16,185,129,0.45)]"
                  : "border-slate-700 bg-slate-900/60 hover:border-slate-500"
              }`}
            >
              <div className="font-semibold">ลูกค้าไม่กำหนดวันส่งงาน</div>
              <div className="text-xs md:text-sm text-slate-300 mt-1">
                ใช้สูตรเหมือน ScanCostModel_v2.xlsx — คุณกำหนดจำนวนคนเอง
              </div>
            </button>

            <button
              type="button"
              onClick={() => setMode("withDeadline")}
              className={`rounded-xl px-4 py-3 text-left border text-sm md:text-base transition
              ${
                mode === "withDeadline"
                  ? "border-cyan-400 bg-cyan-500/10 shadow-[0_0_25px_rgba(34,211,238,0.45)]"
                  : "border-slate-700 bg-slate-900/60 hover:border-slate-500"
              }`}
            >
              <div className="font-semibold">ลูกค้ากำหนดวันส่งงาน</div>
              <div className="text-xs md:text-sm text-slate-300 mt-1">
                ใช้สูตรเหมือน ScanCostModel_v3.xlsx — ระบบคำนวณจำนวนคน/เครื่องให้
              </div>
            </button>
          </div>
        </section>

        {/* Labor mode selector */}
        <section className="bg-slate-900/70 backdrop-blur border border-slate-800/80 rounded-2xl p-4 md:p-6 space-y-4 shadow-[0_18px_45px_rgba(0,0,0,0.45)]">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <span className="inline-block h-6 w-1 rounded-full bg-indigo-400" />
            2. เลือกรูปแบบการจ้างคนสแกน
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setLaborMode("perPage")}
              className={`rounded-xl px-4 py-3 text-left border text-sm md:text-base transition
              ${
                laborMode === "perPage"
                  ? "border-amber-400 bg-amber-500/10 shadow-[0_0_25px_rgba(251,191,36,0.45)]"
                  : "border-slate-700 bg-slate-900/60 hover:border-slate-500"
              }`}
            >
              <div className="font-semibold">จ้างรายหน้า</div>
              <div className="text-xs md:text-sm text-slate-300 mt-1">
                ค่าแรง = จำนวนหน้า × ค่าจ้างต่อหน้า (เช่น 0.30 บาท/หน้า)
              </div>
            </button>

            <button
              type="button"
              onClick={() => setLaborMode("salary")}
              className={`rounded-xl px-4 py-3 text-left border text-sm md:text-base transition
              ${
                laborMode === "salary"
                  ? "border-fuchsia-400 bg-fuchsia-500/10 shadow-[0_0_25px_rgba(244,114,182,0.45)]"
                  : "border-slate-700 bg-slate-900/60 hover:border-slate-500"
              }`}
            >
              <div className="font-semibold">จ้างแบบเงินเดือน</div>
              <div className="text-xs md:text-sm text-slate-300 mt-1">
                ค่าแรง = เงินเดือนต่อคน/เดือน × จำนวนคน × จำนวนเดือนที่ทำงาน
              </div>
            </button>
          </div>
        </section>

        {/* Inputs */}
        <section className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 md:p-6 space-y-4 shadow-[0_18px_45px_rgba(0,0,0,0.55)]">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <span className="inline-block h-6 w-1 rounded-full bg-sky-400" />
            3. ใส่ข้อมูลต้นทุนและเงื่อนไขงาน (Single Job)
          </h2>

          <div className="grid md:grid-cols-2 gap-4">
            {/* คอลัมน์ซ้าย */}
            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-slate-200 mb-1">
                  จำนวนหน้าที่ลูกค้าจ้าง (หน้า)
                </label>
                <input
                  type="number"
                  className="w-full rounded-lg bg-slate-950/70 border border-slate-700 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  value={input.pages}
                  onChange={handleChangeNumber("pages")}
                  min={0}
                />
              </div>

              {laborMode === "perPage" && (
                <div>
                  <label className="block text-slate-200 mb-1">
                    ค่าจ้างสแกนต่อหน้า (บาท/หน้า)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full rounded-lg bg-slate-950/70 border border-slate-700 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-400"
                    value={input.laborPerPage}
                    onChange={handleChangeNumber("laborPerPage")}
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    เช่น 0.30 บาท/หน้า
                  </p>
                </div>
              )}

              {laborMode === "salary" && (
                <div>
                  <label className="block text-slate-200 mb-1">
                    เงินเดือนต่อคนต่อเดือน (บาท)
                  </label>
                  <input
                    type="number"
                    className="w-full rounded-lg bg-slate-950/70 border border-slate-700 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-fuchsia-400"
                    value={input.monthlySalaryPerWorker}
                    onChange={handleChangeNumber("monthlySalaryPerWorker")}
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    เช่น 15,000 บาท/คน/เดือน
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-200 mb-1">
                    ค่าเช่าเครื่องสแกน/เดือน/เครื่อง
                  </label>
                  <input
                    type="number"
                    className="w-full rounded-lg bg-slate-950/70 border border-slate-700 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-400"
                    value={input.scannerMonthly}
                    onChange={handleChangeNumber("scannerMonthly")}
                  />
                </div>
                <div>
                  <label className="block text-slate-200 mb-1">
                    ค่าเช่าคอมพิวเตอร์/เดือน/เครื่อง
                  </label>
                  <input
                    type="number"
                    className="w-full rounded-lg bg-slate-950/70 border border-slate-700 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-400"
                    value={input.pcMonthly}
                    onChange={handleChangeNumber("pcMonthly")}
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-200 mb-1">
                  จำนวนวันทำงานต่อเดือน (วัน)
                </label>
                <input
                  type="number"
                  className="w-full rounded-lg bg-slate-950/70 border border-slate-700 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-400"
                  value={input.workingDaysPerMonth}
                  onChange={handleChangeNumber("workingDaysPerMonth")}
                />
              </div>

              <div>
                <label className="block text-slate-200 mb-1">
                  ค่าอุปกรณ์สำนักงานต่อ 1 งาน (บาท)
                </label>
                <input
                  type="number"
                  className="w-full rounded-lg bg-slate-950/70 border border-slate-700 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-400"
                  value={input.officePerJob}
                  onChange={handleChangeNumber("officePerJob")}
                />
              </div>
            </div>

            {/* คอลัมน์ขวา */}
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-200 mb-1">
                    ค่าความเสี่ยง (% ของรายได้)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full rounded-lg bg-slate-950/70 border border-slate-700 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-rose-400"
                    value={input.riskRate * 100}
                    onChange={(e) =>
                      setInput((prev) => ({
                        ...prev,
                        riskRate:
                          e.target.value === ""
                            ? 0
                            : Number(e.target.value) / 100,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-slate-200 mb-1">
                    กำไรขั้นต้นที่ต้องการ GP (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full rounded-lg bg-slate-950/70 border border-slate-700 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                    value={input.gpRate * 100}
                    onChange={(e) =>
                      setInput((prev) => ({
                        ...prev,
                        gpRate:
                          e.target.value === ""
                            ? 0
                            : Number(e.target.value) / 100,
                      }))
                    }
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-200 mb-1">
                  ความสามารถในการสแกนต่อคน (หน้า/วัน)
                </label>
                <input
                  type="number"
                  className="w-full rounded-lg bg-slate-950/70 border border-slate-700 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  value={input.capacityPerPersonPerDay}
                  onChange={handleChangeNumber("capacityPerPersonPerDay")}
                />
              </div>

              {mode === "noDeadline" ? (
                <div>
                  <label className="block text-slate-200 mb-1">
                    จำนวนคนทำงาน (ใช้ในโหมดไม่มี deadline)
                  </label>
                  <input
                    type="number"
                    className="w-full rounded-lg bg-slate-950/70 border border-slate-700 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    value={input.workersManual}
                    onChange={handleChangeNumber("workersManual")}
                    min={1}
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    ระบบจะใช้จำนวนคนนี้คำนวณจำนวนวัน และจำนวนเดือนที่ต้องเช่าเครื่อง
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-slate-200 mb-1">
                    ลูกค้าให้เวลาทำงาน (วัน)
                  </label>
                  <input
                    type="number"
                    className="w-full rounded-lg bg-slate-950/70 border border-slate-700 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    value={input.deadlineDays}
                    onChange={handleChangeNumber("deadlineDays")}
                    min={1}
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    ระบบจะคำนวณจำนวนคนที่ต้องใช้ = CEILING(จำนวนหน้า ÷
                    (ความสามารถ/คน/วัน × จำนวนวัน))
                  </p>
                </div>
              )}

              <div>
                <label className="block text-slate-200 mb-1">
                  ทดลองราคาขายต่อหน้า (บาท/หน้า) เพื่อดู GP ที่ได้จริง
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full rounded-lg bg-slate-950/70 border border-slate-700 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  value={input.trialPricePerPage}
                  onChange={handleChangeNumber("trialPricePerPage")}
                />
              </div>
            </div>
          </div>

          {/* แสดง error */}
          {result.errors.length > 0 && (
            <div className="mt-3 rounded-xl border border-red-500/60 bg-red-950/40 px-4 py-3 text-sm text-red-100 space-y-1">
              {result.errors.map((err, idx) => (
                <div key={idx}>• {err}</div>
              ))}
            </div>
          )}
        </section>

        {/* ผลลัพธ์ Single Job */}
        <section className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 md:p-6 space-y-4 shadow-[0_18px_45px_rgba(0,0,0,0.55)]">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <span className="inline-block h-6 w-1 rounded-full bg-emerald-400" />
            4. ผลลัพธ์การคำนวณงานปัจจุบัน (Single Job)
          </h2>

          <div className="grid md:grid-cols-2 gap-4 text-sm">
            {/* Block 1 */}
            <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-4 space-y-2">
              <h3 className="font-semibold mb-1 text-emerald-200">
                จำนวนคน & ระยะเวลาทำงาน
              </h3>
              <div className="flex justify-between">
                <span>จำนวนคนที่ต้องใช้</span>
                <span className="font-semibold">
                  {result.workers} คน (≈ {result.workers} เครื่องสแกน +
                  {result.workers} คอม)
                </span>
              </div>
              <div className="flex justify-between">
                <span>จำนวนวันทำงานที่ต้องใช้ (ประมาณ)</span>
                <span className="font-semibold">
                  {formatNumber(result.daysNeeded, 2)} วัน
                </span>
              </div>
              <div className="flex justify-between">
                <span>จำนวนเดือนที่ต้องเช่าเครื่อง/คอม</span>
                <span className="font-semibold">
                  {formatNumber(result.monthsNeeded, 0)} เดือน
                </span>
              </div>
              <div className="flex justify-between">
                <span>ค่าเช่าเครื่อง+คอม ต่อ 1 คน/เดือน</span>
                <span className="font-semibold">
                  {formatBaht(result.monthlyRentalPerWorker)} บาท
                </span>
              </div>
              <div className="flex justify-between">
                <span>ค่าเช่าเครื่อง+คอมรวม (ทุกคน ทุกเดือน)</span>
                <span className="font-semibold">
                  {formatBaht(result.rentalTotal)} บาท
                </span>
              </div>
              <div className="flex justify-between">
                <span>ค่าแรงรวม (ตามรูปแบบการจ้างที่เลือก)</span>
                <span className="font-semibold">
                  {formatBaht(result.laborCost)} บาท
                </span>
              </div>
            </div>

            {/* Block 2 */}
            <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-4 space-y-2">
              <h3 className="font-semibold mb-1 text-sky-200">
                ต้นทุน & ราคาขายที่ควรคิด
              </h3>
              <div className="flex justify-between">
                <span>ค่าอุปกรณ์สำนักงาน</span>
                <span className="font-semibold">
                  {formatBaht(result.officeCost)} บาท
                </span>
              </div>
              <div className="flex justify-between">
                <span>ต้นทุนฐาน (ค่าเช่า+ค่าแรง+อุปกรณ์)</span>
                <span className="font-semibold">
                  {formatBaht(result.baseCost)} บาท
                </span>
              </div>
              <div className="flex justify-between">
                <span>รายได้งานที่ต้องการ (รวมความเสี่ยง+GP)</span>
                <span className="font-semibold">
                  {formatBaht(result.requiredRevenue)} บาท
                </span>
              </div>
              <div className="flex justify-between">
                <span>ราคาขายต่อหน้า (ตามเป้า GP)</span>
                <span className="font-semibold">
                  {formatBaht(result.requiredPricePerPage)} บาท/หน้า
                </span>
              </div>
              <div className="flex justify-between">
                <span>ค่าความเสี่ยง (บาท)</span>
                <span className="font-semibold">
                  {formatBaht(result.riskAmount)} บาท
                </span>
              </div>
              <div className="flex justify-between">
                <span>กำไรขั้นต้นตามเป้าหมาย (บาท)</span>
                <span className="font-semibold">
                  {formatBaht(result.targetGPAmount)} บาท
                </span>
              </div>
              <div className="flex justify-between">
                <span>กำไรจริงหลังหักต้นทุน+ความเสี่ยง (บาท)</span>
                <span className="font-semibold">
                  {formatBaht(result.profitAfterRisk)} บาท
                </span>
              </div>
            </div>
          </div>

          {/* Trial section */}
          <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-4 space-y-2 text-sm">
            <h3 className="font-semibold mb-1 text-amber-200">
              5. ทดลองราคาขายต่อหน้า ({input.trialPricePerPage.toFixed(2)} บาท/หน้า)
            </h3>
            <div className="flex justify-between">
              <span>รายได้งานตามราคาที่ทดลอง</span>
              <span className="font-semibold">
                {formatBaht(result.trialRevenue)} บาท
              </span>
            </div>
            <div className="flex justify-between">
              <span>ค่าความเสี่ยงจากราคาที่ทดลอง</span>
              <span className="font-semibold">
                {formatBaht(result.trialRiskAmount)} บาท
              </span>
            </div>
            <div className="flex justify-between">
              <span>กำไรขั้นต้น (บาท) หลังหักต้นทุน + ความเสี่ยง</span>
              <span className="font-semibold">
                {formatBaht(result.trialProfit)} บาท
              </span>
            </div>
            <div className="flex justify-between">
              <span>กำไรขั้นต้นจริงที่ได้จากราคานี้ (%)</span>
              <span className="font-semibold">
                {formatPercent(result.trialGPPercent)}
              </span>
            </div>
          </div>
        </section>

        {/* Scenario Dashboard */}
        <section className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 md:p-6 space-y-4 shadow-[0_22px_60px_rgba(0,0,0,0.7)]">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <span className="inline-block h-6 w-1 rounded-full bg-pink-400" />
            6. Scenario Dashboard – เปรียบเทียบหลายเคสพร้อมกัน
          </h2>
          <p className="text-slate-300 text-xs md:text-sm">
            คุณสามารถลองกำหนดจำนวนหน้าและกำหนดวันส่งงานของแต่ละ Scenario
            เพื่อดูผลกระทบต่อ{" "}
            <span className="font-semibold text-emerald-200">
              จำนวนคน, ระยะเวลา, ต้นทุน และราคาขายต่อหน้า
            </span>{" "}
            ภายใต้เงื่อนไขต้นทุนและ %GP เดียวกัน
          </p>

          <div className="grid md:grid-cols-3 gap-4 text-xs md:text-sm">
            {scenarioResults.map(({ scenario, result }) => (
              <div
                key={scenario.id}
                className="rounded-2xl bg-slate-950/80 border border-slate-800 p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-400">
                      Scenario
                    </div>
                    <div className="font-semibold text-base">
                      {scenario.name}
                    </div>
                  </div>
                  <span className="rounded-full border border-slate-700 px-3 py-1 text-[11px] text-slate-300">
                    {mode === "withDeadline"
                      ? "มี Deadline"
                      : "ไม่มี Deadline"}
                  </span>
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="block text-slate-300 mb-1">
                      จำนวนหน้า (หน้า)
                    </label>
                    <input
                      type="number"
                      className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                      value={scenario.pages}
                      onChange={handleScenarioChange(scenario.id, "pages")}
                      min={0}
                    />
                  </div>
                  {mode === "withDeadline" && (
                    <div>
                      <label className="block text-slate-300 mb-1">
                        ลูกค้าให้เวลาทำงาน (วัน)
                      </label>
                      <input
                        type="number"
                        className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        value={scenario.deadlineDays}
                        onChange={handleScenarioChange(
                          scenario.id,
                          "deadlineDays"
                        )}
                        min={1}
                      />
                    </div>
                  )}
                </div>

                {result.errors.length > 0 ? (
                  <div className="mt-2 rounded-lg border border-red-500/60 bg-red-950/40 px-3 py-2 text-[11px] text-red-100 space-y-1">
                    {result.errors.map((err, idx) => (
                      <div key={idx}>• {err}</div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 space-y-1.5">
                    <div className="flex justify-between">
                      <span>คนที่ต้องใช้</span>
                      <span className="font-semibold">
                        {result.workers} คน
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>วันทำงานโดยประมาณ</span>
                      <span className="font-semibold">
                        {formatNumber(result.daysNeeded, 1)} วัน
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>เดือนที่ต้องเช่า</span>
                      <span className="font-semibold">
                        {formatNumber(result.monthsNeeded, 0)} เดือน
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>ต้นทุนฐาน</span>
                      <span className="font-semibold">
                        {formatBaht(result.baseCost)} ฿
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>รายได้ที่ควรคิด</span>
                      <span className="font-semibold">
                        {formatBaht(result.requiredRevenue)} ฿
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>ราคาขายต่อหน้า</span>
                      <span className="font-semibold text-emerald-300">
                        {formatBaht(result.requiredPricePerPage)} ฿/หน้า
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
