#!/usr/bin/env bun

/**
 * CLI script to create the initial root user
 * Usage: bun run scripts/create-root-user.ts
 */

import { UserStorage } from "../src/storage/user-storage";
import { AuthService } from "../src/services/auth-service";
import { TenantStorage } from "../src/storage/tenant-storage";

// Initialize services
const userStorage = UserStorage.getInstance();
const authService = AuthService.getInstance();
const tenantStorage = TenantStorage.getInstance();

async function createRootUser() {
  try {
    // Initialize storage
    await tenantStorage.initialize();
    await userStorage.initialize();
    console.log("✓ Database initialized");

    // Create default tenant if none exists
    if (!tenantStorage.hasDefaultTenant()) {
      console.log("\n=== Creating Default Tenant ===\n");
      const tenantName = prompt("Tenant name (default: 'Default Tenant'): ") || "Default Tenant";
      const tenantDomain = prompt("Domain (optional, press Enter to skip): ") || null;

      const tenant = await tenantStorage.create({
        name: tenantName,
        domain: tenantDomain,
      });

      console.log("✓ Default tenant created");
      console.log(`  ID: ${tenant.id}`);
      console.log(`  Name: ${tenant.name}`);
      if (tenant.domain) {
        console.log(`  Domain: ${tenant.domain}`);
      }
    }

    // Check if root user already exists
    if (userStorage.hasRootUser()) {
      console.log("\n⚠️  A root user already exists!");
      console.log("If you want to create a new root user, you need to manually delete the existing one from the database.");
      process.exit(1);
    }

    console.log("\n=== Create Root User ===\n");

    // Prompt for user details
    const email = prompt("Email: ");
    if (!email || !email.includes("@")) {
      console.error("❌ Invalid email address");
      process.exit(1);
    }

    const username = prompt("Username: ");
    if (!username || username.length < 3) {
      console.error("❌ Username must be at least 3 characters");
      process.exit(1);
    }

    const password = prompt("Password (min 8 characters): ");
    if (!password || password.length < 8) {
      console.error("❌ Password must be at least 8 characters");
      process.exit(1);
    }

    const confirmPassword = prompt("Confirm password: ");
    if (password !== confirmPassword) {
      console.error("❌ Passwords do not match");
      process.exit(1);
    }

    // Hash password
    const passwordHash = await Bun.password.hash(password, {
      algorithm: "bcrypt",
      cost: 10,
    });

    // Create root user directly in storage
    const user = await userStorage.create({
      email,
      username,
      password_hash: passwordHash,
      role: "root",
    });

    console.log("\n✓ Root user created successfully!");
    console.log(`\n  ID: ${user.id}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Username: ${user.username}`);
    console.log(`  Role: ${user.role}`);
    console.log(`\nYou can now login with these credentials.`);

    process.exit(0);
  } catch (error: any) {
    console.error("\n❌ Error creating root user:", error.message);
    process.exit(1);
  }
}

// Run the script
createRootUser();
