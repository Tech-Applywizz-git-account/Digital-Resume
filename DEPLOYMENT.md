# Deployment to Vercel

This document provides instructions for deploying the CareerCast application to Vercel.

## Prerequisites

1. A Vercel account (free at [vercel.com](https://vercel.com))
2. A Supabase account and project
3. Microsoft 365 credentials for email sending
4. OpenAI API key

## Environment Variables

Before deploying, you need to set the following environment variables in your Vercel project:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Microsoft 365 Configuration for OTP emails
VITE_TENANT_ID=your_microsoft_tenant_id
VITE_CLIENT_ID=your_microsoft_client_id
VITE_CLIENT_SECRET=your_microsoft_client_secret
VITE_SENDER_EMAIL=your_sender_email_address

# OpenAI API Key for teleprompter script generation
VITE_OPENAI_API_KEY=your_openai_api_key
```

## Deployment Steps

1. Push your code to a GitHub repository
2. Log in to your Vercel account
3. Click "New Project" and select your repository
4. Configure the project:
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`
5. Add the environment variables listed above in the "Environment Variables" section
6. Click "Deploy"

## Supabase Configuration

Ensure your Supabase project has the following tables set up according to the schema:

1. `profiles` - User profile information
2. `job_requests` - Job application requests
3. `recordings` - Video recordings
4. `scripts` - AI-generated scripts

Also, set up Storage buckets:
1. `resumes` - For resume uploads
2. `recordings` - For video recordings

## Microsoft 365 Setup

To send OTP emails, you need to set up a Microsoft 365 application with the following permissions:
- Mail.Send - Application permissions

## Troubleshooting

### Common Issues

1. **Environment Variables Not Loading**: Ensure all environment variables are set in Vercel project settings
2. **Supabase Connection Issues**: Verify Supabase URL and keys are correct
3. **Email Sending Failures**: Check Microsoft 365 application credentials and permissions
4. **OpenAI API Errors**: Verify API key is valid and has sufficient credits

### Checking Logs

You can check deployment logs and runtime logs in the Vercel dashboard to diagnose issues.

## Local Development

For local development, create a `.env` file in the root directory with the same variables as listed above.

```bash
npm install
npm run dev
```

The application will be available at `http://localhost:5173`.

## Building for Production

To build the application for production:

```bash
npm run build
```

The build output will be in the `dist` directory.