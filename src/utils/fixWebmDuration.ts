import fixWebmDuration from "fix-webm-duration";

/**
 * Injects duration metadata into a WebM video blob produced by MediaRecorder.
 * MediaRecorder records in streaming mode, leaving duration as Infinity.
 * This patches the EBML Info -> Duration element so browsers can display
 * the exact length (e.g. 0:15 / 0:45) and allow smooth, bounded scrubbing.
 *
 * @param blob - The raw WebM video Blob
 * @param durationSeconds - Recorded time in seconds
 * @returns Patched Blob with duration metadata
 */
export async function injectWebmDuration(blob: Blob, durationSeconds: number): Promise<Blob> {
  if (!blob || blob.size === 0 || durationSeconds <= 0) {
    return blob;
  }

  try {
    const durationMs = Math.round(durationSeconds * 1000);
    // fixWebmDuration returns a Promise when callback is omitted
    const patchedBlob = await (fixWebmDuration as any)(blob, durationMs);
    console.log(`⏱️ Injected WebM duration: ${durationSeconds.toFixed(1)}s (${durationMs}ms) into Blob`);
    return patchedBlob || blob;
  } catch (err) {
    console.warn("⚠️ Failed to patch WebM duration header, falling back to original blob:", err);
    return blob;
  }
}
