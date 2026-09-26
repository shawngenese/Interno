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
import { NotFoundPage } from '@/features/auth';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/ui/Button';
import { PageTransition } from '@/shared/components/PageTransition';
import { ChevronLeft } from 'lucide-react';
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

function getTabFromPathname(pathname: string): Tab | null {
  if (TAB_FROM_PATH[pathname]) return TAB_FROM_PATH[pathname];
  const segment = pathname.split('/')[2];
  if (!segment) return 'dashboard';
  return TAB_FROM_PATH['/admin/' + segment] ?? null;
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
  const [activeTab, setActiveTab] = useState<Tab | null>(() => getTabFromPathname(location.pathname));
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

  if (activeTab === null) {
    return (
      <PageTransition>
        <NotFoundPage height="content" />
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        {view === 'assign' && assigningSupervisor && (
          <div className="mb-4">
            <button
              onClick={handleAssignmentClose}
              className="text-primary hover:text-primary-hover text-sm font-medium flex items-center gap-1 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to Supervisors
            </button>
          </div>
        )}

        {activeTab === 'dashboard' && <AdminOverview />}

        {activeTab === 'users' && (
          <>
            {view === 'list' && (
              <>
                <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">User Management</h1>
                    <p className="text-muted-foreground mt-1">Manage system users and their roles</p>
                  </div>
                  <Button
                    onClick={() => { setView('create'); setEditingUserId(null); }}
                  >
                    Add User
                  </Button>
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
                <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">Company Management</h1>
                    <p className="text-muted-foreground mt-1">Manage companies</p>
                  </div>
                  <Button
                    onClick={() => { setView('create'); setEditingCompanyId(null); }}
                  >
                    Add Company
                  </Button>
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
                <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">Department Management</h1>
                    <p className="text-muted-foreground mt-1">Manage departments</p>
                  </div>
                  <Button
                    onClick={() => { setView('create'); setEditingDepartmentId(null); }}
                  >
                    Add Department
                  </Button>
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
                <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">Supervisor Management</h1>
                    <p className="text-muted-foreground mt-1">Manage supervisors and trainee assignments</p>
                  </div>
                  <Button
                    onClick={() => { setView('create'); setEditingUserId(null); setEditingSupervisorId(null); }}
                  >
                    Add Supervisor
                  </Button>
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
                <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">Coordinator Management</h1>
                    <p className="text-muted-foreground mt-1">Manage coordinators in your department</p>
                  </div>
                  <Button
                    onClick={() => { setView('create'); setEditingCoordinatorId(null); }}
                  >
                    Add Coordinator
                  </Button>
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
                <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">Trainee Management</h1>
                    <p className="text-muted-foreground mt-1">Manage trainees and their profiles</p>
                  </div>
                  <Button
                    onClick={() => { setView('create'); setEditingTraineeId(null); }}
                  >
                    Add Trainee
                  </Button>
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
                <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">Work Schedule Management</h1>
                    <p className="text-muted-foreground mt-1">Manage work schedules</p>
                  </div>
                  <Button
                    onClick={() => { setView('create'); setEditingWorkScheduleId(null); }}
                  >
                    Add Work Schedule
                  </Button>
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
                <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">OJT Schedule Management</h1>
                    <p className="text-muted-foreground mt-1">Manage OJT schedules</p>
                  </div>
                  <Button
                    onClick={() => { setView('create'); setEditingOJTScheduleId(null); }}
                  >
                    Add OJT Schedule
                  </Button>
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

        <ConfirmDialog
          open={confirmDialog !== null}
          title={confirmDialog?.title || ''}
          message={confirmDialog?.message || ''}
          danger={confirmDialog?.danger}
          onConfirm={() => { confirmDialog?.onConfirm(); setConfirmDialog(null); }}
          onCancel={() => setConfirmDialog(null)}
        />
      </div>
    </PageTransition>
  );
}