import { useEffect, useRef } from 'react'
import {
  Chart as ChartJS,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
} from 'chart.js'

ChartJS.register(BarController, BarElement, CategoryScale, LinearScale, Title, Tooltip)

export function ExpenseChart({ data, baseCurrency, formatCurrency }) {
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

      const chart = new ChartJS(ctx, {
        type: 'bar',
        data: {
          labels: safeData.map((d) => d.monthLabel || ''),
          datasets: [
            {
              label: 'Расход',
              data: safeData.map((d) => Number(d.amount) || 0),
              backgroundColor: 'rgba(47, 179, 68, 0.6)',
              borderColor: 'rgb(47, 179, 68)',
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) =>
                  typeof formatCurrency === 'function'
                    ? formatCurrency(ctx.raw, baseCurrency)
                    : String(ctx.raw),
              },
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              suggestedMax: (ctx) => {
                const max = ctx.chart?.data?.datasets?.[0]?.data
                  ? Math.max(...ctx.chart.data.datasets[0].data, 0)
                  : 0
                return max > 0 ? undefined : 1
              },
              ticks: {
                callback: (value) =>
                  typeof formatCurrency === 'function'
                    ? formatCurrency(value, baseCurrency)
                    : String(value),
              },
            },
          },
        },
      })
      chartRef.current = chart
    } catch (err) {
      console.warn('ExpenseChart error:', err)
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
        <div className="text-secondary text-center py-5">Нет данных за период</div>
      ) : (
        <canvas ref={canvasRef} style={{ display: 'block', maxHeight: 220 }} />
      )}
    </div>
  )
}
