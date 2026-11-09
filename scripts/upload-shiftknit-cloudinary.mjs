import { v2 as cloudinary } from "cloudinary";
import { readdir } from "node:fs/promises";
import path from "node:path";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const dir = path.resolve("public/images/shiftknit");
const files = (await readdir(dir)).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
const results = {};

for (const file of files) {
  const publicId = `shiftshappn/shiftknit/${path.parse(file).name}`;
  const result = await cloudinary.uploader.upload(path.join(dir, file), {
    public_id: publicId,
    overwrite: true,
    invalidate: true,
    resource_type: "image",
  });
  results[file] = {
    public_id: result.public_id,
    format: result.format,
    bytes: result.bytes,
    width: result.width,
    height: result.height,
  };
  console.log(file, "->", result.public_id, `${result.width}x${result.height}`, `${result.bytes}b`);
}

console.log(JSON.stringify(results, null, 2));
