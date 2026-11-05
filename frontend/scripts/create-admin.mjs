import { createInterface } from "node:readline";
import nextEnv from "@next/env";
import bcrypt from "bcryptjs";
import pg from "pg";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const { Pool } = pg;

function ask(question) {
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    readline.question(question, (answer) => {
      readline.close();
      resolve(answer.trim());
    });
  });
}

function askHidden(question) {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    if (!input.isTTY || typeof input.setRawMode !== "function") {
      reject(new Error("Run this script in an interactive PowerShell terminal so the password can be hidden."));
      return;
    }

    let password = "";
    process.stdout.write(question);
    input.setRawMode(true);
    input.resume();

    const finish = (error) => {
      input.off("data", onData);
      input.setRawMode(false);
      input.pause();
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(password);
    };

    const onData = (chunk) => {
      const character = chunk.toString("utf8");
      if (character === "\u0003") {
        finish(new Error("Cancelled."));
      } else if (character === "\r" || character === "\n") {
        finish();
      } else if (character === "\u007f" || character === "\b") {
        password = password.slice(0, -1);
        process.stdout.write("\b \b");
      } else if (character >= " ") {
        password += character;
        process.stdout.write("*");
      }
    };

    input.on("data", onData);
  });
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL was not found. Run this command from the frontend directory and check frontend/.env.local.");
  }

  const fullName = await ask("Administrator full name: ");
  const email = (await ask("Administrator email: ")).toLowerCase();
  const password = await askHidden("Administrator password (minimum 12 characters; input hidden): ");
  const confirmation = await askHidden("Confirm password: ");

  if (fullName.length < 2 || fullName.length > 100) {
    throw new Error("Full name must be between 2 and 100 characters.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid email address.");
  }
  if (password.length < 12) {
    throw new Error("Use an administrator password with at least 12 characters.");
  }
  if (password !== confirmation) {
    throw new Error("Passwords do not match.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT user_id, role FROM users WHERE email = $1 FOR UPDATE`,
      [email]
    );

    if (existing.rows[0] && existing.rows[0].role !== "ADMIN") {
      throw new Error(
        `The email already belongs to a ${existing.rows[0].role} account. Use a new email; this script will not promote an existing patient or doctor.`
      );
    }

    let userId;
    if (existing.rows[0]) {
      userId = existing.rows[0].user_id;
      await client.query(
        `UPDATE users
         SET full_name = $1, password_hash = $2
         WHERE user_id = $3 AND role = 'ADMIN'`,
        [fullName, passwordHash, userId]
      );
      console.log("Existing administrator credentials updated.");
    } else {
      const inserted = await client.query(
        `INSERT INTO users (full_name, email, password_hash, role)
         VALUES ($1, $2, $3, 'ADMIN')
         RETURNING user_id`,
        [fullName, email, passwordHash]
      );
      userId = inserted.rows[0].user_id;
      console.log("Administrator account created.");
    }

    await client.query("COMMIT");
    console.log(`Admin email: ${email}`);
    console.log(`User ID: ${userId}`);
    console.log("Sign in at /login. The account will be redirected to /admin.");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Admin provisioning failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
