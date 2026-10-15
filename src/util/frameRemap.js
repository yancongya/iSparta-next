import TYPE from '../store/enum/type'

/** Return evenly spaced source frame indices for a duration-preserving remap. */
export function sampleFrameIndices (frameCount, sourceFrameRate, targetFrameRate) {
  const count = Math.max(0, Math.floor(Number(frameCount) || 0))
  const source = Number(sourceFrameRate)
  const target = Number(targetFrameRate)
  if (!count || !isFinite(source) || source <= 0 || !isFinite(target) || target <= 0 || target >= source) {
    const all = []
    for (let index = 0; index < count; index++) all.push(index)
    return all
  }

  const outputCount = Math.max(1, Math.min(count, Math.round(count * target / source)))
  const indices = []
  for (let index = 0; index < outputCount; index++) {
    // Pick the center of each equal time bucket; this distributes dropped
    // frames evenly and never deletes or duplicates any source file.
    indices.push(Math.min(count - 1, Math.floor((index + 0.5) * count / outputCount)))
  }
  return indices
}

/** Choose full-canvas APNG frames by time, preserving total animation duration. */
export function sampleTimedFrameIndices (frameDelays, targetFrameRate) {
  const delays = (Array.isArray(frameDelays) ? frameDelays : []).map(function (delay) {
    const value = Number(delay)
    return isFinite(value) && value > 0 ? value : 0.01
  })
  const totalDuration = delays.reduce(function (sum, delay) { return sum + delay }, 0)
  const target = Number(targetFrameRate)
  if (!delays.length || !isFinite(target) || target <= 0 || totalDuration <= 0) return []

  const outputCount = Math.max(1, Math.min(delays.length, Math.round(totalDuration * target)))
  const indices = []
  let frameIndex = 0
  let frameEnd = delays[0]
  for (let outputIndex = 0; outputIndex < outputCount; outputIndex++) {
    const midpoint = (outputIndex + 0.5) * totalDuration / outputCount
    while (frameIndex < delays.length - 1 && midpoint >= frameEnd) {
      frameIndex++
      frameEnd += delays[frameIndex]
    }
    indices.push(frameIndex)
  }
  return indices
}

export function frameRemapSettings (item) {
  const basic = (item && item.basic) || {}
  const options = (item && item.options) || {}
  const remap = options.frameRemap || {}
  const sourceFrameRate = basic.type === TYPE.Comp && Number(basic.compFps) > 0
    ? Number(basic.compFps)
    : Number(options.frameRate)
  const requestedTarget = Number(remap.targetFrameRate)
  const targetFrameRate = isFinite(requestedTarget) && requestedTarget > 0
    ? Math.min(requestedTarget, sourceFrameRate)
    : sourceFrameRate
  const enabled = !!remap.enabled && isFinite(sourceFrameRate) && sourceFrameRate > 0 &&
    isFinite(targetFrameRate) && targetFrameRate > 0 && targetFrameRate < sourceFrameRate
  return {
    enabled,
    sourceFrameRate,
    targetFrameRate: enabled ? targetFrameRate : Number(options.frameRate) || sourceFrameRate
  }
}

export function remapSequence (item, fileList) {
  const settings = frameRemapSettings(item)
  const files = Array.isArray(fileList) ? fileList : []
  const indices = settings.enabled
    ? sampleFrameIndices(files.length, settings.sourceFrameRate, settings.targetFrameRate)
    : files.map((_, index) => index)
  return {
    enabled: settings.enabled,
    sourceFrameRate: settings.sourceFrameRate,
    targetFrameRate: settings.targetFrameRate,
    indices,
    files: indices.map(index => files[index])
  }
}
