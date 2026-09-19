# Interno Trainee Management System - Comprehensive Testing Prompt

## Overview
Test every item systematically across all roles, devices, and scenarios.
Test each role: Admin, Coordinator, Supervisor, Trainee.

---

## 1. Authentication and Access Control

### Login/Logout
- [ ] Admin login with admin@test.com / admin123
- [ ] Coordinator login with coordinator1@test.com / coordinator123
- [ ] Supervisor login with supervisor1@test.com / supervisor123
- [ ] Trainee login with valid credentials
- [ ] Invalid email shows error
- [ ] Invalid password shows error
- [ ] Empty fields show validation errors
- [ ] Sign out works and redirects to login
- [ ] Session persists on page refresh
- [ ] Unauthenticated user redirected to login from all protected routes

### Role-Based Access
- [ ] Admin can access /admin/* routes
- [ ] Coordinator can access /coordinator/* routes
- [ ] Supervisor can access /supervisor/* routes
- [ ] Trainee can access /trainee/* routes
- [ ] Cross-role access is blocked (e.g. coordinator cannot access /admin/*)
- [ ] Direct URL navigation to wrong role is redirected

### Custom Claims
- [ ] Verify role claim is set correctly in Firebase Auth
- [ ] Verify companyId claim is set for coordinator/supervisor
- [ ] Verify Firestore rules reject users with wrong role

---

## 2. Admin Dashboard

### Dashboard (/admin)
- [ ] Stats cards load (total users, companies, trainees)
- [ ] Charts render without errors (Recharts)
- [ ] Numbers match Firestore data
- [ ] Loading skeleton shows while fetching
- [ ] Error state shows retry button
- [ ] Mobile responsive layout

### Users Management (/admin/users)
- [ ] User list loads with all users
- [ ] Search/filter works
- [ ] Create new user form opens
- [ ] Form validates required fields
- [ ] Role selection works (admin, coordinator, supervisor, trainee)
- [ ] Company assignment works for coordinator/supervisor
- [ ] Edit user opens pre-filled form
- [ ] Delete user shows confirmation dialog
- [ ] Delete user removes from Firestore + Auth
- [ ] Toast notification appears on success/failure

### Companies (/admin/companies)
- [ ] Company list loads
- [ ] Create company form works
- [ ] Edit company works
- [ ] Delete company shows confirmation
- [ ] Empty state shows when no companies

### Departments (/admin/departments)
- [ ] Department list loads
- [ ] Create department works
- [ ] Edit department works
- [ ] Delete department works
- [ ] Department linked to company correctly

### Supervisors (/admin/supervisors)
- [ ] Supervisor list loads
- [ ] Create supervisor works (Auth user + Firestore doc)
- [ ] Edit supervisor works
- [ ] Delete supervisor works
- [ ] Company assignment is correct

### Coordinators (/admin/coordinators)
- [ ] Coordinator list loads
- [ ] Create coordinator works
- [ ] Edit coordinator works
- [ ] Delete coordinator works

### Trainees (/admin/trainees)
- [ ] Trainee list loads
- [ ] Create trainee works (internal placement)
- [ ] Edit trainee works
- [ ] Delete trainee works
- [ ] Placement type auto-detection works

### Work Schedules (/admin/work-schedules)
- [ ] Schedule list loads
- [ ] Create/Edit/Delete schedule works
- [ ] Time picker functions correctly

### OJT Schedules (/admin/ojt-schedules)
- [ ] OJT schedule list loads
- [ ] Create/Edit/Delete works
- [ ] Date pickers function correctly

### Audit Logs (/admin/audit-logs)
- [ ] Audit log list loads
- [ ] Logs show correct user, action, entity, timestamp
- [ ] Filter/search works
- [ ] Pagination works

### Announcements (/admin/announcements)
- [ ] Announcement list loads (admin sees ALL companies)
- [ ] Create announcement with company selection works
- [ ] Edit announcement pre-fills all fields including company
- [ ] Pin/Unpin toggles correctly
- [ ] Archive changes status and removes Archive button
- [ ] Publish changes Draft to Published
- [ ] Delete shows confirmation dialog
- [ ] Target roles multi-select works
- [ ] Priority selection works (Low/Normal/High/Urgent)
- [ ] Expiry date optional field works
- [ ] Pin SVG icon is correct pushpin shape
- [ ] Toast notifications appear on all actions

---

## 3. Coordinator Dashboard

### Dashboard (/coordinator)
- [ ] Stats cards load for company-scoped data
- [ ] Charts render correctly
- [ ] Data is scoped to coordinator's company only

### Trainees (/coordinator/trainees)
- [ ] Trainee list loads (company-scoped only)
- [ ] View trainee details works
- [ ] Edit trainee works
- [ ] Trainee names resolve from users collection (not trainees.name)

### Placement Requests (/coordinator/placements)
- [ ] Placement request list loads (company-scoped)
- [ ] Approve placement works
- [ ] Reject placement works
- [ ] Company resolution works for placement requests

### Attendance (/coordinator/attendance)
- [ ] Attendance view loads (read-only)
- [ ] Trainee names resolve correctly via users collection
- [ ] Attendance data is company-scoped

### Tasks (/coordinator/tasks)
- [ ] Task overview loads (read-only per trainee)
- [ ] Trainee names resolve correctly via users collection
- [ ] Task data is company-scoped

### Documents (/coordinator/documents)
- [ ] Document list loads
- [ ] Document types match company requirements
- [ ] Review/approve documents works

### Announcements (/coordinator/announcements)
- [ ] Announcement list loads (company-scoped only)
- [ ] Create announcement works (auto-assigns companyId)
- [ ] Edit announcement works
- [ ] Pin/Unpin works
- [ ] Archive works
- [ ] Delete works
- [ ] Cannot edit admin announcements from different company

### Evaluations (/coordinator/evaluations)
- [ ] Evaluation list loads
- [ ] Create evaluation works
- [ ] Edit evaluation works
- [ ] Evaluation form has correct trainee/supervisor selectors

---

## 4. Supervisor Dashboard

### Dashboard (/supervisor)
- [ ] Stats cards load for assigned trainees
- [ ] isExternal detection works correctly
- [ ] Data scoped to supervisor's company

### Attendance Monitor (/supervisor/attendance)
- [ ] Attendance list loads for assigned trainees
- [ ] QR display works (Start/Stop buttons)
- [ ] QR token generation via Cloud Function works
- [ ] QR countdown timer works
- [ ] Refresh button hidden when QR inactive
- [ ] Auth guard prevents unauthorized access

### Task Management (/supervisor/tasks)
- [ ] Task list loads for assigned trainees
- [ ] Filter UI works (single selects, consistent styling)
- [ ] Create task works
- [ ] Edit task works
- [ ] Delete task works
- [ ] Task status update works

### DTR (/supervisor/dtr)
- [ ] DTR list loads (company-scoped)
- [ ] Approve DTR via Cloud Function works
- [ ] Reject DTR via Cloud Function works
- [ ] Review correction request via Cloud Function works
- [ ] Audit logs created for all DTR actions
- [ ] Toast notifications appear on success/failure

### Leave Requests (/supervisor/leave)
- [ ] Leave list loads (company-scoped)
- [ ] Approve leave works
- [ ] Reject leave works

### Evaluations (/supervisor/evaluations)
- [ ] Evaluation list loads (supervisorId-scoped)
- [ ] Trainee selector works
- [ ] Create/submit evaluation works
- [ ] userId fallback works correctly

### Announcements (/supervisor/announcements)
- [ ] Announcement list loads (company-scoped)
- [ ] View-only mode (no action buttons)
- [ ] Cannot create/edit/delete announcements

---

## 5. Trainee Dashboard

### Dashboard (/trainee)
- [ ] Stats cards load for trainee's own data
- [ ] Progress indicators work

### My Tasks (/trainee/tasks)
- [ ] Task list shows only own tasks
- [ ] Task status update works
- [ ] Task details view works

### My DTR (/trainee/dtr)
- [ ] DTR shows own time logs
- [ ] Submit DTR works
- [ ] View DTR history works

### QR Attendance (/trainee/attendance)
- [ ] QR scanner opens camera
- [ ] Scanner works offline (validates token locally first)
- [ ] Successful scan records attendance
- [ ] Failed scan shows error message
- [ ] Device info recorded with scan

### Documents (/trainee/documents)
- [ ] Document upload works
- [ ] File type validation works (MIME type check)
- [ ] File size validation works (max 10MB)
- [ ] Document list shows own documents
- [ ] Upload progress indicator works

### Leave Requests (/trainee/leave)
- [ ] Leave request form works
- [ ] Leave history shows own requests
- [ ] Status tracking works

### Announcements (/trainee/announcements)
- [ ] Announcement list loads (company-scoped, published only)
- [ ] View-only mode
- [ ] Target role filtering works (only sees announcements targeting trainees)

---

## 6. UI/UX Consistency

### Visual Design
- [ ] All pages use consistent color scheme (blue-600 primary)
- [ ] Dark mode toggle works everywhere
- [ ] All icons are SVG (no emojis)
- [ ] Icon sizes consistent (w-4 h-4 for action buttons)
- [ ] Card styles consistent across all pages
- [ ] Button styles consistent (primary, secondary, danger)
- [ ] Form input styles consistent
- [ ] Badge/pill styles consistent
- [ ] Table styles consistent

### Mobile Responsiveness
- [ ] All pages work on mobile (320px width)
- [ ] Sidebar collapses to hamburger menu on mobile
- [ ] Forms stack vertically on mobile
- [ ] Tables scroll horizontally on mobile
- [ ] Touch targets are at least 44x44px
- [ ] No horizontal overflow on any page

### Loading States
- [ ] Skeleton loaders show while data fetches
- [ ] Spinner shows during form submission
- [ ] Disabled state on buttons during async operations
- [ ] Empty states show helpful messages

### Error States
- [ ] Error messages are clear and actionable
- [ ] Retry buttons work
- [ ] Toast notifications appear for all operations
- [ ] No unhandled console errors

### Accessibility
- [ ] All form inputs have labels
- [ ] All buttons have accessible names
- [ ] Focus management works (tab order logical)
- [ ] Color is not the only way to convey information
- [ ] Alt text on images (if any)

---

## 7. Security

### Firestore Rules
- [ ] Trainee can only access own data
- [ ] Supervisor can only access assigned trainees
- [ ] Coordinator can only access own company data
- [ ] Admin can access all data
- [ ] Unauthenticated users cannot read any collection
- [ ] Role escalation is blocked (trainee cannot write to admin collections)
- [ ] Company scoping enforced for coordinator/supervisor
- [ ] Audit logs are immutable (no update/delete allowed)

### Storage Rules
- [ ] File type validation enforced (documents, tasks, profiles buckets)
- [ ] File size limit enforced (max 10MB)
- [ ] Magic-byte check works in Cloud Function validateUpload
- [ ] Users can only upload to their own paths
- [ ] No secret files accessible publicly

### Cloud Functions
- [ ] QR token generation requires authentication
- [ ] QR token validation checks expiration
- [ ] QR token is single-use (invalidated after scan)
- [ ] DTR calculations are server-side only
- [ ] Role admin Cloud Function checks permissions
- [ ] FCM send requires proper authorization
- [ ] Email send requires proper authorization
- [ ] No secrets exposed in client code

### Data Integrity
- [ ] Audit logs created for: attendance scans, DTR changes, task status, document uploads, role changes
- [ ] Audit log fields complete: timestamp, userId, action, entityType, entityId, originalValue, newValue, metadata
- [ ] Attendance never overwritten - correction requests used
- [ ] Soft delete only (archive flag) - permanent delete requires admin

---

## 8. Offline Behavior

- [ ] Firestore offline persistence enabled
- [ ] Mutations queue locally when offline
- [ ] Pending/synced status shown in UI
- [ ] QR scanner works offline (validates token locally)
- [ ] Data syncs on reconnect
- [ ] No data loss during airplane mode transitions

---

## 9. Performance

- [ ] Pages load within 3 seconds
- [ ] No unnecessary re-renders
- [ ] TanStack Query caching works (5-min cache for supervisor data)
- [ ] Large lists use pagination or virtualization
- [ ] Images are optimized
- [ ] No memory leaks (cleanup in useEffect)

---

## 10. Announcements Feature (Detailed)

### CRUD Operations
- [ ] Create: title, content, company, priority, target roles, expiry, pinned
- [ ] Read: list with filter by status, pin indicator, author, date, target roles
- [ ] Update: all fields editable, company pre-selected on edit
- [ ] Delete: confirmation dialog, permanent removal

### Pin/Unpin
- [ ] Pin icon is proper pushpin/thumbtack shape
- [ ] Pin button toggles between Pin/Unpin
- [ ] Pinned announcements show blue bar at top
- [ ] Pinned announcements show blue pin badge next to priority
- [ ] Unpinned state shows outline stroke only
- [ ] Pinned state shows filled icon

### Archive/Publish
- [ ] Archive button only shows for Published status
- [ ] Publish button only shows for Draft status
- [ ] Status badge updates after action
- [ ] Archive button removed after archiving

### Company Scoping
- [ ] Admin: sees ALL announcements (no companyId filter)
- [ ] Coordinator: sees only own company announcements
- [ ] Supervisor: sees only own company announcements
- [ ] Trainee: sees only own company + published + targeting their role

### Form Validation
- [ ] Title required
- [ ] Content required
- [ ] Company required (admin must select)
- [ ] At least one target role selected
- [ ] Save Draft disabled when required fields empty
- [ ] Publish disabled when required fields empty

### Edge Cases
- [ ] Editing announcement preserves original companyId
- [ ] Coordinator cannot change company on edit
- [ ] Admin can change company on edit
- [ ] Expiry date optional - undefined does not cause Firestore error
- [ ] Empty targetRoles array handled correctly

---

## 11. Cloud Functions

### QR Token (generateQRToken)
- [ ] Requires authenticated user
- [ ] Token contains companyId, action, exp, nonce
- [ ] Token signed with HS256
- [ ] Token expiration configurable (30s/60s/2m/5m)
- [ ] Token invalidated after successful scan

### DTR (calculateDTR)
- [ ] Calculates hours correctly
- [ ] Handles break times
- [ ] Works across midnight
- [ ] Timezone handled correctly (UTC in DB, local in UI)

### DTR Actions (approveDTR, rejectDTR, reviewCorrectionRequest)
- [ ] Permission checks work
- [ ] Company scoping enforced
- [ ] Audit logs created
- [ ] reviewCorrectionRequest uses Firestore transaction

### Upload Validation (validateUpload)
- [ ] MIME type check works
- [ ] File size check works
- [ ] Magic-byte verification works
- [ ] companyId segment in storage path

---

## 12. Indexes

- [ ] tasks: companyId + status + createdAt
- [ ] tasks: createdBy + createdAt
- [ ] leave_requests: companyId + createdAt
- [ ] evaluations: supervisorId + createdAt
- [ ] announcements: companyId + createdAt
- [ ] All composite indexes deployed and built (check Firebase Console)

---

## Testing Commands

\\\ash
# Run TypeScript check
npx tsc --noEmit

# Run ESLint
npm run lint

# Run tests
npm test

# Build for production
npm run build

# Deploy to staging
firebase deploy --project staging

# Test Firestore rules
firebase firestore:test
\\\

---

## Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@test.com | admin123 |
| Coordinator | coordinator1@test.com | coordinator123 |
| Supervisor | supervisor1@test.com | supervisor123 |
| Trainee | (create via admin) | (set during creation) |

---

## Notes

- App hits PRODUCTION Firebase (VITE_USE_FIREBASE_EMULATORS=false)
- Firebase project: interno-cec9f, region: asia-southeast1
- QR_JWT_SECRET is a 64-char hex string set via firebase functions:secrets:set
- Firestore composite indexes can take 5-10 minutes to build
- seed-test-data.cjs does NOT auto-create supervisor/coordinator/trainee docs
- Firebase Auth User object does NOT have companyId - must resolve from Firestore
- Trainees collection does NOT store name directly - names are in users.displayName
- All timestamps UTC in DB, converted to user timezone in UI only
