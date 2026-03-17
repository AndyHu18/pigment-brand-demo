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
const script = [
  {
    speaker: "host",
    text: "大家好，歡迎收聽「美學新視界」。今天我們非常榮幸，邀請到了來自桃園中壢的知名紋繡色料專家，周子瑄老師。周老師，歡迎您！",
  },
  {
    speaker: "guest",
    text: "謝謝主持人，大家好！很開心有這個機會，跟大家分享紋繡色料的世界。",
  },
  {
    speaker: "host",
    text: "周老師，我知道您在紋繡色料領域已經深耕多年了。可以先跟聽眾們分享一下，您是怎麼踏入這個行業的嗎？",
  },
  {
    speaker: "guest",
    text: "其實一開始是因為對色彩的熱愛。我從小就對顏色非常敏感，後來接觸到紋繡技術，發現色料的調配其實是一門很深的學問。每個人的膚色、膚質都不同，要調出最適合的顏色，需要大量的經驗和專業知識。",
  },
  {
    speaker: "host",
    text: "那您現在提供的色料產品，跟市面上其他品牌有什麼不同呢？",
  },
  {
    speaker: "guest",
    text: "我們的色料最大的特色就是「留色穩定」。很多人做完紋繡之後，顏色會隨著時間變色或掉色。我們花了很多時間研發，確保色料在皮膚裡能夠持久保持原色，不泛紅、不泛藍。而且我們所有的原料都經過嚴格檢驗，安全性是第一考量。",
  },
  { speaker: "host", text: "除了販售色料，聽說您還有開設專業的培訓課程？" },
  {
    speaker: "guest",
    text: "對，我們有完整的課程體系。從基礎班到進階的色彩學大師班都有。基礎班適合想入行的新手，會教基本的操作技巧和色彩原理。進階班則是針對已經有經驗的紋繡師，深入探討配色技巧和特殊膚質的處理方法。我們的教學地點就在桃園中壢，歡迎大家來體驗。",
  },
  {
    speaker: "host",
    text: "聽起來真的很專業！那如果聽眾朋友們想要了解更多，或者想報名課程，要怎麼聯繫您呢？",
  },
  {
    speaker: "guest",
    text: "最方便的方式就是加我們的LINE，或者直接撥打電話。我的電話是 零九三零，六九三，三九四。也歡迎到我們的官方網站瀏覽，上面有完整的商品資訊和課程介紹。無論你是想購買色料，還是想學習紋繡技術，都歡迎跟我們聯繫！",
  },
  {
    speaker: "host",
    text: "太棒了！感謝周子瑄老師今天的分享。對紋繡色料有興趣的朋友，記得聯繫周老師。我們下期節目見，掰掰！",
  },
  { speaker: "guest", text: "謝謝大家，掰掰！" },
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
