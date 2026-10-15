import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDayNumber } from '../../src/services/discordService';
import { getCompaniesForProblem, formatCompaniesForAnnouncement, getSortedCompanies } from '../../src/services/companyService';
import { chunkMessage } from '../../src/services/discordClient';
import { formatSolutionMessage } from '../../src/services/systemDesignSolutionService';
import { isResourcesUnlockedIST } from '../../src/services/systemDesignService';

test('calculateDayNumber calculates correct day from Arc start 2026-10-01', () => {
  assert.strictEqual(calculateDayNumber('2026-10-01'), 1);
  assert.strictEqual(calculateDayNumber('2026-10-02'), 2);
  assert.strictEqual(calculateDayNumber('2026-10-15'), 15);
  assert.strictEqual(calculateDayNumber('2026-12-31'), 92);
});

test('companyService resolves and formats companies correctly', () => {
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

test('chunkMessage correctly splits messages exceeding Discord limit', () => {
  const shortText = 'Hello world';
  assert.deepStrictEqual(chunkMessage(shortText, 100), ['Hello world']);

  const longText = 'A'.repeat(50) + '\n\n' + 'B'.repeat(60);
  const chunks = chunkMessage(longText, 70);
  assert.strictEqual(chunks.length, 2);
  assert.strictEqual(chunks[0], 'A'.repeat(50));
  assert.strictEqual(chunks[1], 'B'.repeat(60));
});

test('formatSolutionMessage builds clean, structured message with curated links', () => {
  const mockProblem = {
    id: 4,
    title: 'Rate Limiter',
    difficulty: 0,
    problem_statement: 'Design rate limiter',
    tags: ['Redis'],
    resources: [
      {
        role: 'main',
        type: 'walkthrough',
        title: 'Rate Limiter Walkthrough',
        url: 'https://example.com/ratelimiter',
      },
    ],
  };

  const formatted = formatSolutionMessage(15, '2026-10-15', mockProblem, '1. Core Requirements:\n• Token bucket');
  assert.ok(formatted.includes('System Design Solution: Rate Limiter (Day 15)'));
  assert.ok(formatted.includes('Rate Limiter Walkthrough: <https://example.com/ratelimiter>'));
});

test('isResourcesUnlockedIST respects 6:00 PM IST unlock rule', () => {
  // Test with morning IST (10:00 AM)
  const morningDate = new Date('2026-10-15T04:30:00.000Z'); // 10:00 AM IST
  assert.strictEqual(isResourcesUnlockedIST('2026-10-15', morningDate), false);

  // Test with evening IST (6:30 PM)
  const eveningDate = new Date('2026-10-15T13:00:00.000Z'); // 18:30 IST (6:30 PM)
  assert.strictEqual(isResourcesUnlockedIST('2026-10-15', eveningDate), true);

  // Past dates are always unlocked
  assert.strictEqual(isResourcesUnlockedIST('2026-10-14', morningDate), true);
});
