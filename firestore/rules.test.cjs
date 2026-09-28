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
    supervisorId: 'supervisor-1',
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
    companyId: 'company-1',
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
    companyId: 'company-1',
    totalHours: 8,
  });

  await adminDb.collection('attendance_records').doc('att-1')
    .collection('correction_requests').doc('corr-1').set({
      requestedBy: 'trainee-1',
      reason: 'Forgot time out',
      originalValue: '17:00',
      proposedValue: '17:30',
      status: 'pending',
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

  await adminDb.collection('trainees').doc('other-trainee').set({
    traineeId: 'other-trainee',
    userId: 'other-company-user',
    companyId: 'company-2',
    departmentId: 'dept-2',
    status: 'active',
    ojtStatus: 'active',
    scheduleId: 'sched-2',
  });

  await adminDb.collection('attendance_records').doc('att-1').set({
    traineeId: 'trainee-1',
    type: 'time_in',
    timestamp: Date.now(),
    qrSessionId: 'qr-session-1',
    deviceInfo: { platform: 'mobile' },
  });

  await adminDb.collection('attendance_records').doc('att-other').set({
    traineeId: 'other-trainee',
    type: 'time_in',
    timestamp: Date.now(),
    qrSessionId: 'qr-other',
    deviceInfo: { platform: 'mobile' },
  });

  await adminDb.collection('leave_requests').doc('leave-2').set({
    traineeId: 'other-trainee',
    companyId: 'company-2',
    type: 'sick',
    startDate: Date.now(),
    endDate: Date.now() + 86400000,
    reason: 'Other company leave',
    status: 'pending',
  });

  await adminDb.collection('dtrs').doc('dtr-other').set({
    traineeId: 'other-trainee',
    companyId: 'company-2',
    totalHours: 8,
  });

  await adminDb.collection('documents').doc('doc-other').set({
    traineeId: 'other-trainee',
    companyId: 'company-2',
    type: 'medical',
    fileName: 'other.pdf',
    fileUrl: 'https://storage.example.com/other.pdf',
    fileSize: 1024,
    mimeType: 'application/pdf',
    status: 'pending',
  });

  await adminDb.collection('tasks').doc('task-other').set({
    traineeId: 'other-trainee',
    companyId: 'company-2',
    title: 'Other Company Task',
    description: 'Description',
    status: 'pending',
    priority: 'high',
    dueDate: Date.now() + 86400000,
    createdBy: 'supervisor-2',
  });

  await adminDb.collection('task_approvals').doc('approval-1').set({
    taskId: 'task-1',
    traineeId: 'trainee-1',
    status: 'approved',
  });

  await adminDb.collection('task_approvals').doc('approval-other').set({
    taskId: 'task-other',
    traineeId: 'other-trainee',
    status: 'approved',
  });

  await adminDb.collection('task_comments').doc('comment-1').set({
    taskId: 'task-1',
    userId: 'supervisor-1',
    content: 'Assigned comment',
  });

  await adminDb.collection('task_comments').doc('comment-other').set({
    taskId: 'task-other',
    userId: 'supervisor-2',
    content: 'Other company comment',
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

function getOtherCompanySupervisor() {
  return testEnv.authenticatedContext('supervisor-2', {
    role: 'supervisor',
    companyId: 'company-2',
    departmentId: 'dept-2',
    supervisorId: 'supervisor-2',
  });
}

function getOtherCompanyCoordinator() {
  return testEnv.authenticatedContext('coordinator-2', {
    role: 'coordinator',
    companyId: 'company-2',
    departmentId: 'dept-2',
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

    test('supervisor can update assigned trainee ojtHoursCompleted, milestonesNotified, and updatedAt', async () => {
      const supervisor = getSupervisorAuth('supervisor-1');
      const db = supervisor.firestore();
      await assertSucceeds(db.collection('trainees').doc('trainee-1').update({
        ojtHoursCompleted: 120,
        milestonesNotified: ['50%', '100%'],
        updatedAt: Date.now(),
      }));
    });

    test('coordinator can update trainee ojtHoursCompleted, milestonesNotified, ojtStatus, scheduleId', async () => {
      const coordinator = getCoordinatorAuth();
      const db = coordinator.firestore();
      await assertSucceeds(db.collection('trainees').doc('trainee-1').update({
        ojtHoursCompleted: 150.5,
        milestonesNotified: ['75%'],
        ojtStatus: 'completed',
        scheduleId: 'sched-2',
        updatedAt: Date.now(),
      }));
    });

    test('admin can update trainee ojtHoursCompleted and milestonesNotified', async () => {
      const admin = getAdminAuth();
      const db = admin.firestore();
      await assertSucceeds(db.collection('trainees').doc('trainee-1').update({
        ojtHoursCompleted: 200,
        milestonesNotified: ['100%'],
      }));
    });

    test('supervisor cannot update ojtHoursCompleted with non-number', async () => {
      const supervisor = getSupervisorAuth('supervisor-1');
      const db = supervisor.firestore();
      await assertFails(db.collection('trainees').doc('trainee-1').update({
        ojtHoursCompleted: 'one hundred',
      }));
    });

    test('supervisor cannot update milestonesNotified with non-list', async () => {
      const supervisor = getSupervisorAuth('supervisor-1');
      const db = supervisor.firestore();
      await assertFails(db.collection('trainees').doc('trainee-1').update({
        milestonesNotified: 'not-a-list',
      }));
    });

    test('trainee cannot update ojtHoursCompleted or milestonesNotified', async () => {
      const trainee = getTraineeAuth('trainee-1');
      const db = trainee.firestore();
      await assertFails(db.collection('trainees').doc('trainee-1').update({
        ojtHoursCompleted: 300,
      }));
      await assertFails(db.collection('trainees').doc('trainee-1').update({
        milestonesNotified: ['100%'],
      }));
    });

    test('other company supervisor cannot update trainee', async () => {
      const supervisor = getOtherCompanySupervisor();
      const db = supervisor.firestore();
      await assertFails(db.collection('trainees').doc('trainee-1').update({
        ojtHoursCompleted: 50,
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
    test('trainee cannot create attendance (CF validateQRScan owns writes - QR forgery prevention)', async () => {
      const trainee = getTraineeAuth('trainee-1');
      const db = trainee.firestore();
      await assertFails(db.collection('attendance_records').add({
        traineeId: 'trainee-1',
        type: 'time_in',
        timestamp: Date.now(),
        qrSessionId: 'qr-123',
        deviceInfo: { platform: 'mobile' },
      }));
    });

    test('admin cannot create attendance from the client either (Admin SDK bypasses rules)', async () => {
      const admin = getAdminAuth();
      const db = admin.firestore();
      await assertFails(db.collection('attendance_records').add({
        traineeId: 'trainee-1',
        type: 'time_in',
        timestamp: Date.now(),
        qrSessionId: 'qr-123',
        deviceInfo: { platform: 'mobile' },
      }));
    });

    test('attendance records are immutable', async () => {
      const admin = getAdminAuth();
      const db = admin.firestore();
      await assertFails(db.collection('attendance_records').doc('att-1').update({ type: 'time_out' }));
    });

    test('trainee can read own attendance', async () => {
      const trainee = getTraineeAuth('trainee-1');
      const db = trainee.firestore();
      await assertSucceeds(db.collection('attendance_records').doc('att-1').get());
    });

    test('trainee cannot read another trainee attendance', async () => {
      const trainee = getTraineeAuth('trainee-1');
      const db = trainee.firestore();
      await assertFails(db.collection('attendance_records').doc('att-other').get());
    });

    test('supervisor of another company cannot read attendance', async () => {
      const db = getOtherCompanySupervisor().firestore();
      await assertFails(db.collection('attendance_records').doc('att-1').get());
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

    test('supervisor can edit task details (title, description, priority, dueDate, estimatedHours, requireAttachment)', async () => {
      const supervisor = getSupervisorAuth('supervisor-1');
      const db = supervisor.firestore();
      await assertSucceeds(db.collection('tasks').doc('task-1').update({
        title: 'Updated Task Title',
        description: 'Updated Task Description',
        priority: 'urgent',
        dueDate: Date.now() + 172800000,
        estimatedHours: 10,
        requireAttachment: true,
        updatedAt: Date.now(),
      }));
    });

    test('supervisor can unarchive task back to pending', async () => {
      const supervisor = getSupervisorAuth('supervisor-1');
      const db = supervisor.firestore();
      await assertSucceeds(db.collection('tasks').doc('task-1').update({
        status: 'pending',
        updatedAt: Date.now(),
      }));
    });

    test('supervisor cannot update task with title exceeding 300 characters', async () => {
      const supervisor = getSupervisorAuth('supervisor-1');
      const db = supervisor.firestore();
      await assertFails(db.collection('tasks').doc('task-1').update({
        title: 'a'.repeat(301),
      }));
    });

    test('supervisor cannot update task with invalid status', async () => {
      const supervisor = getSupervisorAuth('supervisor-1');
      const db = supervisor.firestore();
      await assertFails(db.collection('tasks').doc('task-1').update({
        status: 'invalid_status',
      }));
    });

    test('supervisor can update task notification flags (dueSoonNotified, overdueNotified)', async () => {
      const supervisor = getSupervisorAuth('supervisor-1');
      const db = supervisor.firestore();
      await assertSucceeds(db.collection('tasks').doc('task-1').update({
        dueSoonNotified: true,
        overdueNotified: false,
        updatedAt: Date.now(),
      }));
    });

    test('supervisor cannot update task notification flags with non-boolean values', async () => {
      const supervisor = getSupervisorAuth('supervisor-1');
      const db = supervisor.firestore();
      await assertFails(db.collection('tasks').doc('task-1').update({
        dueSoonNotified: 'yes',
      }));
      await assertFails(db.collection('tasks').doc('task-1').update({
        overdueNotified: 123,
      }));
    });

    test('user with supervisor doc in firestore but no custom claim can create and update tasks', async () => {
      // User has supervisor document created in setupInitialData ('supervisor-1'), but token has no custom claims
      const plainAuth = testEnv.authenticatedContext('supervisor-1', {});
      const db = plainAuth.firestore();
      await assertSucceeds(db.collection('tasks').add({
        traineeId: 'trainee-1',
        title: 'Task by doc supervisor',
        description: 'Description',
        status: 'pending',
        priority: 'medium',
        dueDate: Date.now() + 86400000,
        createdBy: 'supervisor-1',
      }));
      await assertSucceeds(db.collection('tasks').doc('task-1').update({
        title: 'Updated by doc supervisor',
        description: 'New Description',
        progress: 50,
        updatedAt: Date.now(),
      }));
    });

    test('user who created the task without supervisor claim can edit task', async () => {
      const creatorAuth = testEnv.authenticatedContext('supervisor-1', {});
      const db = creatorAuth.firestore();
      await assertSucceeds(db.collection('tasks').doc('task-1').update({
        title: 'Edited by creator',
        updatedAt: Date.now(),
      }));
    });

    test('trainee cannot edit task title', async () => {
      const trainee = getTraineeAuth('trainee-1');
      const db = trainee.firestore();
      await assertFails(db.collection('tasks').doc('task-1').update({
        title: 'Hacked Title',
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
        action: 'approved',
        performedBy: 'supervisor-1',
        timestamp: Date.now(),
      }));
    });

    test('trainee cannot create task approval', async () => {
      const db = getTraineeAuth('trainee-1').firestore();
      await assertFails(db.collection('task_approvals').add({
        taskId: 'task-1',
        traineeId: 'trainee-1',
        status: 'approved',
        action: 'approved',
        performedBy: 'trainee-1',
        timestamp: Date.now(),
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

  describe('Notification Preferences', () => {
    async function seedPrefs(docId, userId) {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection('notification_preferences').doc(docId).set({
          userId,
          fcmEnabled: true,
          inAppEnabled: true,
          emailEnabled: false,
          updatedAt: 1,
        });
      });
    }

    test('reading a never-saved prefs doc succeeds and reports not-exists', async () => {
      const db = getTraineeAuth().firestore();
      const snap = await db.collection('notification_preferences').doc('trainee-1').get();
      expect(snap.exists).toBe(false);
    });

    test('unauthenticated read of a never-saved prefs doc fails', async () => {
      const db = getUnauthenticated().firestore();
      await assertFails(db.collection('notification_preferences').doc('some-uid').get());
    });

    test('owner can read their existing prefs doc', async () => {
      await seedPrefs('trainee-1', 'trainee-1');
      const db = getTraineeAuth().firestore();
      const snap = await db.collection('notification_preferences').doc('trainee-1').get();
      expect(snap.exists).toBe(true);
    });

    test('other users cannot read someone elseâ€™s prefs doc', async () => {
      await seedPrefs('trainee-1', 'trainee-1');
      const db = getSupervisorAuth().firestore();
      await assertFails(db.collection('notification_preferences').doc('trainee-1').get());
    });

    test('owner can create their own prefs doc', async () => {
      const db = getTraineeAuth().firestore();
      await assertSucceeds(
        db.collection('notification_preferences').doc('trainee-1').set({
          userId: 'trainee-1',
          fcmEnabled: true,
          inAppEnabled: true,
          emailEnabled: false,
          updatedAt: 2,
        })
      );
    });

    test('cannot create prefs doc with a spoofed userId', async () => {
      const db = getTraineeAuth().firestore();
      await assertFails(
        db.collection('notification_preferences').doc('trainee-1').set({
          userId: 'supervisor-1',
          fcmEnabled: true,
          inAppEnabled: true,
          emailEnabled: false,
          updatedAt: 2,
        })
      );
    });

    test('cannot create a prefs doc at another userâ€™s doc id', async () => {
      const db = getTraineeAuth().firestore();
      await assertFails(
        db.collection('notification_preferences').doc('supervisor-1').set({
          userId: 'trainee-1',
          fcmEnabled: true,
          inAppEnabled: true,
          emailEnabled: false,
          updatedAt: 2,
        })
      );
    });

    test('owner can update their prefs doc', async () => {
      await seedPrefs('trainee-1', 'trainee-1');
      const db = getTraineeAuth().firestore();
      await assertSucceeds(
        db.collection('notification_preferences').doc('trainee-1').update({ fcmEnabled: false })
      );
    });

    test('other users cannot update someone elseâ€™s prefs doc', async () => {
      await seedPrefs('trainee-1', 'trainee-1');
      const db = getSupervisorAuth().firestore();
      await assertFails(
        db.collection('notification_preferences').doc('trainee-1').update({ fcmEnabled: false })
      );
    });

    test('owner can delete their prefs doc, others cannot', async () => {
      await seedPrefs('trainee-1', 'trainee-1');
      const owner = getTraineeAuth().firestore();
      await assertFails(
        getSupervisorAuth().firestore().collection('notification_preferences').doc('trainee-1').delete()
      );
      await assertSucceeds(owner.collection('notification_preferences').doc('trainee-1').delete());
    });
  });

  describe('Notifications Collection', () => {
    async function seedNotification(docId, userId) {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection('notifications').doc(docId).set({
          userId,
          type: 'task_created',
          title: 'New Task Assigned',
          body: 'You have a new task: Demo',
          data: {},
          priority: 'normal',
          read: false,
          sentVia: 'in_app',
          createdAt: 1,
          updatedAt: 1,
        });
      });
    }

    const clientCreate = (db, userId) =>
      db.collection('notifications').add({
        userId,
        type: 'task_created',
        title: 'Spoofed',
        body: 'Client-side create must be denied',
        data: {},
        priority: 'normal',
        read: false,
        sentVia: 'in_app',
        createdAt: 2,
        updatedAt: 2,
      });

    test('unauthenticated create is denied', async () => {
      await assertFails(clientCreate(getUnauthenticated().firestore(), 'trainee-1'));
    });

    test('trainee client create is denied', async () => {
      await assertFails(clientCreate(getTraineeAuth().firestore(), 'trainee-1'));
    });

    test('supervisor client create is denied (CF owns creates now)', async () => {
      await assertFails(clientCreate(getSupervisorAuth().firestore(), 'trainee-1'));
    });

    test('admin client create is denied (CF owns creates now)', async () => {
      await assertFails(clientCreate(getAdminAuth().firestore(), 'admin-uid'));
    });

    test('owner can read their notification, others cannot', async () => {
      await seedNotification('notif-1', 'trainee-1');
      const owner = await getTraineeAuth().firestore().collection('notifications').doc('notif-1').get();
      expect(owner.exists).toBe(true);
      await assertFails(getSupervisorAuth().firestore().collection('notifications').doc('notif-1').get());
    });

    test('owner can mark read (read/readAt only)', async () => {
      await seedNotification('notif-1', 'trainee-1');
      const db = getTraineeAuth().firestore();
      await assertSucceeds(
        db.collection('notifications').doc('notif-1').update({ read: true, readAt: 2, updatedAt: 2 })
      );
    });

    test('owner cannot update fields beyond read/readAt/updatedAt', async () => {
      await seedNotification('notif-1', 'trainee-1');
      const db = getTraineeAuth().firestore();
      await assertFails(db.collection('notifications').doc('notif-1').update({ title: 'Hijacked' }));
      await assertFails(db.collection('notifications').doc('notif-1').update({ userId: 'supervisor-1' }));
    });

    test('non-owner cannot mark read or delete', async () => {
      await seedNotification('notif-1', 'trainee-1');
      const other = getSupervisorAuth().firestore().collection('notifications').doc('notif-1');
      await assertFails(other.update({ read: true, readAt: 2 }));
      await assertFails(other.delete());
    });
  });

  describe('FIX-21: cross-tenant read scoping', () => {
    test('other-company supervisor cannot read a user profile', async () => {
      const db = getOtherCompanySupervisor().firestore();
      await assertFails(db.collection('users').doc('trainee-1').get());
    });

    test('trainee cannot read another trainee user profile', async () => {
      const db = getTraineeAuth('trainee-1').firestore();
      await assertFails(db.collection('users').doc('other-company-user').get());
    });

    test('other-company coordinator cannot read a trainee profile', async () => {
      const db = getOtherCompanyCoordinator().firestore();
      await assertFails(db.collection('trainees').doc('trainee-1').get());
    });

    test('other-company supervisor cannot read a trainee profile', async () => {
      const db = getOtherCompanySupervisor().firestore();
      await assertFails(db.collection('trainees').doc('trainee-1').get());
    });

    test('trainee cannot read another trainees task, DTR, leave, or document', async () => {
      const db = getTraineeAuth('trainee-1').firestore();
      await assertFails(db.collection('tasks').doc('task-other').get());
      await assertFails(db.collection('dtrs').doc('dtr-other').get());
      await assertFails(db.collection('leave_requests').doc('leave-2').get());
      await assertFails(db.collection('documents').doc('doc-other').get());
    });

    test('other-company supervisor cannot read a task or leave request', async () => {
      const db = getOtherCompanySupervisor().firestore();
      await assertFails(db.collection('tasks').doc('task-1').get());
      await assertFails(db.collection('leave_requests').doc('leave-1').get());
    });

    test('trainee can read own task comment but not another trainees', async () => {
      const db = getTraineeAuth('trainee-1').firestore();
      await assertSucceeds(db.collection('task_comments').doc('comment-1').get());
      await assertFails(db.collection('task_comments').doc('comment-other').get());
    });

    test('other-company supervisor cannot read a task comment', async () => {
      const db = getOtherCompanySupervisor().firestore();
      await assertFails(db.collection('task_comments').doc('comment-1').get());
    });

    test('trainee can read own approval but not another trainees', async () => {
      const db = getTraineeAuth('trainee-1').firestore();
      await assertSucceeds(db.collection('task_approvals').doc('approval-1').get());
      await assertFails(db.collection('task_approvals').doc('approval-other').get());
    });

    test('other-company coordinator cannot read a task approval', async () => {
      const db = getOtherCompanyCoordinator().firestore();
      await assertFails(db.collection('task_approvals').doc('approval-1').get());
    });
  });

  describe('FIX-22: cross-tenant write scoping', () => {
    test('coordinator can still update an own-company trainee', async () => {
      const db = getCoordinatorAuth().firestore();
      await assertSucceeds(db.collection('trainees').doc('trainee-1').update({ status: 'active' }));
    });

    test('other-company coordinator cannot update a trainee (tenant takeover blocked)', async () => {
      const db = getOtherCompanyCoordinator().firestore();
      await assertFails(db.collection('trainees').doc('trainee-1').update({ companyId: 'company-2' }));
      await assertFails(db.collection('trainees').doc('trainee-1').update({ status: 'suspended' }));
    });

    test('other-company supervisor cannot approve another companys leave request', async () => {
      const db = getSupervisorAuth('supervisor-1').firestore();
      await assertFails(db.collection('leave_requests').doc('leave-2').update({
        status: 'approved',
        approvedBy: 'supervisor-1',
        approvedAt: Date.now(),
      }));
    });

    test('other-company coordinator cannot approve another companys leave request', async () => {
      const db = getCoordinatorAuth().firestore();
      await assertFails(db.collection('leave_requests').doc('leave-2').update({
        status: 'approved',
        approvedBy: 'coordinator-1',
        approvedAt: Date.now(),
      }));
    });

    test('own-company supervisor can approve own-company leave request', async () => {
      const db = getOtherCompanySupervisor().firestore();
      await assertSucceeds(db.collection('leave_requests').doc('leave-2').update({
        status: 'approved',
        approvedBy: 'supervisor-2',
        approvedAt: Date.now(),
      }));
    });

    test('assigned supervisor can update own task approval', async () => {
      const db = getSupervisorAuth('supervisor-1').firestore();
      await assertSucceeds(db.collection('task_approvals').doc('approval-1').update({ status: 'returned' }));
    });

    test('other-company supervisor cannot update a task approval', async () => {
      const db = getOtherCompanySupervisor().firestore();
      await assertFails(db.collection('task_approvals').doc('approval-1').update({ status: 'returned' }));
    });

    test('assigned supervisor can create a bulk-style approval (no traineeId)', async () => {
      const db = getSupervisorAuth('supervisor-1').firestore();
      await assertSucceeds(db.collection('task_approvals').add({
        taskId: 'task-1',
        action: 'approved',
        performedBy: 'supervisor-1',
        timestamp: Date.now(),
      }));
    });

    test('other-company supervisor cannot create an approval for another companys task', async () => {
      const db = getOtherCompanySupervisor().firestore();
      await assertFails(db.collection('task_approvals').add({
        taskId: 'task-1',
        action: 'approved',
        performedBy: 'supervisor-2',
        timestamp: Date.now(),
      }));
    });

    test('trainee can create a correction request for own attendance', async () => {
      const db = getTraineeAuth('trainee-1').firestore();
      await assertSucceeds(
        db.collection('attendance_records').doc('att-1').collection('correction_requests').add({
          requestedBy: 'trainee-1',
          reason: 'Missed scan',
          originalValue: 'missing',
          proposedValue: '08:00',
          status: 'pending',
        })
      );
    });

    test('trainee cannot create a correction request for another trainee attendance', async () => {
      const db = getTraineeAuth('trainee-1').firestore();
      await assertFails(
        db.collection('attendance_records').doc('att-other').collection('correction_requests').add({
          requestedBy: 'trainee-1',
          reason: 'Spoofed',
          originalValue: 'x',
          proposedValue: 'y',
          status: 'pending',
        })
      );
    });

    test('other-company supervisor cannot review an attendance correction', async () => {
      const db = getOtherCompanySupervisor().firestore();
      await assertFails(
        db.collection('attendance_records').doc('att-1').collection('correction_requests').doc('corr-1')
          .update({ status: 'rejected', reviewedBy: 'supervisor-2', reviewedAt: Date.now() })
      );
    });

    test('own-company assigned supervisor can review an attendance correction', async () => {
      const db = getSupervisorAuth('supervisor-1').firestore();
      await assertSucceeds(
        db.collection('attendance_records').doc('att-1').collection('correction_requests').doc('corr-1')
          .update({ status: 'approved', reviewedBy: 'supervisor-1', reviewedAt: Date.now() })
      );
    });

    test('trainee cannot update another trainees correction request', async () => {
      const db = getOtherCompanyUser().firestore();
      await assertFails(
        db.collection('attendance_records').doc('att-1').collection('correction_requests').doc('corr-1')
          .update({ status: 'approved', reviewedBy: 'other-trainee', reviewedAt: Date.now() })
      );
    });
  });

  describe('FIX-23: input validation', () => {
    test('task create with a non-string title is denied', async () => {
      const db = getSupervisorAuth('supervisor-1').firestore();
      await assertFails(db.collection('tasks').add({
        traineeId: 'trainee-1',
        title: 12345,
        description: 'Description',
        status: 'pending',
        priority: 'high',
        dueDate: Date.now() + 86400000,
        createdBy: 'supervisor-1',
      }));
    });

    test('leave create with an oversized reason is denied', async () => {
      const db = getTraineeAuth('trainee-1').firestore();
      await assertFails(db.collection('leave_requests').add({
        traineeId: 'trainee-1',
        type: 'sick',
        startDate: Date.now(),
        endDate: Date.now() + 86400000,
        reason: 'x'.repeat(2001),
        status: 'pending',
      }));
    });

    test('task comment create with an oversized body is denied', async () => {
      const db = getTraineeAuth('trainee-1').firestore();
      await assertFails(db.collection('task_comments').add({
        taskId: 'task-1',
        userId: 'trainee-1',
        content: 'x'.repeat(5001),
      }));
    });

    test('document create with an oversized fileUrl is denied', async () => {
      const db = getTraineeAuth('trainee-1').firestore();
      await assertFails(db.collection('documents').add({
        traineeId: 'trainee-1',
        type: 'medical',
        fileName: 'medical.pdf',
        fileUrl: 'https://example.com/' + 'x'.repeat(2049),
        fileSize: 1024,
        mimeType: 'application/pdf',
        status: 'pending',
      }));
    });
  });

  describe('Real client query patterns remain provable', () => {
    test('supervisor can list own-company users by documentId in (attendance monitor)', async () => {
      const db = getSupervisorAuth('supervisor-1').firestore();
      await assertSucceeds(db.collection('users')
        .where('__name__', 'in', ['trainee-1', 'supervisor-1']).get());
    });

    test('supervisor can fetch a leave request by documentId query (leave detail)', async () => {
      const db = getSupervisorAuth('supervisor-1').firestore();
      await assertSucceeds(db.collection('leave_requests')
        .where('__name__', '==', 'leave-1').get());
    });

    test('trainee can fetch own leave request by documentId query', async () => {
      const db = getTraineeAuth('trainee-1').firestore();
      await assertSucceeds(db.collection('leave_requests')
        .where('__name__', '==', 'leave-1').get());
    });

    test('supervisor can list own-company leave requests by companyId', async () => {
      const db = getSupervisorAuth('supervisor-1').firestore();
      await assertSucceeds(db.collection('leave_requests').where('companyId', '==', 'company-1').get());
    });

    test('coordinator can list tasks for a traineeId in batch', async () => {
      const db = getCoordinatorAuth().firestore();
      await assertSucceeds(db.collection('tasks').where('traineeId', 'in', ['trainee-1']).get());
    });

    test('supervisor can list attendance by qrSessionId (QR display)', async () => {
      const db = getSupervisorAuth('supervisor-1').firestore();
      await assertSucceeds(db.collection('attendance_records')
        .where('qrSessionId', '==', 'qr-session-1').get());
    });

    test('supervisor can list attendance by traineeId', async () => {
      const db = getSupervisorAuth('supervisor-1').firestore();
      await assertSucceeds(db.collection('attendance_records').where('traineeId', '==', 'trainee-1').get());
    });

    test('supervisor can list tasks by traineeId', async () => {
      const db = getSupervisorAuth('supervisor-1').firestore();
      await assertSucceeds(db.collection('tasks').where('traineeId', '==', 'trainee-1').get());
    });

    test('supervisor can list own tasks by createdBy', async () => {
      const db = getSupervisorAuth('supervisor-1').firestore();
      await assertSucceeds(db.collection('tasks').where('createdBy', '==', 'supervisor-1').get());
    });

    test('coordinator can list documents by traineeId', async () => {
      const db = getCoordinatorAuth().firestore();
      await assertSucceeds(db.collection('documents').where('traineeId', '==', 'trainee-1').get());
    });

    test('trainee can list own tasks by traineeId', async () => {
      const db = getTraineeAuth('trainee-1').firestore();
      await assertSucceeds(db.collection('tasks').where('traineeId', '==', 'trainee-1').get());
    });

    test('supervisor can query trainees by supervisorId (task form picker)', async () => {
      const db = getSupervisorAuth('supervisor-1').firestore();
      await assertSucceeds(db.collection('trainees')
        .where('status', '==', 'active').where('supervisorId', '==', 'supervisor-1').get());
    });

    test('coordinator can list trainees by companyId', async () => {
      const db = getCoordinatorAuth().firestore();
      await assertSucceeds(db.collection('trainees').where('companyId', '==', 'company-1').get());
    });

    test('supervisor can list DTRs by companyId (SupervisorDTRList)', async () => {
      const db = getSupervisorAuth('supervisor-1').firestore();
      await assertSucceeds(db.collection('dtrs').where('companyId', '==', 'company-1').get());
    });

    test('supervisor can list task comments by taskId', async () => {
      const db = getSupervisorAuth('supervisor-1').firestore();
      await assertSucceeds(db.collection('task_comments').where('taskId', '==', 'task-1').get());
    });

    test('supervisor can list task approvals by taskId', async () => {
      const db = getSupervisorAuth('supervisor-1').firestore();
      await assertSucceeds(db.collection('task_approvals').where('taskId', '==', 'task-1').get());
    });

    test('admin can list tasks unfiltered (report dashboard)', async () => {
      const db = getAdminAuth().firestore();
      await assertSucceeds(db.collection('tasks').limit(50).get());
    });

    test('supervisor unfiltered task list is denied (no cross-tenant bleed)', async () => {
      const db = getSupervisorAuth('supervisor-1').firestore();
      await assertFails(db.collection('tasks').get());
    });
  });
});
