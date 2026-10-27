#!/usr/bin/env python3
"""
03_acquire_indiawris_wfs_and_stations.py
India-WRIS Primary Observations & WFS Data Engineering Pipeline
for the Krishna River Basin Hydrological Intelligence System.

Part A: Live India-WRIS WFS / ArcGIS REST Vector Layers (arc.indiawris.gov.in)
  - Hydrological_Data: Riverline_Krishna, River_Name_Krishna, WB_Krishna, Reservoir_Hydro, WSHED
  - Water_Resource_Project_Data: DAM, BWA, LIFT, CANAL, WRPCOMMAND, CCOMMAND, PH
  - Water_Information_Management_System_WIMS_data: WIMS_Station_1, Reservoir_Station,
    iw_reservoir_polygon, wq_stations, GroundwaterLevel_Station, RF_Station
  - Saves raw GeoJSON & GetCapabilities XMLs into 01_Raw_Data/India_WRIS_WFS/
  - Clips to the CWC Krishna Basin boundary (Basin_Code == '04') and saves standardized
    GeoJSONs, unified GeoPackage, and attribute CSV/Parquet summaries into
    02_Processed_Data/Infrastructure_and_Stations/

Part B: Live India-WRIS Station & District Time-Series REST API (indiawris.gov.in/Dataset/...)
  - Reservoir (CWC & APWRIMS, 2000-2025 multi-year chunks across all major Krishna reservoirs)
    + local State Wise Reservoir Report from 2020 to 2025.xlsx
  - River Water Discharge (CWC observed gauge discharge across 20 Krishna Basin districts)
  - Ground Water Level (CGWB observed well/piezometer water levels across 22 Krishna districts)
  - Evapo Transpiration (NRSC Vic MODEL daily ET across 21 Krishna districts)
  - RainFall (CWC observed rain gauge records across 21 Krishna districts)
  - Saves raw JSON responses into 01_Raw_Data/India_WRIS_TimeSeries/
  - Saves cleaned, deduplicated CSV/Parquet datasets & statistical summaries into
    02_Processed_Data/India_WRIS/ and 07_Time_Series/
"""

import os
import sys
import json
import time
import logging
import warnings
import concurrent.futures
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import pandas as pd
import numpy as np
import geopandas as gpd
from shapely.geometry import shape, box
from shapely.ops import unary_union

warnings.filterwarnings("ignore")

# ---------------------------------------------------------------------------
# Directory & Logging Setup
# ---------------------------------------------------------------------------
WORKSPACE_ROOT = Path("/run/media/clinton/24700DC6700D9FA2/Krishna River Basin")
RAW_WFS_DIR = WORKSPACE_ROOT / "01_Raw_Data" / "India_WRIS_WFS"
RAW_TS_DIR = WORKSPACE_ROOT / "01_Raw_Data" / "India_WRIS_TimeSeries"
PROC_INFRA_DIR = WORKSPACE_ROOT / "02_Processed_Data" / "Infrastructure_and_Stations"
PROC_WRIS_DIR = WORKSPACE_ROOT / "02_Processed_Data" / "India_WRIS"
TS_OUT_DIR = WORKSPACE_ROOT / "07_Time_Series"
LOG_DIR = WORKSPACE_ROOT / "13_Logs_Metadata"

for d in [RAW_WFS_DIR, RAW_TS_DIR, PROC_INFRA_DIR, PROC_WRIS_DIR, TS_OUT_DIR, LOG_DIR]:
    d.mkdir(parents=True, exist_ok=True)

LOG_FILE = LOG_DIR / "03_acquire_indiawris_wfs_and_stations.log"
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, mode="w"),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger("IndiaWRIS_Pipeline")

BASIN_GEOJSON_PATH = Path(
    "/run/media/clinton/24700DC6700D9FA2/Work_Research/WRIS/Data/"
    "Hydrological Layers/Central Water Commission Basin/"
    "Central Water Commission Basin.geojson"
)
SUBBASIN_GEOJSON_PATH = Path(
    "/run/media/clinton/24700DC6700D9FA2/Work_Research/WRIS/Data/"
    "Hydrological Layers/Central Water Commission Sub Basin/"
    "Central Water Commission Sub Basin.geojson"
)
LOCAL_RESERVOIR_EXCEL_PATH = Path(
    "/run/media/clinton/24700DC6700D9FA2/Work_Research/Well_Labs/WRIS/"
    "State Wise Reservoir Report from 2020 to 2025.xlsx"
)

KRISHNA_BBOX_STR = "73.3,13.0,81.5,19.5"


def make_session() -> requests.Session:
    """Create an HTTP session with automatic retry and connection pooling."""
    session = requests.Session()
    retry = Retry(
        total=4,
        read=4,
        connect=4,
        backoff_factor=1.0,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset(["GET", "POST"]),
    )
    adapter = HTTPAdapter(max_retries=retry, pool_connections=20, pool_maxsize=20)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    session.headers.update({"User-Agent": "KrishnaBasinHydrologicalIntelligence/1.0"})
    return session


# ---------------------------------------------------------------------------
# Load Krishna Basin Polygon (Basin_Code == '04')
# ---------------------------------------------------------------------------
def load_krishna_basin_boundary() -> Tuple[gpd.GeoDataFrame, Any]:
    """Load the CWC Krishna Basin boundary polygon (Basin_Code == '04')."""
    logger.info(f"Loading CWC Basin boundary from {BASIN_GEOJSON_PATH}")
    gdf = gpd.read_file(BASIN_GEOJSON_PATH)
    if gdf.crs is None:
        gdf = gdf.set_crs("EPSG:4326")
    else:
        gdf = gdf.to_crs("EPSG:4326")

    krishna_gdf = gdf[gdf["Basin_Code"].astype(str).str.strip() == "04"].copy()
    if krishna_gdf.empty:
        raise ValueError("Could not find Basin_Code == '04' in CWC Basin GeoJSON!")

    krishna_gdf["geometry"] = krishna_gdf.geometry.make_valid()
    krishna_geom = unary_union(krishna_gdf.geometry)
    logger.info(
        f"Loaded Krishna Basin (Basin_Code='04'): Area={krishna_gdf['Area_in_Sqkm'].values[0]:,.0f} sq.km, "
        f"Bounds={np.round(krishna_gdf.total_bounds, 4).tolist()}"
    )
    return krishna_gdf, krishna_geom


# ---------------------------------------------------------------------------
# PART A: Live India-WRIS WFS & ArcGIS REST Vector Layers
# ---------------------------------------------------------------------------
WFS_SERVICES = {
    "Hydrological_Data": "https://arc.indiawris.gov.in/server/services/HydrologicalData/Hydrological_Data/MapServer/WFSServer",
    "Water_Resource_Project_Data": "https://arc.indiawris.gov.in/server/services/DataDownload/Water_Resource_Project_Data/MapServer/WFSServer",
    "WIMS_data": "https://arc.indiawris.gov.in/server/services/DataDownload/Water_Information_Management_System_WIMS_data/MapServer/WFSServer",
}

REST_SERVICES = {
    "Hydrological_Data": "https://arc.indiawris.gov.in/server/rest/services/HydrologicalData/Hydrological_Data/MapServer",
    "Water_Resource_Project_Data": "https://arc.indiawris.gov.in/server/rest/services/DataDownload/Water_Resource_Project_Data/MapServer",
    "WIMS_data": "https://arc.indiawris.gov.in/server/rest/services/DataDownload/Water_Information_Management_System_WIMS_data/MapServer",
}

# Layer definitions:
# (key_name, service_key, layer_id, wfs_typename, where_clause, use_bbox, page_size, clip_mode)
# clip_mode: 'spatial' (clip/intersect with Krishna polygon) or 'attr_or_spatial'
VECTOR_LAYER_SPECS = [
    # 1. HydrologicalData
    (
        "Riverline_Krishna",
        "Hydrological_Data",
        28,
        "HydrologicalData_Hydrological_Data:Riverline_Krishna",
        "rivname <> ' ' OR ordsh >= 5",
        False,
        5000,
        "already_krishna",
    ),
    (
        "River_Name_Krishna",
        "Hydrological_Data",
        9,
        "HydrologicalData_Hydrological_Data:River_Name_Sept",
        "bacode = '04'",
        False,
        2000,
        "already_krishna",
    ),
    (
        "WB_Krishna",
        "Hydrological_Data",
        53,
        "HydrologicalData_Hydrological_Data:WB_Krishna",
        "wbname <> ' ' OR area_ha >= 10",
        False,
        1500,
        "already_krishna",
    ),
    (
        "Reservoir_Hydro",
        "Hydrological_Data",
        7,
        "HydrologicalData_Hydrological_Data:Reservoir_Hydro",
        "1=1",
        True,
        1000,
        "spatial",
    ),
    (
        "WSHED",
        "Hydrological_Data",
        3,
        "HydrologicalData_Hydrological_Data:WSHED",
        "bacode = '04'",
        False,
        100,
        "already_krishna",
    ),
    # 2. Water_Resource_Project_Data
    (
        "DAM",
        "Water_Resource_Project_Data",
        3,
        "DataDownload_Water_Resource_Project_Data:DAM",
        "1=1",
        True,
        2000,
        "spatial",
    ),
    (
        "BWA",
        "Water_Resource_Project_Data",
        1,
        "DataDownload_Water_Resource_Project_Data:BWA",
        "1=1",
        True,
        2000,
        "spatial",
    ),
    (
        "LIFT",
        "Water_Resource_Project_Data",
        2,
        "DataDownload_Water_Resource_Project_Data:LIFT",
        "1=1",
        True,
        2000,
        "spatial",
    ),
    (
        "CANAL",
        "Water_Resource_Project_Data",
        5,
        "DataDownload_Water_Resource_Project_Data:CANAL",
        "1=1",
        True,
        5000,
        "spatial",
    ),
    (
        "WRPCOMMAND",
        "Water_Resource_Project_Data",
        7,
        "DataDownload_Water_Resource_Project_Data:WRPCOMMAND",
        "1=1",
        True,
        200,
        "spatial",
    ),
    (
        "CCOMMAND",
        "Water_Resource_Project_Data",
        8,
        "DataDownload_Water_Resource_Project_Data:CCOMMAND",
        "1=1",
        True,
        250,
        "spatial",
    ),
    (
        "PH",
        "Water_Resource_Project_Data",
        0,
        "DataDownload_Water_Resource_Project_Data:PH",
        "1=1",
        True,
        1000,
        "spatial",
    ),
    # 3. Water_Information_Management_System_WIMS_data
    (
        "WIMS_Station_1",
        "WIMS_data",
        5,
        "DataDownload_Water_Information_Management_System_WIMS_data:WIMS_Station_1",
        "1=1",
        True,
        5000,
        "spatial",
    ),
    (
        "Reservoir_Station",
        "WIMS_data",
        3,
        "DataDownload_Water_Information_Management_System_WIMS_data:Reservoir_Station",
        "1=1",
        True,
        1000,
        "spatial",
    ),
    (
        "iw_reservoir_polygon",
        "WIMS_data",
        7,
        "DataDownload_Water_Information_Management_System_WIMS_data:iw_reservoir_polygon",
        "1=1",
        True,
        100,
        "spatial",
    ),
    (
        "wq_stations",
        "WIMS_data",
        6,
        "DataDownload_Water_Information_Management_System_WIMS_data:wq_stations",
        "1=1",
        True,
        5000,
        "spatial",
    ),
    (
        "GroundwaterLevel_Station",
        "WIMS_data",
        1,
        "DataDownload_Water_Information_Management_System_WIMS_data:GroundwaterLevel_Station",
        "1=1",
        True,
        5000,
        "spatial",
    ),
    (
        "RF_Station",
        "WIMS_data",
        4,
        "DataDownload_Water_Information_Management_System_WIMS_data:RF_Station",
        "1=1",
        True,
        5000,
        "spatial",
    ),
]


def save_wfs_capabilities(session: requests.Session) -> None:
    """Download and archive WFS 2.0.0 GetCapabilities XML documents for provenance."""
    for svc_name, wfs_url in WFS_SERVICES.items():
        out_xml = RAW_WFS_DIR / f"{svc_name}_WFS_GetCapabilities.xml"
        if out_xml.exists() and out_xml.stat().st_size > 500:
            logger.info(f"WFS GetCapabilities already cached: {out_xml.name}")
            continue
        try:
            r = session.get(
                wfs_url,
                params={"service": "WFS", "request": "GetCapabilities", "version": "2.0.0"},
                timeout=30,
            )
            if r.status_code == 200:
                out_xml.write_bytes(r.content)
                logger.info(f"Saved WFS 2.0.0 GetCapabilities: {out_xml.name} ({len(r.content):,} bytes)")
        except Exception as e:
            logger.warning(f"Failed WFS GetCapabilities for {svc_name}: {e}")


def fetch_arcgis_layer_geojson(
    session: requests.Session,
    key_name: str,
    svc_key: str,
    layer_id: int,
    where_clause: str,
    use_bbox: bool,
    page_size: int,
) -> Path:
    """Download an entire vector layer from India-WRIS ArcGIS REST service as RFC 7946 GeoJSON."""
    raw_path = RAW_WFS_DIR / f"{svc_key}_{key_name}_raw.geojson"
    if raw_path.exists() and raw_path.stat().st_size > 200:
        logger.info(f"[Raw Cache Hit] {raw_path.name} ({raw_path.stat().st_size / 1e6:.2f} MB)")
        return raw_path

    base_url = f"{REST_SERVICES[svc_key]}/{layer_id}/query"
    base_params = {
        "where": where_clause,
        "outFields": "*",
        "outSR": "4326",
    }
    if use_bbox:
        base_params.update(
            {
                "geometry": KRISHNA_BBOX_STR,
                "geometryType": "esriGeometryEnvelope",
                "inSR": "4326",
                "spatialRel": "esriSpatialRelIntersects",
            }
        )

    # First query count
    cnt_params = dict(base_params, returnCountOnly="true", f="json")
    r_cnt = session.get(base_url, params=cnt_params, timeout=30)
    total_count = r_cnt.json().get("count", 0)
    logger.info(f"Downloading {svc_key}/{key_name} (Layer {layer_id}): target count = {total_count:,}")

    all_features = []
    offset = 0
    cur_page_size = page_size
    while True:
        page_params = dict(
            base_params,
            resultOffset=offset,
            resultRecordCount=cur_page_size,
            f="geojson",
        )
        t0 = time.time()
        try:
            r = session.get(base_url, params=page_params, timeout=90)
            r.raise_for_status()
            js = r.json()
        except Exception as e:
            if cur_page_size > 25:
                cur_page_size = max(25, cur_page_size // 2)
                logger.warning(
                    f"  [{key_name}] Payload error at offset {offset} ({e}); reducing page_size to {cur_page_size} and retrying..."
                )
                continue
            raise
        feats = js.get("features", [])
        all_features.extend(feats)
        logger.info(
            f"  [{key_name}] Fetched offset {offset:,} -> +{len(feats):,} features "
            f"(accumulated {len(all_features):,}/{total_count:,}) in {time.time() - t0:.2f}s"
        )
        if len(feats) < cur_page_size or (total_count and len(all_features) >= total_count):
            break
        offset += len(feats)

    fc = {"type": "FeatureCollection", "features": all_features}
    with open(raw_path, "w", encoding="utf-8") as f:
        json.dump(fc, f)
    logger.info(f"Saved raw GeoJSON: {raw_path.name} ({len(all_features):,} features, {raw_path.stat().st_size / 1e6:.2f} MB)")
    return raw_path


def run_part_a_wfs_pipeline(
    session: requests.Session, krishna_gdf: gpd.GeoDataFrame, krishna_geom: Any
) -> pd.DataFrame:
    """Execute Part A: Download, clip, standardize, and package all India-WRIS WFS/REST layers."""
    logger.info("=" * 75)
    logger.info("STARTING PART A: INDIA-WRIS WFS & ARCGIS REST VECTOR ACQUISITION")
    logger.info("=" * 75)

    save_wfs_capabilities(session)

    gpkg_path = PROC_INFRA_DIR / "krishna_indiawris_infrastructure_and_stations.gpkg"
    if not gpkg_path.exists():
        krishna_gdf.to_file(gpkg_path, layer="krishna_basin_boundary", driver="GPKG")

        if SUBBASIN_GEOJSON_PATH.exists():
            sb_gdf = gpd.read_file(SUBBASIN_GEOJSON_PATH).to_crs("EPSG:4326")
            sb_krishna = sb_gdf[sb_gdf["Basin_Code"].astype(str).str.strip() == "04"].copy()
            if not sb_krishna.empty:
                sb_krishna.to_file(PROC_INFRA_DIR / "CWC_SubBasins_Krishna.geojson", driver="GeoJSON")
                sb_krishna.to_file(gpkg_path, layer="cwc_subbasins_krishna", driver="GPKG")
                logger.info(f"Saved {len(sb_krishna)} CWC Krishna Sub-Basins to GeoJSON & GeoPackage.")

    summary_rows = []

    for key_name, svc_key, layer_id, wfs_typename, where_clause, use_bbox, page_size, clip_mode in VECTOR_LAYER_SPECS:
        t0 = time.time()
        out_geojson = PROC_INFRA_DIR / f"Krishna_{key_name}.geojson"
        out_csv = PROC_INFRA_DIR / f"Krishna_{key_name}_attributes.csv"
        out_parquet = PROC_INFRA_DIR / f"Krishna_{key_name}_attributes.parquet"
        raw_path = RAW_WFS_DIR / f"{svc_key}_{key_name}_raw.geojson"

        if raw_path.exists() and out_geojson.exists() and out_csv.exists() and out_parquet.exists():
            attr_df = pd.read_csv(out_csv, low_memory=False)
            with open(raw_path, "r", encoding="utf-8") as rf:
                raw_cnt = len(json.load(rf).get("features", []))
            logger.info(f"[Processed Cache Hit] {key_name}: raw={raw_cnt:,}, clipped={len(attr_df):,}")
            summary_rows.append(
                {
                    "layer_key": key_name,
                    "service": svc_key,
                    "layer_id": layer_id,
                    "wfs_typename": wfs_typename,
                    "where_filter": where_clause,
                    "raw_bbox_features": raw_cnt,
                    "krishna_basin_features": len(attr_df),
                    "geometry_types": "Cached",
                    "processed_geojson": str(out_geojson),
                    "attributes_csv": str(out_csv),
                }
            )
            continue

        raw_path = fetch_arcgis_layer_geojson(
            session, key_name, svc_key, layer_id, where_clause, use_bbox, page_size
        )
        gdf = gpd.read_file(raw_path)
        raw_count = len(gdf)
        if raw_count == 0:
            logger.warning(f"Layer {key_name} returned 0 features!")
            continue

        if gdf.crs is None:
            gdf = gdf.set_crs("EPSG:4326")
        else:
            gdf = gdf.to_crs("EPSG:4326")

        # Clean invalid geometries before clipping
        gdf = gdf[gdf.geometry.notnull() & ~gdf.geometry.is_empty].copy()
        gdf["geometry"] = gdf.geometry.make_valid()

        if clip_mode == "already_krishna":
            clipped = gdf.copy()
        elif clip_mode == "wshed_krishna":
            if "bacode" in gdf.columns:
                clipped = gdf[gdf["bacode"].astype(str).str.strip() == "04"].copy()
            else:
                clipped = gdf[gdf.intersects(krishna_geom)].copy()
        else:
            spatial_mask = gdf.intersects(krishna_geom)
            attr_mask = pd.Series(False, index=gdf.index)
            for col in ["bacode", "basin", "basin_code"]:
                if col in gdf.columns:
                    attr_mask |= gdf[col].astype(str).str.strip() == "04"
            for col in ["basin_name", "basincwc", "ba_name"]:
                if col in gdf.columns:
                    attr_mask |= gdf[col].astype(str).str.contains("Krishna", case=False, na=False)
            clipped = gdf[spatial_mask | attr_mask].copy()

            geom_types = set(clipped.geom_type.unique())
            if geom_types.intersection({"LineString", "MultiLineString", "Polygon", "MultiPolygon"}):
                try:
                    clipped["geometry"] = clipped.geometry.intersection(krishna_geom)
                    clipped = clipped[~clipped.geometry.is_empty & clipped.geometry.notnull()].copy()
                except Exception as e:
                    logger.warning(f"Intersection fallback for {key_name}: {e}")

        clipped_count = len(clipped)
        rename_map = {}
        for col in clipped.columns:
            if col == "geometry":
                continue
            clean_col = col.replace(".", "_").replace("(", "_").replace(")", "").replace(" ", "_")
            if clean_col != col:
                rename_map[col] = clean_col
        if rename_map:
            clipped = clipped.rename(columns=rename_map)

        clipped.to_file(out_geojson, driver="GeoJSON")
        clipped.to_file(gpkg_path, layer=key_name.lower(), driver="GPKG")

        attr_df = pd.DataFrame(clipped.drop(columns="geometry"))
        for c in attr_df.select_dtypes(include=["object"]).columns:
            attr_df[c] = attr_df[c].astype(str).replace({"None": None, "nan": None})
        attr_df.to_csv(out_csv, index=False)
        attr_df.to_parquet(out_parquet, index=False)

        geom_type_str = ", ".join(sorted(clipped.geom_type.unique()))
        elapsed = time.time() - t0
        logger.info(
            f"Processed {key_name}: raw={raw_count:,} -> krishna_clipped={clipped_count:,} ({geom_type_str}) in {elapsed:.1f}s"
        )
        summary_rows.append(
            {
                "layer_key": key_name,
                "service": svc_key,
                "layer_id": layer_id,
                "wfs_typename": wfs_typename,
                "where_filter": where_clause,
                "raw_bbox_features": raw_count,
                "krishna_basin_features": clipped_count,
                "geometry_types": geom_type_str,
                "processed_geojson": str(out_geojson),
                "attributes_csv": str(out_csv),
            }
        )

    summary_df = pd.DataFrame(summary_rows)
    summary_df.to_csv(PROC_INFRA_DIR / "indiawris_wfs_layers_inventory.csv", index=False)
    summary_df.to_csv(PROC_WRIS_DIR / "indiawris_wfs_layers_inventory.csv", index=False)
    logger.info(f"Completed Part A: {len(summary_df)} vector layers saved to {gpkg_path}")
    return summary_df


# ---------------------------------------------------------------------------
# PART B: Live India-WRIS Station & District Time-Series REST API
# ---------------------------------------------------------------------------

# 1. Reservoir queries: (stateName, districtName, agencyName)
RESERVOIR_DISTRICT_QUERIES = [
    # Maharashtra (Upper Krishna & Bhima)
    ("Maharashtra", "Satara", "CWC"),      # Koyna/Shivaji Sagar, Dhom, Kanher, Urmodi, Veer
    ("Maharashtra", "Solapur", "CWC"),     # Bhima/Ujjani Reservoir
    ("Maharashtra", "Pune", "CWC"),        # Khadakwasla, Mulshi, Panshet, Bhatghar, Chaskaman, Bhama Askhed, Dimbhe, Manikdoh, Niradevghar, Thokarwadi
    ("Maharashtra", "Kolhapur", "CWC"),    # Dudhganga
    # Karnataka (Upper/Middle Krishna, Ghataprabha, Malaprabha, Tungabhadra, Bhadra, Vedavati)
    ("Karnataka", "Bagalkote", "CWC"),     # Almatti Reservoir
    ("Karnataka", "Vijayapura", "CWC"),    # Narayanapura Reservoir
    ("Karnataka", "Belagavi", "CWC"),      # GhatPrabha/Hidkal Reservoir, Malaprabha Reservoir
    ("Karnataka", "Koppal", "CWC"),        # Tungabhadra Reservoir
    ("Karnataka", "Chikkamagaluru", "CWC"),# Bhadra Reservoir
    ("Karnataka", "Chitradurga", "CWC"),   # Vanivilasa Sagar
    # Telangana (Middle/Lower Krishna & Musi)
    ("Telangana", "Jogulamba Gadwal", "CWC"), # Priyadarshini Jurala
    ("Telangana", "Nalgonda", "CWC"),         # Nagarjuna Sagar, Musi Project
    ("Telangana", "Suryapet", "APWRIMS"),     # Pulichinthala Project
    ("Telangana", "Nagarkurnool", "APWRIMS"), # Srisailam R (APWRIMS telemetry)
    # Andhra Pradesh (Lower Krishna & Kurnool)
    ("Andhra Pradesh", "Kurnool", "CWC"),     # Srisailam Reservoir (CWC)
    ("Andhra Pradesh", "Kurnool", "APWRIMS"), # Sunkesula Barrage, Gajuladinne Project
    ("Andhra Pradesh", "Krishna", "APWRIMS"), # Prakasam Barrage
]

RESERVOIR_YEAR_CHUNKS = [
    ("2000-01-01", "2004-12-31"),
    ("2005-01-01", "2009-12-31"),
    ("2010-01-01", "2014-12-31"),
    ("2015-01-01", "2019-12-31"),
    ("2020-01-01", "2025-03-31"),
]

# 2. River Water Discharge queries (CWC)
DISCHARGE_DISTRICTS = [
    ("Maharashtra", "Pune"),
    ("Maharashtra", "Satara"),
    ("Maharashtra", "Sangli"),
    ("Maharashtra", "Kolhapur"),
    ("Maharashtra", "Solapur"),
    ("Karnataka", "Belgaum"),
    ("Karnataka", "Bagalkote"),
    ("Karnataka", "Bijapur"),
    ("Karnataka", "Raichur"),
    ("Karnataka", "Ballari"),
    ("Karnataka", "Davanagere"),
    ("Karnataka", "Shivamogga"),
    ("Karnataka", "Kalaburagi"),
    ("Karnataka", "Yadgir"),
    ("Telangana", "Nalgonda"),
    ("Telangana", "Suryapet"),
    ("Telangana", "Khammam"),
    ("Andhra Pradesh", "Kurnool"),
    ("Andhra Pradesh", "Krishna"),
    ("Andhra Pradesh", "Guntur"),
]

# 3. Ground Water Level queries (CGWB)
GW_DISTRICTS = [
    ("Maharashtra", "Pune"),
    ("Maharashtra", "Satara"),
    ("Maharashtra", "Sangli"),
    ("Maharashtra", "Kolhapur"),
    ("Maharashtra", "Solapur"),
    ("Karnataka", "Belgaum"),
    ("Karnataka", "Bagalkote"),
    ("Karnataka", "Bijapur"),
    ("Karnataka", "Raichur"),
    ("Karnataka", "Koppal"),
    ("Karnataka", "Ballari"),
    ("Karnataka", "Davanagere"),
    ("Karnataka", "Shivamogga"),
    ("Karnataka", "Kalaburagi"),
    ("Karnataka", "Yadgir"),
    ("Telangana", "Mahbubnagar"),
    ("Telangana", "Nalgonda"),
    ("Telangana", "Khammam"),
    ("Telangana", "Ranga Reddy"),
    ("Andhra Pradesh", "Kurnool"),
    ("Andhra Pradesh", "Krishna"),
    ("Andhra Pradesh", "Guntur"),
]

# 4. Evapo Transpiration queries (NRSC Vic MODEL)
ET_DISTRICTS = [
    ("Maharashtra", "Pune"),
    ("Maharashtra", "Satara"),
    ("Maharashtra", "Sangli"),
    ("Maharashtra", "Kolhapur"),
    ("Maharashtra", "Solapur"),
    ("Karnataka", "Belagavi"),
    ("Karnataka", "Bagalkote"),
    ("Karnataka", "Vijayapura"),
    ("Karnataka", "Raichur"),
    ("Karnataka", "Koppal"),
    ("Karnataka", "Ballari"),
    ("Karnataka", "Shivamogga"),
    ("Karnataka", "Kalaburagi"),
    ("Karnataka", "Yadgir"),
    ("Telangana", "Mahabubnagar"),
    ("Telangana", "Nalgonda"),
    ("Telangana", "Khammam"),
    ("Telangana", "Ranga Reddy"),
    ("Andhra Pradesh", "Kurnool"),
    ("Andhra Pradesh", "Krishna"),
    ("Andhra Pradesh", "Guntur"),
]

# 5. RainFall queries (CWC)
RAINFALL_DISTRICTS = [
    ("Maharashtra", "Pune"),
    ("Maharashtra", "Satara"),
    ("Maharashtra", "Sangli"),
    ("Maharashtra", "Kolhapur"),
    ("Maharashtra", "Solapur"),
    ("Karnataka", "Belgaum"),
    ("Karnataka", "Bagalkote"),
    ("Karnataka", "Bijapur"),
    ("Karnataka", "Raichur"),
    ("Karnataka", "Ballari"),
    ("Karnataka", "Davanagere"),
    ("Karnataka", "Shivamogga"),
    ("Karnataka", "Kalaburagi"),
    ("Karnataka", "Yadgir"),
    ("Telangana", "Mahbubnagar"),
    ("Telangana", "Nalgonda"),
    ("Telangana", "Khammam"),
    ("Telangana", "Ranga Reddy"),
    ("Andhra Pradesh", "Kurnool"),
    ("Andhra Pradesh", "Krishna"),
    ("Andhra Pradesh", "Guntur"),
]


def fetch_wris_dataset_chunk(
    endpoint_slug: str,
    state: str,
    district: str,
    agency: str,
    startdate: str,
    enddate: str,
    max_pages: int = 3,
    page_size: int = 1000,
) -> List[Dict[str, Any]]:
    """Fetch records from https://indiawris.gov.in/Dataset/<endpoint_slug> with local JSON caching."""
    safe_ep = endpoint_slug.replace("%20", "_").replace(" ", "_")
    safe_st = state.replace(" ", "_")
    safe_dt = district.replace(" ", "_")
    safe_ag = agency.replace(" ", "_")
    cache_file = RAW_TS_DIR / f"{safe_ep}_{safe_ag}_{safe_st}_{safe_dt}_{startdate}_{enddate}.json"

    if cache_file.exists() and cache_file.stat().st_size > 10:
        try:
            with open(cache_file, "r", encoding="utf-8") as f:
                cached = json.load(f)
            return cached.get("data", [])
        except Exception:
            pass

    session = make_session()
    url = f"https://indiawris.gov.in/Dataset/{endpoint_slug}"
    records: List[Dict[str, Any]] = []

    for page in range(max_pages):
        params = {
            "stateName": state,
            "districtName": district,
            "agencyName": agency,
            "startdate": startdate,
            "enddate": enddate,
            "download": "false",
            "page": page,
            "size": page_size,
        }
        try:
            r = session.post(
                url,
                params=params,
                headers={"Accept": "application/json", "Content-Type": "application/json"},
                timeout=35,
            )
            if r.status_code != 200:
                break
            js = r.json()
            batch = js.get("data") or []
            records.extend(batch)
            if len(batch) < page_size:
                break
        except Exception as e:
            logger.warning(f"API error [{safe_ep} {state}/{district} {startdate}..{enddate} p{page}]: {e}")
            break

    with open(cache_file, "w", encoding="utf-8") as f:
        json.dump(
            {
                "endpoint": endpoint_slug,
                "stateName": state,
                "districtName": district,
                "agencyName": agency,
                "startdate": startdate,
                "enddate": enddate,
                "recordCount": len(records),
                "data": records,
            },
            f,
        )
    return records


def run_part_b_timeseries_pipeline() -> Dict[str, pd.DataFrame]:
    """Execute Part B: Parallel acquisition and processing of all 5 India-WRIS REST time-series datasets."""
    logger.info("=" * 75)
    logger.info("STARTING PART B: INDIA-WRIS REST TIME-SERIES OBSERVATIONS (2000-2025)")
    logger.info("=" * 75)

    results: Dict[str, pd.DataFrame] = {}

    # -----------------------------------------------------------------------
    # B0. Extract local State Wise Reservoir Report from 2020 to 2025.xlsx
    # -----------------------------------------------------------------------
    if LOCAL_RESERVOIR_EXCEL_PATH.exists():
        logger.info(f"Extracting local Excel report: {LOCAL_RESERVOIR_EXCEL_PATH}")
        raw_xl = pd.read_excel(LOCAL_RESERVOIR_EXCEL_PATH)
        # First row contains headers: ['State / UTs', 'No Of Reservoirs', 'Average Current Storage (BCM)']
        headers = [str(c).strip() for c in raw_xl.iloc[0].values]
        df_xl = raw_xl.iloc[1:].copy()
        df_xl.columns = headers
        df_xl["No Of Reservoirs"] = pd.to_numeric(df_xl["No Of Reservoirs"], errors="coerce")
        df_xl["Average Current Storage (BCM)"] = pd.to_numeric(
            df_xl["Average Current Storage (BCM)"], errors="coerce"
        )
        df_xl.to_csv(PROC_WRIS_DIR / "local_wris_state_reservoir_report_2020_2025.csv", index=False)
        df_xl.to_csv(TS_OUT_DIR / "local_wris_state_reservoir_report_2020_2025.csv", index=False)
        logger.info(f"Saved local reservoir report ({len(df_xl)} state rows).")

    # -----------------------------------------------------------------------
    # B1. Reservoir Time Series (2000-2025)
    # -----------------------------------------------------------------------
    logger.info("Acquiring B1: Reservoir Storage Time Series (2000-2025)...")
    res_tasks = []
    for st, dt, ag in RESERVOIR_DISTRICT_QUERIES:
        for sdate, edate in RESERVOIR_YEAR_CHUNKS:
            # Up to 4 pages per 5-year chunk so multi-reservoir districts (Pune, Satara, Belagavi) are captured
            res_tasks.append(("Reservoir", st, dt, ag, sdate, edate, 4))

    res_records = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
        futs = {
            ex.submit(fetch_wris_dataset_chunk, ep, st, dt, ag, sd, ed, mp): (st, dt, ag, sd, ed)
            for ep, st, dt, ag, sd, ed, mp in res_tasks
        }
        for fut in concurrent.futures.as_completed(futs):
            st, dt, ag, sd, ed = futs[fut]
            recs = fut.result()
            res_records.extend(recs)
            if recs:
                logger.info(f"  [Reservoir] {st}/{dt} ({ag}) {sd}..{ed}: +{len(recs):,} records")

    df_res = pd.DataFrame(res_records)
    if not df_res.empty:
        df_res["date"] = pd.to_datetime(df_res["date"], errors="coerce")
        df_res["currentLiveStorage_BMC"] = pd.to_numeric(df_res["currentLiveStorage_BMC"], errors="coerce")
        if "level_m" in df_res.columns:
            df_res["level_m"] = pd.to_numeric(df_res["level_m"], errors="coerce")
        df_res = df_res.drop_duplicates(
            subset=["agencyName", "stateName", "districtName", "reservoirName", "date"]
        ).sort_values(["stateName", "reservoirName", "date"])

        df_res.to_csv(PROC_WRIS_DIR / "krishna_reservoir_storage_daily_2000_2025.csv", index=False)
        df_res.to_parquet(PROC_WRIS_DIR / "krishna_reservoir_storage_daily_2000_2025.parquet", index=False)
        df_res.to_csv(TS_OUT_DIR / "krishna_reservoir_storage_daily_2000_2025.csv", index=False)
        df_res.to_parquet(TS_OUT_DIR / "krishna_reservoir_storage_daily_2000_2025.parquet", index=False)

        # Build Reservoir Summary Table joined with FRL & Design Live Capacity from WIMS Reservoir_Station
        res_summary = (
            df_res.groupby(["stateName", "districtName", "agencyName", "reservoirName"], as_index=False)
            .agg(
                obs_count=("currentLiveStorage_BMC", "count"),
                start_date=("date", "min"),
                end_date=("date", "max"),
                mean_live_storage_bcm=("currentLiveStorage_BMC", "mean"),
                median_live_storage_bcm=("currentLiveStorage_BMC", "median"),
                max_observed_storage_bcm=("currentLiveStorage_BMC", "max"),
                p90_storage_bcm=("currentLiveStorage_BMC", lambda x: np.nanpercentile(x, 90)),
                p10_storage_bcm=("currentLiveStorage_BMC", lambda x: np.nanpercentile(x, 10)),
            )
            .sort_values("max_observed_storage_bcm", ascending=False)
        )
        res_summary.to_csv(PROC_WRIS_DIR / "krishna_reservoir_storage_summary.csv", index=False)
        res_summary.to_csv(TS_OUT_DIR / "krishna_reservoir_storage_summary.csv", index=False)
        results["Reservoir"] = df_res
        logger.info(
            f"Saved Reservoir Time Series: {len(df_res):,} observations across "
            f"{df_res['reservoirName'].nunique()} reservoirs."
        )

    # -----------------------------------------------------------------------
    # B2. River Water Discharge (CWC)
    # -----------------------------------------------------------------------
    logger.info("Acquiring B2: CWC River Water Discharge Time Series...")
    q_tasks = []
    for st, dt in DISCHARGE_DISTRICTS:
        for sdate, edate in [("2005-01-01", "2014-12-31"), ("2015-01-01", "2025-03-31")]:
            q_tasks.append(("River%20Water%20Discharge", st, dt, "CWC", sdate, edate, 2))

    q_records = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
        futs = {
            ex.submit(fetch_wris_dataset_chunk, ep, st, dt, ag, sd, ed, mp): (st, dt, sd, ed)
            for ep, st, dt, ag, sd, ed, mp in q_tasks
        }
        for fut in concurrent.futures.as_completed(futs):
            st, dt, sd, ed = futs[fut]
            recs = fut.result()
            q_records.extend(recs)
            if recs:
                logger.info(f"  [Discharge] {st}/{dt} {sd}..{ed}: +{len(recs):,} records")

    df_q = pd.DataFrame(q_records)
    if not df_q.empty:
        df_q["dataTime"] = pd.to_datetime(df_q["dataTime"], errors="coerce")
        df_q["dataValue"] = pd.to_numeric(df_q["dataValue"], errors="coerce")
        df_q = df_q.drop_duplicates(subset=["stationCode", "dataTime", "datatypeCode"]).sort_values(
            ["state", "district", "stationName", "dataTime"]
        )
        df_q.to_csv(PROC_WRIS_DIR / "krishna_cwc_river_discharge_observations.csv", index=False)
        df_q.to_parquet(PROC_WRIS_DIR / "krishna_cwc_river_discharge_observations.parquet", index=False)
        df_q.to_csv(TS_OUT_DIR / "krishna_cwc_river_discharge_observations.csv", index=False)
        df_q.to_parquet(TS_OUT_DIR / "krishna_cwc_river_discharge_observations.parquet", index=False)

        q_summary = (
            df_q.groupby(
                ["state", "district", "stationCode", "stationName", "majorBasin", "tributary", "latitude", "longitude", "unit"],
                dropna=False,
                as_index=False,
            )
            .agg(
                obs_count=("dataValue", "count"),
                start_time=("dataTime", "min"),
                end_time=("dataTime", "max"),
                mean_discharge_m3s=("dataValue", "mean"),
                median_discharge_m3s=("dataValue", "median"),
                p95_discharge_m3s=("dataValue", lambda x: np.nanpercentile(x, 95)),
                max_discharge_m3s=("dataValue", "max"),
            )
            .sort_values("max_discharge_m3s", ascending=False)
        )
        q_summary.to_csv(PROC_WRIS_DIR / "krishna_cwc_river_discharge_station_summary.csv", index=False)
        q_summary.to_csv(TS_OUT_DIR / "krishna_cwc_river_discharge_station_summary.csv", index=False)
        results["Discharge"] = df_q
        logger.info(
            f"Saved CWC River Discharge: {len(df_q):,} observations across "
            f"{df_q['stationCode'].nunique()} stations."
        )

    # -----------------------------------------------------------------------
    # B3. Ground Water Level (CGWB)
    # -----------------------------------------------------------------------
    logger.info("Acquiring B3: CGWB Ground Water Level Time Series...")
    gw_tasks = []
    for st, dt in GW_DISTRICTS:
        for sdate, edate in [("2015-01-01", "2020-12-31"), ("2021-01-01", "2025-03-31")]:
            gw_tasks.append(("Ground%20Water%20Level", st, dt, "CGWB", sdate, edate, 1))

    gw_records = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
        futs = {
            ex.submit(fetch_wris_dataset_chunk, ep, st, dt, ag, sd, ed, mp): (st, dt, sd, ed)
            for ep, st, dt, ag, sd, ed, mp in gw_tasks
        }
        for fut in concurrent.futures.as_completed(futs):
            st, dt, sd, ed = futs[fut]
            recs = fut.result()
            gw_records.extend(recs)
            if recs:
                logger.info(f"  [GroundWater] {st}/{dt} {sd}..{ed}: +{len(recs):,} records")

    df_gw = pd.DataFrame(gw_records)
    if not df_gw.empty:
        df_gw["dataTime"] = pd.to_datetime(df_gw["dataTime"], errors="coerce")
        df_gw["dataValue"] = pd.to_numeric(df_gw["dataValue"], errors="coerce")
        df_gw = df_gw.drop_duplicates(subset=["stationCode", "dataTime"]).sort_values(
            ["state", "district", "stationName", "dataTime"]
        )
        df_gw.to_csv(PROC_WRIS_DIR / "krishna_cgwb_groundwater_level_observations.csv", index=False)
        df_gw.to_parquet(PROC_WRIS_DIR / "krishna_cgwb_groundwater_level_observations.parquet", index=False)
        df_gw.to_csv(TS_OUT_DIR / "krishna_cgwb_groundwater_level_observations.csv", index=False)
        df_gw.to_parquet(TS_OUT_DIR / "krishna_cgwb_groundwater_level_observations.parquet", index=False)

        gw_dist_summary = (
            df_gw.groupby(["state", "district"], as_index=False)
            .agg(
                obs_count=("dataValue", "count"),
                unique_wells=("stationCode", "nunique"),
                start_time=("dataTime", "min"),
                end_time=("dataTime", "max"),
                mean_depth_mbgl=("dataValue", "mean"),
                median_depth_mbgl=("dataValue", "median"),
                p90_depth_mbgl=("dataValue", lambda x: np.nanpercentile(x, 90)),
                max_depth_mbgl=("dataValue", "max"),
            )
            .sort_values(["state", "district"])
        )
        gw_dist_summary.to_csv(PROC_WRIS_DIR / "krishna_cgwb_groundwater_district_summary.csv", index=False)
        gw_dist_summary.to_csv(TS_OUT_DIR / "krishna_cgwb_groundwater_district_summary.csv", index=False)
        results["GroundWater"] = df_gw
        logger.info(
            f"Saved CGWB Ground Water Level: {len(df_gw):,} observations across "
            f"{df_gw['stationCode'].nunique()} wells in {df_gw['district'].nunique()} districts."
        )

    # -----------------------------------------------------------------------
    # B4. Evapo Transpiration (NRSC Vic MODEL)
    # -----------------------------------------------------------------------
    logger.info("Acquiring B4: NRSC VIC Model Evapotranspiration Time Series...")
    et_tasks = []
    for st, dt in ET_DISTRICTS:
        for sdate, edate in [("2015-01-01", "2020-12-31"), ("2021-01-01", "2025-03-31")]:
            et_tasks.append(("Evapo%20Transpiration", st, dt, "NRSC Vic MODEL", sdate, edate, 2))

    et_records = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
        futs = {
            ex.submit(fetch_wris_dataset_chunk, ep, st, dt, ag, sd, ed, mp): (st, dt, sd, ed)
            for ep, st, dt, ag, sd, ed, mp in et_tasks
        }
        for fut in concurrent.futures.as_completed(futs):
            st, dt, sd, ed = futs[fut]
            recs = fut.result()
            et_records.extend(recs)
            if recs:
                logger.info(f"  [EvapoTranspiration] {st}/{dt} {sd}..{ed}: +{len(recs):,} records")

    df_et = pd.DataFrame(et_records)
    if not df_et.empty:
        df_et["date"] = pd.to_datetime(df_et["date"], errors="coerce")
        df_et["dataValue"] = pd.to_numeric(df_et["dataValue"], errors="coerce")
        df_et = df_et.drop_duplicates(subset=["stateName", "districtName", "date"]).sort_values(
            ["stateName", "districtName", "date"]
        )
        df_et.to_csv(PROC_WRIS_DIR / "krishna_nrsc_vic_evapotranspiration_daily.csv", index=False)
        df_et.to_parquet(PROC_WRIS_DIR / "krishna_nrsc_vic_evapotranspiration_daily.parquet", index=False)
        df_et.to_csv(TS_OUT_DIR / "krishna_nrsc_vic_evapotranspiration_daily.csv", index=False)
        df_et.to_parquet(TS_OUT_DIR / "krishna_nrsc_vic_evapotranspiration_daily.parquet", index=False)

        et_summary = (
            df_et.groupby(["stateName", "districtName"], as_index=False)
            .agg(
                obs_days=("dataValue", "count"),
                start_date=("date", "min"),
                end_date=("date", "max"),
                mean_daily_et_mm=("dataValue", "mean"),
                est_annual_et_mm=("dataValue", lambda x: np.nanmean(x) * 365.25),
                max_daily_et_mm=("dataValue", "max"),
            )
            .sort_values(["stateName", "districtName"])
        )
        et_summary.to_csv(PROC_WRIS_DIR / "krishna_nrsc_vic_evapotranspiration_summary.csv", index=False)
        et_summary.to_csv(TS_OUT_DIR / "krishna_nrsc_vic_evapotranspiration_summary.csv", index=False)
        results["EvapoTranspiration"] = df_et
        logger.info(
            f"Saved NRSC VIC Model ET: {len(df_et):,} daily district records across "
            f"{df_et['districtName'].nunique()} districts."
        )

    # -----------------------------------------------------------------------
    # B5. RainFall (CWC Stations)
    # -----------------------------------------------------------------------
    logger.info("Acquiring B5: CWC Rainfall Station Observations...")
    rf_tasks = []
    for st, dt in RAINFALL_DISTRICTS:
        for sdate, edate in [("2018-01-01", "2021-12-31"), ("2022-01-01", "2025-03-31")]:
            rf_tasks.append(("RainFall", st, dt, "CWC", sdate, edate, 1))

    rf_records = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
        futs = {
            ex.submit(fetch_wris_dataset_chunk, ep, st, dt, ag, sd, ed, mp): (st, dt, sd, ed)
            for ep, st, dt, ag, sd, ed, mp in rf_tasks
        }
        for fut in concurrent.futures.as_completed(futs):
            st, dt, sd, ed = futs[fut]
            recs = fut.result()
            rf_records.extend(recs)
            if recs:
                logger.info(f"  [RainFall CWC] {st}/{dt} {sd}..{ed}: +{len(recs):,} records")

    df_rf = pd.DataFrame(rf_records)
    if not df_rf.empty:
        df_rf["dataTime"] = pd.to_datetime(df_rf["dataTime"], errors="coerce")
        df_rf["dataValue"] = pd.to_numeric(df_rf["dataValue"], errors="coerce")
        df_rf = df_rf.drop_duplicates(subset=["stationCode", "dataTime"]).sort_values(
            ["state", "district", "stationName", "dataTime"]
        )
        df_rf.to_csv(PROC_WRIS_DIR / "krishna_cwc_rainfall_station_observations.csv", index=False)
        df_rf.to_parquet(PROC_WRIS_DIR / "krishna_cwc_rainfall_station_observations.parquet", index=False)
        df_rf.to_csv(TS_OUT_DIR / "krishna_cwc_rainfall_station_observations.csv", index=False)
        df_rf.to_parquet(TS_OUT_DIR / "krishna_cwc_rainfall_station_observations.parquet", index=False)

        rf_summary = (
            df_rf.groupby(
                ["state", "district", "stationCode", "stationName", "tributary", "latitude", "longitude"],
                dropna=False,
                as_index=False,
            )
            .agg(
                obs_count=("dataValue", "count"),
                start_time=("dataTime", "min"),
                end_time=("dataTime", "max"),
                mean_rain_mm=("dataValue", "mean"),
                max_daily_rain_mm=("dataValue", "max"),
                rainy_days_gt_2p5mm=("dataValue", lambda x: int((x >= 2.5).sum())),
            )
            .sort_values("max_daily_rain_mm", ascending=False)
        )
        rf_summary.to_csv(PROC_WRIS_DIR / "krishna_cwc_rainfall_station_summary.csv", index=False)
        rf_summary.to_csv(TS_OUT_DIR / "krishna_cwc_rainfall_station_summary.csv", index=False)
        results["RainFall"] = df_rf
        logger.info(
            f"Saved CWC Rainfall Observations: {len(df_rf):,} observations across "
            f"{df_rf['stationCode'].nunique()} stations."
        )

    return results


def main() -> None:
    t_start = time.time()
    session = make_session()
    krishna_gdf, krishna_geom = load_krishna_basin_boundary()

    wfs_summary_df = run_part_a_wfs_pipeline(session, krishna_gdf, krishna_geom)
    ts_results = run_part_b_timeseries_pipeline()

    # Write overall execution manifest JSON
    manifest = {
        "script": "03_acquire_indiawris_wfs_and_stations.py",
        "completed_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "elapsed_seconds": round(time.time() - t_start, 2),
        "part_a_vector_layers": wfs_summary_df.to_dict(orient="records"),
        "part_b_timeseries_counts": {k: len(v) for k, v in ts_results.items()},
    }
    manifest_path = LOG_DIR / "03_indiawris_wfs_and_stations_manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, default=str)

    logger.info("=" * 75)
    logger.info(f"PIPELINE COMPLETE in {time.time() - t_start:.1f}s! Manifest: {manifest_path}")
    logger.info("=" * 75)


if __name__ == "__main__":
    main()
