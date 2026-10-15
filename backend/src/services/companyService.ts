import fs from 'fs';
import path from 'path';

export const PROMINENT_COMPANIES = new Set([
  'Google',
  'Meta',
  'Amazon',
  'Microsoft',
  'Apple',
  'Netflix',
  'Bloomberg',
  'Uber',
  'LinkedIn',
  'Atlassian',
  'Stripe',
  'ByteDance',
  'Goldman Sachs',
  'Adobe',
  'Oracle',
  'Salesforce',
  'Nvidia',
  'Airbnb',
  'Twitter',
  'X',
  'DoorDash',
  'Palantir Technologies',
  'Snowflake',
  'Citadel',
  'DE Shaw',
]);

let cachedMapping: Record<string, string[]> | null = null;

export function loadCompanyMapping(): Record<string, string[]> {
  if (cachedMapping) return cachedMapping;

  const candidatePaths = [
    path.join(__dirname, '../data/company-mapping.json'),
    path.join(process.cwd(), 'src/data/company-mapping.json'),
    path.join(process.cwd(), 'data/company-mapping.json'),
    path.join(process.cwd(), 'company-mapping.json'),
    path.join(process.cwd(), '../company-mapping.json'),
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, 'utf-8');
        cachedMapping = JSON.parse(raw) as Record<string, string[]>;
        return cachedMapping;
      } catch (err) {
        console.error(`Failed parsing company-mapping at ${p}:`, err);
      }
    }
  }

  return {};
}

export function getCompaniesForProblem(linkOrSlug?: string | null): string[] {
  if (!linkOrSlug) return [];

  let trimmed = linkOrSlug.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    trimmed = trimmed.replace(/^\/?(problems\/)?/, '');
    trimmed = `https://leetcode.com/problems/${trimmed}`;
  }

  // Strip query parameters, hash fragments, and trailing slashes
  trimmed = trimmed.split('?')[0].split('#')[0].replace(/\/+$/, '');

  const mapping = loadCompanyMapping();
  return mapping[trimmed] || [];
}

export function getSortedCompanies(companies: string[]): string[] {
  if (!companies || companies.length === 0) return [];

  const prominent: string[] = [];
  const others: string[] = [];

  companies.forEach((c) => {
    if (PROMINENT_COMPANIES.has(c)) {
      prominent.push(c);
    } else {
      others.push(c);
    }
  });

  prominent.sort((a, b) => a.localeCompare(b));
  others.sort((a, b) => a.localeCompare(b));

  return [...prominent, ...others];
}

export function formatCompaniesForAnnouncement(companies: string[], previewLimit: number = 8): string {
  if (!companies || companies.length === 0) return '';

  const sorted = getSortedCompanies(companies);

  if (sorted.length <= previewLimit) {
    return `Companies: ${sorted.join(', ')}`;
  }

  const topSubset = sorted.slice(0, previewLimit).join(', ');
  const remaining = sorted.length - previewLimit;
  return `Companies (${sorted.length}): ${topSubset} (+${remaining} more)`;
}
