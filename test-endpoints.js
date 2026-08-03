import dotenv from 'dotenv';
dotenv.config();
import { default as generateIntroduction } from './api/generate-introduction.js';
import { default as resumeChat } from './api/resume-chat.js';

async function mockEndpoint(handler, body) {
  let statusCode = 200;
  let responseData = null;

  const req = {
    method: 'POST',
    body: body,
    headers: {}
  };

  const res = {
    setHeader: () => {},
    status: (code) => {
      statusCode = code;
      return res;
    },
    json: (data) => {
      responseData = data;
    },
    end: () => {}
  };

  await handler(req, res);
  return { statusCode, responseData };
}

async function run() {
  console.log("Testing /api/generate-introduction");
  try {
    const res1 = await mockEndpoint(generateIntroduction, { prompt: "Hello, introduce me." });
    console.log("Status:", res1.statusCode);
    console.log("Response:", res1.responseData);
  } catch (err) {
    console.error("Error:", err);
  }

  console.log("\nTesting /api/resume-chat");
  try {
    const res2 = await mockEndpoint(resumeChat, { 
      resumeText: "John Doe. Experience: Software Engineer.", 
      question: "What is my name?" 
    });
    console.log("Status:", res2.statusCode);
    console.log("Response:", res2.responseData);
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
