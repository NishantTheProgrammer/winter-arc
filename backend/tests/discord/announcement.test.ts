import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDayNumber } from '../../src/services/discordService';
import { getCompaniesForProblem, formatCompaniesForAnnouncement, getSortedCompanies } from '../../src/services/companyService';

test('calculateDayNumber calculates correct day from Arc start 2026-10-01', () => {
  assert.strictEqual(calculateDayNumber('2026-10-01'), 1);
  assert.strictEqual(calculateDayNumber('2026-10-02'), 2);
  assert.strictEqual(calculateDayNumber('2026-10-15'), 15);
  assert.strictEqual(calculateDayNumber('2026-12-31'), 92);
});

test('companyService resolves and formats companies correctly', () => {
  // Test slug normalization and lookup
  const companies = getCompaniesForProblem('https://leetcode.com/problems/01-matrix/');
  assert.ok(companies.length > 0, 'Should find companies for 01-matrix');
  assert.ok(companies.includes('Google'), '01-matrix should have Google');

  const sorted = getSortedCompanies(companies);
  assert.ok(sorted.length > 0);

  const formatted = formatCompaniesForAnnouncement(companies, 5);
  assert.ok(formatted.startsWith('Companies ('));
  assert.ok(formatted.includes('more)'));
});

test('companyService handles unknown or empty problem gracefully', () => {
  const companies = getCompaniesForProblem('https://leetcode.com/problems/unknown-problem-xyz-999');
  assert.deepStrictEqual(companies, []);
  assert.strictEqual(formatCompaniesForAnnouncement([]), '');
});
