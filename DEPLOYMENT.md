# CloudVault (xenoDrive) Production Deployment Guide 🚀

> **Target Stack:** Vercel Hobby (Frontend) + Render Free (Backend) + MongoDB Atlas M0 (Database) + S3 Object Storage (Supabase S3 Free) + GitHub  
> **Total Monthly Cost:** **$0.00 / month (100% Free Tier - Zero Credit Card Required)**

---

## 📋 External Account & Setup Requirements

Before deploying, ensure you have active accounts on each provider. All services operate within their free-tier allowances without requiring paid upgrades:

| Provider | Purpose | Free Tier Allowance | Card / Verification |
| :--- | :--- | :--- | :--- |
| **GitHub** | Source Control & Git CI/CD | Unlimited public/private repositories | No card required |
| **MongoDB Atlas** | Managed Database (M0) | 512 MB storage, shared RAM, 500 connections | No card required |
| **Supabase Storage** | S3-Compatible Cloud Storage | 1 GB storage, S3 Presigned URLs, $0 egress | **No card required** |
| **Cloudflare R2** | Optional Alternative S3 Storage | 10 GB storage, $0 egress | Card verification required for signup ($0 charge) |
| **Render** | Backend Node.js API hosting | 512 MB RAM, 0.1 CPU, 750 free instance hours/month | No card required |
| **Vercel** | Frontend React SPA hosting | 100 GB bandwidth, unlimited preview deployments | No card required |

> [!TIP]
> **Zero-Card Setup (Recommended):** Use **Supabase Storage** for S3-compatible cloud storage. It requires **zero credit or debit card details** and gives you 1 GB of free storage. If you want 10 GB free, you can alternatively use Cloudflare R2.

---

## 🗄 Step 1: Set Up MongoDB Atlas (Free M0)

1. Sign in to [MongoDB Atlas](https://cloud.mongodb.com/).
2. Click **Create** and select **M0 Free** (Shared).
3. Select your preferred cloud provider and region (choose one geographically close to your Render region, e.g., AWS US-East / Oregon).
4. **Database Access (User Setup):**
   - Go to **Security** -> **Database Access** -> **Add New Database User**.
   - Authentication Method: **Password**.
   - Username: `cloudvault_admin` (or your choice).
   - Password: Click **Autogenerate Secure Password** and copy it.
   - Role: **Read and write to any database**.
5. **Network Access (IP Whitelist):**
   - Go to **Security** -> **Network Access** -> **Add IP Address**.
   - Click **Allow Access from Anywhere** (`0.0.0.0/0`).
   - *Reason:* Render free instances use dynamic IP addresses that change on deploy and restart.
6. **Obtain Connection String:**
   - Go to **Database** -> Click **Connect** on your cluster.
   - Select **Drivers** (Node.js).
   - Copy the connection string:
     ```text
     mongodb+srv://cloudvault_admin:<password>@cluster0.abcde.mongodb.net/cloudvault?retryWrites=true&w=majority
     ```
   - Replace `<password>` with your database user password and specify the database name `/cloudvault`.

---

## ☁️ Step 2: Set Up Cloudflare R2 Object Storage

1. Sign in to the [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. In the left navigation, click **R2 Object Storage**.
3. If not already enabled, click **Get started** and follow the prompt to enable R2.
4. **Create a Bucket:**
   - Click **Create bucket**.
   - Bucket name: `cloudvault` (lowercase, alphanumeric).
   - Location: Choose **Automatic** or your closest region.
   - Click **Create Bucket**.
5. **Generate API Token:**
   - In the R2 Overview page, look at the right sidebar and copy your **Account ID**.
   - Click **Manage R2 API Tokens** (top right) -> **Create API token**.
   - Token name: `cloudvault-backend-token`.
   - Permissions: **Object Read & Write**.
   - Specify bucket: **Apply to specific bucket** -> Select `cloudvault` (or all buckets).
   - TTL: Leave blank (Forever) or set desired duration.
   - Click **Create API Token**.
   - **Immediately copy**:
     - `Access Key ID`
     - `Secret Access Key`
6. **Configure Bucket CORS:**
   - In Cloudflare Dashboard -> **R2** -> Click your `cloudvault` bucket -> **Settings** tab.
   - Scroll down to **CORS Policy** -> Click **Add CORS policy** (or Edit).
   - Paste the following JSON policy:
     ```json
     [
       {
         "AllowedOrigins": [
           "https://*.vercel.app",
           "http://localhost:5173"
         ],
         "AllowedMethods": [
           "GET",
           "PUT",
           "HEAD",
           "POST",
           "DELETE"
         ],
         "AllowedHeaders": [
           "*"
         ],
         "ExposeHeaders": [
           "ETag",
           "Content-Length",
           "Content-Type"
         ],
         "MaxAgeSeconds": 3600
       }
     ]
     ```
   - Click **Save**.

---

## 🖥 Step 3: Deploy Backend on Render (Free Tier)

### Option A: Using the `render.yaml` Blueprint (Automated)
1. Push your repository to GitHub.
2. Sign in to [Render](https://render.com/).
3. Click **New +** -> **Blueprint**.
4. Connect your GitHub repository `xenodrive`.
5. Render will automatically detect `render.yaml` and prompt you for the uncommitted environment variables (`MONGODB_URI`, `CLIENT_URL`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`).
6. Click **Apply**.

### Option B: Manual Web Service Setup
1. On the Render Dashboard, click **New +** -> **Web Service**.
2. Connect your GitHub repository `xenodrive`.
3. Fill in the deployment parameters:
   - **Name:** `cloudvault-backend`
   - **Region:** `Oregon (US West)` (or closest to your DB)
   - **Branch:** `main`
   - **Root Directory:** `backend`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free` ($0/month)
4. Under **Advanced** -> **Health Check Path**, enter: `/api/health`
5. Click **Environment Variables** and add the following keys:

| Key | Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables production security & cookies |
| `PORT` | `10000` | Render default port |
| `MONGODB_URI` | `mongodb+srv://...` | Your Atlas connection string |
| `CLIENT_URL` | `https://your-frontend.vercel.app` | Updated after Vercel deploy (comma-separated) |
| `JWT_SECRET` | `(64-char random hex string)` | Secure JWT signing key |
| `JWT_EXPIRES_IN` | `7d` | Session duration |
| `R2_ACCOUNT_ID` | `(Your Cloudflare Account ID)` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | `(Your R2 Access Key ID)` | Cloudflare R2 access key |
| `R2_SECRET_ACCESS_KEY` | `(Your R2 Secret Access Key)` | Cloudflare R2 secret key |
| `R2_BUCKET_NAME` | `cloudvault` | Bucket name |
| `MAX_FILE_SIZE` | `52428800` | 50 MB in bytes |
| `DEFAULT_STORAGE_LIMIT` | `1073741824` | 1 GB quota per user |
| `PRESIGNED_URL_EXPIRES_IN` | `3600` | 1 hour in seconds |

6. Click **Create Web Service**.
7. Wait for the build to finish. Once live, copy your backend URL:
   `https://cloudvault-backend.onrender.com`

---

## 🌐 Step 4: Deploy Frontend on Vercel (Hobby Tier)

1. Sign in to [Vercel](https://vercel.com/) with GitHub.
2. Click **Add New...** -> **Project**.
3. Import your GitHub repository `xenodrive`.
4. In the configuration screen:
   - **Framework Preset:** `Vite`
   - **Root Directory:** Click **Edit** and select `client`.
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`
5. **Environment Variables:**
   - Expand the **Environment Variables** section.
   - Add:
     - Key: `VITE_BASE_URL`
     - Value: `https://cloudvault-backend.onrender.com` *(Your Render backend URL without trailing slash)*
6. Click **Deploy**.
7. In ~60 seconds, your application is deployed at:
   `https://xenodrive.vercel.app` (or assigned Vercel URL).

---

## 🔄 Step 5: Finalize Production CORS Linking

Now that you have your live Vercel frontend URL:
1. Go back to your **Render Dashboard** -> `cloudvault-backend` -> **Environment** tab.
2. Update `CLIENT_URL` to include your live Vercel URL:
   ```text
   CLIENT_URL=https://xenodrive.vercel.app
   ```
3. Click **Save Changes** (Render will automatically redeploy).
4. Update your Cloudflare R2 CORS policy to include your exact domain if needed.

---

## 🧪 Live Deployment Verification Checklist

Execute this verification sequence against the live production URLs:

- [ ] **1. Account Registration:** Visit `https://your-frontend.vercel.app/register`. Register a new account. Verify redirect to Dashboard and JWT cookie set.
- [ ] **2. Login & Session Persistence:** Log out and log back in. Refresh the page; verify session remains active via HTTP-only cookie.
- [ ] **3. Actual Cloudflare R2 Upload:** Upload a PDF or image in My Drive. Verify upload progress bar and confirm direct streaming to Cloudflare R2.
- [ ] **4. Download Verification:** Click Download on the uploaded file. Verify presigned URL streams binary directly from R2 with correct filename.
- [ ] **5. Folder Hierarchy:** Create a root folder and a nested subfolder. Verify breadcrumb navigation works.
- [ ] **6. Move Files:** Move the uploaded file into the nested subfolder.
- [ ] **7. Soft Delete & Restore:** Move a file to Trash. Verify it appears in `/trash`. Restore it back to My Drive.
- [ ] **8. Storage Meter Update:** Check the Storage Meter in the sidebar and Dashboard. Verify bytes match uploaded file size.
- [ ] **9. Secure Public & Password Sharing:** Create a public link with password protection. Open the link in an Incognito window. Verify password prompt and successful unlocking.
- [ ] **10. Backend Cold-Start Inactivity Test:** Wait 15 minutes for Render to enter sleep mode. Open the app in browser. Verify initial loading state waits gracefully for backend wake-up (~30-50s) and resumes normal operations.

---

## ⚠️ Free-Tier Characteristics & Known Limitations

| Provider | Limitation | Expected Behavior | Mitigation Implemented |
| :--- | :--- | :--- | :--- |
| **Render Free** | Inactivity Sleep | Spins down instances after 15 minutes of zero traffic. | Initial wake-up takes 30-50s. Frontend displays clean loading spinners; health check endpoint `/api/health` allows pinging. |
| **MongoDB Atlas M0** | 512 MB Storage Cap | Shared RAM and 512 MB document storage. | File binaries are stored in Cloudflare R2; MongoDB only stores small JSON metadata (~1 KB per file), easily accommodating >50,000 files for free. |
| **Cloudflare R2** | 10 GB Free Storage | Beyond 10 GB incurs $0.015/GB. | User quotas default to 1 GB; client-side SHA-256 deduplication eliminates redundant duplicate uploads. |
| **Vercel Hobby** | Non-Commercial | Fast edge CDN for personal/portfolio projects. | Pre-configured caching headers for immutable assets and instant SPA rewrites. |
