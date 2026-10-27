#!/usr/bin/env python3
"""
Generate complete offline database bundle for Krishna River Basin Web App.
Dumps all API responses into 11_Web_Application/frontend/src/offlineDb.json.
"""

import urllib.request
import json
import time
from pathlib import Path

BASE_URL = "http://127.0.0.1:8000"
FRONTEND_SRC = Path("/run/media/clinton/24700DC6700D9FA2/Krishna River Basin/11_Web_Application/frontend/src")

subbasins = ["KRISHNA_BASIN", "KRI_UPPER", "BHI_UPPER", "BHI_LOWER", "KRI_MIDDLE", "TUN_UPPER", "TUN_LOWER", "KRI_LOWER"]
scales = ["annual", "seasonal", "monthly"]

db = {}
t0 = time.time()

def fetch_endpoint(path: str):
    url = f"{BASE_URL}{path}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "OfflinePacker/1.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            db[path] = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"Error fetching {path}: {e}")

print("1. Fetching overview & validation...")
fetch_endpoint("/api/overview")
fetch_endpoint("/api/quality-validation")

overview = db.get("/api/overview", {})
hys = [r["hydro_year"] for r in overview.get("annual_basin_series", [])]

print(f"2. Fetching water balance, agriculture, and trends for {len(subbasins)} sub-basins...")
for sb in subbasins:
    for sc in scales:
        fetch_endpoint(f"/api/water-balance?subbasin_id={sb}&scale={sc}")
    fetch_endpoint(f"/api/agriculture?subbasin_id={sb}")
    fetch_endpoint(f"/api/trends-attribution?subbasin_id={sb}")

print(f"3. Fetching subbasins detail for {len(hys)} years...")
for hy in hys:
    fetch_endpoint(f"/api/subbasins?hydro_year={hy}")

print("4. Fetching sankeys across all sub-basins and years...")
for sb in subbasins:
    fetch_endpoint(f"/api/sankey?hydro_year=2000-26_MEAN&subbasin_id={sb}")
    for hy in hys:
        fetch_endpoint(f"/api/sankey?hydro_year={hy}&subbasin_id={sb}")

print("5. Fetching GeoJSON layers...")
for layer in ["subbasins", "rivers", "reservoirs_wfs", "ibtl_links", "s2_cells", "cgwb_2020"]:
    fetch_endpoint(f"/api/geojson/{layer}")

# Also pre-generate popular compare pairs:
print("6. Pre-fetching key compare pairs...")
key_compare_pairs = [
    ("2002-03", "2020-21"),
    ("2002-03", "2024-25"),
    ("2015-16", "2020-21"),
    ("2000-01", "2024-25"),
    ("2003-04", "2005-06"),
    ("2011-12", "2019-20"),
]
for ya, yb in key_compare_pairs:
    fetch_endpoint(f"/api/compare?year_a={ya}&year_b={yb}")

output_path = FRONTEND_SRC / "offlineDb.json"
print(f"Writing {len(db)} cached responses to {output_path}...")
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(db, f, separators=(",", ":"))

total_mb = output_path.stat().st_size / (1024 * 1024)
print(f"Completed in {time.time() - t0:.2f}s! Bundle size: {total_mb:.2f} MB")
