import { Hono } from "hono";
import { db } from "../db/client";
import { patients } from "../db/schema";
import { eq } from "drizzle-orm";
import type { NewPatient } from "../types";

const app = new Hono();

app.get("/", async (c) => {
  try {
    const allPatients = await db.query.patients.findMany();
    return c.json(allPatients);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.get("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const patient = await db.query.patients.findFirst({
      where: (patients, { eq }) => eq(patients.id, id),
    });
    if (!patient) {
      return c.json({ error: "Patient not found" }, 404);
    }
    return c.json(patient);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const { name, email, password, mrn, dateOfBirth } = body;

    if (!name || !email) {
      return c.json({ error: "Name and email are required" }, 400);
    }

    let passwordHash = null;
    if (password) {
      passwordHash = await Bun.password.hash(password);
    }

    const patientId = crypto.randomUUID();

    const patientExists = await db.query.patients.findFirst({
      where: (patients, { eq }) => eq(patients.id, patientId),
    });
    if (patientExists) {
      return c.json({ error: "Patient with given ID already exists" }, 409);
    }

    const newPatient = {
      id: patientId,
      name,
      email,
      passwordHash,
      mrn: mrn || null,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      createdAt: new Date(),
    };

    await db.insert(patients).values(newPatient);

    const { passwordHash: _, ...patientResponse } = newPatient;
    return c.json(patientResponse, 201);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.patch("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const body = await c.req.json();
    const { name, email, password, mrn, dateOfBirth } = body;

    const existing = await db.query.patients.findFirst({
      where: (patients, { eq }) => eq(patients.id, id),
    });
    if (!existing) {
      return c.json({ error: "Patient not found" }, 404);
    }

    const updates: Partial<NewPatient> = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (mrn !== undefined) updates.mrn = mrn || null;
    if (dateOfBirth !== undefined)
      updates.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
    if (password !== undefined) {
      updates.passwordHash = password
        ? await Bun.password.hash(password)
        : null;
    }

    if (Object.keys(updates).length === 0) {
      return c.json({ message: "No updates provided" });
    }

    await db.update(patients).set(updates).where(eq(patients.id, id));

    const updatedResult = await db.query.patients.findFirst({
      where: (patients, { eq }) => eq(patients.id, id),
    });
    if (!updatedResult) {
      return c.json({ error: "Patient not found" }, 404);
    }
    const { passwordHash: _, ...patientResponse } = updatedResult;
    return c.json(patientResponse);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.delete("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const existing = await db.query.patients.findFirst({
      where: (patients, { eq }) => eq(patients.id, id),
    });
    if (!existing) {
      return c.json({ error: "Patient not found" }, 404);
    }

    await db.delete(patients).where(eq(patients.id, id));
    return c.json({ message: "Patient deleted successfully" });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

export default app;
