import assert from 'node:assert/strict';
const app = process.env.TEST_APP_URL ?? 'http://localhost:3000';
if (!['localhost','127.0.0.1'].includes(new URL(app).hostname)) throw new Error('Smoke test requires a local app');
for (const path of ['/','/login','/signup','/forgot-password','/verify']) {
  const response=await fetch(`${app}${path}`,{redirect:'manual'});
  assert.equal(response.status,200,`${path} must render`);
}
const org='11111111-1111-4111-8111-111111111111';
for(const path of ['/dashboard','/candidate','/onboarding','/invitations','/organizations/new','/account/security','/admin','/reset-password',`/org/${org}`,`/org/${org}/admin`]) {
  const response=await fetch(`${app}${path}`,{redirect:'manual'});
  assert.equal(response.status,307,`${path} must reject anonymous access`);
  assert.ok(response.headers.get('location')?.includes('/login'));
  assert.ok(response.headers.get('cache-control')?.includes('no-store'));
}
assert.equal((await fetch(`${app}/toString`,{redirect:'manual'})).status,404);
console.log('HTTP smoke passed: 5 public routes, 10 protected routes, and unknown-route handling.');
