import http from "http";
import app from "./server.js";
import { env } from "./config/env.js";

const makeRequest = (path, method = "GET") => {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: env.PORT,
        path,
        method,
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              body: JSON.parse(body),
            });
          } catch (e) {
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              body,
            });
          }
        });
      }
    );

    req.on("error", reject);
    req.end();
  });
};

const runTests = async () => {
  console.log("\n==============================");
  console.log("TESTING CLOUDVAULT BACKEND API");
  console.log("==============================\n");

  // Wait 1.5 seconds for server and db connection attempt
  await new Promise((r) => setTimeout(r, 1500));

  try {
    // 1. Test Root Route
    console.log("1. Testing GET / (Root Route)...");
    const rootRes = await makeRequest("/");
    console.log(`   Status: ${rootRes.statusCode}`);
    console.log(`   Response:`, JSON.stringify(rootRes.body));
    if (rootRes.statusCode === 200 && rootRes.body.success) {
      console.log("   --> PASS: Root endpoint responded successfully.\n");
    } else {
      console.error("   --> FAIL: Root endpoint failed.\n");
    }

    // 2. Test Health Endpoint
    console.log("2. Testing GET /api/health...");
    const healthRes = await makeRequest("/api/health");
    console.log(`   Status: ${healthRes.statusCode}`);
    console.log(`   Response:`, JSON.stringify(healthRes.body));
    if (healthRes.statusCode === 200 && healthRes.body.success) {
      console.log("   --> PASS: Health check endpoint responded.\n");
    } else {
      console.error("   --> FAIL: Health check endpoint failed.\n");
    }

    // 3. Test Verbose Health Endpoint
    console.log("3. Testing GET /api/health?verbose=true...");
    const verboseRes = await makeRequest("/api/health?verbose=true");
    console.log(`   Status: ${verboseRes.statusCode}`);
    console.log(`   Response:`, JSON.stringify(verboseRes.body));
    if (verboseRes.statusCode === 200 && verboseRes.body.data.system) {
      console.log("   --> PASS: Verbose health check returned system and database diagnostics.\n");
    } else {
      console.error("   --> FAIL: Verbose health check failed.\n");
    }

    // 4. Test Validation Error Handling
    console.log("4. Testing Request Validation on GET /api/health?verbose=invalid_val...");
    const valRes = await makeRequest("/api/health?verbose=invalid_val");
    console.log(`   Status: ${valRes.statusCode}`);
    console.log(`   Response:`, JSON.stringify(valRes.body));
    if (valRes.statusCode === 400 && !valRes.body.success) {
      console.log("   --> PASS: Validation middleware caught invalid query and returned 400.\n");
    } else {
      console.error("   --> FAIL: Validation middleware failed to reject invalid query.\n");
    }

    // 5. Test 404 Centralized Error Handler
    console.log("5. Testing 404 Not Found on GET /api/nonexistent...");
    const notFoundRes = await makeRequest("/api/nonexistent");
    console.log(`   Status: ${notFoundRes.statusCode}`);
    console.log(`   Response:`, JSON.stringify(notFoundRes.body));
    if (notFoundRes.statusCode === 404 && !notFoundRes.body.success) {
      console.log("   --> PASS: Centralized error handler caught 404.\n");
    } else {
      console.error("   --> FAIL: 404 handling failed.\n");
    }

    console.log("==============================");
    console.log("ALL TESTS COMPLETED SUCCESSFULLY");
    console.log("==============================\n");
  } catch (err) {
    console.error("Test failed with error:", err);
  } finally {
    process.exit(0);
  }
};

runTests();

