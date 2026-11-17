import { randomUUID } from 'node:crypto';
import Busboy from 'busboy';
import { requireAuth, setCors } from '../../../lib/supabaseAuth.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

function getPath(req) {
  if (req.query?.path != null) {
    const p = req.query.path;
    return Array.isArray(p) ? p.filter(Boolean).join('/') : String(p);
  }
  // Legacy rewrite may leave the matched suffix only in the URL
  const urlPath = (req.url || '').split('?')[0];
  const match = urlPath.match(/\/api\/v1\/resumes\/?(.*)$/);
  if (match) {
    return match[1]
      .replace(/\/$/, '')
      .replace(/\[+\.+path\]+/g, '')
      .replace(/^\/+|\/+$/g, '');
  }
  return '';
}

function getQueryFlag(req, name) {
  if (req.query?.[name] != null) return String(req.query[name]);
  try {
    const u = new URL(req.url || '', 'http://localhost');
    return u.searchParams.get(name);
  } catch {
    return null;
  }
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function parseJsonBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  const raw = await readRawBody(req);
  if (!raw.length) return {};
  return JSON.parse(raw.toString('utf8'));
}

function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: req.headers, limits: { fileSize: 10 * 1024 * 1024 + 1, files: 1 } });
    const fields = {};
    let fileInfo = null;
    const chunks = [];

    busboy.on('file', (_name, file, info) => {
      fileInfo = {
        originalName: info.filename || 'resume.pdf',
        mimeType: info.mimeType || 'application/octet-stream',
      };
      file.on('data', (data) => chunks.push(data));
      file.on('limit', () => reject(Object.assign(new Error('Your PDF exceeds 10 MB.'), { statusCode: 413 })));
    });

    busboy.on('field', (name, value) => {
      fields[name] = value;
    });

    busboy.on('error', reject);
    busboy.on('finish', () => {
      resolve({
        fields,
        file: fileInfo
          ? {
              ...fileInfo,
              buffer: Buffer.concat(chunks),
            }
          : null,
      });
    });

    req.pipe(busboy);
  });
}

async function findCrmUser(admin, email) {
  if (!email) return null;
  const { data: byEmail } = await admin
    .from('digital_resume_by_crm')
    .select('email,user_id')
    .eq('email', email)
    .maybeSingle();
  if (byEmail) return byEmail;
  const { data: byAppEmail } = await admin
    .from('digital_resume_by_crm')
    .select('email,user_id')
    .eq('company_application_email', email)
    .maybeSingle();
  return byAppEmail;
}

async function isCrmUser(admin, email) {
  return !!await findCrmUser(admin, email);
}

function publicUrl(admin, bucket, path) {
  if (!path) return null;
  if (String(path).startsWith('http')) return path;
  const { data } = admin.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl ?? null;
}

async function createJobRequest(admin, user, body) {
  const jobTitle = body.jobTitle || 'New Digital Resume';
  const jobDescription = body.jobDescription || '';
  const email = user.email;
  const crm = await isCrmUser(admin, email);

  if (crm) {
    const { data, error } = await admin
      .from('crm_job_requests')
      .insert({
        email,
        user_id: user.id,
        job_title: jobTitle,
        job_description: jobDescription,
        application_status: 'draft',
      })
      .select('id')
      .single();
    if (error) throw error;
    return { id: data.id };
  }

  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (!existingProfile) {
    const { error: profileError } = await admin.from('profiles').insert({
      id: user.id,
      email: email || '',
      credits_remaining: 3,
    });
    if (profileError) throw profileError;
  }

  const { data, error } = await admin
    .from('job_requests')
    .insert({
      user_id: user.id,
      email: email || '',
      job_title: jobTitle,
      job_description: jobDescription,
      status: 'draft',
    })
    .select('id')
    .single();
  if (error) throw error;
  return { id: data.id };
}

async function uploadResume(admin, user, file, jobRequestId, replace) {
  if (!jobRequestId) throw new Error('Job request ID required');
  if (!file?.buffer?.length) throw new Error('No file provided');

  const email = user.email;
  const crmUser = await findCrmUser(admin, email);
  const crm = !!crmUser;
  const crmEmail = replace ? crmUser?.email ?? email : email;
  const table = crm ? 'crm_job_requests' : 'job_requests';

  const { data: existing, error: findError } = await admin
    .from(table)
    .select(crm ? 'id,user_id,email' : 'id,user_id')
    .eq('id', jobRequestId)
    .maybeSingle();
  if (findError) throw findError;
  if (!existing) throw new Error('Job request not found');
  if (existing.user_id && existing.user_id !== user.id) {
    throw new Error('Unauthorized: job request does not belong to this user');
  }
  const ownsLegacyCrmResume = crmUser?.user_id === user.id && existing.email?.toLowerCase() === crmEmail.toLowerCase();
  if (replace && !existing.user_id && !ownsLegacyCrmResume) {
    throw Object.assign(new Error('You do not own this resume.'), { statusCode: 403 });
  }

  const bucket = crm ? 'CRM_users_resumes' : 'resumes';
  const fileExt = replace ? 'pdf' : (file.originalName.split('.').pop() || 'pdf').toLowerCase();
  const fileId = replace ? randomUUID() : Date.now();
  const storagePath = `${crm ? crmEmail : user.id}/${jobRequestId}_${fileId}.${fileExt}`;

  const { data: uploaded, error: uploadError } = await admin.storage
    .from(bucket)
    .upload(storagePath, file.buffer, {
      contentType: file.mimeType,
      upsert: true,
    });
  if (uploadError) throw uploadError;

  const resumeUrl = publicUrl(admin, bucket, uploaded?.path || storagePath);
  if (!resumeUrl) throw new Error('Failed to resolve public URL');

  const updates = crm ? { resume_url: resumeUrl } : { resume_path: resumeUrl };
  if (replace) {
    updates.updated_at = new Date().toISOString();
    if (!crm) updates.resume_original_name = file.originalName;
  } else {
    updates[crm ? 'application_status' : 'status'] = 'ready';
  }

  let update = admin.from(table).update(updates).eq('id', jobRequestId);
  if (replace) {
    update = existing.user_id
      ? update.eq('user_id', user.id)
      : update.is('user_id', null).eq('email', existing.email);
    update = update.select('id').single();
  }
  const { error } = await update;
  if (error) throw error;

  if (replace && crm) {
    const { error: historyError } = await admin.from('crm_resumes').insert({
      email: crmEmail, user_id: user.id, resume_name: file.originalName,
      resume_url: resumeUrl, file_type: 'pdf', file_size: file.buffer.length,
    });
    if (historyError) console.warn('Could not record CRM resume replacement history:', historyError);
  }

  return { resumeUrl, fileName: file.originalName };
}

async function getHistory(admin, email, isCRM) {
  const table = isCRM ? 'crm_job_requests' : 'job_requests';
  const recordingsTable = isCRM ? 'crm_recordings' : 'recordings';
  const recordingBucket = isCRM ? 'CRM_users_recordings' : 'recordings';

  const { data: jobs, error } = await admin
    .from(table)
    .select('*')
    .eq('email', email)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const enriched = await Promise.all(
    (jobs || []).map(async (job) => {
      const { data: recs } = await admin
        .from(recordingsTable)
        .select('video_url,storage_path')
        .eq('job_request_id', job.id)
        .order('created_at', { ascending: false })
        .limit(1);
      const rec = recs?.[0];
      let videoUrl = null;
      if (rec) {
        const raw = rec.video_url || rec.storage_path;
        if (raw) videoUrl = publicUrl(admin, recordingBucket, raw);
      }
      return { ...job, video_url: videoUrl };
    }),
  );

  return enriched;
}

async function updateJobDescription(admin, user, jobRequestId, jobDescription) {
  if (!jobRequestId) throw new Error('Job request ID required');
  const email = user.email;
  const crm = await isCrmUser(admin, email);
  const table = crm ? 'crm_job_requests' : 'job_requests';

  const { data: existing, error: findError } = await admin
    .from(table)
    .select('id,user_id')
    .eq('id', jobRequestId)
    .maybeSingle();
  if (findError) throw findError;
  if (!existing) throw new Error('Job request not found');
  if (existing.user_id && existing.user_id !== user.id) {
    throw new Error('Unauthorized: job request does not belong to this user');
  }

  const { error } = await admin
    .from(table)
    .update({ job_description: jobDescription })
    .eq('id', jobRequestId);
  if (error) throw error;
}

export default async function handler(req, res) {
  setCors(res, 'GET, POST, PUT, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const auth = await requireAuth(req, res);
    if (!auth) return;

    const { user, admin } = auth;
    const path = getPath(req);
    const method = req.method;

    if (method === 'POST' && path === 'create-job-request') {
      const body = await parseJsonBody(req);
      const result = await createJobRequest(admin, user, body);
      return res.status(201).json({ success: true, data: result });
    }

    if (method === 'POST' && path === 'upload') {
      const contentType = req.headers['content-type'] || '';
      if (!contentType.includes('multipart/form-data')) {
        return res.status(400).json({ success: false, message: 'Expected multipart/form-data' });
      }
      const { fields, file } = await parseMultipart(req);
      if (!file?.buffer.length) {
        return res.status(400).json({ success: false, message: 'Please choose a non-empty PDF file.' });
      }
      if (file.mimeType !== 'application/pdf' || file.buffer.toString('latin1', 0, 5) !== '%PDF-') {
        return res.status(415).json({ success: false, message: 'Please upload a PDF file only.' });
      }
      const result = await uploadResume(admin, user, file, fields.jobRequestId, fields.replace === 'true');
      return res.status(201).json({ success: true, data: result });
    }

    if (method === 'GET' && (path === 'history' || path.startsWith('history'))) {
      const isCRM = getQueryFlag(req, 'isCRM') === 'true';
      const history = await getHistory(admin, user.email, isCRM);
      return res.status(200).json({ success: true, data: history });
    }

    const descMatch = path.match(/^([^/]+)\/description$/);
    if (method === 'PUT' && descMatch) {
      const body = await parseJsonBody(req);
      await updateJobDescription(admin, user, descMatch[1], body.jobDescription);
      return res.status(200).json({ success: true, message: 'Updated successfully' });
    }

    return res.status(404).json({
      success: false,
      message: `Resume route not found: ${method} ${path}`,
    });
  } catch (err) {
    console.error('resumes API error:', err);
    const message = err?.message || 'Internal server error';
    const status = err?.statusCode ?? (
      message.includes('Unauthorized') || message.includes('not found') || message.includes('No file') ? 400 : 500
    );
    return res.status(status).json({ success: false, message });
  }
}
