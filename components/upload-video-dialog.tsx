"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  UploadIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  Loader2Icon,
} from "lucide-react";
import { useState, useRef } from "react";

interface UploadVideoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type UploadState = "idle" | "uploading" | "processing" | "success" | "error";

interface Incident {
  timestamp: number;
  confidence: number;
  categories: string;
  screenshotUrl: string;
}

interface UploadResult {
  incidents: Incident[];
  totalFrames: number;
  processedAt: string;
}

export function UploadVideoDialog({
  open,
  onOpenChange,
}: UploadVideoDialogProps) {
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadState("idle");
      setUploadResult(null);
      setErrorMessage("");
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith("video/")) {
        setSelectedFile(file);
        setUploadState("idle");
        setUploadResult(null);
        setErrorMessage("");
      } else {
        setErrorMessage("Please select a video file");
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      setUploadState("uploading");
      setProgress(5);

      const formData = new FormData();
      formData.append("video", selectedFile);

      console.log("[UPLOAD] Sending request to /api/upload-video");
      const response = await fetch("/api/upload-video", {
        method: "POST",
        body: formData,
      });

      console.log("[UPLOAD] Response status:", response.status);
      console.log("[UPLOAD] Response headers:", Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      // Read the stream
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      console.log("[UPLOAD] Starting to read stream...");
      const decoder = new TextDecoder();
      let buffer = "";
      let chunkCount = 0;

      while (true) {
        const { done, value } = await reader.read();

        if (value) {
          chunkCount++;
          console.log(`[UPLOAD] Received chunk ${chunkCount}, size: ${value.length} bytes`);
        }

        if (done) {
          console.log("[UPLOAD] Stream complete, total chunks:", chunkCount);
          break;
        }

        // Decode the chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete lines
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        console.log(`[UPLOAD] Processing ${lines.length} lines`);

        for (const line of lines) {
          if (!line.trim()) {
            console.log("[UPLOAD] Skipping empty line");
            continue;
          }

          console.log("[UPLOAD] Parsing line:", line);
          try {
            const update = JSON.parse(line);
            console.log("[UPLOAD] Stream update:", update);

            if (update.type === "progress") {
              setProgress(update.percent);
              if (update.step === "uploaded") {
                setUploadState("processing");
              }
            } else if (update.type === "frameProcessed") {
              setProgress(update.percent);
              setUploadState("processing");
            } else if (update.type === "complete") {
              setProgress(100);
              setUploadResult(update.result);
              setUploadState("success");
            } else if (update.type === "error") {
              setUploadState("error");
              setErrorMessage(update.message);
            }
          } catch (e) {
            console.error("Error parsing stream update:", e, line);
          }
        }
      }
    } catch (error) {
      console.error("Upload error:", error);
      setUploadState("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Upload failed"
      );
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset state after dialog closes
    setTimeout(() => {
      setUploadState("idle");
      setProgress(0);
      setSelectedFile(null);
      setUploadResult(null);
      setErrorMessage("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }, 200);
  };

  const formatTimestamp = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl w-[calc(100vw-2rem)] overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>Upload Video for Moderation</DialogTitle>
          <DialogDescription>
            Upload a video to scan for inappropriate content. We'll analyze
            frames and flag any issues.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 overflow-x-hidden">
          {/* File Selection */}
          {uploadState === "idle" && (
            <div className="space-y-4">
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50"
                }`}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="video-upload"
                />
                <label
                  htmlFor="video-upload"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <UploadIcon className="size-12 text-muted-foreground" />
                  <div className="text-sm">
                    <span className="text-primary font-medium">
                      Click to upload
                    </span>{" "}
                    or drag and drop
                  </div>
                  <div className="text-xs text-muted-foreground">
                    MP4, WebM, or other video formats
                  </div>
                </label>
              </div>

              {selectedFile && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-muted rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <Button onClick={handleUpload} className="sm:shrink-0 w-full sm:w-auto">
                    Start Processing
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Upload/Processing Progress */}
          {(uploadState === "uploading" || uploadState === "processing") && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Loader2Icon className="size-5 animate-spin text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {uploadState === "uploading"
                      ? "Uploading video..."
                      : "Processing video frames..."}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    This may take a few minutes
                  </p>
                </div>
              </div>
              <Progress value={progress} />
            </div>
          )}

          {/* Success - Show Results */}
          {uploadState === "success" && uploadResult && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircleIcon className="size-5" />
                <span className="font-medium">Processing Complete</span>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Frames Analyzed
                  </p>
                  <p className="text-lg font-semibold">
                    {uploadResult.totalFrames}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Incidents Found
                  </p>
                  <p className="text-lg font-semibold">
                    {uploadResult.incidents.length}
                  </p>
                </div>
              </div>

              {uploadResult.incidents.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Flagged Incidents</h4>
                  <ScrollArea className="h-[300px] rounded-lg border">
                    <div className="p-4 space-y-3">
                      {uploadResult.incidents.map((incident, index) => (
                        <div
                          key={index}
                          className="flex gap-4 p-3 bg-muted rounded-lg"
                        >
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <AlertTriangleIcon className="size-4 text-amber-500" />
                              <span className="text-sm font-medium">
                                {formatTimestamp(incident.timestamp)}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {(incident.confidence * 100).toFixed(0)}%
                                confidence
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Category: {incident.categories}
                            </p>
                          </div>
                          {incident.screenshotUrl && (
                            <div className="size-20 bg-background rounded overflow-hidden">
                              <img
                                src={incident.screenshotUrl}
                                alt={`Frame at ${formatTimestamp(incident.timestamp)}`}
                                className="size-full object-cover"
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button onClick={handleClose}>Close</Button>
              </div>
            </div>
          )}

          {/* Error State */}
          {uploadState === "error" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangleIcon className="size-5" />
                <span className="font-medium">Upload Failed</span>
              </div>
              <p className="text-sm text-muted-foreground">{errorMessage}</p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    setUploadState("idle");
                    setErrorMessage("");
                  }}
                >
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
