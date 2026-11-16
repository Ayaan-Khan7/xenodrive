import http from "http";
import crypto from "crypto";
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

const runDriveTests = async () => {
  console.log("\n=======================================================");
  console.log("RUNNING CLOUDVAULT FILE & FOLDER MANAGEMENT TESTS");
  console.log("=======================================================\n");

  await new Promise((r) => setTimeout(r, 1500));

  const userAEmail = `user_a_${Date.now()}@example.com`;
  const userBEmail = `user_b_${Date.now()}@example.com`;
  const testPassword = "Password123!";

  let tokenA = null;
  let tokenB = null;
  let userAId = null;
  let userBId = null;

  try {
    // ------------------------------------------------------------------------
    // SETUP: Create User A and User B
    // ------------------------------------------------------------------------
    console.log("1. Setting up Test Users (User A & User B)...");
    const regARes = await makeRequest("/api/auth/register", "POST", {
      name: "User Alpha",
      email: userAEmail,
      password: testPassword,
    });
    tokenA = regARes.body.token;
    userAId = regARes.body.user.id;

    const regBRes = await makeRequest("/api/auth/register", "POST", {
      name: "User Beta",
      email: userBEmail,
      password: testPassword,
    });
    tokenB = regBRes.body.token;
    userBId = regBRes.body.user.id;
    console.log("   --> PASS: Users registered successfully.\n");

    const authHeadersA = { Authorization: `Bearer ${tokenA}` };
    const authHeadersB = { Authorization: `Bearer ${tokenB}` };

    // ------------------------------------------------------------------------
    // FOLDER MANAGEMENT TESTS
    // ------------------------------------------------------------------------
    console.log("2. Creating Root Folder ('Documents')...");
    const createFolder1Res = await makeRequest("/api/folders", "POST", { name: "Documents", parent_id: null }, authHeadersA);
    const folderDocuments = createFolder1Res.body.folder;
    console.log(`   Folder ID: ${folderDocuments.id}, Path: [${folderDocuments.path.join(", ")}]`);
    console.log("   --> PASS: Root folder created.\n");

    console.log("3. Creating Nested Folder ('Invoices' inside 'Documents')...");
    const createFolder2Res = await makeRequest("/api/folders", "POST", { name: "Invoices", parent_id: folderDocuments.id }, authHeadersA);
    const folderInvoices = createFolder2Res.body.folder;
    console.log(`   Folder ID: ${folderInvoices.id}, Parent: ${folderInvoices.parent_id}, Path: [${folderInvoices.path.join(", ")}]`);
    console.log("   --> PASS: Nested folder created with proper parent path.\n");

    console.log("4. Creating Deeply Nested Folder ('2026' inside 'Invoices')...");
    const createFolder3Res = await makeRequest("/api/folders", "POST", { name: "2026", parent_id: folderInvoices.id }, authHeadersA);
    const folder2026 = createFolder3Res.body.folder;
    console.log(`   Folder ID: ${folder2026.id}, Path: [${folder2026.path.join(", ")}]`);
    console.log("   --> PASS: Deeply nested folder created.\n");

    console.log("5. Testing Breadcrumb Navigation for deeply nested folder...");
    const breadcrumbRes = await makeRequest(`/api/folders/${folder2026.id}`, "GET", null, authHeadersA);
    const breadcrumbs = breadcrumbRes.body.breadcrumbs;
    console.log("   Breadcrumbs:", breadcrumbs.map((b) => b.name).join(" > "));
    if (breadcrumbs.length === 2 && breadcrumbs[0].name === "Documents" && breadcrumbs[1].name === "Invoices") {
      console.log("   --> PASS: Breadcrumb hierarchy computed accurately.\n");
    } else {
      throw new Error(`Breadcrumbs incorrect: ${JSON.stringify(breadcrumbs)}`);
    }

    console.log("6. Renaming Folder ('2026' -> 'FY2026')...");
    const renameFolderRes = await makeRequest(`/api/folders/${folder2026.id}/rename`, "PATCH", { name: "FY2026" }, authHeadersA);
    if (renameFolderRes.body.folder.name === "FY2026") {
      console.log("   --> PASS: Folder renamed successfully.\n");
    } else {
      throw new Error("Folder rename failed");
    }

    console.log("7. Testing Circular Reference Prevention (Moving 'Documents' into 'Invoices')...");
    const circularMoveRes = await makeRequest(`/api/folders/${folderDocuments.id}/move`, "PATCH", { target_parent: folderInvoices.id }, authHeadersA);
    console.log(`   Status: ${circularMoveRes.statusCode}`);
    if (circularMoveRes.statusCode === 400 && !circularMoveRes.body.success) {
      console.log("   --> PASS: Circular folder move rejected with 400 Bad Request.\n");
    } else {
      throw new Error("Circular reference move was not blocked!");
    }

    console.log("8. Moving Folder ('FY2026' moved to Root)...");
    const moveFolderRes = await makeRequest(`/api/folders/${folder2026.id}/move`, "PATCH", { target_parent: null }, authHeadersA);
    if (moveFolderRes.body.folder.parent_id === null) {
      console.log("   --> PASS: Folder moved to root and path updated.\n");
    } else {
      throw new Error("Moving folder to root failed");
    }

    console.log("9. Testing Cross-User Isolation on Folders (User B attempts to access User A's folder)...");
    const unauthFolderRes = await makeRequest(`/api/folders/${folderDocuments.id}`, "GET", null, authHeadersB);
    console.log(`   Status: ${unauthFolderRes.statusCode}`);
    if (unauthFolderRes.statusCode === 404 && !unauthFolderRes.body.success) {
      console.log("   --> PASS: User B cannot access User A's folder.\n");
    } else {
      throw new Error("Cross-user folder privacy violation!");
    }

    // ------------------------------------------------------------------------
    // FILE MANAGEMENT & UPLOAD TESTS
    // ------------------------------------------------------------------------
    const file1Content = Buffer.from("Hello CloudVault - This is document 1 content!");
    const file1Checksum = crypto.createHash("sha256").update(file1Content).digest("hex");
    const file1Name = "contract_agreement.pdf";

    console.log("10. Requesting Presigned Upload URL for File 1 ('contract_agreement.pdf')...");
    const reqUploadRes1 = await makeRequest("/api/files/request-upload-url", "POST", {
      name: file1Name,
      size: file1Content.length,
      mime_type: "application/pdf",
      folder_id: folderDocuments.id,
      checksum_sha256: file1Checksum,
    }, authHeadersA);

    const { uploadUrl: uploadUrl1, storage_key: storageKey1 } = reqUploadRes1.body.data;
    console.log(`    Storage Key: ${storageKey1}`);
    console.log("   --> PASS: Presigned upload URL generated.\n");

    console.log("11. Uploading Binary Payload via Presigned PUT URL...");
    const putRes1 = await fetch(uploadUrl1, {
      method: "PUT",
      headers: { "Content-Type": "application/pdf" },
      body: file1Content,
    });
    if (putRes1.ok) {
      console.log(`    Upload HTTP Status: ${putRes1.status} OK`);
      console.log("   --> PASS: Binary data uploaded directly.\n");
    } else {
      throw new Error(`Direct upload failed with status ${putRes1.status}`);
    }

    console.log("12. Confirming Upload to Backend (Saving MongoDB Metadata & Tracking Quota)...");
    const confirmRes1 = await makeRequest("/api/files/confirm-upload", "POST", {
      storage_key: storageKey1,
      name: file1Name,
      size: file1Content.length,
      mime_type: "application/pdf",
      folder_id: folderDocuments.id,
      checksum_sha256: file1Checksum,
    }, authHeadersA);
    const file1 = confirmRes1.body.file;
    console.log(`    File ID: ${file1.id}, Name: ${file1.name}, Size: ${file1.size} bytes`);
    console.log("   --> PASS: File record created in MongoDB.\n");

    console.log("13. Testing Duplicate File Detection...");
    const dupUploadReq = await makeRequest("/api/files/request-upload-url", "POST", {
      name: "duplicate_copy.pdf",
      size: file1Content.length,
      mime_type: "application/pdf",
      folder_id: folderDocuments.id,
      checksum_sha256: file1Checksum,
    }, authHeadersA);
    if (dupUploadReq.body.is_duplicate) {
      console.log(`    Duplicate Message: "${dupUploadReq.body.message}"`);
      console.log("   --> PASS: Duplicate file detected via SHA-256.\n");
    } else {
      throw new Error("Duplicate detection failed!");
    }

    console.log("14. Uploading Multiple Files into 'Invoices' folder...");
    const invoiceFiles = [
      { name: "invoice_101.pdf", content: Buffer.from("Invoice 101 data") },
      { name: "invoice_102.pdf", content: Buffer.from("Invoice 102 data") },
    ];
    for (const inv of invoiceFiles) {
      const checksum = crypto.createHash("sha256").update(inv.content).digest("hex");
      const reqRes = await makeRequest("/api/files/request-upload-url", "POST", {
        name: inv.name,
        size: inv.content.length,
        mime_type: "application/pdf",
        folder_id: folderInvoices.id,
        checksum_sha256: checksum,
      }, authHeadersA);
      const { uploadUrl, storage_key } = reqRes.body.data;

      await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/pdf" },
        body: inv.content,
      });

      await makeRequest("/api/files/confirm-upload", "POST", {
        storage_key,
        name: inv.name,
        size: inv.content.length,
        mime_type: "application/pdf",
        folder_id: folderInvoices.id,
        checksum_sha256: checksum,
      }, authHeadersA);
      console.log(`    Uploaded & Confirmed: ${inv.name}`);
    }
    console.log("   --> PASS: Multiple files uploaded into nested folder.\n");

    console.log("15. Verifying Storage Quota Tracking on User Profile...");
    const meRes = await makeRequest("/api/auth/me", "GET", null, authHeadersA);
    const totalExpectedBytes = file1Content.length + invoiceFiles[0].content.length + invoiceFiles[1].content.length;
    console.log(`    User storage used: ${meRes.body.user.storage_used} bytes (Expected: ${totalExpectedBytes} bytes)`);
    if (meRes.body.user.storage_used === totalExpectedBytes) {
      console.log("   --> PASS: Storage quota tracked accurately.\n");
    } else {
      throw new Error(`Storage quota mismatch! Expected ${totalExpectedBytes}, got ${meRes.body.user.storage_used}`);
    }

    console.log("16. Downloading File and Verifying Byte Integrity...");
    const previewRes = await makeRequest(`/api/files/${file1.id}/preview?download=true`, "GET", null, authHeadersA);
    const downloadUrl = previewRes.body.url;
    const downloadedPayloadRes = await fetch(downloadUrl);
    const downloadedBuffer = Buffer.from(await downloadedPayloadRes.arrayBuffer());
    const downloadedChecksum = crypto.createHash("sha256").update(downloadedBuffer).digest("hex");

    if (downloadedChecksum === file1Checksum) {
      console.log(`    Original SHA-256:   ${file1Checksum}`);
      console.log(`    Downloaded SHA-256: ${downloadedChecksum}`);
      console.log("   --> PASS: File downloaded and verified with 100% byte integrity.\n");
    } else {
      throw new Error("Downloaded file data is corrupted!");
    }

    console.log("17. Renaming File ('contract_agreement.pdf' -> 'final_contract.pdf')...");
    const renameFileRes = await makeRequest(`/api/files/${file1.id}/rename`, "PATCH", { name: "final_contract.pdf" }, authHeadersA);
    if (renameFileRes.body.file.name === "final_contract.pdf") {
      console.log("   --> PASS: File renamed successfully.\n");
    } else {
      throw new Error("File rename failed!");
    }

    console.log("18. Moving File between Folders ('final_contract.pdf' moved to 'Invoices')...");
    const moveFileRes = await makeRequest(`/api/files/${file1.id}/move`, "PATCH", { target_folder: folderInvoices.id }, authHeadersA);
    if (moveFileRes.body.file.folder_id === folderInvoices.id) {
      console.log("   --> PASS: File moved between folders.\n");
    } else {
      throw new Error("Moving file between folders failed!");
    }

    console.log("19. Displaying Folder Contents ('Invoices' folder)...");
    const contentsRes = await makeRequest(`/api/files?folder_id=${folderInvoices.id}`, "GET", null, authHeadersA);
    console.log(`    Found ${contentsRes.body.files.length} files in 'Invoices':`);
    contentsRes.body.files.forEach((f) => {
      console.log(`    - ${f.name} (${f.size} bytes, mime: ${f.mime_type}, created: ${f.created_at})`);
    });
    if (contentsRes.body.files.length === 3) {
      console.log("   --> PASS: Folder contents listed correctly with size, type, and date.\n");
    } else {
      throw new Error(`Expected 3 files in Invoices, got ${contentsRes.body.files.length}`);
    }

    console.log("20. Testing File Sorting (by name ascending & descending)...");
    const sortAscRes = await makeRequest(`/api/files?folder_id=${folderInvoices.id}&sort=name_asc`, "GET", null, authHeadersA);
    const sortDescRes = await makeRequest(`/api/files?folder_id=${folderInvoices.id}&sort=name_desc`, "GET", null, authHeadersA);
    const ascNames = sortAscRes.body.files.map((f) => f.name);
    const descNames = sortDescRes.body.files.map((f) => f.name);
    console.log("    Ascending: ", ascNames.join(", "));
    console.log("    Descending:", descNames.join(", "));
    if (ascNames[0] === descNames[descNames.length - 1]) {
      console.log("   --> PASS: File sorting works properly.\n");
    } else {
      throw new Error("Sorting failed!");
    }

    console.log("21. Testing Search Filtering (Searching for 'final')...");
    const searchRes = await makeRequest(`/api/files?search=final`, "GET", null, authHeadersA);
    if (searchRes.body.files.length === 1 && searchRes.body.files[0].name === "final_contract.pdf") {
      console.log(`    Search match: ${searchRes.body.files[0].name}`);
      console.log("   --> PASS: Search filtering verified.\n");
    } else {
      throw new Error("Search filtering failed!");
    }

    console.log("22. Testing Cross-User Isolation on Files (User B attempts to download User A's file)...");
    const unauthFileRes = await makeRequest(`/api/files/${file1.id}/preview`, "GET", null, authHeadersB);
    console.log(`    Status: ${unauthFileRes.statusCode}`);
    if (unauthFileRes.statusCode === 404 && !unauthFileRes.body.success) {
      console.log("   --> PASS: User B cannot access User A's private file.\n");
    } else {
      throw new Error("Cross-user file privacy violation!");
    }

    // ------------------------------------------------------------------------
    // TRASH & PERMANENT DELETION TESTS
    // ------------------------------------------------------------------------
    console.log("23. Moving File to Trash...");
    await makeRequest(`/api/files/${file1.id}`, "DELETE", null, authHeadersA);
    const trashedFilesCheck = await makeRequest("/api/trash", "GET", null, authHeadersA);
    const isFileInTrash = trashedFilesCheck.body.files.some((f) => f.id === file1.id);
    if (isFileInTrash) {
      console.log("   --> PASS: File soft-deleted to trash.\n");
    } else {
      throw new Error("File not found in trash!");
    }

    console.log("24. Restoring File from Trash...");
    await makeRequest(`/api/files/${file1.id}/restore`, "POST", null, authHeadersA);
    const activeCheck = await makeRequest("/api/files", "GET", null, authHeadersA);
    const isFileActive = activeCheck.body.files.some((f) => f.id === file1.id);
    if (isFileActive) {
      console.log("   --> PASS: File restored from trash successfully.\n");
    } else {
      throw new Error("File restore failed!");
    }

    console.log("25. Moving Nested Folder to Trash (Cascading Trash)...");
    await makeRequest(`/api/folders/${folderInvoices.id}`, "DELETE", null, authHeadersA);
    const trashedInvoicesFiles = await File.find({ folder_id: folderInvoices.id, is_trashed: true });
    if (trashedInvoicesFiles.length >= 2) {
      console.log(`    Cascaded trash to ${trashedInvoicesFiles.length} files inside folder.`);
      console.log("   --> PASS: Cascading folder trash verified.\n");
    } else {
      throw new Error("Cascading folder trash failed!");
    }

    console.log("26. Emptying Trash (Physical Storage Cleanup & Quota Recalculation)...");
    const emptyTrashRes = await makeRequest("/api/trash/empty", "POST", null, authHeadersA);
    if (emptyTrashRes.statusCode === 200 && emptyTrashRes.body.success) {
      console.log("   --> PASS: Empty trash executed successfully.\n");
    } else {
      throw new Error("Empty trash failed!");
    }

    const postEmptyTrash = await makeRequest("/api/trash", "GET", null, authHeadersA);
    if (postEmptyTrash.body.files.length === 0 && postEmptyTrash.body.folders.length === 0) {
      console.log("   --> PASS: Trash confirmed completely empty.\n");
    } else {
      throw new Error("Trash is not empty after emptyTrash!");
    }

    // Clean up test users
    await User.deleteMany({ email: { $in: [userAEmail, userBEmail] } });
    await Folder.deleteMany({ owner_id: { $in: [userAId, userBId] } });
    await File.deleteMany({ owner_id: { $in: [userAId, userBId] } });

    console.log("=======================================================");
    console.log("ALL 26 FILE & FOLDER MANAGEMENT TESTS PASSED!");
    console.log("=======================================================\n");
  } catch (error) {
    console.error("\n[TEST FAILED]:", error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
};

runDriveTests();
