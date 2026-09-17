/**
 * Paste this entire script into the browser console while signed in as the supervisor.
 * It checks auth claims, users doc, supervisors doc, and trainee access.
 */
(async () => {
  const auth = firebase.auth();
  const db = firebase.firestore();
  const user = auth.currentUser;

  if (!user) {
    console.error('Not signed in');
    return;
  }

  console.log('=== SUPERVISOR DIAGNOSTIC ===');
  console.log('Auth UID:', user.uid);

  // 1. Check custom claims
  try {
    const tokenResult = await user.getIdTokenResult(true);
    console.log('Custom claims:', tokenResult.claims);
    console.log('Role from claims:', tokenResult.claims.role ?? 'NOT SET');
  } catch (e) {
    console.error('Failed to get token claims:', e);
  }

  // 2. Check users/{uid} doc
  try {
    const userDoc = await db.collection('users').doc(user.uid).get();
    if (userDoc.exists) {
      console.log('users/' + user.uid + ':', userDoc.data());
    } else {
      console.warn('users/' + user.uid + ': DOCUMENT DOES NOT EXIST');
    }
  } catch (e) {
    console.error('Failed to read users doc:', e);
  }

  // 3. Check supervisors/{uid} doc
  try {
    const supDoc = await db.collection('supervisors').doc(user.uid).get();
    if (supDoc.exists) {
      console.log('supervisors/' + user.uid + ':', supDoc.data());
    } else {
      console.warn('supervisors/' + user.uid + ': DOCUMENT DOES NOT EXIST');
    }
  } catch (e) {
    console.error('Failed to read supervisors doc:', e);
  }

  // 4. Try querying trainees where supervisorId == uid
  try {
    const traineeSnap = await db.collection('trainees').where('supervisorId', '==', user.uid).get();
    console.log('Trainees with supervisorId==' + user.uid + ':', traineeSnap.size, 'docs');
    traineeSnap.forEach(doc => {
      console.log('  -', doc.id, doc.data());
    });
  } catch (e) {
    console.error('Query trainees by supervisorId FAILED:', e.message);
  }

  // 5. Check assignedTrainees subcollection
  try {
    const assignedSnap = await db.collection('supervisors').doc(user.uid).collection('assignedTrainees').get();
    console.log('Assigned trainees subcollection:', assignedSnap.size, 'docs');
    assignedSnap.forEach(doc => {
      console.log('  -', doc.id, doc.data());
    });
  } catch (e) {
    console.error('Failed to read assignedTrainees subcollection:', e.message);
  }

  // 6. List ALL trainee documents (admin-level check)
  try {
    const allTrainees = await db.collection('trainees').limit(20).get();
    console.log('All trainees in DB (first 20):');
    allTrainees.forEach(doc => {
      const d = doc.data();
      console.log('  -', doc.id, 'supervisorId:', d.supervisorId || '(empty)', 'userId:', d.userId || '?');
    });
  } catch (e) {
    console.error('Failed to list all trainees:', e.message);
  }

  console.log('=== END DIAGNOSTIC ===');
})();
