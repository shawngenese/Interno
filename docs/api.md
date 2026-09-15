# Edge Functions API Reference

All edge functions are deployed to Supabase (Singapore region). Call via `supabase.functions.invoke()` or REST API.

## Authentication
All functions require a valid Supabase JWT in the `Authorization: Bearer <token>` header.

---

## generate_qr_token
Generates a QR code token for attendance scanning.

**Request:**
```json
{
  "action": "time_in" | "time_out",
  "expirationSeconds": 60
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresAt": 1694000000000,
  "nonce": "a1b2c3d4"
}
```

**Errors:**
- 401: Unauthenticated
- 403: Not a supervisor

---

## validate_qr_scan
Validates a QR token and creates an attendance record.

**Request:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "deviceInfo": {
    "platform": "mobile",
    "userAgent": "..."
  }
}
```

**Response:**
```json
{
  "success": true,
  "attendanceId": "abc123",
  "type": "time_in",
  "timestamp": 1694000000000
}
```

**Errors:**
- 401: Unauthenticated
- 400: Token expired/invalid/already used
- 403: Not an assigned trainee

---

## write_audit
Creates an audit log entry. Called internally by other functions.

**Request:**
```json
{
  "userId": "user-123",
  "action": "create",
  "entityType": "task",
  "entityId": "task-456",
  "originalValue": null,
  "newValue": { "title": "New Task" },
  "metadata": { "ip": "1.2.3.4" }
}
```

**Response:**
```json
{
  "success": true,
  "logId": "log-789"
}
```

---

## calculate_dtr
Calculates Daily Time Record for a trainee over a date range.

**Request:**
```json
{
  "traineeId": "trainee-1",
  "startDate": 1694000000000,
  "endDate": 1694600000000,
  "forceRecalc": false
}
```

**Response:**
```json
{
  "success": true,
  "calculated": 5,
  "dtrs": [
    {
      "id": "dtr-1",
      "traineeId": "trainee-1",
      "date": "2026-09-10",
      "regularHours": 8,
      "overtimeHours": 0,
      "nightDiffHours": 0,
      "lateMinutes": 0,
      "undertimeMinutes": 0,
      "totalHours": 8,
      "isHoliday": false,
      "status": "draft"
    }
  ]
}
```

---

## set_user_role
Sets a user's role and custom claims. Admin only.

**Request:**
```json
{
  "uid": "user-123",
  "role": "supervisor",
  "companyId": "company-1",
  "departmentId": "dept-1"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Role set to supervisor for user user-123"
}
```

**Errors:**
- 401: Unauthenticated
- 403: Not an admin

---

## validate_upload
Validates file uploads for type and size. Called before Supabase Storage uploads.

**Request:**
```json
{
  "fileName": "medical.pdf",
  "fileSize": 1024000,
  "mimeType": "application/pdf",
  "bucket": "documents"
}
```

**Response:**
```json
{
  "valid": true,
  "message": "File validation passed"
}
```

**Errors:**
- 400: Invalid file type or size exceeds limit

---

## send_fcm
Sends Firebase Cloud Messaging notification.

**Request:**
```json
{
  "userId": "user-123",
  "title": "Task Assigned",
  "body": "You have a new task: Design mockups",
  "data": {
    "taskId": "task-456",
    "type": "task_assigned"
  }
}
```

**Response:**
```json
{
  "success": true,
  "messageId": "msg-789"
}
```

---

## Free Tier Limits
- **Supabase**: 500k invocations/month, 1GB storage, 7-day pause without activity
- **Firebase Spark**: 50k reads/day, 20k writes/day
- **Recommended**: ~16k invocations/day average to stay within free tier
