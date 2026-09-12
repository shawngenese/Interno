import { 
  UserList, 
  UserForm, 
  CompanyList, 
  CompanyForm, 
  DepartmentList, 
  DepartmentForm,
  SupervisorList,
  TraineeList,
  SupervisorTraineeAssignment,
  OJTScheduleList,
  OJTScheduleForm,
  WorkScheduleList,
  WorkScheduleForm,
} from './index';
import { useState } from 'react';
import type { User, Company, Department, Supervisor, Trainee, WorkSchedule, OJTSchedule } from '../types';

type Tab = 'users' | 'companies' | 'departments' | 'supervisors' | 'trainees' | 'work-schedules' | 'ojt-schedules';

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('users');
  const [view, setView] = useState<'list' | 'create' | 'edit' | 'assign'>('list');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [editingDepartmentId, setEditingDepartmentId] = useState<string | null>(null);
  const [editingTraineeId, setEditingTraineeId] = useState<string | null>(null);
  const [editingWorkScheduleId, setEditingWorkScheduleId] = useState<string | null>(null);
  const [editingOJTScheduleId, setEditingOJTScheduleId] = useState<string | null>(null);
  const [assigningSupervisor, setAssigningSupervisor] = useState<Supervisor | null>(null);

  const handleEditUser = (user: User) => {
    setEditingUserId(user.id);
    setEditingCompanyId(null);
    setEditingDepartmentId(null);
    setEditingTraineeId(null);
    setEditingWorkScheduleId(null);
    setEditingOJTScheduleId(null);
    setAssigningSupervisor(null);
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
    setEditingUserId(null);
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
    setView('edit');
  };

  const handleViewTrainee = (trainee: Trainee) => {
    setEditingTraineeId(trainee.id);
    setEditingUserId(null);
    setEditingCompanyId(null);
    setEditingDepartmentId(null);
    setEditingWorkScheduleId(null);
    setEditingOJTScheduleId(null);
    setAssigningSupervisor(null);
    setView('edit');
  };

  const handleEditWorkSchedule = (schedule: WorkSchedule) => {
    setEditingWorkScheduleId(schedule.id);
    setEditingUserId(null);
    setEditingCompanyId(null);
    setEditingDepartmentId(null);
    setEditingTraineeId(null);
    setEditingOJTScheduleId(null);
    setAssigningSupervisor(null);
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
    setView('edit');
  };

  const handleEditOJTSchedule = (schedule: OJTSchedule) => {
    setEditingOJTScheduleId(schedule.id);
    setEditingUserId(null);
    setEditingCompanyId(null);
    setEditingDepartmentId(null);
    setEditingTraineeId(null);
    setEditingWorkScheduleId(null);
    setAssigningSupervisor(null);
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
    setView('edit');
  };

  const handleBackToList = () => {
    setView('list');
    setEditingUserId(null);
    setEditingCompanyId(null);
    setEditingDepartmentId(null);
    setEditingTraineeId(null);
    setEditingWorkScheduleId(null);
    setEditingOJTScheduleId(null);
    setAssigningSupervisor(null);
  };

  const handleAssignmentClose = () => {
    setAssigningSupervisor(null);
    setView('list');
  };

  const handleAssignmentSuccess = () => {
    setAssigningSupervisor(null);
    setView('list');
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'users', label: 'Users' },
    { id: 'companies', label: 'Companies' },
    { id: 'departments', label: 'Departments' },
    { id: 'supervisors', label: 'Supervisors' },
    { id: 'trainees', label: 'Trainees' },
    { id: 'work-schedules', label: 'Work Schedules' },
    { id: 'ojt-schedules', label: 'OJT Schedules' },
  ];

  return (
    <div>
      <div className="mb-6">
        <nav className="flex gap-1 bg-white dark:bg-gray-800 rounded-lg p-1 border border-gray-200 dark:border-gray-700" aria-label="Admin tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setView('list'); }}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {view !== 'list' && view !== 'assign' && (
        <div className="mb-4">
          <button
            onClick={handleBackToList}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium flex items-center gap-1"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to {tabs.find(t => t.id === activeTab)?.label || 'List'}
          </button>
        </div>
      )}

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

      {activeTab === 'users' && (
        <>
          {view === 'list' && (
            <>
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">User Management</h1>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">Manage system users and their roles</p>
                </div>
                <button
                  onClick={() => { setView('create'); setEditingUserId(null); }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  Add User
                </button>
              </div>
              <UserList onEdit={handleEditUser} onView={handleViewUser} />
            </>
          )}

          {view === 'create' && <UserForm />}
          {view === 'edit' && editingUserId && <UserForm />}
        </>
      )}

      {activeTab === 'companies' && (
        <>
          {view === 'list' && (
            <>
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Company Management</h1>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">Manage companies</p>
                </div>
                <button
                  onClick={() => { setView('create'); setEditingCompanyId(null); }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  Add Company
                </button>
              </div>
              <CompanyList onEdit={handleEditCompany} />
            </>
          )}

          {view === 'create' && <CompanyForm />}
          {view === 'edit' && editingCompanyId && <CompanyForm />}
        </>
      )}

      {activeTab === 'departments' && (
        <>
          {view === 'list' && (
            <>
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Department Management</h1>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">Manage departments</p>
                </div>
                <button
                  onClick={() => { setView('create'); setEditingDepartmentId(null); }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  Add Department
                </button>
              </div>
              <DepartmentList onEdit={handleEditDepartment} />
            </>
          )}

          {view === 'create' && <DepartmentForm />}
          {view === 'edit' && editingDepartmentId && <DepartmentForm />}
        </>
      )}

      {activeTab === 'supervisors' && (
        <>
          {view === 'list' && (
            <>
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Supervisor Management</h1>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">Manage supervisors and trainee assignments</p>
                </div>
              </div>
              <SupervisorList onEdit={handleEditSupervisor} onAssignTrainees={handleAssignTrainees} />
            </>
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

      {activeTab === 'trainees' && (
        <>
          {view === 'list' && (
            <>
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Trainee Management</h1>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">Manage trainees</p>
                </div>
              </div>
              <TraineeList onEdit={handleEditTrainee} onView={handleViewTrainee} />
            </>
          )}

          {view === 'edit' && editingTraineeId && <TraineeList />}
        </>
      )}

      {activeTab === 'work-schedules' && (
        <>
          {view === 'list' && (
            <>
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Work Schedule Management</h1>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">Manage work schedules</p>
                </div>
                <button
                  onClick={() => { setView('create'); setEditingWorkScheduleId(null); }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  Add Work Schedule
                </button>
              </div>
              <WorkScheduleList onEdit={handleEditWorkSchedule} onView={handleViewWorkSchedule} />
            </>
          )}

          {view === 'create' && <WorkScheduleForm />}
          {view === 'edit' && editingWorkScheduleId && <WorkScheduleForm />}
        </>
      )}

      {activeTab === 'ojt-schedules' && (
        <>
          {view === 'list' && (
            <>
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">OJT Schedule Management</h1>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">Manage OJT schedules</p>
                </div>
                <button
                  onClick={() => { setView('create'); setEditingOJTScheduleId(null); }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  Add OJT Schedule
                </button>
              </div>
              <OJTScheduleList onEdit={handleEditOJTSchedule} onView={handleViewOJTSchedule} />
            </>
          )}

          {view === 'create' && <OJTScheduleForm />}
          {view === 'edit' && editingOJTScheduleId && <OJTScheduleForm />}
        </>
      )}
    </div>
  );
}