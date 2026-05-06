// ✅ No API key here anymore!
const BACKEND_URL = "http://localhost:3001"; // Change this after deploying

const chatBox = document.querySelector(".chat-messages");
const input = document.querySelector(".chat-input");
const sendBtn = document.querySelector(".chat-send-btn");

let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 2000;

function addMessage(text, sender) {
  const msg = document.createElement("div");
  msg.className = `msg ${sender}`;
  msg.innerHTML = `
    <div class="msg-avatar">${sender === "bot" ? "🌾" : "👨"}</div>
    <div class="msg-bubble">${text}</div>
  `;
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function showTyping() {
  const typing = document.createElement("div");
  typing.className = "msg bot";
  typing.id = "typing";
  typing.innerHTML = `
    <div class="msg-avatar">🌾</div>
    <div class="typing-indicator">
      <span></span><span></span><span></span>
    </div>
  `;
  chatBox.appendChild(typing);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function removeTyping() {
  const typing = document.getElementById("typing");
  if (typing) typing.remove();
}

async function fetchReply(message) {
  const response = await fetch(`${BACKEND_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });

  const data = await response.json();

  if (!response.ok) {
    const err = new Error(data.error || "Server error");
    err.status = response.status;
    throw err;
  }

  return data.reply;
}

async function sendMessage() {
  const message = input.value.trim();
  if (!message) return;

  const now = Date.now();
  if (now - lastRequestTime < MIN_REQUEST_INTERVAL) {
    addMessage(
      "⏳ Please wait a moment before sending another message.",
      "bot",
    );
    return;
  }
  lastRequestTime = now;

  addMessage(message, "user");
  input.value = "";
  sendBtn.disabled = true;
  showTyping();

  try {
    const reply = await fetchReply(message);
    removeTyping();
    addMessage(reply, "bot");
  } catch (error) {
    removeTyping();
    console.error("Error:", error);
    if (error.status === 429) {
      addMessage("⚠️ Too many requests. Please wait a moment.", "bot");
    } else {
      addMessage("❌ Connection error. Please try again.", "bot");
    }
  } finally {
    sendBtn.disabled = false;
  }
}

sendBtn.addEventListener("click", sendMessage);
input.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMessage();
});

window.onload = () => {
  addMessage(
    "Namaste! 🌾 I am Kisan Digital Sathi. Ask me about farming, government schemes, or crop guidance.",
    "bot",
  );
};
