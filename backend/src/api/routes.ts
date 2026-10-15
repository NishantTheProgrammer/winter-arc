import { Router } from 'express';
import { getRecentSubmissions, getSubmissionDetails } from '../leetcode/client';
import { processSubmission } from './analyze';
import { db } from '../firebase/config';

const router = Router();

// ── GET /api/users ─────────────────────────────────────────────────────────
// Returns all registered users from Firestore
router.get('/users', async (_req, res) => {
  try {
    const snapshot = await db.collection('users').get();
    const users = snapshot.docs.map(doc => doc.data());
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// ── GET /api/submissions/:username ─────────────────────────────────────────
// Returns stored submission history for a user
router.get('/submissions/:username', async (req, res) => {
  try {
    const snapshot = await db
      .collection('submissions')
      .where('username', '==', req.params.username)
      .orderBy('timestamp', 'desc')
      .get();
    const submissions = snapshot.docs.map(doc => doc.data());
    res.json(submissions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// ── GET /api/qotd and /api/qotd/:date ─────────────────────────────────────
// Returns stored Question of the Day for a date (defaults to today)
router.get(['/qotd', '/qotd/:date'], async (req, res) => {
  const date = req.params.date || new Date().toISOString().split('T')[0];
  try {
    const docRef = db.collection('qotd').doc(date);
    const snap = await docRef.get();
    if (snap.exists) {
      return res.json({ success: true, data: snap.data() });
    }
    return res.status(404).json({ success: false, message: `No QOTD found for ${date}` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch QOTD' });
  }
});

// ── POST /api/trigger ──────────────────────────────────────────────────────
// Endpoint to trigger manual fetch and analysis
router.post('/trigger', async (req, res) => {
  const { username, leetcodeSession, csrfToken, userId, dailySlug } = req.body;

  try {
    // 1. Fetch recent submissions
    const recent = await getRecentSubmissions(username, 5);
    
    // 2. Find submission for today's question
    const targetSub = recent.find(sub => sub.titleSlug === dailySlug);

    if (!targetSub) {
      return res.status(404).json({ message: "No submission found for today's question." });
    }

    // 3. Fetch full code using cookies
    const details = await getSubmissionDetails(targetSub.id, leetcodeSession, csrfToken);

    if (!details || !details.code) {
      return res.status(500).json({ message: "Failed to fetch code. Check session cookies." });
    }

    // 4. Run LangGraph AI analysis and save to Firebase
    const analysisResult = await processSubmission(
      targetSub.id,
      details.code,
      details.lang.name,
      userId,
      dailySlug,
      new Date().toISOString().split('T')[0] // YYYY-MM-DD
    );

    res.json({ message: "Analysis complete", result: analysisResult });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
