import http from "http";
import app from "./server.js";
import { env } from "./config/env.js";
import User from "./models/User.js";
import Folder from "./models/Folder.js";
import File from "./models/File.js";
import ActivityLog from "./models/ActivityLog.js";

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
  console.log("TESTING CLOUDVAULT ADVANCED PORTFOLIO FEATURES");
  console.log("=======================================================\n");

  await new Promise((r) => setTimeout(r, 1500));

  const testEmail = `adv_features_${Date.now()}@example.com`;
  const testPassword = "Password123!";
  let token = "";
  let authHeaders = {};
  let userId = "";

  try {
    // 0. Ensure legacy unique index is dropped on MongoDB
    try {
      const indexes = await File.collection.indexes();
      const storageKeyIndex = indexes.find((idx) => idx.name === "storage_key_1");
      if (storageKeyIndex && storageKeyIndex.unique) {
        await File.collection.dropIndex("storage_key_1");
        console.log("   --> Cleaned up legacy unique storage_key_1 index.\n");
      }
    } catch {
      // index might already be dropped
    }

    // 1. Register User
    console.log("1. Registering test user...");
    const regRes = await makeRequest("/api/auth/register", "POST", {
      name: "Advanced Features Tester",
      email: testEmail,
      password: testPassword,
    });
    token = regRes.body.token;
    userId = regRes.body.user.id;
    authHeaders = { Authorization: `Bearer ${token}` };
    console.log("   --> PASS: User registered.\n");

    // =========================================================================
    // FEATURE 1: DUPLICATE DETECTION & DEDUPLICATION
    // =========================================================================
    console.log("--- FEATURE 1: DUPLICATE DETECTION & DEDUPLICATION ---");

    const sampleHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    console.log("2. Uploading original file A...");
    const upARes = await makeRequest("/api/files/request-upload-url", "POST", {
      name: "contract_original.pdf",
      size: 1024 * 60,
      mime_type: "application/pdf",
      checksum_sha256: sampleHash,
    }, authHeaders);
    const { uploadUrl: urlA, storage_key: keyA } = upARes.body.data;

    await fetch(urlA, {
      method: "PUT",
      headers: { "Content-Type": "application/pdf" },
      body: Buffer.alloc(1024 * 60, "A"),
    });

    const confirmARes = await makeRequest("/api/files/confirm-upload", "POST", {
      storage_key: keyA,
      name: "contract_original.pdf",
      size: 1024 * 60,
      mime_type: "application/pdf",
      checksum_sha256: sampleHash,
    }, authHeaders);
    const fileA = confirmARes.body.file;
    console.log(`   File A confirmed: ${fileA.name} (${fileA.size} bytes)`);

    // 3. Probing duplicate file B
    console.log("3. Probing upload with identical SHA-256 hash...");
    const probeDupRes = await makeRequest("/api/files/request-upload-url", "POST", {
      name: "contract_copy.pdf",
      size: 1024 * 60,
      mime_type: "application/pdf",
      checksum_sha256: sampleHash,
    }, authHeaders);

    if (!probeDupRes.body.is_duplicate || !probeDupRes.body.duplicate_file) {
      throw new Error("Duplicate detection failed to flag identical checksum");
    }
    console.log(`   Detected duplicate of: "${probeDupRes.body.duplicate_file.name}"`);
    console.log("   --> PASS: User notified of duplicate before uploading.\n");

    // 4. Testing Deduplication Link (Zero Storage Overhead)
    console.log("4. Performing zero-overhead deduplication link...");
    const initialUser = (await makeRequest("/api/auth/me", "GET", null, authHeaders)).body.user;
    const initialStorageUsed = initialUser.storage_used;

    const dedupRes = await makeRequest("/api/files/request-upload-url", "POST", {
      name: "contract_copy.pdf",
      size: 1024 * 60,
      mime_type: "application/pdf",
      checksum_sha256: sampleHash,
      deduplicate: true,
    }, authHeaders);

    if (!dedupRes.body.deduplicated || !dedupRes.body.file) {
      throw new Error("Deduplication linking failed");
    }

    const afterUser = (await makeRequest("/api/auth/me", "GET", null, authHeaders)).body.user;
    if (afterUser.storage_used !== initialStorageUsed) {
      throw new Error(`Deduplicated file increased storage: before ${initialStorageUsed}, after ${afterUser.storage_used}`);
    }
    console.log(`   File linked to existing storage key: ${dedupRes.body.file.storage_key}`);
    console.log(`   Storage consumption: ${afterUser.storage_used} bytes (zero bytes added)`);
    console.log("   --> PASS: Deduplication avoided redundant storage consumption.\n");

    // 5. Duplicate Scanner Endpoint
    console.log("5. Testing Duplicate Scanner API (GET /api/files/duplicates)...");
    const scanRes = await makeRequest("/api/files/duplicates", "GET", null, authHeaders);
    if (scanRes.statusCode !== 200 || scanRes.body.total_duplicate_clusters !== 1) {
      throw new Error(`Expected 1 duplicate cluster, got ${scanRes.body.total_duplicate_clusters}`);
    }
    console.log(`   Duplicate clusters found: ${scanRes.body.total_duplicate_clusters}`);
    console.log(`   Total duplicate files: ${scanRes.body.total_duplicate_files}`);
    console.log(`   Total wasted bytes: ${scanRes.body.total_wasted_bytes}`);
    console.log("   --> PASS: Duplicate scanner identified clusters accurately.\n");

    // =========================================================================
    // FEATURE 2: STORAGE ANALYTICS
    // =========================================================================
    console.log("--- FEATURE 2: STORAGE ANALYTICS & TRENDS ---");

    // 6. Upload a large media file and small documents
    console.log("6. Uploading additional files for analytics...");
    const upBig = await makeRequest("/api/files/request-upload-url", "POST", {
      name: "large_presentation.mp4",
      size: 1024 * 1024 * 3, // 3MB
      mime_type: "video/mp4",
    }, authHeaders);
    await fetch(upBig.body.data.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "video/mp4" },
      body: Buffer.alloc(1024 * 1024 * 3, "V"),
    });
    await makeRequest("/api/files/confirm-upload", "POST", {
      storage_key: upBig.body.data.storage_key,
      name: "large_presentation.mp4",
      size: 1024 * 1024 * 3,
      mime_type: "video/mp4",
    }, authHeaders);

    console.log("7. Fetching comprehensive storage analytics (GET /api/dashboard/stats)...");
    const statsRes = await makeRequest("/api/dashboard/stats", "GET", null, authHeaders);
    const stats = statsRes.body.data;

    console.log(`   Storage Used: ${stats.storage_used} bytes (${stats.storage_percent}%)`);
    console.log(`   Available: ${stats.storage_available} bytes`);
    console.log(`   Largest Files count: ${stats.largest_files.length}`);
    console.log(`   Top file: "${stats.largest_files[0]?.name}" (${stats.largest_files[0]?.size} bytes)`);
    console.log(`   Daily storage trend days: ${stats.storage_activity.length}`);

    if (
      stats.largest_files.length === 0 ||
      stats.largest_files[0].name !== "large_presentation.mp4" ||
      stats.storage_activity.length !== 7 ||
      stats.duplicate_summary.duplicate_files_count !== 1
    ) {
      throw new Error("Storage analytics fields missing or inaccurate");
    }
    console.log("   --> PASS: Largest files, trend activity, and duplicate metrics verified.\n");

    // =========================================================================
    // FEATURE 3: ACTIVITY LOGS
    // =========================================================================
    console.log("--- FEATURE 3: ACTIVITY LOGGING & AUDIT TRAIL ---");

    // 8. Create folder and perform download to trigger logs
    console.log("8. Creating folder, downloading, and soft-deleting to generate logs...");
    const folderRes = await makeRequest("/api/folders", "POST", { name: "Audit Vault" }, authHeaders);
    await makeRequest(`/api/files/${fileA.id}/preview?download=true`, "GET", null, authHeaders);
    await makeRequest(`/api/files/${dedupRes.body.file.id}`, "DELETE", null, authHeaders);

    console.log("9. Querying Activity Log API (GET /api/activity)...");
    const actRes = await makeRequest("/api/activity", "GET", null, authHeaders);
    const activities = actRes.body.activities;
    console.log(`   Total activities recorded: ${actRes.body.total}`);
    activities.slice(0, 5).forEach((a) => {
      console.log(`     [${a.action.toUpperCase()}]: ${a.resource_name} (${new Date(a.created_at).toLocaleTimeString()})`);
    });

    const recordedActions = activities.map((a) => a.action);
    if (
      !recordedActions.includes("upload") ||
      !recordedActions.includes("download") ||
      !recordedActions.includes("create_folder") ||
      !recordedActions.includes("delete")
    ) {
      throw new Error(`Activity log missing expected action types. Found: ${recordedActions.join(", ")}`);
    }
    console.log("   --> PASS: Activity logging captured upload, download, folder creation, and delete.\n");

    // =========================================================================
    // FEATURE 4: IMPROVED SEARCH (FILENAME, TYPE, DATE, EXTRACTED TEXT)
    // =========================================================================
    console.log("--- FEATURE 4: ADVANCED SEARCH & DOCUMENT CONTENT EXTRACTION ---");

    // 10. Upload a text document containing specific indexed keywords
    console.log("10. Uploading text document with searchable internal content...");
    const secretTerm = "super-secret-quantum-algorithm-2026";
    const textContent = `CloudVault Research Paper:\nThis document contains the ${secretTerm} specification.\nConfidential internal memo.`;

    const upText = await makeRequest("/api/files/request-upload-url", "POST", {
      name: "research_notes.txt",
      size: Buffer.byteLength(textContent),
      mime_type: "text/plain",
    }, authHeaders);

    await fetch(upText.body.data.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "text/plain" },
      body: textContent,
    });

    await makeRequest("/api/files/confirm-upload", "POST", {
      storage_key: upText.body.data.storage_key,
      name: "research_notes.txt",
      size: Buffer.byteLength(textContent),
      mime_type: "text/plain",
    }, authHeaders);
    console.log("   --> PASS: Text document uploaded and indexed.\n");

    // 11. Search by filename
    console.log("11. Searching by filename: 'contract'...");
    const nameSearch = await makeRequest("/api/files?search=contract", "GET", null, authHeaders);
    console.log(`   Matched files: ${nameSearch.body.files.length}`);
    if (nameSearch.body.files.length === 0) throw new Error("Search by filename failed");
    console.log("   --> PASS: Filename search matched successfully.\n");

    // 12. Search by extracted document content
    console.log("12. Searching by extracted document content: 'quantum-algorithm'...");
    const contentSearch = await makeRequest("/api/files?search=quantum-algorithm", "GET", null, authHeaders);
    console.log(`   Matched files: ${contentSearch.body.files.length}`);
    if (
      contentSearch.body.files.length === 0 ||
      contentSearch.body.files[0].name !== "research_notes.txt" ||
      !contentSearch.body.files[0].matched_in_content
    ) {
      throw new Error("Search inside document text content failed");
    }
    console.log(`   Matched file: "${contentSearch.body.files[0].name}" (matched_in_content: true)`);
    console.log("   --> PASS: Extracted document text keyword search verified!\n");

    // 13. Search with file type filter
    console.log("13. Filtering by file type: 'videos'...");
    const videoSearch = await makeRequest("/api/files?type=videos", "GET", null, authHeaders);
    console.log(`   Videos found: ${videoSearch.body.files.length}`);
    if (videoSearch.body.files.length !== 1 || videoSearch.body.files[0].name !== "large_presentation.mp4") {
      throw new Error("File type filter failed");
    }
    console.log("   --> PASS: File type filtering verified.\n");

    // 14. Search with date range filter
    console.log("14. Filtering by date range: 'today'...");
    const todaySearch = await makeRequest("/api/files?date_range=today", "GET", null, authHeaders);
    console.log(`   Files uploaded today: ${todaySearch.body.files.length}`);
    if (todaySearch.body.files.length === 0) {
      throw new Error("Date range filter failed");
    }
    console.log("   --> PASS: Date range filtering verified.\n");

    // Clean up
    await User.deleteOne({ _id: userId });
    await File.deleteMany({ owner_id: userId });
    await Folder.deleteMany({ owner_id: userId });
    await ActivityLog.deleteMany({ user_id: userId });

    console.log("=======================================================");
    console.log("ALL ADVANCED PORTFOLIO INTEGRATION TESTS PASSED (100%)!");
    console.log("=======================================================\n");
  } catch (err) {
    console.error("\n[TEST FAILED]:", err.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
};

runTest();
