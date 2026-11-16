import http from "http";
import crypto from "crypto";
import app from "./server.js";
import { env } from "./config/env.js";
import User from "./models/User.js";
import Folder from "./models/Folder.js";
import File from "./models/File.js";
import Share from "./models/Share.js";
import FileVersion from "./models/FileVersion.js";
import ActivityLog from "./models/ActivityLog.js";

/**
 * Universal HTTP request helper supporting JSON and cookies
 */
const makeRequest = (path, method = "GET", data = null, headers = {}) => {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : null;
    const requestHeaders = { ...headers };

    if (postData) {
      requestHeaders["Content-Type"] = "application/json";
      requestHeaders["Content-Length"] = Buffer.byteLength(postData);
    }

    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: env.PORT,
        path,
        method,
        headers: requestHeaders,
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          let parsed;
          try {
            parsed = JSON.parse(body);
          } catch {
            parsed = body;
          }
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: parsed,
          });
        });
      }
    );

    req.on("error", reject);
    if (postData) req.write(postData);
    req.end();
  });
};

const results = {
  passed: [],
  failed: [],
  untested: [],
};

const recordPass = (category, name, details = "") => {
  console.log(`  [PASS] ${name}${details ? ` (${details})` : ""}`);
  results.passed.push({ category, name, details });
};

const recordFail = (category, name, error) => {
  console.error(`  [FAIL] ${name}:`, error);
  results.failed.push({ category, name, error: error?.message || String(error) });
};

const runComprehensiveQA = async () => {
  console.log("\n=======================================================");
  console.log("CLOUVAULT COMPREHENSIVE QA, TESTING & DEBUGGING PASS");
  console.log("=======================================================\n");

  await new Promise((r) => setTimeout(r, 1500));

  const testTimestamp = Date.now();
  const userAEmail = `qa_user_a_${testTimestamp}@example.com`;
  const userBEmail = `qa_user_b_${testTimestamp}@example.com`;
  const userPassword = "Password123!";

  let tokenA = "";
  let cookieA = "";
  let userIdA = "";
  let authHeadersA = {};

  let tokenB = "";
  let userIdB = "";
  let authHeadersB = {};

  // =========================================================================
  // 1. TEST AUTHENTICATION
  // =========================================================================
  console.log("--- 1. TESTING AUTHENTICATION ---");

  // 1.1 Registration
  try {
    const regRes = await makeRequest("/api/auth/register", "POST", {
      name: "QA User Primary",
      email: userAEmail,
      password: userPassword,
    });
    if (regRes.statusCode !== 201 || !regRes.body.token) {
      throw new Error(`Expected 201 with token, got ${regRes.statusCode}`);
    }
    tokenA = regRes.body.token;
    userIdA = regRes.body.user.id;
    authHeadersA = { Authorization: `Bearer ${tokenA}` };

    const rawCookies = regRes.headers["set-cookie"] || [];
    const tokenCookie = rawCookies.find((c) => c.startsWith("token="));
    if (tokenCookie) {
      cookieA = tokenCookie.split(";")[0];
    }
    recordPass("Authentication", "Registration - Valid details", `User ID: ${userIdA}`);
  } catch (err) {
    recordFail("Authentication", "Registration - Valid details", err);
  }

  // 1.2 Duplicate Registration Blocked
  try {
    const dupRes = await makeRequest("/api/auth/register", "POST", {
      name: "QA Duplicate",
      email: userAEmail,
      password: userPassword,
    });
    if (dupRes.statusCode !== 409) {
      throw new Error(`Expected 409 Conflict for duplicate email, got ${dupRes.statusCode}`);
    }
    recordPass("Authentication", "Registration - Duplicate email blocked", "Status 409 Conflict");
  } catch (err) {
    recordFail("Authentication", "Registration - Duplicate email blocked", err);
  }

  // 1.3 Invalid Email Format Blocked
  try {
    const invEmailRes = await makeRequest("/api/auth/register", "POST", {
      name: "Invalid Email",
      email: "not-an-email",
      password: userPassword,
    });
    if (invEmailRes.statusCode !== 400) {
      throw new Error(`Expected 400 for invalid email, got ${invEmailRes.statusCode}`);
    }
    recordPass("Authentication", "Registration - Invalid email blocked", "Status 400");
  } catch (err) {
    recordFail("Authentication", "Registration - Invalid email blocked", err);
  }

  // 1.4 Weak Password Blocked
  try {
    const weakPassRes = await makeRequest("/api/auth/register", "POST", {
      name: "Weak Pass",
      email: `weak_${testTimestamp}@example.com`,
      password: "123",
    });
    if (weakPassRes.statusCode !== 400) {
      throw new Error(`Expected 400 for weak password, got ${weakPassRes.statusCode}`);
    }
    recordPass("Authentication", "Registration - Weak password blocked", "Status 400");
  } catch (err) {
    recordFail("Authentication", "Registration - Weak password blocked", err);
  }

  // 1.5 Valid Login
  try {
    const loginRes = await makeRequest("/api/auth/login", "POST", {
      email: userAEmail,
      password: userPassword,
    });
    if (loginRes.statusCode !== 200 || !loginRes.body.token) {
      throw new Error(`Expected 200 with token, got ${loginRes.statusCode}`);
    }
    recordPass("Authentication", "Login - Valid credentials", "Status 200 + JWT issued");
  } catch (err) {
    recordFail("Authentication", "Login - Valid credentials", err);
  }

  // 1.6 Invalid Password
  try {
    const badPassRes = await makeRequest("/api/auth/login", "POST", {
      email: userAEmail,
      password: "WrongPassword999!",
    });
    if (badPassRes.statusCode !== 401) {
      throw new Error(`Expected 401 for incorrect password, got ${badPassRes.statusCode}`);
    }
    recordPass("Authentication", "Invalid credentials - Wrong password", "Status 401 Unauthorized");
  } catch (err) {
    recordFail("Authentication", "Invalid credentials - Wrong password", err);
  }

  // 1.7 Non-Existent User Login
  try {
    const nonUserRes = await makeRequest("/api/auth/login", "POST", {
      email: `non_existent_${testTimestamp}@example.com`,
      password: userPassword,
    });
    if (nonUserRes.statusCode !== 401) {
      throw new Error(`Expected 401 for non-existent user, got ${nonUserRes.statusCode}`);
    }
    recordPass("Authentication", "Invalid credentials - Non-existent email", "Status 401 Unauthorized");
  } catch (err) {
    recordFail("Authentication", "Invalid credentials - Non-existent email", err);
  }

  // 1.8 Session Persistence (via Cookie)
  try {
    if (!cookieA) throw new Error("No HTTP-only cookie was received on registration/login");
    const sessionCookieRes = await makeRequest("/api/auth/me", "GET", null, {
      Cookie: cookieA,
    });
    if (sessionCookieRes.statusCode !== 200 || sessionCookieRes.body.user.email !== userAEmail) {
      throw new Error(`Expected 200 with user profile via cookie, got ${sessionCookieRes.statusCode}`);
    }
    recordPass("Authentication", "Session persistence - Cookie authentication", "Session preserved across requests");
  } catch (err) {
    recordFail("Authentication", "Session persistence - Cookie authentication", err);
  }

  // 1.9 Session Persistence (via Bearer Token)
  try {
    const sessionTokenRes = await makeRequest("/api/auth/me", "GET", null, authHeadersA);
    if (sessionTokenRes.statusCode !== 200 || sessionTokenRes.body.user.id !== userIdA) {
      throw new Error(`Expected 200 via Bearer token, got ${sessionTokenRes.statusCode}`);
    }
    recordPass("Authentication", "Session persistence - Bearer token authentication", "User profile retrieved");
  } catch (err) {
    recordFail("Authentication", "Session persistence - Bearer token authentication", err);
  }

  // 1.10 Logout
  try {
    const logoutRes = await makeRequest("/api/auth/logout", "POST", null, authHeadersA);
    const logoutCookies = logoutRes.headers["set-cookie"] || [];
    const isCleared = logoutCookies.some((c) => c.includes("token=;") || c.includes("Expires="));
    if (logoutRes.statusCode !== 200 || !isCleared) {
      throw new Error(`Logout failed to return 200 or clear cookie`);
    }
    recordPass("Authentication", "Logout", "Status 200 + Session cookie cleared");
  } catch (err) {
    recordFail("Authentication", "Logout", err);
  }

  // 1.11 Unauthorized API Access
  try {
    const unauthRes = await makeRequest("/api/auth/me", "GET");
    if (unauthRes.statusCode !== 401) {
      throw new Error(`Expected 401 without authentication, got ${unauthRes.statusCode}`);
    }
    recordPass("Authentication", "Unauthorized API access blocked", "Status 401 Unauthorized");
  } catch (err) {
    recordFail("Authentication", "Unauthorized API access blocked", err);
  }

  // Register secondary User B for cross-user tests
  const regB = await makeRequest("/api/auth/register", "POST", {
    name: "QA User Secondary",
    email: userBEmail,
    password: userPassword,
  });
  tokenB = regB.body.token;
  userIdB = regB.body.user.id;
  authHeadersB = { Authorization: `Bearer ${tokenB}` };

  // =========================================================================
  // 2. TEST FILE MANAGEMENT
  // =========================================================================
  console.log("\n--- 2. TESTING FILE MANAGEMENT ---");

  let smallFile = null;
  let largeFile = null;

  // 2.1 Upload Small File (5 KB)
  try {
    const smallContent = Buffer.alloc(1024 * 5, "S");
    const smallHash = crypto.createHash("sha256").update(smallContent).digest("hex");

    const reqUrlRes = await makeRequest("/api/files/request-upload-url", "POST", {
      name: "small_document.pdf",
      size: smallContent.length,
      mime_type: "application/pdf",
      checksum_sha256: smallHash,
    }, authHeadersA);

    if (reqUrlRes.statusCode !== 200 || !reqUrlRes.body.data?.uploadUrl) {
      throw new Error(`Failed to get presigned upload URL: ${reqUrlRes.body.error || reqUrlRes.statusCode}`);
    }

    const { uploadUrl, storage_key } = reqUrlRes.body.data;
    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/pdf" },
      body: smallContent,
    });
    if (!putRes.ok) throw new Error(`Direct R2 PUT failed with status ${putRes.status}`);

    const confirmRes = await makeRequest("/api/files/confirm-upload", "POST", {
      storage_key,
      name: "small_document.pdf",
      size: smallContent.length,
      mime_type: "application/pdf",
      checksum_sha256: smallHash,
    }, authHeadersA);

    if (confirmRes.statusCode !== 201 || !confirmRes.body.file) {
      throw new Error(`Confirm upload failed: ${confirmRes.body.error || confirmRes.statusCode}`);
    }
    smallFile = confirmRes.body.file;
    recordPass("File Management", "Upload small files", `${smallFile.name} (${smallFile.size} bytes)`);
  } catch (err) {
    recordFail("File Management", "Upload small files", err);
  }

  // 2.2 Upload Large Permitted File (2 MB within 50MB Limit)
  try {
    const largeSize = 1024 * 1024 * 2; // 2 MB
    const largeBuffer = Buffer.alloc(largeSize, "L");
    const largeHash = crypto.createHash("sha256").update(largeBuffer).digest("hex");

    const reqLargeRes = await makeRequest("/api/files/request-upload-url", "POST", {
      name: "large_presentation.mp4",
      size: largeSize,
      mime_type: "video/mp4",
      checksum_sha256: largeHash,
    }, authHeadersA);

    if (reqLargeRes.statusCode !== 200) throw new Error(`Failed to get URL for large file`);
    const { uploadUrl, storage_key } = reqLargeRes.body.data;

    await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "video/mp4" },
      body: largeBuffer,
    });

    const confirmLarge = await makeRequest("/api/files/confirm-upload", "POST", {
      storage_key,
      name: "large_presentation.mp4",
      size: largeSize,
      mime_type: "video/mp4",
      checksum_sha256: largeHash,
    }, authHeadersA);

    if (confirmLarge.statusCode !== 201) throw new Error(`Failed to confirm large file`);
    largeFile = confirmLarge.body.file;
    recordPass("File Management", "Upload large permitted files", `${largeFile.name} (${largeFile.size} bytes)`);
  } catch (err) {
    recordFail("File Management", "Upload large permitted files", err);
  }

  // 2.3 Multiple Uploads
  try {
    const multiFiles = ["batch_1.txt", "batch_2.txt", "batch_3.txt"];
    const uploadedMulti = [];

    for (const name of multiFiles) {
      const buf = Buffer.from(`Content for ${name}`);
      const reqRes = await makeRequest("/api/files/request-upload-url", "POST", {
        name,
        size: buf.length,
        mime_type: "text/plain",
      }, authHeadersA);
      await fetch(reqRes.body.data.uploadUrl, { method: "PUT", headers: { "Content-Type": "text/plain" }, body: buf });
      const confRes = await makeRequest("/api/files/confirm-upload", "POST", {
        storage_key: reqRes.body.data.storage_key,
        name,
        size: buf.length,
        mime_type: "text/plain",
      }, authHeadersA);
      uploadedMulti.push(confRes.body.file);
    }

    if (uploadedMulti.length !== 3) throw new Error("Expected 3 batch uploads");
    recordPass("File Management", "Multiple uploads", "3/3 batch files uploaded successfully");
  } catch (err) {
    recordFail("File Management", "Multiple uploads", err);
  }

  // 2.4 Download File
  try {
    const dlRes = await makeRequest(`/api/files/${largeFile.id}/preview?download=true`, "GET", null, authHeadersA);
    if (dlRes.statusCode !== 200 || !dlRes.body.preview_url) {
      throw new Error(`Download URL request failed: ${dlRes.statusCode}`);
    }
    const fetchDownload = await fetch(dlRes.body.preview_url);
    if (!fetchDownload.ok) throw new Error(`Download fetch failed with status ${fetchDownload.status}`);
    recordPass("File Management", "Download", "Presigned download URL generated and verified");
  } catch (err) {
    recordFail("File Management", "Download", err);
  }

  // 2.5 Rename File
  try {
    const renameRes = await makeRequest(`/api/files/${largeFile.id}/rename`, "PATCH", {
      name: "large_presentation_renamed.mp4",
    }, authHeadersA);
    if (renameRes.statusCode !== 200 || renameRes.body.file.name !== "large_presentation_renamed.mp4") {
      throw new Error(`Rename failed: ${renameRes.body.error || renameRes.statusCode}`);
    }
    recordPass("File Management", "Rename", "Renamed to 'large_presentation_renamed.mp4'");
  } catch (err) {
    recordFail("File Management", "Rename", err);
  }

  // 2.6 Preview File
  try {
    const prevRes = await makeRequest(`/api/files/${largeFile.id}/preview`, "GET", null, authHeadersA);
    if (prevRes.statusCode !== 200 || !prevRes.body.preview_url) {
      throw new Error(`Preview URL request failed: ${prevRes.statusCode}`);
    }
    recordPass("File Management", "Preview", "Preview URL generated");
  } catch (err) {
    recordFail("File Management", "Preview", err);
  }

  // 2.7 Delete File (Soft Delete to Trash)
  try {
    const delRes = await makeRequest(`/api/files/${smallFile.id}`, "DELETE", null, authHeadersA);
    if (delRes.statusCode !== 200) throw new Error(`Delete file failed: ${delRes.statusCode}`);

    const checkFile = await File.findById(smallFile.id);
    if (!checkFile.is_trashed) throw new Error("File was not marked as trashed");
    recordPass("File Management", "Delete", "File successfully moved to trash (soft-delete)");
  } catch (err) {
    recordFail("File Management", "Delete", err);
  }

  // 2.8 Duplicate Detection & Zero-Storage Deduplication
  try {
    const dupCheckRes = await makeRequest("/api/files/request-upload-url", "POST", {
      name: "large_presentation_duplicate.mp4",
      size: largeFile.size,
      mime_type: "video/mp4",
      checksum_sha256: largeFile.checksum_sha256,
    }, authHeadersA);

    if (!dupCheckRes.body.is_duplicate || !dupCheckRes.body.duplicate_file) {
      throw new Error("Duplicate detection failed to flag identical checksum");
    }

    // Now link via deduplicate: true
    const dedupLinkRes = await makeRequest("/api/files/request-upload-url", "POST", {
      name: "large_presentation_duplicate.mp4",
      size: largeFile.size,
      mime_type: "video/mp4",
      checksum_sha256: largeFile.checksum_sha256,
      deduplicate: true,
    }, authHeadersA);

    if (!dedupLinkRes.body.deduplicated || !dedupLinkRes.body.file) {
      throw new Error("Deduplication link failed");
    }
    recordPass("File Management", "Duplicate detection", "Flagged duplicate & deduplicated with 0 quota");
  } catch (err) {
    recordFail("File Management", "Duplicate detection", err);
  }

  // =========================================================================
  // 3. TEST FOLDERS
  // =========================================================================
  console.log("\n--- 3. TESTING FOLDERS ---");

  let rootFolder = null;
  let childFolder = null;
  let deepFolder = null;

  // 3.1 Create Folder
  try {
    const fRes = await makeRequest("/api/folders", "POST", { name: "Projects Vault" }, authHeadersA);
    if (fRes.statusCode !== 201 || !fRes.body.folder) {
      throw new Error(`Failed to create root folder: ${fRes.body.error || fRes.statusCode}`);
    }
    rootFolder = fRes.body.folder;
    recordPass("Folders", "Create folders", `Created '${rootFolder.name}'`);
  } catch (err) {
    recordFail("Folders", "Create folders", err);
  }

  // 3.2 Nested Folders (Subfolder)
  try {
    const subRes = await makeRequest("/api/folders", "POST", {
      name: "2026 Q1",
      parent_id: rootFolder.id,
    }, authHeadersA);
    if (subRes.statusCode !== 201 || subRes.body.folder.parent_id !== rootFolder.id) {
      throw new Error(`Failed to create subfolder: ${subRes.statusCode}`);
    }
    childFolder = subRes.body.folder;

    // Deep nested folder (Level 2)
    const deepRes = await makeRequest("/api/folders", "POST", {
      name: "Deliverables",
      parent_id: childFolder.id,
    }, authHeadersA);
    deepFolder = deepRes.body.folder;

    if (!deepFolder.path.includes(rootFolder.id) || !deepFolder.path.includes(childFolder.id)) {
      throw new Error("Deep nested folder path array missing ancestor folder IDs");
    }
    recordPass("Folders", "Nested folders", "Created multi-level hierarchy with validated ancestor paths");
  } catch (err) {
    recordFail("Folders", "Nested folders", err);
  }

  // 3.3 Move Files Between Folders
  try {
    const moveRes = await makeRequest(`/api/files/${largeFile.id}/move`, "PATCH", {
      target_folder_id: childFolder.id,
    }, authHeadersA);
    if (moveRes.statusCode !== 200 || moveRes.body.file.folder_id !== childFolder.id) {
      throw new Error(`Failed to move file to folder: ${moveRes.statusCode}`);
    }

    // Move again to deep folder
    const moveDeepRes = await makeRequest(`/api/files/${largeFile.id}/move`, "PATCH", {
      target_folder_id: deepFolder.id,
    }, authHeadersA);
    if (moveDeepRes.body.file.folder_id !== deepFolder.id) {
      throw new Error("Failed to move file to deep folder");
    }
    recordPass("Folders", "Move files", "Moved file across nested hierarchy successfully");
  } catch (err) {
    recordFail("Folders", "Move files", err);
  }

  // 3.4 Rename Folders
  try {
    const renFoldRes = await makeRequest(`/api/folders/${deepFolder.id}/rename`, "PATCH", {
      name: "Final Deliverables 2026",
    }, authHeadersA);
    if (renFoldRes.statusCode !== 200 || renFoldRes.body.folder.name !== "Final Deliverables 2026") {
      throw new Error(`Rename folder failed: ${renFoldRes.statusCode}`);
    }
    recordPass("Folders", "Rename folders", "Renamed folder to 'Final Deliverables 2026'");
  } catch (err) {
    recordFail("Folders", "Rename folders", err);
  }

  // 3.5 Delete Folders (Cascading Trash & Permanent Delete)
  try {
    const trashFoldRes = await makeRequest(`/api/folders/${rootFolder.id}`, "DELETE", null, authHeadersA);
    if (trashFoldRes.statusCode !== 200) throw new Error(`Trash folder failed: ${trashFoldRes.statusCode}`);

    // Verify all child folders and files were moved to trash
    const trashedChild = await Folder.findById(childFolder.id);
    const trashedDeep = await Folder.findById(deepFolder.id);
    const trashedFile = await File.findById(largeFile.id);

    if (!trashedChild.is_trashed || !trashedDeep.is_trashed || !trashedFile.is_trashed) {
      throw new Error("Folder trashing failed to cascade to nested subfolders or files");
    }

    // Restore root folder
    await makeRequest(`/api/folders/${rootFolder.id}/restore`, "POST", null, authHeadersA);
    const restoredFile = await File.findById(largeFile.id);
    if (restoredFile.is_trashed) throw new Error("Folder restore failed to cascade");

    recordPass("Folders", "Delete folders", "Cascading soft-delete and restoration verified");
  } catch (err) {
    recordFail("Folders", "Delete folders", err);
  }

  // =========================================================================
  // 4. TEST STORAGE
  // =========================================================================
  console.log("\n--- 4. TESTING STORAGE ---");

  // 4.1 Storage Calculations
  try {
    const userMe = (await makeRequest("/api/auth/me", "GET", null, authHeadersA)).body.user;
    // Storage used tracks all allocated physical storage files for this user (both active and trashed)
    const allFiles = await File.find({ owner_id: userIdA });
    const seenKeys = new Set();
    let expectedBytes = 0;
    for (const f of allFiles) {
      if (!seenKeys.has(f.storage_key)) {
        seenKeys.add(f.storage_key);
        expectedBytes += f.size || 0;
      }
    }

    if (userMe.storage_used !== expectedBytes) {
      throw new Error(`Storage calculation mismatch: User storage_used=${userMe.storage_used}, calculated=${expectedBytes}`);
    }
    recordPass("Storage", "Storage calculations", `Accurate byte tracking: ${userMe.storage_used} bytes used`);
  } catch (err) {
    recordFail("Storage", "Storage calculations", err);
  }

  // 4.2 Storage Quota Enforcement
  try {
    // Set user's storage_used close to storage_limit so a 200 KB upload exceeds quota
    const currentUser = await User.findById(userIdA);
    const originalUsed = currentUser.storage_used;
    currentUser.storage_used = currentUser.storage_limit - 100 * 1024; // Only 100 KB left
    await currentUser.save();

    const quotaRes = await makeRequest("/api/files/request-upload-url", "POST", {
      name: "quota_buster.pdf",
      size: 200 * 1024, // 200 KB > 100 KB remaining quota, well under 50 MB max file size
      mime_type: "application/pdf",
    }, authHeadersA);

    // Restore original storage_used
    currentUser.storage_used = originalUsed;
    await currentUser.save();

    if (quotaRes.statusCode !== 400 || !quotaRes.body.error?.toLowerCase().includes("quota")) {
      throw new Error(`Expected 400 Storage quota exceeded, got ${quotaRes.statusCode}: ${quotaRes.body.error}`);
    }
    recordPass("Storage", "Storage quota enforcement", "Exceeding storage quota blocked with 400");
  } catch (err) {
    recordFail("Storage", "Storage quota enforcement", err);
  }

  // 4.3 Failed Uploads (Unconfirmed URL allocation)
  try {
    const beforeUser = (await makeRequest("/api/auth/me", "GET", null, authHeadersA)).body.user;
    // Request URL but never upload or confirm
    await makeRequest("/api/files/request-upload-url", "POST", {
      name: "abandoned_upload.pdf",
      size: 1024 * 50,
      mime_type: "application/pdf",
    }, authHeadersA);

    const afterUser = (await makeRequest("/api/auth/me", "GET", null, authHeadersA)).body.user;
    if (afterUser.storage_used !== beforeUser.storage_used) {
      throw new Error("Unconfirmed upload request allocated storage prematurely");
    }
    recordPass("Storage", "Failed uploads", "Abandoned upload request left no orphan quota allocation");
  } catch (err) {
    recordFail("Storage", "Failed uploads", err);
  }

  // 4.4 R2 Cleanup on Permanent Delete
  try {
    // Create standalone file to delete permanently
    const tempBuf = Buffer.from("Temporary cleanup test");
    const reqTemp = await makeRequest("/api/files/request-upload-url", "POST", {
      name: "temp_cleanup.txt",
      size: tempBuf.length,
      mime_type: "text/plain",
    }, authHeadersA);

    await fetch(reqTemp.body.data.uploadUrl, { method: "PUT", headers: { "Content-Type": "text/plain" }, body: tempBuf });
    const confTemp = await makeRequest("/api/files/confirm-upload", "POST", {
      storage_key: reqTemp.body.data.storage_key,
      name: "temp_cleanup.txt",
      size: tempBuf.length,
      mime_type: "text/plain",
    }, authHeadersA);

    const tempFileId = confTemp.body.file.id;

    const permDelRes = await makeRequest(`/api/files/${tempFileId}/permanent`, "DELETE", null, authHeadersA);
    if (permDelRes.statusCode !== 200) {
      throw new Error(`Permanent delete failed: ${permDelRes.statusCode}`);
    }

    const checkFile = await File.findById(tempFileId);
    if (checkFile) throw new Error("File still exists in MongoDB after permanent delete");
    recordPass("Storage", "R2 cleanup", "Permanently removed file from database and cloud storage");
  } catch (err) {
    recordFail("Storage", "R2 cleanup", err);
  }

  // =========================================================================
  // 5. TEST SHARING
  // =========================================================================
  console.log("\n--- 5. TESTING SHARING ---");

  let publicShareToken = "";
  let protectedShareToken = "";
  let expiredShareToken = "";
  let revokedShareToken = "";

  // 5.1 Public Links
  try {
    const pubRes = await makeRequest("/api/shares", "POST", {
      resource_id: largeFile.id,
      resource_type: "file",
      permission: "download",
    }, authHeadersA);
    if (pubRes.statusCode !== 201 && pubRes.statusCode !== 200) {
      throw new Error(`Failed to create public share: ${pubRes.statusCode}`);
    }
    publicShareToken = pubRes.body.share.token;

    const accessPub = await makeRequest(`/api/shares/access/${publicShareToken}`, "GET");
    if (accessPub.statusCode !== 200 || !accessPub.body.preview_url) {
      throw new Error(`Public share access failed: ${accessPub.statusCode}`);
    }
    recordPass("Sharing", "Public links", "Anonymous access granted with valid URLs");
  } catch (err) {
    recordFail("Sharing", "Public links", err);
  }

  // 5.2 Password-Protected Links
  try {
    const sharePass = "SecretVault2026!";
    const protRes = await makeRequest("/api/shares", "POST", {
      resource_id: largeFile.id,
      resource_type: "file",
      permission: "download",
      password: sharePass,
    }, authHeadersA);
    protectedShareToken = protRes.body.share.token;

    // Access without password
    const noPassRes = await makeRequest(`/api/shares/access/${protectedShareToken}`, "GET");
    if (noPassRes.statusCode !== 401 || !noPassRes.body.is_password_required) {
      throw new Error("Password-protected link did not challenge for password");
    }

    // Access with wrong password
    const badPassRes = await makeRequest(`/api/shares/access/${protectedShareToken}`, "POST", {
      password: "WrongPassword!",
    });
    if (badPassRes.statusCode !== 401) {
      throw new Error(`Expected 401 for wrong share password, got ${badPassRes.statusCode}`);
    }

    // Access with correct password
    const goodPassRes = await makeRequest(`/api/shares/access/${protectedShareToken}`, "POST", {
      password: sharePass,
    });
    if (goodPassRes.statusCode !== 200 || !goodPassRes.body.preview_url) {
      throw new Error("Access with correct password failed");
    }
    recordPass("Sharing", "Password-protected links", "Required password, rejected wrong, accepted correct");
  } catch (err) {
    recordFail("Sharing", "Password-protected links", err);
  }

  // 5.3 Expired Links
  try {
    // Create link with valid future expiration
    const expRes = await makeRequest("/api/shares", "POST", {
      resource_id: largeFile.id,
      resource_type: "file",
      permission: "download",
      expires_at: new Date(Date.now() + 60000).toISOString(),
    }, authHeadersA);
    expiredShareToken = expRes.body.share.token;

    // Expire it directly in MongoDB to simulate passing time
    await Share.updateOne({ token: expiredShareToken }, { expires_at: new Date(Date.now() - 3600000) });

    const accessExp = await makeRequest(`/api/shares/access/${expiredShareToken}`, "GET");
    if (accessExp.statusCode !== 410) {
      throw new Error(`Expected 410 Gone for expired link, got ${accessExp.statusCode}`);
    }
    recordPass("Sharing", "Expired links", "Expired link blocked with status 410 Gone");
  } catch (err) {
    recordFail("Sharing", "Expired links", err);
  }

  // 5.4 Revoked Links
  try {
    const revRes = await makeRequest("/api/shares", "POST", {
      resource_id: largeFile.id,
      resource_type: "file",
      permission: "download",
    }, authHeadersA);
    revokedShareToken = revRes.body.share.token;
    const shareId = revRes.body.share.id || revRes.body.share._id;

    // Revoke share
    const revokeAction = await makeRequest(`/api/shares/${shareId}`, "DELETE", null, authHeadersA);
    if (revokeAction.statusCode !== 200) throw new Error("Failed to revoke share link");

    const accessRev = await makeRequest(`/api/shares/access/${revokedShareToken}`, "GET");
    if (accessRev.statusCode !== 404 && accessRev.statusCode !== 410) {
      throw new Error(`Expected 404/410 for revoked link, got ${accessRev.statusCode}`);
    }
    recordPass("Sharing", "Revoked links", "Revoked link blocked with status 404 Not Found");
  } catch (err) {
    recordFail("Sharing", "Revoked links", err);
  }

  // 5.5 Access Permissions (View-only, Download Disabled)
  try {
    const noDlRes = await makeRequest("/api/shares", "POST", {
      resource_id: largeFile.id,
      resource_type: "file",
      permission: "view",
    }, authHeadersA);
    const noDlToken = noDlRes.body.share.token;

    const accessNoDl = await makeRequest(`/api/shares/access/${noDlToken}`, "GET");
    if (accessNoDl.statusCode !== 200 || accessNoDl.body.permission !== "view") {
      throw new Error("Failed to access view-only share link");
    }

    const tryDownload = await makeRequest(`/api/shares/access/${noDlToken}/download`, "GET");
    if (tryDownload.statusCode !== 403) {
      throw new Error(`Expected 403 Forbidden for download when permission='view', got ${tryDownload.statusCode}`);
    }
    recordPass("Sharing", "Access permissions", "permission='view' strictly blocks download (403 Forbidden)");
  } catch (err) {
    recordFail("Sharing", "Access permissions", err);
  }

  // =========================================================================
  // 6. TEST SECURITY
  // =========================================================================
  console.log("\n--- 6. TESTING SECURITY ---");

  // 6.1 Cross-User File Access Blocked
  try {
    // User B tries to preview User A's file
    const crossPrev = await makeRequest(`/api/files/${largeFile.id}/preview`, "GET", null, authHeadersB);
    if (crossPrev.statusCode !== 404) {
      throw new Error(`Expected 404 for cross-user file preview, got ${crossPrev.statusCode}`);
    }

    // User B tries to rename User A's file
    const crossRename = await makeRequest(`/api/files/${largeFile.id}/rename`, "PATCH", {
      name: "hacked.mp4",
    }, authHeadersB);
    if (crossRename.statusCode !== 404) {
      throw new Error(`Expected 404 for cross-user rename, got ${crossRename.statusCode}`);
    }

    // User B tries to delete User A's file
    const crossDelete = await makeRequest(`/api/files/${largeFile.id}/delete`, "DELETE", null, authHeadersB);
    if (crossDelete.statusCode !== 404) {
      throw new Error(`Expected 404 for cross-user delete, got ${crossDelete.statusCode}`);
    }
    recordPass("Security", "Cross-user file access", "Blocked with 404 (zero information leakage)");
  } catch (err) {
    recordFail("Security", "Cross-user file access", err);
  }

  // 6.2 Cross-User Folder Access Blocked
  try {
    const crossFolder = await makeRequest(`/api/folders/${childFolder.id}`, "GET", null, authHeadersB);
    if (crossFolder.statusCode !== 404) {
      throw new Error(`Expected 404 for cross-user folder access, got ${crossFolder.statusCode}`);
    }

    const crossFolderDel = await makeRequest(`/api/folders/${childFolder.id}`, "DELETE", null, authHeadersB);
    if (crossFolderDel.statusCode !== 404) {
      throw new Error(`Expected 404 for cross-user folder delete, got ${crossFolderDel.statusCode}`);
    }
    recordPass("Security", "Cross-user folder access", "Cross-user folder reads & modifications blocked (404)");
  } catch (err) {
    recordFail("Security", "Cross-user folder access", err);
  }

  // 6.3 Invalid Tokens Blocked
  try {
    const fakeToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature";
    const invTokRes = await makeRequest("/api/auth/me", "GET", null, {
      Authorization: `Bearer ${fakeToken}`,
    });
    if (invTokRes.statusCode !== 401) {
      throw new Error(`Expected 401 for malformed JWT, got ${invTokRes.statusCode}`);
    }
    recordPass("Security", "Invalid tokens", "Malformed/tampered JWT rejected with 401 Unauthorized");
  } catch (err) {
    recordFail("Security", "Invalid tokens", err);
  }

  // 6.4 Unauthorized Requests Blocked
  try {
    const paths = ["/api/files", "/api/folders", "/api/dashboard/stats", "/api/activity", "/api/trash"];
    let allBlocked = true;
    for (const p of paths) {
      const res = await makeRequest(p, "GET");
      if (res.statusCode !== 401) {
        allBlocked = false;
        break;
      }
    }
    if (!allBlocked) throw new Error("Some private endpoints did not reject unauthenticated requests");
    recordPass("Security", "Unauthorized requests", "All private endpoints strictly reject unauthenticated calls (401)");
  } catch (err) {
    recordFail("Security", "Unauthorized requests", err);
  }

  // 6.5 Invalid File Types (Malformed MIME Format)
  try {
    const badMimeRes = await makeRequest("/api/files/request-upload-url", "POST", {
      name: "bad_type_file.xyz",
      size: 1024,
      mime_type: "invalid_mime_format_without_slash",
    }, authHeadersA);

    if (badMimeRes.statusCode !== 400 || !JSON.stringify(badMimeRes.body).includes("MIME")) {
      throw new Error(`Expected 400 Validation Error for invalid MIME format, got ${badMimeRes.statusCode}`);
    }
    recordPass("Security", "Invalid file types", "Invalid MIME format rejected with 400 Validation Error");
  } catch (err) {
    recordFail("Security", "Invalid file types", err);
  }

  // 6.6 Oversized Uploads Blocked (> 50 MB)
  try {
    const oversizedBytes = 1024 * 1024 * 55; // 55 MB > 50 MB limit
    const overRes = await makeRequest("/api/files/request-upload-url", "POST", {
      name: "huge_archive.zip",
      size: oversizedBytes,
      mime_type: "application/zip",
    }, authHeadersA);

    if (overRes.statusCode !== 400 || !JSON.stringify(overRes.body).includes("exceeds the maximum limit")) {
      throw new Error(`Expected 400 for oversized upload, got ${overRes.statusCode}`);
    }
    recordPass("Security", "Oversized uploads", "Uploads exceeding 50 MB rejected with 400 Validation Error");
  } catch (err) {
    recordFail("Security", "Oversized uploads", err);
  }

  // 6.7 Malformed Requests Blocked
  try {
    // Missing required fields
    const missingRes = await makeRequest("/api/files/request-upload-url", "POST", {}, authHeadersA);
    // Negative size
    const negRes = await makeRequest("/api/files/request-upload-url", "POST", {
      name: "neg.txt",
      size: -50,
      mime_type: "text/plain",
    }, authHeadersA);
    // Invalid MongoDB ID
    const invIdRes = await makeRequest("/api/files/invalid-mongo-id-here", "GET", null, authHeadersA);

    if (missingRes.statusCode !== 400 || negRes.statusCode !== 400 || (invIdRes.statusCode !== 400 && invIdRes.statusCode !== 404)) {
      throw new Error("Malformed requests did not trigger appropriate client error codes");
    }
    recordPass("Security", "Malformed requests", "Missing fields, negative sizes, and malformed IDs properly rejected");
  } catch (err) {
    recordFail("Security", "Malformed requests", err);
  }

  // Clean up QA Users
  await User.deleteMany({ _id: { $in: [userIdA, userIdB] } });
  await File.deleteMany({ owner_id: { $in: [userIdA, userIdB] } });
  await Folder.deleteMany({ owner_id: { $in: [userIdA, userIdB] } });
  await Share.deleteMany({ owner_id: { $in: [userIdA, userIdB] } });
  await ActivityLog.deleteMany({ user_id: { $in: [userIdA, userIdB] } });

  console.log("\n=======================================================");
  console.log(`QA RUN COMPLETE: ${results.passed.length} PASSED, ${results.failed.length} FAILED, ${results.untested.length} UNTESTED`);
  console.log("=======================================================\n");

  if (results.failed.length > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
};

runComprehensiveQA();
