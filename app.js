document.addEventListener("DOMContentLoaded", () => {
    const imageInput = document.getElementById("imageInput");
    const ocrResult = document.getElementById("ocrResult");
    const translationResult = document.getElementById("translationResult");
    const languageSelect = document.getElementById("languageSelect");
    const translateButton = document.getElementById("translateButton");
    
    let ocrWorker;
    
    async function initOCR() {
        try {
            ocrWorker = await Tesseract.createWorker({
                logger: m => console.log(m)
            });
            // 修正：Tesseract.js 通常需要分開載入每種語言，或使用 "eng+chi_sim+jpn" 這種格式
            await ocrWorker.loadLanguage("eng+chi_sim+jpn");
            await ocrWorker.initialize("eng+chi_sim+jpn");
        } catch (error) {
            console.error("OCR初始化錯誤：", error);
            ocrResult.textContent = "OCR引擎初始化失敗，請重新載入頁面。";
        }
    }
    
    async function processImage(file) {
        try {
            if (!ocrWorker) {
                await initOCR();
            }
            
            const { data: { text } } = await ocrWorker.recognize(file);
            ocrResult.textContent = `OCR識別：${text}`;
        } catch (error) {
            console.error("圖片處理錯誤：", error);
            ocrResult.textContent = "圖片處理失敗，請嘗試另一張圖片。";
        }
    }
    
    async function translateText() {
        const text = ocrResult.textContent.replace("OCR識別：", "");
        const targetLang = languageSelect.value;
        
        if (!text.trim()) {
            translationResult.textContent = "請先上傳圖片並進行OCR識別。";
            return;
        }
        
        try {
            // 修正：添加源語言檢測，將源語言設為auto以便API自動檢測
            const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=auto|${targetLang}`);
            const data = await response.json();
            
            if (data.responseStatus === 200) {
                translationResult.textContent = `翻譯結果：${data.responseData.translatedText}`;
            } else {
                translationResult.textContent = `翻譯失敗：${data.responseDetails || "未知錯誤"}`;
            }
        } catch (error) {
            console.error("翻譯錯誤：", error);
            translationResult.textContent = "翻譯失敗，請稍後再試。";
        }
    }
    
    imageInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
            ocrResult.textContent = "正在處理圖片...";
            processImage(file);
        }
    });
    
    translateButton.addEventListener("click", translateText);
    
    // 添加錯誤處理
    initOCR().catch(err => {
        console.error("初始化失敗：", err);
        ocrResult.textContent = "OCR初始化失敗，請重新載入頁面。";
    });
});
