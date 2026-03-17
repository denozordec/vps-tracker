import { useEffect, useRef } from 'react'
import {
  Chart as ChartJS,
  ArcElement,
  DoughnutController,
  Legend,
  Tooltip,
} from 'chart.js'

ChartJS.register(ArcElement, DoughnutController, Legend, Tooltip)

const COLORS = [
  'rgba(32, 107, 196, 0.8)',
  'rgba(47, 179, 68, 0.8)',
  'rgba(245, 159, 0, 0.8)',
  'rgba(155, 93, 229, 0.8)',
  'rgba(214, 51, 132, 0.8)',
  'rgba(13, 202, 240, 0.8)',
]

export function ProviderPieChart({ data, baseCurrency, formatCurrency }) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    const safeData = Array.isArray(data) ? data : []
    if (safeData.length === 0) return

    const canvas = canvasRef.current
    if (!canvas) return

    try {
      if (chartRef.current) {
        chartRef.current.destroy()
        chartRef.current = null
      }

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      chartRef.current = new ChartJS(ctx, {
        type: 'doughnut',
        data: {
          labels: safeData.map((d) => d.providerName || '-'),
          datasets: [
            {
              data: safeData.map((d) => Number(d.amount) || 0),
              backgroundColor: safeData.map((_, i) => COLORS[i % COLORS.length]),
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'right' },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const total = ctx.dataset.data.reduce((a, b) => a + b, 0)
                  const pct = total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : 0
                  const formatted =
                    typeof formatCurrency === 'function'
                      ? formatCurrency(ctx.raw, baseCurrency)
                      : String(ctx.raw)
                  return `${ctx.label}: ${formatted} (${pct}%)`
                },
              },
            },
          },
        },
      })
    } catch (err) {
      console.warn('ProviderPieChart error:', err)
    }

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy()
        chartRef.current = null
      }
    }
  }, [data, baseCurrency, formatCurrency])

  const safeData = Array.isArray(data) ? data : []

  return (
    <div style={{ height: 220, minHeight: 220, position: 'relative' }}>
      {safeData.length === 0 ? (
        <div className="text-secondary text-center py-5">Нет расходов по хостеру</div>
      ) : (
        <canvas ref={canvasRef} style={{ display: 'block', maxHeight: 220 }} />
      )}
    </div>
  )
}
