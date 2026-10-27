import React, { useState } from "react";
import { ChevronDown, Check, ArrowUpRight, FileSpreadsheet } from "lucide-react";

export const DataProvenance: React.FC = () => {
  const [activeSection, setActiveSection] = useState<"sources" | "formulas" | "assumptions">("sources");
  const [expandedSource, setExpandedSource] = useState<string | null>("DS_03");

  const DATA_SOURCES = [
    {
      id: "DS_01",
      title: "CWC Statutory Basin & Sub-Basin Boundaries",
      agency: "Central Water Commission (CWC) · Ministry of Jal Shakti",
      category: "Spatial Reference",
      scale: "1:50,000 Vector Polygons · EPSG:32643 (UTM 43N)",
      volume: "7 Sub-Basins · 254,746.23 km² GIS (258,948 km² Official CWC)",
      period: "Canonical Baseline",
      rawPath: "01_Raw_Data/Spatial_Reference_Links/",
      processedPath: "02_Processed_Data/Boundaries/krishna_subbasins_cwc.geojson",
      summary:
        "Defines the exterior perimeter of CWC Basin Code 04 and its seven interior hydrological units: Upper Krishna (KRI_UPPER), Upper Bhima (BHI_UPPER), Lower Bhima (BHI_LOWER), Middle Krishna (KRI_MIDDLE), Upper Tungabhadra (TUN_UPPER), Lower Tungabhadra (TUN_LOWER), and Lower Krishna Delta (KRI_LOWER).",
      validation: "Reconciled within 1.62% of CWC Water Yearbook tabular areas (difference attributable to estuarine delta islands).",
    },
    {
      id: "DS_02",
      title: "India-WRIS Water Resource Infrastructure Census",
      agency: "National Remote Sensing Centre (NRSC) & CWC",
      category: "Hydraulic Infrastructure",
      scale: "Point, Polyline & Command Area Polygons",
      volume: "905 Dams · 34 Major Reservoirs · 16,510 km Canals · 17,984 Minor Tanks",
      period: "2000–2025 Inventory",
      rawPath: "01_Raw_Data/India_WRIS_WFS/",
      processedPath: "02_Processed_Data/Infrastructure_and_Stations/krishna_indiawris_infrastructure_and_stations.gpkg",
      summary:
        "Acquired directly from the India-WRIS ArcGIS/WFS server. Maps the complete engineered water distribution network: 54,279 river segments, 258 barrages/weirs/anicuts, 16 major lift schemes, 386 canal command perimeters, and 5,142 hydrometeorological monitoring stations.",
      validation: "Cross-checked against the National Register of Large Dams (NRLD) and state irrigation project gazettes.",
    },
    {
      id: "DS_03",
      title: "Primary Observational Station Time-Series",
      agency: "CWC, CGWB & NRSC via India-WRIS Dataset API",
      category: "In-Situ Gauge Observations",
      scale: "Daily & Seasonal Point Station Recordings",
      volume: "380,627 Primary Records across 5,142 Stations",
      period: "June 2000 – December 2025",
      rawPath: "01_Raw_Data/India_WRIS_TimeSeries/",
      processedPath: "02_Processed_Data/India_WRIS/",
      summary:
        "The empirical core of the water accounting ledger. Comprises 178,555 daily reservoir storage and level logs (Srisailam, Nagarjuna Sagar, Almatti, Narayanpur, Tungabhadra, Koyna, Bhima/Ujjani), 77,928 CWC river gauge discharge readings (including Wadenepally terminal gauge), 38,901 CGWB piezometer water levels, 49,865 NRSC VIC evapotranspiration records, and 35,378 rainfall station logs.",
      validation: "Screened for telemetry spikes and checked against physical FRL/MDDL reservoir capacity envelopes.",
    },
    {
      id: "DS_04",
      title: "ECMWF Copernicus ERA5-Land Reanalysis",
      agency: "European Centre for Medium-Range Weather Forecasts (ECMWF)",
      category: "Atmospheric & Soil Reanalysis",
      scale: "0.1° × 0.1° (~9 km) · 21 Sub-Basin Centroid Nodes",
      volume: "78,160 Daily Records · 321 Monthly Steps",
      period: "Jan 2000 – Sep 2026",
      rawPath: "01_Raw_Data/ERA5_OpenMeteo/",
      processedPath: "02_Processed_Data/era5_monthly_subbasin.parquet",
      summary:
        "Provides continuous daily precipitation, 2m air temperature, dewpoint, wind speed, shortwave radiation, surface runoff, and four-layer volumetric soil moisture (0–7 cm, 7–28 cm, 28–100 cm, and 100–289 cm root zone).",
      validation: "Evaluated against 35,378 ground rain gauge observations (Pearson r = 0.942 across monsoon months).",
    },
    {
      id: "DS_05",
      title: "NASA POWER Agroclimatology Release 2.4",
      agency: "NASA Langley Research Center",
      category: "Satellite Radiation & Climate",
      scale: "0.5° × 0.625° Global Grid",
      volume: "2,496 Monthly Sub-Basin Records",
      period: "Jan 2000 – Dec 2025",
      rawPath: "01_Raw_Data/NASA_POWER/",
      processedPath: "02_Processed_Data/nasa_power_monthly_subbasin.parquet",
      summary:
        "Supplies satellite-assimilated surface solar insolation, photosynthetically active radiation (PAR), vapour pressure deficit, and root-zone soil wetness used to force the FAO-56 Penman-Monteith reference evapotranspiration (ET₀) model.",
      validation: "26-year basin mean rainfall (841.2 mm/yr) tracks ERA5-Land (857.7 mm/yr) with r = 0.964.",
    },
    {
      id: "DS_06",
      title: "Copernicus GloFAS v4.0 Routed River Discharge",
      agency: "Copernicus Emergency Management Service (CEMS)",
      category: "Hydrological Streamflow",
      scale: "0.05° (~5 km) LISFLOOD Routed Network",
      volume: "97,700 Daily Streamflow Rows · 10 Key Confluences",
      period: "Jan 2000 – Sep 2026",
      rawPath: "01_Raw_Data/GloFAS_Discharge/",
      processedPath: "02_Processed_Data/glofas_discharge_monthly.parquet",
      summary:
        "Continuous daily river discharge across 10 strategic sub-basin outlets (Karad, Takli, Yadgir, Mantralayam, Bagalkot, Wadenepally, and Vijayawada Prakasam Barrage).",
      validation: "Long-term terminal discharge (38.72 BCM/yr) agrees within 3.6% of CWC Wadenepally gauge (39.55 BCM/yr) and modeled WA+ outflow (40.16 BCM/yr).",
    },
    {
      id: "DS_07",
      title: "CGWB NAQUIM Borehole Lithologs & Block Assessments",
      agency: "Central Ground Water Board (CGWB)",
      category: "Hydrogeology & Aquifers",
      scale: "817 Borehole Lithologs · Mandal/Taluka Assessment Units",
      volume: "4 Statutory Epochs (2011, 2013, 2017, 2020)",
      period: "2000–2025 Multi-Epoch",
      rawPath: "02_Processed_Data/Hydrogeology_and_GW/",
      processedPath: "12_Database/krishna_hydrological_intelligence.duckdb",
      summary:
        "Characterizes weathered and fractured zone thicknesses, storativity, and specific yield (Sy) across Deccan Trap basalts, Peninsular gneissic complexes, and coastal deltaic alluvium, alongside block-level groundwater extraction stages.",
      validation: "Calibrated against 38,901 seasonal pre- and post-monsoon piezometric water level fluctuations.",
    },
    {
      id: "DS_08",
      title: "Google AnthroKrishi S2 Level-13 Agricultural Sample",
      agency: "Google Research Agricultural Understanding API & S2 Geometry",
      category: "Earth Observation Cropland",
      scale: "Level-13 S2 Spherical Cells (~1.27 km² each)",
      volume: "350 Stratified Sample Cells from 202,182 Population Cells",
      period: "2000–01 to 2026–27",
      rawPath: "06_Agricultural_API/",
      processedPath: "02_Processed_Data/Agriculture/krishna_s2_level13_stratified_sample.geojson",
      summary:
        "Multi-temporal spectral phenology (NDVI/EVI) and field-scale crop classification across Kharif, Rabi, and Summer seasons, distinguishing rainfed single-cropped pulses/oilseeds from canal- and borewell-irrigated sugarcane, paddy, and cotton.",
      validation: "Cross-validated against District Agricultural Census cropping intensity and command area records.",
    },
  ];

  const FORMULAS = [
    {
      step: "01",
      title: "Conservation of Mass (WA+ Master Balance)",
      equation: "ΔS_total = P + I_import − ET_actual − Q_outflow − E_export",
      residual: "Residual = P + I − ET_a − Q_out − E − ΔS_SW − ΔS_GW = 0.0000 BCM",
      explanation:
        "Every sub-basin and every monthly timestep obeys strict physical conservation of mass. Incoming precipitation (P) plus inter-basin canal imports (I, such as Pattiseema/Godavari transfers into KRI_LOWER) must equal total actual evapotranspiration (ET_actual), downstream river outflow (Q_outflow), trans-basin exports (E, such as the Koyna westward hydropower diversion), and net storage change in surface reservoirs (ΔS_SW) and groundwater aquifers (ΔS_GW).",
      terms: [
        { sym: "P", val: "218.49 BCM/yr (±4.2%)", desc: "Area-integrated precipitation across 254,746.23 km²" },
        { sym: "I_import", val: "1.24 BCM/yr (±8.0%)", desc: "Inter-basin transfers (up to 3.1 BCM/yr post-2016)" },
        { sym: "ET_actual", val: "175.91 BCM/yr (±6.8%)", desc: "Total water vapor returned to the atmosphere" },
        { sym: "Q_outflow", val: "40.16 BCM/yr (±5.2%)", desc: "Terminal discharge into the Bay of Bengal" },
      ],
    },
    {
      step: "02",
      title: "Areal Precipitation Depth-to-Volume Integration",
      equation: "V_precip (BCM) = Σ [ P_i (mm) × Area_i (km²) ] × 10⁻⁶",
      residual: "1 mm of rain over 1 km² = 1,000 m³ = 10⁻⁶ BCM",
      explanation:
        "Monthly rainfall depths from the 21 sub-basin ERA5-Land nodes and 35,378 CWC/IMD gauge logs are integrated over the exact UTM Zone 43N (EPSG:32643) polygon area of each sub-basin. Using projected metric coordinates avoids the 3–5% area distortion common in unprojected lat-lon grids.",
      terms: [
        { sym: "KRI_UPPER", val: "54,504.8 km²", desc: "1,038 mm normal → ~56.6 BCM/yr input" },
        { sym: "BHI_UPPER & LOWER", val: "68,446.1 km²", desc: "710–765 mm normal → rain-shadow semi-arid core" },
        { sym: "TUN_UPPER & LOWER", val: "70,076.3 km²", desc: "640–1,120 mm normal → Western Ghats to Rayalaseema" },
        { sym: "KRI_MIDDLE & LOWER", val: "61,719.0 km²", desc: "810–940 mm normal → Nallamala & coastal delta" },
      ],
    },
    {
      step: "03",
      title: "FAO-56 Dual Crop Coefficient ET Partitioning (Green vs. Blue)",
      equation: "ET_actual = ET_green_agri + ET_blue_agri + ET_natural + E_reservoir",
      residual: "ET_c = (K_cb × K_s + K_e) × ET₀",
      explanation:
        "Total evapotranspiration is separated by water source. Green ET is precipitation that infiltrates unsaturated root zones and is transpired directly by rainfed crops and native vegetation. Blue ET is the incremental consumptive depletion sustained by canal releases and groundwater pumping when soil moisture falls below crop demand.",
      terms: [
        { sym: "ET_green_agri", val: "104.62 BCM/yr", desc: "Rainfed crop root-zone transpiration" },
        { sym: "ET_blue_agri", val: "28.41 BCM/yr", desc: "Irrigated consumptive depletion (+6.18 BCM/decade trend)" },
        { sym: "ET_natural", val: "36.30 BCM/yr", desc: "Forests, Western Ghats montane canopy & shrublands" },
        { sym: "E_reservoir", val: "5.58 BCM/yr", desc: "Open-water evaporation from 34 major dams & 17,984 tanks" },
      ],
    },
    {
      step: "04",
      title: "Hard-Rock Aquifer Storage & Recharge (CGWB GEC-2015)",
      equation: "ΔS_GW = Area × S_y × Δh   |   R_total = R_monsoon + R_canal_seepage + R_return",
      residual: "Stage of Extraction (SOE) = (Gross Draft / Extractable Recharge) × 100%",
      explanation:
        "More than 88% of the Krishna Basin rests on low-storage Deccan Trap basalts and crystalline gneiss where groundwater resides in weathered regolith and fractures within 60 m of the surface. Aquifer storage changes are computed from piezometric water table shifts (Δh) multiplied by lithology-specific yield (S_y).",
      terms: [
        { sym: "S_y (Hard Rock)", val: "0.015 – 0.028", desc: "Fractured basalt & granite-gneiss (817 borehole logs)" },
        { sym: "S_y (Delta Alluvium)", val: "0.120", desc: "Unconsolidated coastal sand and silt in KRI_LOWER" },
        { sym: "Canal Return Flow", val: "42% of releases", desc: "26% percolates to shallow aquifers; 16% returns to drains" },
        { sym: "GW Irrigation Return", val: "18% of pumping", desc: "Field percolation returning to underlying water table" },
      ],
    },
    {
      step: "05",
      title: "Directed Acyclic Graph (DAG) Topological River Routing",
      equation: "Q_inflow(j) = Σ Q_outflow(i)  for all i ∈ Upstream(j)",
      residual: "Σ Internal Sub-Basin Transfers = 0 at Exterior Basin Boundary",
      explanation:
        "Summing sub-basin streamflows naively counts the same water multiple times as it passes from Maharashtra through Karnataka into Telangana and Andhra Pradesh. The model enforces a strict topological cascade so upstream outflows become downstream inflows.",
      terms: [
        { sym: "Headwater Nodes", val: "KRI_UPPER, BHI_UPPER, TUN_UPPER", desc: "Zero upstream river inflow; purely rainfall-generated" },
        { sym: "Bhima Cascade", val: "BHI_UPPER → BHI_LOWER → KRI_MIDDLE", desc: "Joins mainstem Krishna above Raichur confluence" },
        { sym: "Tungabhadra Arm", val: "TUN_UPPER → TUN_LOWER → KRI_LOWER", desc: "Joins mainstem at Sangameswaram (Srisailam head)" },
        { sym: "Terminal Outlet", val: "KRI_LOWER → Bay of Bengal", desc: "Measured at Wadenepally CWC gauge & Prakasam Barrage" },
      ],
    },
    {
      step: "06",
      title: "Water Quality Usability Discounting",
      equation: "V_usable = V_physical × (1 − Discount_salinity − Discount_fluoride − Discount_nitrate)",
      residual: "Physical Mass Balance remains 100% conserved",
      explanation:
        "Salinity, geogenic fluoride, and agricultural nitrate render water unsafe for drinking or crops without removing its physical volume from the basin. We track usability discounts in a parallel account so physical mass balance is never distorted.",
      terms: [
        { sym: "Salinity (EC > 3000)", val: "Coastal & command waterlogging", desc: "Restricts sensitive crop irrigation in BHI_LOWER & KRI_LOWER" },
        { sym: "Fluoride (> 1.5 mg/L)", val: "Granitic aquifers", desc: "Concentrated in Nalgonda, Raichur, and TUN_LOWER gneiss" },
        { sym: "Nitrate (> 45 mg/L)", val: "Intensive fertilizer zones", desc: "Leaching under sugarcane & paddy command corridors" },
        { sym: "Accounting Rule", val: "Parallel Ledger", desc: "Prevents artificial mass-balance residuals" },
      ],
    },
  ];

  const ASSUMPTIONS = [
    {
      id: "A-01",
      title: "Indian Hydrological Year Alignment (June 1 – May 31)",
      scope: "Temporal Boundary",
      detail:
        "All annual water accounts run from June 1 (Southwest Monsoon onset) to May 31 (pre-monsoon dry trough). This prevents splitting a single monsoon's storage carryover across two calendar years. The partial 2026–27 record (June–September 2026) is archived separately and excluded from 26-year Mann–Kendall trend slopes.",
    },
    {
      id: "A-02",
      title: "Projected GIS Area vs. Statutory CWC Area",
      scope: "Spatial Geometry",
      detail:
        "Depth-to-volume conversions use the exact EPSG:32643 polygon area (254,746.23 km²) so raster integrals remain mathematically self-consistent. Official CWC statutory area (258,948 km², +1.62%) is reported in parallel.",
    },
    {
      id: "A-03",
      title: "Zero Boundary Double-Counting via DAG Routing",
      scope: "Network Topology",
      detail:
        "All internal river transfers cancel out across interior sub-basin boundaries. Basin-wide yield and outflow reflect strictly net exterior fluxes.",
    },
    {
      id: "A-04",
      title: "Hard-Rock Specific Yield Uncertainty (±22%)",
      scope: "Hydrogeology",
      detail:
        "Because fractured basalt and gneiss exhibit strong local heterogeneity, specific yield values (0.015–0.028) carry a ±22% 1σ uncertainty band propagated into groundwater storage change estimates.",
    },
    {
      id: "A-05",
      title: "Return Flow & Seepage Partitioning",
      scope: "Irrigation Physics",
      detail:
        "Gross surface canal diversions are not equal to consumptive loss: 42% returns via canal seepage (26%) and surface drainage (16%). Only net Blue ET leaves the basin system.",
    },
    {
      id: "A-06",
      title: "Decoupling Physical Mass from Chemical Usability",
      scope: "Water Quality",
      detail:
        "Impaired groundwater is flagged via usability discount percentages rather than deducted from volumetric storage, preserving strict physical conservation of mass.",
    },
  ];

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-12 animate-apple-reveal">
      {/* Editorial Header */}
      <div className="space-y-4 border-b border-black/[0.08] pb-8">
        <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-[#4A6B53] font-semibold">
          Methodology & Primary Data Provenance
        </div>
        <h1 className="font-serif text-4xl md:text-5xl text-[#141916] tracking-tight leading-[1.12]">
          Nothing left in the dark.
        </h1>
        <p className="text-base md:text-lg text-[#5A625D] max-w-3xl leading-relaxed font-normal">
          Every figure in this system is derived from primary gauge records, satellite reanalysis, and physical conservation laws. Below is the complete inventory of where the data came from, how each flux was calculated, and the explicit assumptions governing the model.
        </p>

        {/* Segmented Control */}
        <div className="pt-4 flex flex-wrap items-center justify-between gap-4">
          <div className="inline-flex bg-[#EFECE6] p-1 rounded-full border border-black/[0.06]">
            {[
              { id: "sources", label: "1. Where the Data Came From (8 Sources)" },
              { id: "formulas", label: "2. How Calculations Are Made (6 Equations)" },
              { id: "assumptions", label: "3. Assumptions & Uncertainty (A-01–A-06)" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id as any)}
                className={`px-4 py-2 rounded-full text-xs font-medium transition-all duration-300 ease-apple ${
                  activeSection === tab.id
                    ? "bg-[#141916] text-white shadow-sm"
                    : "text-[#5A625D] hover:text-[#141916]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <a
            href="/api/download/master_analytical_ledger"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1E3F2E] hover:underline"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Download Master Analytical Ledger (CSV)</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* SECTION 1: DATA SOURCES */}
      {activeSection === "sources" && (
        <div className="space-y-4 animate-apple-reveal">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bento-stone p-5">
              <div className="text-[11px] font-mono uppercase tracking-wider text-[#5A625D]">Primary Gauge Logs</div>
              <div className="text-3xl font-semibold tracking-tight text-[#141916] mt-1 tabular-nums">380,627</div>
              <div className="text-xs text-[#5A625D] mt-1">Daily & seasonal CWC, CGWB & NRSC station readings</div>
            </div>
            <div className="bento-stone p-5">
              <div className="text-[11px] font-mono uppercase tracking-wider text-[#5A625D]">Spatial Features</div>
              <div className="text-3xl font-semibold tracking-tight text-[#141916] mt-1 tabular-nums">92,167</div>
              <div className="text-xs text-[#5A625D] mt-1">Dams, canals, rivers, reservoirs & S2 cells mapped</div>
            </div>
            <div className="bento-stone p-5">
              <div className="text-[11px] font-mono uppercase tracking-wider text-[#5A625D]">Temporal Span</div>
              <div className="text-3xl font-semibold tracking-tight text-[#141916] mt-1 tabular-nums">26 Years</div>
              <div className="text-xs text-[#5A625D] mt-1">321 consecutive months (June 2000 – September 2026)</div>
            </div>
          </div>

          {DATA_SOURCES.map((ds) => {
            const open = expandedSource === ds.id;
            return (
              <div
                key={ds.id}
                onClick={() => setExpandedSource(open ? null : ds.id)}
                className="bento-card p-6 cursor-pointer"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-semibold text-[#4A6B53]">{ds.id}</span>
                      <span className="text-xs text-[#8C948E]">·</span>
                      <span className="text-xs font-medium text-[#5A625D]">{ds.agency}</span>
                    </div>
                    <h3 className="text-lg font-semibold text-[#141916]">{ds.title}</h3>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="hidden sm:inline-block text-xs font-mono text-[#5A625D] bg-[#F3F1EB] px-3 py-1 rounded-full">
                      {ds.volume}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-[#5A625D] transition-transform duration-300 ease-apple ${
                        open ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </div>

                {open && (
                  <div className="mt-5 pt-5 border-t border-black/[0.06] space-y-4 text-sm text-[#3A423D] animate-apple-reveal">
                    <p className="leading-relaxed">{ds.summary}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div className="bento-stone p-3.5">
                        <div className="text-[10px] font-mono uppercase text-[#5A625D]">Resolution & Scale</div>
                        <div className="font-medium text-[#141916] mt-1">{ds.scale}</div>
                      </div>
                      <div className="bento-stone p-3.5">
                        <div className="text-[10px] font-mono uppercase text-[#5A625D]">Temporal Coverage</div>
                        <div className="font-medium text-[#141916] mt-1">{ds.period}</div>
                      </div>
                      <div className="bento-stone p-3.5">
                        <div className="text-[10px] font-mono uppercase text-[#5A625D]">Independent Verification</div>
                        <div className="font-medium text-[#141916] mt-1">{ds.validation}</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1 font-mono text-[11px] text-[#5A625D]">
                      <span className="bg-[#F3F1EB] px-2.5 py-1 rounded-md">Raw: {ds.rawPath}</span>
                      <span className="bg-[#F3F1EB] px-2.5 py-1 rounded-md">Processed: {ds.processedPath}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* SECTION 2: FORMULAS */}
      {activeSection === "formulas" && (
        <div className="space-y-6 animate-apple-reveal">
          {FORMULAS.map((f) => (
            <div key={f.step} className="bento-card p-6 md:p-8 space-y-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-xs font-semibold text-[#4A6B53]">EQUATION {f.step}</span>
                  <h3 className="font-serif text-2xl text-[#141916]">{f.title}</h3>
                </div>
                <span className="text-xs font-mono text-[#1E3F2E] bg-[#E8EFEA] px-3 py-1 rounded-full">
                  {f.residual}
                </span>
              </div>

              <div className="bento-stone p-4 font-mono text-sm md:text-base text-[#141916] font-medium tracking-tight overflow-x-auto">
                {f.equation}
              </div>

              <p className="text-sm text-[#3A423D] leading-relaxed">{f.explanation}</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                {f.terms.map((t) => (
                  <div key={t.sym} className="border border-black/[0.06] rounded-xl p-3.5 bg-[#FAF9F5]">
                    <div className="font-mono text-xs font-semibold text-[#141916]">{t.sym}</div>
                    <div className="text-sm font-semibold text-[#1E3F2E] mt-0.5 tabular-nums">{t.val}</div>
                    <div className="text-[11px] text-[#5A625D] mt-1 leading-snug">{t.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SECTION 3: ASSUMPTIONS */}
      {activeSection === "assumptions" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-apple-reveal">
          {ASSUMPTIONS.map((a) => (
            <div key={a.id} className="bento-card p-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-semibold text-[#B8532E] bg-[#F9EFEA] px-2.5 py-1 rounded-md">
                  {a.id}
                </span>
                <span className="text-xs font-mono text-[#5A625D]">{a.scope}</span>
              </div>
              <h3 className="text-base font-semibold text-[#141916]">{a.title}</h3>
              <p className="text-xs md:text-sm text-[#5A625D] leading-relaxed">{a.detail}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
