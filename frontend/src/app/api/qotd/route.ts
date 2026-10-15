import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase/config';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const LEETCODE_API_URL = 'https://leetcode.com/graphql/';
const HEADERS = {
  'Content-Type': 'application/json',
  'Referer': 'https://leetcode.com',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    // 1. Try reading from Firestore first
    try {
      const docRef = doc(db, 'qotd', date);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        if (data.content && data.content !== 'No description available') {
          return NextResponse.json({ success: true, data });
        }
      }
    } catch (e) {
      console.warn('Firestore read failed in /api/qotd, falling back to LeetCode API:', e);
    }

    // 2. Fetch directly from LeetCode
    const [yearStr, monthStr] = date.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    const monthQuery = `
      query dailyCodingChallengeV2($year: Int!, $month: Int!) {
        dailyCodingChallengeV2(year: $year, month: $month) {
          challenges {
            date
            link
            question {
              questionFrontendId
              title
              titleSlug
              difficulty
              topicTags {
                name
                slug
              }
            }
          }
        }
      }
    `;

    const monthRes = await fetch(LEETCODE_API_URL, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        query: monthQuery,
        variables: { year, month },
      }),
      cache: 'no-store',
    });

    const monthJson = await monthRes.json();
    const challenges: any[] = monthJson?.data?.dailyCodingChallengeV2?.challenges || [];
    const matched = challenges.find(c => c.date === date);

    if (!matched || !matched.question) {
      return NextResponse.json(
        { success: false, message: `No LeetCode challenge scheduled for ${date} yet.` },
        { status: 404 }
      );
    }

    const titleSlug = matched.question.titleSlug;

    // Fetch full question content
    const questionQuery = `
      query fullQuestionDetails($titleSlug: String!) {
        question(titleSlug: $titleSlug) {
          questionFrontendId
          title
          titleSlug
          difficulty
          content
          topicTags {
            name
            slug
          }
        }
      }
    `;

    const qRes = await fetch(LEETCODE_API_URL, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        query: questionQuery,
        variables: { titleSlug },
      }),
      cache: 'no-store',
    });

    const qJson = await qRes.json();
    const qData = qJson?.data?.question;

    const record = {
      date,
      title: qData?.title || matched.question.title,
      titleSlug,
      difficulty: qData?.difficulty || matched.question.difficulty || 'Easy',
      questionFrontendId: qData?.questionFrontendId || matched.question.questionFrontendId || null,
      topicTags: qData?.topicTags || matched.question.topicTags || [],
      link: matched.link ? `https://leetcode.com${matched.link}` : `https://leetcode.com/problems/${titleSlug}/`,
      content: qData?.content || 'No description available',
      updatedAt: new Date().toISOString(),
    };

    // Save to Firestore in background
    try {
      const docRef = doc(db, 'qotd', date);
      await setDoc(docRef, record, { merge: true });
    } catch (saveErr) {
      console.warn('Could not cache QOTD to Firestore:', saveErr);
    }

    return NextResponse.json({ success: true, data: record });
  } catch (error: any) {
    console.error('Error in /api/qotd route:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal error' },
      { status: 500 }
    );
  }
}
