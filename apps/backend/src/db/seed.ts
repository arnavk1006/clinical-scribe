import { db } from "./client";
import { patients, doctors, sessions, transcripts, transcriptChunks, notes } from "./schema";

async function main() {
  console.log("Seeding database...");

  console.log("Cleaning up old database records...");
  await db.delete(notes);
  await db.delete(transcriptChunks);
  await db.delete(transcripts);
  await db.delete(sessions);
  await db.delete(patients);
  await db.delete(doctors);

  const defaultPassword = "password123";
  const hashedPassword = await Bun.password.hash(defaultPassword);

  console.log("Creating default doctor Dr. Alice Smith...");
  const newDoctor = {
    id: "doc-1234",
    name: "Dr. Alice Smith",
    email: "alice.smith@hospital.org",
    passwordHash: hashedPassword,
    createdAt: new Date(),
  };
  await db.insert(doctors).values(newDoctor);

  console.log("Creating default patient John Doe...");
  const newPatient = {
    id: "pat-5678",
    name: "John Doe",
    email: "john.doe@gmail.com",
    passwordHash: hashedPassword,
    mrn: "MRN-987654",
    dateOfBirth: new Date("1980-05-15"),
    createdAt: new Date(),
  };
  await db.insert(patients).values(newPatient);

  console.log("Creating default session...");
  const newSession = {
    id: "session-12345678",
    patientId: newPatient.id,
    doctorId: newDoctor.id,
    status: "recording" as const,
    createdAt: new Date(),
  };
  await db.insert(sessions).values(newSession);

  console.log("Database seeded successfully!");
  console.log(`Created Doctor: ${newDoctor.email} (Password: ${defaultPassword})`);
  console.log(`Created Patient: ${newPatient.email} (Password: ${defaultPassword})`);
}

main().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
