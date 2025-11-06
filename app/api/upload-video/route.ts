import { start } from "workflow/api";
import { processVideoUpload } from "@/workflows/process-video";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes

export async function POST(request: Request) {
  try {
    // Get the form data
    const formData = await request.formData();
    const file = formData.get("video") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No video file provided" },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(
      `Received video upload: ${file.name}, size: ${buffer.length} bytes`
    );

    // Start the workflow asynchronously
    const workflowRun = await start(processVideoUpload, [buffer, file.name]);

    // Get the readable stream from the workflow (use .readable property)
    const stream = workflowRun.readable;

    // Return the stream to the client
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error processing upload:", error);
    return NextResponse.json(
      { error: "Failed to process video upload" },
      { status: 500 }
    );
  }
}
