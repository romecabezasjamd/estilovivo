import { PrismaClient } from '@prisma/client';

async function testRecoveryFlow() {
  const prisma = new PrismaClient();
  const email = `test-recovery-${Date.now()}@example.com`;
  const apiBase = 'http://localhost:3000';

  console.log('--- STARTING PASSWORD RECOVERY E2E TEST ---');

  // 1. Register user
  console.log('1. Registering user...');
  const regRes = await fetch(`${apiBase}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'oldpassword123', name: 'Test User' })
  });
  console.log('Register status:', regRes.status);
  const regData = await regRes.json();
  console.log('Register response:', regData);

  // 2. Request forgot-password
  console.log('2. Requesting forgot password...');
  const forgotRes = await fetch(`${apiBase}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  console.log('Forgot status:', forgotRes.status);
  const forgotData = await forgotRes.json();
  console.log('Forgot response:', forgotData);

  // 3. Query token from database
  console.log('3. Querying reset token from database...');
  const user = await prisma.user.findFirst({
    where: { email }
  });
  if (!user || !user.resetToken) {
    throw new Error('User or reset token not found in database!');
  }
  const token = user.resetToken;
  console.log('Found token:', token);
  console.log('Expiry:', user.resetTokenExpiry);

  // 4. Test GET /reset-password/:token (the email link)
  console.log('4. Testing GET /reset-password/:token redirect...');
  const getUrl = `${apiBase}/reset-password/${token}`;
  const getRes = await fetch(getUrl, { redirect: 'manual' });
  console.log('GET status:', getRes.status);
  const location = getRes.headers.get('location');
  console.log('Redirect Location:', location);
  if (!location || !location.includes(`token=${token}`) || !location.includes('type=reset')) {
    throw new Error('GET /reset-password/:token did not redirect correctly to frontend!');
  }
  console.log('GET /reset-password/:token redirect verified successfully!');

  // 5. Test POST /reset-password (submitting the new password)
  console.log('5. Testing POST /reset-password...');
  const postRes = await fetch(`${apiBase}/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password: 'newpassword123' })
  });
  console.log('POST status:', postRes.status);
  const postData = await postRes.json();
  console.log('POST response:', postData);
  if (postRes.status !== 200 || !postData.success) {
    throw new Error('POST /reset-password failed!');
  }

  // 6. Verify token is cleared in DB
  console.log('6. Verifying token is cleared in database...');
  const updatedUser = await prisma.user.findUnique({
    where: { id: user.id }
  });
  console.log('ResetToken after reset:', updatedUser.resetToken);
  console.log('ResetTokenExpiry after reset:', updatedUser.resetTokenExpiry);
  if (updatedUser.resetToken !== null || updatedUser.resetTokenExpiry !== null) {
    throw new Error('Reset token fields were not cleared after reset!');
  }

  // 7. Verify we can log in with new password
  console.log('7. Verifying login with new password...');
  const loginRes = await fetch(`${apiBase}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'newpassword123' })
  });
  console.log('Login status:', loginRes.status);
  const loginData = await loginRes.json();
  console.log('Login response:', loginData.token ? 'Login Success (token present)' : 'Login Failed');
  if (loginRes.status !== 200 || !loginData.token) {
    throw new Error('Login with new password failed!');
  }

  console.log('--- ALL TESTS PASSED SUCCESSFULLY! ---');
  await prisma.$disconnect();
}

testRecoveryFlow().catch(async (err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
