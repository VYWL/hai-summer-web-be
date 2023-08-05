const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { parseOCRresponse, addRequestToJson, getTextOCRresult, checkKeyLoaded, getSummarizedText } = require("./logic");

const app = express();
const port = 8081;

// 현재 시간을 파일 이름으로 사용하는 multer storage 설정
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./requests");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // 현재 시간을 파일명으로 설정
    },
});

const upload = multer({ storage: storage });

// Create a write stream (in append mode) to the log file
const logFilePath = path.join(__dirname, "access.log");
const logStream = fs.createWriteStream(logFilePath, { flags: "a" });

// Middleware 설정
app.use(cors()); // CORS 활성화
app.use(morgan("dev")); // 로깅 활성화 (console)
app.use(morgan("combined", { stream: logStream })); // 로깅 활성화 (file)
app.use(express.json()); // JSON 파싱 활성화
app.use(express.urlencoded({ extended: true })); // URL-encoded 파싱 활성화

// API
app.post("/ocr", upload.single("image"), async (req, res) => {
    // 이미지 파일이 없는 경우 오류 반환
    if (!req.file) {
        return res.status(400).send({ error: "Image file is required" });
    }

    const imageFile = fs.createReadStream("./" + req.file.path);
    const ret = await getTextOCRresult(imageFile);

    if (!ret) {
        return res.status(400).send({ error: "Error!" });
    }

    const refinedData = parseOCRresponse(ret);

    res.statusCode = 200;
    res.send({ success: true, data: refinedData });

    addRequestToJson("./result.json", {
        type: "OCR",
        path: req.file.path,
        data: refinedData,
    });
});

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const dummy = `제목: GDSC Hanyang의 회합 일정과 형식
요약 결과:
1. GDSC Hanyang은 회합일을 월요일 저녁으로 고정하고 매주 진행한다.
2. 회합은 3개의 기간으로 나뉘며, 첫주는 23.09~23.10, 둘째주는 23.11~23.12이다.
3. 온라인과 오프라인을 격주로 섞을 수 있지만, 아직 확정되지 않았다.`;

app.post("/summary", async (req, res) => {
    if (!req.text) {
        return res.status(400).send({ error: "Text is required" });
    }

    await sleep(2500);

    const ret = dummy; // await getSummarizedText(req.text);

    if (!ret) {
        return res.status(400).send({ error: "Error!" });
    }

    res.statusCode = 200;
    res.send({ success: true, data: ret });

    addRequestToJson("./result.json", {
        type: "GPT",
        data: ret,
    });
});

// Application
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);

    // ./requests 폴더가 없으면 생성
    if (!fs.existsSync("./requests")) {
        fs.mkdirSync("./requests");
    }
});
