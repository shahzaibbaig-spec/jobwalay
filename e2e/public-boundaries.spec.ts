import { test,expect } from '@playwright/test';
test('offers public browsing and employer registration from the home page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Browse jobs', exact: true })).toHaveAttribute('href', '/jobs');
  await page.getByRole('link', { name: 'List your company or post a job' }).click();
  await expect(page).toHaveURL(/\/login\?next=%2Forganizations%2Fnew/);
  await expect(page.getByText('Sign in or create an account to list your company and post jobs.')).toBeVisible();
  await page.getByRole('link', { name: 'Create account', exact: true }).click();
  await expect(page).toHaveURL(/\/signup\?next=%2Forganizations%2Fnew/);
});
test('requires sign-in to apply and preserves the job when switching to signup', async ({ page }) => {
  const destination = '/jobs/11111111-1111-4111-8111-111111111111/apply';
  await page.goto(destination);
  await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(destination)}`));
  await expect(page.getByText(/Sign in or create an account to apply for this job/)).toBeVisible();
  await page.getByRole('link', { name: 'Create account', exact: true }).click();
  await expect(page.locator('input[name="next"]')).toHaveValue(destination);
  await page.getByRole('link', { name: 'Sign in', exact: true }).last().click();
  await expect(page.locator('input[name="next"]')).toHaveValue(destination);
});
test('renders usable sign-in and recovery forms',async({page})=>{await page.goto('/login');await expect(page.getByRole('heading',{name:'Welcome back'})).toBeVisible();await expect(page.getByLabel('Email address')).toBeVisible();await expect(page.getByLabel(/Password/)).toBeVisible();await page.getByRole('link',{name:'Forgot password?'}).click();await expect(page.getByRole('button',{name:'Send reset email'})).toBeVisible();});
test('rejects anonymous access to administration, analytics and private notifications',async({page})=>{for(const path of ['/admin/users','/admin/verification','/admin/reports','/notifications','/account/notifications','/org/11111111-1111-4111-8111-111111111111/analytics']){await page.goto(path);await expect(page).toHaveURL(/\/login/);await expect(page.getByRole('heading',{name:'Welcome back'})).toBeVisible();}});
test('rejects forged mutation origins before any business operation',async({request,baseURL})=>{const result=await request.post('/api/admin/operations',{headers:{Origin:'https://attacker.invalid'},data:{operation:'account',id:'11111111-1111-4111-8111-111111111111',status:'active',reason:'Unauthorized request'}});expect(result.status()).toBe(403);expect(result.headers()['cache-control']).toContain('no-store');const anonymous=await request.post('/api/admin/operations',{headers:{Origin:new URL(baseURL!).origin},data:{}});expect(anonymous.status()).toBe(401);});
test('supports a narrow viewport and keyboard access to the sign-in form',async({page})=>{await page.setViewportSize({width:390,height:844});await page.goto('/login');await page.getByLabel('Email address').focus();await page.keyboard.press('Tab');await expect(page.getByLabel(/Password/)).toBeFocused();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await expect(page.getByRole('link',{name:'Skip to content'})).toBeAttached();});
