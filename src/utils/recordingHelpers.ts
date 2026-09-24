import { supabase } from "../integrations/supabase/client";

const VIDEO_FILE = /\.(webm|mp4|mov|mkv)$/i;

const toPublicUrl = (bucket: string, pathOrUrl: string | null | undefined) => {
  if (!pathOrUrl) return null;
  if (pathOrUrl.startsWith("http")) return pathOrUrl;
  return supabase.storage.from(bucket).getPublicUrl(pathOrUrl).data.publicUrl || null;
};

async function latestColumn(options: {
  table: "crm_recordings" | "recordings";
  column: "video_url" | "storage_path";
  matchColumn: "job_request_id" | "email" | "user_id";
  matchValue: string;
}): Promise<string | null> {
  const ordered = await supabase
    .from(options.table)
    .select(options.column)
    .eq(options.matchColumn, options.matchValue)
    .order("created_at", { ascending: false })
    .limit(1);

  const orderedRow = ordered.data?.[0] as Record<string, string> | undefined;
  if (!ordered.error && orderedRow?.[options.column]) return orderedRow[options.column];

  const plain = await supabase
    .from(options.table)
    .select(options.column)
    .eq(options.matchColumn, options.matchValue)
    .limit(1);

  const plainRow = plain.data?.[0] as Record<string, string> | undefined;
  if (!plain.error && plainRow?.[options.column]) return plainRow[options.column];
  return null;
}

async function latestBucketFile(bucket: string, folder: string): Promise<string | null> {
  let listed = await supabase.storage.from(bucket).list(folder, {
    limit: 100,
    sortBy: { column: "created_at", order: "desc" },
  });
  if (listed.error) {
    listed = await supabase.storage.from(bucket).list(folder, { limit: 100 });
  }
  const { data, error } = listed;
  if (error || !data?.length) return null;

  const file = data
    .filter((item) => VIDEO_FILE.test(item.name))
    .sort((a, b) => {
      const aTime = new Date(a.created_at || a.updated_at || 0).getTime();
      const bTime = new Date(b.created_at || b.updated_at || 0).getTime();
      return bTime - aTime;
    })[0];

  if (!file) return null;
  return supabase.storage.from(bucket).getPublicUrl(`${folder}/${file.name}`).data.publicUrl || null;
}

/**
 * Finds the newest intro video for a resume.
 * Checks the recordings table by job, then by email/user, then the storage bucket
 * where the upload was saved even if the table row is missing.
 */
export async function resolveRecordingUrl(options: {
  isCRM: boolean;
  jobRequestId?: string | null;
  email?: string | null;
  userId?: string | null;
}): Promise<string | null> {
  const table = options.isCRM ? "crm_recordings" : "recordings";
  const column = options.isCRM ? "video_url" : "storage_path";
  const bucket = options.isCRM ? "CRM_users_recordings" : "recordings";

  if (options.jobRequestId) {
    const byJob = await latestColumn({
      table,
      column,
      matchColumn: "job_request_id",
      matchValue: options.jobRequestId,
    });
    if (byJob) return toPublicUrl(bucket, byJob);
  }

  if (options.email) {
    const byEmail = await latestColumn({
      table,
      column,
      matchColumn: "email",
      matchValue: options.email,
    });
    if (byEmail) return toPublicUrl(bucket, byEmail);
  }

  if (options.userId) {
    const byUser = await latestColumn({
      table,
      column,
      matchColumn: "user_id",
      matchValue: options.userId,
    });
    if (byUser) return toPublicUrl(bucket, byUser);
  }

  const folders = [options.email, options.email?.toLowerCase(), options.userId].filter(
    (folder, index, list): folder is string => !!folder && list.indexOf(folder) === index
  );

  for (const folder of folders) {
    const fromBucket = await latestBucketFile(bucket, folder);
    if (fromBucket) return fromBucket;
  }

  return null;
}
