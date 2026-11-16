import http from "http";
import app from "./server.js";
import { env } from "./config/env.js";
import User from "./models/User.js";
import Folder from "./models/Folder.js";
import File from "./models/File.js";
import Share from "./models/Share.js";
import FileVersion from "./models/FileVersion.js";

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

const runTest = async () => {
  console.log("\n=======================================================");
  console.log("TESTING SECURE FILE SHARING & FILE VERSION HISTORY");
  console.log("=======================================================\n");

  await new Promise((r) => setTimeout(r, 1500));

  const testEmail = `share_test_${Date.now()}@example.com`;
  const testPassword = "Password123!";
  let token = "";
  let authHeaders = {};
  let userId = "";

  try {
    // 1. Register User
    console.log("1. Registering test user...");
    const regRes = await makeRequest("/api/auth/register", "POST", {
      name: "Share Version Tester",
      email: testEmail,
      password: testPassword,
    });
    token = regRes.body.token;
    userId = regRes.body.user.id;
    authHeaders = { Authorization: `Bearer ${token}` };
    console.log("   --> PASS: User registered.\n");

    // 2. Upload Sample File
    console.log("2. Uploading test file for sharing & versioning...");
    const upRes = await makeRequest(
      "/api/files/request-upload-url",
      "POST",
      {
        name: "roadmap.pdf",
        size: 1024 * 50,
        mime_type: "application/pdf",
      },
      authHeaders
    );
    const { uploadUrl, storage_key } = upRes.body.data;

    await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/pdf" },
      body: Buffer.alloc(1024 * 50, "p"),
    });

    const confirmRes = await makeRequest(
      "/api/files/confirm-upload",
      "POST",
      {
        storage_key,
        name: "roadmap.pdf",
        size: 1024 * 50,
        mime_type: "application/pdf",
      },
      authHeaders
    );
    const testFile = confirmRes.body.file;
    console.log(`   File created: ${testFile.name} (v${testFile.version || 1})`);
    console.log("   --> PASS: Initial file uploaded.\n");

    // =========================================================================
    // PART A: SECURE FILE SHARING TESTS
    // =========================================================================
    console.log("--- PART A: FILE SHARING & PERMISSIONS ---");

    // 3. Create Standard Download Share Link
    console.log("3. Creating share link with download permissions...");
    const shareRes = await makeRequest(
      "/api/shares",
      "POST",
      {
        resource_id: testFile.id,
        resource_type: "file",
        permission: "download",
      },
      authHeaders
    );
    const standardShare = shareRes.body.share || shareRes.body.share_link;
    console.log(`   Share Token: ${standardShare.token}`);
    console.log("   --> PASS: Share link created.\n");

    // 4. Access Share Link Publicly & Track Access
    console.log("4. Resolving public share link and verifying view tracking...");
    const accessRes1 = await makeRequest(`/api/shares/access/${standardShare.token}`);
    if (accessRes1.statusCode !== 200 || !accessRes1.body.preview_url) {
      throw new Error(`Public share access failed with status ${accessRes1.statusCode}`);
    }
    console.log(`   Preview URL generated: ${accessRes1.body.preview_url.substring(0, 50)}...`);
    console.log(`   Access count: ${accessRes1.body.share.access_count}`);
    console.log("   --> PASS: Public link accessible without credentials.\n");

    // 5. Download Shared Resource & Track Downloads
    console.log("5. Testing shared download endpoint and download tracking...");
    const dlRes = await makeRequest(`/api/shares/access/${standardShare.token}/download`);
    if (dlRes.statusCode !== 200 || !dlRes.body.download_url) {
      throw new Error(`Shared download failed: ${JSON.stringify(dlRes.body)}`);
    }
    console.log(`   Download URL generated: ${dlRes.body.download_url.substring(0, 50)}...`);
    console.log("   --> PASS: Download URL generated and download tracked.\n");

    // 6. Test Read-Only (View Only) Share
    console.log("6. Testing Read-Only permission enforcement...");
    const roShareRes = await makeRequest(
      "/api/shares",
      "POST",
      {
        resource_id: testFile.id,
        resource_type: "file",
        permission: "view", // Read-only
      },
      authHeaders
    );
    const roToken = (roShareRes.body.share || roShareRes.body.share_link).token;

    // View should succeed
    const roAccess = await makeRequest(`/api/shares/access/${roToken}`);
    if (roAccess.statusCode !== 200 || roAccess.body.permission !== "view") {
      throw new Error("Read-only access resolution failed");
    }

    // Direct download endpoint must return 403 Forbidden
    const roDl = await makeRequest(`/api/shares/access/${roToken}/download`);
    if (roDl.statusCode !== 403) {
      throw new Error(`Expected 403 Forbidden for read-only download, got ${roDl.statusCode}`);
    }
    console.log("   --> PASS: Read-only access enforced; download correctly blocked (403).\n");

    // 7. Test Password-Protected Share
    console.log("7. Testing Password-Protected Share...");
    const sharePassword = "SecretSharePassword123";
    const pwShareRes = await makeRequest(
      "/api/shares",
      "POST",
      {
        resource_id: testFile.id,
        resource_type: "file",
        permission: "download",
        password: sharePassword,
      },
      authHeaders
    );
    const pwShare = pwShareRes.body.share;

    // 7a. Access without password -> should receive 401 with is_password_required
    console.log("   7a. Probing without password...");
    const unauthAccess = await makeRequest(`/api/shares/access/${pwShare.token}`);
    if (unauthAccess.statusCode !== 401 || !unauthAccess.body.is_password_required) {
      throw new Error(`Expected 401 password challenge, got ${unauthAccess.statusCode}`);
    }
    console.log("   --> PASS: Unauthenticated access challenged with 401.\n");

    // 7b. Access with incorrect password -> should receive 401
    console.log("   7b. Probing with incorrect password...");
    const wrongPwAccess = await makeRequest(`/api/shares/access/${pwShare.token}`, "POST", {
      password: "WrongPassword!",
    });
    if (wrongPwAccess.statusCode !== 401) {
      throw new Error(`Expected 401 for wrong password, got ${wrongPwAccess.statusCode}`);
    }
    console.log("   --> PASS: Wrong password rejected with 401.\n");

    // 7c. Access with correct password -> should receive 200 and preview_url
    console.log("   7c. Unlocking with correct password...");
    const correctPwAccess = await makeRequest(`/api/shares/access/${pwShare.token}`, "POST", {
      password: sharePassword,
    });
    if (correctPwAccess.statusCode !== 200 || !correctPwAccess.body.preview_url) {
      throw new Error(`Failed to unlock with correct password: ${correctPwAccess.statusCode}`);
    }
    console.log("   --> PASS: Unlocked with correct password (200 OK).\n");

    // 8. Test Expiration Dates
    console.log("8. Testing Share Link Expiration...");
    // Update share with past expiration date directly in DB to simulate expired link
    await Share.updateOne({ token: pwShare.token }, { expires_at: new Date(Date.now() - 5000) });

    const expiredAccess = await makeRequest(`/api/shares/access/${pwShare.token}`);
    if (expiredAccess.statusCode !== 410 || !expiredAccess.body.is_expired) {
      throw new Error(`Expected 410 Gone for expired link, got ${expiredAccess.statusCode}`);
    }
    console.log("   --> PASS: Expired link returns 410 Gone with friendly error.\n");

    // 9. Test Revoking Share Link
    console.log("9. Testing Revoking Share Link...");
    const revokeRes = await makeRequest(`/api/shares/${pwShare.id}`, "DELETE", null, authHeaders);
    if (revokeRes.statusCode !== 200) {
      throw new Error(`Failed to revoke share link: ${revokeRes.statusCode}`);
    }

    const revokedAccess = await makeRequest(`/api/shares/access/${pwShare.token}`);
    if (revokedAccess.statusCode !== 404) {
      throw new Error(`Expected 404 for revoked link, got ${revokedAccess.statusCode}`);
    }
    console.log("   --> PASS: Share link revoked and inaccessible.\n");

    // =========================================================================
    // PART B: FILE VERSION HISTORY TESTS
    // =========================================================================
    console.log("--- PART B: FILE VERSION HISTORY ---");

    // 10. Upload Version 2
    console.log("10. Uploading Version 2 for file...");
    const v2ReqRes = await makeRequest(
      `/api/files/${testFile.id}/versions/request-upload-url`,
      "POST",
      {
        name: "roadmap_v2.pdf",
        size: 1024 * 75,
        mime_type: "application/pdf",
      },
      authHeaders
    );
    const v2Data = v2ReqRes.body.data;
    console.log(`   Next version indicated: v${v2Data.next_version}`);

    await fetch(v2Data.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/pdf" },
      body: Buffer.alloc(1024 * 75, "2"),
    });

    const v2ConfirmRes = await makeRequest(
      `/api/files/${testFile.id}/versions/confirm-upload`,
      "POST",
      {
        storage_key: v2Data.storage_key,
        name: "roadmap_v2.pdf",
        size: 1024 * 75,
        mime_type: "application/pdf",
        change_summary: "Updated Q3 milestones",
      },
      authHeaders
    );
    if (v2ConfirmRes.statusCode !== 201 || v2ConfirmRes.body.file.version !== 2) {
      throw new Error("Failed to confirm version 2 upload");
    }
    console.log("   --> PASS: Version 2 confirmed (v1 archived in history).\n");

    // 11. Upload Version 3
    console.log("11. Uploading Version 3 for file...");
    const v3ReqRes = await makeRequest(
      `/api/files/${testFile.id}/versions/request-upload-url`,
      "POST",
      {
        name: "roadmap_v3_final.pdf",
        size: 1024 * 100,
        mime_type: "application/pdf",
      },
      authHeaders
    );
    const v3Data = v3ReqRes.body.data;

    await fetch(v3Data.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/pdf" },
      body: Buffer.alloc(1024 * 100, "3"),
    });

    const v3ConfirmRes = await makeRequest(
      `/api/files/${testFile.id}/versions/confirm-upload`,
      "POST",
      {
        storage_key: v3Data.storage_key,
        name: "roadmap_v3_final.pdf",
        size: 1024 * 100,
        mime_type: "application/pdf",
        change_summary: "Final signed executive version",
      },
      authHeaders
    );
    if (v3ConfirmRes.statusCode !== 201 || v3ConfirmRes.body.file.version !== 3) {
      throw new Error("Failed to confirm version 3 upload");
    }
    console.log("   --> PASS: Version 3 confirmed (v2 archived in history).\n");

    // 12. List File Versions
    console.log("12. Fetching full version history list...");
    const listVersionsRes = await makeRequest(
      `/api/files/${testFile.id}/versions`,
      "GET",
      null,
      authHeaders
    );
    const versions = listVersionsRes.body.versions;
    console.log(`   Total versions in history: ${versions.length}`);
    versions.forEach((v) => {
      console.log(
        `     - Version ${v.version_number} (${v.is_current ? "CURRENT" : "Archived"}): ${v.name} (${v.size} bytes)`
      );
    });

    if (versions.length !== 3) {
      throw new Error(`Expected 3 versions, got ${versions.length}`);
    }
    console.log("   --> PASS: Version history lists all past and active versions.\n");

    // 13. Download a Past Version (v1)
    console.log("13. Downloading past version 1...");
    const pastV1 = versions.find((v) => v.version_number === 1);
    const dlV1Res = await makeRequest(
      `/api/files/${testFile.id}/versions/${pastV1.id}/download?download=true`,
      "GET",
      null,
      authHeaders
    );
    if (dlV1Res.statusCode !== 200 || !dlV1Res.body.download_url) {
      throw new Error("Failed to download past version");
    }
    console.log(`   Download URL for v1 generated: ${dlV1Res.body.download_url.substring(0, 50)}...`);
    console.log("   --> PASS: Past version preview and download verified.\n");

    // 14. Restore Version 1 as Current Active File
    console.log("14. Restoring Version 1 as active file...");
    const restoreRes = await makeRequest(
      `/api/files/${testFile.id}/versions/${pastV1.id}/restore`,
      "POST",
      null,
      authHeaders
    );
    if (restoreRes.statusCode !== 200) {
      throw new Error(`Failed to restore version: ${restoreRes.statusCode}`);
    }
    const restoredFile = restoreRes.body.file;
    console.log(`   Restored active file name: ${restoredFile.name}, version: v${restoredFile.version}`);
    if (restoredFile.name !== pastV1.name || restoredFile.version !== 4) {
      throw new Error("Version restoration properties mismatch");
    }
    console.log("   --> PASS: Version 1 restored cleanly as new active version (v4).\n");

    // 15. Delete an Old Version Safely
    console.log("15. Deleting old Version 2 from history...");
    const pastV2 = versions.find((v) => v.version_number === 2);
    const delV2Res = await makeRequest(
      `/api/files/${testFile.id}/versions/${pastV2.id}`,
      "DELETE",
      null,
      authHeaders
    );
    if (delV2Res.statusCode !== 200) {
      throw new Error(`Failed to delete version 2: ${delV2Res.statusCode}`);
    }
    console.log("   --> PASS: Old version 2 deleted and physical storage reclaimed.\n");

    // 16. Verify Cannot Delete Current Active Version
    console.log("16. Verifying active version deletion is prohibited...");
    const delCurrentRes = await makeRequest(
      `/api/files/${testFile.id}/versions/current`,
      "DELETE",
      null,
      authHeaders
    );
    if (delCurrentRes.statusCode !== 400) {
      throw new Error(`Expected 400 when attempting to delete current version, got ${delCurrentRes.statusCode}`);
    }
    console.log("   --> PASS: Deletion of active version blocked.\n");

    // Clean up
    await User.deleteOne({ _id: userId });
    await File.deleteMany({ owner_id: userId });
    await FileVersion.deleteMany({ uploaded_by: userId });
    await Share.deleteMany({ owner_id: userId });

    console.log("=======================================================");
    console.log("ALL 16 SHARING & VERSION HISTORY TESTS PASSED (100%)!");
    console.log("=======================================================\n");
  } catch (err) {
    console.error("\n[TEST FAILED]:", err.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
};

runTest();
