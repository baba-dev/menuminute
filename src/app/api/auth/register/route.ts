import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { serializeError } from "@/lib/errors";

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as unknown;
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", fields: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const { name, email, password } = parsed.data;
    const db = getDb();

    // Check if email already exists
    const existing = db.select({ id: users.id }).from(users).where(eq(users.email, email)).get();

    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const id = nanoid();

    db.insert(users)
      .values({
        id,
        email,
        name,
        passwordHash,
        role: "user",
      })
      .run();

    return NextResponse.json(
      { message: "Account created successfully", userId: id },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json(serializeError(err), { status: 500 });
  }
}
