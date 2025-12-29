/**
 * Seed Admin User
 * Run with: npx tsx prisma/seed-admin.ts
 */

import { PrismaClient, AdminRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL || 'admin@example.com';
  const password = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
  const name = process.env.ADMIN_NAME || 'Super Admin';

  // Warn if using default credentials
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
    console.warn('WARNING: Using default admin credentials. Set ADMIN_EMAIL and ADMIN_PASSWORD environment variables for production!');
  }

  // Hash password with bcrypt (12 rounds)
  const passwordHash = await bcrypt.hash(password, 12);

  // Check if admin already exists
  const existing = await prisma.adminUser.findUnique({
    where: { email },
  });

  if (existing) {
    console.log(`Admin user ${email} already exists. Updating password...`);
    await prisma.adminUser.update({
      where: { email },
      data: { passwordHash },
    });
    console.log('Password updated successfully!');
  } else {
    // Create new admin user
    const admin = await prisma.adminUser.create({
      data: {
        email,
        name,
        passwordHash,
        role: AdminRole.SUPER_ADMIN,
        isActive: true,
      },
    });
    console.log(`Created admin user: ${admin.email} (${admin.role})`);
  }

  console.log('\n--- Admin Login Credentials ---');
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
  console.log(`Role: SUPER_ADMIN`);
  console.log('-------------------------------\n');
}

main()
  .catch((e) => {
    console.error('Error seeding admin:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
