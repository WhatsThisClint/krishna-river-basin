import React, { useEffect, useState, useMemo } from "react";
import {
  Play,
  Pause,
  Download,
  ArrowRight,
  ArrowUpRight,
  Layers,
  Clock,
  GitCompare,
  Share2,
  Database,
  Sprout,
  TrendingUp,
  ShieldCheck,
  BookOpen,
  FileText,
  Check,
} from "lucide-react";
import { EChartBox } from "./components/EChartBox";
import { BasinMap } from "./components/BasinMap";
import { DataProvenance } from "./components/DataProvenance";

type TopMode = "story" | "workbench" | "provenance";

type WorkbenchTab =
  | "time"
  | "compare"
  | "sankey"
  | "subbasins"
  | "agriculture"
  | "trends"
  | "validation";

const SUBBASIN_OPTIONS = [
  { id: "KRISHNA_BASIN", name: "Entire Krishna Basin (258,948 km²)", short: "Entire Basin" },
  { id: "KRI_UPPER", name: "KRI_UPPER · Upper Krishna (54,505 km²)", short: "Upper Krishna" },
  { id: "BHI_UPPER", name: "BHI_UPPER · Upper Bhima (44,793 km²)", short: "Upper Bhima" },
  { id: "BHI_LOWER", name: "BHI_LOWER · Lower Bhima (23,653 km²)", short: "Lower Bhima" },
  { id: "KRI_MIDDLE", name: "KRI_MIDDLE · Middle Krishna (22,229 km²)", short: "Middle Krishna" },
  { id: "TUN_UPPER", name: "TUN_UPPER · Upper Tungabhadra (28,519 km²)", short: "Upper Tungabhadra" },
  { id: "TUN_LOWER", name: "TUN_LOWER · Lower Tungabhadra (41,557 km²)", short: "Lower Tungabhadra" },
  { id: "KRI_LOWER", name: "KRI_LOWER · Lower Krishna Delta (39,494 km²)", short: "Krishna Delta" },
];

const SUBBASIN_NARRATIVES: Record<string, string> = {
  KRISHNA_BASIN:
    "Spanning Maharashtra, Karnataka, Telangana, and Andhra Pradesh, the basin integrates wet Western Ghats headwaters with a vast semi-arid interior rain shadow before discharging into the Bay of Bengal.",
  KRI_UPPER:
    "Anchored by the high-rainfall Western Ghats crest (Koyna, Warna, Panchganga, Almatti), Upper Krishna generates nearly 45% of the basin's natural surface water yield and exports ~1.92 BCM/yr westward for hydropower.",
  BHI_UPPER:
    "Home to Pune, Solapur, and the Ujjani reservoir command, Upper Bhima combines intense urban-industrial demand with year-round sugarcane cultivation and high hard-rock groundwater extraction.",
  BHI_LOWER:
    "Lying deep in the Deccan rain shadow (~710 mm/yr), Lower Bhima experiences frequent meteorological droughts and relies heavily on fractured basalt borewells and upstream Ujjani releases.",
  KRI_MIDDLE:
    "The mainstem collector between Narayanpur, Raichur, and Srisailam. Receives combined inflows from Upper Krishna and the Bhima cascade while supporting extensive canal command irrigation.",
  TUN_UPPER:
    "Fed by the Sahyadri hills of Chikmagalur and Shimoga (Bhadra and Tunga reservoirs), Upper Tungabhadra provides vital monsoon runoff before entering the drier northern Karnataka plains.",
  TUN_LOWER:
    "Encompassing the semi-arid Rayalaseema and Bellary-Raichur corridors (~640 mm/yr), Lower Tungabhadra exhibits the highest aridity and geogenic fluoride groundwater constraints in the basin.",
  KRI_LOWER:
    "Below Nagarjuna Sagar and Prakasam Barrage, the river fans into the fertile Krishna Delta, supplemented since 2016 by 1.2–3.1 BCM/yr of inter-basin Godavari transfers via the Pattiseema canal.",
};

export default function App() {
  const [mode, setMode] = useState<TopMode>("story");
  const [wbTab, setWbTab] = useState<WorkbenchTab>("time");
  const [selectedSubbasin, setSelectedSubbasin] = useState<string>("KRISHNA_BASIN");
  const [selectedYear, setSelectedYear] = useState<string>("2024-25");

  // Overview state
  const [overview, setOverview] = useState<any>(null);

  // Time explorer state
  const [timeScale, setTimeScale] = useState<"annual" | "seasonal" | "monthly">("annual");
  const [wbSeries, setWbSeries] = useState<any[]>([]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [yearIndex, setYearIndex] = useState<number>(24);

  // Compare years state
  const [compareYearA, setCompareYearA] = useState<string>("2002-03");
  const [compareYearB, setCompareYearB] = useState<string>("2020-21");
  const [compareData, setCompareData] = useState<any>(null);

  const compareDeltas = useMemo(() => {
    if (!compareData) return [];
    if (compareData.deltas && compareData.deltas.length) return compareData.deltas;
    const basinRow =
      (compareData.subbasin_comparisons || []).find((s: any) => s.subbasin_id === "KRISHNA_BASIN") ||
      compareData.subbasin_comparisons?.[0];
    if (!basinRow) return [];
    return [
      { label: "Precipitation", year_a_val: basinRow.precip_bcm_a, year_b_val: basinRow.precip_bcm_b },
      { label: "Total Actual ET", year_a_val: basinRow.et_actual_total_bcm_a, year_b_val: basinRow.et_actual_total_bcm_b },
      { label: "Blue Crop ET", year_a_val: basinRow.et_blue_agri_bcm_a, year_b_val: basinRow.et_blue_agri_bcm_b },
      { label: "Surface Runoff", year_a_val: basinRow.surface_runoff_bcm_a, year_b_val: basinRow.surface_runoff_bcm_b },
      { label: "GW Recharge", year_a_val: basinRow.gw_total_recharge_bcm_a, year_b_val: basinRow.gw_total_recharge_bcm_b },
      { label: "GW Withdrawal", year_a_val: basinRow.gw_withdrawal_total_bcm_a, year_b_val: basinRow.gw_withdrawal_total_bcm_b },
      { label: "River Outflow", year_a_val: basinRow.subbasin_outflow_bcm_a, year_b_val: basinRow.subbasin_outflow_bcm_b },
    ];
  }, [compareData]);

  // Sankey state
  const [sankeyYear, setSankeyYear] = useState<string>("2000-26_MEAN");
  const [sankeyData, setSankeyData] = useState<any>(null);
  const [sankeyHeight, setSankeyHeight] = useState<string>("750px");

  // Sub-basins & Reservoirs state
  const [subbasinsDetail, setSubbasinsDetail] = useState<any>(null);
  const [selectedReservoir, setSelectedReservoir] = useState<string>("RES_SRISAILAM");
  const [activeEtBar, setActiveEtBar] = useState<"green" | "blue" | "nat" | "res" | null>(null);

  // Agriculture & AnthroKrishi state
  const [agriData, setAgriData] = useState<any>(null);
  const [s2Search, setS2Search] = useState<string>("");

  // Trends & Attribution state
  const [trendsData, setTrendsData] = useState<any>(null);

  // Validation & Figures state
  const [valData, setValData] = useState<any>(null);
  const [selectedFigure, setSelectedFigure] = useState<string>("Fig01_QGIS_Master_Basin_Architecture.png");

  // Initial overview fetch
  useEffect(() => {
    fetch("/api/overview")
      .then((r) => r.json())
      .then(setOverview)
      .catch(console.error);
  }, []);

  // Water balance series fetch
  useEffect(() => {
    fetch(`/api/water-balance?subbasin_id=${selectedSubbasin}&scale=${timeScale}`)
      .then((r) => r.json())
      .then((d) => setWbSeries(d.data || []))
      .catch(console.error);
  }, [selectedSubbasin, timeScale]);

  const hydroYearsList = useMemo(() => {
    if (!overview?.annual_basin_series) return ["2024-25"];
    return overview.annual_basin_series.map((r: any) => r.hydro_year);
  }, [overview]);

  // Scrubber animation
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setYearIndex((prev) => {
        const next = (prev + 1) % Math.max(1, hydroYearsList.length - 1);
        setSelectedYear(hydroYearsList[next]);
        return next;
      });
    }, 1100);
    return () => clearInterval(timer);
  }, [isPlaying, hydroYearsList]);

  // Compare fetch
  useEffect(() => {
    if (mode === "workbench" && wbTab === "compare") {
      fetch(`/api/compare?year_a=${compareYearA}&year_b=${compareYearB}`)
        .then((r) => r.json())
        .then(setCompareData)
        .catch(console.error);
    }
  }, [mode, wbTab, compareYearA, compareYearB]);

  // Sankey fetch
  useEffect(() => {
    if (mode === "story" || (mode === "workbench" && wbTab === "sankey")) {
      fetch(`/api/sankey?hydro_year=${sankeyYear}&subbasin_id=${selectedSubbasin}`)
        .then((r) => r.json())
        .then(setSankeyData)
        .catch(console.error);
    }
  }, [mode, wbTab, sankeyYear, selectedSubbasin]);

  // Subbasins detail fetch
  useEffect(() => {
    if (mode === "workbench" && wbTab === "subbasins") {
      fetch(`/api/subbasins?hydro_year=${selectedYear === "2026-27" ? "2025-26" : selectedYear}`)
        .then((r) => r.json())
        .then(setSubbasinsDetail)
        .catch(console.error);
    }
  }, [mode, wbTab, selectedYear]);

  // Agriculture fetch
  useEffect(() => {
    if (mode === "workbench" && wbTab === "agriculture") {
      fetch(`/api/agriculture?subbasin_id=${selectedSubbasin}`)
        .then((r) => r.json())
        .then(setAgriData)
        .catch(console.error);
    }
  }, [mode, wbTab, selectedSubbasin]);

  // Trends fetch
  useEffect(() => {
    if (mode === "workbench" && wbTab === "trends") {
      fetch(`/api/trends-attribution?subbasin_id=${selectedSubbasin}`)
        .then((r) => r.json())
        .then(setTrendsData)
        .catch(console.error);
    }
  }, [mode, wbTab, selectedSubbasin]);

  // Validation fetch
  useEffect(() => {
    if (mode === "workbench" && wbTab === "validation") {
      fetch("/api/quality-validation")
        .then((r) => r.json())
        .then(setValData)
        .catch(console.error);
    }
  }, [mode, wbTab]);

  // 26-year basin means
  const basinMeans = useMemo(() => {
    if (!overview?.annual_basin_series) return null;
    const complete = overview.annual_basin_series.filter((r: any) => !r.is_incomplete_year);
    if (!complete.length) return null;
    const avg = (k: string) =>
      complete.reduce((acc: number, row: any) => acc + Number(row[k] || 0), 0) / complete.length;
    return {
      precip_mm: avg("precip_mm").toFixed(1),
      precip_bcm: avg("precip_bcm").toFixed(2),
      et_total_bcm: avg("et_actual_total_bcm").toFixed(2),
      et_green_bcm: avg("et_green_agri_bcm").toFixed(2),
      et_blue_bcm: avg("et_blue_agri_bcm").toFixed(2),
      et_nat_bcm: avg("et_natural_veg_bcm").toFixed(2),
      et_res_bcm: (avg("et_open_water_bcm") || avg("et_reservoir_evap_bcm")).toFixed(2),
      runoff_bcm: avg("surface_runoff_bcm").toFixed(2),
      baseflow_bcm: avg("gw_baseflow_bcm").toFixed(2),
      natural_yield_bcm: (avg("surface_runoff_bcm") + avg("gw_baseflow_bcm")).toFixed(2),
      gw_recharge_bcm: avg("gw_total_recharge_bcm").toFixed(2),
      gw_withdrawal_bcm: avg("gw_withdrawal_total_bcm").toFixed(2),
      sw_withdrawal_bcm: avg("sw_withdrawal_total_bcm").toFixed(2),
      terminal_outflow_bcm: avg("subbasin_outflow_bcm").toFixed(2),
      delta_gw_bcm: avg("delta_storage_gw_bcm").toFixed(2),
      residual_bcm: avg("mass_balance_residual_bcm").toFixed(4),
    };
  }, [overview]);

  // Active series for selected unit in annual scale
  const activeUnitAnnualSeries = useMemo(() => {
    if (selectedSubbasin === "KRISHNA_BASIN" && overview?.annual_basin_series) {
      return overview.annual_basin_series.filter((r: any) => !r.is_incomplete_year);
    }
    if (timeScale === "annual" && wbSeries.length > 0) {
      return wbSeries.filter((r: any) => !r.is_incomplete_year);
    }
    return (overview?.annual_basin_series || []).filter((r: any) => !r.is_incomplete_year);
  }, [selectedSubbasin, overview, timeScale, wbSeries]);

  const currentYearRecord = useMemo(() => {
    const list = activeUnitAnnualSeries;
    if (!list || !list.length) return null;
    return list.find((r: any) => r.hydro_year === selectedYear) || list[list.length - 1];
  }, [activeUnitAnnualSeries, selectedYear]);

  const workbenchTabs: { id: WorkbenchTab; label: string; icon: any }[] = [
    { id: "time", label: "Time Series (2000–27)", icon: Clock },
    { id: "compare", label: "Compare Years", icon: GitCompare },
    { id: "sankey", label: "WA+ Sankey Flow", icon: Share2 },
    { id: "subbasins", label: "Sub-Basins & Reservoirs", icon: Database },
    { id: "agriculture", label: "Agriculture & S2 Cells", icon: Sprout },
    { id: "trends", label: "Mann–Kendall Trends", icon: TrendingUp },
    { id: "validation", label: "Validation & Cartography", icon: ShieldCheck },
  ];

  return (
    <div className="min-h-screen bg-[#FAF9F5] text-[#141916] flex flex-col font-sans selection:bg-[#1E3F2E] selection:text-white">
      {/* ============================================================
          FLOATING APPLE GLASS NAVIGATION BAR
      ============================================================ */}
      <header className="sticky top-0 z-50 bg-[#FAF9F5]/85 backdrop-blur-xl border-b border-black/[0.06] transition-all duration-300 ease-apple">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Brand Title */}
          <button
            onClick={() => setMode("story")}
            className="text-left group focus:outline-none flex items-baseline gap-2.5"
          >
            <span className="font-serif text-xl font-medium tracking-tight text-[#141916]">
              Krishna River Basin
            </span>
            <span className="hidden md:inline-block text-xs text-[#8C948E] font-normal">
              Water Accounting · 2000–2026
            </span>
          </button>

          {/* Center Segmented Mode Switcher */}
          <nav className="inline-flex bg-[#EFECE6] p-1 rounded-full border border-black/[0.05]">
            {[
              { id: "story", label: "The Story" },
              { id: "workbench", label: "Analytical Workbench" },
              { id: "provenance", label: "Data & Methodology" },
            ].map((item) => {
              const active = mode === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setMode(item.id as TopMode);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ease-apple ${
                    active
                      ? "bg-[#141916] text-white shadow-sm"
                      : "text-[#5A625D] hover:text-[#141916]"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Right Global Filter Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedSubbasin}
              onChange={(e) => setSelectedSubbasin(e.target.value)}
              aria-label="Select Sub-Basin"
              className="bg-[#EFECE6] hover:bg-[#E6E2DA] text-[#141916] text-xs font-medium px-3 py-1.5 rounded-full border border-black/[0.05] focus:outline-none cursor-pointer transition-colors"
            >
              {SUBBASIN_OPTIONS.map((sb) => (
                <option key={sb.id} value={sb.id}>
                  {sb.short}
                </option>
              ))}
            </select>

            <select
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(e.target.value);
                const idx = hydroYearsList.indexOf(e.target.value);
                if (idx >= 0) setYearIndex(idx);
              }}
              aria-label="Select Hydrological Year"
              className="bg-[#EFECE6] hover:bg-[#E6E2DA] text-[#141916] font-mono text-xs font-medium px-3 py-1.5 rounded-full border border-black/[0.05] focus:outline-none cursor-pointer transition-colors"
            >
              {hydroYearsList
                .filter((hy: string) => hy !== "2026-27")
                .map((hy: string) => (
                  <option key={hy} value={hy}>
                    {hy}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Sub-Navigation Bar when inside Analytical Workbench */}
        {mode === "workbench" && (
          <div className="border-t border-black/[0.05] bg-[#FAF9F5]/95">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {workbenchTabs.map((t) => {
                const Icon = t.icon;
                const active = wbTab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setWbTab(t.id)}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-300 ease-apple ${
                      active
                        ? "bg-[#1E3F2E] text-white shadow-sm"
                        : "text-[#5A625D] hover:text-[#141916] hover:bg-black/[0.04]"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* ============================================================
          MODE 1: THE BASIN STORY (APPLE EDITORIAL NARRATIVE)
      ============================================================ */}
      {mode === "story" && basinMeans && (
        <main className="flex-1 animate-apple-reveal">
          {/* PROLOGUE / HERO */}
          <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-14 pb-16 md:pt-20 md:pb-24">
            <div className="max-w-3xl space-y-6">
              <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#4A6B53] font-semibold">
                CWC Basin Code 04 · Peninsular India · 2000–2026
              </div>
              <h1 className="font-serif text-4xl sm:text-6xl md:text-[64px] text-[#141916] tracking-tight leading-[1.06]">
                218 billion cubic meters fall from the sky.{" "}
                <span className="text-[#5A625D] italic font-normal">
                  Four-fifths never reach the sea.
                </span>
              </h1>
              <p className="text-base sm:text-lg md:text-xl text-[#5A625D] leading-relaxed font-normal max-w-2xl pt-2">
                Across 258,948 square kilometers of Maharashtra, Karnataka, Telangana, and Andhra Pradesh, the Krishna River sustains 85 million people. By combining 380,627 station gauge records with satellite reanalysis, we traced where every drop originates—and how a rising agricultural footprint is reshaping the river.
              </p>
            </div>

            {/* Hero 3-Pillar Bento Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-12">
              <div className="bento-card bento-card-hover p-7 flex flex-col justify-between">
                <div className="text-xs font-mono uppercase tracking-wider text-[#26596B] font-semibold">
                  01 · What Enters the Basin
                </div>
                <div className="my-6">
                  <div className="text-5xl font-semibold tracking-tight text-[#141916] tabular-nums">
                    {basinMeans.precip_bcm}
                    <span className="text-lg font-normal text-[#5A625D] ml-1.5">BCM/yr</span>
                  </div>
                  <div className="text-xs text-[#5A625D] mt-2">
                    26-year mean rainfall ({basinMeans.precip_mm} mm/yr) plus 1.24 BCM/yr inter-basin canal imports.
                  </div>
                </div>
                <div className="pt-3 border-t border-black/[0.06] flex items-center justify-between text-[11px] text-[#8C948E] font-mono">
                  <span>Source: ERA5-Land + 35k Rain Gauges</span>
                  <span>±4.2%</span>
                </div>
              </div>

              <div className="bento-card bento-card-hover p-7 flex flex-col justify-between">
                <div className="text-xs font-mono uppercase tracking-wider text-[#1E3F2E] font-semibold">
                  02 · Returned to the Sky
                </div>
                <div className="my-6">
                  <div className="text-5xl font-semibold tracking-tight text-[#141916] tabular-nums">
                    {((Number(basinMeans.et_total_bcm) / (Number(basinMeans.precip_bcm) || 1)) * 100).toFixed(1)}
                    <span className="text-3xl">%</span>
                    <span className="text-lg font-normal text-[#5A625D] ml-2">({basinMeans.et_total_bcm} BCM)</span>
                  </div>
                  <div className="text-xs text-[#5A625D] mt-2">
                    Evapotranspired by rainfed & irrigated crops ({(Number(basinMeans.et_green_bcm) + Number(basinMeans.et_blue_bcm)).toFixed(1)} BCM), forests ({basinMeans.et_nat_bcm} BCM), and reservoirs ({basinMeans.et_res_bcm} BCM).
                  </div>
                </div>
                <div className="pt-3 border-t border-black/[0.06] flex items-center justify-between text-[11px] text-[#8C948E] font-mono">
                  <span>Source: FAO-56 + NRSC VIC + S2</span>
                  <span>±6.8%</span>
                </div>
              </div>

              <div className="bento-card bento-card-hover p-7 flex flex-col justify-between">
                <div className="text-xs font-mono uppercase tracking-wider text-[#B8532E] font-semibold">
                  03 · Reaches the Bay of Bengal
                </div>
                <div className="my-6">
                  <div className="text-5xl font-semibold tracking-tight text-[#141916] tabular-nums">
                    {basinMeans.terminal_outflow_bcm}
                    <span className="text-lg font-normal text-[#5A625D] ml-1.5">BCM/yr</span>
                  </div>
                  <div className="text-xs text-[#5A625D] mt-2">
                    Terminal river discharge past Wadenepally & Vijayawada—collapsing below 8 BCM during severe droughts.
                  </div>
                </div>
                <div className="pt-3 border-t border-black/[0.06] flex items-center justify-between text-[11px] text-[#8C948E] font-mono">
                  <span>Source: CWC Gauge + GloFAS v4</span>
                  <span>±5.2%</span>
                </div>
              </div>
            </div>
          </section>

          {/* CHAPTER I: GEOGRAPHY & LIVING MAP */}
          <section className="border-t border-black/[0.06] py-16 md:py-24">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-10">
              <div className="max-w-3xl space-y-3">
                <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-[#4A6B53] font-semibold">
                  Chapter I · The Geography of Asymmetry
                </div>
                <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-[#141916] tracking-tight leading-[1.12]">
                  A wet mountain wall feeding a thirsty interior plateau.
                </h2>
                <p className="text-base text-[#5A625D] leading-relaxed pt-1">
                  The Krishna Basin is governed by a sharp climatic divide. Monsoon winds striking the Western Ghats release over 1,000 to 3,000 mm of rain across the headwaters of Upper Krishna and Upper Tungabhadra. Less than 150 kilometers east, the plateau drops into a semi-arid rain shadow receiving barely 600–750 mm. Click any sub-basin on the map to inspect its water balance.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                {/* Left 8 cols: Interactive Apple-Styled Map */}
                <div className="lg:col-span-8 bento-card p-3 sm:p-4 flex flex-col justify-between">
                  <BasinMap
                    selectedSubbasin={selectedSubbasin}
                    onSelectSubbasin={(sb) => setSelectedSubbasin(sb)}
                    selectedYearData={overview?.subbasins_2024_25 || []}
                  />
                </div>

                {/* Right 4 cols: Dynamic Sub-Basin Story & Ledger Card */}
                <div className="lg:col-span-4 bento-card p-6 sm:p-7 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-[#4A6B53] font-semibold">
                        Active Hydrological Unit
                      </span>
                      <select
                        value={selectedSubbasin}
                        onChange={(e) => setSelectedSubbasin(e.target.value)}
                        className="bg-[#F3F1EB] text-[#141916] text-xs font-medium px-2.5 py-1 rounded-full border border-black/[0.06] focus:outline-none cursor-pointer"
                      >
                        {SUBBASIN_OPTIONS.map((sb) => (
                          <option key={sb.id} value={sb.id}>
                            {sb.short}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <h3 className="font-serif text-2xl text-[#141916]">
                        {SUBBASIN_OPTIONS.find((s) => s.id === selectedSubbasin)?.short}
                      </h3>
                      <p className="text-xs text-[#5A625D] mt-2 leading-relaxed">
                        {SUBBASIN_NARRATIVES[selectedSubbasin] || SUBBASIN_NARRATIVES.KRISHNA_BASIN}
                      </p>
                    </div>

                    {currentYearRecord && (
                      <div className="pt-4 border-t border-black/[0.06] space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-[#5A625D]">Water Year Ledger</span>
                          <select
                            value={selectedYear}
                            onChange={(e) => {
                              setSelectedYear(e.target.value);
                              const idx = hydroYearsList.indexOf(e.target.value);
                              if (idx >= 0) setYearIndex(idx);
                            }}
                            className="bg-[#F3F1EB] font-mono text-xs font-semibold text-[#141916] px-2.5 py-1 rounded-md border border-black/[0.06] cursor-pointer"
                          >
                            {hydroYearsList
                              .filter((hy: string) => hy !== "2026-27")
                              .map((hy: string) => (
                                <option key={hy} value={hy}>
                                  {hy}
                                </option>
                              ))}
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-2.5">
                          <div className="bento-stone p-3.5">
                            <div className="text-[11px] text-[#5A625D]">Rainfall Input</div>
                            <div className="text-xl font-semibold text-[#141916] mt-0.5 tabular-nums">
                              {Number(currentYearRecord.precip_bcm).toFixed(1)}{" "}
                              <span className="text-xs font-normal text-[#5A625D]">BCM</span>
                            </div>
                            <div className="text-[10px] font-mono text-[#8C948E] mt-0.5">
                              {Number(currentYearRecord.precip_mm).toFixed(0)} mm
                            </div>
                          </div>

                          <div className="bento-stone p-3.5">
                            <div className="text-[11px] text-[#5A625D]">Actual ET</div>
                            <div className="text-xl font-semibold text-[#1E3F2E] mt-0.5 tabular-nums">
                              {Number(currentYearRecord.et_actual_total_bcm).toFixed(1)}{" "}
                              <span className="text-xs font-normal text-[#5A625D]">BCM</span>
                            </div>
                            <div className="text-[10px] font-mono text-[#8C948E] mt-0.5">
                              Blue: {Number(currentYearRecord.et_blue_agri_bcm).toFixed(1)} BCM
                            </div>
                          </div>

                          <div className="bento-stone p-3.5">
                            <div className="text-[11px] text-[#5A625D]">River Outflow</div>
                            <div className="text-xl font-semibold text-[#26596B] mt-0.5 tabular-nums">
                              {Number(currentYearRecord.subbasin_outflow_bcm).toFixed(1)}{" "}
                              <span className="text-xs font-normal text-[#5A625D]">BCM</span>
                            </div>
                            <div className="text-[10px] font-mono text-[#8C948E] mt-0.5">
                              Routed downstream
                            </div>
                          </div>

                          <div className="bento-stone p-3.5">
                            <div className="text-[11px] text-[#5A625D]">GW Extraction</div>
                            <div className="text-xl font-semibold text-[#B8532E] mt-0.5 tabular-nums">
                              {Number(currentYearRecord.gw_stage_of_development_pct).toFixed(1)}%
                            </div>
                            <div className="text-[10px] font-mono text-[#8C948E] mt-0.5">
                              ΔS: {Number(currentYearRecord.delta_storage_gw_bcm).toFixed(2)} BCM
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Provenance Footnote inside Card */}
                  <div className="pt-4 mt-4 border-t border-black/[0.06] flex items-center justify-between text-xs">
                    <span className="text-[#8C948E] font-mono text-[11px]">
                      Residual = 0.0000 BCM
                    </span>
                    <button
                      onClick={() => setMode("provenance")}
                      className="text-[#1E3F2E] font-medium hover:underline inline-flex items-center gap-1"
                    >
                      <span>How this is calculated</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* CHAPTER II: THE AGRICULTURAL PARTITION (GREEN VS BLUE WATER) */}
          <section className="border-t border-black/[0.06] py-16 md:py-24 bg-[#F5F3EC]/60">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-10">
              <div className="max-w-3xl space-y-3">
                <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-[#4A6B53] font-semibold">
                  Chapter II · The Great Partition
                </div>
                <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-[#141916] tracking-tight leading-[1.12]">
                  Three-quarters of all consumed water sustains agriculture.
                </h2>
                <p className="text-base text-[#5A625D] leading-relaxed pt-1">
                  In Water Accounting Plus (WA+), evapotranspiration is not a single black box. By pairing FAO-56 dual crop coefficient physics with 350 stratified Level-13 S2 agricultural landscape cells, we separate rainfed soil moisture transpiration (<b>Green Water</b>) from canal and borewell irrigation depletion (<b>Blue Water</b>).
                </p>
              </div>

              {/* Proportional Bar Bento */}
              <div className="bento-card p-6 sm:p-8 space-y-6">
                {(() => {
                  const totalEt = Number(basinMeans.et_total_bcm) || 171.54;
                  const greenPct = ((Number(basinMeans.et_green_bcm) / totalEt) * 100).toFixed(1);
                  const bluePct = ((Number(basinMeans.et_blue_bcm) / totalEt) * 100).toFixed(1);
                  const natPct = ((Number(basinMeans.et_nat_bcm) / totalEt) * 100).toFixed(1);
                  const resPct = ((Number(basinMeans.et_res_bcm) / totalEt) * 100).toFixed(1);
                  const agriPct = (Number(greenPct) + Number(bluePct)).toFixed(1);

                  const etSegments = [
                    {
                      id: "green" as const,
                      label: "Green Crop ET",
                      fullName: "Rainfed Green Crop Evapotranspiration",
                      pct: greenPct,
                      bcm: basinMeans.et_green_bcm,
                      color: "#4A6B53",
                      bgHover: "bg-[#4A6B53]/10",
                      border: "border-[#4A6B53]",
                      desc: "Monsoon rain infiltrated directly into root zones of rainfed Kharif crops (pulses, cotton, millets, oilseeds).",
                    },
                    {
                      id: "blue" as const,
                      label: "Blue Irrigated ET",
                      fullName: "Irrigated Blue Agricultural Water Depletion",
                      pct: bluePct,
                      bcm: basinMeans.et_blue_bcm,
                      color: "#26596B",
                      bgHover: "bg-[#26596B]/10",
                      border: "border-[#26596B]",
                      desc: "Consumptive depletion pumped from canals & deep borewells for sugarcane, double-cropped paddy, and wheat (+6.18 BCM/decade).",
                    },
                    {
                      id: "nat" as const,
                      label: "Forests & Ecology",
                      fullName: "Forest, Shrubland & Ecosystem ET",
                      pct: natPct,
                      bcm: basinMeans.et_nat_bcm,
                      color: "#8FA68E",
                      bgHover: "bg-[#8FA68E]/10",
                      border: "border-[#8FA68E]",
                      desc: "Sustains Western Ghats montane rainforests, Nallamala tiger corridor, and riparian corridors.",
                    },
                    {
                      id: "res" as const,
                      label: "Open Reservoir Evap",
                      fullName: "Open Reservoir & Tank Evaporation",
                      pct: resPct,
                      bcm: basinMeans.et_res_bcm,
                      color: "#C68B39",
                      bgHover: "bg-[#C68B39]/10",
                      border: "border-[#C68B39]",
                      desc: "Direct evaporative atmospheric loss from water spreads of 34 major reservoirs (Srisailam, Ujjani, Almatti) and 17,984 minor tanks.",
                    },
                  ];

                  const currentActive = activeEtBar ? etSegments.find((s) => s.id === activeEtBar) : null;

                  return (
                    <>
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2">
                        <div>
                          <div className="text-xs font-mono uppercase tracking-wider text-[#5A625D]">
                            Partition of Total Actual Evapotranspiration ({basinMeans.et_total_bcm} BCM/yr)
                          </div>
                        </div>

                        {/* Interactive Pill Legend with Instant Hover/Click */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {etSegments.map((seg) => (
                            <button
                              key={seg.id}
                              onClick={() => setActiveEtBar(activeEtBar === seg.id ? null : seg.id)}
                              onMouseEnter={() => setActiveEtBar(seg.id)}
                              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-all duration-200 ${
                                activeEtBar === seg.id
                                  ? `${seg.bgHover} text-[#141916] ring-1.5 ${seg.border} font-semibold shadow-xs scale-102`
                                  : "bg-[#EFECE6] text-[#5A625D] hover:text-[#141916] hover:bg-[#E5E0D8]"
                              }`}
                            >
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                              <span>{seg.label}:</span>
                              <span className="font-mono font-semibold">{seg.pct}%</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Instant Interactive Info Banner (Zero Delay, Never Clipped) */}
                      <div
                        className={`overflow-hidden transition-all duration-300 ease-apple ${
                          currentActive ? "max-h-28 opacity-100 my-2" : "max-h-0 opacity-0 m-0"
                        }`}
                      >
                        {currentActive && (
                          <div
                            className="p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs"
                            style={{
                              backgroundColor: `${currentActive.color}15`,
                              borderColor: `${currentActive.color}50`,
                            }}
                          >
                            <div className="flex items-start sm:items-center gap-2.5">
                              <span className="w-3.5 h-3.5 rounded-full shrink-0 mt-0.5 sm:mt-0" style={{ backgroundColor: currentActive.color }} />
                              <div>
                                <span className="font-bold text-[#141916] mr-2 text-sm">{currentActive.fullName}:</span>
                                <span className="text-[#2C332E] leading-relaxed">{currentActive.desc}</span>
                              </div>
                            </div>
                            <div className="shrink-0 flex items-center gap-2 font-mono bg-white/70 px-3 py-1.5 rounded-lg border border-black/5 self-start sm:self-auto">
                              <span className="font-bold text-[#141916] text-sm">{currentActive.bcm} BCM/yr</span>
                              <span className="text-[#5A625D]">({currentActive.pct}% of ET)</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Stacked Proportional Bar with Instant Highlighting */}
                      <div className="h-10 w-full rounded-xl overflow-hidden flex gap-0.5 bg-[#EFECE6] p-0.5 select-none shadow-inner">
                        {etSegments.map((seg, idx) => (
                          <div
                            key={seg.id}
                            style={{
                              width: `${seg.pct}%`,
                              backgroundColor: seg.color,
                            }}
                            onClick={() => setActiveEtBar(activeEtBar === seg.id ? null : seg.id)}
                            onMouseEnter={() => setActiveEtBar(seg.id)}
                            className={`h-full flex items-center justify-center cursor-pointer px-2 transition-all duration-200 ease-apple text-white text-xs font-medium truncate ${
                              idx === 0 ? "rounded-l-lg" : ""
                            } ${idx === 3 ? "rounded-r-lg font-mono text-[11px]" : ""} ${
                              activeEtBar === seg.id
                                ? "brightness-115 scale-[1.01] shadow-md z-10 ring-2 ring-white font-bold"
                                : activeEtBar
                                ? "opacity-50 brightness-90"
                                : "hover:brightness-110"
                            }`}
                          >
                            {seg.id === "res" ? (
                              <span>{seg.pct}%</span>
                            ) : (
                              <span>{seg.label} · {seg.pct}%</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()}

                {/* 4 Breakdown Columns with Active Highlight Sync */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                  <div
                    onMouseEnter={() => setActiveEtBar("green")}
                    onMouseLeave={() => setActiveEtBar(null)}
                    onClick={() => setActiveEtBar(activeEtBar === "green" ? null : "green")}
                    className={`bento-stone p-4 cursor-pointer transition-all duration-200 ${
                      activeEtBar === "green" ? "ring-2 ring-[#4A6B53] shadow-md bg-white scale-[1.01]" : "hover:bg-[#F3F0EA]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#4A6B53]" />
                      <span className="text-xs font-medium text-[#141916]">Green Crop ET</span>
                    </div>
                    <div className="text-2xl font-semibold text-[#141916] mt-2 tabular-nums">
                      {basinMeans.et_green_bcm} <span className="text-xs font-normal text-[#5A625D]">BCM/yr</span>
                    </div>
                    <p className="text-[11px] text-[#5A625D] mt-1 leading-relaxed">
                      Monsoon rain infiltrated directly into root zones of rainfed Kharif pulses, cotton, millets, and oilseeds.
                    </p>
                  </div>

                  <div
                    onMouseEnter={() => setActiveEtBar("blue")}
                    onMouseLeave={() => setActiveEtBar(null)}
                    onClick={() => setActiveEtBar(activeEtBar === "blue" ? null : "blue")}
                    className={`bento-stone p-4 cursor-pointer transition-all duration-200 ${
                      activeEtBar === "blue" ? "ring-2 ring-[#26596B] shadow-md bg-white scale-[1.01]" : "hover:bg-[#F3F0EA]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#26596B]" />
                      <span className="text-xs font-medium text-[#141916]">Blue Irrigated ET</span>
                    </div>
                    <div className="text-2xl font-semibold text-[#141916] mt-2 tabular-nums">
                      {basinMeans.et_blue_bcm} <span className="text-xs font-normal text-[#5A625D]">BCM/yr</span>
                    </div>
                    <p className="text-[11px] text-[#5A625D] mt-1 leading-relaxed">
                      Consumptive depletion from canals & borewells for sugarcane, double-cropped paddy, and Rabi wheat (+6.18 BCM/decade).
                    </p>
                  </div>

                  <div
                    onMouseEnter={() => setActiveEtBar("nat")}
                    onMouseLeave={() => setActiveEtBar(null)}
                    onClick={() => setActiveEtBar(activeEtBar === "nat" ? null : "nat")}
                    className={`bento-stone p-4 cursor-pointer transition-all duration-200 ${
                      activeEtBar === "nat" ? "ring-2 ring-[#8FA68E] shadow-md bg-white scale-[1.01]" : "hover:bg-[#F3F0EA]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#8FA68E]" />
                      <span className="text-xs font-medium text-[#141916]">Forest & Ecosystem ET</span>
                    </div>
                    <div className="text-2xl font-semibold text-[#141916] mt-2 tabular-nums">
                      {basinMeans.et_nat_bcm} <span className="text-xs font-normal text-[#5A625D]">BCM/yr</span>
                    </div>
                    <p className="text-[11px] text-[#5A625D] mt-1 leading-relaxed">
                      Sustains Western Ghats montane evergreen forests, Nallamala tiger reserve, and riparian corridors.
                    </p>
                  </div>

                  <div
                    onMouseEnter={() => setActiveEtBar("res")}
                    onMouseLeave={() => setActiveEtBar(null)}
                    onClick={() => setActiveEtBar(activeEtBar === "res" ? null : "res")}
                    className={`bento-stone p-4 cursor-pointer transition-all duration-200 ${
                      activeEtBar === "res" ? "ring-2 ring-[#C68B39] shadow-md bg-white scale-[1.01]" : "hover:bg-[#F3F0EA]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#C68B39]" />
                      <span className="text-xs font-medium text-[#141916]">Open Reservoir Evap</span>
                    </div>
                    <div className="text-2xl font-semibold text-[#141916] mt-2 tabular-nums">
                      {basinMeans.et_res_bcm} <span className="text-xs font-normal text-[#5A625D]">BCM/yr</span>
                    </div>
                    <p className="text-[11px] text-[#5A625D] mt-1 leading-relaxed">
                      Direct atmospheric loss from 34 major reservoirs (Srisailam, Ujjani, Almatti, Tungabhadra) and 17,984 minor tanks.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* CHAPTER III: 26 YEARS OF FEAST AND FAMINE */}
          <section className="border-t border-black/[0.06] py-16 md:py-24">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-10">
              <div className="max-w-3xl space-y-3">
                <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-[#4A6B53] font-semibold">
                  Chapter III · Feast, Famine & Basin Closure
                </div>
                <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-[#141916] tracking-tight leading-[1.12]">
                  When the monsoon falters, irrigation keeps pumping—and the river closes.
                </h2>
                <p className="text-base text-[#5A625D] leading-relaxed pt-1">
                  Across 26 years, annual basin rainfall swung between 145 BCM (2002–03 drought) and 302 BCM (2019–20 flood). Yet agricultural water consumption stayed remarkably inelastic—buffered by groundwater drawdown and reservoir storage—leaving terminal outflow to absorb the entire shock.
                </p>
              </div>

              {/* Interactive Supply vs Demand Chart Card */}
              <div className="bento-card p-6 sm:p-8 space-y-6">
                {/* Tactile Timeline Scrubber Bar */}
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-black/[0.06]">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#141916] hover:bg-[#28312B] text-white text-xs font-medium transition-all duration-300 ease-apple shadow-sm"
                    >
                      {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-white" />}
                      <span>{isPlaying ? "Pause Timeline" : "Scrub 26 Years"}</span>
                    </button>
                    <div className="text-xs text-[#5A625D]">
                      Inspecting:{" "}
                      <span className="font-mono font-semibold text-[#141916]">{selectedYear}</span>
                      {" · "}
                      <span className="font-medium text-[#1E3F2E]">
                        {SUBBASIN_OPTIONS.find((s) => s.id === selectedSubbasin)?.short}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-72">
                    <span className="text-[10px] font-mono text-[#8C948E]">2000</span>
                    <input
                      type="range"
                      min={0}
                      max={Math.max(0, hydroYearsList.length - 2)}
                      value={Math.min(yearIndex, Math.max(0, hydroYearsList.length - 2))}
                      onChange={(e) => {
                        const idx = Number(e.target.value);
                        setYearIndex(idx);
                        if (hydroYearsList[idx]) setSelectedYear(hydroYearsList[idx]);
                      }}
                      className="apple-scrubber flex-1"
                    />
                    <span className="text-[10px] font-mono text-[#8C948E]">2026</span>
                  </div>
                </div>

                {/* Live Scrubbed Year Stat Card */}
                {currentYearRecord && (
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-[#FAF9F5] rounded-xl px-4 py-3 border border-black/[0.06]">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#1E3F2E] animate-pulse"></span>
                      <span className="text-xs font-semibold text-[#141916]">
                        {selectedYear} Snapshot:
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
                      <div>
                        <span className="text-[#8C948E] mr-1.5">Rainfall:</span>
                        <span className="font-semibold text-[#26596B]">
                          {Number(currentYearRecord.precip_bcm || 0).toFixed(1)} BCM
                        </span>
                      </div>
                      <div>
                        <span className="text-[#8C948E] mr-1.5">Total ET:</span>
                        <span className="font-semibold text-[#4A6B53]">
                          {Number(currentYearRecord.et_actual_total_bcm || 0).toFixed(1)} BCM
                        </span>
                      </div>
                      <div>
                        <span className="text-[#8C948E] mr-1.5">Outflow:</span>
                        <span className="font-semibold text-[#B8532E]">
                          {Number(currentYearRecord.subbasin_outflow_bcm || 0).toFixed(1)} BCM
                        </span>
                      </div>
                      <div>
                        <span className="text-[#8C948E] mr-1.5">Basin Closure:</span>
                        <span className="font-semibold text-[#141916]">
                          {currentYearRecord.precip_bcm
                            ? Math.min(
                                100,
                                Math.round(
                                  (Number(currentYearRecord.et_actual_total_bcm || 0) /
                                    Number(currentYearRecord.precip_bcm)) *
                                    100
                                )
                              )
                            : 0}
                          %
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Serene Area Chart with Active Year Guideline */}
                <EChartBox
                  height="360px"
                  option={{
                    tooltip: { trigger: "axis" },
                    legend: {
                      right: 10,
                      top: 0,
                      data: ["Precipitation Supply (BCM)", "Total Actual ET Demand (BCM)", "River Outflow (BCM)"],
                      textStyle: { color: "#5A625D", fontSize: 11 },
                      icon: "circle",
                      itemWidth: 8,
                      itemHeight: 8,
                    },
                    grid: { left: 45, right: 15, top: 38, bottom: 32 },
                    xAxis: {
                      type: "category",
                      data: activeUnitAnnualSeries.map((r: any) => r.hydro_year),
                      axisLabel: { color: "#8C948E", fontSize: 10 },
                      axisLine: { lineStyle: { color: "rgba(20,25,22,0.1)" } },
                      axisTick: { show: false },
                    },
                    yAxis: {
                      type: "value",
                      axisLabel: { color: "#8C948E", fontSize: 10 },
                      splitLine: { lineStyle: { color: "rgba(20,25,22,0.05)" } },
                    },
                    series: [
                      {
                        name: "Precipitation Supply (BCM)",
                        type: "line",
                        smooth: 0.35,
                        symbol: "none",
                        data: activeUnitAnnualSeries.map((r: any) => Number(r.precip_bcm || 0).toFixed(1)),
                        lineStyle: { width: 2, color: "#26596B" },
                        areaStyle: { color: "rgba(38, 89, 107, 0.10)" },
                        itemStyle: { color: "#26596B" },
                        markLine: {
                          symbol: ["none", "none"],
                          silent: true,
                          animationDuration: 250,
                          data: [
                            {
                              xAxis: selectedYear,
                              lineStyle: {
                                color: "#1E3F2E",
                                width: 2,
                                type: "dashed",
                              },
                              label: {
                                show: true,
                                formatter: `${selectedYear}`,
                                position: "insideEndTop",
                                color: "#1E3F2E",
                                fontFamily: "monospace",
                                fontWeight: 600,
                                fontSize: 10,
                                backgroundColor: "rgba(250, 249, 245, 0.95)",
                                padding: [3, 6],
                                borderRadius: 4,
                                borderColor: "rgba(30, 63, 46, 0.25)",
                                borderWidth: 1,
                              },
                            },
                          ],
                        },
                      },
                      {
                        name: "Total Actual ET Demand (BCM)",
                        type: "line",
                        smooth: 0.35,
                        symbol: "none",
                        data: activeUnitAnnualSeries.map((r: any) => Number(r.et_actual_total_bcm || 0).toFixed(1)),
                        lineStyle: { width: 2.5, color: "#4A6B53" },
                        areaStyle: { color: "rgba(74, 107, 83, 0.18)" },
                        itemStyle: { color: "#4A6B53" },
                      },
                      {
                        name: "River Outflow (BCM)",
                        type: "line",
                        smooth: 0.35,
                        symbol: "none",
                        data: activeUnitAnnualSeries.map((r: any) => Number(r.subbasin_outflow_bcm || 0).toFixed(1)),
                        lineStyle: { width: 2.2, color: "#B8532E" },
                        itemStyle: { color: "#B8532E" },
                      },
                    ],
                  }}
                />

                {/* Contrast Strip: Extreme Drought vs Surplus Year */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="bento-stone p-5 flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[10px] font-mono uppercase tracking-wider text-[#B8532E] font-semibold">
                        2002–03 & 2015–16 · Anthropogenic Basin Closure
                      </div>
                      <div className="text-sm font-semibold text-[#141916] mt-1">
                        94% of rainfall consumed inside the basin
                      </div>
                      <p className="text-xs text-[#5A625D] mt-1 leading-relaxed">
                        During severe monsoon failures, reservoir trapping and borewell pumping sustained crop ET while terminal discharge to the delta dropped below 6–8 BCM.
                      </p>
                    </div>
                  </div>

                  <div className="bento-stone p-5 flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[10px] font-mono uppercase tracking-wider text-[#26596B] font-semibold">
                        2005–06 & 2019–21 · Monsoon Surplus & Aquifer Recovery
                      </div>
                      <div className="text-sm font-semibold text-[#141916] mt-1">
                        Over 85 BCM spilled to the Bay of Bengal
                      </div>
                      <p className="text-xs text-[#5A625D] mt-1 leading-relaxed">
                        Extreme Western Ghats deluge filled all 34 major reservoirs to Full Reservoir Level (FRL) by August and recharged hard-rock aquifers by +4.8 BCM.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* CHAPTER IV: HARD-ROCK AQUIFERS & THE 7 SUB-BASINS LEDGER */}
          <section className="border-t border-black/[0.06] py-16 md:py-24 bg-[#F5F3EC]/60">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-10">
              <div className="max-w-3xl space-y-3">
                <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-[#4A6B53] font-semibold">
                  Chapter IV · The Seven Hydrological Ledgers
                </div>
                <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-[#141916] tracking-tight leading-[1.12]">
                  Every sub-basin accounted to the fourth decimal place.
                </h2>
                <p className="text-base text-[#5A625D] leading-relaxed pt-1">
                  Beneath the surface, 88% of the basin rests on fractured Deccan Trap basalt and Peninsular gneiss with low specific yield (S_y = 0.015–0.028). Select any row in the 26-year ledger below to focus the story and map on that sub-basin.
                </p>
              </div>

              <div className="bento-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-black/[0.07] text-[10px] font-mono uppercase tracking-wider text-[#5A625D] bg-[#FAF9F5]">
                        <th className="py-4 px-5">Sub-Basin</th>
                        <th className="py-4 px-4 text-right">Area (km²)</th>
                        <th className="py-4 px-4 text-right">Rain (mm)</th>
                        <th className="py-4 px-4 text-right">Rain (BCM)</th>
                        <th className="py-4 px-4 text-right">Total ET (BCM)</th>
                        <th className="py-4 px-4 text-right">Blue ET (BCM)</th>
                        <th className="py-4 px-4 text-right">GW Recharge</th>
                        <th className="py-4 px-4 text-right">GW Draft</th>
                        <th className="py-4 px-4 text-right">Outflow (BCM)</th>
                        <th className="py-4 px-5 text-right">GW Stage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.05]">
                      {(overview?.subbasins_26yr_mean || overview?.subbasin_26yr_means || []).map((row: any) => {
                        const active = selectedSubbasin === row.subbasin_id;
                        return (
                          <tr
                            key={row.subbasin_id}
                            onClick={() => setSelectedSubbasin(row.subbasin_id)}
                            className={`cursor-pointer transition-colors duration-200 ${
                              active ? "bg-[#E8EFEA]" : "hover:bg-[#FAF9F5]"
                            }`}
                          >
                            <td className="py-3.5 px-5 font-medium text-[#141916]">
                              <span className="font-mono text-[11px] text-[#4A6B53] mr-2">{row.subbasin_id}</span>
                              <span>{row.subbasin_name}</span>
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono text-[#5A625D] tabular-nums">
                              {Number(row.area_km2).toLocaleString()}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono text-[#141916] tabular-nums">
                              {row.mean_precip_mm}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono font-medium text-[#26596B] tabular-nums">
                              {row.mean_precip_bcm}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono text-[#1E3F2E] tabular-nums">
                              {row.mean_et_total_bcm}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono text-[#4A6B53] tabular-nums">
                              {row.mean_et_blue_agri_bcm || row.mean_et_blue_bcm}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono text-[#5A625D] tabular-nums">
                              {row.mean_gw_recharge_bcm}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono text-[#B8532E] tabular-nums">
                              {row.mean_gw_withdrawal_bcm}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono font-medium text-[#141916] tabular-nums">
                              {row.mean_outflow_bcm}
                            </td>
                            <td className="py-3.5 px-5 text-right font-mono font-semibold text-[#B8532E] tabular-nums">
                              {row.mean_gw_stage_pct}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>

          {/* CHAPTER V: DATA PROVENANCE, ASSUMPTIONS & SUSTAINABLE PATHWAYS */}
          <section className="border-t border-black/[0.06] py-16 md:py-24">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-12">
              <div className="max-w-3xl space-y-3">
                <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-[#4A6B53] font-semibold">
                  Chapter V · Scientific Foundation & Solutions
                </div>
                <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-[#141916] tracking-tight leading-[1.12]">
                  Built on primary observations. Open to full inspection.
                </h2>
                <p className="text-base text-[#5A625D] leading-relaxed pt-1">
                  Every chart and map in this narrative draws from a single verified DuckDB database containing 19 relational tables. Below is how the evidence is assembled—and the four policy interventions most supported by the data.
                </p>
              </div>

              {/* 3-Card Provenance & Assumptions Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="bento-card p-6 space-y-3">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-[#26596B] font-semibold">
                    Where the Data Came From
                  </div>
                  <h3 className="text-lg font-semibold text-[#141916]">8 Primary Data Streams</h3>
                  <ul className="space-y-2 text-xs text-[#5A625D] leading-relaxed pt-1">
                    <li>• <b>India-WRIS & CWC:</b> 380,627 gauge logs across 34 reservoirs & river outlets.</li>
                    <li>• <b>ERA5-Land & NASA POWER:</b> 78,160 daily climate & 4-layer soil moisture records.</li>
                    <li>• <b>CGWB NAQUIM:</b> 817 borehole lithologs & 38,901 piezometer readings.</li>
                    <li>• <b>S2 Landscape Intelligence:</b> 165,823 Level-13 cells in DuckDB & GeoParquet (100% basin coverage) + 350 ground-truth strata.</li>
                  </ul>
                </div>

                <div className="bento-card p-6 space-y-3">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-[#1E3F2E] font-semibold">
                    How Calculations Are Made
                  </div>
                  <h3 className="text-lg font-semibold text-[#141916]">Conservation of Mass</h3>
                  <ul className="space-y-2 text-xs text-[#5A625D] leading-relaxed pt-1">
                    <li>• <b>Exact Closure:</b> ΔS = P + I − ETa − Qout − E solved monthly with 0.0000 BCM residual.</li>
                    <li>• <b>DAG Routing:</b> Upstream outflows route sequentially without boundary double-counting.</li>
                    <li>• <b>FAO-56 Partition:</b> Separates rainfed Green ET from irrigated Blue ET depletion.</li>
                  </ul>
                </div>

                <div className="bento-card p-6 space-y-3">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-[#B8532E] font-semibold">
                    Core Assumptions
                  </div>
                  <h3 className="text-lg font-semibold text-[#141916]">Explicit & Auditable</h3>
                  <ul className="space-y-2 text-xs text-[#5A625D] leading-relaxed pt-1">
                    <li>• <b>A-01 Hydro Year:</b> June 1 – May 31 monsoon cycle (2026–27 partial year isolated).</li>
                    <li>• <b>A-04 Hard-Rock Sy:</b> 0.015–0.028 for basalt/gneiss (±22% uncertainty band).</li>
                    <li>• <b>A-05 Return Flows:</b> 42% canal seepage return; 18% borewell irrigation percolation.</li>
                    <li>• <b>A-06 Water Quality:</b> Tracked as usability discount without breaking physical mass.</li>
                  </ul>
                </div>
              </div>

              {/* Action Buttons to Full Provenance & Workbench */}
              <div className="bento-stone p-6 sm:p-8 flex flex-wrap items-center justify-between gap-6">
                <div className="space-y-1 max-w-xl">
                  <h3 className="font-serif text-2xl text-[#141916]">
                    Explore the complete equations or dive into the workbench.
                  </h3>
                  <p className="text-xs sm:text-sm text-[#5A625D]">
                    Inspect every equation, dataset file path, Sankey diagram, S2 cell, and Mann–Kendall trend test.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => {
                      setMode("provenance");
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="px-5 py-2.5 rounded-full bg-[#141916] hover:bg-[#28312B] text-white text-xs font-medium transition-all duration-300 ease-apple flex items-center gap-2 shadow-sm"
                  >
                    <span>Read Full Data & Methodology</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      setMode("workbench");
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="px-5 py-2.5 rounded-full bg-white hover:bg-[#FAF9F5] text-[#141916] border border-black/10 text-xs font-medium transition-all duration-300 ease-apple flex items-center gap-2"
                  >
                    <span>Open Analytical Workbench</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </section>
        </main>
      )}

      {/* ============================================================
          MODE 2: DATA & METHODOLOGY (FULL PROVENANCE & EQUATIONS)
      ============================================================ */}
      {mode === "provenance" && (
        <main className="flex-1">
          <DataProvenance />
        </main>
      )}

      {/* ============================================================
          MODE 3: ANALYTICAL WORKBENCH (ALL 7 DEEP-DIVE MODULES)
      ============================================================ */}
      {mode === "workbench" && (
        <main className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 flex-1 space-y-8 animate-apple-reveal">
          {/* MODULE 1: TIME SERIES EXPLORER */}
          {wbTab === "time" && (
            <div className="space-y-6">
              <div className="bento-card p-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-[#4A6B53] font-semibold">
                    Multi-Resolution Temporal Ledgers
                  </div>
                  <h2 className="font-serif text-2xl text-[#141916] mt-0.5">
                    {SUBBASIN_OPTIONS.find((s) => s.id === selectedSubbasin)?.name}
                  </h2>
                </div>
                <div className="inline-flex bg-[#EFECE6] p-1 rounded-full border border-black/[0.05]">
                  {(["annual", "seasonal", "monthly"] as const).map((sc) => (
                    <button
                      key={sc}
                      onClick={() => setTimeScale(sc)}
                      className={`px-4 py-1.5 rounded-full text-xs font-medium capitalize transition-all duration-300 ease-apple ${
                        timeScale === sc
                          ? "bg-[#141916] text-white shadow-sm"
                          : "text-[#5A625D] hover:text-[#141916]"
                      }`}
                    >
                      {sc} ({sc === "annual" ? "27 Yrs" : sc === "seasonal" ? "81 Seasons" : "321 Months"})
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-8">
                {/* CHART 1: SURFACE WATER & ATMOSPHERIC BUDGET */}
                <div className="bento-card p-6 sm:p-8 space-y-6">
                  {/* Header & Story Thesis */}
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-black/[0.06] pb-5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-[#4A6B53] font-semibold bg-[#EFECE6] px-2.5 py-0.5 rounded-full">
                          Module 01 · Atmospheric & Surface Balance
                        </span>
                        <span className="text-[10px] font-mono text-[#8C948E]">2000–2026 Trajectory</span>
                      </div>
                      <h3 className="font-serif text-2xl text-[#141916] mt-2">
                        Precipitation Supply, Evaporative Demand & River Outflow
                      </h3>
                      <p className="text-xs text-[#5A625D] mt-1 max-w-2xl leading-relaxed">
                        Quantifying basin closure: tracking how rainfall supply converts into crop/forest evapotranspiration (ET), reservoir retention, and terminal delta discharge.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-[#4A6B53] bg-[#EFECE6] px-3 py-1 rounded-full uppercase font-medium">
                        Resolution: {timeScale}
                      </span>
                    </div>
                  </div>

                  {/* The Full-Width Interactive Chart */}
                  <EChartBox
                    height="380px"
                    option={{
                      tooltip: {
                        trigger: "axis",
                        formatter: (params: any[]) => {
                          if (!params || !params.length) return "";
                          const title = params[0].name;
                          let pVal = 0, etVal = 0, blueVal = 0, outVal = 0;
                          let rowsHtml = "";
                          params.forEach((item: any) => {
                            const val = parseFloat(item.value) || 0;
                            if (item.seriesName.includes("Precipitation")) pVal = val;
                            if (item.seriesName.includes("Total Actual ET")) etVal = val;
                            if (item.seriesName.includes("Blue Crop ET")) blueVal = val;
                            if (item.seriesName.includes("Outflow")) outVal = val;

                            rowsHtml += `
                              <div style="display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-top: 4px; font-size: 11px;">
                                <span style="display: flex; align-items: center; gap: 6px; color: #5A625D;">
                                  <span style="width: 8px; height: 8px; border-radius: 50%; background: ${item.color}; display: inline-block;"></span>
                                  ${item.seriesName}
                                </span>
                                <span style="font-family: monospace; font-weight: 600; color: #141916;">${val.toFixed(2)} BCM</span>
                              </div>
                            `;
                          });

                          let storyNote = "";
                          if (pVal > 0) {
                            const evapRatio = Math.min(100, Math.round((etVal / pVal) * 100));
                            const outflowRatio = Math.round((outVal / pVal) * 100);
                            if (evapRatio >= 90) {
                              storyNote = `<div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid rgba(0,0,0,0.06); font-size: 10px; color: #B8532E; font-weight: 600;">
                                ⚠️ Severe Basin Closure: ${evapRatio}% of precipitation consumed inside basin (${outflowRatio}% to sea).
                              </div>`;
                            } else if (evapRatio <= 75) {
                              storyNote = `<div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid rgba(0,0,0,0.06); font-size: 10px; color: #26596B; font-weight: 600;">
                                💧 Runoff Surge: Delta outflow reached ${outVal.toFixed(1)} BCM (${outflowRatio}% of rainfall).
                              </div>`;
                            } else {
                              storyNote = `<div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid rgba(0,0,0,0.06); font-size: 10px; color: #4A6B53; font-weight: 600;">
                                ⚖️ High Evaporative Consumption: ${evapRatio}% consumed by crops & natural canopy.
                              </div>`;
                            }
                          }

                          return `
                            <div style="padding: 2px 4px; font-family: 'Plus Jakarta Sans', sans-serif;">
                              <div style="font-weight: 600; font-size: 12px; color: #141916; border-bottom: 1px solid rgba(0,0,0,0.06); padding-bottom: 4px; margin-bottom: 4px;">
                                ${title} · Water Balance
                              </div>
                              ${rowsHtml}
                              ${storyNote}
                            </div>
                          `;
                        },
                      },
                      legend: {
                        right: 8,
                        top: 0,
                        icon: "circle",
                        itemWidth: 8,
                        itemHeight: 8,
                        data: ["Precipitation", "Total Actual ET", "Blue Crop ET", "Outflow"],
                        textStyle: { color: "#5A625D", fontSize: 11 },
                      },
                      grid: { left: 45, right: 15, top: 38, bottom: 44 },
                      dataZoom: [
                        {
                          type: "inside",
                          start: timeScale === "monthly" ? 82 : timeScale === "seasonal" ? 65 : 0,
                          end: 100,
                        },
                        {
                          type: "slider",
                          height: 14,
                          bottom: 4,
                          start: timeScale === "monthly" ? 82 : timeScale === "seasonal" ? 65 : 0,
                          end: 100,
                          borderColor: "transparent",
                          backgroundColor: "rgba(20,25,22,0.03)",
                          fillerColor: "rgba(30,63,46,0.12)",
                          handleStyle: {
                            color: "#1E3F2E",
                            borderColor: "#FFFFFF",
                            borderWidth: 2,
                          },
                          textStyle: { color: "#8C948E", fontSize: 10 },
                          dataBackground: {
                            lineStyle: { color: "rgba(30,63,46,0.2)" },
                            areaStyle: { color: "rgba(30,63,46,0.05)" },
                          },
                        },
                      ],
                      xAxis: {
                        type: "category",
                        data: wbSeries.map((r) =>
                          timeScale === "annual"
                            ? r.hydro_year
                            : timeScale === "seasonal"
                            ? `${r.hydro_year} ${r.season}`
                            : r.year_month
                        ),
                        axisLabel: { color: "#8C948E", fontSize: 10 },
                        axisLine: { lineStyle: { color: "rgba(20,25,22,0.1)" } },
                        axisTick: { show: false },
                      },
                      yAxis: {
                        type: "value",
                        axisLabel: { color: "#8C948E", fontSize: 10 },
                        splitLine: { lineStyle: { color: "rgba(20,25,22,0.05)" } },
                      },
                      series: [
                        {
                          name: "Precipitation",
                          type: "bar",
                          barMaxWidth: timeScale === "monthly" ? 8 : timeScale === "seasonal" ? 14 : 22,
                          data: wbSeries.map((r) => Number(r.precip_bcm || 0).toFixed(2)),
                          itemStyle: { color: "#26596B", opacity: 0.65, borderRadius: [2, 2, 0, 0] },
                        },
                        {
                          name: "Total Actual ET",
                          type: "line",
                          smooth: 0.25,
                          symbol: "none",
                          data: wbSeries.map((r) => Number(r.et_actual_total_bcm || 0).toFixed(2)),
                          lineStyle: { width: 2.2, color: "#4A6B53" },
                          itemStyle: { color: "#4A6B53" },
                        },
                        {
                          name: "Blue Crop ET",
                          type: "line",
                          smooth: 0.25,
                          symbol: "none",
                          data: wbSeries.map((r) => Number(r.et_blue_agri_bcm || 0).toFixed(2)),
                          lineStyle: { width: 2, color: "#C68B39" },
                          itemStyle: { color: "#C68B39" },
                        },
                        {
                          name: "Outflow",
                          type: "line",
                          smooth: 0.25,
                          symbol: "none",
                          data: wbSeries.map((r) => Number(r.subbasin_outflow_bcm || 0).toFixed(2)),
                          lineStyle: { width: 2, color: "#B8532E" },
                          itemStyle: { color: "#B8532E" },
                        },
                      ],
                    }}
                  />

                  {/* Editorial Story & Insights Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-black/[0.06]">
                    <div className="bento-stone p-4">
                      <div className="text-[10px] font-mono uppercase tracking-wider text-[#4A6B53] font-semibold">
                        01 · The Evaporative Funnel
                      </div>
                      <div className="text-sm font-semibold text-[#141916] mt-1">
                        85%+ of rainfall never exits the basin
                      </div>
                      <p className="text-xs text-[#5A625D] mt-1.5 leading-relaxed">
                        Across 26 years, total evapotranspiration (green rainfed ET + blue irrigated ET) consumes an average of 165–230 BCM annually. The Krishna operates as an evaporative sink rather than a runoff producer.
                      </p>
                    </div>

                    <div className="bento-stone p-4">
                      <div className="text-[10px] font-mono uppercase tracking-wider text-[#C68B39] font-semibold">
                        02 · Inelastic Agricultural Thirst
                      </div>
                      <div className="text-sm font-semibold text-[#141916] mt-1">
                        Blue Crop ET locked at 25–35 BCM/yr
                      </div>
                      <p className="text-xs text-[#5A625D] mt-1.5 leading-relaxed">
                        Even during severe monsoon deficits (like 2002–03 and 2015–16), irrigation consumption does not drop proportionally. Surface canals and energised borewells buffer the crop canopy, keeping blue water demand rigid.
                      </p>
                    </div>

                    <div className="bento-stone p-4">
                      <div className="text-[10px] font-mono uppercase tracking-wider text-[#B8532E] font-semibold">
                        03 · Terminal Outflow Collapse
                      </div>
                      <div className="text-sm font-semibold text-[#141916] mt-1">
                        Outflow drops to &lt;3% during droughts
                      </div>
                      <p className="text-xs text-[#5A625D] mt-1.5 leading-relaxed">
                        In dry years, terminal outflow to the Bay of Bengal collapses below 6 BCM due to upstream reservoir interception and lift schemes, inducing hypersaline conditions in the Krishna delta.
                      </p>
                    </div>
                  </div>
                </div>

                {/* CHART 2: GROUNDWATER RECHARGE & STORAGE */}
                <div className="bento-card p-6 sm:p-8 space-y-6">
                  {/* Header & Story Thesis */}
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-black/[0.06] pb-5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-[#4A6B53] font-semibold bg-[#EFECE6] px-2.5 py-0.5 rounded-full">
                          Module 02 · Subterranean Aquifer Dynamics
                        </span>
                        <span className="text-[10px] font-mono text-[#8C948E]">Hard-Rock Hydrogeology</span>
                      </div>
                      <h3 className="font-serif text-2xl text-[#141916] mt-2">
                        Groundwater Recharge, Pumping & Net Storage Shift (ΔS_GW)
                      </h3>
                      <p className="text-xs text-[#5A625D] mt-1 max-w-2xl leading-relaxed">
                        Evaluating subterranean resilience: dynamic monsoon recharge against agricultural/domestic borewell pumping and the net annual shift in hard-rock aquifer storage.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-[#4A6B53] bg-[#EFECE6] px-3 py-1 rounded-full uppercase font-medium">
                        Resolution: {timeScale}
                      </span>
                    </div>
                  </div>

                  {/* Full-Width Chart */}
                  <EChartBox
                    height="380px"
                    option={{
                      tooltip: {
                        trigger: "axis",
                        formatter: (params: any[]) => {
                          if (!params || !params.length) return "";
                          const title = params[0].name;
                          let rechVal = 0, withVal = 0, dsVal = 0;
                          let rowsHtml = "";
                          params.forEach((item: any) => {
                            const val = parseFloat(item.value) || 0;
                            if (item.seriesName.includes("Recharge")) rechVal = val;
                            if (item.seriesName.includes("Withdrawal")) withVal = val;
                            if (item.seriesName.includes("Storage")) dsVal = val;

                            rowsHtml += `
                              <div style="display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-top: 4px; font-size: 11px;">
                                <span style="display: flex; align-items: center; gap: 6px; color: #5A625D;">
                                  <span style="width: 8px; height: 8px; border-radius: 50%; background: ${item.color}; display: inline-block;"></span>
                                  ${item.seriesName}
                                </span>
                                <span style="font-family: monospace; font-weight: 600; color: #141916;">${val > 0 && item.seriesName.includes("Storage") ? "+" : ""}${val.toFixed(2)} BCM</span>
                              </div>
                            `;
                          });

                          let storyNote = "";
                          if (dsVal < -0.1) {
                            storyNote = `<div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid rgba(0,0,0,0.06); font-size: 10px; color: #B8532E; font-weight: 600;">
                              📉 Aquifer Depletion: Net draft exceeded recharge by ${Math.abs(dsVal).toFixed(2)} BCM.
                            </div>`;
                          } else if (dsVal > 0.1) {
                            storyNote = `<div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid rgba(0,0,0,0.06); font-size: 10px; color: #4A6B53; font-weight: 600;">
                              📈 Aquifer Recovery: Net recharge surplus of +${dsVal.toFixed(2)} BCM replenished shallow fractures.
                            </div>`;
                          } else {
                            storyNote = `<div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid rgba(0,0,0,0.06); font-size: 10px; color: #5A625D; font-weight: 600;">
                              ⚖️ Steady Aquifer Balance: Inflow balanced extraction.
                            </div>`;
                          }

                          return `
                            <div style="padding: 2px 4px; font-family: 'Plus Jakarta Sans', sans-serif;">
                              <div style="font-weight: 600; font-size: 12px; color: #141916; border-bottom: 1px solid rgba(0,0,0,0.06); padding-bottom: 4px; margin-bottom: 4px;">
                                ${title} · Groundwater Balance
                              </div>
                              ${rowsHtml}
                              ${storyNote}
                            </div>
                          `;
                        },
                      },
                      legend: {
                        right: 8,
                        top: 0,
                        icon: "circle",
                        itemWidth: 8,
                        itemHeight: 8,
                        data: ["GW Recharge", "GW Withdrawal", "ΔS_GW Storage Change"],
                        textStyle: { color: "#5A625D", fontSize: 11 },
                      },
                      grid: { left: 45, right: 15, top: 38, bottom: 44 },
                      dataZoom: [
                        {
                          type: "inside",
                          start: timeScale === "monthly" ? 82 : timeScale === "seasonal" ? 65 : 0,
                          end: 100,
                        },
                        {
                          type: "slider",
                          height: 14,
                          bottom: 4,
                          start: timeScale === "monthly" ? 82 : timeScale === "seasonal" ? 65 : 0,
                          end: 100,
                          borderColor: "transparent",
                          backgroundColor: "rgba(20,25,22,0.03)",
                          fillerColor: "rgba(30,63,46,0.12)",
                          handleStyle: {
                            color: "#1E3F2E",
                            borderColor: "#FFFFFF",
                            borderWidth: 2,
                          },
                          textStyle: { color: "#8C948E", fontSize: 10 },
                          dataBackground: {
                            lineStyle: { color: "rgba(30,63,46,0.2)" },
                            areaStyle: { color: "rgba(30,63,46,0.05)" },
                          },
                        },
                      ],
                      xAxis: {
                        type: "category",
                        data: wbSeries.map((r) =>
                          timeScale === "annual"
                            ? r.hydro_year
                            : timeScale === "seasonal"
                            ? `${r.hydro_year} ${r.season}`
                            : r.year_month
                        ),
                        axisLabel: { color: "#8C948E", fontSize: 10 },
                        axisLine: { lineStyle: { color: "rgba(20,25,22,0.1)" } },
                        axisTick: { show: false },
                      },
                      yAxis: {
                        type: "value",
                        axisLabel: { color: "#8C948E", fontSize: 10 },
                        splitLine: { lineStyle: { color: "rgba(20,25,22,0.05)" } },
                      },
                      series: [
                        {
                          name: "GW Recharge",
                          type: "bar",
                          barMaxWidth: timeScale === "monthly" ? 6 : timeScale === "seasonal" ? 12 : 18,
                          data: wbSeries.map((r) => Number(r.gw_total_recharge_bcm || 0).toFixed(2)),
                          itemStyle: { color: "#4A6B53", opacity: 0.75, borderRadius: [2, 2, 0, 0] },
                        },
                        {
                          name: "GW Withdrawal",
                          type: "bar",
                          barMaxWidth: timeScale === "monthly" ? 6 : timeScale === "seasonal" ? 12 : 18,
                          data: wbSeries.map((r) => Number(r.gw_withdrawal_total_bcm || 0).toFixed(2)),
                          itemStyle: { color: "#B8532E", opacity: 0.75, borderRadius: [2, 2, 0, 0] },
                        },
                        {
                          name: "ΔS_GW Storage Change",
                          type: "line",
                          smooth: 0.25,
                          symbol: "none",
                          data: wbSeries.map((r) => Number(r.delta_storage_gw_bcm || 0).toFixed(2)),
                          lineStyle: { width: 2.2, color: "#141916" },
                          itemStyle: { color: "#141916" },
                        },
                      ],
                    }}
                  />

                  {/* Editorial Story & Insights Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-black/[0.06]">
                    <div className="bento-stone p-4">
                      <div className="text-[10px] font-mono uppercase tracking-wider text-[#B8532E] font-semibold">
                        01 · The 2011–2019 Depletion Era
                      </div>
                      <div className="text-sm font-semibold text-[#141916] mt-1">
                        Cumulative deficit reached -22 BCM
                      </div>
                      <p className="text-xs text-[#5A625D] mt-1.5 leading-relaxed">
                        For eight straight years, agricultural groundwater pumping exceeded monsoon recharge, causing sustained negative storage shifts (ΔS_GW down to -6.5 BCM/yr) and borewell dry-outs across Rayalaseema and Northern Karnataka.
                      </p>
                    </div>

                    <div className="bento-stone p-4">
                      <div className="text-[10px] font-mono uppercase tracking-wider text-[#4A6B53] font-semibold">
                        02 · Low Hard-Rock Storativity
                      </div>
                      <div className="text-sm font-semibold text-[#141916] mt-1">
                        Fracture specific yield only 1.5%–3.0%
                      </div>
                      <p className="text-xs text-[#5A625D] mt-1.5 leading-relaxed">
                        Unlike deep alluvial plains, crystalline granite and Deccan basalts store water only in weathered regolith and fractures. A small 1 BCM extraction deficit lowers the regional water table by 1.5 to 3.5 meters.
                      </p>
                    </div>

                    <div className="bento-stone p-4">
                      <div className="text-[10px] font-mono uppercase tracking-wider text-[#26596B] font-semibold">
                        03 · Episodic Deluge Recharge
                      </div>
                      <div className="text-sm font-semibold text-[#141916] mt-1">
                        2020–22 monsoons created a sharp rebound
                      </div>
                      <p className="text-xs text-[#5A625D] mt-1.5 leading-relaxed">
                        Back-to-back surplus monsoons (+32 BCM recharge in 2020–21) pushed storage change back into the black (+2.8 BCM). However, because fracture capacity is limited, excess water is shed as rejected runoff rather than permanent bank storage.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MODULE 2: COMPARE YEARS */}
          {wbTab === "compare" && compareData && (
            <div className="space-y-6">
              <div className="bento-card p-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-[#4A6B53] font-semibold">
                    Multi-Year Differential Diagnosis
                  </div>
                  <h2 className="font-serif text-2xl text-[#141916] mt-0.5">
                    Compare Any Two Hydrological Years
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={compareYearA}
                    onChange={(e) => setCompareYearA(e.target.value)}
                    className="bg-[#EFECE6] px-3 py-1.5 rounded-full text-xs font-mono font-semibold text-[#141916]"
                  >
                    {hydroYearsList
                      .filter((y: string) => y !== "2026-27")
                      .map((hy: string) => (
                        <option key={hy} value={hy}>
                          Year A: {hy}
                        </option>
                      ))}
                  </select>
                  <span className="text-xs text-[#8C948E]">vs</span>
                  <select
                    value={compareYearB}
                    onChange={(e) => setCompareYearB(e.target.value)}
                    className="bg-[#EFECE6] px-3 py-1.5 rounded-full text-xs font-mono font-semibold text-[#1E3F2E]"
                  >
                    {hydroYearsList
                      .filter((y: string) => y !== "2026-27")
                      .map((hy: string) => (
                        <option key={hy} value={hy}>
                          Year B: {hy}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="bento-card p-6">
                <EChartBox
                  height="360px"
                  option={{
                    tooltip: { trigger: "axis" },
                    legend: {
                      right: 10,
                      top: 0,
                      icon: "circle",
                      itemWidth: 8,
                      itemHeight: 8,
                      data: [`${compareYearA} (BCM)`, `${compareYearB} (BCM)`],
                      textStyle: { color: "#5A625D", fontSize: 11 },
                    },
                    grid: { left: 45, right: 15, top: 35, bottom: 45 },
                    xAxis: {
                      type: "category",
                      data: compareDeltas.map((d: any) => d.label),
                      axisLabel: { color: "#5A625D", fontSize: 10, interval: 0, rotate: 15 },
                      axisLine: { lineStyle: { color: "rgba(20,25,22,0.1)" } },
                      axisTick: { show: false },
                    },
                    yAxis: {
                      type: "value",
                      axisLabel: { color: "#8C948E", fontSize: 10 },
                      splitLine: { lineStyle: { color: "rgba(20,25,22,0.05)" } },
                    },
                    series: [
                      {
                        name: `${compareYearA} (BCM)`,
                        type: "bar",
                        barMaxWidth: 20,
                        data: compareDeltas.map((d: any) => d.year_a_val),
                        itemStyle: { color: "#B8532E", borderRadius: [3, 3, 0, 0] },
                      },
                      {
                        name: `${compareYearB} (BCM)`,
                        type: "bar",
                        barMaxWidth: 20,
                        data: compareDeltas.map((d: any) => d.year_b_val),
                        itemStyle: { color: "#26596B", borderRadius: [3, 3, 0, 0] },
                      },
                    ],
                  }}
                />
              </div>
            </div>
          )}

          {/* MODULE 3: SANKEY FLOW */}
          {wbTab === "sankey" && sankeyData && (
            <div className="bento-card p-6 sm:p-8 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-[#4A6B53] font-semibold">
                    Water Accounting Plus (WA+) Partition
                  </div>
                  <h2 className="font-serif text-2xl text-[#141916] mt-0.5">
                    End-to-End Basin Water Flow Sankey ({sankeyYear})
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 bg-[#EFECE6] p-1 rounded-full border border-black/[0.05]">
                    {[
                      { id: "550px", label: "Compact" },
                      { id: "750px", label: "Large" },
                      { id: "950px", label: "Expanded" },
                    ].map((sz) => (
                      <button
                        key={sz.id}
                        onClick={() => setSankeyHeight(sz.id)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                          sankeyHeight === sz.id
                            ? "bg-[#141916] text-white shadow-sm"
                            : "text-[#5A625D] hover:text-[#141916]"
                        }`}
                      >
                        {sz.label}
                      </button>
                    ))}
                  </div>
                  <select
                    value={selectedSubbasin}
                    onChange={(e) => setSelectedSubbasin(e.target.value)}
                    className="bg-[#EFECE6] px-3.5 py-1.5 rounded-full text-xs font-mono font-medium text-[#141916]"
                  >
                    {SUBBASIN_OPTIONS.map((sb) => (
                      <option key={sb.id} value={sb.id}>
                        {sb.short}
                      </option>
                    ))}
                  </select>
                  <select
                    value={sankeyYear}
                    onChange={(e) => setSankeyYear(e.target.value)}
                    className="bg-[#EFECE6] px-3.5 py-1.5 rounded-full text-xs font-mono font-medium text-[#141916]"
                  >
                    <option value="2000-26_MEAN">26-Year Long-Term Mean (2000–26)</option>
                    {hydroYearsList
                      .filter((y: string) => y !== "2026-27")
                      .map((hy: string) => (
                        <option key={hy} value={hy}>
                          Water Year {hy}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-[#5A625D] bg-[#FAF9F5] px-3.5 py-1.5 rounded-lg border border-black/[0.05] w-fit">
                <span>🔍 <b>Interactive Zoom:</b> Scroll or pinch to zoom in · Click &amp; drag canvas to pan · Drag nodes to reposition</span>
              </div>

              <EChartBox
                height={sankeyHeight}
                option={{
                  tooltip: { trigger: "item", triggerOn: "mousemove" },
                  series: [
                    {
                      type: "sankey",
                      roam: true,
                      draggable: true,
                      emphasis: { focus: "adjacency" },
                      nodeAlign: "justify",
                      nodeWidth: 20,
                      nodeGap: 18,
                      left: "3%",
                      right: "16%",
                      top: "4%",
                      bottom: "4%",
                      data: sankeyData.nodes || [],
                      links: sankeyData.links || [],
                      lineStyle: { color: "gradient", curveness: 0.5, opacity: 0.35 },
                      label: { color: "#141916", fontSize: 12, fontWeight: 600 },
                    },
                  ],
                }}
              />
            </div>
          )}

          {/* MODULE 4: SUB-BASINS & 34 RESERVOIRS */}
          {wbTab === "subbasins" && subbasinsDetail && (
            <div className="space-y-6">
              {/* CWC SUB-BASIN WATER BALANCE ACCOUNTS */}
              <div className="bento-card overflow-hidden">
                <div className="p-6 border-b border-black/[0.06] flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-[#4A6B53] font-semibold">
                      CWC Delineated Hydrological Accounts
                    </div>
                    <h2 className="font-serif text-2xl text-[#141916] mt-0.5">
                      Sub-Basin Water Balances ({selectedYear})
                    </h2>
                    <p className="text-xs text-[#5A625D] mt-1">
                      Annual mass-balance partition across all 7 sub-basins. Click any row to focus that sub-basin.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#5A625D]">Focus:</span>
                    <select
                      value={selectedSubbasin}
                      onChange={(e) => setSelectedSubbasin(e.target.value)}
                      className="bg-[#EFECE6] px-3.5 py-1.5 rounded-full text-xs font-medium text-[#141916]"
                    >
                      {SUBBASIN_OPTIONS.map((sb) => (
                        <option key={sb.id} value={sb.id}>
                          {sb.short}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-black/[0.06] bg-[#FAF9F5] text-[10px] font-mono uppercase text-[#5A625D]">
                        <th className="py-3.5 px-5">Sub-Basin</th>
                        <th className="py-3.5 px-4 text-right">Area (km²)</th>
                        <th className="py-3.5 px-4 text-right">Precip (BCM)</th>
                        <th className="py-3.5 px-4 text-right">Actual ET (BCM)</th>
                        <th className="py-3.5 px-4 text-right">Runoff (BCM)</th>
                        <th className="py-3.5 px-4 text-right">GW Draft (BCM)</th>
                        <th className="py-3.5 px-4 text-right">Outflow (BCM)</th>
                        <th className="py-3.5 px-5 text-right">GW Stage (%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.05]">
                      {(subbasinsDetail.subbasins_water_balance || []).map((row: any) => {
                        const isSelected = selectedSubbasin === row.subbasin_id;
                        return (
                          <tr
                            key={row.subbasin_id}
                            onClick={() => setSelectedSubbasin(row.subbasin_id)}
                            className={`cursor-pointer transition-colors duration-200 ${
                              isSelected ? "bg-[#E8EFEA] font-semibold" : "hover:bg-[#FAF9F5]"
                            }`}
                          >
                            <td className="py-3.5 px-5">
                              <span className="font-mono text-[11px] text-[#4A6B53] mr-2">
                                {row.subbasin_id}
                              </span>
                              <span>{row.subbasin_name}</span>
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono text-[#5A625D] tabular-nums">
                              {Number(row.area_km2 || 0).toLocaleString()}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono font-medium text-[#1E3F2E] tabular-nums">
                              {Number(row.precip_bcm || 0).toFixed(2)}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono text-[#5A625D] tabular-nums">
                              {Number(row.et_actual_total_bcm || 0).toFixed(2)}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono text-[#26596B] tabular-nums">
                              {Number(row.surface_runoff_bcm || 0).toFixed(2)}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono text-[#5A625D] tabular-nums">
                              {Number(row.gw_withdrawal_total_bcm || 0).toFixed(2)}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono text-[#B8532E] tabular-nums">
                              {Number(row.subbasin_outflow_bcm || 0).toFixed(2)}
                            </td>
                            <td className="py-3.5 px-5 text-right font-mono tabular-nums">
                              {Number(row.gw_stage_of_development_pct || 0).toFixed(1)}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* RESERVOIRS CARD */}
              <div className="bento-card p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-[#4A6B53] font-semibold">
                      India-WRIS Observed Daily Storage Series (178,555 Records)
                    </div>
                    <h2 className="font-serif text-2xl text-[#141916] mt-0.5">
                      Major Reservoir Storage Trajectory (2000–2026)
                    </h2>
                    <p className="text-xs text-[#5A625D] mt-1">Live storage in BCM. Drag slider to navigate 2000–2026.</p>
                  </div>
                  <select
                    value={selectedReservoir}
                    onChange={(e) => setSelectedReservoir(e.target.value)}
                    className="bg-[#EFECE6] px-3.5 py-1.5 rounded-full text-xs font-medium text-[#141916]"
                  >
                    {(subbasinsDetail.reservoirs_selected_year || subbasinsDetail.reservoir_metadata || []).map((r: any) => (
                      <option key={r.reservoir_id} value={r.reservoir_id}>
                        {r.reservoir_name} ({r.subbasin_id} · FRL {r.effective_live_capacity_bcm || r.live_capacity_bcm} BCM)
                      </option>
                    ))}
                  </select>
                </div>

                {(() => {
                  const rSeries = (subbasinsDetail.reservoirs_all_years || subbasinsDetail.reservoir_series || []).filter(
                    (r: any) => r.reservoir_id === selectedReservoir
                  );
                  return (
                    <EChartBox
                      height="340px"
                      option={{
                        tooltip: { trigger: "axis" },
                        grid: { left: 45, right: 15, top: 25, bottom: 44 },
                        dataZoom: [
                          { type: "inside", start: 70, end: 100 },
                          {
                            type: "slider",
                            height: 14,
                            bottom: 4,
                            start: 70,
                            end: 100,
                            borderColor: "transparent",
                            backgroundColor: "rgba(20,25,22,0.03)",
                            fillerColor: "rgba(30,63,46,0.12)",
                            handleStyle: {
                              color: "#1E3F2E",
                              borderColor: "#FFFFFF",
                              borderWidth: 2,
                            },
                            textStyle: { color: "#8C948E", fontSize: 10 },
                            dataBackground: {
                              lineStyle: { color: "rgba(30,63,46,0.2)" },
                              areaStyle: { color: "rgba(30,63,46,0.05)" },
                            },
                          },
                        ],
                        xAxis: {
                          type: "category",
                          data: rSeries.map((r: any) => r.hydro_year || r.year_month),
                          axisLabel: { color: "#8C948E", fontSize: 10 },
                          axisLine: { lineStyle: { color: "rgba(20,25,22,0.1)" } },
                          axisTick: { show: false },
                        },
                        yAxis: {
                          type: "value",
                          axisLabel: { color: "#8C948E", fontSize: 10 },
                          splitLine: { lineStyle: { color: "rgba(20,25,22,0.05)" } },
                        },
                        series: [
                          {
                            name: "Peak Monsoon Storage (BCM)",
                            type: "line",
                            smooth: 0.25,
                            symbol: "none",
                            data: rSeries.map((r: any) => Number(r.peak_monsoon_storage_bcm || r.closing_storage_bcm || 0).toFixed(3)),
                            lineStyle: { width: 2, color: "#1E3F2E" },
                            areaStyle: { color: "rgba(30, 63, 46, 0.14)" },
                          },
                        ],
                      }}
                    />
                  );
                })()}
              </div>
            </div>
          )}

          {/* MODULE 5: AGRICULTURE & ANTHROKRISHI S2 */}
          {wbTab === "agriculture" && agriData && (
            <div className="space-y-6">
              <div className="bento-card p-6">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-[#4A6B53] font-semibold">
                      S2 Level-13 Landscape Intelligence & Crop Accounts (165,823 Cells / 350 Strata)
                    </div>
                    <h2 className="font-serif text-2xl text-[#141916] mt-0.5">
                      Crop Water Consumption & Irrigation Evolution
                    </h2>
                  </div>
                  <span className="text-xs text-[#5A625D]">Values in BCM</span>
                </div>
                <EChartBox
                  height="340px"
                  option={{
                    tooltip: { trigger: "axis" },
                    legend: {
                      right: 10,
                      top: 0,
                      icon: "circle",
                      itemWidth: 8,
                      itemHeight: 8,
                      data: ["Rainfed Green ET (BCM)", "Irrigated Blue ET (BCM)"],
                      textStyle: { color: "#5A625D", fontSize: 11 },
                    },
                    grid: { left: 45, right: 15, top: 35, bottom: 35 },
                    xAxis: {
                      type: "category",
                      data: (agriData.agricultural_accounts_series || agriData.agriculture_series || [])
                        .filter((r: any) => !r.is_incomplete_year)
                        .map((r: any) => r.hydro_year),
                      axisLabel: { color: "#8C948E", fontSize: 10 },
                      axisLine: { lineStyle: { color: "rgba(20,25,22,0.1)" } },
                      axisTick: { show: false },
                    },
                    yAxis: {
                      type: "value",
                      axisLabel: { color: "#8C948E", fontSize: 10 },
                      splitLine: { lineStyle: { color: "rgba(20,25,22,0.05)" } },
                    },
                    series: [
                      {
                        name: "Rainfed Green ET (BCM)",
                        type: "bar",
                        stack: "et",
                        barMaxWidth: 22,
                        data: (agriData.agricultural_accounts_series || agriData.agriculture_series || [])
                          .filter((r: any) => !r.is_incomplete_year)
                          .map((r: any) => Number(r.agricultural_green_et_bcm || r.green_et_bcm || 0).toFixed(2)),
                        itemStyle: { color: "#4A6B53" },
                      },
                      {
                        name: "Irrigated Blue ET (BCM)",
                        type: "bar",
                        stack: "et",
                        barMaxWidth: 22,
                        data: (agriData.agricultural_accounts_series || agriData.agriculture_series || [])
                          .filter((r: any) => !r.is_incomplete_year)
                          .map((r: any) => Number(r.agricultural_blue_et_bcm || r.blue_et_bcm || 0).toFixed(2)),
                        itemStyle: { color: "#26596B", borderRadius: [3, 3, 0, 0] },
                      },
                    ],
                  }}
                />
              </div>
            </div>
          )}

          {/* MODULE 6: MANN-KENDALL TRENDS */}
          {wbTab === "trends" && trendsData && (
            <div className="bento-card overflow-hidden">
              <div className="p-6 border-b border-black/[0.06]">
                <div className="text-[10px] font-mono uppercase tracking-wider text-[#4A6B53] font-semibold">
                  Non-Parametric Hamed–Rao Modified Mann–Kendall & Sen's Slope
                </div>
                <h2 className="font-serif text-2xl text-[#141916] mt-0.5">
                  26-Year Hydrological Trend Significance Matrix ({selectedSubbasin})
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-black/[0.06] bg-[#FAF9F5] text-[10px] font-mono uppercase text-[#5A625D]">
                      <th className="py-3.5 px-5">Variable</th>
                      <th className="py-3.5 px-4 text-right">26-Yr Mean</th>
                      <th className="py-3.5 px-4 text-right">Sen's Slope / Decade</th>
                      <th className="py-3.5 px-4 text-right">Hamed–Rao Z</th>
                      <th className="py-3.5 px-4 text-right">p-value</th>
                      <th className="py-3.5 px-4 text-right">Pettitt Shift Year</th>
                      <th className="py-3.5 px-5">Statistical Verdict</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.05]">
                    {(trendsData.trends_selected_unit || trendsData.trends || []).map((t: any, i: number) => (
                      <tr key={i} className="hover:bg-[#FAF9F5]">
                        <td className="py-3.5 px-5 font-medium text-[#141916]">{t.variable_label}</td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums">{t.mean_2000_2025}</td>
                        <td className="py-3.5 px-4 text-right font-mono font-semibold text-[#1E3F2E] tabular-nums">
                          {Number(t.sens_slope_per_decade) > 0 ? "+" : ""}
                          {t.sens_slope_per_decade}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums">{t.hamed_rao_z ?? t.mk_z_stat ?? t.mk_z}</td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums">{t.hamed_rao_p_value}</td>
                        <td className="py-3.5 px-4 text-right font-mono">{t.pettitt_change_year}</td>
                        <td className="py-3.5 px-5">
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-[#E8EFEA] text-[#1E3F2E]">
                            {t.trend_direction_and_significance || t.significance_class || t.verdict}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* MODULE 7: VALIDATION & CARTOGRAPHIC FIGURES */}
          {wbTab === "validation" && valData && (
            <div className="space-y-6">
              <div className="bento-card overflow-hidden">
                <div className="p-6 border-b border-black/[0.06]">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-[#4A6B53] font-semibold">
                    Multi-Sensor Triangulation
                  </div>
                  <h2 className="font-serif text-2xl text-[#141916] mt-0.5">
                    Independent Reference Benchmark Matrix
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-black/[0.06] bg-[#FAF9F5] text-[10px] font-mono uppercase text-[#5A625D]">
                        <th className="py-3.5 px-5">Component</th>
                        <th className="py-3.5 px-4">Primary Model Source</th>
                        <th className="py-3.5 px-4">Independent Reference</th>
                        <th className="py-3.5 px-4 text-right">Model Mean</th>
                        <th className="py-3.5 px-4 text-right">Reference Mean</th>
                        <th className="py-3.5 px-4 text-right">Pearson r</th>
                        <th className="py-3.5 px-5 text-right">Bias (%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.05]">
                      {(valData.validation_matrix || []).map((v: any, i: number) => (
                        <tr key={i} className="hover:bg-[#FAF9F5]">
                          <td className="py-3.5 px-5 font-medium text-[#141916]">{v.component}</td>
                          <td className="py-3.5 px-4 text-[#5A625D]">{v.primary_source}</td>
                          <td className="py-3.5 px-4 text-[#5A625D]">{v.reference_source}</td>
                          <td className="py-3.5 px-4 text-right font-mono font-medium text-[#141916]">
                            {v.primary_mean} {v.unit}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-[#5A625D]">
                            {v.reference_mean} {v.unit}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-semibold text-[#1E3F2E]">
                            {v.pearson_r}
                          </td>
                          <td className="py-3.5 px-5 text-right font-mono">{v.pct_bias}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 11 Cartographic Figures Viewer */}
              <div className="bento-card p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-[#4A6B53] font-semibold">
                      300 DPI Archival Cartography & Figures
                    </div>
                    <h3 className="font-serif text-xl text-[#141916]">
                      Publication Map & Figure Gallery
                    </h3>
                  </div>
                  <select
                    value={selectedFigure}
                    onChange={(e) => setSelectedFigure(e.target.value)}
                    className="bg-[#EFECE6] px-3.5 py-1.5 rounded-full text-xs font-mono text-[#141916]"
                  >
                    {(valData.available_figures || valData.figures || []).map((f: string) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="bento-stone p-4 flex justify-center">
                  <img
                    src={`/figures/${selectedFigure}`}
                    alt={selectedFigure}
                    className="max-h-[580px] w-auto object-contain rounded-lg"
                  />
                </div>
              </div>
            </div>
          )}
        </main>
      )}

      {/* ============================================================
          QUIET ARCHIVAL FOOTER
      ============================================================ */}
      <footer className="border-t border-black/[0.06] py-8 px-4 sm:px-6 text-xs text-[#8C948E]">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div>
            Krishna River Basin Water Accounting Plus (WA+) System · CWC Basin Code 04 · Mass Conservation Residual = 0.0000 BCM
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setMode("story")} className="hover:text-[#141916] transition-colors">
              The Story
            </button>
            <button onClick={() => setMode("workbench")} className="hover:text-[#141916] transition-colors">
              Analytical Workbench
            </button>
            <button onClick={() => setMode("provenance")} className="hover:text-[#141916] transition-colors">
              Data & Methodology
            </button>
            <a
              href="/api/download/master_analytical_ledger"
              className="text-[#1E3F2E] font-medium hover:underline"
            >
              Export Master Ledger (CSV)
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
