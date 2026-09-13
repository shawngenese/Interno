# Supabase Edge Functions — Secrets & Deployment (C2, Singapore region)

> Create the Supabase Free project in the **Singapore region** (no card).
> Create Storage buckets `documents`, `tasks`, `profiles` (private).

## Required Secrets (Supabase Dashboard → Project → Edge Functions → Secrets)

| Secret Name | Value | Source |
|-------------|-------|--------|
| `FIREBASE_SERVICE_ACCOUNT` | **Entire serviceAccountKey.json as one line** (escape newlines) | Firebase Console > Project Settings > Service Accounts > Generate new private key → `cat serviceAccountKey.json \| tr -d '\n'` |
| `QR_JWT_SECRET` | Random 32+ char string (HS256 signing key for QR tokens) | `openssl rand -base64 32` |
| `SUPABASE_SERVICE_ROLE` | Supabase service_role key (for admin DB access if needed) | Supabase Dashboard > Settings > API > service_role key |

> **Never** put these in `.env` or `VITE_*`. They live only in Supabase Edge Secrets.

## Deploy Commands (run from repo root)

```bash
# 1. Link to your Supabase project (one-time)
npx supabase link --project-ref YOUR_PROJECT_REF

# 2. Push secrets (run once, or when rotating)
npx supabase secrets set FIREBASE_SERVICE_ACCOUNT="$(cat serviceAccountKey.json | tr -d '\n')"
npx supabase secrets set QR_JWT_SECRET="$(openssl rand -base64 32)"
npx supabase secrets set SUPABASE_SERVICE_ROLE="your-service-role-key"

# 3. Deploy functions (all 7)
npx supabase functions deploy set_user_role
npx supabase functions deploy write_audit
npx supabase functions deploy generate_qr_token
npx supabase functions deploy validate_qr_scan
npx supabase functions deploy calculate_dtr
npx supabase functions deploy validate_upload
npx supabase functions deploy send_fcm

# 4. Verify
npx supabase functions list
# Should show all 7 functions as "Deployed"
```

## Local Development (with Supabase CLI)

```bash
# Start local Supabase (includes Edge Functions runtime)
npx supabase start

# Serve functions locally (hot reload)
npx supabase functions serve set_user_role --env-file .env.local
npx supabase functions serve write_audit --env-file .env.local
```

## Function Endpoints

After deploy, functions are available at:
```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/<name>
# set_user_role, write_audit, generate_qr_token, validate_qr_scan,
# calculate_dtr, validate_upload, send_fcm
```

The client `callEdgeFunction()` helper in `src/config/supabase.ts` builds these URLs automatically from `VITE_SUPABASE_URL`.

## Testing with curl

```bash
# Get a Firebase ID token first (from browser devtools → Application → Local Storage → firebase:authUser:...)

curl -X POST \
  -H "Authorization: Bearer YOUR_FIREBASE_ID_TOKEN" \
  -H "apikey: YOUR_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"uid":"TARGET_UID","role":"supervisor","companyId":"COMPANY_ID"}' \
  https://YOUR_PROJECT_REF.supabase.co/functions/v1/set_user_role

curl -X POST \
  -H "Authorization: Bearer YOUR_FIREBASE_ID_TOKEN" \
  -H "apikey: YOUR_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"userId":"CALLER_UID","action":"create","entityType":"user","entityId":"TARGET_UID","newValue":{"role":"supervisor"}}' \
  https://YOUR_PROJECT_REF.supabase.co/functions/v1/write_audit
```

## After Deploy — What Works

| Feature | Edge Function | Client Call |
|---------|---------------|-------------|
| Admin changes user role in UserForm | `set_user_role` | `adminService.updateUser(uid, { role })` |
| Any admin write triggers audit | `write_audit` | Auto-called by `audit()` in adminService |
| Supervisor displays QR | `generate_qr_token` | QR display page via `callEdgeFunction` |
| Trainee scans QR | `validate_qr_scan` | Scanner page via `callEdgeFunction` |
| DTR calculation | `calculate_dtr` | `dtrService.calculateDTR` |
| Document upload validation | `validate_upload` | `documentService` upload flow |
| Push notifications | `send_fcm` | `notificationService` via `callEdgeFunction` |