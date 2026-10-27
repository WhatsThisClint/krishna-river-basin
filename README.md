# Krishna River Basin — Autonomous Hydrological Intelligence and Water Accounting System

An end-to-end, reproducible, multi-decadal (**2000–01 to 2026–27**) hydrological reconstruction and **Water Accounting Plus (WA+)** decision-intelligence system for the **Krishna River Basin, India** (`CWC Basin Code 04`; `254,746.23 km²` GIS area / `258,948 km²` official CWC area).

---

## 1. Canonical 13-Folder Workspace Architecture

- `01_Raw_Data/` — Immutable raw datasets (`ERA5_OpenMeteo`, `NASA_POWER`, `GloFAS_Discharge`, `India_WRIS_WFS`, `India_WRIS_TimeSeries`, `Spatial_Reference_Links`)
- `02_Processed_Data/` — Standardized GeoJSON/GeoPackage/GeoTIFF spatial layers and Parquet/CSV time series
- `03_QGIS/` — Saved QGIS 4.2.2 project (`Krishna_Basin_Hydrological_Intelligence.qgz`) with 37 styled layers & print layout
- `04_Hydrological_Models/` — Coupled 4-compartment WA+ monthly (`2,568` rows), seasonal (`648` rows), and annual (`216` rows) ledgers (`04_water_accounting_and_duckdb.py`)
- `05_Python/` — End-to-end reproducible Python pipelines (`01` through `07`) and `requirements.txt`
- `06_Agricultural_API/` — S2 Level-13 basin-wide landscape intelligence (`165,823` interior cells in DuckDB & GeoParquet; `generate_basinwide_s2_duckdb.py`) + 350-cell stratified ground-truth sample and FAO-56 crop water accounts
- `07_Time_Series/` — Historical monthly, seasonal, and annual series + Mann–Kendall / Hamed–Rao / Sen's slope / Pettitt trend matrices
- `08_Validation/` — Multi-sensor triangulation matrix, matched-rainfall year attribution, water quality usability accounts, and final QA audit (`final_qa_audit_report.json`)
- `09_Maps_Figures/` — 11 publication-quality 300 DPI cartographic maps and scientific figures (`.png` and `.pdf`)
- `10_Research_Report/` — Complete 25-chapter scientific monograph in PDF (`Krishna_Basin_Hydrological_Assessment.pdf`), DOCX (`Krishna_Basin_Hydrological_Assessment.docx`), Markdown, and `references.bib`
- `11_Web_Application/` — Full-stack FastAPI + React/TypeScript/Vite/Tailwind/ECharts/Leaflet interactive web application implementing Core Experiences A–I
- `12_Database/` — Unified DuckDB analytical database (`krishna_hydrological_intelligence.duckdb`, 18 tables including `s2_landscape_intelligence`)
- `13_Logs_Metadata/` — `dataset_catalogue.json`, `assumption_register.md`, `anthrokrishi_api_audit.json`, and `acquisition_logs.json`

---

## 2. Key 26-Year Calibrated Water Balance Findings (`2000–01` to `2025–26`)

| Component | 26-Year Mean | Uncertainty (±1σ) | Independent Reference & Agreement |
|---|---|---|---|
| **Precipitation Input** | `218.49 BCM/yr` (`857.66 mm/yr`) | `±4.2%` | NASA POWER (`841.2 mm/yr`, `r = 0.964`) & India-WRIS CWC |
| **Inter-Basin Imports** | `1.24 BCM/yr` (`2.2–3.1 BCM` post-2016) | `±8.0%` | Pattiseema / Godavari Right Main Canal transfers |
| **Total Actual ET** | `175.91 BCM/yr` (`690.5 mm/yr`) | `±6.8%` | NRSC VIC Model ET (`672.4 mm/yr`, `+2.69%` diff, `r = 0.912`) |
| — *Agricultural Green ET* | `104.62 BCM/yr` | `±7.5%` | FAO-56 Effective Rainfall Root-Zone Transpiration |
| — *Agricultural Blue ET* | `28.41 BCM/yr` | `±9.0%` | Irrigated Crop Consumptive Depletion (`+6.18 BCM/dec`, $p < 0.0001$) |
| — *Natural Vegetation ET* | `36.30 BCM/yr` | `±8.5%` | Western Ghats & Nallamala Forests / Shrublands |
| — *Reservoir & Tank Evap* | `5.58 BCM/yr` | `±10.0%` | 13 Major Reservoirs + 17,984 Minor Waterbodies |
| **Natural Surface Water Yield** | `75.16 BCM/yr` (`64.27` RO + `10.89` BF) | `±5.5%` | CWC Official Potential (`78.12 BCM/yr`, `-3.79%` diff) |
| **Total Groundwater Recharge** | `24.29 BCM/yr` | `±11.0%` | CGWB Assessment Norms (`24.63–26.94 BCM/yr`) |
| **Gross GW Withdrawal** | `15.64 BCM/yr` | `±12.0%` | CGWB Extraction Norms (`15.35–15.92 BCM/yr`) |
| **Terminal Outflow (Bay of Bengal)** | `40.16 BCM/yr` | `±5.2%` | CWC Wadenepally Gauge (`39.55 BCM/yr`, `+1.54%` diff) & GloFAS (`38.72 BCM/yr`) |
| **Mass Balance Residual** | `0.0000 BCM/yr` | Exact | Verified across all 2,568 monthly & 216 annual accounting rows |

---

## 3. Reproducing the Pipeline & Launching the Web Application

```bash
# 1. Run any analytical or report script using the project Python 3.12 environment:
/home/clinton/.cache/krishna-venv/bin/python 04_Hydrological_Models/04_water_accounting_and_duckdb.py
/home/clinton/.cache/krishna-venv/bin/python 05_Python/05_generate_maps_and_figures.py
/home/clinton/.cache/krishna-venv/bin/python 05_Python/06_generate_scientific_report.py

# 2. Launch the Full-Stack Interactive Web Application (FastAPI + React):
/home/clinton/.cache/krishna-venv/bin/uvicorn main:app --app-dir 11_Web_Application/backend --host 127.0.0.1 --port 8000
```
