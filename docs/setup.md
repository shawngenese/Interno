# Setup Guide

## Prerequisites
- Node.js 22+
- npm
- Firebase CLI
- Supabase CLI
- Google account with Firebase access

## 1. Clone & Install
```bash
git clone <repo-url>
cd trainee-management-system
npm install
```

## 2. Firebase Setup

### Create Projects
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create project `interno-staging`
3. Create project `interno-cec9f`

### Enable Services (Spark Plan)
- **Authentication**: Email/Password + Google
- **Firestore**: Production mode
- **Hosting**: Enable
- **FCM**: Enabled by default

### Download Service Account
1. Go to Project Settings > Service Accounts
2. Click "Generate new private key"
3. Save as `serviceAccountKey.json` (DO NOT commit)

### Set Custom Claims
Run via Firebase CLI or emulator:
```bash
firebase emulators:start
# In another terminal:
node scripts/set-admin.js admin@test.com
```

## 3. Supabase Setup

### Create Project
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Create new project (Singapore region)
3. Note the project URL and anon key

### Run Migrations
```bash
cd supabase
supabase link --project-ref <your-project-ref>
supabase db push
```

### Deploy Edge Functions
```bash
supabase functions deploy
```

### Set Secrets
```bash
supabase secrets set QR_JWT_SECRET=$(openssl rand -hex 32)
supabase secrets set FIREBASE_SERVICE_ACCOUNT=$(base64 -w 0 serviceAccountKey.json)
```

## 4. Environment Variables

Create `.env.local`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 5. Run Locally
```bash
npm run dev
```

## 6. First Login
1. Open http://localhost:5173
2. Login with `admin@test.com` / `password123`
3. You should see the admin dashboard
