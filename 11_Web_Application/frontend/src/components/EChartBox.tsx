import React, { useEffect, useRef } from 'react'
import * as echarts from 'echarts'

interface EChartBoxProps {
  option: any
  height?: string
}

export const EChartBox: React.FC<EChartBoxProps> = ({ option, height = '360px' }) => {
  const chartRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!chartRef.current) return
    try {
      if (!instanceRef.current) {
        instanceRef.current = echarts.init(chartRef.current)
      }

      const mergedOption = {
        backgroundColor: 'transparent',
        textStyle: {
          fontFamily: '"Plus Jakarta Sans", Inter, sans-serif',
          color: '#2d3731',
        },
        tooltip: {
          backgroundColor: '#ffffff',
          borderColor: '#dcd6c8',
          borderWidth: 1,
          padding: [10, 14],
          borderRadius: 10,
          textStyle: {
            color: '#1f2822',
            fontSize: 12,
            fontFamily: '"Plus Jakarta Sans", sans-serif',
          },
          extraCssText: 'box-shadow: 0 8px 24px -4px rgba(35,45,38,0.12);',
          ...(option.tooltip || {}),
        },
        ...option,
      }

      instanceRef.current.setOption(mergedOption, true)
    } catch (err) {
      console.error("ECharts render error:", err)
    }

    const resizeObserver = new ResizeObserver(() => {
      try {
        instanceRef.current?.resize()
      } catch (_) {}
    })
    resizeObserver.observe(chartRef.current)

    return () => {
      resizeObserver.disconnect()
    }
  }, [option])

  useEffect(() => {
    return () => {
      try {
        instanceRef.current?.dispose()
      } catch (_) {}
      instanceRef.current = null
    }
  }, [])

  return (
    <div
      ref={chartRef}
      className="transition-all duration-300"
      style={{ width: '100%', height }}
    />
  )
}
