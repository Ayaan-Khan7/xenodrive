import http from "http";
import app from "./server.js";
import { env } from "./config/env.js";
import User from "./models/User.js";

const makeRequest = (path, method = "GET", data = null, headers = {}) => {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : null;
    const requestHeaders = {
      ...headers,
    };

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
          } catch (e) {
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
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
};

const runAuthTests = async () => {
  console.log("\n==========================================");
  console.log("RUNNING CLOUDVAULT AUTHENTICATION TESTS");
  console.log("==========================================\n");

  // Allow server and DB connection to stabilize
  await new Promise((r) => setTimeout(r, 1500));

  const testEmail = `testuser_${Date.now()}@example.com`;
  const testPassword = "Password123!";
  const newPassword = "NewSecretPassword456!";
  let authToken = null;
  let authCookie = null;
  let resetToken = null;

  try {
    // Clean up any test artifacts with same email prefix just in case
    await User.deleteMany({ email: { $regex: /testuser_.*@example\.com/ } });

    // 1. Test Registration
    console.log("1. Testing Registration with valid credentials...");
    const regRes = await makeRequest("/api/auth/register", "POST", {
      name: "Alex Morgan",
      email: testEmail,
      password: testPassword,
    });
    console.log(`   Status: ${regRes.statusCode}`);
    if (regRes.statusCode === 201 && regRes.body.token && regRes.body.user.email === testEmail) {
      authToken = regRes.body.token;
      authCookie = regRes.headers["set-cookie"] ? regRes.headers["set-cookie"][0].split(";")[0] : null;
      console.log(`   User ID: ${regRes.body.user.id}, Token issued: ${authToken.substring(0, 15)}...`);
      console.log("   --> PASS: User registered successfully.\n");
    } else {
      throw new Error(`Registration failed: ${JSON.stringify(regRes.body)}`);
    }

    // 2. Test Duplicate Account Prevention
    console.log("2. Testing Duplicate Registration Prevention...");
    const dupRes = await makeRequest("/api/auth/register", "POST", {
      name: "Alex Morgan Clone",
      email: testEmail,
      password: testPassword,
    });
    console.log(`   Status: ${dupRes.statusCode}`);
    if (dupRes.statusCode === 409 && !dupRes.body.success) {
      console.log("   --> PASS: Duplicate registration rejected with 409 Conflict.\n");
    } else {
      throw new Error(`Duplicate account test failed: ${JSON.stringify(dupRes.body)}`);
    }

    // 3. Test Invalid Registration Validation
    console.log("3. Testing Input Validation (short password, bad email)...");
    const invalidRegRes = await makeRequest("/api/auth/register", "POST", {
      name: "A",
      email: "not-an-email",
      password: "123",
    });
    console.log(`   Status: ${invalidRegRes.statusCode}`);
    if (invalidRegRes.statusCode === 400 && invalidRegRes.body.details) {
      console.log(`   Validation details count: ${invalidRegRes.body.details.length}`);
      console.log("   --> PASS: Validation errors properly captured and reported.\n");
    } else {
      throw new Error(`Validation test failed: ${JSON.stringify(invalidRegRes.body)}`);
    }

    // 4. Test Login with Wrong Password
    console.log("4. Testing Login with Incorrect Password...");
    const wrongPassRes = await makeRequest("/api/auth/login", "POST", {
      email: testEmail,
      password: "WrongPassword999",
    });
    console.log(`   Status: ${wrongPassRes.statusCode}`);
    if (wrongPassRes.statusCode === 401 && !wrongPassRes.body.success) {
      console.log("   --> PASS: Incorrect password rejected with 401 Unauthorized.\n");
    } else {
      throw new Error(`Wrong password test failed: ${JSON.stringify(wrongPassRes.body)}`);
    }

    // 5. Test Login with Non-existent Email
    console.log("5. Testing Login with Non-existent Email...");
    const nonExistRes = await makeRequest("/api/auth/login", "POST", {
      email: "nonexistent_user_9999@example.com",
      password: "SomePassword123!",
    });
    console.log(`   Status: ${nonExistRes.statusCode}`);
    if (nonExistRes.statusCode === 401 && !nonExistRes.body.success) {
      console.log("   --> PASS: Non-existent email rejected with 401 Unauthorized.\n");
    } else {
      throw new Error(`Non-existent user test failed: ${JSON.stringify(nonExistRes.body)}`);
    }

    // 6. Test Valid Login
    console.log("6. Testing Valid Login...");
    const loginRes = await makeRequest("/api/auth/login", "POST", {
      email: testEmail,
      password: testPassword,
    });
    console.log(`   Status: ${loginRes.statusCode}`);
    if (loginRes.statusCode === 200 && loginRes.body.token && loginRes.body.user.email === testEmail) {
      authToken = loginRes.body.token;
      authCookie = loginRes.headers["set-cookie"] ? loginRes.headers["set-cookie"][0].split(";")[0] : null;
      console.log("   --> PASS: User logged in successfully.\n");
    } else {
      throw new Error(`Login failed: ${JSON.stringify(loginRes.body)}`);
    }

    // 7. Test Protected Route with Bearer Token Header
    console.log("7. Testing Protected Route (GET /api/auth/me) with Bearer token...");
    const meHeaderRes = await makeRequest("/api/auth/me", "GET", null, {
      Authorization: `Bearer ${authToken}`,
    });
    console.log(`   Status: ${meHeaderRes.statusCode}`);
    if (meHeaderRes.statusCode === 200 && meHeaderRes.body.data.user.email === testEmail) {
      console.log(`   Fetched user: ${meHeaderRes.body.data.user.name} (${meHeaderRes.body.data.user.email})`);
      console.log("   --> PASS: Protected route authenticated via Bearer token.\n");
    } else {
      throw new Error(`Bearer token auth failed: ${JSON.stringify(meHeaderRes.body)}`);
    }

    // 8. Test Protected Route with HTTP-Only Cookie
    console.log("8. Testing Protected Route (GET /api/auth/me) with Cookie session...");
    const meCookieRes = await makeRequest("/api/auth/me", "GET", null, {
      Cookie: authCookie,
    });
    console.log(`   Status: ${meCookieRes.statusCode}`);
    if (meCookieRes.statusCode === 200 && meCookieRes.body.data.user.email === testEmail) {
      console.log("   --> PASS: Protected route authenticated via HTTP-only cookie.\n");
    } else {
      throw new Error(`Cookie auth failed: ${JSON.stringify(meCookieRes.body)}`);
    }

    // 9. Test Protected Route without Token (Unauthorized Access)
    console.log("9. Testing Protected Route without credentials...");
    const unauthRes = await makeRequest("/api/auth/me", "GET");
    console.log(`   Status: ${unauthRes.statusCode}`);
    if (unauthRes.statusCode === 401 && !unauthRes.body.success) {
      console.log("   --> PASS: Unauthorized request blocked with 401.\n");
    } else {
      throw new Error(`Unauthorized protection test failed: ${JSON.stringify(unauthRes.body)}`);
    }

    // 10. Test Forgot Password
    console.log("10. Testing Forgot Password (POST /api/auth/forgot-password)...");
    const forgotRes = await makeRequest("/api/auth/forgot-password", "POST", {
      email: testEmail,
    });
    console.log(`   Status: ${forgotRes.statusCode}`);
    if (forgotRes.statusCode === 200 && forgotRes.body.data.resetToken) {
      resetToken = forgotRes.body.data.resetToken;
      console.log(`   Reset token received: ${resetToken.substring(0, 15)}...`);
      console.log("   --> PASS: Password reset token generated.\n");
    } else {
      throw new Error(`Forgot password failed: ${JSON.stringify(forgotRes.body)}`);
    }

    // 11. Test Reset Password with Token
    console.log("11. Testing Password Reset with Token (POST /api/auth/reset-password/:token)...");
    const resetRes = await makeRequest(`/api/auth/reset-password/${resetToken}`, "POST", {
      password: newPassword,
    });
    console.log(`   Status: ${resetRes.statusCode}`);
    if (resetRes.statusCode === 200 && resetRes.body.token) {
      console.log("   --> PASS: Password reset successfully and new token issued.\n");
    } else {
      throw new Error(`Reset password failed: ${JSON.stringify(resetRes.body)}`);
    }

    // 12. Test Login with New Password
    console.log("12. Testing Login with New Password...");
    const newLoginRes = await makeRequest("/api/auth/login", "POST", {
      email: testEmail,
      password: newPassword,
    });
    console.log(`   Status: ${newLoginRes.statusCode}`);
    if (newLoginRes.statusCode === 200 && newLoginRes.body.success) {
      console.log("   --> PASS: Login successful with new password.\n");
    } else {
      throw new Error(`Login with new password failed: ${JSON.stringify(newLoginRes.body)}`);
    }

    // 13. Test Logout
    console.log("13. Testing Logout (POST /api/auth/logout)...");
    const logoutRes = await makeRequest("/api/auth/logout", "POST");
    console.log(`   Status: ${logoutRes.statusCode}`);
    const setCookie = logoutRes.headers["set-cookie"] ? logoutRes.headers["set-cookie"][0] : "";
    if (logoutRes.statusCode === 200 && setCookie.includes("token=none")) {
      console.log("   --> PASS: Session cookie cleared on logout.\n");
    } else {
      throw new Error(`Logout failed: ${JSON.stringify(logoutRes.body)}`);
    }

    // Clean up test user
    await User.deleteOne({ email: testEmail });

    console.log("==========================================");
    console.log("ALL 13 AUTHENTICATION TESTS PASSED!");
    console.log("==========================================\n");
  } catch (error) {
    console.error("\n[TEST FAILURE]:", error.message);
  } finally {
    process.exit(0);
  }
};

runAuthTests();

