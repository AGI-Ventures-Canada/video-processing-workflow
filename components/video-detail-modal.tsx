"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { AlertTriangleIcon, ClockIcon, CheckCircleIcon, XCircleIcon } from "lucide-react"
import type { FlaggedVideo } from "./video-moderation-grid"

interface VideoDetailModalProps {
  video: FlaggedVideo
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function VideoDetailModal({ video, open, onOpenChange }: VideoDetailModalProps) {
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl mb-2">{video.title}</DialogTitle>
              <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                <div className="flex items-center gap-1">
                  <ClockIcon className="size-3" />
                  <span>{video.uploadDate}</span>
                </div>
                <span>•</span>
                <span>{video.duration}</span>
                <span>•</span>
                <span>
                  {video.flagCount} flag{video.flagCount !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
            <Badge variant="outline" className={getSeverityColor(video.severity)}>
              <AlertTriangleIcon className="size-3 mr-1" />
              {video.severity}
            </Badge>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6 h-[calc(90vh-200px)] overflow-auto">
          <div className="space-y-6 pr-4">
            {/* Video Preview */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Video Preview</h3>
              <div className="relative aspect-video overflow-hidden rounded-lg bg-muted border border-border">
                <img
                  src={video.thumbnail || "/placeholder.svg"}
                  alt={video.title}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Flagged Frames */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">
                Flagged Frames ({video.flaggedFrames.length})
              </h3>
              <div className="space-y-4">
                {video.flaggedFrames.map((frame) => (
                  <div key={frame.id} className="flex gap-4 p-4 rounded-lg border border-border bg-card">
                    <div className="relative w-32 h-18 flex-shrink-0 overflow-hidden rounded bg-muted border border-border">
                      <img
                        src={frame.screenshot || "/placeholder.svg"}
                        alt={`Frame at ${frame.timestamp}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="text-sm font-medium text-foreground mb-1">{frame.reason}</div>
                          <div className="text-xs text-muted-foreground">Timestamp: {frame.timestamp}</div>
                        </div>
                        <Badge
                          variant="outline"
                          className="bg-primary/10 text-primary border-primary/20 whitespace-nowrap"
                        >
                          {Math.round(frame.confidence * 100)}% confidence
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border -mx-6 px-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button variant="outline" className="text-red-500 hover:text-red-600 bg-transparent">
            <XCircleIcon className="size-4 mr-2" />
            Remove Video
          </Button>
          <Button>
            <CheckCircleIcon className="size-4 mr-2" />
            Approve Video
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
