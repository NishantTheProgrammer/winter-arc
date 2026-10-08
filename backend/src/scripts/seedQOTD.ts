import { db } from '../firebase/config';
import axios from 'axios';

async function fetchQOTDForMonth(year: number, month: number) {
  const query = `
    query dailyCodingChallengeV2($year: Int!, $month: Int!) {
      dailyCodingChallengeV2(year: $year, month: $month) {
        challenges {
          date
          question {
            title
            titleSlug
          }
        }
      }
    }
  `;
  try {
    const response = await axios.post('https://leetcode.com/graphql/', {
      query,
      variables: { year, month }
    });
    return response.data.data.dailyCodingChallengeV2.challenges;
  } catch (e) {
    console.error(`Failed for ${year}-${month}`, e);
    return [];
  }
}

async function seedQOTD() {
  console.log('Seeding QOTD for Winter Arc (Oct-Dec 2026)...');
  const months = [10, 11, 12];
  let count = 0;

  for (const month of months) {
    console.log(`Fetching QOTD for 2026-${month}...`);
    const challenges = await fetchQOTDForMonth(2026, month);
    
    for (const challenge of challenges) {
      if (!challenge || !challenge.date) continue;
      
      const docRef = db.collection('qotd').doc(challenge.date);
      await docRef.set({
        date: challenge.date,
        title: challenge.question.title,
        titleSlug: challenge.question.titleSlug
      }, { merge: true });
      count++;
    }
  }
  
  console.log(`✅ Saved ${count} QOTD documents to Firestore.`);
  process.exit(0);
}

seedQOTD();
