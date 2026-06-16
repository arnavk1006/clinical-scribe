import { Hono } from "hono";
import { db } from "../db/client";
import { doctors } from "../db/schema";
import { eq } from "drizzle-orm";

const app = new Hono();

app.get("/", async (c) => {
  try {
    const allDoctors = await db.query.doctors.findMany();
    return c.json(allDoctors);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.get("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const doctor = await db.query.doctors.findFirst({
      where: (doctors, { eq }) => eq(doctors.id, id),
    });
    if (!doctor) {
      return c.json({ error: "Doctor not found" }, 404);
    }
    return c.json(doctor);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const { name, email, password } = body;

    if (!name || !email) {
      return c.json({ error: "Name and email are required" }, 400);
    }

    let passwordHash = null;
    if (password) {
      passwordHash = await Bun.password.hash(password);
    }

    const doctorId = crypto.randomUUID();

    const doctorExists = await db.query.doctors.findFirst({
      where: (doctors, { eq }) => eq(doctors.id, doctorId),
    });
    if (doctorExists) {
      return c.json({ error: "Doctor with given ID already exists" }, 409);
    }

    const newDoctor = {
      id: doctorId,
      name,
      email,
      passwordHash,
      createdAt: new Date(),
    };

    await db.insert(doctors).values(newDoctor);

    const { passwordHash: _, ...doctorResponse } = newDoctor;
    return c.json(doctorResponse, 201);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.patch("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const body = await c.req.json();
    const { name, email, password } = body;

    const existing = await db.query.doctors.findFirst({
      where: (doctors, { eq }) => eq(doctors.id, id),
    });
    if (!existing) {
      return c.json({ error: "Doctor not found" }, 404);
    }

    const updates: Partial<typeof doctors.$inferInsert> = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (password !== undefined) {
      updates.passwordHash = password ? await Bun.password.hash(password) : null;
    }

    if (Object.keys(updates).length === 0) {
      return c.json({ message: "No updates provided" });
    }

    await db.update(doctors).set(updates).where(eq(doctors.id, id));

    const updatedResult = await db.query.doctors.findFirst({
      where: (doctors, { eq }) => eq(doctors.id, id),
    });
    if (!updatedResult) {
      return c.json({ error: "Doctor not found" }, 404);
    }
    const { passwordHash: _, ...doctorResponse } = updatedResult;
    return c.json(doctorResponse);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.delete("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const existing = await db.query.doctors.findFirst({
      where: (doctors, { eq }) => eq(doctors.id, id),
    });
    if (!existing) {
      return c.json({ error: "Doctor not found" }, 404);
    }

    await db.delete(doctors).where(eq(doctors.id, id));
    return c.json({ message: "Doctor deleted successfully" });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

export default app;
