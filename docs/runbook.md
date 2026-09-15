# Runbook: Common Operations

## Admin Bootstrap

### Set First Admin
1. Login with any account
2. Open browser console
3. Get your UID from Firebase Auth
4. Run the admin setter script:
```bash
node scripts/set-admin.js your-email@test.com
```
5. Logout and login again to get admin custom claims

### Create Additional Admins
1. Go to Admin > Users
2. Click "Create User"
3. Set role to "Admin"
4. Save

## Secret Rotation

### QR JWT Secret
1. Generate new secret:
```bash
openssl rand -hex 32
```
2. Update Supabase:
```bash
supabase secrets set QR_JWT_SECRET=<new-secret>
```
3. All existing QR tokens are immediately invalidated

### Firebase Service Account
1. Go to Firebase Console > Project Settings > Service Accounts
2. Generate new key
3. Update Supabase:
```bash
supabase secrets set FIREBASE_SERVICE_ACCOUNT=$(base64 -w 0 new-key.json)
```

## Free Tier Maintenance (7-Day Pause)

Supabase pauses projects after 7 days of inactivity. To prevent:

### Option A: Scheduled Wake-Up
Set up a cron job (e.g., GitHub Action):
```yaml
name: Keep Supabase Alive
on:
  schedule:
    - cron: '0 0 * * *'  # Daily at midnight
jobs:
  wake:
    runs-on: ubuntu-latest
    steps:
      - run: curl https://your-project.supabase.co/rest/v1/ -H "apikey: your-anon-key"
```

### Option B: Manual Wake
If paused, go to Supabase dashboard and click "Restore"

## Backup

### Firestore Backup
```bash
gcloud firestore export gs://your-backup-bucket
```

### Supabase Backup
- Automatic daily backups on Pro plan
- Free plan: Manual export via SQL dump
```bash
supabase db dump > backup.sql
```

## Troubleshooting

### Login Fails
1. Check Firebase Auth is enabled
2. Verify custom claims are set
3. Check browser console for errors

### QR Scan Fails
1. Verify QR token hasn't expired (default 60s)
2. Check edge function logs in Supabase dashboard
3. Ensure trainee is assigned to supervisor

### DTR Calculation Wrong
1. Check attendance records exist
2. Verify time_in before time_out
3. Check for holidays in PH_HOLIDAYS list

### File Upload Fails
1. Check Supabase Storage RLS policies
2. Verify file type is allowed
3. Check file size < 10MB

### Notifications Not Sending
1. Check FCM token is valid
2. Verify edge function secrets
3. Check Supabase function logs

## Monitoring Checklist

### Daily
- [ ] Check Firebase Console usage (reads/writes)
- [ ] Check Supabase dashboard (invocations/storage)

### Weekly
- [ ] Review audit logs for anomalies
- [ ] Check for failed edge function invocations
- [ ] Verify backup integrity

### Monthly
- [ ] Review free tier usage vs limits
- [ ] Check for security rule denials
- [ ] Update dependencies
