import { Router } from 'express';
import {
  getOrPickToday,
  pickProblemsForDate,
  getAssignedRecordForDate,
  getAllAssignedRecords,
  sanitizeRecordForClient,
  loadCatalog,
  getISTDateString,
  getISTDetails,
} from '../services/systemDesignService';

const router = Router();

// ── GET /api/system-design/today ─────────────────────────────────────────────
// Returns today's problem (auto-picks if missing)
router.get('/today', async (req, res) => {
  try {
    const raw = req.query.raw === 'true';
    const record = await getOrPickToday();
    const data = raw ? record : sanitizeRecordForClient(record);
    const ist = getISTDetails();
    res.json({
      ...data,
      serverTimeIST: `${ist.dateStr} ${String(ist.hour).padStart(2, '0')}:${String(ist.minute).padStart(2, '0')}:${String(ist.second).padStart(2, '0')}`,
    });
  } catch (error: any) {
    console.error('Error fetching today system design:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch today problem' });
  }
});

// ── GET /api/system-design/day/:date ─────────────────────────────────────────
// Returns problem for specific date (YYYY-MM-DD)
router.get('/day/:date', async (req, res) => {
  try {
    const date = req.params.date;
    const raw = req.query.raw === 'true';
    const today = getISTDateString();

    let record = await getAssignedRecordForDate(date);
    if (!record && date === today) {
      record = await pickProblemsForDate(date);
    }

    if (!record) {
      return res.status(404).json({ error: `No system design problem assigned for date ${date}` });
    }

    const data = raw ? record : sanitizeRecordForClient(record);
    res.json(data);
  } catch (error: any) {
    console.error('Error fetching problem for date:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch problem for date' });
  }
});

// ── GET /api/system-design/all ───────────────────────────────────────────────
// Returns all assigned records so far
router.get('/all', async (req, res) => {
  try {
    const raw = req.query.raw === 'true';
    // Ensure today is picked
    await getOrPickToday();
    const all = await getAllAssignedRecords();
    const data = raw ? all : all.map(r => sanitizeRecordForClient(r));
    res.json(data);
  } catch (error: any) {
    console.error('Error fetching all system design records:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch all records' });
  }
});

// ── GET /api/system-design/catalog ───────────────────────────────────────────
// Returns catalog overview & difficulty stats
router.get('/catalog', (_req, res) => {
  try {
    const catalog = loadCatalog();
    const diffBreakdown: Record<number, number> = {};
    catalog.problems.forEach(p => {
      diffBreakdown[p.difficulty] = (diffBreakdown[p.difficulty] || 0) + 1;
    });

    res.json({
      name: catalog.name,
      total_problems: catalog.total_problems,
      difficulty_scale: catalog.difficulty_scale,
      difficulty_counts: diffBreakdown,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load catalog' });
  }
});

// ── POST /api/system-design/pick ─────────────────────────────────────────────
// Explicit endpoint to trigger selection for a date
router.post('/pick', async (req, res) => {
  try {
    const targetDate = req.body.date || getISTDateString();
    const record = await pickProblemsForDate(targetDate);
    const data = sanitizeRecordForClient(record);
    res.json({ message: 'Problem picked successfully', record: data });
  } catch (error: any) {
    console.error('Error triggering problem pick:', error);
    res.status(500).json({ error: error.message || 'Failed to pick problem' });
  }
});

export default router;
