import { test, expect } from '@playwright/test';
import { externalSource } from '../src/modules/jobs/external-catalog';

test('external details are public and applying requires sign-in with the destination retained', async ({ page }) => {
  test.skip(Date.now() >= Date.parse(externalSource.expiresAt), 'Reviewed source snapshot has expired.');
  await page.goto('/jobs/external/6171c532d301113c');
  await expect(page.getByRole('heading', { name: 'Senior AI Engineer', exact: true })).toBeVisible();
  await expect(page.getByText('External listing · Indeed', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Original Indeed listing (opens in a new tab)' })).toHaveAttribute('href', 'https://pk.indeed.com/viewjob?jk=6171c532d301113c');
  await page.getByRole('link', { name: 'Apply via Indeed', exact: true }).click();
  await expect(page).toHaveURL(/\/login\?next=%2Fjobs%2Fexternal%2F6171c532d301113c%2Fapply/);
  await page.getByRole('link', { name: 'Create account', exact: true }).click();
  await expect(page.locator('input[name="next"]')).toHaveValue('/jobs/external/6171c532d301113c/apply');
});

test('unknown external source records are unavailable', async ({ page }) => {
  await page.goto('/jobs/external/0000000000000000');
  await expect(page.getByRole('heading', { name: 'Page unavailable', exact: true })).toBeVisible();
});
