import { Hono } from "hono";
import { promises as fs } from "fs";
import { join, resolve } from "path";

const app = new Hono();

const getUploadDir = () => {
  if (process.env.UPLOAD_DIR) {
    return resolve(process.cwd(), process.env.UPLOAD_DIR);
  }
  return "/tmp";
};

const UPLOAD_DIR = getUploadDir();

app.post("/", async (c) => {
  try {
    const body = await c.req.parseBody();
    const audioFile = body.file;

    if (!audioFile || !(audioFile instanceof File)) {
      return c.json({ error: "No audio file provided or invalid file format" }, 400);
    }

    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    const extension = audioFile.name?.split(".").pop() || "wav";
    const fileName = `${crypto.randomUUID()}.${extension}`;
    const filePath = join(UPLOAD_DIR, fileName);

    const arrayBuffer = await audioFile.arrayBuffer();
    await fs.writeFile(filePath, Buffer.from(arrayBuffer));

    const location = process.env.UPLOAD_DIR
      ? join(process.env.UPLOAD_DIR, fileName)
      : join("/tmp", fileName);

    return c.json({
      message: "File uploaded successfully",
      location: location,
    }, 201);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

export default app;
