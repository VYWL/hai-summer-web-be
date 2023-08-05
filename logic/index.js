const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const FormData = require("form-data");
const fs = require("fs");
const dotenv = require("dotenv");

dotenv.config();

const ocr_url = process.env.OCR_ENDPOINT;
const ocr_secret = process.env.OCR_KEY;
const gpt_secret = process.env.GPT_KEY;

const checkKeyLoaded = () => {
    console.log(ocr_secret);
    console.log(gpt_secret);
    console.log(ocr_url);
};

const getSummarizedText = async inputText => {
    const prompt = `다음 OCR 결과에 적절한 제목을 붙이고 4줄 이내로 요약하세요.
  항상 한국어로 답변해 주세요.

  ### OCR 결과:

  ${inputText}
  제목: 다음에 본문의 제목을, 요약 결과: 다음에 요약 결과를 입력하세요.
  요약 결과의 각 줄은 1. 2. 3. 과 같이 숫자로 시작해야 합니다.`;

    const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
            model: "gpt-3.5-turbo",
            temperature: 0,
            messages: [{ role: "user", content: prompt }],
        },
        {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${gpt_secret}`,
            },
        }
    );

    const chatCompletion = response.data.choices[0].message.content;

    return chatCompletion;
};

const getTextOCRresult = async file => {
    const message = {
        images: [
            {
                format: "png",
                name: "demo",
            },
        ],
        requestId: uuidv4(),
        version: "V2",
        timestamp: Date.now(),
    };

    const formData = new FormData();

    formData.append("file", file);
    formData.append("message", JSON.stringify(message));

    const headers = {
        "X-OCR-SECRET": ocr_secret,
        ...formData.getHeaders(),
    };

    try {
        const response = await axios.post(ocr_url, formData, { headers });

        if (response.status === 200) {
            return response.data;
        } else {
            console.log("Error : " + response.statusText);
            return null;
        }
    } catch (error) {
        console.error("Error : " + error);
        console.log(error);
    }
};

const addRequestToJson = (path, obj) => {
    let data;

    try {
        data = JSON.parse(fs.readFileSync(path));
    } catch (error) {
        data = [];
    }

    data.push(obj);

    fs.writeFileSync(path, JSON.stringify(data, null, 4));
};

const parseOCRresponse = response => {
    let parsedText = "";

    if (response.images && response.images[0].fields) {
        response.images[0].fields.forEach(field => {
            parsedText += field.inferText + " ";
            if (field.lineBreak) {
                parsedText += "\n";
            }
        });
    }

    return parsedText;
};

module.exports = { getTextOCRresult, parseOCRresponse, addRequestToJson, checkKeyLoaded, getSummarizedText };
