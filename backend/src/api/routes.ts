import { Router } from 'express';
import { getRecentSubmissions, getSubmissionDetails } from '../leetcode/client';
import { processSubmission } from './analyze';

const router = Router();

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
