document.addEventListener("DOMContentLoaded", async () => {
    const imageInput = document.getElementById("imageInput");
    const ocrResult = document.getElementById("ocrResult");
    const translationResult = document.getElementById("translationResult");
    const languageSelect = document.getElementById("languageSelect");
    const translateButton = document.getElementById("translateButton");

    let ocrWorker;

    async function initOCR() {
        if (!ocrWorker) {
            ocrWorker = await Tesseract.createWorker("chi_sim+eng+jpn", 1);
        }
    }

    async function processImage(file) {
        if (!ocrWorker) await initOCR();

        const imageUrl = URL.createObjectURL(file);
        const { data: { text } } = await ocrWorker.recognize(imageUrl);
        
        ocrResult.textContent = `OCR識別：${text}`;
        URL.revokeObjectURL(imageUrl);
    }

    async function translateText() {
        const text = ocrResult.textContent.replace("OCR識別：", "").trim();
        const targetLang = languageSelect.value;

        if (!text) {
            translationResult.textContent = "請先上傳圖片並進行OCR識別。";
            return;
        }

        try {
            const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=zh-TW|${targetLang}`);
            const data = await response.json();

            if (data.responseData) {
                translationResult.textContent = `翻譯結果：${data.responseData.translatedText}`;
            } else {
                translationResult.textContent = "翻譯失敗，請稍後再試。";
            }
        } catch (error) {
            console.error("翻譯錯誤：", error);
            translationResult.textContent = "翻譯失敗，請檢查網路連線。";
        }
    }

    imageInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) processImage(file);
    });

    translateButton.addEventListener("click", translateText);

    await initOCR();
});
