import { showToast } from "../components/ui/toast";

/**
 * Opens a document (PDF/Doc) in a new tab using a Blob URL to hide sensitive backend information
 * like Supabase project IDs, bucket names, and user emails.
 * 
 * @param url The actual backend URL (e.g. Supabase storage URL)
 * @param filename Optional filename for the document
 */
export const viewDocumentSafe = async (url: string, filename?: string) => {
  if (!url) return;

  // If it's already a blob URL, just open it
  if (url.startsWith('blob:')) {
    window.open(url, '_blank');
    return;
  }

  try {
    // We use the local proxy to avoid CORS issues if necessary, 
    // though Supabase public URLs usually handle CORS.
    // However, fetching directly is more reliable for blob creation.
    const response = await fetch(url);
    if (!response.ok) throw new Error("Could not fetch document");

    const blob = await response.blob();
    
    // Create a blob URL. This hides the original source.
    // The browser will see something like: blob:https://digital-resume.vercel.app/65e9c0...
    const blobUrl = URL.createObjectURL(blob);
    
    // Open in a new tab
    const newTab = window.open(blobUrl, '_blank');
    
    if (!newTab) {
      showToast("Please allow popups to view the resume", "warning");
    }

    // Optional: Revoke the URL after some time to free memory, 
    // but we can't do it immediately or the tab might fail to load.
    // Usually, blob URLs persist for the session life.
  } catch (err) {
    console.error("❌ Safe viewer failed:", err);
    // Fallback to original URL if blob creation fails (worst case)
    window.open(url, '_blank');
  }
};
