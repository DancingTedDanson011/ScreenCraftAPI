/**
 * Example script to test Storage and Cache services
 *
 * Prerequisites:
 * - Docker services running (npm run docker:up)
 * - Environment variables configured
 *
 * Run with: tsx src/services/examples/test-services.ts
 */

import { storageService, cacheService } from '../index.js';

async function testStorageService() {
  console.log('\n=== Testing StorageService ===\n');

  try {
    // Initialize storage (creates bucket if needed)
    console.log('1. Initializing storage...');
    await storageService.initialize();
    console.log('   ✓ Storage initialized');

    // Upload a test file
    console.log('\n2. Uploading test file...');
    const testData = Buffer.from('Hello from ScreenCraft!');
    const key = storageService.generateScreenshotKey('test-user', 'test.txt');
    await storageService.upload(key, testData, 'text/plain', {
      'x-test-header': 'test-value',
    });
    console.log(`   ✓ File uploaded: ${key}`);

    // Check if file exists
    console.log('\n3. Checking if file exists...');
    const exists = await storageService.exists(key);
    console.log(`   ✓ File exists: ${exists}`);

    // Generate signed URL
    console.log('\n4. Generating signed URL...');
    const signedUrl = await storageService.getSignedUrl(key, 3600);
    console.log(`   ✓ Signed URL (1 hour): ${signedUrl.substring(0, 80)}...`);

    // Download file
    console.log('\n5. Downloading file...');
    const downloaded = await storageService.download(key);
    console.log(`   ✓ Downloaded ${downloaded.length} bytes`);
    console.log(`   ✓ Content: ${downloaded.toString()}`);

    // Delete file
    console.log('\n6. Deleting file...');
    await storageService.delete(key);
    console.log('   ✓ File deleted');

    // Verify deletion
    const existsAfterDelete = await storageService.exists(key);
    console.log(`   ✓ File exists after delete: ${existsAfterDelete}`);

    console.log('\n✓ All storage tests passed!\n');
  } catch (error) {
    console.error('\n✗ Storage test failed:', error);
    throw error;
  }
}

async function testCacheService() {
  console.log('\n=== Testing CacheService ===\n');

  try {
    // Health check
    console.log('1. Health check...');
    const healthy = await cacheService.healthCheck();
    console.log(`   ✓ Redis healthy: ${healthy}`);

    // Set and get basic value
    console.log('\n2. Testing basic set/get...');
    await cacheService.set('test:key', { message: 'Hello Redis!' }, 60);
    const value = await cacheService.get<{ message: string }>('test:key');
    console.log(`   ✓ Value retrieved: ${value?.message}`);

    // Test TTL
    console.log('\n3. Testing TTL...');
    const ttl = await cacheService.getTTL('test:key');
    console.log(`   ✓ TTL: ${ttl} seconds`);

    // Test screenshot cache key generation
    console.log('\n4. Testing screenshot cache key...');
    const screenshotKey = cacheService.generateScreenshotCacheKey(
      'https://example.com',
      {
        width: 1920,
        height: 1080,
        fullPage: true,
        format: 'png',
      }
    );
    console.log(`   ✓ Cache key: ${screenshotKey}`);

    // Test API key caching
    console.log('\n5. Testing API key cache...');
    const apiKeyHash = 'test-hash-123';
    await cacheService.cacheApiKey(apiKeyHash, {
      id: 'key-001',
      userId: 'user-123',
      name: 'Test API Key',
      tier: 'pro',
      rateLimit: 1000,
      createdAt: new Date(),
    }, 300); // 5 minutes
    const cachedApiKey = await cacheService.getApiKey(apiKeyHash);
    console.log(`   ✓ API Key cached: ${cachedApiKey?.name}`);

    // Test rate limiting
    console.log('\n6. Testing rate limiting...');
    const identifier = 'test-user-123';
    const count1 = await cacheService.incrementRateLimit(identifier, 900);
    const count2 = await cacheService.incrementRateLimit(identifier, 900);
    const count3 = await cacheService.incrementRateLimit(identifier, 900);
    console.log(`   ✓ Rate limit counts: ${count1}, ${count2}, ${count3}`);

    // Test pattern deletion
    console.log('\n7. Testing pattern deletion...');
    await cacheService.set('test:pattern:1', 'value1');
    await cacheService.set('test:pattern:2', 'value2');
    await cacheService.set('test:pattern:3', 'value3');
    const deleted = await cacheService.deletePattern('test:pattern:*');
    console.log(`   ✓ Deleted ${deleted} keys matching pattern`);

    // Cleanup
    console.log('\n8. Cleanup...');
    await cacheService.delete('test:key');
    await cacheService.invalidateApiKey(apiKeyHash);
    console.log('   ✓ Test data cleaned up');

    console.log('\n✓ All cache tests passed!\n');
  } catch (error) {
    console.error('\n✗ Cache test failed:', error);
    throw error;
  }
}

async function testIntegration() {
  console.log('\n=== Testing Storage + Cache Integration ===\n');

  try {
    const url = 'https://example.com';
    const options = { width: 1920, height: 1080, fullPage: true };

    // Generate cache key
    const cacheKey = cacheService.generateScreenshotCacheKey(url, options);
    console.log(`1. Cache key: ${cacheKey}`);

    // Simulate screenshot not in cache
    const cached = await cacheService.get(cacheKey);
    if (!cached) {
      console.log('   ✓ Cache miss (expected)');

      // "Generate" screenshot (mock data)
      const screenshot = Buffer.from('fake-screenshot-data');

      // Upload to storage
      const storageKey = storageService.generateScreenshotKey('user-123', 'example-com.png');
      await storageService.upload(screenshot, storageKey, 'image/png');
      console.log(`   ✓ Uploaded to storage: ${storageKey}`);

      // Get signed URL
      const signedUrl = await storageService.getSignedUrl(storageKey, 3600);

      // Cache the signed URL
      await cacheService.set(cacheKey, { url: signedUrl, storageKey }, 3600);
      console.log('   ✓ Cached signed URL');

      // Cleanup
      await storageService.delete(storageKey);
      await cacheService.delete(cacheKey);
      console.log('   ✓ Cleaned up');
    }

    console.log('\n✓ Integration test passed!\n');
  } catch (error) {
    console.error('\n✗ Integration test failed:', error);
    throw error;
  }
}

async function main() {
  console.log('ScreenCraft Services Test Suite');
  console.log('================================\n');

  try {
    await testStorageService();
    await testCacheService();
    await testIntegration();

    console.log('✓ All tests completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Tests failed:', error);
    process.exit(1);
  } finally {
    // Close connections
    await cacheService.close();
  }
}

main();
