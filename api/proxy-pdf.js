export default async function handler(req, res) {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'Missing URL parameter' });
    }

    try {
        const decodedUrl = decodeURIComponent(url);

        // Security check: only allow certain domains if needed, but for now we'll allow common storage providers
        if (!decodedUrl.includes('.s3.') && !decodedUrl.includes('vercel-storage.com')) {
            console.warn('Proxying potentially non-S3/Blob URL:', decodedUrl);
        }

        // Use global fetch (available in Node.js 18+)
        const response = await fetch(decodedUrl);

        if (!response.ok) {
            return res.status(response.status).json({ error: `Failed to fetch from remote URL: ${response.statusText}` });
        }

        // Pass through relevant headers
        const contentType = response.headers.get('Content-Type');
        res.setHeader('Content-Type', contentType || 'application/pdf');
        res.setHeader('Access-Control-Allow-Origin', '*'); // Enable CORS for the frontend

        const blob = await response.arrayBuffer();
        res.send(Buffer.from(blob));

    } catch (error) {
        console.error('PDF Proxy Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
