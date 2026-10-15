import companyMappingData from '@/data/company-mapping.json';

const companyMapping = companyMappingData as Record<string, string[]>;

// Prominent companies to highlight and prioritize in previews
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

/**
 * Normalizes any LeetCode problem link, relative path, or titleSlug and retrieves
 * the array of companies that have asked this question.
 */
export function getCompaniesForProblem(linkOrSlug?: string | null): string[] {
  if (!linkOrSlug) return [];

  let trimmed = linkOrSlug.trim();

  // If it's just a slug or relative path
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    trimmed = trimmed.replace(/^\/?(problems\/)?/, '');
    trimmed = `https://leetcode.com/problems/${trimmed}`;
  }

  // Strip query parameters, hash fragments, and trailing slashes
  trimmed = trimmed.split('?')[0].split('#')[0].replace(/\/+$/, '');

  return companyMapping[trimmed] || [];
}

/**
 * Returns companies sorted with prominent tech companies first, followed by others alphabetically.
 */
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

export function isProminentCompany(company: string): boolean {
  return PROMINENT_COMPANIES.has(company);
}

/**
 * Formats company list cleanly for daily announcement clipboard copy.
 */
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
