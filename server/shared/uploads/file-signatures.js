import { extname } from "node:path";

const signatures = {
  "application/pdf": {
    extensions: [".pdf"],
    matches: (buffer) => buffer.subarray(0, 5).equals(Buffer.from("%PDF-")),
  },
  "image/png": {
    extensions: [".png"],
    matches: (buffer) => buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  "image/jpeg": {
    extensions: [".jpg", ".jpeg"],
    matches: (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  },
  "image/webp": {
    extensions: [".webp"],
    matches: (buffer) => buffer.length >= 12
      && buffer.subarray(0, 4).toString("ascii") === "RIFF"
      && buffer.subarray(8, 12).toString("ascii") === "WEBP",
  },
};

export function hasValidFileSignature(file) {
  const rule = signatures[file.type];
  if (!rule) return false;
  return rule.extensions.includes(extname(file.filename).toLowerCase()) && rule.matches(file.buffer);
}
