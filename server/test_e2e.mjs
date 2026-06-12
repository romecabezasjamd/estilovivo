import http from 'http';

const API = 'http://localhost:3001';

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'localhost', port: 3001, path, headers: { 'Content-Type': 'application/json' } };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  const email = `test-${Date.now()}@example.com`;
  
  // Test register
  const reg = await request('POST', '/api/auth/register', { email, password: 'password123', name: 'Test' });
  console.log('REGISTER:', reg.status, JSON.stringify(reg.body).substring(0, 200));

  // Test login with correct credentials
  const login = await request('POST', '/api/auth/login', { email, password: 'password123' });
  console.log('LOGIN OK:', login.status, JSON.stringify(reg.body).substring(0, 100));
  if (login.status !== 200) {
    console.log('LOGIN FAILED! Body:', JSON.stringify(login.body));
  }

  // Test login with wrong credentials
  const bad = await request('POST', '/api/auth/login', { email, password: 'wrong' });
  console.log('LOGIN BAD:', bad.status, JSON.stringify(bad.body).substring(0, 100));

  // Test forgot-password
  const forgot = await request('POST', '/api/auth/forgot-password', { email });
  console.log('FORGOT:', forgot.status, JSON.stringify(forgot.body).substring(0, 200));

  // Test forgot-password with invalid email
  const forgotBad = await request('POST', '/api/auth/forgot-password', { email: 'nonexistent@test.com' });
  console.log('FORGOT BAD:', forgotBad.status, JSON.stringify(forgotBad.body).substring(0, 200));
}

main().catch(console.error);
