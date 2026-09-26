const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require('@firebase/rules-unit-testing');
const { readFileSync } = require('fs');
const { join } = require('path');

const PROJECT_ID = 'interno-test';
const RULES_FILE = join(__dirname, '..', 'firestore.rules');

let testEnv;

async function setupInitialData() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();

    await adminDb.collection('users').doc('admin-uid').set({
    role: 'admin',
    companyId: 'company-1',
    departmentId: 'dept-1',
    displayName: 'Admin User',
  });
  
  await adminDb.collection('users').doc('trainee-1').set({
    role: 'trainee',
    companyId: 'company-1',
    departmentId: 'dept-1',
    traineeId: 'trainee-1',
    displayName: 'Trainee User',
  });
  
  await adminDb.collection('users').doc('supervisor-1').set({
    role: 'supervisor',
    companyId: 'company-1',
    departmentId: 'dept-1',
    supervisorId: 'supervisor-1',
    displayName: 'Supervisor User',
  });
  
  await adminDb.collection('users').doc('coordinator-1').set({
    role: 'coordinator',
    companyId: 'company-1',
    departmentId: 'dept-1',
    displayName: 'Coordinator User',
  });
  
  await adminDb.collection('users').doc('other-company-user').set({
    role: 'trainee',
    companyId: 'company-2',
    departmentId: 'dept-2',
    traineeId: 'other-trainee',
    displayName: 'Other Company User',
  });
  
  await adminDb.collection('trainees').doc('trainee-1').set({
    traineeId: 'trainee-1',
    userId: 'trainee-1',
    companyId: 'company-1',
    departmentId: 'dept-1',
    status: 'active',
    ojtStatus: 'active',
    scheduleId: 'sched-1',
  });
  
  await adminDb.collection('supervisors').doc('supervisor-1').set({
    supervisorId: 'supervisor-1',
    userId: 'supervisor-1',
    companyId: 'company-1',
    departmentId: 'dept-1',
  });
  await adminDb.collection('supervisors').doc('supervisor-1')
    .collection('assignedTrainees').doc('trainee-1').set({ traineeId: 'trainee-1' });
  
  // Pre-create test documents that require Cloud Functions to create
  await adminDb.collection('qr_sessions').doc('qr-session-1').set({
    createdBy: 'supervisor-1',
    expiresAt: Date.now() + 60000,
    action: 'time_in',
    used: false,
  });
  
  await adminDb.collection('tasks').doc('task-1').set({
    traineeId: 'trainee-1',
    title: 'Test Task',
    description: 'Description',
    status: 'pending',
    priority: 'high',
    dueDate: Date.now() + 86400000,
    createdBy: 'supervisor-1',
  });
  
  await adminDb.collection('tasks').doc('task-2').set({
    traineeId: 'trainee-1',
    title: 'Test Task 2',
    description: 'Description',
    status: 'in_progress',
    priority: 'high',
    dueDate: Date.now() + 86400000,
    createdBy: 'supervisor-1',
  });
  
  await adminDb.collection('tasks').doc('task-3').set({
    traineeId: 'trainee-1',
    title: 'Test Task 3',
    description: 'Description',
    status: 'submitted',
    priority: 'high',
    dueDate: Date.now() + 86400000,
    createdBy: 'supervisor-1',
  });
  
  await adminDb.collection('dtrs').doc('dtr-1').set({
    traineeId: 'trainee-1',
    totalHours: 8,
  });
  
  await adminDb.collection('leave_requests').doc('leave-1').set({
    traineeId: 'trainee-1',
    type: 'sick',
    startDate: Date.now(),
    endDate: Date.now() + 86400000,
    reason: 'Not feeling well',
    status: 'pending',
  });
  
  await adminDb.collection('departments').doc('dept-1').set({
    departmentId: 'dept-1',
    companyId: 'company-1',
    name: 'Department 1',
  });
  
  await adminDb.collection('audit_logs').doc('log-1').set({
    userId: 'admin-uid',
    action: 'create',
    entityType: 'user',
    entityId: 'user-1',
    timestamp: Date.now(),
  });
  });
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(RULES_FILE, 'utf8'),
    },
  });
  
  await setupInitialData();
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await setupInitialData();
});

function getAdminAuth() {
  return testEnv.authenticatedContext('admin-uid', { role: 'admin', companyId: 'company-1' });
}

function getSupervisorAuth(supervisorId = 'supervisor-1') {
  return testEnv.authenticatedContext(supervisorId, {
    role: 'supervisor',
    companyId: 'company-1',
    departmentId: 'dept-1',
    supervisorId: supervisorId,
  });
}

function getTraineeAuth(traineeId = 'trainee-1') {
  return testEnv.authenticatedContext(traineeId, {
    role: 'trainee',
    companyId: 'company-1',
    departmentId: 'dept-1',
    traineeId: traineeId,
  });
}

function getCoordinatorAuth() {
  return testEnv.authenticatedContext('coordinator-1', {
    role: 'coordinator',
    companyId: 'company-1',
    departmentId: 'dept-1',
  });
}

function getOtherCompanyUser() {
  return testEnv.authenticatedContext('other-company-user', {
    role: 'trainee',
    companyId: 'company-2',
    departmentId: 'dept-2',
    traineeId: 'other-trainee',
  });
}

function getUnauthenticated() {
  return testEnv.unauthenticatedContext();
}

describe('Firestore Security Rules', () => {
  describe('Helper Functions', () => {
    test('isSignedIn should return true for authenticated users', async () => {
      const admin = getAdminAuth();
      const db = admin.firestore();
      await assertSucceeds(db.collection('users').doc('admin-uid').get());
    });

    test('should deny unauthenticated access', async () => {
      const unauth = getUnauthenticated();
      const db = unauth.firestore();
      await assertFails(db.collection('users').doc('admin-uid').get());
    });
  });

  describe('Users Collection', () => {
    test('admin can read all users', async () => {
      const admin = getAdminAuth();
      const db = admin.firestore();
      await assertSucceeds(db.collection('users').doc('trainee-1').get());
    });

    test('user can read own profile', async () => {
      const trainee = getTraineeAuth('trainee-1');
      const db = trainee.firestore();
      await assertSucceeds(db.collection('users').doc('trainee-1').get());
    });

    test('supervisor can read assigned trainees', async () => {
      const supervisor = getSupervisorAuth('supervisor-1');
      const db = supervisor.firestore();
      await assertSucceeds(db.collection('users').doc('trainee-1').get());
    });

    test('coordinator can read users in same company', async () => {
      const coordinator = getCoordinatorAuth();
      const db = coordinator.firestore();
      await assertSucceeds(db.collection('users').doc('trainee-1').get());
    });

    test('coordinator cannot read users in different company', async () => {
      const coordinator = getCoordinatorAuth();
      const db = coordinator.firestore();
      await assertFails(db.collection('users').doc('other-company-user').get());
    });

    test('admin can create user with required fields', async () => {
      const admin = getAdminAuth();
      const db = admin.firestore();
      await assertSucceeds(db.collection('users').doc('new-user').set({
        email: 'new@test.com',
        role: 'trainee',
        displayName: 'New User',
      }));
    });

    test('admin cannot create user with invalid role', async () => {
      const admin = getAdminAuth();
      const db = admin.firestore();
      await assertFails(db.collection('users').doc('new-user').set({
        email: 'new@test.com',
        role: 'invalid-role',
        displayName: 'New User',
      }));
    });

    test('user can update own displayName, photoURL, preferences', async () => {
      const trainee = getTraineeAuth('trainee-1');
      const db = trainee.firestore();
      await assertSucceeds(db.collection('users').doc('trainee-1').update({
        displayName: 'New Name',
        photoURL: 'http://example.com/photo.jpg',
        preferences: { theme: 'dark' },
      }));
    });

    test('user cannot update role or companyId', async () => {
      const trainee = getTraineeAuth('trainee-1');
      const db = trainee.firestore();
      await assertFails(db.collection('users').doc('trainee-1').update({
        role: 'admin',
      }));
    });

    test('supervisor can update trainee status', async () => {
      const supervisor = getSupervisorAuth('supervisor-1');
      const db = supervisor.firestore();
      await assertSucceeds(db.collection('users').doc('trainee-1').update({ status: 'inactive' }));
    });

    test('only admin can delete users', async () => {
      const trainee = getTraineeAuth('trainee-1');
      const db = trainee.firestore();
      await assertFails(db.collection('users').doc('trainee-1').delete());
    });
  });

  describe('Trainees Collection', () => {
    test('trainee can read own profile', async () => {
      const trainee = getTraineeAuth('trainee-1');
      const db = trainee.firestore();
      await assertSucceeds(db.collection('trainees').doc('trainee-1').get());
    });

    test('supervisor can read assigned trainee', async () => {
      const supervisor = getSupervisorAuth('supervisor-1');
      const db = supervisor.firestore();
      await assertSucceeds(db.collection('trainees').doc('trainee-1').get());
    });

    test('admin can create trainee with required fields', async () => {
      const admin = getAdminAuth();
      const db = admin.firestore();
      await assertSucceeds(db.collection('trainees').doc('trainee-new').set({
        userId: 'user-new',
        companyId: 'company-1',
        departmentId: 'dept-1',
        status: 'pending',
        ojtStatus: 'pending',
        scheduleId: 'sched-1',
      }));
    });

    test('supervisor can update assigned trainee status', async () => {
      const supervisor = getSupervisorAuth('supervisor-1');
      const db = supervisor.firestore();
      await assertSucceeds(db.collection('trainees').doc('trainee-1').update({
        status: 'inactive',
        ojtStatus: 'on_leave',
      }));
    });

    test('trainee can update own profile and emergencyContact', async () => {
      const trainee = getTraineeAuth('trainee-1');
      const db = trainee.firestore();
      await assertSucceeds(db.collection('trainees').doc('trainee-1').update({
        profile: { phone: '1234567890' },
        emergencyContact: { name: 'Parent', phone: '0987654321' },
      }));
    });
  });

  describe('Supervisors Collection', () => {
    test('supervisor can read own profile', async () => {
      const supervisor = getSupervisorAuth('supervisor-1');
      const db = supervisor.firestore();
      await assertSucceeds(db.collection('supervisors').doc('supervisor-1').get());
    });

    test('coordinator can read supervisors in same company', async () => {
      const coordinator = getCoordinatorAuth();
      const db = coordinator.firestore();
      await assertSucceeds(db.collection('supervisors').doc('supervisor-1').get());
    });

    test('admin can create supervisor', async () => {
      const admin = getAdminAuth();
      const db = admin.firestore();
      await assertSucceeds(db.collection('supervisors').doc('sup-new').set({
        userId: 'user-new',
        companyId: 'company-1',
        departmentId: 'dept-1',
      }));
    });
  });

  describe('Companies Collection', () => {
    test('admin can read any company', async () => {
      const admin = getAdminAuth();
      const db = admin.firestore();
      await assertSucceeds(db.collection('companies').doc('company-2').get());
    });

    test('user can read own company', async () => {
      const trainee = getTraineeAuth('trainee-1');
      const db = trainee.firestore();
      await assertSucceeds(db.collection('companies').doc('company-1').get());
    });

    test('user cannot read other company', async () => {
      const trainee = getTraineeAuth('trainee-1');
      const db = trainee.firestore();
      await assertFails(db.collection('companies').doc('company-2').get());
    });
  });

  describe('Departments Collection', () => {
    test('admin can read any department', async () => {
      const admin = getAdminAuth();
      const db = admin.firestore();
      await assertSucceeds(db.collection('departments').doc('dept-2').get());
    });

    test('user can read department in own company', async () => {
      const trainee = getTraineeAuth('trainee-1');
      const db = trainee.firestore();
      await assertSucceeds(db.collection('departments').doc('dept-1').get());
    });
  });

  describe('Attendance Records', () => {
    test('trainee can create time_in record', async () => {
      const trainee = getTraineeAuth('trainee-1');
      const db = trainee.firestore();
      await assertSucceeds(db.collection('attendance_records').add({
        traineeId: 'trainee-1',
        type: 'time_in',
        timestamp: Date.now(),
        qrSessionId: 'qr-123',
        deviceInfo: { platform: 'mobile' },
      }));
    });

    test('trainee cannot create time_out without time_in', async () => {
      const trainee = getTraineeAuth('trainee-1');
      const db = trainee.firestore();
      await assertFails(db.collection('attendance_records').add({
        traineeId: 'trainee-1',
        type: 'time_out',
        timestamp: Date.now(),
        qrSessionId: 'qr-123',
        deviceInfo: { platform: 'mobile' },
      }));
    });

    test('attendance records are immutable', async () => {
      const admin = getAdminAuth();
      const db = admin.firestore();
      const docRef = await db.collection('attendance_records').add({
        traineeId: 'trainee-1',
        type: 'time_in',
        timestamp: Date.now(),
        qrSessionId: 'qr-123',
        deviceInfo: { platform: 'mobile' },
      });
      await assertFails(docRef.update({ type: 'time_out' }));
    });

    test('trainee can read own attendance', async () => {
      const trainee = getTraineeAuth('trainee-1');
      const db = trainee.firestore();
      const docRef = await db.collection('attendance_records').add({
        traineeId: 'trainee-1',
        type: 'time_in',
        timestamp: Date.now(),
        qrSessionId: 'qr-123',
        deviceInfo: { platform: 'mobile' },
      });
      await assertSucceeds(docRef.get());
    });
  });

  describe('QR Sessions', () => {
    test('supervisor can read own QR sessions', async () => {
      const supervisor = getSupervisorAuth('supervisor-1');
      const db = supervisor.firestore();
      await assertSucceeds(db.collection('qr_sessions').doc('qr-session-1').get());
    });

    test('client cannot create QR sessions', async () => {
      const supervisor = getSupervisorAuth('supervisor-1');
      const db = supervisor.firestore();
      await assertFails(db.collection('qr_sessions').add({
        createdBy: 'supervisor-1',
        expiresAt: Date.now() + 60000,
        action: 'time_in',
        used: false,
      }));
    });

    test('client cannot update QR sessions', async () => {
      const admin = getAdminAuth();
      const db = admin.firestore();
      await assertFails(db.collection('qr_sessions').doc('qr-session-1').update({ used: true }));
    });
  });

  describe('Tasks Collection', () => {
    test('supervisor can create task for assigned trainee', async () => {
      const supervisor = getSupervisorAuth('supervisor-1');
      const db = supervisor.firestore();
      await assertSucceeds(db.collection('tasks').add({
        traineeId: 'trainee-1',
        title: 'Test Task',
        description: 'Description',
        status: 'pending',
        priority: 'high',
        dueDate: Date.now() + 86400000,
        createdBy: 'supervisor-1',
      }));
    });

    test('trainee can update own task status to in_progress', async () => {
      const trainee = getTraineeAuth('trainee-1');
      const db = trainee.firestore();
      await assertSucceeds(db.collection('tasks').doc('task-1').update({ status: 'in_progress' }));
    });

    test('trainee can submit task', async () => {
      const trainee = getTraineeAuth('trainee-1');
      const db = trainee.firestore();
      await assertSucceeds(db.collection('tasks').doc('task-2').update({ status: 'submitted', submission: 'Done' }));
    });

    test('supervisor can approve task', async () => {
      const supervisor = getSupervisorAuth('supervisor-1');
      const db = supervisor.firestore();
      await assertSucceeds(db.collection('tasks').doc('task-3').update({
        status: 'approved',
        approvedAt: Date.now(),
        approvedBy: 'supervisor-1',
      }));
    });
  });

  describe('Documents Collection', () => {
    test('trainee can upload document', async () => {
      const trainee = getTraineeAuth('trainee-1');
      const db = trainee.firestore();
      await assertSucceeds(db.collection('documents').add({
        traineeId: 'trainee-1',
        type: 'medical',
        fileName: 'medical.pdf',
        fileUrl: 'https://storage.example.com/medical.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        status: 'pending',
      }));
    });

    test('supervisor can approve document', async () => {
      const supervisor = getSupervisorAuth('supervisor-1');
      const db = supervisor.firestore();
      const docRef = await db.collection('documents').add({
        traineeId: 'trainee-1',
        type: 'medical',
        fileName: 'medical.pdf',
        fileUrl: 'https://storage.example.com/medical.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        status: 'pending',
      });
      await assertSucceeds(docRef.update({
        status: 'approved',
        reviewedBy: 'supervisor-1',
        reviewedAt: Date.now(),
      }));
    });
  });

  describe('DTRs Collection', () => {
    test('client cannot create DTRs', async () => {
      const admin = getAdminAuth();
      const db = admin.firestore();
      await assertFails(db.collection('dtrs').add({
        traineeId: 'trainee-1',
        totalHours: 8,
      }));
    });

    test('trainee can read own DTR', async () => {
      const trainee = getTraineeAuth('trainee-1');
      const db = trainee.firestore();
      await assertSucceeds(db.collection('dtrs').doc('dtr-1').get());
    });
  });

  describe('Leave Requests', () => {
    test('trainee can create leave request', async () => {
      const trainee = getTraineeAuth('trainee-1');
      const db = trainee.firestore();
      await assertSucceeds(db.collection('leave_requests').add({
        traineeId: 'trainee-1',
        type: 'sick',
        startDate: Date.now(),
        endDate: Date.now() + 86400000,
        reason: 'Not feeling well',
        status: 'pending',
      }));
    });

    test('supervisor can approve leave request', async () => {
      const supervisor = getSupervisorAuth('supervisor-1');
      const db = supervisor.firestore();
      await assertSucceeds(db.collection('leave_requests').doc('leave-1').update({
        status: 'approved',
        approvedBy: 'supervisor-1',
        approvedAt: Date.now(),
      }));
    });
  });

  describe('Audit Logs', () => {
    test('admin can read audit logs', async () => {
      const admin = getAdminAuth();
      const db = admin.firestore();
      await assertSucceeds(db.collection('audit_logs').doc('log-1').get());
    });

    test('non-admin cannot read audit logs', async () => {
      const trainee = getTraineeAuth('trainee-1');
      const db = trainee.firestore();
      await assertFails(db.collection('audit_logs').doc('log-1').get());
    });

    test('client cannot write audit logs', async () => {
      const trainee = getTraineeAuth('trainee-1');
      const db = trainee.firestore();
      await assertFails(db.collection('audit_logs').add({
        userId: 'trainee-1',
        action: 'create',
        entityType: 'user',
        entityId: 'user-1',
      }));
    });
  });

  describe('Settings Collection', () => {
    test('admin can read settings', async () => {
      const admin = getAdminAuth();
      const db = admin.firestore();
      await assertSucceeds(db.collection('settings').doc('general').get());
    });

    test('coordinator can read settings', async () => {
      const coordinator = getCoordinatorAuth();
      const db = coordinator.firestore();
      await assertSucceeds(db.collection('settings').doc('general').get());
    });

    test('trainee cannot read settings', async () => {
      const trainee = getTraineeAuth('trainee-1');
      const db = trainee.firestore();
      await assertFails(db.collection('settings').doc('general').get());
    });
  });

  describe('Create rules use request.resource (resource is null on create)', () => {
    test('trainee can create own task comment', async () => {
      const db = getTraineeAuth('trainee-1').firestore();
      await assertSucceeds(db.collection('task_comments').add({
        taskId: 'task-1',
        userId: 'trainee-1',
        content: 'Looks good',
      }));
    });

    test('trainee cannot create task comment on behalf of another user', async () => {
      const db = getTraineeAuth('trainee-1').firestore();
      await assertFails(db.collection('task_comments').add({
        taskId: 'task-1',
        userId: 'supervisor-1',
        content: 'Spoofed',
      }));
    });

    test('trainee can create task document for own traineeId', async () => {
      const db = getTraineeAuth('trainee-1').firestore();
      await assertSucceeds(db.collection('task_documents').add({
        traineeId: 'trainee-1',
        taskId: 'task-1',
        fileName: 'output.pdf',
        fileUrl: 'https://example.com/output.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
      }));
    });

    test('trainee cannot create task document for another trainee', async () => {
      const db = getTraineeAuth('trainee-1').firestore();
      await assertFails(db.collection('task_documents').add({
        traineeId: 'other-trainee',
        taskId: 'task-1',
        fileName: 'output.pdf',
        fileUrl: 'https://example.com/output.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
      }));
    });

    test('supervisor can create task approval for assigned trainee', async () => {
      const db = getSupervisorAuth('supervisor-1').firestore();
      await assertSucceeds(db.collection('task_approvals').add({
        taskId: 'task-1',
        traineeId: 'trainee-1',
        status: 'approved',
      }));
    });

    test('trainee cannot create task approval', async () => {
      const db = getTraineeAuth('trainee-1').firestore();
      await assertFails(db.collection('task_approvals').add({
        taskId: 'task-1',
        traineeId: 'trainee-1',
        status: 'approved',
      }));
    });

    test('trainee can create own profile image record', async () => {
      const db = getTraineeAuth('trainee-1').firestore();
      await assertSucceeds(db.collection('profile_images').add({
        userId: 'trainee-1',
        url: 'https://example.com/pic.jpg',
      }));
    });

    test('trainee cannot create profile image record for another user', async () => {
      const db = getTraineeAuth('trainee-1').firestore();
      await assertFails(db.collection('profile_images').add({
        userId: 'supervisor-1',
        url: 'https://example.com/pic.jpg',
      }));
    });
  });

  describe('Supervisor status updates scoped to assigned trainees', () => {
    test('supervisor cannot update status of a non-trainee user', async () => {
      const db = getSupervisorAuth('supervisor-1').firestore();
      await assertFails(db.collection('users').doc('coordinator-1').update({ status: 'inactive' }));
    });

    test('supervisor cannot update status of a supervisor user', async () => {
      const db = getSupervisorAuth('supervisor-1').firestore();
      await assertFails(db.collection('users').doc('supervisor-1').update({ status: 'inactive' }));
    });

    test('supervisor cannot update status of an unassigned trainee', async () => {
      const db = getSupervisorAuth('supervisor-2').firestore();
      await assertFails(db.collection('users').doc('trainee-1').update({ status: 'inactive' }));
    });

    test('supervisor cannot update status of a trainee in another company', async () => {
      const db = getSupervisorAuth('supervisor-1').firestore();
      await assertFails(db.collection('users').doc('other-company-user').update({ status: 'inactive' }));
    });

    test('supervisor cannot update fields other than status on assigned trainee', async () => {
      const db = getSupervisorAuth('supervisor-1').firestore();
      await assertFails(db.collection('users').doc('trainee-1').update({ displayName: 'Renamed' }));
    });
  });
});