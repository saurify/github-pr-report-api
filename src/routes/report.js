import express from 'express';
import dayjs from 'dayjs';
import { fetchPRsWithReviews } from '../services/github.js';
import { generateReport } from '../aggregator.js';
import { logInfo, logError } from '../utils/logger.js';

const router = express.Router();

router.get('/report', async (req, res) => {
  const { repo, from, to } = req.query;

  if (!repo || !from || !to) {
    return res.status(400).json({ error: 'Missing required query params: repo, from, to' });
  }

  const [owner, name] = repo.replace('https://github.com/', '').split('/');
  const start = dayjs(from);
  const end = dayjs(to);

  if (!start.isValid() || !end.isValid()) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
  }

  try {
    const data = await fetchPRsWithReviews(owner, name, start, end);
    const report = generateReport(data);
    res.json(report);
  } catch (e) {
    logError(e);
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

export default router;
