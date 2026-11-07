import { test, expect } from '@playwright/test';

test('supports signup intent, password visibility and matching feedback on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/signup');
  await expect(page.getByRole('heading', { name: 'Create your account', exact: true })).toBeVisible();
  await page.getByRole('radio', { name: 'Hire talent' }).check();
  await expect(page.locator('input[name="next"]')).toHaveValue('/organizations/new');
  await page.getByLabel('Password', { exact: true }).fill('Synthetic-password-123');
  await expect(page.getByText(/Minimum length reached/)).toBeVisible();
  await page.getByRole('button', { name: 'Show password', exact: true }).click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByLabel('Confirm password', { exact: true }).fill('Different-password');
  await expect(page.getByText('Your passwords do not match yet.')).toBeVisible();
  await expect(page.getByLabel('Confirm password', { exact: true })).toHaveJSProperty('validationMessage', 'Your passwords do not match.');
  await page.getByLabel('Confirm password', { exact: true }).fill('Synthetic-password-123');
  await expect(page.getByText('Passwords match.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Hide password', exact: true }).click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'password');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.getByRole('link', { name: 'Sign in', exact: true }).last()).toHaveAttribute('href', '/login?next=%2Forganizations%2Fnew');
});

test('retains the chosen application when a candidate signs up', async ({ page }) => {
  const destination = '/jobs/11111111-1111-4111-8111-111111111111/apply';
  await page.goto(`/signup?next=${encodeURIComponent(destination)}`);
  await expect(page.getByRole('radio', { name: 'Find a job' })).toBeChecked();
  await expect(page.locator('input[name="next"]')).toHaveValue(destination);
  await page.getByRole('radio', { name: 'Hire talent' }).check();
  await page.getByRole('radio', { name: 'Find a job' }).check();
  await expect(page.locator('input[name="next"]')).toHaveValue(destination);
});
