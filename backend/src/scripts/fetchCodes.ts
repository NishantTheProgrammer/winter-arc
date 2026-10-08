import { db } from '../firebase/config';
import axios from 'axios';
import { getQuestionData } from '../leetcode/client';

const LEETCODE_SESSION = process.env.LEETCODE_SESSION;
const CSRF_TOKEN = process.env.LEETCODE_CSRF_TOKEN;

if (!LEETCODE_SESSION || !CSRF_TOKEN) {
  console.error("❌ Missing LEETCODE_SESSION or LEETCODE_CSRF_TOKEN in backend/.env");
  process.exit(1);
}

const BATCH_SIZE = 10; // Process 10 submissions at a time
const START_TIMESTAMP = new Date('2026-10-01T00:00:00Z').getTime() / 1000;
const END_TIMESTAMP = new Date('2027-01-01T00:00:00Z').getTime() / 1000;

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function fetchCodesInBatches() {
  console.log('🔍 Scanning Firestore for missing codes...');

  // 1. Get all submissions
  const snapshot = await db.collection('submissions').get();
  
  // 2. Filter for submissions strictly within Oct-Dec 2026 that DO NOT have code or question context
  const missingCode = snapshot.docs
    .map(doc => ({ docId: doc.id, ...doc.data() as any }))
    .filter(sub => {
      const timestamp = parseInt(sub.timestamp);
      const isWinterArc = timestamp >= START_TIMESTAMP && timestamp < END_TIMESTAMP;
      const needsData = !sub.code || !sub.questionContext;
      return isWinterArc && needsData;
    });

  console.log(`Found ${missingCode.length} submissions to fetch (Oct-Dec 2026).`);

  if (missingCode.length === 0) {
    console.log('✅ Nothing to do. All codes are downloaded!');
    process.exit(0);
  }

  // 3. Process in batches
  for (let i = 0; i < missingCode.length; i += BATCH_SIZE) {
    const batch = missingCode.slice(i, i + BATCH_SIZE);
    console.log(`\n📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} submissions)...`);

    // Build the dynamic GraphQL Query with aliases
    let queryLines = [];
    let variables: Record<string, string> = {};
    let queryArgs = [];

    batch.forEach((sub, index) => {
      // For Code
      const subAlias = `sub${index}`;
      const idVarName = `$id${index}`;
      queryArgs.push(`${idVarName}: ID!`);
      variables[`id${index}`] = sub.submissionId;
      
      // For Question Context
      const qAlias = `q${index}`;
      const slugVarName = `$slug${index}`;
      queryArgs.push(`${slugVarName}: String!`);
      variables[`slug${index}`] = sub.titleSlug;
      
      queryLines.push(`
        ${subAlias}: submissionDetails(submissionIdV2: ${idVarName}) {
          code
          lang { name }
        }
        ${qAlias}: question(titleSlug: ${slugVarName}) {
          content
        }
      `);
    });

    const graphqlQuery = `
      query fetchCodesAndQuestions(${queryArgs.join(', ')}) {
        ${queryLines.join('\n')}
      }
    `;

    try {
      // 4. Send bulk request to LeetCode
      const response = await axios.post(
        'https://leetcode.com/graphql/',
        {
          query: graphqlQuery,
          variables: variables
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-csrftoken': CSRF_TOKEN,
            Cookie: `LEETCODE_SESSION=${LEETCODE_SESSION}; csrftoken=${CSRF_TOKEN}`,
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
          }
        }
      );

      const data = response.data.data;

      // 5. Update Firestore with the returned code and question context
      const firestoreBatch = db.batch();
      let successCount = 0;

      for (let index = 0; index < batch.length; index++) {
        const sub = batch[index];
        const subResult = data[`sub${index}`];
        const qResult = data[`q${index}`];

        if (subResult && subResult.code) {
          const docRef = db.collection('submissions').doc(sub.docId);
          firestoreBatch.update(docRef, {
            code: subResult.code,
            language: subResult.lang?.name || 'javascript',
            questionContext: qResult?.content || "No description available"
          });
          successCount++;
          console.log(`  ✅ Fetched code & question: ${sub.titleSlug}`);
        } else {
          console.log(`  ❌ Failed (Access Denied): ${sub.titleSlug}`);
        }
      }

      await firestoreBatch.commit();
      console.log(`💾 Saved ${successCount} codes to Firestore.`);

    } catch (error: any) {
      console.error('❌ Batch failed:', error.response?.data || error.message);
    }

    // Wait 2 seconds between batches to avoid rate limits
    await delay(2000);
  }

  console.log('\n🎉 All batches complete!');
  process.exit(0);
}

fetchCodesInBatches().catch(console.error);
