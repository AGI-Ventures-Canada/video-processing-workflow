"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertTriangleIcon, ClockIcon } from "lucide-react"
import { VideoDetailModal } from "@/components/video-detail-modal"
import { getVideos } from "@/lib/video-storage"

export interface CategoryReason {
  category: string
  detected: boolean
  confidence: number
  reason: string
}

export interface FlaggedFrame {
  id: string
  timestamp: string
  confidence: number
  screenshot: string
  reason: string
  categories?: string // Comma-separated categories or single category
  rating?: "safe" | "16+" | "18+" // Content rating
  categoryReasons?: CategoryReason[] // Detailed reasons for each category
}

export interface FlaggedVideo {
  id: string
  title: string
  thumbnail: string
  uploadDate: string
  duration: string
  severity: "high" | "medium" | "low"
  flagCount: number
  flaggedFrames: FlaggedFrame[]
  status?: "flagged" | "approved" | "removed"
  overallRating?: "safe" | "16+" | "18+" // Overall video rating based on highest frame rating
}

interface VideoModerationGridProps {
  onRefreshNeeded?: (callback: () => void) => void
}

export function VideoModerationGrid({ onRefreshNeeded }: VideoModerationGridProps = {}) {
  const [selectedVideo, setSelectedVideo] = useState<FlaggedVideo | null>(null)
  const [videos, setVideos] = useState<FlaggedVideo[]>([])
  const [loading, setLoading] = useState(true)

  // Load videos from localStorage
  useEffect(() => {
    loadVideos()
  }, [])

  // Expose refresh function to parent
  useEffect(() => {
    onRefreshNeeded?.(loadVideos)
  }, [onRefreshNeeded])

  const loadVideos = () => {
    setLoading(true)
    try {
      const storedVideos = getVideos()
      setVideos(storedVideos)
    } catch (error) {
      console.error("Error loading videos from localStorage:", error)
    } finally {
      setLoading(false)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "bg-red-500/10 text-red-500 border-red-500/20"
      case "medium":
        return "bg-amber-500/10 text-amber-500 border-amber-500/20"
      case "low":
        return "bg-gray-500/10 text-gray-400 border-gray-500/20"
      default:
        return "bg-gray-500/10 text-gray-400 border-gray-500/20"
    }
  }

  return (
    <>
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading videos...</p>
        </div>
      ) : videos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertTriangleIcon className="size-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-foreground mb-2">No flagged videos</p>
          <p className="text-sm text-muted-foreground">
            Upload videos to start content moderation
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {videos.map((video) => (
          <Card
            key={video.id}
            className="group cursor-pointer overflow-hidden border-border bg-card hover:border-primary/50 transition-all duration-200"
            onClick={() => setSelectedVideo(video)}
          >
            <div className="relative aspect-video overflow-hidden bg-muted">
              <img
                src={video.thumbnail || "/placeholder.svg"}
                alt={video.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              />
              <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
                {video.duration}
              </div>
              <div className="absolute top-2 left-2 flex gap-2">
                <Badge variant="outline" className={getSeverityColor(video.severity)}>
                  <AlertTriangleIcon className="size-3 mr-1" />
                  {video.severity}
                </Badge>
                {video.overallRating && video.overallRating !== "safe" && (
                  <Badge
                    variant="outline"
                    className={
                      video.overallRating === "18+"
                        ? "bg-red-500/10 text-red-500 border-red-500/20"
                        : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                    }
                  >
                    {video.overallRating}
                  </Badge>
                )}
              </div>
            </div>
            <div className="p-4">
              <h3 className="font-semibold text-foreground mb-2 line-clamp-1">{video.title}</h3>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <ClockIcon className="size-3" />
                  <span>{video.uploadDate}</span>
                </div>
                <span className="text-xs">
                  {video.flagCount} flag{video.flagCount !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </Card>
          ))}
        </div>
      )}

      {selectedVideo && (
        <VideoDetailModal
          video={selectedVideo}
          open={!!selectedVideo}
          onOpenChange={(open) => !open && setSelectedVideo(null)}
          onVideoUpdated={loadVideos}
        />
      )}
    </>
  )
}
