// Keep the configured retry count within the available quality range.
const MAX_RETRIES = 50

function boundedInteger (value, fallback, min, max) {
  const n = Number(value)
  if (!isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.round(n)))
}

export function effectiveQualityStart (quality, checked) {
  if (checked === false) return 100
  return boundedInteger(quality, 80, 0, 100)
}

// Spread retries across the available quality range, reaching Q1 on the last try.
// This keeps each attempt distinct even when the retry count does not divide evenly.
export function automaticRetryQuality (quality, maxTries, attempt) {
  const start = boundedInteger(quality, 80, 0, 100)
  const tries = Math.min(boundedInteger(maxTries, 10, 0, MAX_RETRIES), Math.max(0, start - 1))
  if (!tries || attempt <= 0) return start
  const index = boundedInteger(attempt, 1, 1, tries)
  return Math.max(1, Math.floor(start - (start - 1) * index / tries))
}

export function automaticRetryCount (quality, maxTries) {
  const start = boundedInteger(quality, 80, 0, 100)
  return Math.min(boundedInteger(maxTries, 10, 0, MAX_RETRIES), Math.max(0, start - 1))
}
