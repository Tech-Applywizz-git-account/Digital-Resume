-- Enable the pg_cron extension to allow scheduling
create extension if not exists pg_cron;

-- Enable the pg_net extension to allow making HTTP requests to the Edge Function
create extension if not exists pg_net;

-- Schedule the sync-crm-users function to run every 10 minutes
-- IMPORTANT: You must replace the placeholders below with your actual values!

select
  cron.schedule(
    'sync-crm-users-every-10-min', -- Name of the cron job
    '*/10 * * * *',                -- Schedule (Every 10 minutes)
    $$
    select
      net.http_post(
          -- REPLACE 'mrsmhqgdwjopasnpohwu' with your actual Project Reference ID if different
          url:='https://mrsmhqgdwjopasnpohwu.supabase.co/functions/v1/sync-crm-users', 
          
          -- REPLACE THIS WITH YOUR SERVICE_ROLE_KEY (Keep it secret!)
          -- You can find this in Project Settings -> API -> Service Role Key
          headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
          
          body:='{}'::jsonb
      ) as request_id;
    $$
  );

-- To verify the job is scheduled:
-- select * from cron.job;

-- To unschedule/delete the job later:
-- select cron.unschedule('sync-crm-users-every-10-min');
