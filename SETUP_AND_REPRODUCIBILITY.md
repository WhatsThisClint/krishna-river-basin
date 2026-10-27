# Krishna River Basin — Autonomous Hydrological Intelligence System
## Agent & Developer Setup, Provenance, and Execution Runbook

This repository contains the complete, reproducible **Water Accounting Plus (WA+)** hydrological intelligence system for the **Krishna River Basin, India** (CWC Basin Code 04, 254,746 km²).

---

### 1. Zero-Friction Bootstrap on a New Machine (Under 2 Minutes)

#### Prerequisites
- **Linux / macOS / Windows WSL2**
- **Python 3.11+**
- **Node.js 18+** (only needed if modifying the web UI)
- **uv** (recommended for instant Python package management: `curl -LsSf https://astral.sh/uv/install.sh | sh`)

#### Single-Command Python Setup
```bash
# 1. Clone repository
git clone <YOUR_REPO_URL> "Krishna River Basin"
cd "Krishna River Basin"

# 2. Decompress GIS infrastructure layers if cloned fresh
if [ -f "02_Processed_Data/Infrastructure_and_Stations/krishna_indiawris_infrastructure_and_stations.gpkg.gz" ] && [ ! -f "02_Processed_Data/Infrastructure_and_Stations/krishna_indiawris_infrastructure_and_stations.gpkg" ]; then
    gzip -d -k "02_Processed_Data/Infrastructure_and_Stations/krishna_indiawris_infrastructure_and_stations.gpkg.gz"
fi

# 3. Create virtual environment and install dependencies via uv (takes ~25 seconds)
uv venv .venv --python 3.12
source .venv/bin/activate
uv pip install -r 05_Python/requirements.txt
uv pip install duckdb geopandas pyarrow shapely numpy pandas s2sphere scipy fastapi uvicorn
```

---

### 2. Core Repository Architecture

| Directory | Contents |
|---|---|
| `01_Raw_Data/` | Primary ERA5-Land, NASA POWER, GloFAS, and India-WRIS raw API responses |
| `02_Processed_Data/` | GeoParquet time series, CWC subbasin boundaries, and `krishna_s2_level13_basinwide.parquet` |
| `03_QGIS/` | QGIS 4.2.2 project (`Krishna_Basin_Hydrological_Intelligence.qgz`) with 37 styled layers |
| `04_Hydrological_Models/`| Coupled 4-compartment monthly/annual WA+ model (`04_water_accounting_and_duckdb.py`) |
| `05_Python/` | Numbered pipelines `01` through `07` for acquisition, analysis, maps, and QA audit |
| `06_Agricultural_API/` | S2 Level-13 grid engine (`generate_basinwide_s2_duckdb.py`) & FAO-56 crop accounting |
| `07_Time_Series/` | 26-year monthly/seasonal/annual water balance matrices & Mann-Kendall trend tests |
| `08_Validation/` | Multi-sensor triangulation matrices (NRSC VIC ET, CWC streamflow, CGWB wells) |
| `09_Maps_Figures/` | 11 publication-quality 300 DPI figures (`Fig01` through `Fig11` in PNG & PDF) |
| `10_Research_Report/` | Complete 25-chapter monograph in PDF, DOCX, and Markdown |
| `11_Web_Application/` | Full-stack FastAPI backend + React/TypeScript/Vite/Tailwind interactive UI |
| `12_Database/` | Unified DuckDB analytical database (`krishna_hydrological_intelligence.duckdb`, 18 tables) |
| `13_Logs_Metadata/` | Dataset catalogue, assumption register, and API audit logs |
| `Krishna_Basin_Intelligence.html` | Self-contained, single-file offline interactive web dashboard (open directly in browser) |

---

### 3. How to Launch & Query

#### A. Direct Browser Dashboard (No Server Needed)
Simply open the bundled HTML file in any browser:
```bash
xdg-open Krishna_Basin_Intelligence.html
# Or on macOS: open Krishna_Basin_Intelligence.html
```

#### B. Launch Full-Stack Web Application (FastAPI + React)
```bash
# 1. Start FastAPI backend (port 8000)
source .venv/bin/activate
uvicorn main:app --app-dir 11_Web_Application/backend --host 127.0.0.1 --port 8000 &

# 2. Start Vite dev frontend (port 5173)
cd 11_Web_Application/frontend
npm install
npm run dev
```

#### C. Instant DuckDB Analytics
Query the 165,823 S2 landscape grid cells or the 26-year water balance:
```python
import duckdb

conn = duckdb.connect("12_Database/krishna_hydrological_intelligence.duckdb", read_only=True)

# 1. Inspect sub-basin crop distribution across 165k cells
print(conn.execute("""
    SELECT subbasin_name, dominant_kharif_crop, COUNT(*) as cells,
           ROUND(AVG(waterbodies_5km_count), 1) as avg_tanks
    FROM s2_landscape_intelligence
    GROUP BY subbasin_name, dominant_kharif_crop
    ORDER BY cells DESC LIMIT 5
""").df())

# 2. Check 26-year calibrated basin water balance
print(conn.execute("""
    SELECT hydro_year, precip_bcm, et_actual_total_bcm, surface_runoff_bcm,
           gw_total_recharge_bcm, subbasin_outflow_bcm
    FROM water_balance_annual
    WHERE subbasin_id = 'KRISHNA_BASIN' AND is_complete_year = TRUE
    ORDER BY start_year DESC LIMIT 5
""").df())
```

---

### 4. Re-Running Pipelines from Scratch

All pipelines are strictly deterministic and require no external paid API keys:

1. **Re-generate Basin-Wide S2 Grid & DuckDB Table**:
   ```bash
   python 06_Agricultural_API/generate_basinwide_s2_duckdb.py
   ```
2. **Re-calculate Water Balance & Ledgers**:
   ```bash
   python 04_Hydrological_Models/04_water_accounting_and_duckdb.py
   ```
3. **Re-generate 11 Cartographic Figures**:
   ```bash
   python 05_Python/05_generate_maps_and_figures.py
   ```
4. **Re-build Standalone Single-File Web Dashboard**:
   ```bash
   python 11_Web_Application/generate_offline_bundle.py
   cd 11_Web_Application/frontend && npm run build
   cp dist/index.html ../../Krishna_Basin_Intelligence.html
   ```
