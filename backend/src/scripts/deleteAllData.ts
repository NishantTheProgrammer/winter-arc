import { db } from '../firebase/config';

async function deleteAllData() {
  console.log('🗑️ Deleting all submissions...');
  const submissions = await db.collection('submissions').get();
  let subCount = 0;
  for (const doc of submissions.docs) {
    await doc.ref.delete();
    subCount++;
  }
  console.log(`✅ Deleted ${subCount} submissions.`);

  console.log('🗑️ Deleting all analyses...');
  const analyses = await db.collection('analyses').get();
  let anaCount = 0;
  for (const doc of analyses.docs) {
    await doc.ref.delete();
    anaCount++;
  }
  console.log(`✅ Deleted ${anaCount} analyses.`);

  console.log('🎉 All submission and analysis data has been wiped from Firestore.');
  process.exit(0);
}

deleteAllData().catch(console.error);
