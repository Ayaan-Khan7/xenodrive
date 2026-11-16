# CloudVault (xenoDrive) REST API Specification 📜

> Comprehensive API documentation for CloudVault.  
> Base URL (Production): `https://your-backend.onrender.com/api`  
> Base URL (Local Development): `http://localhost:5000/api`

---

## 🔒 Authentication & Headers

Protected endpoints require authentication via either:
1. **Bearer Token:** Header `Authorization: Bearer <jwt_token>`
2. **HTTP-Only Cookie:** Cookie named `token` sent automatically when `credentials: "include"` or `withCredentials: true` is configured.

### Standard Response Envelope

#### Success (HTTP 200 / 201)
```json
{
  "success": true,
  "message": "Operation successful message",
  "statusCode": 200,
  "data": { ... }
}
```

#### Error (HTTP 400 / 401 / 403 / 404 / 409 / 410 / 500)
```json
{
  "success": false,
  "error": "Error description message",
  "statusCode": 400,
  "details": [
    { "field": "name", "message": "File name is required." }
  ]
}
```

---

## 1. System Health

### `GET /api/health`
Health check probe for monitoring services and Render pingers.
- **Access:** Public
- **Query Parameters:**
  - `verbose` (boolean, optional): Set `true` to receive memory & runtime stats.
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "CloudVault backend is running smoothly",
  "data": {
    "status": "healthy",
    "uptime": "2h 15m",
    "database": {
      "status": "connected",
      "connected": true
    }
  }
}
```

---

## 2. Authentication

### `POST /api/auth/register`
Create a new user account.
- **Access:** Public
- **Request Body:**
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "Password123!"
}
```
- **Response `201 Created`:** Sets `token` HTTP-only cookie and returns user object + token string.

### `POST /api/auth/login`
Authenticate user with email and password.
- **Access:** Public
- **Request Body:**
```json
{
  "email": "jane@example.com",
  "password": "Password123!"
}
```
- **Response `200 OK`:** Sets `token` HTTP-only cookie and returns user profile.

### `GET /api/auth/me`
Retrieve profile of currently authenticated user.
- **Access:** Private (Protected)
- **Response `200 OK`:**
```json
{
  "success": true,
  "user": {
    "id": "6732f1...",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "storage_used": 2048576,
    "storage_limit": 1073741824,
    "created_at": "2026-11-15T10:00:00.000Z"
  }
}
```

### `POST /api/auth/logout`
Log out and clear session cookie.
- **Access:** Public / Private
- **Response `200 OK`:** Clears `token` cookie.

### `POST /api/auth/forgot-password`
Request a password reset token.
- **Access:** Public
- **Request Body:** `{ "email": "jane@example.com" }`

### `POST /api/auth/reset-password/:token`
Reset user password using token received via email.
- **Access:** Public
- **Request Body:** `{ "password": "NewSecurePassword123!" }`

---

## 3. Storage Analytics & Dashboard

### `GET /api/dashboard/stats`
Retrieve real-time user statistics, storage metrics, file type distribution, 7-day ingestion trend, largest files, and recent activity logs.
- **Access:** Private
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "total_files": 42,
    "total_folders": 5,
    "storage_used": 154857600,
    "storage_limit": 1073741824,
    "storage_available": 918884224,
    "storage_percent": 14,
    "file_type_distribution": {
      "documents": { "count": 15, "bytes": 45000000 },
      "images": { "count": 20, "bytes": 85000000 },
      "videos": { "count": 2, "bytes": 20000000 },
      "audio": { "count": 1, "bytes": 3000000 },
      "archives": { "count": 4, "bytes": 1857600 }
    },
    "largest_files": [
      {
        "id": "673...",
        "name": "presentation.mp4",
        "size": 18000000,
        "mime_type": "video/mp4",
        "folder_name": "Root"
      }
    ],
    "storage_activity": [
      { "date": "2026-11-15", "bytes": 25000000, "count": 4 }
    ],
    "duplicate_summary": {
      "duplicate_files_count": 2,
      "reclaimable_bytes": 10485760
    },
    "recent_files": [ ... ],
    "recent_activity": [ ... ]
  }
}
```

---

## 4. File Management & Presigned R2 Flow

### Direct R2 Upload Flow

1. **Client requests upload URL** -> Backend validates quota and checks SHA-256 for duplicates.
2. **Client uploads file binary directly to Cloudflare R2** via HTTP PUT.
3. **Client confirms upload with Backend** -> Backend validates object existence, indexes metadata, and logs activity.

### `POST /api/files/request-upload-url`
Request an S3 presigned PUT URL for direct browser-to-R2 upload.
- **Access:** Private
- **Request Body:**
```json
{
  "name": "project_report.pdf",
  "size": 2450000,
  "mime_type": "application/pdf",
  "folder_id": "6732f...",
  "checksum_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "deduplicate": false
}
```
- **Duplicate Response (if hash exists in user account):**
```json
{
  "success": true,
  "is_duplicate": true,
  "duplicate_file": {
    "name": "original_report.pdf",
    "folder_name": "Documents"
  }
}
```
- **Deduplicate Link Response (if `deduplicate: true` passed):**
```json
{
  "success": true,
  "deduplicated": true,
  "file": { ... },
  "message": "File deduplicated and linked with zero storage overhead"
}
```
- **Normal Presigned URL Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "uploadUrl": "https://<account>.r2.cloudflarestorage.com/cloudvault/users/...?X-Amz-Signature=...",
    "storage_key": "users/673.../17316654-project_report.pdf",
    "expiresIn": 3600
  }
}
```

### `POST /api/files/confirm-upload`
Confirm completed direct upload, verify storage object, and create MongoDB file record.
- **Access:** Private
- **Request Body:**
```json
{
  "storage_key": "users/673.../17316654-project_report.pdf",
  "name": "project_report.pdf",
  "size": 2450000,
  "mime_type": "application/pdf",
  "folder_id": "6732f...",
  "checksum_sha256": "e3b0c44..."
}
```
- **Response `201 Created`:** Returns created `file` document.

### `GET /api/files`
List files with search, filtering, and sorting.
- **Access:** Private
- **Query Parameters:**
  - `folder_id` (string): Specific folder ID or `"all"` for global drive search.
  - `search` (string): Substring match for filename AND extracted document text.
  - `type` (string): `documents`, `images`, `videos`, `audio`, `archives`.
  - `date_range` (string): `today`, `7d`, `30d`.
  - `sort` (string): `name_asc`, `name_desc`, `size_asc`, `size_desc`, `date_desc`, `date_asc`.
- **Response `200 OK`:**
```json
{
  "success": true,
  "files": [
    {
      "id": "673...",
      "name": "project_report.pdf",
      "size": 2450000,
      "mime_type": "application/pdf",
      "folder_id": null,
      "matched_in_content": false,
      "created_at": "2026-11-15T12:00:00.000Z"
    }
  ]
}
```

### `GET /api/files/duplicates`
Scan user drive and aggregate duplicate clusters grouped by SHA-256 checksum.
- **Access:** Private
- **Response `200 OK`:**
```json
{
  "success": true,
  "total_duplicate_clusters": 2,
  "total_duplicate_files": 3,
  "total_wasted_bytes": 10485760,
  "clusters": [ ... ]
}
```

### `GET /api/files/:id/preview`
Generate temporary secure presigned download or inline preview URL.
- **Access:** Private
- **Query Parameters:**
  - `download` (boolean, optional): Set `true` to enforce attachment headers.
- **Response `200 OK`:**
```json
{
  "success": true,
  "preview_url": "https://...r2.cloudflarestorage.com/...",
  "url": "https://...r2.cloudflarestorage.com/..."
}
```

### `PATCH /api/files/:id/rename`
Rename a file.
- **Access:** Private
- **Request Body:** `{ "name": "new_report_name.pdf" }`

### `PATCH /api/files/:id/move`
Move a file to target folder (or root).
- **Access:** Private
- **Request Body:** `{ "target_folder": "6732f..." }` (Pass `null` for root).

### `DELETE /api/files/:id`
Soft-delete file to Trash.
- **Access:** Private

### `POST /api/files/:id/restore`
Restore file from Trash.
- **Access:** Private

### `DELETE /api/files/:id/permanent`
Permanently purge file from MongoDB and Cloudflare R2 (reference-counted).
- **Access:** Private

---

## 5. Folder Management

### `GET /api/folders`
List folders for a specific parent (or root).
- **Access:** Private
- **Query Parameters:** `parent_id` (string, optional)

### `POST /api/folders`
Create a folder.
- **Access:** Private
- **Request Body:** `{ "name": "Financials", "parent_id": null }`

### `GET /api/folders/:id`
Get folder details and full ancestor breadcrumb array.
- **Access:** Private

### `PATCH /api/folders/:id/rename`
Rename folder.
- **Access:** Private
- **Request Body:** `{ "name": "Q1 Financials" }`

### `PATCH /api/folders/:id/move`
Move folder to another parent.
- **Access:** Private
- **Request Body:** `{ "target_parent": "6732f..." }`

### `DELETE /api/folders/:id`
Soft-delete folder and all nested descendants to Trash.
- **Access:** Private

### `POST /api/folders/:id/restore`
Restore folder and all descendants from Trash.
- **Access:** Private

### `DELETE /api/folders/:id/permanent`
Permanently delete folder, subfolders, and files.
- **Access:** Private

---

## 6. Secure Sharing

### `POST /api/shares`
Create or update a public share link for a file or folder.
- **Access:** Private
- **Request Body:**
```json
{
  "resource_id": "6732f...",
  "resource_type": "file",
  "permission": "download",
  "password": "OptionalSecretPassword",
  "expires_at": "2026-12-01T00:00:00.000Z"
}
```
- **Response `201 Created`:** Returns unique `share` object with token (`sh_...`).

### `GET /api/shares`
List all active share links created by the current user.
- **Access:** Private

### `DELETE /api/shares/:id`
Revoke a share link.
- **Access:** Private

### `GET /api/shares/access/:token`
Recipient access endpoint.
- **Access:** Public (Anonymous)
- **Challenge Response `401 Unauthorized` (if password required):**
```json
{
  "success": false,
  "is_password_required": true,
  "resource_name": "project_report.pdf",
  "resource_type": "file"
}
```
- **Access Response `200 OK` (when open or unlocked):**
```json
{
  "success": true,
  "file": { ... },
  "preview_url": "https://...r2...",
  "permission": "download"
}
```

### `POST /api/shares/access/:token`
Unlock password-protected share link.
- **Access:** Public
- **Request Body:** `{ "password": "OptionalSecretPassword" }`

### `GET /api/shares/access/:token/download`
Generate download binary URL for shared file.
- **Access:** Public
- **Error Response `403 Forbidden` (if `permission === "view"`):**
```json
{
  "success": false,
  "error": "Downloads are disabled for this shared link (Read-Only access)"
}
```

---

## 7. File Version History

### `GET /api/files/:id/versions`
List all historical versions of a file.
- **Access:** Private

### `POST /api/files/:id/versions/request-upload-url`
Request presigned upload URL for a new revision.
- **Access:** Private

### `POST /api/files/:id/versions/confirm`
Confirm new version upload, archiving the current file into `FileVersion` and updating current `File`.
- **Access:** Private

### `POST /api/files/:id/versions/:versionId/restore`
Restore an older version to become the current active file.
- **Access:** Private

### `DELETE /api/files/:id/versions/:versionId`
Delete a past version to reclaim storage.
- **Access:** Private

---

## 8. Activity Logs & Trash

### `GET /api/activity`
Get paginated audit activity log.
- **Access:** Private
- **Query Parameters:** `page`, `limit`, `action`, `resource_type`.

### `GET /api/trash`
List all soft-deleted files and folders.
- **Access:** Private

### `POST /api/trash/empty`
Permanently purge all trashed items and recalculate user quota.
- **Access:** Private
