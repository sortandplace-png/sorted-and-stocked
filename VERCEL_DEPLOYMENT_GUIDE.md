# Vercel Production Deployment Guide
**Status**: Ready to Deploy  
**Date**: 2026-07-07

---

## Quick Start: Deploy in 5 Minutes

### Step 1: Connect Repository
1. Go to [vercel.com/new](https://vercel.com/new)
2. Select "Import Git Repository"
3. Connect your GitHub account
4. Find `sorted-and-stocked` repo
5. Click **Import**

### Step 2: Configure Project
On the "Configure Project" screen:
- **Project Name**: `sorted-and-stocked` (or your choice)
- **Framework Preset**: Next.js (auto-detected)
- **Root Directory**: `./` (default)
- Click **Deploy**

### Step 3: Set Environment Variables (CRITICAL)
⚠️ **DO THIS BEFORE YOUR FIRST DEPLOYMENT**

**Option A: Before Initial Deploy (Recommended)**
1. On the deploy screen, click **"Environment Variables"**
2. Add these variables (one at a time):

| Variable Name | Value | Scope |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://jfaaqzrezcrkkidlsbwj.supabase.co` | Production |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_DH-u_GySA0YejAP1vkcDpg_gkYE1KFT` | Production |

3. Click **"Deploy Now"**

**Option B: After Initial Deploy (If Missed)**
1. Go to Project Settings → Environment Variables
2. Add the same two variables above
3. Set scope to **Production**
4. Click **"Save"**
5. Go to **Deployments** tab
6. Find the latest deployment
7. Click **"Redeploy"** button
8. Confirm redeployment

### Step 4: Verify Deployment
1. Wait for deployment to complete (usually ~2-3 minutes)
2. You'll get a unique URL: `https://sorted-and-stocked-[random].vercel.app`
3. Click the URL to visit your live site
4. **Test**: Navigate to `/properties/ba9ed5a7-4e05-4eb6-a315-dfda3ae7e57a/shopping-list`
5. Verify:
   - ✅ Login works
   - ✅ Inventory loads
   - ✅ Meal plan shows
   - ✅ Shopping list displays
   - ✅ Staples tab works

---

## Environment Variables Reference

### Safe to Expose (NEXT_PUBLIC_)
These are **public** keys and safe to commit or expose in client-side code:

```
NEXT_PUBLIC_SUPABASE_URL=https://jfaaqzrezcrkkidlsbwj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_DH-u_GySA0YejAP1vkcDpg_gkYE1KFT
```

✅ These are used by the browser to connect to Supabase
✅ Limited permissions (anon role only)
✅ Safe in version control

### Secret (Server-Side Only)
This key is **NOT** included in Vercel deployment for client-side use:

```
SUPABASE_SERVICE_ROLE_KEY=<copy the current value from Supabase dashboard → API Keys → secret key>
```

⚠️ DO NOT set this as NEXT_PUBLIC_
⚠️ Only needed if backend routes call Supabase with elevated privileges
⚠️ Should only exist in server-side environment (Edge Functions, API routes)
⚠️ Never paste the literal value into this file (or any committed file) —
   a previous version of this doc had the real key hardcoded here since
   2026-07-05 (commit 9c57aa7), which is how it ended up needing rotation.
   Copy it directly from the Supabase dashboard into Vercel's environment
   variable UI and into your local .env.local — never through a doc.

---

## Deployment Checklist

- [ ] Repository pushed to GitHub
- [ ] `vercel.json` or `next.config.js` present in root
- [ ] No uncommitted changes locally
- [ ] Environment variables set in Vercel dashboard
- [ ] Initial deployment completes without errors
- [ ] Visit production URL and verify login works
- [ ] Test shopping list page loads
- [ ] Test staples tab renders
- [ ] Check browser console for no errors
- [ ] Verify Supabase connection (check Network tab → POST to api.supabase.co)

---

## Troubleshooting

### Deployment Fails with "Build Error"
1. Check build logs in Vercel dashboard
2. Likely cause: Missing env vars → Go back to Step 3
3. Re-run deployment after adding env vars

### Page Loads but Shows "Sign in"
**This is normal** — you're logged out on the live site. Just sign in with your test account.

### Page Loads but Shows Errors
1. Open browser DevTools (F12)
2. Check **Console** tab for red errors
3. Check **Network** tab:
   - POST to `api.supabase.co` should return 200
   - If 401: env vars are wrong
   - If 403: RLS policy blocking access

### Supabase Connection Fails
**Cause**: Wrong env vars or firewall blocks connection
**Fix**:
1. Verify `NEXT_PUBLIC_SUPABASE_URL` exactly matches: `https://jfaaqzrezcrkkidlsbwj.supabase.co`
2. Verify `NEXT_PUBLIC_SUPABASE_ANON_KEY` starts with `sb_publishable_`
3. Redeploy after corrections

### Staples Tab Shows Nothing
1. Verify RPC functions exist in Supabase: `get_staples_with_inventory`
2. Check browser console for errors
3. Open DevTools → Network → filter by "graphql" or "rest"
4. Look for failed requests to Supabase

---

## Custom Domain (Optional)

After deployment works:

1. Go to Project Settings → Domains
2. Click "Add Domain"
3. Enter your domain (e.g., `sorted-stocked.com`)
4. Follow DNS setup instructions
5. SSL certificate auto-issued (free)

---

## Environment Variables for Reference

**Project ID**: `jfaaqzrezcrkkidlsbwj`
**Supabase Region**: us-east-1
**Vercel Region**: Auto-selected (optimal)

---

## Next Steps After Successful Deploy

1. **Run Smoke Tests** (Step 5 from launch timeline):
   - Login to production URL
   - Navigate inventory → verify 188 items load
   - Open recipe → verify details show
   - View meal plan → verify entries display
   - Create shopping list from meal plan
   - Add staples to list
   - QR scan → verify routing works

2. **Monitor in Production**:
   - Check Vercel Analytics dashboard
   - Monitor Supabase performance
   - Watch for 4xx/5xx errors

3. **Celebrate** 🎉
   - You're live! The Strauss Residence app is now in production.

---

## Support

**Vercel Docs**: [vercel.com/docs](https://vercel.com/docs)
**Supabase Integration**: [supabase.com/docs/guides/integrations/vercel](https://supabase.com/docs/guides/integrations/vercel)
**Next.js Environment Variables**: [nextjs.org/docs/basic-features/environment-variables](https://nextjs.org/docs/basic-features/environment-variables)
