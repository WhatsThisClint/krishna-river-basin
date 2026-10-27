import offlineData from "./offlineDb.json";

const db = offlineData as Record<string, any>;

/**
 * Sanitizes Sankey data to break cyclical feedback loops, ensuring strict DAG compliance for ECharts
 */
function sanitizeSankeyData(data: any) {
  if (!data || !data.nodes || !data.links || !data.links.length) return data;
  const nodes = [...data.nodes.map((n: any) => ({ ...n }))];
  const links = data.links.map((l: any) => {
    const c = { ...l };
    if (c.source === "Domestic & Industrial Supply" && c.target === "Surface Water & Reservoirs") {
      c.target = "Wastewater Return Flow";
    }
    if (c.source === "Groundwater Irrigation Draft" && c.target === "Groundwater Aquifer") {
      c.target = "Irrigation Return to Aquifer";
    }
    if (c.source === "Surface Irrigation Withdrawal" && c.target === "Groundwater Aquifer") {
      c.target = "Canal Seepage & Deep Percolation";
    }
    return c;
  });
  const names = new Set(nodes.map((n: any) => n.name));
  links.forEach((l: any) => {
    if (!names.has(l.target)) {
      nodes.push({ name: l.target });
      names.add(l.target);
    }
    if (!names.has(l.source)) {
      nodes.push({ name: l.source });
      names.add(l.source);
    }
  });
  return { ...data, nodes, links };
}

/**
 * Dynamically computes a multi-year comparison if not pre-cached
 */
function computeDynamicCompare(yearA: string, yearB: string) {
  const subbasinIds = [
    "KRISHNA_BASIN",
    "KRI_UPPER",
    "BHI_UPPER",
    "BHI_LOWER",
    "KRI_MIDDLE",
    "TUN_UPPER",
    "TUN_LOWER",
    "KRI_LOWER",
  ];

  const compareMetrics = [
    "precip_mm",
    "precip_bcm",
    "et_actual_total_bcm",
    "et_green_agri_bcm",
    "et_blue_agri_bcm",
    "surface_runoff_bcm",
    "gw_total_recharge_bcm",
    "gw_withdrawal_total_bcm",
    "sw_withdrawal_total_bcm",
    "subbasin_outflow_bcm",
    "delta_storage_gw_bcm",
    "delta_storage_total_bcm",
    "gw_stage_of_development_pct",
  ];

  const diffs: any[] = [];

  for (const sbId of subbasinIds) {
    const annualKey = `/api/water-balance?subbasin_id=${sbId}&scale=annual`;
    const sbData = db[annualKey]?.data || [];
    const rowA = sbData.find((r: any) => r.hydro_year === yearA);
    const rowB = sbData.find((r: any) => r.hydro_year === yearB);

    if (rowA && rowB) {
      const dItem: any = {
        subbasin_id: sbId,
        subbasin_name: rowA.subbasin_name || sbId,
        year_a: yearA,
        year_b: yearB,
      };

      for (const m of compareMetrics) {
        const va = parseFloat(rowA[m] || 0);
        const vb = parseFloat(rowB[m] || 0);
        dItem[`${m}_a`] = Number(va.toFixed(3));
        dItem[`${m}_b`] = Number(vb.toFixed(3));
        dItem[`${m}_abs_diff`] = Number((vb - va).toFixed(3));
        dItem[`${m}_pct_diff`] =
          Math.abs(va) > 1e-6 ? Number((((vb - va) / Math.abs(va)) * 100).toFixed(2)) : 0;
      }
      diffs.push(dItem);
    }
  }

  return {
    year_a: yearA,
    year_b: yearB,
    subbasin_comparisons: diffs,
  };
}

/**
 * Universal Fetch Interceptor
 * Seamlessly resolves API requests from embedded offline JSON when offline or loaded via file://
 */
export function initOfflineInterceptor() {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

    // Extract path and query string: e.g. "/api/water-balance?..."
    let path = rawUrl;
    try {
      if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
        const parsed = new URL(rawUrl);
        path = parsed.pathname + parsed.search;
      }
    } catch (_) {}

    // 1. Direct hit or normalized key for Sankey
    if (path.startsWith("/api/sankey")) {
      try {
        const urlObj = new URL(path, "http://localhost");
        const hy = urlObj.searchParams.get("hydro_year") || "2000-26_MEAN";
        const sb = urlObj.searchParams.get("subbasin_id") || "KRISHNA_BASIN";
        const normalizedKey = `/api/sankey?hydro_year=${hy}&subbasin_id=${sb}`;
        if (db[normalizedKey]) {
          return new Response(JSON.stringify(sanitizeSankeyData(db[normalizedKey])), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
      } catch (_) {}
    }

    if (db[path]) {
      let data = db[path];
      if (path.startsWith("/api/sankey")) {
        data = sanitizeSankeyData(data);
      }
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2. Dynamic compare handler
    if (path.startsWith("/api/compare")) {
      const urlObj = new URL(path, "http://localhost");
      const yearA = urlObj.searchParams.get("year_a") || "2002-03";
      const yearB = urlObj.searchParams.get("year_b") || "2020-21";
      const dynResult = computeDynamicCompare(yearA, yearB);
      return new Response(JSON.stringify(dynResult), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 3. Fallback to network if online
    try {
      const res = await originalFetch(input, init);
      if (res.ok) return res;
    } catch (_) {}

    // 4. If all else fails and we have a root path fallback
    if (db[path]) {
      return new Response(JSON.stringify(db[path]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.warn(`[Offline Mode] No pre-baked data found for ${path}`);
    return new Response(JSON.stringify({ error: "offline_not_found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  };

  console.info("⚡ Krishna Basin Offline Interceptor initialized (305 endpoints in-memory).");
}
