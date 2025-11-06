"use client";

import { Button } from "@/components/ui/button";
import { UploadIcon } from "lucide-react";
import { UploadVideoDialog } from "./upload-video-dialog";
import { useState } from "react";

interface TopbarProps {
  onVideoSaved?: () => void;
}

export function Topbar({ onVideoSaved }: TopbarProps) {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  return (
    <>
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-lg font-semibold">Video Moderation</h1>
          </div>

          <div className="flex items-center gap-4">
            <Button
              onClick={() => setUploadDialogOpen(true)}
              className="gap-2"
            >
              <UploadIcon className="size-4" />
              Upload Video
            </Button>
          </div>
        </div>
      </div>

      <UploadVideoDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onVideoSaved={onVideoSaved}
      />
    </>
  );
}
