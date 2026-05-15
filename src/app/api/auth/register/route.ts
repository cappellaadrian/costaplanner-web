import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const { email, password, name, company } = await req.json();

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "Email, contraseña y nombre son requeridos" },
        { status: 400 },
      );
    }

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Ya existe una cuenta con este correo" },
        { status: 409 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // First user globally becomes admin; this matches REVARA's behavior
    // since both apps share the same User table.
    const userCount = await db.user.count();
    const role = userCount === 0 ? "admin" : "editor";

    const user = await db.user.create({
      data: {
        email,
        name,
        passwordHash,
        company: company || "",
        role,
      },
    });

    return NextResponse.json(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Registro fallido",
      },
      { status: 500 },
    );
  }
}
