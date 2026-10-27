#!/usr/bin/env python3
"""
Krishna River Basin — Autonomous Hydrological Intelligence & Water Accounting System
FastAPI Analytical Backend (11_Web_Application/backend/main.py)
Serves DuckDB analytical tables, WA+ mass-balance ledgers, GeoJSON layers, and static maps.
"""

import io
import json
from pathlib import Path
from typing import Optional

import duckdb
import geopandas as gpd
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

ROOT = Path("/run/media/clinton/24700DC6700D9FA2/Krishna River Basin")
DB_PATH = ROOT / "12_Database/krishna_hydrological_intelligence.duckdb"
PROC_DIR = ROOT / "02_Processed_Data"
MOD_DIR = ROOT / "04_Hydrological_Models"
TS_DIR = ROOT / "07_Time_Series"
VAL_DIR = ROOT / "08_Validation"
FIG_DIR = ROOT / "09_Maps_Figures"
META_DIR = ROOT / "13_Logs_Metadata"

app = FastAPI(
    title="Krishna River Basin Hydrological Intelligence API",
    description="End-to-End Reproducible Water Accounting Plus (WA+) & Spatial-Temporal Intelligence API (2000–01 to 2026–27)",
    version="2026.10.1",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if FIG_DIR.exists():
    app.mount("/figures", StaticFiles(directory=str(FIG_DIR)), name="figures")


def query_db(sql: str, params: tuple = ()) -> list[dict]:
    con = duckdb.connect(str(DB_PATH), read_only=True)
    try:
        df = con.execute(sql, params).df()
        return json.loads(df.to_json(orient="records"))
    finally:
        con.close()


# Cache GeoJSON layers in memory on first request for sub-50ms map rendering
_GEOJSON_CACHE: dict[str, dict] = {}

GEOJSON_PATHS = {
    "basin": PROC_DIR / "Boundaries/krishna_basin_boundary.geojson",
    "subbasins": PROC_DIR / "Boundaries/krishna_subbasins_cwc.geojson",
    "states": PROC_DIR / "Boundaries/krishna_states.geojson",
    "districts": PROC_DIR / "Boundaries/krishna_districts.geojson",
    "aquifers": PROC_DIR / "Hydrogeology_and_GW/krishna_major_aquifers.geojson",
    "cgwb_2011": PROC_DIR / "Hydrogeology_and_GW/krishna_cgwb_gwr_au_2011.geojson",
    "cgwb_2017": PROC_DIR / "Hydrogeology_and_GW/krishna_cgwb_gwr_au_2017.geojson",
    "cgwb_2020": PROC_DIR / "Hydrogeology_and_GW/krishna_cgwb_gwr_au_2020.geojson",
    "lithologs": PROC_DIR / "Hydrogeology_and_GW/krishna_cgwb_lithologs.geojson",
    "s2_cells": PROC_DIR / "Agriculture/krishna_s2_level13_stratified_sample.geojson",
    "ibtl_links": PROC_DIR / "Infrastructure_and_Waterbodies/krishna_interbasin_links.geojson",
    "ibtl_reservoirs": PROC_DIR / "Infrastructure_and_Waterbodies/krishna_interbasin_reservoirs.geojson",
    "rivers": PROC_DIR / "Infrastructure_and_Stations/Krishna_River_Name_Krishna.geojson",
    "reservoirs_wfs": PROC_DIR / "Infrastructure_and_Stations/Krishna_Reservoir_Hydro.geojson",
    "dams_wfs": PROC_DIR / "Infrastructure_and_Stations/Krishna_DAM.geojson",
    "bwa_wfs": PROC_DIR / "Infrastructure_and_Stations/Krishna_BWA.geojson",
    "lifts_wfs": PROC_DIR / "Infrastructure_and_Stations/Krishna_LIFT.geojson",
    "commands_wfs": PROC_DIR / "Infrastructure_and_Stations/Krishna_WRPCOMMAND.geojson",
}


@app.get("/api/health")
def get_health():
    con = duckdb.connect(str(DB_PATH), read_only=True)
    try:
        tables = [r[0] for r in con.execute("SHOW TABLES").fetchall()]
        ledger_rows = con.execute("SELECT COUNT(*) FROM master_analytical_ledger").fetchone()[0]
    finally:
        con.close()
    return {
        "status": "ok",
        "database": str(DB_PATH.name),
        "tables": tables,
        "master_analytical_ledger_rows": ledger_rows,
        "available_geojson_layers": list(GEOJSON_PATHS.keys()),
    }


@app.get("/api/overview")
def get_overview():
    annual_kb = query_db(
        "SELECT * FROM water_balance_annual WHERE subbasin_id = 'KRISHNA_BASIN' ORDER BY start_year"
    )
    subbasins_latest = query_db(
        "SELECT * FROM water_balance_annual WHERE subbasin_id != 'KRISHNA_BASIN' AND hydro_year = '2024-25' ORDER BY subbasin_id"
    )
    subbasins_mean = query_db("""
        SELECT
            subbasin_id,
            ANY_VALUE(subbasin_name) AS subbasin_name,
            ANY_VALUE(area_km2) AS area_km2,
            ROUND(AVG(precip_mm), 1) AS mean_precip_mm,
            ROUND(AVG(precip_bcm), 2) AS mean_precip_bcm,
            ROUND(AVG(et_actual_total_bcm), 2) AS mean_et_total_bcm,
            ROUND(AVG(et_green_agri_bcm), 2) AS mean_et_green_agri_bcm,
            ROUND(AVG(et_blue_agri_bcm), 2) AS mean_et_blue_agri_bcm,
            ROUND(AVG(surface_runoff_bcm), 2) AS mean_surface_runoff_bcm,
            ROUND(AVG(gw_total_recharge_bcm), 2) AS mean_gw_recharge_bcm,
            ROUND(AVG(gw_withdrawal_total_bcm), 2) AS mean_gw_withdrawal_bcm,
            ROUND(AVG(sw_withdrawal_total_bcm), 2) AS mean_sw_withdrawal_bcm,
            ROUND(AVG(subbasin_outflow_bcm), 2) AS mean_outflow_bcm,
            ROUND(AVG(delta_storage_gw_bcm), 2) AS mean_delta_s_gw_bcm,
            ROUND(AVG(gw_stage_of_development_pct), 1) AS mean_gw_stage_pct
        FROM water_balance_annual
        WHERE subbasin_id != 'KRISHNA_BASIN' AND is_complete_year = TRUE
        GROUP BY subbasin_id
        ORDER BY subbasin_id
    """)
    dag_edges = [
        {"source": "KRI_UPPER", "target": "KRI_MIDDLE", "label": "Upper Krishna Mainstem (Almatti/Narayanpur)"},
        {"source": "BHI_UPPER", "target": "BHI_LOWER", "label": "Bhima Mainstem (Below Ujjani)"},
        {"source": "BHI_LOWER", "target": "KRI_MIDDLE", "label": "Bhima–Krishna Confluence (Near Raichur/Yadgir)"},
        {"source": "TUN_UPPER", "target": "TUN_LOWER", "label": "Tungabhadra Dam Outflow (Hospet)"},
        {"source": "TUN_LOWER", "target": "KRI_LOWER", "label": "Tungabhadra–Krishna Confluence (Sangameswaram)"},
        {"source": "KRI_MIDDLE", "target": "KRI_LOWER", "label": "Middle Krishna Outflow into Srisailam"},
        {"source": "KRI_LOWER", "target": "BAY_OF_BENGAL", "label": "Terminal Outflow (Prakasam Barrage / Hamsaladeevi)"},
    ]
    return {
        "basin_summary": {
            "official_cwc_area_km2": 258948.0,
            "gis_delineated_area_km2": 254746.23,
            "cwc_natural_runoff_potential_bcm": 78.12,
            "riparian_states": ["Maharashtra", "Karnataka", "Telangana", "Andhra Pradesh"],
            "subbasin_count": 7,
            "dwa_mapped_waterbodies": 17984,
            "s2_level13_population_cells": 165823,
            "s2_level13_stratified_sample": 350,
            "s2_grid_storage_format": "DuckDB Table + GeoParquet (9.84 MB)",
            "major_reservoir_live_capacity_bcm": 32.68,
            "indiawris_primary_records_acquired": 380627,
        },
        "annual_basin_series": annual_kb,
        "subbasins_26yr_mean": subbasins_mean,
        "subbasins_2024_25": subbasins_latest,
        "topological_dag": dag_edges,
    }


@app.get("/api/water-balance")
def get_water_balance(
    subbasin_id: str = Query("KRISHNA_BASIN"),
    scale: str = Query("annual", pattern="^(annual|seasonal|monthly)$"),
    hydro_year: Optional[str] = Query(None),
):
    table_map = {
        "annual": "water_balance_annual",
        "seasonal": "water_balance_seasonal",
        "monthly": "water_balance_monthly",
    }
    tbl = table_map[scale]
    if hydro_year and hydro_year != "all":
        rows = query_db(
            f"SELECT * FROM {tbl} WHERE subbasin_id = ? AND hydro_year = ? ORDER BY start_year",
            (subbasin_id, hydro_year),
        )
    else:
        order_col = "year_month" if scale == "monthly" else "start_year"
        rows = query_db(
            f"SELECT * FROM {tbl} WHERE subbasin_id = ? ORDER BY {order_col}",
            (subbasin_id,),
        )
    return {"subbasin_id": subbasin_id, "scale": scale, "count": len(rows), "data": rows}


@app.get("/api/compare")
def compare_years(
    year_a: str = Query("2002-03"),
    year_b: str = Query("2020-21"),
):
    rows_a = query_db("SELECT * FROM water_balance_annual WHERE hydro_year = ? ORDER BY subbasin_id", (year_a,))
    rows_b = query_db("SELECT * FROM water_balance_annual WHERE hydro_year = ? ORDER BY subbasin_id", (year_b,))
    map_a = {r["subbasin_id"]: r for r in rows_a}
    map_b = {r["subbasin_id"]: r for r in rows_b}

    diffs = []
    compare_metrics = [
        "precip_mm", "precip_bcm", "et_actual_total_bcm", "et_green_agri_bcm", "et_blue_agri_bcm",
        "surface_runoff_bcm", "gw_total_recharge_bcm", "gw_withdrawal_total_bcm", "sw_withdrawal_total_bcm",
        "subbasin_outflow_bcm", "delta_storage_gw_bcm", "delta_storage_total_bcm", "gw_stage_of_development_pct"
    ]
    for sb_id, ra in map_a.items():
        rb = map_b.get(sb_id)
        if not rb:
            continue
        d_item = {"subbasin_id": sb_id, "subbasin_name": ra["subbasin_name"], "year_a": year_a, "year_b": year_b}
        for m in compare_metrics:
            va = float(ra.get(m, 0.0) or 0.0)
            vb = float(rb.get(m, 0.0) or 0.0)
            d_item[f"{m}_a"] = round(va, 3)
            d_item[f"{m}_b"] = round(vb, 3)
            d_item[f"{m}_abs_diff"] = round(vb - va, 3)
            d_item[f"{m}_pct_diff"] = round((vb - va) / abs(va) * 100.0, 2) if abs(va) > 1e-6 else 0.0
        diffs.append(d_item)

    return {"year_a": year_a, "year_b": year_b, "subbasin_comparisons": diffs}


@app.get("/api/sankey")
def get_sankey(hydro_year: str = Query("2024-25"), subbasin_id: str = Query("KRISHNA_BASIN")):
    if hydro_year == "2000-26_MEAN":
        flows = query_db("""
            SELECT source_node, target_node,
                   ROUND(AVG(value_bcm), 3) AS value_bcm,
                   ROUND(AVG(uncertainty_bcm), 3) AS uncertainty_bcm,
                   ANY_VALUE(description) AS description
            FROM sankey_water_flows_annual
            WHERE subbasin_id = ?
            GROUP BY source_node, target_node
        """, (subbasin_id,))
    else:
        flows = query_db(
            "SELECT * FROM sankey_water_flows_annual WHERE hydro_year = ? AND subbasin_id = ?",
            (hydro_year, subbasin_id),
        )
    avail_years = ["2000-26_MEAN"] + [
        r["hydro_year"]
        for r in query_db("SELECT DISTINCT hydro_year FROM sankey_water_flows_annual ORDER BY hydro_year")
    ]
    nodes_set = []
    for f in flows:
        if f["source_node"] not in nodes_set:
            nodes_set.append(f["source_node"])
        if f["target_node"] not in nodes_set:
            nodes_set.append(f["target_node"])
    return {
        "hydro_year": hydro_year,
        "subbasin_id": subbasin_id,
        "available_years": avail_years,
        "nodes": [{"name": n} for n in nodes_set],
        "links": [
            {
                "source": f["source_node"],
                "target": f["target_node"],
                "value": f["value_bcm"],
                "uncertainty_bcm": f.get("uncertainty_bcm", 0.0),
                "description": f.get("description", ""),
            }
            for f in flows
        ],
    }


@app.get("/api/subbasins")
def get_subbasins_detail(hydro_year: str = Query("2024-25")):
    wb = query_db("SELECT * FROM water_balance_annual WHERE hydro_year = ? ORDER BY subbasin_id", (hydro_year,))
    res = query_db("SELECT * FROM reservoir_dynamics_annual WHERE hydro_year = ? ORDER BY effective_live_capacity_bcm DESC", (hydro_year,))
    res_ts = query_db("SELECT * FROM reservoir_dynamics_annual ORDER BY start_year, reservoir_id")
    qual = query_db("SELECT * FROM water_quality_usability_accounts ORDER BY subbasin_id")
    return {
        "hydro_year": hydro_year,
        "subbasins_water_balance": wb,
        "reservoirs_selected_year": res,
        "reservoirs_all_years": res_ts,
        "water_quality_accounts": qual,
    }


@app.get("/api/agriculture")
def get_agriculture(subbasin_id: str = Query("KRISHNA_BASIN")):
    agri = query_db(
        "SELECT * FROM agricultural_water_accounts_annual WHERE subbasin_id = ? ORDER BY start_year",
        (subbasin_id,),
    )
    crops = query_db(
        "SELECT * FROM crop_composition_annual WHERE subbasin_id = ? ORDER BY start_year, crop_group",
        (subbasin_id,),
    )
    all_sb_latest = query_db(
        "SELECT * FROM agricultural_water_accounts_annual WHERE hydro_year = '2024-25' ORDER BY subbasin_id"
    )
    audit_path = META_DIR / "anthrokrishi_api_audit.json"
    audit_data = json.loads(audit_path.read_text()) if audit_path.exists() else {}
    s2_csv = PROC_DIR / "Agriculture/krishna_s2_level13_stratified_sample.csv"
    s2_rows = pd.read_csv(s2_csv).to_dict(orient="records") if s2_csv.exists() else []

    # Basin-wide S2 landscape intelligence summaries from DuckDB
    try:
        if subbasin_id == "KRISHNA_BASIN":
            s2_summary = query_db("""
                SELECT 
                    subbasin_id,
                    subbasin_name,
                    COUNT(*) as cell_count,
                    ROUND(COUNT(*) * 1.26, 1) as estimated_area_km2,
                    ROUND(AVG(waterbodies_5km_count), 1) as avg_waterbodies_5km,
                    ROUND(AVG(nearest_waterbody_dist_km), 2) as avg_nearest_tank_km
                FROM s2_landscape_intelligence
                GROUP BY subbasin_id, subbasin_name
                ORDER BY cell_count DESC
            """)
        else:
            s2_summary = query_db("""
                SELECT 
                    stratum_code,
                    dominant_kharif_crop,
                    dominant_rabi_crop,
                    COUNT(*) as cell_count,
                    ROUND(AVG(waterbodies_5km_count), 1) as avg_waterbodies_5km,
                    ROUND(AVG(nearest_waterbody_dist_km), 2) as avg_nearest_tank_km
                FROM s2_landscape_intelligence
                WHERE subbasin_id = ?
                GROUP BY stratum_code, dominant_kharif_crop, dominant_rabi_crop
                ORDER BY cell_count DESC
            """, (subbasin_id,))
    except Exception:
        s2_summary = []

    return {
        "subbasin_id": subbasin_id,
        "agricultural_accounts_series": agri,
        "crop_composition_series": crops,
        "subbasin_comparison_2024_25": all_sb_latest,
        "anthrokrishi_audit": audit_data,
        "s2_level13_sample": s2_rows,
        "s2_basinwide_summary": s2_summary,
        "s2_total_basin_cells": 165823,
    }


@app.get("/api/trends-attribution")
def get_trends_and_attribution(subbasin_id: str = Query("KRISHNA_BASIN")):
    trends = query_db(
        "SELECT * FROM statistical_trends_mk_sens WHERE subbasin_id = ? ORDER BY ABS(hamed_rao_z) DESC",
        (subbasin_id,),
    )
    all_trends = query_db("SELECT * FROM statistical_trends_mk_sens ORDER BY subbasin_id, variable_code")
    matched = query_db("SELECT * FROM climate_vs_anthropogenic_attribution ORDER BY early_year")
    return {
        "subbasin_id": subbasin_id,
        "trends_selected_unit": trends,
        "all_trends": all_trends,
        "matched_rainfall_attribution": matched,
    }


@app.get("/api/quality-validation")
def get_quality_and_validation():
    val = query_db("SELECT * FROM validation_triangulation_matrix")
    qual = query_db("SELECT * FROM water_quality_usability_accounts")
    gw_ep = query_db("SELECT * FROM cgwb_groundwater_epochs ORDER BY assessment_year")
    tri = query_db(
        "SELECT * FROM climate_triangulation_annual WHERE subbasin_id = 'KRISHNA_BASIN' ORDER BY year"
    )
    wris_res = query_db("SELECT * FROM wris_reservoir_storage_summary ORDER BY max_live_storage_bcm DESC") if _table_exists("wris_reservoir_storage_summary") else []
    wris_q = query_db("SELECT * FROM wris_cwc_river_discharge_station_summary ORDER BY mean_discharge_m3s DESC") if _table_exists("wris_cwc_river_discharge_station_summary") else []
    wris_gw = query_db("SELECT * FROM wris_cgwb_groundwater_district_summary ORDER BY p90_depth_mbgl DESC") if _table_exists("wris_cgwb_groundwater_district_summary") else []
    wris_et = query_db("SELECT * FROM wris_nrsc_vic_evapotranspiration_summary ORDER BY mean_annual_et_mm DESC") if _table_exists("wris_nrsc_vic_evapotranspiration_summary") else []

    figs = sorted([f.name for f in FIG_DIR.glob("*.png")]) if FIG_DIR.exists() else []
    return {
        "validation_matrix": val,
        "water_quality_accounts": qual,
        "cgwb_groundwater_epochs": gw_ep,
        "climate_triangulation_basin": tri,
        "indiawris_station_summaries": {
            "reservoirs": wris_res,
            "cwc_discharge_stations": wris_q,
            "cgwb_district_groundwater": wris_gw,
            "nrsc_vic_district_et": wris_et,
        },
        "available_figures": figs,
    }


def _table_exists(tname: str) -> bool:
    con = duckdb.connect(str(DB_PATH), read_only=True)
    try:
        tables = [r[0] for r in con.execute("SHOW TABLES").fetchall()]
        return tname in tables
    finally:
        con.close()


@app.get("/api/geojson/{layer_name}")
def get_geojson_layer(layer_name: str):
    if layer_name in _GEOJSON_CACHE:
        return JSONResponse(content=_GEOJSON_CACHE[layer_name])
    fpath = GEOJSON_PATHS.get(layer_name)
    if not fpath or not fpath.exists():
        raise HTTPException(status_code=404, detail=f"GeoJSON layer '{layer_name}' not found")
    gdf = gpd.read_file(fpath)
    # Simplify dense polygon/line geometries slightly for fast browser rendering
    if layer_name in ("cgwb_2011", "cgwb_2017", "cgwb_2020", "rivers", "commands_wfs", "aquifers"):
        gdf["geometry"] = gdf["geometry"].simplify(0.003, preserve_topology=True)
    # Enrich subbasins with 26-year mean metrics
    if layer_name == "subbasins":
        means = query_db("""
            SELECT subbasin_id,
                   ROUND(AVG(precip_mm), 1) AS mean_precip_mm,
                   ROUND(AVG(precip_bcm), 2) AS mean_precip_bcm,
                   ROUND(AVG(et_actual_total_bcm), 2) AS mean_et_total_bcm,
                   ROUND(AVG(et_blue_agri_bcm), 2) AS mean_et_blue_bcm,
                   ROUND(AVG(gw_withdrawal_total_bcm), 2) AS mean_gw_withdrawal_bcm,
                   ROUND(AVG(subbasin_outflow_bcm), 2) AS mean_outflow_bcm,
                   ROUND(AVG(gw_stage_of_development_pct), 1) AS gw_stage_pct
            FROM water_balance_annual
            WHERE subbasin_id != 'KRISHNA_BASIN' AND is_complete_year = TRUE
            GROUP BY subbasin_id
        """)
        df_m = pd.DataFrame(means)
        if not df_m.empty and "subbasin_id" in gdf.columns:
            gdf = gdf.merge(df_m, on="subbasin_id", how="left")
    data = json.loads(gdf.to_json())
    _GEOJSON_CACHE[layer_name] = data
    return JSONResponse(content=data)


@app.get("/api/download/{table_name}")
def download_table_csv(table_name: str):
    if not _table_exists(table_name):
        raise HTTPException(status_code=404, detail=f"Table '{table_name}' not found in DuckDB")
    con = duckdb.connect(str(DB_PATH), read_only=True)
    try:
        df = con.execute(f"SELECT * FROM {table_name}").df()
    finally:
        con.close()
    stream = io.StringIO()
    df.to_csv(stream, index=False)
    response = StreamingResponse(iter([stream.getvalue()]), media_type="text/csv")
    response.headers["Content-Disposition"] = f"attachment; filename={table_name}.csv"
    return response


DIST_DIR = ROOT / "11_Web_Application/frontend/dist"
if DIST_DIR.exists():
    app.mount("/", StaticFiles(directory=str(DIST_DIR), html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
