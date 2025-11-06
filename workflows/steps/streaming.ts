export async function writeProgress(writable: WritableStream, data: any) {
  "use step";

  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  try {
    const message = JSON.stringify(data) + "\n";
    console.log("[STREAM] Writing:", message.trim());
    await writer.write(encoder.encode(message));
  } finally {
    writer.releaseLock();
  }
}
