// Quick script to call the setUserRole callable function
// Replace <ID_TOKEN> with a valid Firebase ID token for an authenticated user
// and adjust the payload as needed.

const fetch = require('node-fetch');

(async () => {
  const url = 'https://asia-southeast1-interno-cec9f.cloudfunctions.net/setUserRole';
  const idToken = '<ID_TOKEN>'; // TODO: insert a valid ID token
  const payload = {
    uid: 'testUserId', // target Firebase Auth UID to modify
    role: 'trainee', // one of the allowed roles
    // optional fields (omit if not needed):
    // companyId: 'company123',
    // departmentId: 'dept456',
    // supervisorId: 'sup789',
    // traineeId: 'trainee012',
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    console.log('Response status:', response.status);
    console.log('Result:', result);
  } catch (err) {
    console.error('Error invoking setUserRole:', err);
  }
})();
