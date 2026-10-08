import { db } from '../firebase/config';
import axios from 'axios';

const LEETCODE_SESSION = process.env.LEETCODE_SESSION;
const CSRF_TOKEN = process.env.LEETCODE_CSRF_TOKEN;

if (!LEETCODE_SESSION || !CSRF_TOKEN) {
  console.error("❌ Missing LEETCODE_SESSION or LEETCODE_CSRF_TOKEN in backend/.env");
  process.exit(1);
}

const BATCH_SIZE = 10; // Process 10 submissions at a time
const CUTOFF_TIMESTAMP = new Date('2026-10-01T00:00:00Z').getTime() / 1000;

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function fetchCodesInBatches() {
  console.log('🔍 Scanning Firestore for missing codes...');

  // 1. Get all submissions
  const snapshot = await db.collection('submissions').get();
  
  // 2. Filter for submissions after Oct 1, 2026 that DO NOT have code
  const missingCode = snapshot.docs
    .map(doc => ({ docId: doc.id, ...doc.data() as any }))
    .filter(sub => {
      const isAfterCutoff = parseInt(sub.timestamp) >= CUTOFF_TIMESTAMP;
      const hasNoCode = !sub.code;
      return isAfterCutoff && hasNoCode;
    });

  console.log(`Found ${missingCode.length} submissions to fetch (after Oct 1st 2026).`);

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
      const alias = `sub${index}`;
      const varName = `$id${index}`;
      
      queryArgs.push(`${varName}: ID!`);
      variables[`id${index}`] = sub.submissionId;
      
      queryLines.push(`
        ${alias}: submissionDetails(submissionIdV2: ${varName}) {
          code
          lang { name }
        }
      `);
    });

    const graphqlQuery = `
      query fetchMultipleCodes(${queryArgs.join(', ')}) {
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

      // 5. Update Firestore with the returned code
      const firestoreBatch = db.batch();
      let successCount = 0;

      batch.forEach((sub, index) => {
        const alias = `sub${index}`;
        const result = data[alias];

        if (result && result.code) {
          const docRef = db.collection('submissions').doc(sub.docId);
          firestoreBatch.update(docRef, {
            code: result.code,
            language: result.lang?.name || 'javascript'
          });
          successCount++;
          console.log(`  ✅ Fetched: ${sub.titleSlug}`);
        } else {
          console.log(`  ❌ Failed (Access Denied): ${sub.titleSlug}`);
        }
      });

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
