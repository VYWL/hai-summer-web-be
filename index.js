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

app.post("/summary", async (req, res) => {
    if (!req.body.text) {
        return res.status(400).send({ error: "Text is required" });
    }

    const ret = await getSummarizedText(req.body.text);

    if (!ret) {
        return res.status(400).send({ error: "Error!" });
    }

    res.statusCode = 200;
    res.send({ success: true, data: ret });

    addRequestToJson("./result.json", {
        type: "GPT",
        input: req.body.text,
        result: ret,
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
