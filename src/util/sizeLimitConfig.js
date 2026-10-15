// Keep configured quality step and retry count within the available quality range.
const MAX_RETRIES = 50

function boundedInteger (value, fallback, min, max) {
  const n = Number(value)
  if (!isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.round(n)))
}

export function maxQualityRetries (quality, step) {
  const q = boundedInteger(quality, 80, 0, 100)
  const s = boundedInteger(step, 5, 1, 100)
  return Math.min(MAX_RETRIES, Math.max(0, Math.floor((q - 1) / s)))
}

export function maxQualityStep (quality, maxTries) {
  const q = boundedInteger(quality, 80, 0, 100)
  const tries = boundedInteger(maxTries, 1, 1, MAX_RETRIES)
  return Math.max(1, Math.min(100, Math.floor((q - 1) / tries)))
}

// A linked slider must remain adjustable at a boundary pair such as Q80,
// step 1, 50 retries. Expose one mapped increment beyond the current
// compatible maximum; changing it remaps the paired value to a valid pair.
export function maxAdjustableQualityStep (quality, maxTries, currentStep) {
  const absoluteMax = maxQualityStep(quality, 1)
  const tries = boundedInteger(maxTries, 0, 0, MAX_RETRIES)
  const current = boundedInteger(currentStep, 1, 1, absoluteMax)
  const compatibleMax = tries > 0 ? maxQualityStep(quality, tries) : absoluteMax
  return Math.min(absoluteMax, Math.max(current, compatibleMax + 1))
}

export function maxAdjustableQualityRetries (quality, step, currentTries) {
  const absoluteMax = maxQualityRetries(quality, 1)
  const current = boundedInteger(currentTries, 0, 0, absoluteMax)
  const compatibleMax = maxQualityRetries(quality, step)
  return Math.min(absoluteMax, Math.max(current, compatibleMax + 1))
}

export function effectiveQualityStart (quality, checked) {
  if (checked === false) return 100
  return boundedInteger(quality, 80, 0, 100)
}

export function effectiveQualityRetries (quality, step, maxTries) {
  const configured = boundedInteger(maxTries, 10, 0, MAX_RETRIES)
  const reachable = maxQualityRetries(quality, step)
  return Math.min(configured, reachable)
}

export function adjustQualityRetrySettings (quality, step, maxTries, changed) {
  let nextStep = boundedInteger(step, 5, 1, 100)
  let nextTries = boundedInteger(maxTries, 10, 0, MAX_RETRIES)
  const capacity = maxQualityRetries(quality, nextStep)

  if (changed === 'tries') {
    nextTries = Math.min(nextTries, maxQualityRetries(quality, 1))
    if (nextTries > 0) {
      // Keep the selected retry count and map it to the largest safe decrement.
      nextStep = maxQualityStep(quality, nextTries)
    }
  } else if (changed === 'step') {
    // Moving the decrement slider updates the retry count to the number of
    // complete steps available before quality reaches zero.
    if (nextTries > 0) nextTries = maxQualityRetries(quality, nextStep)
  } else if (changed === 'quality') {
    nextTries = Math.min(nextTries, capacity)
  }

  if (boundedInteger(quality, 80, 0, 100) <= 1) {
    nextStep = 1
    nextTries = 0
  }

  return { step: nextStep, maxTries: nextTries }
}
