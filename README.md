# careercast - Video Resume Platform

careercast is a platform that helps job seekers create professional video resumes to stand out in their job search.

## Features

- AI-powered teleprompter script generation
- Video recording with teleprompter assistance
- Resume upload and parsing
- Email verification with OTP
- careercast creation workflow

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:5173](http://localhost:5173) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm run build`

Builds the app for production to the `dist` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

## Deployment

This application is configured for deployment to Vercel. See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions.

## Environment Variables

Create a `.env` file in the root directory with the following variables:

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

## Learn More

- [Vite Documentation](https://vitejs.dev/)
- [React Documentation](https://reactjs.org/)
- [Supabase Documentation](https://supabase.io/docs)
- [Vercel Documentation](https://vercel.com/docs)
