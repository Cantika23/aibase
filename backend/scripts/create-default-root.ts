#!/usr/bin/env bun

/**
 * Create a default root user for development
 * Email: admin@example.com
 * Username: admin
 * Password: admin123
 */

import { UserStorage } from "../src/storage/user-storage";
import { TenantStorage } from "../src/storage/tenant-storage";

const userStorage = UserStorage.getInstance();
const tenantStorage = TenantStorage.getInstance();

async function createDefaultRoot() {
  try {
    // Initialize storage
    await tenantStorage.initialize();
    await userStorage.initialize();
    console.log("✓ Database initialized");

    // Create default tenant if none exists
    if (!tenantStorage.hasDefaultTenant()) {
      console.log("\n=== Creating Default Tenant ===");
      const tenant = await tenantStorage.create({
        name: "Default Tenant",
        domain: null,
      });
      console.log("✓ Default tenant created");
      console.log(`  ID: ${tenant.id}`);
      console.log(`  Name: ${tenant.name}`);
    }

    // Check if root user already exists
    if (userStorage.hasRootUser()) {
      console.log("\n⚠️  A root user already exists!");
      const rootUsers = userStorage.getByRole('root');
      console.log("\nExisting root users:");
      rootUsers.forEach(user => {
        console.log(`  - ${user.username} (${user.email})`);
      });
      process.exit(0);
    }

    console.log("\n=== Creating Default Root User ===");

    // Hash password
    const passwordHash = await Bun.password.hash("admin123", {
      algorithm: "bcrypt",
      cost: 10,
    });

    // Create root user
    const user = await userStorage.create({
      email: "admin@example.com",
      username: "admin",
      password_hash: passwordHash,
      role: "root",
    });

    console.log("\n✓ Root user created successfully!");
    console.log(`\n  Email: ${user.email}`);
    console.log(`  Username: ${user.username}`);
    console.log(`  Password: admin123`);
    console.log(`  Role: ${user.role}`);
    console.log(`\nYou can now login with these credentials.`);

    process.exit(0);
  } catch (error: any) {
    console.error("\n❌ Error creating root user:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

createDefaultRoot();
