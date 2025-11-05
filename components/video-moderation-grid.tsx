"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertTriangleIcon, ClockIcon } from "lucide-react"
import { VideoDetailModal } from "@/components/video-detail-modal"

export interface FlaggedFrame {
  id: string
  timestamp: string
  confidence: number
  screenshot: string
  reason: string
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
}

const mockVideos: FlaggedVideo[] = [
  {
    id: "1",
    title: "User Upload - Video 001",
    thumbnail: "/video-thumbnail.png",
    uploadDate: "2025-01-15",
    duration: "5:32",
    severity: "high",
    flagCount: 8,
    flaggedFrames: [
      {
        id: "f1",
        timestamp: "0:45",
        confidence: 0.94,
        screenshot: "/flagged-frame.jpg",
        reason: "Inappropriate content detected",
      },
      {
        id: "f2",
        timestamp: "2:15",
        confidence: 0.89,
        screenshot: "/flagged-frame.jpg",
        reason: "Violence detected",
      },
      {
        id: "f3",
        timestamp: "3:42",
        confidence: 0.91,
        screenshot: "/flagged-frame.jpg",
        reason: "Inappropriate content detected",
      },
    ],
  },
  {
    id: "2",
    title: "User Upload - Video 002",
    thumbnail: "/video-thumbnail.png",
    uploadDate: "2025-01-14",
    duration: "3:18",
    severity: "medium",
    flagCount: 3,
    flaggedFrames: [
      {
        id: "f4",
        timestamp: "1:22",
        confidence: 0.76,
        screenshot: "/flagged-frame.jpg",
        reason: "Sensitive content detected",
      },
    ],
  },
  {
    id: "3",
    title: "User Upload - Video 003",
    thumbnail: "/video-thumbnail.png",
    uploadDate: "2025-01-13",
    duration: "8:45",
    severity: "low",
    flagCount: 2,
    flaggedFrames: [
      {
        id: "f5",
        timestamp: "4:30",
        confidence: 0.68,
        screenshot: "/flagged-frame.jpg",
        reason: "Potential policy violation",
      },
    ],
  },
  {
    id: "4",
    title: "User Upload - Video 004",
    thumbnail: "/video-thumbnail.png",
    uploadDate: "2025-01-12",
    duration: "6:20",
    severity: "high",
    flagCount: 12,
    flaggedFrames: [
      {
        id: "f6",
        timestamp: "0:15",
        confidence: 0.97,
        screenshot: "/flagged-frame.jpg",
        reason: "Explicit content detected",
      },
      {
        id: "f7",
        timestamp: "2:45",
        confidence: 0.93,
        screenshot: "/flagged-frame.jpg",
        reason: "Violence detected",
      },
    ],
  },
  {
    id: "5",
    title: "User Upload - Video 005",
    thumbnail: "/video-thumbnail.png",
    uploadDate: "2025-01-11",
    duration: "4:55",
    severity: "medium",
    flagCount: 5,
    flaggedFrames: [
      {
        id: "f8",
        timestamp: "1:30",
        confidence: 0.82,
        screenshot: "/flagged-frame.jpg",
        reason: "Sensitive content detected",
      },
    ],
  },
  {
    id: "6",
    title: "User Upload - Video 006",
    thumbnail: "/video-thumbnail.png",
    uploadDate: "2025-01-10",
    duration: "7:12",
    severity: "low",
    flagCount: 1,
    flaggedFrames: [
      {
        id: "f9",
        timestamp: "5:00",
        confidence: 0.65,
        screenshot: "/flagged-frame.jpg",
        reason: "Potential policy violation",
      },
    ],
  },
]

export function VideoModerationGrid() {
  const [selectedVideo, setSelectedVideo] = useState<FlaggedVideo | null>(null)

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockVideos.map((video) => (
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
              <div className="absolute top-2 left-2">
                <Badge variant="outline" className={getSeverityColor(video.severity)}>
                  <AlertTriangleIcon className="size-3 mr-1" />
                  {video.severity}
                </Badge>
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

      {selectedVideo && (
        <VideoDetailModal
          video={selectedVideo}
          open={!!selectedVideo}
          onOpenChange={(open) => !open && setSelectedVideo(null)}
        />
      )}
    </>
  )
}
