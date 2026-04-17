require("dotenv").config();

const axios = require("axios");
const cron = require("node-cron");

// ===== CONFIG =====
const SAMPARK_USERNAME = process.env.SAMPARK_USERNAME;
const SAMPARK_PASSWORD = process.env.SAMPARK_PASSWORD;

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

// ===== BROWSER-LIKE HEADERS =====
// Mimic a real mobile Chrome browser to avoid bot detection.
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  Origin: "https://m.sampark369.org",
  Referer: "https://m.sampark369.org/",
  Connection: "keep-alive",
};

async function getToken() {
  try {
    const res = await axios.post(
      "https://m.sampark369.org/v1/auth/user/login",
      {
        userName: SAMPARK_USERNAME,
        passCode: SAMPARK_PASSWORD,
      },
      {
        headers: {
          ...BROWSER_HEADERS,
          "Content-Type": "application/json",
        },
      }
    );

    const token = res.data?.result?.token;
    if (!token) {
      console.error("[Sampark login] No token found in the response.");
      return undefined;
    }

    console.log("[Sampark login] Token received successfully.");
    return token;
  } catch (error) {
    console.error("[Sampark login] Error:", error);
    return undefined;
  }
}

async function getBirthdays(token) {
  try {
    const res = await axios.get(
      "https://m.sampark369.org/v1/sam2api/member/birthdays",
      {
        headers: {
          ...BROWSER_HEADERS,
          "Content-Type": "application/json",
          token: token,
        },
      },
    );

    const birthdays = res.data?.data || [];
    console.log(`[Sampark birthdays] Fetched ${birthdays.length} birthday(s).`);
    return birthdays;
  } catch (error) {
    if (error.response) {
      console.error(
        `[Sampark birthdays] HTTP ${error.response.status}:`,
        error.response.data
      );
    } else {
      console.error("[Sampark birthdays] Error:", error.message);
    }
    return [];
  }
}

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

async function sendTelegramMessage(message) {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.error(
      "[Telegram] BOT_TOKEN and CHAT_ID must be set in the environment",
    );
    return false;
  }

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  try {
    await axios.post(url, {
      chat_id: CHAT_ID,
      text: message,
    });

    console.log("[Telegram] Message sent successfully");
    return true;
  } catch (err) {
    console.error("[Telegram sendMessage] Error:", err);
    return false;
  }
}

async function run() {
  try {
    if (!SAMPARK_USERNAME || !SAMPARK_PASSWORD) {
      console.error("SAMPARK_USERNAME and SAMPARK_PASSWORD must be set in the environment");
      return false;
    }

    console.log(`[Birthday job] Starting at ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}...`);

    const token = await getToken();
    if (!token) {
      console.error(
        "[Birthday job] No Sampark session token (invalid credentials, API error, or unexpected response — see logs above)",
      );
      return false;
    }

    const list = await getBirthdays(token);

    const message = formatMessage(list);

    if (!message) {
      console.log(`[Birthday job] No birthdays found for today (${new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}).`);
      return true;
    }

    const sent = await sendTelegramMessage(message);
    if (!sent) {
      console.error("[Birthday job] Telegram send failed");
      return false;
    }

    return true;
  } catch (err) {
    console.error("[Birthday job] Unexpected error:", err);
    return false;
  }
}

const isGitHubActions = process.env.GITHUB_ACTIONS === "true";

if (isGitHubActions) {
  run()
    .then((ok) => {
      process.exit(ok ? 0 : 1);
    })
    .catch((err) => {
      console.error("[Birthday job] Fatal:", err);
      process.exit(1);
    });
} else {
  cron.schedule(
    "*/30 * * * * *",
    () => {
      run();
    },
    { timezone: "Asia/Kolkata" },
  );
}
