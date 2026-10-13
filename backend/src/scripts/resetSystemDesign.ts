import { db } from '../firebase/config';
import {
  pickProblemsForDate,
  getISTDateString,
  getAllAssignedRecords,
} from '../services/systemDesignService';

async function reset() {
  console.log('🧹 Clearing pre-populated backfill documents from system_design_daily...');
  const snap = await db.collection('system_design_daily').get();
  const batch = db.batch();
  snap.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  await batch.commit();
  console.log(`Deleted ${snap.docs.length} documents.`);

  const todayIST = getISTDateString();
  console.log(`🎯 Picking fresh problem for today only: ${todayIST}...`);
  const record = await pickProblemsForDate(todayIST);

  console.log(`✅ Today (${record.date}, ${record.dayName}) has 1 problem assigned:`);
  record.problems.forEach(p => {
    console.log(`  • ID #${p.id}: ${p.title} (Difficulty ${p.difficulty})`);
  });

  const all = await getAllAssignedRecords();
  console.log(`\nActive records in Firestore: ${all.length} (Only today)`);
  process.exit(0);
}

reset().catch(err => {
  console.error('Reset failed:', err);
  process.exit(1);
});
