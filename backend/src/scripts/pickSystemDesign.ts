import {
  pickProblemsForDate,
  getISTDateString,
  getISTDetails,
  getAllAssignedRecords,
  loadCatalog,
  isResourcesUnlockedIST,
} from '../services/systemDesignService';

async function main() {
  const args = process.argv.slice(2);
  const catalog = loadCatalog();

  if (args.includes('--status') || args.includes('-s')) {
    const all = await getAllAssignedRecords();
    console.log(`\n📊 System Design Arc Status`);
    console.log(`──────────────────────────────────────────`);
    console.log(`Total catalog problems: ${catalog.problems.length}`);
    console.log(`Total days assigned so far: ${all.length}`);

    const diffCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalAssignedProblems = 0;

    for (const rec of all) {
      for (const p of rec.problems) {
        diffCounts[p.difficulty] = (diffCounts[p.difficulty] || 0) + 1;
        totalAssignedProblems++;
      }
    }

    console.log(`Total problems assigned: ${totalAssignedProblems} / ${catalog.problems.length}`);
    console.log(`Difficulty breakdown assigned:`);
    for (let d = 0; d <= 5; d++) {
      const totalInCatalog = catalog.problems.filter(p => p.difficulty === d).length;
      console.log(`  Diff ${d}: ${diffCounts[d]} / ${totalInCatalog}`);
    }

    console.log(`\nAssigned Days:`);
    for (const rec of all) {
      const titles = rec.problems.map(p => `[#${p.id} ${p.title} (Diff ${p.difficulty})]`).join(', ');
      console.log(`  • ${rec.date} (${rec.dayName}): ${titles}`);
    }

    process.exit(0);
  }

  // Determine target date
  let targetDate = getISTDateString();
  const dateArg = args.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a));
  if (dateArg) {
    targetDate = dateArg;
  }

  console.log(`🎯 Picking / Fetching System Design Problem for ${targetDate} (IST)...`);
  const record = await pickProblemsForDate(targetDate);

  const ist = getISTDetails();
  const isUnlocked = isResourcesUnlockedIST(record.date);

  console.log(`\n======================================================`);
  console.log(`📅 Date: ${record.date} (${record.dayName})${record.isSunday ? ' [Sunday - 2 Problems]' : ''}`);
  console.log(`⏰ Current IST Time: ${String(ist.hour).padStart(2, '0')}:${String(ist.minute).padStart(2, '0')}`);
  console.log(`🔓 6 PM IST Status: ${isUnlocked ? 'REVEALED (After 6 PM IST)' : 'LOCKED (Before 6 PM IST)'}`);
  console.log(`======================================================`);

  record.problems.forEach((p, idx) => {
    console.log(`\nProblem ${idx + 1} of ${record.problems.length}:`);
    console.log(`  ID: ${p.id}`);
    console.log(`  Title: ${p.title}`);
    console.log(`  Difficulty: ${p.difficulty} (${catalog.difficulty_scale[p.difficulty] || ''})`);
    console.log(`  Statement: ${p.problem_statement}`);
    if (isUnlocked) {
      console.log(`  Tags: ${p.tags.join(', ')}`);
      console.log(`  Resources (${p.resources.length}):`);
      p.resources.forEach(r => {
        console.log(`    - [${r.role}] ${r.title}: ${r.url}`);
      });
    } else {
      console.log(`  🔒 Tags & Resources: Hidden until 6:00 PM IST`);
    }
  });

  console.log(`\n✅ Saved to Firestore collection 'system_design_daily'.\n`);
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Error picking system design problem:', err);
  process.exit(1);
});
