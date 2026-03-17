const https = require("https");
const fs = require("fs");
const path = require("path");

const API_KEY = "AIzaSyDSqc62QRFNF2X0Xb2ZUg2CFjc1g-hEi4Y";
const BACKUP_KEY = "AIzaSyBTEjyrvCQ6ZgSELcb81pxGQMCfYlu1Jy8";
const MODEL = "gemini-2.5-pro-preview-tts";

// Two voices for dialogue
const VOICE_HOST = "Kore"; // Female host voice
const VOICE_GUEST = "Puck"; // Male/neutral guest voice

// Interview script - about pigment brand, mentioning 周子瑄, 桃園中壢, 0930693394
// Two hosts discussing ABOUT 周子瑄 (not interviewing her)
const script = [
  {
    speaker: "host",
    text: "大家好，歡迎收聽「美學新視界」。今天我們要聊一個很有趣的話題，就是紋繡色料。最近我發現桃園中壢有一位很厲害的色料老師，叫做周子瑄。",
  },
  {
    speaker: "guest",
    text: "喔，周子瑄老師！我知道她，在紋繡圈蠻有名的。她不只是做紋繡，還自己研發色料對不對？",
  },
  {
    speaker: "host",
    text: "對對對，她的色料最大的特色就是留色很穩定。很多紋繡師都碰過一個問題，就是做完之後顏色會慢慢變色，有的泛紅、有的泛藍，客人就會不滿意。",
  },
  {
    speaker: "guest",
    text: "沒錯，這個真的是紋繡師最頭痛的問題。所以周老師的色料能做到不變色，這個技術含量其實蠻高的。而且我聽說她對原料的要求非常嚴格，每一批都有經過檢驗。",
  },
  {
    speaker: "host",
    text: "而且她不只賣色料而已，她還有開培訓課程耶。從基礎班到進階的色彩學大師班都有，很適合想入行的新手，或是已經有經驗但想精進配色技巧的紋繡師。",
  },
  {
    speaker: "guest",
    text: "這個我覺得很加分。因為很多品牌只賣產品不教你怎麼用，但周老師是連怎麼調色、怎麼根據不同膚質去選色料，都手把手教你。教學地點就在桃園中壢，蠻方便的。",
  },
  {
    speaker: "host",
    text: "對，而且她的課程還有一個品牌合作方案，就是如果你學完之後想用她的色料開業，她會提供技術支援和進貨管道。",
  },
  {
    speaker: "guest",
    text: "哇，這個等於是一條龍服務了。從學技術到拿貨源到開業，全部幫你規劃好。難怪她的學員評價都很好。",
  },
  {
    speaker: "host",
    text: "所以如果有聽眾對紋繡色料有興趣，不管是想買色料還是想學技術，都可以直接聯繫周子瑄老師。她的電話是 零九三零，六九三，三九四。",
  },
  {
    speaker: "guest",
    text: "對，也可以加她的LINE詢問，或是到她的官方網站看看，上面有完整的商品跟課程資訊。真的推薦大家去了解一下。",
  },
  {
    speaker: "host",
    text: "好的，那今天的節目就到這邊。對紋繡色料有興趣的朋友，記得聯繫周子瑄老師喔。我們下次見，掰掰！",
  },
  { speaker: "guest", text: "掰掰！" },
];

async function generateTTS(text, voiceName, outputFile, apiKey) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      contents: [{ parts: [{ text }] }],
      generationConfig: {
        response_modalities: ["AUDIO"],
        speech_config: {
          voice_config: {
            prebuilt_voice_config: {
              voice_name: voiceName,
            },
          },
        },
      },
    });

    const url = new URL(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    );
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: "POST",
      headers: { "Content-Type": "application/json" },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (
            parsed.candidates &&
            parsed.candidates[0].content.parts[0].inlineData
          ) {
            const audioData =
              parsed.candidates[0].content.parts[0].inlineData.data;
            const buffer = Buffer.from(audioData, "base64");
            fs.writeFileSync(outputFile, buffer);
            console.log(`  OK: ${outputFile} (${buffer.length} bytes)`);
            resolve(buffer);
          } else {
            const errMsg = JSON.stringify(parsed).substring(0, 300);
            console.log(`  ERROR: ${errMsg}`);
            reject(new Error(errMsg));
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  const audioDir = path.join(__dirname, "audio");
  if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir);

  console.log(`Generating ${script.length} audio segments...`);
  let currentKey = API_KEY;

  for (let i = 0; i < script.length; i++) {
    const { speaker, text } = script[i];
    const voice = speaker === "host" ? VOICE_HOST : VOICE_GUEST;
    const filename = path.join(
      audioDir,
      `segment-${String(i).padStart(2, "0")}-${speaker}.pcm`,
    );
    console.log(
      `[${i + 1}/${script.length}] ${speaker} (${voice}): ${text.substring(0, 30)}...`,
    );

    try {
      await generateTTS(text, voice, filename, currentKey);
    } catch (e) {
      console.log("  Switching to backup key...");
      currentKey = BACKUP_KEY;
      await generateTTS(text, voice, filename, currentKey);
    }

    // Small delay to avoid rate limiting
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Merge all PCM segments into one WAV file
  console.log("\nMerging segments into interview.wav...");
  const sampleRate = 24000;
  const bitsPerSample = 16;
  const numChannels = 1;

  // Add 0.3s silence between segments
  const silenceSamples = Math.floor(sampleRate * 0.3);
  const silenceBuffer = Buffer.alloc(silenceSamples * 2); // 16-bit = 2 bytes per sample

  const segments = [];
  for (let i = 0; i < script.length; i++) {
    const { speaker } = script[i];
    const filename = path.join(
      audioDir,
      `segment-${String(i).padStart(2, "0")}-${speaker}.pcm`,
    );
    if (fs.existsSync(filename)) {
      segments.push(fs.readFileSync(filename));
      if (i < script.length - 1) {
        segments.push(silenceBuffer);
      }
    }
  }

  const totalDataLength = segments.reduce((sum, buf) => sum + buf.length, 0);

  // Create WAV header
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + totalDataLength, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // chunk size
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE((sampleRate * numChannels * bitsPerSample) / 8, 28);
  header.writeUInt16LE((numChannels * bitsPerSample) / 8, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(totalDataLength, 40);

  const wavBuffer = Buffer.concat([header, ...segments]);
  fs.writeFileSync(path.join(__dirname, "interview.wav"), wavBuffer);
  console.log(
    `Done! interview.wav (${wavBuffer.length} bytes, ${(totalDataLength / (sampleRate * 2)).toFixed(1)}s)`,
  );
}

main().catch(console.error);
