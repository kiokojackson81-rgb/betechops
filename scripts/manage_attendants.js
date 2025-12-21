#!/usr/bin/env node
/*
  Script: manage_attendants.js
  Purpose: Create a new attendant and delete specified attendants using Prisma.

  Usage (from project root):
    # install deps if not present
    npm install bcryptjs dotenv @prisma/client

    # run (PowerShell):
    $env:DATABASE_URL = 'postgresql://USER:PASS@HOST:PORT/DB?schema=public'
    node .\scripts\manage_attendants.js

  NOTE: This script uses your configured Prisma schema. If your User model
  has different field names or enums for role/category, adapt the `createData`
  object below accordingly. The script is defensive and prints errors.
*/

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const prisma = new PrismaClient();

async function main() {
  // Requested create
  const createEmail = "justus@betech.co.ke";
  const createPassword = "justus@#2020";
  const createName = "Justus";
  // Use a category value close to your repo naming. If this fails,
  // adjust `attendantCategory` to one of your enum values.
  const attendantCategory = "SUPPORT_OPS"; // change if your schema uses a different value

  // Emails to delete
  const deleteEmails = [
    "attendant@betech.co.ke",
    "bstore3600@gmail.com",
  ];

  console.log("Connecting to database using DATABASE_URL from environment...");

  // Delete existing users by email
  for (const email of deleteEmails) {
    try {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (!existing) {
        console.log(`Not found, skipping delete: ${email}`);
        continue;
      }
      await prisma.user.delete({ where: { email } });
      console.log(`Deleted user: ${email}`);
    } catch (err) {
      console.error(`Failed to delete ${email}:`, err.message || err);
      console.error("If this is due to a schema mismatch (field name or table name), adjust the script accordingly.");
    }
  }

  // Create the new attendant
  try {
    const exists = await prisma.user.findUnique({ where: { email: createEmail } });
    if (exists) {
      console.log(`User already exists: ${createEmail}`);
    } else {
      const hashed = await bcrypt.hash(createPassword, 10);

      // Build create payload. Adjust keys if your schema differs.
      const createData = {
        email: createEmail,
        name: createName,
        password: hashed,
        // sensible defaults; update if your schema uses other column names
        role: "ATTENDANT",
        attendantCategory: attendantCategory,
        // optional: active / status fields. If your schema has `status` or `isActive` use that.
      };

      const user = await prisma.user.create({ data: createData });
      console.log(`Created user: ${user.email} (id=${user.id})`);
    }
  } catch (err) {
    console.error("Failed to create user:", err.message || err);
    console.error(
      "Common causes: your Prisma User model uses different field names or enums. Inspect schema.prisma and adapt `createData` accordingly."
    );
  }

  await prisma.$disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    prisma.$disconnect().finally(() => process.exit(1));
  });
