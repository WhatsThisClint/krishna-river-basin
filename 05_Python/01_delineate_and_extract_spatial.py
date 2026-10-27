#!/usr/bin/env python3
"""
Stage 2 & Stage 3: Physical Basin Delineation, Sub-Basin Connectivity, and Spatial Dataset Extraction
Krishna River Basin Autonomous Hydrological Intelligence and Water Accounting System
"""

import os
import json
import shutil
import warnings
from pathlib import Path
import numpy as np
import pandas as pd
import geopandas as gpd
import rasterio
from rasterio.mask import mask
from shapely.geometry import mapping, box

warnings.filterwarnings("ignore")

ROOT = Path("/run/media/clinton/24700DC6700D9FA2/Krishna River Basin")
WRIS_DATA = Path("/run/media/clinton/24700DC6700D9FA2/Work_Research/WRIS/Data")

RAW_DIR = ROOT / "01_Raw_Data" / "WRIS_Local"
PROC_DIR = ROOT / "02_Processed_Data"
BOUND_DIR = PROC_DIR / "Boundaries"
HYDRO_DIR = PROC_DIR / "Hydrogeology_and_GW"
INFRA_DIR = PROC_DIR / "Infrastructure_and_Waterbodies"
ECOL_DIR = PROC_DIR / "Ecology_and_LULC"
RASTER_DIR = PROC_DIR / "Rasters"
QGIS_LAYERS = ROOT / "03_QGIS" / "Layers"
META_DIR = ROOT / "13_Logs_Metadata"

for d in [RAW_DIR, BOUND_DIR, HYDRO_DIR, INFRA_DIR, ECOL_DIR, RASTER_DIR, QGIS_LAYERS, META_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# Canonical Sub-Basin Mapping and Upstream-Downstream Topological DAG
SUBBASIN_META = {
    "Krishna Upper": {
        "subbasin_id": "KRI_UPPER",
        "code": "04_KU",
        "name": "Krishna Upper",
        "downstream_id": "KRI_MIDDLE",
        "tributary_system": "Mainstem Upper Krishna (Koyna, Warna, Panchganga, Dudhganga, Ghataprabha, Malaprabha)",
        "states": "Maharashtra, Karnataka",
        "stream_order_rank": 1,
        "key_reservoirs": "Koyna, Dhom, Kanher, Warna, Radhanagari, Hidkal (Ghataprabha), Naviluteertha (Malaprabha), Almatti, Narayanpur",
        "interbasin_notes": "Westward hydropower diversion from Koyna Dam to Pophali/Konkan (~1.95 BCM/yr export to Arabian Sea)"
    },
    "Bhima Upper": {
        "subbasin_id": "BHI_UPPER",
        "code": "04_BU",
        "name": "Bhima Upper",
        "downstream_id": "BHI_LOWER",
        "tributary_system": "Upper Bhima (Mula-Mutha, Pavana, Indrayani, Ghod, Kukadi, Nira, Man)",
        "states": "Maharashtra",
        "stream_order_rank": 1,
        "key_reservoirs": "Mulshi, Pawna, Khadakwasla, Panshet, Warasgaon, Chasakman, Bhama Askhed, Yedgaon, Bhatghar, Nira Deoghar, Vir, Ujjani",
        "interbasin_notes": "Westward Tata Power hydropower diversion from Mulshi/Andhra (~0.42 BCM/yr export); major Pune Metro urban/industrial hub"
    },
    "Bhima Lower": {
        "subbasin_id": "BHI_LOWER",
        "code": "04_BL",
        "name": "Bhima Lower",
        "downstream_id": "KRI_MIDDLE",
        "tributary_system": "Lower Bhima (Sina, Bori, Amarja, Kagna)",
        "states": "Maharashtra, Karnataka, Telangana",
        "stream_order_rank": 2,
        "key_reservoirs": "Sina, Bori, Amarja, Kagna, Bhima Lift Irrigation (Sannati)",
        "interbasin_notes": "Receives regulated Ujjani outflow and Sina inter-subbasin link; joins Krishna mainstem near Kadlur (Raichur/Yadgir)"
    },
    "Krishna Middle": {
        "subbasin_id": "KRI_MIDDLE",
        "code": "04_KM",
        "name": "Krishna Middle",
        "downstream_id": "KRI_LOWER",
        "tributary_system": "Middle Krishna Mainstem (Narayanpur to Srisailam backwaters, Peddavagu, Dindi upstream)",
        "states": "Karnataka, Telangana",
        "stream_order_rank": 3,
        "key_reservoirs": "Priyadarshini Jurala, Koilsagar, Ramanpad, Narayanpur Left/Right Bank Command",
        "interbasin_notes": "Receives KRI_UPPER (Narayanpur releases) and BHI_LOWER (Bhima confluence); feeds Kalwakurthy/Nettempadu/Bhima lifts"
    },
    "Tungabhadra Upper": {
        "subbasin_id": "TUN_UPPER",
        "code": "04_TU",
        "name": "Tungabhadra Upper",
        "downstream_id": "TUN_LOWER",
        "tributary_system": "Upper Tungabhadra (Tunga, Bhadra, Kumudvathi, Varada, Haridra)",
        "states": "Karnataka",
        "stream_order_rank": 1,
        "key_reservoirs": "Bhadra, Gajanur (Tunga), Singatalur, Tungabhadra Dam (Hospet)",
        "interbasin_notes": "High-rainfall Western Ghats headwaters (Agumbe/Kudremukh); Upper Bhadra lift project transfers toward Vedavathi"
    },
    "Tungabhadra Lower": {
        "subbasin_id": "TUN_LOWER",
        "code": "04_TL",
        "name": "Tungabhadra Lower",
        "downstream_id": "KRI_LOWER",
        "tributary_system": "Lower Tungabhadra (Vedavathi/Hagari, Chikka Hagari, Handri)",
        "states": "Karnataka, Andhra Pradesh, Telangana",
        "stream_order_rank": 2,
        "key_reservoirs": "Vanivilasa Sagar, Sunkesula Barrage, Rajolibanda Diversion (RDS), Gajuladinne, Gollapalli/HNSS storage",
        "interbasin_notes": "Semi-arid rain-shadow core; exports via Tungabhadra HLC/LLC and Handri-Neeva Sujala Sravanti (HNSS) toward Pennar/Rayalaseema"
    },
    "Krishna Lower": {
        "subbasin_id": "KRI_LOWER",
        "code": "04_KL",
        "name": "Krishna Lower",
        "downstream_id": "BAY_OF_BENGAL",
        "tributary_system": "Lower Krishna & Delta (Dindi, Musi, Halia, Palair, Munneru, Wyra, Kattaleru)",
        "states": "Telangana, Andhra Pradesh",
        "stream_order_rank": 4,
        "key_reservoirs": "Srisailam, Nagarjuna Sagar, Pulichintala (K.L. Rao Sagar), Prakasam Barrage, Osmansagar, Himayatsagar, Musi, Palair, Wyra",
        "interbasin_notes": "Exports via Pothireddypadu/SRBC/Telugu Ganga to Pennar/Chennai (~2.2-3.5 BCM/yr); imports Godavari water via Pattiseema Lift into Prakasam Barrage since 2015-16 (~1.5-3.0 BCM/yr); includes Hyderabad Metro & Musi wastewater return flows"
    }
}

print("Step 1: Extracting CWC Krishna Basin and 7 Sub-Basins...")
basin_src = WRIS_DATA / "Hydrological Layers/Central Water Commission Basin/Central Water Commission Basin.geojson"
subbasin_src = WRIS_DATA / "Hydrological Layers/Central Water Commission Sub Basin/Central Water Commission Sub Basin.geojson"

shutil.copy2(basin_src, RAW_DIR / "CWC_Basin_Raw.geojson")
shutil.copy2(subbasin_src, RAW_DIR / "CWC_SubBasin_Raw.geojson")

gdf_basin_all = gpd.read_file(basin_src)
gdf_basin = gdf_basin_all[gdf_basin_all["Basin_Code"] == "04"].copy()
gdf_basin = gdf_basin.to_crs("EPSG:4326")
# Equal-area projection for accurate area calculation (EPSG:7755 India NSF LCC)
gdf_basin_metric = gdf_basin.to_crs("EPSG:7755")
gdf_basin["gis_area_km2"] = (gdf_basin_metric.geometry.area / 1e6).round(2)
gdf_basin["official_cwc_area_km2"] = 258948.0
gdf_basin["basin_id"] = "KRISHNA_BASIN"

gdf_sb_all = gpd.read_file(subbasin_src)
gdf_sb = gdf_sb_all[gdf_sb_all["Basin_Code"] == "04"].copy()
gdf_sb = gdf_sb.to_crs("EPSG:4326")
gdf_sb_metric = gdf_sb.to_crs("EPSG:7755")
gdf_sb["gis_area_km2"] = (gdf_sb_metric.geometry.area / 1e6).round(2)
gdf_sb["perimeter_km"] = (gdf_sb_metric.geometry.length / 1e3).round(2)

# Enrich with canonical metadata
for col in ["subbasin_id", "code", "downstream_id", "tributary_system", "states", "stream_order_rank", "key_reservoirs", "interbasin_notes"]:
    gdf_sb[col] = gdf_sb["Sub_Basin"].map(lambda x: SUBBASIN_META.get(x, {}).get(col, ""))

# Centroids in WGS84
centroids = gdf_sb_metric.geometry.centroid.to_crs("EPSG:4326")
gdf_sb["centroid_lon"] = centroids.x.round(4)
gdf_sb["centroid_lat"] = centroids.y.round(4)
gdf_sb = gdf_sb.sort_values("stream_order_rank").reset_index(drop=True)

# Save Boundaries
gdf_basin.to_file(BOUND_DIR / "krishna_basin_boundary.geojson", driver="GeoJSON")
gdf_basin.to_file(QGIS_LAYERS / "krishna_basin_boundary.gpkg", driver="GPKG")
gdf_sb.to_file(BOUND_DIR / "krishna_subbasins_cwc.geojson", driver="GeoJSON")
gdf_sb.to_file(QGIS_LAYERS / "krishna_subbasins_cwc.gpkg", driver="GPKG")

print(f"Saved Krishna Basin ({gdf_basin['gis_area_km2'].iloc[0]:,.2f} km2 GIS, 258,948 km2 CWC official) and {len(gdf_sb)} CWC Sub-Basins:")
print(gdf_sb[["subbasin_id", "Sub_Basin", "gis_area_km2", "downstream_id", "states"]].to_string(index=False))

basin_geom_4326 = gdf_basin.geometry.union_all()
basin_gdf_metric = gdf_basin.to_crs("EPSG:7755")[["basin_id", "geometry"]]
sb_gdf_metric = gdf_sb.to_crs("EPSG:7755")[["subbasin_id", "Sub_Basin", "gis_area_km2", "geometry"]]

def clip_and_save(rel_path, out_name, out_dir, layer_desc, keep_cols=None):
    src = WRIS_DATA / rel_path
    if not src.exists():
        print(f"  [SKIP] {rel_path} not found")
        return None
    try:
        gdf = gpd.read_file(src)
        if gdf.crs is None:
            gdf = gdf.set_crs("EPSG:4326")
        # Reproject basin geometry to source CRS for fast spatial indexing
        basin_in_src = gdf_basin.to_crs(gdf.crs).geometry.union_all()
        sidx = gdf.sindex
        possible_idx = list(sidx.intersection(basin_in_src.bounds))
        gdf_sub = gdf.iloc[possible_idx].copy()
        gdf_sub["geometry"] = gdf_sub.geometry.make_valid()
        clipped = gpd.clip(gdf_sub, basin_in_src)
        clipped = clipped[~clipped.geometry.is_empty & clipped.geometry.notna()].copy()
        clipped = clipped.to_crs("EPSG:4326")
        if keep_cols:
            cols = [c for c in keep_cols if c in clipped.columns] + ["geometry"]
            clipped = clipped[cols]
        # Spatial join with subbasin centroids/polygons to tag subbasin_id
        clipped_metric = clipped.to_crs("EPSG:7755")
        rep_pts = clipped_metric.copy()
        rep_pts["geometry"] = rep_pts.geometry.representative_point()
        joined = gpd.sjoin(rep_pts[["geometry"]], sb_gdf_metric[["subbasin_id", "Sub_Basin", "geometry"]], how="left", predicate="within")
        joined = joined[~joined.index.duplicated(keep="first")]
        clipped["subbasin_id"] = joined["subbasin_id"]
        clipped["subbasin_name"] = joined["Sub_Basin"]

        out_geojson = out_dir / f"{out_name}.geojson"
        out_gpkg = QGIS_LAYERS / f"{out_name}.gpkg"
        clipped.to_file(out_geojson, driver="GeoJSON")
        clipped.to_file(out_gpkg, driver="GPKG")
        print(f"  [OK] {out_name}: {len(clipped):,} features ({layer_desc})")
        return clipped
    except Exception as e:
        print(f"  [ERR] {out_name}: {e}")
        return None

print("\nStep 2: Clipping Administrative, Ecological, Aquifer, and Infrastructure Layers...")
states_krishna = clip_and_save("Administrative Boundary/State Boundary/State Boundary.geojson", "krishna_states", BOUND_DIR, "Riparian States in Krishna Basin")
districts_krishna = clip_and_save("Administrative Boundary/District Boundary/District Boundary.geojson", "krishna_districts", BOUND_DIR, "Districts intersecting Krishna Basin")
towns_krishna = clip_and_save("Administrative Boundary/Census Town 2011/Census Town 2011.geojson", "krishna_urban_centres", BOUND_DIR, "Census 2011 Urban Centres & Demand Hubs")
dhq_krishna = clip_and_save("Administrative Boundary/District Headquarter/District Headquarter.geojson", "krishna_district_hq", BOUND_DIR, "District Headquarters")

agro_clim = clip_and_save("Ecology & Climate Zone/Agro Climatic Regions/Agro Climatic Regions.geojson", "krishna_agro_climatic_zones", ECOL_DIR, "Agro-Climatic Regions")
agro_eco = clip_and_save("Ecology & Climate Zone/Agro Ecological Sub Regions/Agro Ecological Sub Regions.geojson", "krishna_agro_ecological_subregions", ECOL_DIR, "Agro-Ecological Sub-Regions")
imd_grid = clip_and_save("Ecology & Climate Zone/Rainfall Point Two Five Degree Grid/Rainfall Point Two Five Degree Grid.geojson", "krishna_imd_025_grid", ECOL_DIR, "IMD 0.25x0.25 Degree Rainfall Grid")
imd_stations = clip_and_save("Probable Maximum Precipitation Incomplete/IMD_Station/IMD_Station.geojson", "krishna_imd_stations", ECOL_DIR, "IMD Meteorological Stations")

aquifers_krishna = clip_and_save("Aquifer & Litholog/Major Aquifers/Major_Aquifers.shp", "krishna_major_aquifers", HYDRO_DIR, "CGWB Major Aquifer Systems")
aquif_mat_krishna = clip_and_save("Aquifer & Litholog/Aquifer Material/Aquif_Mat.shp", "krishna_aquifer_material", HYDRO_DIR, "Principal Aquifer Material")
litho_wells = clip_and_save("Aquifer & Litholog/Litholog/LITHOLOG.shp", "krishna_cgwb_lithologs", HYDRO_DIR, "CGWB Borehole Lithologs")

ibtl_links = clip_and_save("Inter Basin Transfer Link/All Interbasin link/Link_All.shp", "krishna_interbasin_links", INFRA_DIR, "Inter-Basin Water Transfer Links")
ibtl_res = clip_and_save("Inter Basin Transfer Link/Reservoir WaterBody/Reservoir_WaterBody.shp", "krishna_interbasin_reservoirs", INFRA_DIR, "Inter-Basin Link Reservoirs")
ibtl_struct = clip_and_save("Inter Basin Transfer Link/Structure on Links/Structure.shp", "krishna_interbasin_structures", INFRA_DIR, "Inter-Basin Link Headworks & Structures")

ars_id = clip_and_save("Artificial Recharge Structure/Artificial recharge structures Identified/ARS_Identified.shp", "krishna_ars_identified", INFRA_DIR, "Artificial Recharge Structures Identified")
ars_comp = clip_and_save("Artificial Recharge Structure/Artificial recharge structures - Districtwise - Completed/ARS_District_Completed.shp", "krishna_ars_completed_district", INFRA_DIR, "Completed Artificial Recharge Structures by District")

print("\nStep 3: Processing Multi-Epoch CGWB Groundwater Resource Assessment Units (2011, 2013, 2017, 2020)...")
gw_epochs = {
    2011: "Ground Water Resource Estimation/Ground Water Resource AU2011/GWR_AU2011.shp",
    2013: "Ground Water Resource Estimation/Ground Water Resource AU2013/GWR_AU2013.shp",
    2017: "Ground Water Resource Estimation/Ground Water Resource AU2017/GWR_AU2017.shp",
    2020: "Ground Water Resource Estimation/Ground Water Resource AU2020/GWR_AU2020.shp",
}

gw_summary_rows = []
for yr, rel in gw_epochs.items():
    gdf_gw = clip_and_save(rel, f"krishna_cgwb_gwr_au_{yr}", HYDRO_DIR, f"CGWB Groundwater Assessment Units {yr}")
    if gdf_gw is not None and len(gdf_gw) > 0:
        # Calculate intersection area fraction with original block polygon area (st_area_sh is in m2)
        gdf_gw_m = gdf_gw.to_crs("EPSG:7755")
        clipped_area_m2 = gdf_gw_m.geometry.area
        orig_area_m2 = pd.to_numeric(gdf_gw.get("st_area_sh", clipped_area_m2), errors="coerce").fillna(clipped_area_m2)
        weight = np.clip(clipped_area_m2 / np.where(orig_area_m2 > 0, orig_area_m2, clipped_area_m2), 0.0, 1.0)
        gdf_gw["area_weight"] = weight

        # Note: CGWB values in GWR_AU shapefiles are in hectare-meters (ham). 100,000 ham = 1 BCM (1000 MCM).
        for col in ["Annual_Rep", "Natural_Di", "Net_Annual", "Annual_Gro", "Annual_G00", "Annual_G01", "Stage_of_G"]:
            if col in gdf_gw.columns:
                gdf_gw[col] = pd.to_numeric(gdf_gw[col], errors="coerce").fillna(0.0)

        for sb_id, grp in gdf_gw.groupby("subbasin_id"):
            w = grp["area_weight"]
            repl_bcm = (grp["Annual_Rep"] * w).sum() / 100000.0
            nat_dis_bcm = (grp["Natural_Di"] * w).sum() / 100000.0
            net_avail_bcm = (grp["Net_Annual"] * w).sum() / 100000.0
            irr_draft_bcm = (grp["Annual_Gro"] * w).sum() / 100000.0
            dom_ind_draft_bcm = (grp["Annual_G00"] * w).sum() / 100000.0
            tot_draft_bcm = (grp["Annual_G01"] * w).sum() / 100000.0
            stage_pct = (tot_draft_bcm / net_avail_bcm * 100.0) if net_avail_bcm > 0 else grp["Stage_of_G"].mean()
            classes = grp["CLASS"].astype(str).str.lower()
            gw_summary_rows.append({
                "assessment_year": yr,
                "subbasin_id": sb_id,
                "num_assessment_units": len(grp),
                "replenishable_recharge_bcm": round(repl_bcm, 4),
                "natural_discharge_bcm": round(nat_dis_bcm, 4),
                "net_gw_availability_bcm": round(net_avail_bcm, 4),
                "irrigation_gw_draft_bcm": round(irr_draft_bcm, 4),
                "dom_ind_gw_draft_bcm": round(dom_ind_draft_bcm, 4),
                "total_gw_draft_bcm": round(tot_draft_bcm, 4),
                "stage_of_gw_development_pct": round(stage_pct, 2),
                "safe_units": int(classes.str.contains("safe").sum()),
                "semi_critical_units": int(classes.str.contains("semi").sum()),
                "critical_units": int((classes.str.contains("critical") & ~classes.str.contains("semi")).sum()),
                "over_exploited_units": int(classes.str.contains("over").sum()),
                "saline_units": int(classes.str.contains("saline").sum()),
            })

df_gw_epochs = pd.DataFrame(gw_summary_rows)
if not df_gw_epochs.empty:
    # Add Basin totals per epoch
    basin_rows = []
    for yr, grp in df_gw_epochs.groupby("assessment_year"):
        net_av = grp["net_gw_availability_bcm"].sum()
        tot_dr = grp["total_gw_draft_bcm"].sum()
        basin_rows.append({
            "assessment_year": yr,
            "subbasin_id": "KRISHNA_BASIN",
            "num_assessment_units": int(grp["num_assessment_units"].sum()),
            "replenishable_recharge_bcm": round(grp["replenishable_recharge_bcm"].sum(), 4),
            "natural_discharge_bcm": round(grp["natural_discharge_bcm"].sum(), 4),
            "net_gw_availability_bcm": round(net_av, 4),
            "irrigation_gw_draft_bcm": round(grp["irrigation_gw_draft_bcm"].sum(), 4),
            "dom_ind_gw_draft_bcm": round(grp["dom_ind_gw_draft_bcm"].sum(), 4),
            "total_gw_draft_bcm": round(tot_dr, 4),
            "stage_of_gw_development_pct": round(tot_dr / net_av * 100.0 if net_av > 0 else 0.0, 2),
            "safe_units": int(grp["safe_units"].sum()),
            "semi_critical_units": int(grp["semi_critical_units"].sum()),
            "critical_units": int(grp["critical_units"].sum()),
            "over_exploited_units": int(grp["over_exploited_units"].sum()),
            "saline_units": int(grp["saline_units"].sum()),
        })
    df_gw_epochs = pd.concat([df_gw_epochs, pd.DataFrame(basin_rows)], ignore_index=True)
    df_gw_epochs.to_csv(HYDRO_DIR / "cgwb_groundwater_epochs_summary.csv", index=False)
    print("Saved CGWB Groundwater Multi-Epoch Summary (2011, 2013, 2017, 2020):")
    print(df_gw_epochs[df_gw_epochs["subbasin_id"] == "KRISHNA_BASIN"].to_string(index=False))

print("\nStep 4: Summarizing Aquifer Hydrogeological Properties by Sub-Basin...")
if aquifers_krishna is not None and not aquifers_krishna.empty:
    aq_m = aquifers_krishna.to_crs("EPSG:7755")
    aq_inter = gpd.overlay(aq_m, sb_gdf_metric, how="intersection")
    aq_inter["area_km2"] = aq_inter.geometry.area / 1e6
    # Map specific yield midpoint from CGWB range strings
    def parse_sy(val):
        s = str(val).replace("%", "").strip()
        if "-" in s:
            parts = [float(p) for p in s.split("-") if p.strip().replace(".", "").isdigit()]
            if len(parts) == 2:
                return np.mean(parts) / 100.0
        try:
            return float(s) / 100.0
        except Exception:
            return 0.02  # default hard-rock Sy = 2%

    aq_inter["sy_fraction"] = aq_inter["yeild__"].map(parse_sy)
    aq_summary = (
        aq_inter.groupby(["subbasin_id_2", "aquifer", "aquifer0"])
        .agg(
            area_km2=("area_km2", "sum"),
            mean_sy=("sy_fraction", "mean"),
            weathered_zone_m=("zone_m", "first"),
            fracture_depth_mbgl=("mbgl", "first"),
            transmissivity_m2_day=("m2_perday", "first"),
            ec_salinity_us_cm=("per_cm", "first"),
        )
        .reset_index()
        .rename(columns={"subbasin_id_2": "subbasin_id"})
    )
    aq_summary["area_km2"] = aq_summary["area_km2"].round(2)
    aq_summary.to_csv(HYDRO_DIR / "krishna_aquifer_properties_by_subbasin.csv", index=False)

    # Also compute area-weighted composite Specific Yield (Sy) per subbasin
    sb_sy = (
        aq_inter.groupby("subbasin_id_2")
        .apply(lambda g: np.average(g["sy_fraction"], weights=g["area_km2"]) if g["area_km2"].sum() > 0 else 0.02)
        .reset_index(name="composite_specific_yield")
        .rename(columns={"subbasin_id_2": "subbasin_id"})
    )
    sb_sy.to_csv(HYDRO_DIR / "krishna_subbasin_specific_yield.csv", index=False)
    print("Sub-basin composite Specific Yield (Sy):")
    print(sb_sy.to_string(index=False))

print("\nStep 5: Extracting District Water Body Atlas (Census of Minor Waterbodies, Ponds, Tanks, Check Dams)...")
dwa_files = [
    ("Maharashtra Ph1", "District Water Body Atlas/DWA Waterbodies Ph1 for Maharashtra/DWA_WB_Ph1_Maharashtra.shp"),
    ("Maharashtra Ph2", "District Water Body Atlas/DWA Waterbodies Ph2 for Maharashtra/DWA_WB_Ph2_Maharashtra.shp"),
    ("Karnataka Ph1", "District Water Body Atlas/DWA Waterbodies Ph1 for Karnataka/DWA_WB_Ph1_Karnataka.shp"),
    ("Karnataka Ph2", "District Water Body Atlas/DWA Waterbodies Ph2 for Karnataka/DWA_WB_Ph2_Karnataka.shp"),
    ("Telangana Ph1", "District Water Body Atlas/DWA Waterbodies Ph1 for Telangana/DWA_WB_Ph1_Telangana.shp"),
    ("Telangana Ph2", "District Water Body Atlas/DWA Waterbodies Ph2 for Telangana/DWA_WB_Ph2_Telangana.shp"),
    ("Andhra Pradesh Ph1", "District Water Body Atlas/DWA Waterbodies Ph1 for Andhra Pradesh/DWA_WB_Ph1_Andhra_Pradesh.shp"),
    ("Andhra Pradesh Ph2", "District Water Body Atlas/DWA Waterbodies Ph2 for Andhra Pradesh/DWA_WB_Ph2_Andhra_Pradesh.shp"),
]

dwa_dfs = []
for label, rel in dwa_files:
    src = WRIS_DATA / rel
    if not src.exists():
        continue
    try:
        gdf_dwa = gpd.read_file(src)
        # Filter by basin attribute if available, plus spatial clip
        if "basin" in gdf_dwa.columns:
            kr_mask = gdf_dwa["basin"].astype(str).str.contains("krishna", case=False, na=False)
            if kr_mask.sum() > 0:
                gdf_dwa = gdf_dwa[kr_mask].copy()
        basin_in_src = gdf_basin.to_crs(gdf_dwa.crs).geometry.union_all()
        sidx = gdf_dwa.sindex
        idx = list(sidx.intersection(basin_in_src.bounds))
        gdf_dwa = gdf_dwa.iloc[idx].copy()
        gdf_dwa = gdf_dwa[gdf_dwa.geometry.notna() & ~gdf_dwa.geometry.is_empty].to_crs("EPSG:4326")
        gdf_dwa = gdf_dwa[gdf_dwa.geometry.intersects(basin_geom_4326)].copy()
        gdf_dwa["source_phase"] = label
        dwa_dfs.append(gdf_dwa)
        print(f"  DWA {label}: {len(gdf_dwa):,} waterbodies in Krishna Basin")
    except Exception as e:
        print(f"  [ERR] DWA {label}: {e}")

if dwa_dfs:
    gdf_dwa_all = pd.concat(dwa_dfs, ignore_index=True)
    gdf_dwa_all = gpd.GeoDataFrame(gdf_dwa_all, geometry="geometry", crs="EPSG:4326")
    # Tag subbasin
    pts_m = gdf_dwa_all.to_crs("EPSG:7755").copy()
    pts_m["geometry"] = pts_m.geometry.representative_point()
    j_dwa = gpd.sjoin(pts_m[["geometry"]], sb_gdf_metric[["subbasin_id", "Sub_Basin", "geometry"]], how="left", predicate="within")
    j_dwa = j_dwa[~j_dwa.index.duplicated(keep="first")]
    gdf_dwa_all["subbasin_id"] = j_dwa["subbasin_id"]
    gdf_dwa_all["subbasin_name"] = j_dwa["Sub_Basin"]

    # Save full polygon layer to GeoPackage and lightweight centroid points to GeoJSON for Web App
    gdf_dwa_all.to_file(QGIS_LAYERS / "krishna_dwa_waterbodies_census.gpkg", driver="GPKG")
    dwa_pts = gdf_dwa_all.copy()
    dwa_pts["geometry"] = dwa_pts.geometry.centroid
    keep_c = [c for c in ["wbid", "state", "district", "subdistric", "village", "subbasin_id", "subbasin_name", "waterbody_", "waterbod_1", "ownership", "water_spre", "storage_ca", "gis_area", "apr22", "nov22", "apr23", "nov23", "source_phase", "geometry"] if c in dwa_pts.columns]
    dwa_pts[keep_c].to_file(INFRA_DIR / "krishna_dwa_waterbodies_points.geojson", driver="GeoJSON")

    for num_c in ["water_spre", "storage_ca", "gis_area", "apr22", "nov22", "apr23", "nov23"]:
        if num_c in gdf_dwa_all.columns:
            gdf_dwa_all[num_c] = pd.to_numeric(gdf_dwa_all[num_c], errors="coerce").fillna(0.0)

    dwa_summary = (
        gdf_dwa_all.groupby(["subbasin_id", "state", "waterbody_"])
        .agg(
            count=("geometry", "count"),
            total_gis_area_ha=("gis_area", "sum"),
            total_waterspread_ha=("water_spre", "sum"),
            total_storage_capacity_m3=("storage_ca", "sum"),
            mean_apr22_ha=("apr22", "mean"),
            mean_nov22_ha=("nov22", "mean"),
            mean_apr23_ha=("apr23", "mean"),
            mean_nov23_ha=("nov23", "mean"),
        )
        .reset_index()
    )
    dwa_summary.to_csv(INFRA_DIR / "krishna_dwa_waterbodies_summary.csv", index=False)
    print(f"Saved {len(gdf_dwa_all):,} mapped waterbodies across the Krishna Basin!")

print("\nStep 6: Clipping Rasters and Computing Zonal Statistics per Sub-Basin...")
raster_files = [
    ("lulc250k_0506", "Land Use Land Cover/LULC 250k 2005-2006/LULC 250k 2005-2006/LULC 250k 0506/lulc250k_0506.tif", "categorical"),
    ("land_degradation_1516", "Land Degradation/Land Degradation 2015 2016/ldd1516.tif", "categorical"),
    ("forest_fsi_2019", "Forest Layer/Forest FSI 2019/Forest_FSI_2019.tif", "categorical"),
    ("hillshade_90m", "Hillshade/Hillshade/HILLSHADE_90.tif", "continuous"),
]

zonal_rows = []
for r_name, rel_p, r_type in raster_files:
    r_src = WRIS_DATA / rel_p
    if not r_src.exists():
        print(f"  [SKIP] Raster {rel_p} not found")
        continue
    try:
        with rasterio.open(r_src) as src:
            basin_in_r = gdf_basin.to_crs(src.crs)
            out_img, out_transform = mask(src, [mapping(g) for g in basin_in_r.geometry], crop=True)
            out_meta = src.meta.copy()
            out_meta.update({
                "driver": "GTiff",
                "height": out_img.shape[1],
                "width": out_img.shape[2],
                "transform": out_transform,
                "compress": "lzw"
            })
            out_tif = RASTER_DIR / f"krishna_{r_name}.tif"
            with rasterio.open(out_tif, "w", **out_meta) as dest:
                dest.write(out_img)
            shutil.copy2(out_tif, QGIS_LAYERS / f"krishna_{r_name}.tif")
            print(f"  [OK] Clipped raster: krishna_{r_name}.tif ({out_img.shape[2]}x{out_img.shape[1]})")

            # Zonal statistics per sub-basin
            sb_in_r = gdf_sb.to_crs(src.crs)
            for _, row in sb_in_r.iterrows():
                sb_img, _ = mask(src, [mapping(row.geometry)], crop=True)
                arr = sb_img[0]
                valid = arr[(arr != src.nodata) & (arr > 0)] if src.nodata is not None else arr[arr > 0]
                if len(valid) == 0:
                    continue
                if r_type == "categorical":
                    vals, counts = np.unique(valid, return_counts=True)
                    tot_px = counts.sum()
                    for v, c in zip(vals, counts):
                        zonal_rows.append({
                            "raster_name": r_name,
                            "subbasin_id": row["subbasin_id"],
                            "class_or_stat": f"class_{int(v)}",
                            "pixel_count": int(c),
                            "fraction_pct": round(float(c) / float(tot_px) * 100.0, 3)
                        })
                else:
                    zonal_rows.append({
                        "raster_name": r_name,
                        "subbasin_id": row["subbasin_id"],
                        "class_or_stat": "mean",
                        "pixel_count": int(len(valid)),
                        "fraction_pct": round(float(np.mean(valid)), 3)
                    })
                    zonal_rows.append({
                        "raster_name": r_name,
                        "subbasin_id": row["subbasin_id"],
                        "class_or_stat": "std",
                        "pixel_count": int(len(valid)),
                        "fraction_pct": round(float(np.std(valid)), 3)
                    })
    except Exception as e:
        print(f"  [ERR] Raster {r_name}: {e}")

if zonal_rows:
    pd.DataFrame(zonal_rows).to_csv(ECOL_DIR / "krishna_raster_zonal_stats.csv", index=False)
    print(f"Saved {len(zonal_rows)} raster zonal statistics rows.")

print("\nStage 2 & 3 Local Spatial Extraction Complete!")
