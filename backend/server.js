require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Rate limiter (basic)
const requestCounts = {};
const RATE_LIMIT = 10; // max 10 requests per minute per IP

function rateLimiter(req, res, next) {
  const ip = req.ip;
  const now = Date.now();

  if (!requestCounts[ip]) {
    requestCounts[ip] = [];
  }

  // Keep only requests from last 60 seconds
  requestCounts[ip] = requestCounts[ip].filter((t) => now - t < 60000);

  if (requestCounts[ip].length >= RATE_LIMIT) {
    return res.status(429).json({ error: "Too many requests. Please wait." });
  }

  requestCounts[ip].push(now);
  next();
}

// Chat route
app.post("/chat", rateLimiter, async (req, res) => {
  const { message } = req.body;

  if (!message || message.trim() === "") {
    return res.status(400).json({ error: "Message is required." });
  }

  try {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`, // ✅ Key is hidden
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          max_tokens: 1000,
          messages: [
            {
              role: "system",
              content: `You are Kisan Digital Sathi, a helpful assistant for Indian farmers.

You help farmers with:
- PM-Kisan scheme and registration
- Crop guidance and best farming practices  
- Government agriculture schemes
- Weather advice for farming
- Digital farming tools
- eNAM electronic market
- PMFBY crop insurance

Rules:
- Always answer in simple, short sentences
- Use easy farmer-friendly language
- If the user writes in Hindi, always reply in Hindi
- Be helpful, polite and encouraging
- Keep answers brief and practical`,
            },
            {
              role: "user",
              content: message,
            },
          ],
        }),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Groq error:", data);
      return res
        .status(response.status)
        .json({ error: data?.error?.message || "API error" });
    }

    const reply = data.choices[0].message.content;
    res.json({ reply });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Server error. Please try again." });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Kisan Sathi backend running at http://localhost:${PORT}`);
});
