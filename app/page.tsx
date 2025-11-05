"use client"

import { VideoModerationGrid } from "@/components/video-moderation-grid"

export default function Page() {
  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Flagged Videos</h1>
          <p className="text-muted-foreground">Review and moderate videos that have been flagged by the system</p>
        </div>
        <VideoModerationGrid />
      </div>
    </main>
  )
}
