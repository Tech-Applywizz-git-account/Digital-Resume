import express from 'express';
import cors from 'cors';
import resumeChatHandler from './api/resume-chat.js';
import generateIntroHandler from './api/generate-introduction.js';

const app = express();
app.use(cors());
// Do not use express.json() for generate-introduction because it manually parses the body stream.
// Actually, resumeChatHandler also manually parses the stream if req.body is not an object.
// So we can just pass the raw request.

app.post('/api/resume-chat', async (req, res) => {
    await resumeChatHandler(req, res);
});

app.post('/api/generate-introduction', async (req, res) => {
    await generateIntroHandler(req, res);
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
