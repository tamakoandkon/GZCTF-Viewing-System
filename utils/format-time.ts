export function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleString()
}

export function formatTimeAgo(timestamp: number): string {
  const now = Date.now()
  const timeMs = timestamp
  const diffMs = now - timeMs

  const seconds = Math.floor(diffMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return `${seconds}s ago`
}
