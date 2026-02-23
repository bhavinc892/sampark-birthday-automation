const axios = require("axios");
const qrcode = require("qrcode-terminal");
const { Client, LocalAuth } = require("whatsapp-web.js");
const cron = require("node-cron");

// ===== CONFIG =====
const USERNAME = "9819263163";
const PASSWORD = "1998";
const GROUP_NAME = "Test cron";

// ===== WHATSAPP CLIENT =====
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--disable-gpu"
    ]
  }
});

client.on("qr", (qr) => {
  console.log("Scan QR Code:");
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("WhatsApp Client Ready!");
});

client.initialize();

// ===== API CALLS =====
async function getToken() {
  const res = await axios.post("https://m.sampark369.org/v1/auth/user/login", {
    userName: USERNAME,
    passCode: PASSWORD,
    remember: "true",
  });

  return res.data.result.token;
}

async function getBirthdays(token) {
  const res = await axios.get(
    "https://m.sampark369.org/v1/sam2api/member/birthdays",
    {
      headers: {
        token: token,
      },
    },
  );

  return res.data.data || [];
}

// ===== MESSAGE FORMAT =====
function formatMessage(list) {
  if (!list || !list.length) return null;
  const header =
    "Jai Swaminarayan\nDas na Das\n\nHappy Birthday to bhoolkus";

  const lines = list
    .map((p) => {
      const first = p.firstName || p.name || "Friend";
      const last = p.lastName || "";
      const name = [first, last].filter(Boolean).join(" bhai ");
      return `${name}`;
    })
    .join(" and ");

  return `${header} ${lines} 🎂🍰🎉🎊🥳`;
}

// ===== SEND MESSAGE =====
async function sendMessage(message) {
  const chats = await client.getChats();
  const group = chats.find((chat) => chat.isGroup && chat.name === GROUP_NAME);

  if (!group) {
    console.log("Group not found!");
    return;
  }

  await client.sendMessage(group.id._serialized, message);
  console.log("Message sent!");
}

// ===== MAIN FUNCTION =====
async function run() {
  try {
    console.log("Running Birthday Job...");

    const token = await getToken();
    const list = await getBirthdays(token);

    const message = formatMessage(list);

    if (!message) {
      console.log("No birthdays today");
      return;
    }

    await sendMessage(message);
  } catch (err) {
    console.error("Error:", err.message);
  }
}

// ===== SCHEDULE (every minute for testing) =====
//cron.schedule("0 9 * * *", () => {
cron.schedule("* * * * *", () => {
  run();
});

// For testing immediately
run();
