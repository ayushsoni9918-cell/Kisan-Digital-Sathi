require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ============================================================
// KNOWLEDGE BASE
// ============================================================
const FARMING_KNOWLEDGE = `
GOVERNMENT SCHEMES:
1. PM-Kisan: ₹6000/year in 3 installments. Eligibility: up to 2 hectares land. Apply: pmkisan.gov.in
2. PMFBY: Crop insurance. Premium 2% Kharif, 1.5% Rabi. Apply through bank or CSC.
3. Kisan Credit Card: Credit up to ₹3 lakh at 4% interest. Apply at any nationalized bank.
4. eNAM: Online mandi. Sell directly to buyers. Register: enam.gov.in
5. Soil Health Card: Free soil testing every 2 years. Visit nearest agriculture office.
6. Kisan Samman Nidhi: Same as PM-Kisan.
7. PM Fasal Bima: Same as PMFBY.

CROP SEASONS:
- KHARIF (June-Oct): Rice, Maize, Cotton, Sugarcane, Soybean, Groundnut, Bajra
- RABI (Nov-Apr): Wheat, Barley, Mustard, Gram, Peas
- ZAID (Mar-Jun): Watermelon, Cucumber, Moong

SOIL TYPES:
- Black soil: Cotton, sugarcane, wheat — Maharashtra, MP, Gujarat
- Red soil: Millets, pulses — Tamil Nadu, Karnataka
- Alluvial soil: Rice, wheat, sugarcane — Punjab, UP, Bihar
- Laterite soil: Tea, coffee, cashew — Kerala, Karnataka

DISEASES & SOLUTIONS:
- Rice blast: Tricyclazole fungicide
- Wheat rust: Propiconazole fungicide
- Cotton bollworm: Bt cotton, neem pesticides
- Late blight: Mancozeb, avoid overhead irrigation

FERTILIZER:
- Rice: NPK 120:60:60 kg/hectare
- Wheat: NPK 120:60:40 kg/hectare
- Cotton: NPK 150:75:75 kg/hectare

HELPLINES:
- Kisan Call Center: 1800-180-1551 (free, 24x7)
- PM-Kisan: 155261
- Weather: 1800-180-1717
`;

// ============================================================
// RATE LIMITER
// ============================================================
const requestCounts = {};
const RATE_LIMIT = 10;

function rateLimiter(req, res, next) {
  const ip = req.ip;
  const now = Date.now();
  if (!requestCounts[ip]) requestCounts[ip] = [];
  requestCounts[ip] = requestCounts[ip].filter((t) => now - t < 60000);
  if (requestCounts[ip].length >= RATE_LIMIT) {
    return res.status(429).json({ error: "Too many requests. Please wait." });
  }
  requestCounts[ip].push(now);
  next();
}

// ============================================================
// WEATHER API ROUTE
// ============================================================
app.get("/weather", async (req, res) => {
  const { city } = req.query;
  if (!city) return res.status(400).json({ error: "City is required" });

  try {
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${city},IN&appid=${process.env.WEATHER_API_KEY}&units=metric&lang=hi`
    );
    const data = await response.json();

    if (!response.ok) {
      return res.status(404).json({ error: "City not found" });
    }

    // Format farming-friendly weather response
    const weather = {
      city: data.name,
      temp: data.main.temp,
      feels_like: data.main.feels_like,
      humidity: data.main.humidity,
      description: data.weather[0].description,
      wind_speed: data.wind.speed,
      farming_advice: getFarmingWeatherAdvice(
        data.main.temp,
        data.main.humidity,
        data.weather[0].main
      ),
    };

    res.json(weather);
  } catch (err) {
    res.status(500).json({ error: "Weather service error" });
  }
});

// Farming advice based on weather
function getFarmingWeatherAdvice(temp, humidity, condition) {
  const advice = [];

  if (condition === "Rain") {
    advice.push("Aaj irrigation band rakhen — baarish ho rahi hai");
    advice.push("Fungal disease ka dhyan rakhen — Mancozeb spray karen");
  }
  if (temp > 35) {
    advice.push("Zyada garmi — subah ya shaam ko irrigation karen");
    advice.push("Mulching se soil ki nami bachayein");
  }
  if (temp < 10) {
    advice.push("Pala girne ka khatra — fasal ko dhaken");
    advice.push("Rabi crops ke liye achha mausam hai");
  }
  if (humidity > 80) {
    advice.push("Zyada nami — fungal bimari ka khatra hai");
    advice.push("Proper drainage ensure karen");
  }
  if (condition === "Clear" && temp >= 20 && temp <= 30) {
    advice.push("Aaj farming ke liye bahut achha din hai");
    advice.push("Beej boone ya fertilizer dene ke liye sahi samay");
  }

  return advice.length > 0
    ? advice
    : ["Mausam theek hai — normal farming jaari rakhen"];
}

// ============================================================
// MARKET PRICES ROUTE
// ============================================================
app.get("/market-prices", async (req, res) => {
  const { crop, state } = req.query;

  try {
    const response = await fetch(
      `https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?api-key=${process.env.MARKET_API_KEY}&format=json&filters[commodity]=${crop || "Wheat"}&filters[state]=${state || "Punjab"}&limit=5`
    );
    const data = await response.json();

    if (data.records && data.records.length > 0) {
      const prices = data.records.map((r) => ({
        market: r.market,
        min_price: r.min_price,
        max_price: r.max_price,
        modal_price: r.modal_price,
        date: r.arrival_date,
      }));
      res.json({ crop, state, prices });
    } else {
      res.json({
        crop,
        state,
        prices: [],
        message: "Is fasal ke prices abhi available nahi hain",
      });
    }
  } catch (err) {
    res.status(500).json({ error: "Market price service error" });
  }
});

// ============================================================
// CROP CALENDAR ROUTE
// ============================================================
app.get("/crop-calendar", async (req, res) => {
  const month = new Date().getMonth() + 1;

  const calendar = {
    1: {
      season: "Rabi",
      sow: ["Sunflower", "Spring Maize"],
      harvest: ["Potato", "Mustard (late)"],
      tasks: ["Wheat irrigation", "Rabi crop care", "Pest monitoring"],
    },
    2: {
      season: "Rabi",
      sow: ["Summer Moong", "Watermelon"],
      harvest: ["Potato", "Gram"],
      tasks: ["Wheat flowering stage care", "Mustard harvesting prep"],
    },
    3: {
      season: "Zaid",
      sow: ["Watermelon", "Cucumber", "Moong"],
      harvest: ["Wheat (early)", "Mustard"],
      tasks: ["Land prep for Zaid", "Summer crop irrigation"],
    },
    4: {
      season: "Zaid",
      sow: ["Moong", "Urad"],
      harvest: ["Wheat", "Barley"],
      tasks: ["Wheat harvesting", "Threshing and storage", "Land preparation"],
    },
    5: {
      season: "Pre-Kharif",
      sow: [],
      harvest: ["Rabi crops complete"],
      tasks: ["Deep ploughing", "Soil testing", "Seed selection for Kharif"],
    },
    6: {
      season: "Kharif",
      sow: ["Rice", "Maize", "Cotton", "Soybean", "Groundnut"],
      harvest: [],
      tasks: [
        "Monsoon prep",
        "Kharif sowing after first rain",
        "Drainage arrangement",
      ],
    },
    7: {
      season: "Kharif",
      sow: ["Bajra", "Jowar", "Sugarcane"],
      harvest: [],
      tasks: ["Rice transplanting", "Weed control", "Fertilizer application"],
    },
    8: {
      season: "Kharif",
      sow: [],
      harvest: ["Early Maize"],
      tasks: [
        "Pest monitoring",
        "Cotton bollworm control",
        "Drainage in heavy rain",
      ],
    },
    9: {
      season: "Kharif",
      sow: ["Rabi prep"],
      harvest: ["Maize", "Groundnut"],
      tasks: ["Kharif harvesting prep", "Rabi land preparation"],
    },
    10: {
      season: "Rabi",
      sow: ["Wheat", "Barley", "Mustard", "Gram"],
      harvest: ["Rice", "Cotton (early)", "Soybean"],
      tasks: ["Rabi sowing", "Rice harvesting", "Soil moisture check"],
    },
    11: {
      season: "Rabi",
      sow: ["Late Wheat", "Peas", "Lentil"],
      harvest: ["Kharif complete", "Cotton"],
      tasks: ["Wheat irrigation", "Rabi fertilization", "Winter care"],
    },
    12: {
      season: "Rabi",
      sow: ["Spring Potato"],
      harvest: ["Late Cotton"],
      tasks: [
        "Frost protection",
        "Wheat care",
        "Irrigation scheduling",
        "Pest control",
      ],
    },
  };

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  res.json({
    month: monthNames[month - 1],
    ...calendar[month],
  });
});

// ============================================================
// CHAT ROUTE WITH LIVE DATA
// ============================================================
app.post("/chat", rateLimiter, async (req, res) => {
  const { message, city } = req.body;

  if (!message || message.trim() === "") {
    return res.status(400).json({ error: "Message is required." });
  }

  // Fetch live weather if city provided
  let liveWeatherContext = "";
  if (city) {
    try {
      const wRes = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${city},IN&appid=${process.env.WEATHER_API_KEY}&units=metric`
      );
      const wData = await wRes.json();
      if (wRes.ok) {
        liveWeatherContext = `
LIVE WEATHER FOR ${city.toUpperCase()} RIGHT NOW:
Temperature: ${wData.main.temp}°C
Humidity: ${wData.main.humidity}%
Condition: ${wData.weather[0].description}
Wind: ${wData.wind.speed} km/h
Use this real data when answering weather questions.`;
      }
    } catch (e) {
      console.log("Weather fetch failed:", e.message);
    }
  }

  // Get current crop calendar
  const month = new Date().getMonth() + 1;
  const cropSeasons = {
    1: "Rabi season — wheat, barley, mustard growing",
    2: "Rabi season — harvest preparation",
    3: "Zaid season — watermelon, cucumber sowing time",
    4: "Zaid + Rabi harvest — wheat harvesting",
    5: "Pre-Kharif — land prep, soil testing time",
    6: "Kharif begins — rice, cotton, soybean sowing",
    7: "Kharif — bajra, jowar, sugarcane sowing",
    8: "Kharif growing — pest monitoring critical",
    9: "Kharif harvest prep — maize, groundnut harvest",
    10: "Rabi sowing — wheat, mustard, gram",
    11: "Rabi — wheat irrigation, winter care",
    12: "Rabi — frost protection, wheat care",
  };

  try {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          max_tokens: 1000,
          temperature: 0.3,
          messages: [
            {
              role: "system",
              content: `You are Kisan Digital Sathi — specialized AI ONLY for Indian farmers.

CURRENT SEASON CONTEXT:
${cropSeasons[month]}
${liveWeatherContext}

AGRICULTURE KNOWLEDGE BASE:
${FARMING_KNOWLEDGE}

LANGUAGE RULES:
- Hindi message → reply in Hindi only
- Gujarati message → reply in Gujarati only
- English message → reply in simple English
- Never mix languages

RESPONSE FORMAT:
- Max 6 lines per answer
- Use bullet points for lists
- Always give specific amounts, dates, eligibility
- For schemes: mention amount + eligibility + how to apply
- For crops: mention season + soil + common disease
- End with one follow-up question
- Non-farming questions → "Main sirf kheti aur sarkari yojanaon mein help kar sakta hoon 🌾"
- Always mention helpline 1800-180-1551 for urgent problems`,
            },
            {
              role: "user",
              content: message,
            },
          ],
        }),
      }
    );

    const data = await response.json();
    if (!response.ok) {
      return res
        .status(response.status)
        .json({ error: data?.error?.message || "API error" });
    }

    res.json({ reply: data.choices[0].message.content });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Server error. Please try again." });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Kisan Sathi backend at http://localhost:${PORT}`);
});
