const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require('@firebase/rules-unit-testing');
const { readFileSync } = require('fs');
const { join } = require('path');

// Cross-service firestore.exists()/get() calls are pinned to the project the
// emulators were started with (.firebaserc default), NOT this test env's id.
// Using any other id makes every cross-service lookup resolve against an empty
// project and silently deny.
const PROJECT_ID = JSON.parse(readFileSync(join(__dirname, '.firebaserc'), 'utf8')).projects.default;
const BUCKET = `gs://${PROJECT_ID}.firebasestorage.app`;
const RULES_FILE = join(__dirname, 'storage.rules');

jest.setTimeout(30000);

let testEnv;

function ctx(uid, token) {
  return testEnv.authenticatedContext(uid, token);
}

const adminCtx = () => ctx('admin-uid', { role: 'admin', companyId: 'company-1' });
const trainee1Ctx = () =>
  ctx('trainee-1', { role: 'trainee', companyId: 'company-1', traineeId: 'trainee-1' });
const trainee2Ctx = () =>
  ctx('trainee-2', { role: 'trainee', companyId: 'company-1', traineeId: 'trainee-2' });
const assignedSupCtx = () =>
  ctx('supervisor-1', { role: 'supervisor', companyId: 'company-1' });
const unassignedSupCtx = () =>
  ctx('supervisor-2', { role: 'supervisor', companyId: 'company-1' });
const coordinatorCtx = () =>
  ctx('coordinator-1', { role: 'coordinator', companyId: 'company-1' });
const otherCompanyTraineeCtx = () =>
  ctx('other-trainee', { role: 'trainee', companyId: 'company-2', traineeId: 'other-trainee' });

const DOC_T1 = 'documents/company-1/trainee-1/mariana_medical_cert.pdf';
const DOC_T2 = 'documents/company-1/trainee-2/juan_medical_cert.pdf';
const TASK_DOC = 'tasks/company-1/task-1/output.pdf';

async function seedFirestore() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.collection('supervisors').doc('supervisor-1').set({
      companyId: 'company-1',
      assignedTrainees: ['trainee-1'],
    });
    await db.collection('supervisors').doc('supervisor-1')
      .collection('assignedTrainees').doc('trainee-1').set({ traineeId: 'trainee-1' });
    await db.collection('tasks').doc('task-1').set({
      traineeId: 'trainee-1',
      companyId: 'company-1',
      title: 'Task 1',
    });
  });
}

async function uploadAs(context, path, customMetadata) {
  const storage = context.storage(BUCKET);
  await storage.ref(path).put(Buffer.from('%PDF-1.4 test'), {
    contentType: 'application/pdf',
    ...(customMetadata ? { customMetadata } : {}),
  });
}

async function seedStorage() {
  const admin = adminCtx();
  await uploadAs(admin, DOC_T1, { owner: 'trainee-1' });
  await uploadAs(admin, DOC_T2, { owner: 'trainee-2' });
  // Legacy-style object: no owner metadata (uploaded before FIX-08).
  await uploadAs(admin, TASK_DOC);
}

function canRead(context, path) {
  return assertSucceeds(context.storage(BUCKET).ref(path).getDownloadURL());
}

function cannotRead(context, path) {
  return assertFails(context.storage(BUCKET).ref(path).getDownloadURL());
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync(join(__dirname, 'firestore.rules'), 'utf8') },
    storage: { rules: readFileSync(RULES_FILE, 'utf8') },
  });
  await seedFirestore();
  await seedStorage();
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearStorage();
  await seedStorage();
});

describe('Storage Security Rules - documents', () => {
  test('owner trainee can read own document', async () => {
    await canRead(trainee1Ctx(), DOC_T1);
  });

  test('same-company trainee cannot read another trainee document', async () => {
    await cannotRead(trainee2Ctx(), DOC_T1);
  });

  test('trainee from another company cannot read document', async () => {
    await cannotRead(otherCompanyTraineeCtx(), DOC_T1);
  });

  test('assigned supervisor can read trainee document', async () => {
    await canRead(assignedSupCtx(), DOC_T1);
  });

  test('unassigned supervisor cannot read trainee document', async () => {
    await cannotRead(unassignedSupCtx(), DOC_T1);
  });

  test('coordinator can read trainee document in same company', async () => {
    await canRead(coordinatorCtx(), DOC_T1);
  });

  test('admin can read any document', async () => {
    await canRead(adminCtx(), DOC_T1);
  });

  test('owner can delete own document (FIX-09: resource not request.resource)', async () => {
    const storage = trainee1Ctx().storage(BUCKET);
    await assertSucceeds(storage.ref(DOC_T1).delete());
  });

  test('same-company trainee cannot delete another trainee document', async () => {
    const storage = trainee2Ctx().storage(BUCKET);
    await assertFails(storage.ref(DOC_T1).delete());
  });

  test('unassigned supervisor cannot delete trainee document', async () => {
    const storage = unassignedSupCtx().storage(BUCKET);
    await assertFails(storage.ref(DOC_T1).delete());
  });

  test('coordinator can delete trainee document in same company', async () => {
    const storage = coordinatorCtx().storage(BUCKET);
    await assertSucceeds(storage.ref(DOC_T1).delete());
  });
});

describe('Storage Security Rules - task attachments', () => {
  test('assigned trainee can read own task attachment', async () => {
    await canRead(trainee1Ctx(), TASK_DOC);
  });

  test('other trainee cannot read task attachment', async () => {
    await cannotRead(trainee2Ctx(), TASK_DOC);
  });

  test('supervisor in same company can read task attachment', async () => {
    await canRead(unassignedSupCtx(), TASK_DOC);
  });

  test('trainee from another company cannot read task attachment', async () => {
    await cannotRead(otherCompanyTraineeCtx(), TASK_DOC);
  });

  test('admin can read task attachment', async () => {
    await canRead(adminCtx(), TASK_DOC);
  });
});
