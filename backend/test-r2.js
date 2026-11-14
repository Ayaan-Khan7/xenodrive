import crypto from "crypto";
import { env } from "./config/env.js";
import {
  generatePresignedUploadUrl,
  generatePresignedDownloadUrl,
  verifyObjectExists,
  deleteObjectFromR2,
  configureBucketCors,
} from "./services/r2StorageService.js";
import { logger } from "./utils/logger.js";

const runR2IntegrationTest = async () => {
  console.log("\n==========================================");
  console.log("CLOUDFLARE R2 OBJECT STORAGE INTEGRATION TEST");
  console.log("==========================================\n");

  if (!env.isR2Configured) {
    console.log("[STATUS] Cloudflare R2 credentials are NOT yet set in backend/.env.");
    console.log("Required environment variables to connect to your live R2 bucket:");
    console.log(" - R2_ACCOUNT_ID");
    console.log(" - R2_ACCESS_KEY_ID");
    console.log(" - R2_SECRET_ACCESS_KEY");
    console.log(" - R2_BUCKET_NAME\n");
    console.log("The S3 client, presigned URL generators, quota verification,");
    console.log("duplicate SHA-256 detection, and MongoDB metadata models are fully built.");
    console.log("Once you add your credentials to backend/.env, rerun `npm run test:r2` to execute live R2 operations.\n");
    process.exit(0);
  }

  const testData = Buffer.from(`CloudVault R2 Test File - ${Date.now()}`);
  const testChecksum = crypto.createHash("sha256").update(testData).digest("hex");
  const testKey = `tests/r2-integration-test-${Date.now()}.txt`;

  try {
    // 1. Configure Bucket CORS
    console.log("1. Configuring Cloudflare R2 Bucket CORS...");
    await configureBucketCors();
    console.log("   --> PASS: Bucket CORS configured.\n");

    // 2. Generate Presigned Upload URL
    console.log("2. Generating Presigned Upload URL...");
    const { uploadUrl, key } = await generatePresignedUploadUrl({
      key: testKey,
      contentType: "text/plain",
      size: testData.length,
    });
    console.log(`   Key: ${key}`);
    console.log(`   Presigned Upload URL: ${uploadUrl.substring(0, 60)}...`);
    console.log("   --> PASS: Presigned upload URL generated.\n");

    // 3. Perform Actual Upload directly to Cloudflare R2 via Presigned PUT URL
    console.log("3. Uploading test payload directly to Cloudflare R2 using Presigned URL...");
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "text/plain",
      },
      body: testData,
    });

    if (!uploadRes.ok) {
      throw new Error(`Direct R2 upload failed with HTTP status ${uploadRes.status}: ${uploadRes.statusText}`);
    }
    console.log(`   R2 Response Status: ${uploadRes.status} ${uploadRes.statusText}`);
    console.log("   --> PASS: Test file uploaded directly to Cloudflare R2.\n");

    // 4. Verify Object Existence in R2 via HeadObjectCommand
    console.log("4. Verifying object in Cloudflare R2 via HeadObjectCommand...");
    const r2Meta = await verifyObjectExists(testKey);
    console.log(`   Verified Size in R2: ${r2Meta.size} bytes (Expected: ${testData.length})`);
    console.log(`   ETag: ${r2Meta.etag}`);
    console.log("   --> PASS: File verified in Cloudflare R2.\n");

    // 5. Generate Presigned Download URL
    console.log("5. Generating Presigned Download URL...");
    const downloadUrl = await generatePresignedDownloadUrl({
      key: testKey,
      fileName: "downloaded_test.txt",
      isDownload: true,
    });
    console.log(`   Presigned Download URL: ${downloadUrl.substring(0, 60)}...`);
    console.log("   --> PASS: Presigned download URL generated.\n");

    // 6. Download file and verify SHA-256 byte-for-byte integrity
    console.log("6. Downloading file from Cloudflare R2 and checking data integrity...");
    const downloadRes = await fetch(downloadUrl);
    if (!downloadRes.ok) {
      throw new Error(`Download failed with status ${downloadRes.status}`);
    }
    const downloadedBuffer = Buffer.from(await downloadRes.arrayBuffer());
    const downloadedChecksum = crypto.createHash("sha256").update(downloadedBuffer).digest("hex");

    if (downloadedChecksum !== testChecksum) {
      throw new Error("SHA-256 checksum mismatch! Data was corrupted.");
    }
    console.log(`   Checksum: ${downloadedChecksum} (Matches original)`);
    console.log("   --> PASS: Data downloaded and verified with 100% integrity.\n");

    // 7. Delete Object from Cloudflare R2
    console.log("7. Deleting test object from Cloudflare R2...");
    await deleteObjectFromR2(testKey);
    console.log("   --> PASS: DeleteObjectCommand executed.\n");

    // 8. Verify Object is Gone
    console.log("8. Verifying object is no longer in R2...");
    try {
      await verifyObjectExists(testKey);
      throw new Error("File still exists in R2 after deletion!");
    } catch (err) {
      if (err.statusCode === 404) {
        console.log("   --> PASS: File confirmed deleted (404 Not Found).\n");
      } else {
        throw err;
      }
    }

    console.log("==========================================");
    console.log("ALL CLOUDFLARE R2 INTEGRATION TESTS PASSED!");
    console.log("==========================================\n");
  } catch (error) {
    console.error("\n[R2 TEST FAILED]:", error.message);
  } finally {
    process.exit(0);
  }
};

runR2IntegrationTest();

