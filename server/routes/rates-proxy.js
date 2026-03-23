import { Router } from 'express'

const router = Router()

router.get('/', async (req, res) => {
  const url = req.query.url
  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' })
  }
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (!response.ok) {
      return res.status(502).json({ error: `Upstream returned ${response.status}` })
    }
    const data = await response.json()
    res.json(data)
  } catch (err) {
    res.status(502).json({ error: err.message || 'Failed to fetch rates' })
  }
})

export default router
