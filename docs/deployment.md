# Deployment Guide

## Prerequisites
- Node.js 22+
- Firebase CLI (`npm install -g firebase-tools`)
- Supabase CLI (`npm install -g supabase`)
- Access to `interno-cec9f` (prod) and `interno-staging` (staging) projects

## Staging Deployment

### 1. Build
```bash
npm run build
```

### 2. Deploy to Staging
```bash
firebase use staging
firebase deploy --only hosting,firestore:rules
```

### 3. Deploy Edge Functions
```bash
cd supabase
supabase link --project-ref <staging-project-ref>
supabase functions deploy generate_qr_token
supabase functions deploy validate_qr_scan
supabase functions deploy write_audit
supabase functions deploy calculate_dtr
supabase functions deploy set_user_role
supabase functions deploy validate_upload
supabase functions deploy send_fcm
```

### 4. Set Edge Function Secrets
```bash
supabase secrets set QR_JWT_SECRET=<your-secret>
supabase secrets set FIREBASE_SERVICE_ACCOUNT=<base64-service-account>
supabase secrets set SUPABASE_SERVICE_ROLE=<service-role-key>
```

## Production Deployment

### 1. Deploy with Approval
```bash
firebase use prod
firebase deploy --only hosting,firestore:rules --force
```

### 2. Deploy Edge Functions
```bash
cd supabase
supabase link --project-ref <prod-project-ref>
supabase functions deploy
```

## Verification

### Post-Deploy Checklist
- [ ] Login works (`admin@test.com`)
- [ ] QR scan flow works
- [ ] DTR calculation correct
- [ ] Documents upload
- [ ] Notifications fire
- [ ] Audit logs write
