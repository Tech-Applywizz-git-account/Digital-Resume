const fetch = require('node-fetch');

module.exports = async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'Missing URL parameter' });
    }

    try {
        const decodedUrl = decodeURIComponent(url);

        // Security check: only allow certain domains if needed, but for now we'll allow S3 and Vercel Blob
        if (!decodedUrl.includes('.s3.') && !decodedUrl.includes('vercel-storage.com')) {
            // Log it but allow for now if it looks like a resume
            console.warn('Proxying potentially non-S3/Blob URL:', decodedUrl);
        }

        const response = await fetch(decodedUrl);

        if (!response.ok) {
            return res.status(response.status).json({ error: `Failed to fetch from remote URL: ${response.statusText}` });
        }

        // Pass through relevant headers
        res.setHeader('Content-Type', response.headers.get('Content-Type') || 'application/pdf');
        res.setHeader('Access-Control-Allow-Origin', '*'); // Enable CORS for the frontend

        const buffer = await response.buffer();
        res.send(buffer);

    } catch (error) {
        console.error('PDF Proxy Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
