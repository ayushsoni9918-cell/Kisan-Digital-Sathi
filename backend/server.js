require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ============================================================
// AGRICULTURE KNOWLEDGE BASE
// ============================================================
const FARMING_KNOWLEDGE = `
GOVERNMENT SCHEMES:
1. PM-Kisan: ₹6000/year in 3 installments of ₹2000. Eligibility: farmers with up to 2 hectares land. Apply at pmkisan.gov.in or nearest CSC center. Need: Aadhaar, bank account, land records.
2. PMFBY (Crop Insurance): Covers crop loss from drought, flood, pest. Premium: 2% for Kharif, 1.5% for Rabi, 5% for horticulture. Apply before sowing through bank or CSC.
3. Kisan Credit Card: Credit up to ₹3 lakh at 4% interest. Apply at any nationalized bank. Need: Aadhaar, land proof, bank account.
4. eNAM: Online mandi platform. Sell crops directly to buyers. Register at enam.gov.in. Available in 1000+ mandis.
5. Soil Health Card: Free soil testing every 2 years. Visit nearest agriculture office.
6. Kisan Samman Nidhi: Same as PM-Kisan.
7. PM Fasal Bima: Same as PMFBY.
8. Digital Agriculture Mission: Free digital tools and training for all registered farmers.
9. AgriStack: Unified farmer database — digital identity for all farmers.

CROP GUIDANCE BY SEASON:
KHARIF (June-October): Rice, Maize, Cotton, Sugarcane, Soybean, Groundnut, Bajra
- Sow after first monsoon rain
- Rice needs 20-25°C, 150cm+ rainfall
- Cotton needs deep black soil, 21-30°C

RABI (November-April): Wheat, Barley, Mustard, Gram, Peas
- Sow in October-November after monsoon
- Wheat needs 10-15°C at sowing, 21-26°C at harvest
- Mustard grows well in sandy loam soil

ZAID (March-June): Watermelon, Cucumber, Muskmelon, Moong

SOIL TYPES:
- Black soil (Regur): Best for cotton, sugarcane, wheat. Found in Maharashtra, MP, Gujarat
- Red soil: Good for millets, pulses, oilseeds. Found in Tamil Nadu, Karnataka, AP
- Alluvial soil: Best for rice, wheat, sugarcane. Found in Punjab, UP, Bihar
- Laterite soil: Good for tea, coffee, cashew. Found in Kerala, Karnataka hills

COMMON DISEASES & SOLUTIONS:
- Rice blast: Use Tricyclazole fungicide, maintain proper water level
- Wheat rust: Use Propiconazole, sow resistant varieties
- Cotton bollworm: Use Bt cotton varieties, neem-based pesticides
- Late blight (potato/tomato): Use Mancozeb, avoid overhead irrigation

FERTILIZER GUIDE:
- Rice: NPK 120:60:60 kg/hectare
- Wheat: NPK 120:60:40 kg/hectare
- Cotton: NPK 150:75:75 kg/hectare
- Always do soil test before applying fertilizers
- Organic: Use FYM 10 tons/hectare

HELPLINES:
- Kisan Call Center: 1800-180-1551 (free, 24x7)
- PM-Kisan: 155261
- Agriculture Ministry: 011-23382012
- Weather forecast: 1800-180-1717

DIGITAL TOOLS:
- Kisan Suvidha App: Weather, market prices, plant protection
- mKisan Portal: SMS advisory service
- AgriMarket App: Real-time mandi prices
- Crop Insurance App: PMFBY enrollment
`;

// ============================================================
// CROP CALENDAR (current month auto-detected)
// ============================================================
const CROP_CALENDAR = {
  1:  "Rabi season — wheat, barley, mustard growing. Irrigation important.",
  2:  "Rabi season — harvest preparation for mustard and gram.",
  3:  "Zaid season — watermelon, cucumber, moong sowing time.",
  4:  "Zaid + Rabi harvest — wheat and barley harvesting.",
  5:  "Pre-Kharif — deep ploughing, soil testing, seed selection.",
  6:  "Kharif begins — rice, cotton, soybean, groundnut sowing after first rain.",
  7:  "Kharif — bajra, jowar, sugarcane sowing. Rice transplanting.",
  8:  "Kharif growing — pest monitoring critical. Cotton bollworm alert.",
  9:  "Kharif harvest prep — maize, groundnut harvest. Rabi land prep.",
  10: "Rabi sowing — wheat, mustard, gram. Rice harvesting.",
  11: "Rabi — wheat irrigation, fertilization, winter care.",
  12: "Rabi — frost protection critical. Wheat care and irrigation.",
};

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
// WEATHER ROUTE
// ============================================================
app.get("/weather", async (req, res) => {
  const { city } = req.query;
  if (!city) return res.status(400).json({ error: "City is required" });

  try {
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${city},IN&appid=${process.env.WEATHER_API_KEY}&units=metric`
    );
    const data = await response.json();

    if (!response.ok) {
      return res.status(404).json({ error: "City not found" });
    }

    const advice = getFarmingAdvice(
      data.main.temp,
      data.main.humidity,
      data.weather[0].main
    );

    res.json({
      city: data.name,
      temp: data.main.temp,
      feels_like: data.main.feels_like,
      humidity: data.main.humidity,
      description: data.weather[0].description,
      wind_speed: data.wind.speed,
      farming_advice: advice,
    });
  } catch (err) {
    res.status(500).json({ error: "Weather service error" });
  }
});

function getFarmingAdvice(temp, humidity, condition) {
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
    advice.push("Zyada nami — fungal bimari ka khatra");
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
app.get("/crop-calendar", (req, res) => {
  const month = new Date().getMonth() + 1;
  const monthNames = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
  ];
  res.json({
    month: monthNames[month - 1],
    advice: CROP_CALENDAR[month],
  });
});

// ============================================================
// MAIN CHAT ROUTE
// ============================================================
app.post("/chat", rateLimiter, async (req, res) => {
  const { message, city } = req.body;

  if (!message || message.trim() === "") {
    return res.status(400).json({ error: "Message is required." });
  }

  // Fetch live weather if city is provided
  let liveWeatherContext = "";
  if (city && process.env.WEATHER_API_KEY) {
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
Farming advice: ${getFarmingAdvice(wData.main.temp, wData.main.humidity, wData.weather[0].main).join(", ")}`;
      }
    } catch (e) {
      console.log("Weather fetch failed:", e.message);
    }
  }

  const month = new Date().getMonth() + 1;

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

CURRENT SEASON (Month ${month}):
${CROP_CALENDAR[month]}
${liveWeatherContext}

AGRICULTURE KNOWLEDGE BASE:
${FARMING_KNOWLEDGE}

LANGUAGE RULES:
- Hindi message → reply ONLY in Hindi
- Gujarati message → reply ONLY in Gujarati
- English message → reply in simple English
- NEVER mix languages in one reply
- Use simple words a farmer understands

RESPONSE RULES:
- Answer ONLY farming, crops, weather, government schemes
- Non-farming questions → say "Main sirf kheti aur sarkari yojanaon mein help kar sakta hoon 🌾"
- Always give SPECIFIC answers — amounts, eligibility, how to apply
- For schemes → eligibility + benefit amount + apply process
- For crops → season + soil type + disease + fertilizer
- For weather → use live data if available
- Keep answers to max 6 lines
- End with one helpful follow-up question
- Urgent problems → always mention 1800-180-1551

FORMAT:
- Bullet points for lists
- Specific ₹ amounts and dates
- Never use technical jargon
- Simple farmer-friendly language`,
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
      console.error("Groq error:", data);
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

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, () => {
  console.log(`✅ Kisan Sathi backend running at http://localhost:${PORT}`);
});
