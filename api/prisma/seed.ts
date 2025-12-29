// Prisma Seed Script - Create Initial Test Data

import { PrismaClient, Tier, AdminRole } from '@prisma/client';
import { ApiKeyService } from '../src/services/auth/api-key.service.js';
import { Redis } from 'ioredis';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

/**
 * M-12: Generate a secure random password for seeded admin user
 * This ensures even in development, we don't use predictable passwords
 */
function generateSecurePassword(length: number = 20): string {
  // Character sets for strong password
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // No I, O to avoid confusion
  const lowercase = 'abcdefghjkmnpqrstuvwxyz'; // No i, l, o to avoid confusion
  const numbers = '23456789'; // No 0, 1 to avoid confusion
  const symbols = '!@#$%^&*';

  const allChars = uppercase + lowercase + numbers + symbols;

  // Ensure at least one of each character type
  let password = '';
  password += uppercase[crypto.randomInt(uppercase.length)];
  password += lowercase[crypto.randomInt(lowercase.length)];
  password += numbers[crypto.randomInt(numbers.length)];
  password += symbols[crypto.randomInt(symbols.length)];

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += allChars[crypto.randomInt(allChars.length)];
  }

  // Shuffle the password to randomize the position of guaranteed chars
  return password.split('').sort(() => crypto.randomInt(3) - 1).join('');
}

async function main() {
  console.log('🌱 Seeding database...');

  // Initialize Redis for API key service
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  });

  const apiKeyService = new ApiKeyService(redis);

  // Create test accounts for each tier
  const accounts = [
    {
      email: 'free@screencraft.dev',
      tier: Tier.FREE,
      monthlyCredits: 1000,
    },
    {
      email: 'pro@screencraft.dev',
      tier: Tier.PRO,
      monthlyCredits: 50000,
    },
    {
      email: 'business@screencraft.dev',
      tier: Tier.BUSINESS,
      monthlyCredits: 250000,
    },
    {
      email: 'enterprise@screencraft.dev',
      tier: Tier.ENTERPRISE,
      monthlyCredits: -1, // Unlimited
    },
  ];

  console.log('\n📊 Creating test accounts...');

  for (const accountData of accounts) {
    // Create account
    const account = await prisma.account.upsert({
      where: { email: accountData.email },
      update: {},
      create: accountData,
    });

    console.log(`✅ Created account: ${account.email} (${account.tier})`);

    // Create API key for each account
    const apiKey = await apiKeyService.createApiKey(
      account.id,
      `${account.tier} Test Key`,
      'test'
    );

    console.log(`   🔑 API Key: ${apiKey.key}`);
    console.log(`   📋 Prefix: ${apiKey.prefix}\n`);
  }

  // Create admin user
  console.log('\n👤 Creating admin user...');

  // M-12: Generate a secure random password instead of using a hardcoded one
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || generateSecurePassword();
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const adminUser = await prisma.adminUser.upsert({
    where: { email: 'admin@screencraft.dev' },
    update: {},
    create: {
      email: 'admin@screencraft.dev',
      passwordHash,
      name: 'Super Admin',
      role: AdminRole.SUPER_ADMIN,
      isActive: true,
    },
  });

  console.log(`✅ Created admin user: ${adminUser.email}`);
  console.log(`   🔐 Password: ${adminPassword}`);
  console.log(`   📋 Role: ${adminUser.role}\n`);

  console.log('✨ Seed completed!\n');
  console.log('You can now use these accounts to test the API:');
  console.log('- Use the API keys printed above');
  console.log('- Check accounts in Prisma Studio: npm run prisma:studio');
  console.log('\nAdmin Terminal Access:');
  console.log('- URL: http://localhost:3001/admin/login');
  console.log('- Email: admin@screencraft.dev');
  console.log(`- Password: ${adminPassword}\n`);

  await redis.quit();
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
