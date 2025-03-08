document.addEventListener("DOMContentLoaded", () => {
    const imageInput = document.getElementById("imageInput");
    const ocrResult = document.getElementById("ocrResult");
    const translationResult = document.getElementById("translationResult");
    const languageSelect = document.getElementById("languageSelect");
    const translateButton = document.getElementById("translateButton");
    
    let ocrWorker;
    
    async function initOCR() {
        ocrWorker = await Tesseract.createWorker({
            logger: m => console.log(m)
        });
        await ocrWorker.loadLanguage("chi_sim+eng+jpn");
        await ocrWorker.initialize("chi_sim+eng+jpn");
    }
    
    async function processImage(file) {
        if (!ocrWorker) {
            await initOCR();
        }
        
        const { data: { text } } = await ocrWorker.recognize(file);
        ocrResult.textContent = `OCR識別：${text}`;
    }
    
    async function translateText() {
        const text = ocrResult.textContent.replace("OCR識別：", "");
        const targetLang = languageSelect.value;
        
        if (!text.trim()) {
            translationResult.textContent = "請先上傳圖片並進行OCR識別。";
            return;
        }
        
        try {
            const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=zh|${targetLang}`);
            const data = await response.json();
            translationResult.textContent = `翻譯結果：${data.responseData.translatedText}`;
        } catch (error) {
            console.error("翻譯錯誤：", error);
            translationResult.textContent = "翻譯失敗，請稍後再試。";
        }
    }
    
    imageInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) processImage(file);
    });
    
    translateButton.addEventListener("click", translateText);
    
    initOCR();
});
