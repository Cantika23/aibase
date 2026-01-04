/**
 * Admin Setup API handlers
 * Handles initial app configuration without requiring authentication
 * Uses OPENAI_API_KEY as license key verification
 */

import { writeFile, readFile } from "fs/promises";
import { existsSync } from "fs";
import { createLogger } from "../utils/logger";

const logger = createLogger("Setup");

const SETUP_FILE = "./data/setup.json";

interface SetupConfig {
  appName: string;
  logoPath?: string;
  updatedAt: number;
}

interface VerifyLicenseRequest {
  licenseKey: string;
}

interface UpdateSetupRequest {
  licenseKey: string;
  appName?: string;
  logo?: File;
}

/**
 * Verify license key (OPENAI_API_KEY from env)
 */
export async function handleVerifyLicense(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as VerifyLicenseRequest;
    const { licenseKey } = body;

    if (!licenseKey) {
      return Response.json({ success: false, error: "License key is required" }, { status: 400 });
    }

    // Verify against OPENAI_API_KEY from environment
    const envApiKey = process.env.OPENAI_API_KEY;

    if (!envApiKey) {
      logger.error("OPENAI_API_KEY not configured in environment");
      return Response.json({ success: false, error: "Server configuration error" }, { status: 500 });
    }

    if (licenseKey !== envApiKey) {
      logger.warn({ attempt: licenseKey?.substring(0, 10) + "..." }, "Invalid license key attempt");
      return Response.json({ success: false, error: "Invalid license key" }, { status: 401 });
    }

    logger.info("License key verified successfully");
    return Response.json({ success: true });
  } catch (error) {
    logger.error({ error }, "Error verifying license key");
    return Response.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Get current setup configuration
 */
export async function handleGetSetup(req: Request): Promise<Response> {
  try {
    if (!existsSync(SETUP_FILE)) {
      return Response.json({
        success: true,
        setup: null,
      });
    }

    const data = await readFile(SETUP_FILE, "utf-8");
    const setup = JSON.parse(data) as SetupConfig;

    return Response.json({
      success: true,
      setup: {
        appName: setup.appName,
        hasLogo: !!setup.logoPath,
        updatedAt: setup.updatedAt,
      },
    });
  } catch (error) {
    logger.error({ error }, "Error getting setup");
    return Response.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Update setup configuration
 */
export async function handleUpdateSetup(req: Request): Promise<Response> {
  try {
    const contentType = req.headers.get("content-type") || "";

    let licenseKey: string;
    let appName: string | undefined;
    let logo: File | null = null;

    // Handle multipart form data (for logo upload)
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      licenseKey = formData.get("licenseKey") as string;
      appName = formData.get("appName") as string | undefined;
      const logoFile = formData.get("logo") as File | null;

      if (!logoFile || logoFile.size === 0) {
        logo = null;
      } else {
        logo = logoFile;
      }
    } else {
      // Handle JSON request
      const body = (await req.json()) as UpdateSetupRequest;
      licenseKey = body.licenseKey;
      appName = body.appName;
    }

    // Verify license key
    const envApiKey = process.env.OPENAI_API_KEY;
    if (!licenseKey || licenseKey !== envApiKey) {
      return Response.json({ success: false, error: "Invalid license key" }, { status: 401 });
    }

    // Read existing setup or create new
    let setup: SetupConfig = {
      appName: "",
      updatedAt: Date.now(),
    };

    if (existsSync(SETUP_FILE)) {
      const data = await readFile(SETUP_FILE, "utf-8");
      setup = JSON.parse(data);
    }

    // Update app name if provided
    if (appName !== undefined) {
      setup.appName = appName;
    }

    // Handle logo upload
    if (logo) {
      const logoPath = "./data/logo.png";
      const buffer = await logo.arrayBuffer();
      await writeFile(logoPath, Buffer.from(buffer));
      setup.logoPath = logoPath;
      logger.info("Logo uploaded successfully");
    }

    setup.updatedAt = Date.now();

    // Save setup
    await writeFile(SETUP_FILE, JSON.stringify(setup, null, 2));

    logger.info({ appName: setup.appName, hasLogo: !!setup.logoPath }, "Setup updated successfully");

    return Response.json({
      success: true,
      setup: {
        appName: setup.appName,
        hasLogo: !!setup.logoPath,
        updatedAt: setup.updatedAt,
      },
    });
  } catch (error) {
    logger.error({ error }, "Error updating setup");
    return Response.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Serve logo file
 */
export async function handleGetLogo(req: Request): Promise<Response> {
  try {
    const logoPath = "./data/logo.png";

    if (!existsSync(logoPath)) {
      return Response.json({ error: "Logo not found" }, { status: 404 });
    }

    const file = Bun.file(logoPath);
    return new Response(file);
  } catch (error) {
    logger.error({ error }, "Error serving logo");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Public endpoint to get setup configuration (no auth required)
 */
export async function handleGetPublicSetup(req: Request): Promise<Response> {
  try {
    if (!existsSync(SETUP_FILE)) {
      return Response.json({
        success: true,
        setup: {
          appName: null,
          hasLogo: false,
        },
      });
    }

    const data = await readFile(SETUP_FILE, "utf-8");
    const setup = JSON.parse(data) as SetupConfig;

    return Response.json({
      success: true,
      setup: {
        appName: setup.appName || null,
        hasLogo: !!setup.logoPath,
      },
    });
  } catch (error) {
    logger.error({ error }, "Error getting public setup");
    return Response.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
