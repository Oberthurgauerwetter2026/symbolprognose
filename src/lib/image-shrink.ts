/** Verkleinert ein Foto im Browser auf max. 1000 px und liefert JPEG-Base64 (ohne Präfix). */
export async function shrinkImage(file: File, max = 1000, q = 0.72): Promise<string> {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", q).split(",")[1];
}
