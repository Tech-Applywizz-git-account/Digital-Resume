export default async function handler(req, res) {
    const { email } = req.query;
    if (!email) {
        return res.status(200).json(null);
    }

    try {
        const fetch = globalThis.fetch;
        const response = await fetch(`https://applywizz-5i8qccsfs-applywizz-tech-vercels-projects.vercel.app/api/user-details?email=${encodeURIComponent(email)}`);

        // Mask 404s so the browser doesn't log network errors
        if (response.status === 404 || !response.ok) {
            return res.status(200).json(null);
        }

        // Pass along successful JSON
        const data = await response.json();
        return res.status(200).json(data);
    } catch (error) {
        return res.status(200).json(null);
    }
}
