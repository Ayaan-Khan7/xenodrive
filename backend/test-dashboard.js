import http from "http";
import app from "./server.js";
import { env } from "./config/env.js";
import User from "./models/User.js";
import Folder from "./models/Folder.js";
import File from "./models/File.js";

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

const runDashboardTest = async () => {
  console.log("\n==========================================");
  console.log("TESTING CLOUDVAULT DASHBOARD STATS API");
  console.log("==========================================\n");

  await new Promise((r) => setTimeout(r, 1500));

  const testEmail = `dash_user_${Date.now()}@example.com`;
  const testPassword = "Password123!";

  try {
    // 1. Register User
    console.log("1. Creating Test User for Dashboard...");
    const regRes = await makeRequest("/api/auth/register", "POST", {
      name: "Dashboard Tester",
      email: testEmail,
      password: testPassword,
    });
    const token = regRes.body.token;
    const authHeaders = { Authorization: `Bearer ${token}` };
    console.log("   --> PASS: User registered.\n");

    // 2. Fetch Initial Empty Dashboard
    console.log("2. Fetching Initial Empty Dashboard Stats...");
    const initStatsRes = await makeRequest("/api/dashboard/stats", "GET", null, authHeaders);
    const initStats = initStatsRes.body.data;
    console.log(`   Total Files: ${initStats.total_files}, Total Folders: ${initStats.total_folders}`);
    console.log(`   Storage Used: ${initStats.storage_used}, Storage Available: ${initStats.storage_available}`);
    if (initStats.total_files === 0 && initStats.total_folders === 0 && initStats.storage_used === 0) {
      console.log("   --> PASS: Initial dashboard stats accurate for new account.\n");
    } else {
      throw new Error("Initial stats should be zero!");
    }

    // 3. Create Sample Folder and Files
    console.log("3. Creating Sample Folder and Uploading Sample Files...");
    const fRes = await makeRequest("/api/folders", "POST", { name: "Media Assets" }, authHeaders);
    const folder = fRes.body.folder;

    const sampleFiles = [
      { name: "photo.png", size: 1024 * 500, mime: "image/png" },
      { name: "spec.pdf", size: 1024 * 200, mime: "application/pdf" },
      { name: "video.mp4", size: 1024 * 1024 * 5, mime: "video/mp4" },
    ];

    for (const sf of sampleFiles) {
      const upRes = await makeRequest("/api/files/request-upload-url", "POST", {
        name: sf.name,
        size: sf.size,
        mime_type: sf.mime,
        folder_id: folder.id,
      }, authHeaders);
      const { uploadUrl, storage_key } = upRes.body.data;

      // Direct PUT
      await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": sf.mime },
        body: Buffer.alloc(sf.size, "a"),
      });

      // Confirm
      await makeRequest("/api/files/confirm-upload", "POST", {
        storage_key,
        name: sf.name,
        size: sf.size,
        mime_type: sf.mime,
        folder_id: folder.id,
      }, authHeaders);
    }
    console.log("   --> PASS: Sample data created.\n");

    // 4. Fetch Populated Dashboard Stats
    console.log("4. Fetching Populated Dashboard Analytics...");
    const populatedRes = await makeRequest("/api/dashboard/stats", "GET", null, authHeaders);
    const stats = populatedRes.body.data;
    console.log(`   Total Files: ${stats.total_files}`);
    console.log(`   Total Folders: ${stats.total_folders}`);
    console.log(`   Storage Used: ${stats.storage_used} bytes`);
    console.log(`   Storage Available: ${stats.storage_available} bytes`);
    console.log(`   Recent Files Count: ${stats.recent_files.length}`);
    console.log(`   Recent Activity Count: ${stats.recent_activity.length}`);
    console.log(`   Images: ${stats.distribution.images.count} (${stats.distribution.images.size} bytes)`);
    console.log(`   Documents: ${stats.distribution.documents.count} (${stats.distribution.documents.size} bytes)`);
    console.log(`   Videos: ${stats.distribution.videos.count} (${stats.distribution.videos.size} bytes)`);

    if (
      stats.total_files === 3 &&
      stats.total_folders === 1 &&
      stats.recent_files.length === 3 &&
      stats.distribution.images.count === 1 &&
      stats.distribution.documents.count === 1 &&
      stats.distribution.videos.count === 1
    ) {
      console.log("   --> PASS: Live dashboard analytics aggregated accurately from backend records.\n");
    } else {
      throw new Error("Dashboard stats mismatch!");
    }

    // Clean up
    await User.deleteOne({ email: testEmail });
    await Folder.deleteMany({ owner_id: regRes.body.user.id });
    await File.deleteMany({ owner_id: regRes.body.user.id });

    console.log("==========================================");
    console.log("ALL DASHBOARD INTEGRATION TESTS PASSED!");
    console.log("==========================================\n");
  } catch (err) {
    console.error("\n[DASHBOARD TEST FAILED]:", err.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
};

runDashboardTest();
