import axios from 'axios';

const LEETCODE_API_URL = 'https://leetcode.com/graphql/';

export interface SubmissionDetail {
  code: string;
  lang: {
    name: string;
  };
}

export interface RecentSubmission {
  id: string;
  title: string;
  titleSlug: string;
  timestamp: string;
}

/**
 * Fetch recent accepted submissions for a given LeetCode username.
 */
export async function getRecentSubmissions(username: string, limit: number = 10): Promise<RecentSubmission[]> {
  const query = `
    query recentAcSubmissions($username: String!, $limit: Int!) {
      recentAcSubmissionList(username: $username, limit: $limit) {
        id
        title
        titleSlug
        timestamp
      }
    }
  `;

  try {
    const response = await axios.post(LEETCODE_API_URL, {
      query,
      variables: { username, limit },
    });

    return response.data.data.recentAcSubmissionList || [];
  } catch (error) {
    console.error(`Error fetching recent submissions for ${username}:`, error);
    return [];
  }
}

/**
 * Fetch a user's public profile to get their avatar.
 */
export async function getUserProfile(username: string): Promise<string | null> {
  const query = `
    query userPublicProfile($username: String!) {
      matchedUser(username: $username) {
        profile {
          userAvatar
        }
      }
    }
  `;

  try {
    const response = await axios.post(LEETCODE_API_URL, {
      query,
      variables: { username },
    });

    return response.data.data.matchedUser?.profile?.userAvatar || null;
  } catch (error) {
    console.error(`Error fetching profile for ${username}:`, error);
    return null;
  }
}

/**
 * Fetch the actual code for a given submission ID.
 * Requires LEETCODE_SESSION and csrftoken cookies.
 */
export async function getSubmissionDetails(
  submissionId: string,
  leetcodeSession: string,
  csrfToken: string
): Promise<SubmissionDetail | null> {
  const query = `
    query submissionDetails($submissionId: ID!) {
      submissionDetails(submissionIdV2: $submissionId) {
        code
        lang {
          name
        }
      }
    }
  `;

  try {
    const response = await axios.post(
      LEETCODE_API_URL,
      {
        query,
        variables: { submissionId },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-csrftoken': csrfToken,
          Cookie: `LEETCODE_SESSION=${leetcodeSession}; csrftoken=${csrfToken}`,
          Referer: `https://leetcode.com/submissions/detail/${submissionId}/`,
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      }
    );

    return response.data.data.submissionDetails;
  } catch (error) {
    console.error(`Error fetching submission details for ${submissionId}:`, error);
    return null;
  }
}

/**
 * Fetch the Question of the Day.
 */
export async function getQuestionOfTheDay(): Promise<any> {
  const query = `
    query questionOfToday {
      activeDailyCodingChallengeQuestion {
        date
        userStatus
        link
        question {
          acRate
          difficulty
          freqBar
          questionFrontendId
          isFavor
          paidOnly: isPaidOnly
          status
          title
          titleSlug
          hasVideoSolution
          hasSolution
          topicTags {
            name
            id
            slug
          }
          content
        }
      }
    }
  `;

  try {
    const response = await axios.post(
      LEETCODE_API_URL,
      { query },
      {
        headers: {
          'Content-Type': 'application/json',
          'Referer': 'https://leetcode.com',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      }
    );
    return response.data?.data?.activeDailyCodingChallengeQuestion || null;
  } catch (error) {
    console.error('Error fetching question of the day:', error);
    return null;
  }
}

/**
 * Fetch problem context (description, constraints) by titleSlug
 */
export async function getQuestionData(titleSlug: string): Promise<string | null> {
  const query = `
    query questionData($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        content
      }
    }
  `;

  try {
    const response = await axios.post(
      LEETCODE_API_URL,
      {
        query,
        variables: { titleSlug },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Referer': 'https://leetcode.com',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      }
    );
    return response.data?.data?.question?.content || null;
  } catch (error) {
    console.error(`Error fetching question data for ${titleSlug}:`, error);
    return null;
  }
}

/**
 * Fetch full problem details by titleSlug
 */
export async function getFullQuestionDetails(titleSlug: string): Promise<any> {
  const query = `
    query fullQuestionDetails($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        questionFrontendId
        title
        titleSlug
        difficulty
        acRate
        stats
        content
        topicTags {
          name
          slug
        }
      }
    }
  `;

  try {
    const response = await axios.post(
      LEETCODE_API_URL,
      {
        query,
        variables: { titleSlug },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Referer': 'https://leetcode.com',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      }
    );
    return response.data?.data?.question || null;
  } catch (error) {
    console.error(`Error fetching full question details for ${titleSlug}:`, error);
    return null;
  }
}

/**
 * Fetch daily coding challenges for a specific month
 */
export async function getDailyCodingChallenges(year: number, month: number): Promise<any[]> {
  const query = `
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
            acRate
            topicTags {
              name
              slug
            }
          }
        }
      }
    }
  `;

  try {
    const response = await axios.post(
      LEETCODE_API_URL,
      {
        query,
        variables: { year, month },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Referer': 'https://leetcode.com',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      }
    );
    return response.data?.data?.dailyCodingChallengeV2?.challenges || [];
  } catch (error) {
    console.error(`Error fetching daily challenges for ${year}-${month}:`, error);
    return [];
  }
}

