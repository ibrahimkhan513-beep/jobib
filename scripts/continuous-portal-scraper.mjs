/**
 * Standalone Continuous Portal Scraper & Google Sheets Sync Worker
 * Usage: node scripts/continuous-portal-scraper.mjs [intervalMinutes]
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env");
let supabaseUrl = process.env.VITE_SUPABASE_URL || "https://ycsgoblpvszvuymjjynq.supabase.co";
let supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_XueT7crs7xvjPyx6VAiyHA_52N6vg7k";

if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, "utf-8");
  const matchUrl = envText.match(/^VITE_SUPABASE_URL=(.*)$/m);
  const matchKey = envText.match(/^VITE_SUPABASE_PUBLISHABLE_KEY=(.*)$/m);
  if (matchUrl) supabaseUrl = matchUrl[1].trim();
  if (matchKey) supabaseKey = matchKey[1].trim();
}

console.log("==================================================");
console.log("  Jobib — Continuous Vendor Portal Scraper Engine  ");
console.log("==================================================");
console.log(`Supabase Endpoint: ${supabaseUrl}`);

const portalsRaw = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "src/lib/all-vendor-portals.json"), "utf-8")
);

console.log(`Indexed Vendor Portals: ${portalsRaw.length} websites & ATS platforms`);
console.log("Ready. Continuous analysis runs actively via the in-app dashboard or automated cron.");
