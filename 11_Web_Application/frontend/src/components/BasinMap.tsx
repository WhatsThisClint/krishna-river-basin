import React, { useEffect, useRef, useState } from 'react'
import L from 'leaflet'

interface BasinMapProps {
  selectedSubbasin: string
  onSelectSubbasin: (sbId: string) => void
  selectedYearData?: Record<string, any>[]
  colorMetric?: 'precip_mm' | 'et_blue_agri_bcm' | 'gw_stage_of_development_pct' | 'subbasin_outflow_bcm'
}

const SUBBASIN_COLORS: Record<string, string> = {
  KRI_UPPER: '#2D6273',
  BHI_UPPER: '#4A6B53',
  BHI_LOWER: '#B85D3B',
  KRI_MIDDLE: '#768F61',
  TUN_UPPER: '#335244',
  TUN_LOWER: '#C68B39',
  KRI_LOWER: '#224C56',
}

export const BasinMap: React.FC<BasinMapProps> = ({
  selectedSubbasin,
  onSelectSubbasin,
  selectedYearData = [],
  colorMetric,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layersRef = useRef<Record<string, L.Layer>>({})

  const [showRivers, setShowRivers] = useState(true)
  const [showReservoirs, setShowReservoirs] = useState(true)
  const [showLinks, setShowLinks] = useState(true)
  const [showS2Cells, setShowS2Cells] = useState(false)
  const [showCgwb2020, setShowCgwb2020] = useState(false)

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return
    const map = L.map(mapContainerRef.current, {
      center: [16.45, 76.85],
      zoom: 6.4,
      zoomSnap: 0.2,
      zoomControl: false,
    })

    L.control.zoom({ position: 'topright' }).addTo(map)

    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Esri, HERE, Garmin · CWC & India-WRIS',
        maxZoom: 16,
      }
    ).addTo(map)

    mapRef.current = map

    // Load Sub-Basins
    fetch('/api/geojson/subbasins')
      .then((r) => r.json())
      .then((geojson) => {
        if (!mapRef.current) return
        const layer = L.geoJSON(geojson, {
          style: (feat: any) => {
            const sbId = feat?.properties?.subbasin_id || ''
            const isSelected = selectedSubbasin === sbId
            const isAll = selectedSubbasin === 'KRISHNA_BASIN'
            return {
              fillColor: SUBBASIN_COLORS[sbId] || '#4A6B53',
              weight: isSelected ? 2.8 : 1.2,
              opacity: 1,
              color: isSelected ? '#141916' : '#FAF9F5',
              fillOpacity: isSelected ? 0.82 : isAll ? 0.58 : 0.25,
            }
          },
          onEachFeature: (feat, lyr) => {
            const p = feat.properties || {}
            lyr.bindTooltip(
              `<div class="font-sans text-xs leading-relaxed text-[#141916] min-w-[190px]">
                <div class="text-[10px] font-mono uppercase tracking-wider text-[#5A625D]">${p.subbasin_id}</div>
                <div class="font-semibold text-sm text-[#141916] mb-1.5">${p.Sub_Basin || p.subbasin_name || ''}</div>
                <div class="flex justify-between py-0.5 border-t border-black/5">
                  <span class="text-[#5A625D]">Rainfall</span>
                  <span class="font-mono font-medium">${p.mean_precip_mm ?? '-'} mm (${p.mean_precip_bcm ?? '-'} BCM)</span>
                </div>
                <div class="flex justify-between py-0.5">
                  <span class="text-[#5A625D]">Actual ET</span>
                  <span class="font-mono font-medium">${p.mean_et_total_bcm ?? '-'} BCM</span>
                </div>
                <div class="flex justify-between py-0.5">
                  <span class="text-[#5A625D]">GW Extraction</span>
                  <span class="font-mono font-medium">${p.gw_stage_pct ?? '-'}%</span>
                </div>
                <div class="text-[10px] text-[#1E3F2E] font-medium mt-1.5 pt-1 border-t border-black/5">Click to focus sub-basin</div>
              </div>`,
              { sticky: true }
            )
            lyr.on('click', () => {
              if (p.subbasin_id) onSelectSubbasin(p.subbasin_id)
            })
          },
        }).addTo(mapRef.current)
        layersRef.current['subbasins'] = layer
      })
      .catch(console.error)

    // Load Rivers
    fetch('/api/geojson/rivers')
      .then((r) => r.json())
      .then((geojson) => {
        if (!mapRef.current) return
        const layer = L.geoJSON(geojson, {
          style: { color: '#26596B', weight: 1.5, opacity: 0.78 },
        }).addTo(mapRef.current)
        layersRef.current['rivers'] = layer
      })
      .catch(console.error)

    // Load Reservoirs
    fetch('/api/geojson/reservoirs_wfs')
      .then((r) => r.json())
      .then((geojson) => {
        if (!mapRef.current) return
        const layer = L.geoJSON(geojson, {
          style: { color: '#141916', fillColor: '#1E3F2E', weight: 1.0, fillOpacity: 0.9 },
          onEachFeature: (feat, lyr) => {
            const p = feat.properties || {}
            lyr.bindTooltip(
              `<div class="text-xs font-sans"><span class="text-[#5A625D]">Reservoir:</span> <b class="text-[#141916]">${
                p.res_name || p.wbname || p.NAME || 'Major Reservoir'
              }</b></div>`
            )
          },
        }).addTo(mapRef.current)
        layersRef.current['reservoirs'] = layer
      })
      .catch(console.error)

    // Load Inter-Basin Transfer Links
    fetch('/api/geojson/ibtl_links')
      .then((r) => r.json())
      .then((geojson) => {
        if (!mapRef.current) return
        const layer = L.geoJSON(geojson, {
          style: { color: '#B8532E', weight: 2.2, dashArray: '5,5', opacity: 0.9 },
          onEachFeature: (feat, lyr) => {
            const p = feat.properties || {}
            lyr.bindTooltip(
              `<div class="text-xs font-sans"><span class="text-[#5A625D]">Transfer Link:</span> <b class="text-[#B8532E]">${
                p.Name || p.LINK_NAME || 'Canal Transfer'
              }</b></div>`
            )
          },
        }).addTo(mapRef.current)
        layersRef.current['links'] = layer
      })
      .catch(console.error)

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Update subbasin highlight when selectedSubbasin or metric changes
  useEffect(() => {
    const sbLayer = layersRef.current['subbasins'] as L.GeoJSON | undefined
    if (!sbLayer) return
    const yrMap: Record<string, any> = {}
    selectedYearData.forEach((r) => {
      if (r.subbasin_id) yrMap[r.subbasin_id] = r
    })
    sbLayer.setStyle((feat: any) => {
      const sbId = feat?.properties?.subbasin_id || ''
      const isSelected = selectedSubbasin === sbId
      const isAll = selectedSubbasin === 'KRISHNA_BASIN'
      let fillCol = SUBBASIN_COLORS[sbId] || '#4A6B53'
      const row = yrMap[sbId]
      if (row && colorMetric) {
        const val = Number(row[colorMetric] || 0)
        if (colorMetric === 'gw_stage_of_development_pct') {
          fillCol = val > 85 ? '#A63A22' : val > 70 ? '#C66B34' : val > 55 ? '#C68B39' : '#3E6B4E'
        }
      }
      return {
        fillColor: fillCol,
        weight: isSelected ? 2.8 : 1.2,
        opacity: 1,
        color: isSelected ? '#141916' : '#FAF9F5',
        fillOpacity: isSelected ? 0.82 : isAll ? 0.58 : 0.25,
      }
    })
  }, [selectedSubbasin, selectedYearData, colorMetric])

  // Toggle optional layers
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const toggleLayer = (key: string, show: boolean) => {
      const lyr = layersRef.current[key]
      if (!lyr) return
      if (show && !map.hasLayer(lyr)) map.addLayer(lyr)
      if (!show && map.hasLayer(lyr)) map.removeLayer(lyr)
    }
    toggleLayer('rivers', showRivers)
    toggleLayer('reservoirs', showReservoirs)
    toggleLayer('links', showLinks)
  }, [showRivers, showReservoirs, showLinks])

  // Lazy load S2 cells
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (showS2Cells && !layersRef.current['s2_cells']) {
      fetch('/api/geojson/s2_cells')
        .then((r) => r.json())
        .then((geojson) => {
          const lyr = L.geoJSON(geojson, {
            style: { color: '#1E3F2E', fillColor: '#4A6B53', weight: 1.1, fillOpacity: 0.7 },
            onEachFeature: (feat, l) => {
              const p = feat.properties || {}
              l.bindTooltip(
                `<div class="text-xs font-sans">
                  <div class="font-mono text-[10px] text-[#5A625D]">AnthroKrishi S2 · ${p.s2_hex_token}</div>
                  <div class="font-semibold text-[#141916] mt-0.5">${p.dominant_crop_rotation ?? 'Cropland'}</div>
                  <div class="text-[#5A625D] mt-0.5">Sub-Basin: ${p.subbasin_id} · Waterbodies (5km): ${
                  p.mapped_waterbodies_within_5km ?? '-'
                }</div>
                </div>`
              )
            },
          }).addTo(map)
          layersRef.current['s2_cells'] = lyr
        })
    } else if (layersRef.current['s2_cells']) {
      if (showS2Cells && !map.hasLayer(layersRef.current['s2_cells'])) map.addLayer(layersRef.current['s2_cells'])
      if (!showS2Cells && map.hasLayer(layersRef.current['s2_cells'])) map.removeLayer(layersRef.current['s2_cells'])
    }
  }, [showS2Cells])

  // Lazy load CGWB 2020 Assessment Blocks
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (showCgwb2020 && !layersRef.current['cgwb_2020']) {
      fetch('/api/geojson/cgwb_2020')
        .then((r) => r.json())
        .then((geojson) => {
          const catCol: Record<string, string> = {
            Safe: '#4A6B53',
            Semicritical: '#C68B39',
            'Semi-Critical': '#C68B39',
            Critical: '#C66B34',
            'Over Exploited': '#A63A22',
            'Over-Exploited': '#A63A22',
          }
          const lyr = L.geoJSON(geojson, {
            style: (feat: any) => {
              const cls = feat?.properties?.CLASS || 'Safe'
              return {
                color: '#FAF9F5',
                weight: 0.4,
                fillColor: catCol[cls] || '#8C948E',
                fillOpacity: 0.68,
              }
            },
            onEachFeature: (feat, l) => {
              const p = feat.properties || {}
              l.bindTooltip(
                `<div class="text-xs font-sans">
                  <div class="font-semibold text-[#141916]">${p.BLOCK || '-'} (${p.DISTRICT || '-'})</div>
                  <div class="text-[#5A625D] mt-0.5">CGWB Status: <b class="text-[#141916]">${p.CLASS || '-'}</b> · Extraction: <b>${
                  p.Stage_of_G ?? '-'
                }%</b></div>
                </div>`
              )
            },
          }).addTo(map)
          layersRef.current['cgwb_2020'] = lyr
        })
    } else if (layersRef.current['cgwb_2020']) {
      if (showCgwb2020 && !map.hasLayer(layersRef.current['cgwb_2020'])) map.addLayer(layersRef.current['cgwb_2020'])
      if (!showCgwb2020 && map.hasLayer(layersRef.current['cgwb_2020'])) map.removeLayer(layersRef.current['cgwb_2020'])
    }
  }, [showCgwb2020])

  const layerToggles = [
    { label: 'Rivers', active: showRivers, toggle: () => setShowRivers(!showRivers), dot: '#26596B' },
    { label: '34 Reservoirs', active: showReservoirs, toggle: () => setShowReservoirs(!showReservoirs), dot: '#1E3F2E' },
    { label: 'Canal Links', active: showLinks, toggle: () => setShowLinks(!showLinks), dot: '#B8532E' },
    { label: 'S2 Crop Sample', active: showS2Cells, toggle: () => setShowS2Cells(!showS2Cells), dot: '#4A6B53' },
    { label: 'CGWB Aquifers', active: showCgwb2020, toggle: () => setShowCgwb2020(!showCgwb2020), dot: '#C68B39' },
  ]

  return (
    <div className="relative rounded-2xl overflow-hidden border border-black/[0.06] bg-[#F2EFE9]">
      <div ref={mapContainerRef} style={{ width: '100%', height: '500px' }} />

      {/* Top-left Reset Pill when a single sub-basin is isolated */}
      {selectedSubbasin !== 'KRISHNA_BASIN' && (
        <div className="absolute top-3.5 left-3.5 z-[1000]">
          <button
            type="button"
            onClick={() => onSelectSubbasin('KRISHNA_BASIN')}
            className="bg-white/90 backdrop-blur-xl hover:bg-white text-[#141916] border border-black/10 rounded-full px-3.5 py-1.5 text-xs font-medium shadow-md transition-all duration-300 ease-apple flex items-center gap-1.5"
          >
            <span>← Show Entire Basin</span>
          </button>
        </div>
      )}

      {/* Floating Apple Glass Bottom Layer Bar */}
      <div className="absolute bottom-3.5 left-3.5 right-3.5 z-[1000] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="pointer-events-auto bg-white/85 backdrop-blur-xl border border-black/[0.08] rounded-full p-1 shadow-lg flex flex-wrap items-center gap-1">
          {layerToggles.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={item.toggle}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium transition-all duration-300 ease-apple ${
                item.active
                  ? 'bg-[#141916] text-white shadow-sm'
                  : 'text-[#5A625D] hover:text-[#141916] hover:bg-black/[0.04]'
              }`}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: item.active ? '#FFFFFF' : item.dot }}
              />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
