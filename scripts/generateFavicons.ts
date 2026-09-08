import fs from "fs";
import path from "path";
import { createCanvas, Image } from "@napi-rs/canvas";

async function generateIcons() {
  const publicDir = path.resolve(process.cwd(), "public");
  const svgPath = path.join(publicDir, "favicon.svg");
  const svgBuffer = fs.readFileSync(svgPath);

  const img = new Image();
  img.src = svgBuffer;

  const sizes = [
    { name: "favicon-48x48.png", size: 48 },
    { name: "apple-touch-icon.png", size: 180 },
    { name: "icon-192.png", size: 192 },
    { name: "icon-512.png", size: 512 }
  ];

  for (const { name, size } of sizes) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, size, size);
    const pngBuffer = canvas.toBuffer("image/png");
    fs.writeFileSync(path.join(publicDir, name), pngBuffer);
    console.log(`Generated ${name} (${size}x${size})`);
  }

  // Also create favicon.ico as a copy of 48x48 png
  fs.copyFileSync(path.join(publicDir, "favicon-48x48.png"), path.join(publicDir, "favicon.ico"));
  console.log("Created favicon.ico");
}

generateIcons().catch(console.error);
