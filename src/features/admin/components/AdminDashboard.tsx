import { 
  UserList, 
  UserForm, 
  CompanyList, 
  CompanyForm, 
  DepartmentList, 
  DepartmentForm,
  SupervisorList,
  SupervisorForm,
  CoordinatorList,
  CoordinatorForm,
  TraineeList,
  TraineeForm,
  DocumentRequirements,
  SupervisorTraineeAssignment,
  OJTScheduleList,
  OJTScheduleForm,
  WorkScheduleList,
  WorkScheduleForm,
} from './index';
import { AdminOverview } from './AdminOverview';
import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { Modal } from '@/shared/components/Modal';
import type { User, Company, Department, Supervisor, Trainee, WorkSchedule, OJTSchedule } from '../types';

type Tab = 'dashboard' | 'users' | 'companies' | 'departments' | 'supervisors' | 'coordinators' | 'trainees' | 'work-schedules' | 'ojt-schedules';

const TAB_FROM_PATH: Record<string, Tab> = {
  '/admin': 'dashboard',
  '/admin/users': 'users',
  '/admin/companies': 'companies',
  '/admin/departments': 'departments',
  '/admin/supervisors': 'supervisors',
  '/admin/coordinators': 'coordinators',
  '/admin/trainees': 'trainees',
  '/admin/work-schedules': 'work-schedules',
  '/admin/ojt-schedules': 'ojt-schedules',
};

function getTabFromPathname(pathname: string): Tab {
  if (TAB_FROM_PATH[pathname]) return TAB_FROM_PATH[pathname];
  const base = '/admin/' + pathname.split('/')[2];
  return TAB_FROM_PATH[base] || 'users';
}

const FORM_TITLES: Record<Tab, { create: string; edit: string }> = {
  users: { create: 'Add User', edit: 'Edit User' },
  companies: { create: 'Add Company', edit: 'Edit Company' },
  departments: { create: 'Add Department', edit: 'Edit Department' },
  supervisors: { create: 'Add Supervisor', edit: 'Edit Supervisor' },
  coordinators: { create: 'Add Coordinator', edit: 'Edit Coordinator' },
  trainees: { create: 'Add Trainee', edit: 'Edit Trainee' },
  'work-schedules': { create: 'Add Work Schedule', edit: 'Edit Work Schedule' },
  'ojt-schedules': { create: 'Add OJT Schedule', edit: 'Edit OJT Schedule' },
  dashboard: { create: '', edit: '' },
};

export function AdminDashboard() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>(() => getTabFromPathname(location.pathname));
  const [view, setView] = useState<'list' | 'create' | 'edit' | 'assign' | 'documents'>('list');
  const [viewOnly, setViewOnly] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [editingDepartmentId, setEditingDepartmentId] = useState<string | null>(null);
  const [editingTraineeId, setEditingTraineeId] = useState<string | null>(null);
  const [editingWorkScheduleId, setEditingWorkScheduleId] = useState<string | null>(null);
  const [editingOJTScheduleId, setEditingOJTScheduleId] = useState<string | null>(null);
  const [assigningSupervisor, setAssigningSupervisor] = useState<Supervisor | null>(null);
  const [editingSupervisorId, setEditingSupervisorId] = useState<string | null>(null);
  const [editingCoordinatorId, setEditingCoordinatorId] = useState<string | null>(null);
  const [viewingTraineeCompanyId, setViewingTraineeCompanyId] = useState<string | null>(null);

  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    danger?: boolean;
  } | null>(null);

  useEffect(() => {
    setActiveTab(getTabFromPathname(location.pathname));
    setView('list');
    setViewOnly(false);
    setEditingUserId(null);
    setEditingCompanyId(null);
    setEditingDepartmentId(null);
    setEditingTraineeId(null);
    setEditingWorkScheduleId(null);
    setEditingOJTScheduleId(null);
    setEditingSupervisorId(null);
    setEditingCoordinatorId(null);
    setAssigningSupervisor(null);
    setViewingTraineeCompanyId(null);
  }, [location.pathname]);

  const handleEditUser = (user: User) => {
    setEditingUserId(user.id);
    setEditingCompanyId(null);
    setEditingDepartmentId(null);
    setEditingTraineeId(null);
    setEditingWorkScheduleId(null);
    setEditingOJTScheduleId(null);
    setAssigningSupervisor(null);
    setEditingCoordinatorId(null);
    setView('edit');
  };

  const handleViewUser = (user: User) => {
    setEditingUserId(user.id);
    setEditingCompanyId(null);
    setEditingDepartmentId(null);
    setEditingTraineeId(null);
    setEditingWorkScheduleId(null);
    setEditingOJTScheduleId(null);
    setAssigningSupervisor(null);
    setEditingCoordinatorId(null);
    setView('edit');
  };

  const handleEditCompany = (company: Company) => {
    setEditingCompanyId(company.id);
    setEditingUserId(null);
    setEditingDepartmentId(null);
    setEditingTraineeId(null);
    setEditingWorkScheduleId(null);
    setEditingOJTScheduleId(null);
    setAssigningSupervisor(null);
    setView('edit');
  };

  const handleEditDepartment = (department: Department) => {
    setEditingDepartmentId(department.id);
    setEditingUserId(null);
    setEditingCompanyId(null);
    setEditingTraineeId(null);
    setEditingWorkScheduleId(null);
    setEditingOJTScheduleId(null);
    setAssigningSupervisor(null);
    setView('edit');
  };

  const handleEditSupervisor = (_supervisor: Supervisor) => {
    setEditingSupervisorId(_supervisor.id);
    setEditingUserId(_supervisor.userId);
    setEditingCompanyId(null);
    setEditingDepartmentId(null);
    setEditingTraineeId(null);
    setEditingWorkScheduleId(null);
    setEditingOJTScheduleId(null);
    setAssigningSupervisor(null);
    setEditingCoordinatorId(null);
    setView('edit');
  };

  const handleEditCoordinator = (user: User) => {
    setEditingCoordinatorId(user.id);
    setEditingUserId(user.id);
    setEditingCompanyId(null);
    setEditingDepartmentId(null);
    setEditingTraineeId(null);
    setEditingWorkScheduleId(null);
    setEditingOJTScheduleId(null);
    setAssigningSupervisor(null);
    setView('edit');
  };

  const handleAssignTrainees = (supervisor: Supervisor) => {
    setAssigningSupervisor(supervisor);
    setEditingUserId(null);
    setEditingCompanyId(null);
    setEditingDepartmentId(null);
    setEditingTraineeId(null);
    setEditingWorkScheduleId(null);
    setEditingOJTScheduleId(null);
    setEditingCoordinatorId(null);
    setView('assign');
  };

  const handleEditTrainee = (trainee: Trainee) => {
    setEditingTraineeId(trainee.id);
    setEditingUserId(null);
    setEditingCompanyId(null);
    setEditingDepartmentId(null);
    setEditingWorkScheduleId(null);
    setEditingOJTScheduleId(null);
    setAssigningSupervisor(null);
    setViewOnly(false);
    setView('edit');
  };

  const handleViewTrainee = (trainee: Trainee) => {
    setEditingTraineeId(trainee.id);
    setViewingTraineeCompanyId(trainee.companyId);
    setEditingUserId(null);
    setEditingCompanyId(null);
    setEditingDepartmentId(null);
    setEditingWorkScheduleId(null);
    setEditingOJTScheduleId(null);
    setAssigningSupervisor(null);
    setViewOnly(true);
    setView('edit');
  };

  const handleViewTraineeDocuments = (trainee: Trainee) => {
    setEditingTraineeId(trainee.id);
    setViewingTraineeCompanyId(trainee.companyId);
    setEditingUserId(null);
    setEditingCompanyId(null);
    setEditingDepartmentId(null);
    setEditingWorkScheduleId(null);
    setEditingOJTScheduleId(null);
    setAssigningSupervisor(null);
    setView('documents');
  };

  const handleEditWorkSchedule = (schedule: WorkSchedule) => {
    setEditingWorkScheduleId(schedule.id);
    setEditingUserId(null);
    setEditingCompanyId(null);
    setEditingDepartmentId(null);
    setEditingTraineeId(null);
    setEditingOJTScheduleId(null);
    setAssigningSupervisor(null);
    setViewOnly(false);
    setView('edit');
  };

  const handleViewWorkSchedule = (schedule: WorkSchedule) => {
    setEditingWorkScheduleId(schedule.id);
    setEditingUserId(null);
    setEditingCompanyId(null);
    setEditingDepartmentId(null);
    setEditingTraineeId(null);
    setEditingOJTScheduleId(null);
    setAssigningSupervisor(null);
    setViewOnly(true);
    setView('edit');
  };

  const handleDeleteWorkSchedule = (schedule: WorkSchedule) => {
    setConfirmDialog({
      title: 'Delete Work Schedule',
      message: `Are you sure you want to delete "${schedule.name}"?`,
      danger: true,
      onConfirm: async () => {
        try {
          const { adminService } = await import('../services/adminService');
          await adminService.deleteWorkSchedule(schedule.id);
          setView('list');
        } catch (err) {
          console.error('Failed to delete work schedule:', err);
        }
      },
    });
  };

  const handleEditOJTSchedule = (schedule: OJTSchedule) => {
    setEditingOJTScheduleId(schedule.id);
    setEditingUserId(null);
    setEditingCompanyId(null);
    setEditingDepartmentId(null);
    setEditingTraineeId(null);
    setEditingWorkScheduleId(null);
    setAssigningSupervisor(null);
    setViewOnly(false);
    setView('edit');
  };

  const handleViewOJTSchedule = (schedule: OJTSchedule) => {
    setEditingOJTScheduleId(schedule.id);
    setEditingUserId(null);
    setEditingCompanyId(null);
    setEditingDepartmentId(null);
    setEditingTraineeId(null);
    setEditingWorkScheduleId(null);
    setAssigningSupervisor(null);
    setViewOnly(true);
    setView('edit');
  };

  const handleBackToList = () => {
    setView('list');
    setViewOnly(false);
    setEditingUserId(null);
    setEditingCompanyId(null);
    setEditingDepartmentId(null);
    setEditingTraineeId(null);
    setEditingWorkScheduleId(null);
    setEditingOJTScheduleId(null);
    setEditingSupervisorId(null);
    setEditingCoordinatorId(null);
    setAssigningSupervisor(null);
    setViewingTraineeCompanyId(null);
  };

  const handleAssignmentClose = () => {
    setAssigningSupervisor(null);
    setView('list');
  };

  const handleAssignmentSuccess = () => {
    setAssigningSupervisor(null);
    setView('list');
  };

  return (
    <>
    <div>
      {view === 'assign' && assigningSupervisor && (
        <div className="mb-4">
          <button
            onClick={handleAssignmentClose}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium flex items-center gap-1"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Supervisors
          </button>
        </div>
      )}

      {activeTab === 'dashboard' && <AdminOverview />}

      {activeTab === 'users' && (
        <>
          {view === 'list' && (
            <>
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-[#121212] dark:text-white">User Management</h1>
                  <p className="text-[#555555] dark:text-[#9E9E9E] mt-1">Manage system users and their roles</p>
                </div>
                <button
                  onClick={() => { setView('create'); setEditingUserId(null); }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                >
                  Add User
                </button>
              </div>
              <UserList onEdit={handleEditUser} onView={handleViewUser} />
            </>
          )}

          {view === 'create' && (
            <Modal open title={FORM_TITLES[activeTab].create} onClose={handleBackToList}>
              <UserForm onCancel={handleBackToList} onSaved={handleBackToList} />
            </Modal>
          )}
          {view === 'edit' && editingUserId && (
            <Modal open title={FORM_TITLES[activeTab].edit} onClose={handleBackToList}>
              <UserForm editingId={editingUserId} onCancel={handleBackToList} onSaved={handleBackToList} />
            </Modal>
          )}
        </>
      )}

      {activeTab === 'companies' && (
        <>
          {view === 'list' && (
            <>
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-[#121212] dark:text-white">Company Management</h1>
                  <p className="text-[#555555] dark:text-[#9E9E9E] mt-1">Manage companies</p>
                </div>
                <button
                  onClick={() => { setView('create'); setEditingCompanyId(null); }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                >
                  Add Company
                </button>
              </div>
              <CompanyList onEdit={handleEditCompany} />
            </>
          )}

          {view === 'create' && (
            <Modal open title={FORM_TITLES[activeTab].create} onClose={handleBackToList}>
              <CompanyForm onCancel={handleBackToList} onSaved={handleBackToList} />
            </Modal>
          )}
          {view === 'edit' && editingCompanyId && (
            <Modal open title={FORM_TITLES[activeTab].edit} onClose={handleBackToList}>
              <CompanyForm editingId={editingCompanyId} onCancel={handleBackToList} onSaved={handleBackToList} />
            </Modal>
          )}
        </>
      )}

      {activeTab === 'departments' && (
        <>
          {view === 'list' && (
            <>
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-[#121212] dark:text-white">Department Management</h1>
                  <p className="text-[#555555] dark:text-[#9E9E9E] mt-1">Manage departments</p>
                </div>
                <button
                  onClick={() => { setView('create'); setEditingDepartmentId(null); }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                >
                  Add Department
                </button>
              </div>
              <DepartmentList onEdit={handleEditDepartment} />
            </>
          )}

          {view === 'create' && (
            <Modal open title={FORM_TITLES[activeTab].create} onClose={handleBackToList}>
              <DepartmentForm onCancel={handleBackToList} onSaved={handleBackToList} />
            </Modal>
          )}
          {view === 'edit' && editingDepartmentId && (
            <Modal open title={FORM_TITLES[activeTab].edit} onClose={handleBackToList}>
              <DepartmentForm editingId={editingDepartmentId} onCancel={handleBackToList} onSaved={handleBackToList} />
            </Modal>
          )}
        </>
      )}

      {activeTab === 'supervisors' && (
        <>
          {view === 'list' && (
            <>
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-[#121212] dark:text-white">Supervisor Management</h1>
                  <p className="text-[#555555] dark:text-[#9E9E9E] mt-1">Manage supervisors and trainee assignments</p>
                </div>
                <button
                  onClick={() => { setView('create'); setEditingUserId(null); setEditingSupervisorId(null); }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                >
                  Add Supervisor
                </button>
              </div>
              <SupervisorList onEdit={handleEditSupervisor} onAssignTrainees={handleAssignTrainees} />
            </>
          )}

          {view === 'create' && (
            <Modal open title={FORM_TITLES[activeTab].create} onClose={handleBackToList}>
              <SupervisorForm onCancel={handleBackToList} onSaved={handleBackToList} />
            </Modal>
          )}
          {view === 'edit' && editingSupervisorId && (
            <Modal open title={FORM_TITLES[activeTab].edit} onClose={handleBackToList}>
              <SupervisorForm
                editingId={editingUserId ?? undefined}
                editingSupervisorId={editingSupervisorId}
                onCancel={handleBackToList}
                onSaved={handleBackToList}
              />
            </Modal>
          )}

          {view === 'assign' && assigningSupervisor && (
            <SupervisorTraineeAssignment
              supervisor={assigningSupervisor}
              onClose={handleAssignmentClose}
              onSuccess={handleAssignmentSuccess}
            />
          )}
        </>
      )}

      {activeTab === 'coordinators' && (
        <>
          {view === 'list' && (
            <>
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-[#121212] dark:text-white">Coordinator Management</h1>
                  <p className="text-[#555555] dark:text-[#9E9E9E] mt-1">Manage coordinators in your department</p>
                </div>
                <button
                  onClick={() => { setView('create'); setEditingCoordinatorId(null); }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                >
                  Add Coordinator
                </button>
              </div>
              <CoordinatorList onEdit={handleEditCoordinator} />
            </>
          )}

          {view === 'create' && (
            <Modal open title={FORM_TITLES[activeTab].create} onClose={handleBackToList}>
              <CoordinatorForm onCancel={handleBackToList} onSaved={handleBackToList} />
            </Modal>
          )}
          {view === 'edit' && editingCoordinatorId && (
            <Modal open title={FORM_TITLES[activeTab].edit} onClose={handleBackToList}>
              <CoordinatorForm editingCoordinatorId={editingCoordinatorId} editingId={editingUserId ?? undefined} onCancel={handleBackToList} onSaved={handleBackToList} />
            </Modal>
          )}
        </>
      )}

      {activeTab === 'trainees' && (
        <>
          {view === 'list' && (
            <>
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-[#121212] dark:text-white">Trainee Management</h1>
                  <p className="text-[#555555] dark:text-[#9E9E9E] mt-1">Manage trainees and their profiles</p>
                </div>
                <button
                  onClick={() => { setView('create'); setEditingTraineeId(null); }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                >
                  Add Trainee
                </button>
              </div>
              <TraineeList 
                onEdit={handleEditTrainee} 
                onView={handleViewTrainee}
                onViewDocuments={handleViewTraineeDocuments}
                onStatusChange={() => window.location.reload()} 
              />
            </>
          )}

          {view === 'create' && (
            <Modal open title={FORM_TITLES[activeTab].create} onClose={handleBackToList}>
              <TraineeForm onCancel={handleBackToList} onSaved={handleBackToList} />
            </Modal>
          )}
          {view === 'edit' && editingTraineeId && (
            <Modal open title={FORM_TITLES[activeTab].edit} onClose={handleBackToList}>
              <TraineeForm editingId={editingTraineeId} viewOnly={viewOnly} onCancel={handleBackToList} onSaved={handleBackToList} />
            </Modal>
          )}
          {view === 'documents' && editingTraineeId && viewingTraineeCompanyId && (
            <DocumentRequirements 
              traineeId={editingTraineeId} 
              companyId={viewingTraineeCompanyId}
            />
          )}
        </>
      )}

      {activeTab === 'work-schedules' && (
        <>
          {view === 'list' && (
            <>
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-[#121212] dark:text-white">Work Schedule Management</h1>
                  <p className="text-[#555555] dark:text-[#9E9E9E] mt-1">Manage work schedules</p>
                </div>
                <button
                  onClick={() => { setView('create'); setEditingWorkScheduleId(null); }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                >
                  Add Work Schedule
                </button>
              </div>
              <WorkScheduleList onEdit={handleEditWorkSchedule} onView={handleViewWorkSchedule} onDelete={handleDeleteWorkSchedule} />
            </>
          )}

          {view === 'create' && (
            <Modal open title={FORM_TITLES[activeTab].create} onClose={handleBackToList}>
              <WorkScheduleForm onCancel={handleBackToList} onSaved={handleBackToList} />
            </Modal>
          )}
          {view === 'edit' && editingWorkScheduleId && (
            <Modal open title={FORM_TITLES[activeTab].edit} onClose={handleBackToList}>
              <WorkScheduleForm editingId={editingWorkScheduleId} viewOnly={viewOnly} onCancel={handleBackToList} onSaved={handleBackToList} />
            </Modal>
          )}
        </>
      )}

      {activeTab === 'ojt-schedules' && (
        <>
          {view === 'list' && (
            <>
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-[#121212] dark:text-white">OJT Schedule Management</h1>
                  <p className="text-[#555555] dark:text-[#9E9E9E] mt-1">Manage OJT schedules</p>
                </div>
                <button
                  onClick={() => { setView('create'); setEditingOJTScheduleId(null); }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                >
                  Add OJT Schedule
                </button>
              </div>
              <OJTScheduleList onEdit={handleEditOJTSchedule} onView={handleViewOJTSchedule} />
            </>
          )}

          {view === 'create' && (
            <Modal open title={FORM_TITLES[activeTab].create} onClose={handleBackToList}>
              <OJTScheduleForm onCancel={handleBackToList} onSaved={handleBackToList} />
            </Modal>
          )}
          {view === 'edit' && editingOJTScheduleId && (
            <Modal open title={FORM_TITLES[activeTab].edit} onClose={handleBackToList}>
              <OJTScheduleForm editingId={editingOJTScheduleId} viewOnly={viewOnly} onCancel={handleBackToList} onSaved={handleBackToList} />
            </Modal>
          )}
        </>
      )}
    </div>

    <ConfirmDialog
      open={confirmDialog !== null}
      title={confirmDialog?.title || ''}
      message={confirmDialog?.message || ''}
      danger={confirmDialog?.danger}
      onConfirm={() => { confirmDialog?.onConfirm(); setConfirmDialog(null); }}
      onCancel={() => setConfirmDialog(null)}
    />
    </>
  );
}