"use client"

import { VideoModerationGrid } from "@/components/video-moderation-grid"
import { Topbar } from "@/components/topbar"
import { useRef } from "react"

export default function Page() {
  const refreshVideosRef = useRef<(() => void) | null>(null)

  const handleVideoSaved = () => {
    // Refresh the video grid when a new video is uploaded
    refreshVideosRef.current?.()
  }

  return (
    <div className="min-h-screen bg-background">
      <Topbar onVideoSaved={handleVideoSaved} />
      <main>
        <div className="container mx-auto py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Flagged Videos</h1>
            <p className="text-muted-foreground">Review and moderate videos that have been flagged by the system</p>
          </div>
          <VideoModerationGrid
            onRefreshNeeded={(callback) => refreshVideosRef.current = callback}
          />
        </div>
      </main>
    </div>
  )
}
