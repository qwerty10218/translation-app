document.addEventListener("DOMContentLoaded", () => {
    // 配置
    const API_CONFIG = {
        URL: "https://free.v36.cm/v1/chat/completions",
        KEY: "sk-TvndIpBUNiRsow2f892949F550B741CbBc16A098FcCc7827",
        TIMEOUT: 15000
    };

    // 獲取 DOM 元素
    const dom = {
        tabs: document.querySelectorAll(".tab-button"),
        tabContents: document.querySelectorAll(".tab-content"),
        
        // 文本翻譯相關
        inputText: document.getElementById("inputText"),
        translateBtn: document.getElementById("translateButton"),
        result: document.getElementById("result"),
        sourceLang: document.getElementById("sourceLang"),
        targetLang: document.getElementById("targetLang"),
        swapLang: document.getElementById("swapLang"),

        // 圖片翻譯相關
        imageInput: document.getElementById("imageInput"),
        imageCanvas: document.getElementById("imageCanvas"),
        extractTextBtn: document.getElementById("extractTextButton"),
        translateExtractedBtn: document.getElementById("translateExtractedButton"),
        extractedText: document.getElementById("extractedText"),
    };

    function init() {
        initTabs();
        initTextTranslation();
        initImageTranslation();
    }

    function initTabs() {
        dom.tabs.forEach(tab => {
            tab.addEventListener("click", () => {
                dom.tabs.forEach(t => t.classList.remove("active"));
                dom.tabContents.forEach(c => c.classList.remove("active"));

                tab.classList.add("active");
                const tabId = tab.getAttribute("data-tab");
                document.getElementById(tabId).classList.add("active");

                dom.result.textContent = "";
                dom.extractedText.textContent = "";
            });
        });
    }

    function initTextTranslation() {
        dom.translateBtn.addEventListener("click", handleTranslation);
        dom.swapLang.addEventListener("click", swapLanguages);
        dom.inputText.addEventListener("input", validateTranslationInput);
    }

    function swapLanguages() {
        const temp = dom.sourceLang.value;
        dom.sourceLang.value = dom.targetLang.value;
        dom.targetLang.value = temp;

        if (dom.sourceLang.value === dom.targetLang.value) {
            dom.targetLang.selectedIndex = (dom.targetLang.selectedIndex + 1) % dom.targetLang.options.length;
        }

        validateTranslationInput();
    }

    function validateTranslationInput() {
        dom.translateBtn.disabled = !dom.inputText.value.trim();
    }

    async function handleTranslation() {
        const text = dom.inputText.value.trim();
        if (!text) {
            alert("請輸入要翻譯的內容");
            return;
        }

        dom.result.textContent = "翻譯中...";
        try {
            const response = await fetch(API_CONFIG.URL, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${API_CONFIG.KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "gpt-3.5-turbo",
                    messages: [{ role: "user", content: `請將以下${dom.sourceLang.value}文本翻譯成${dom.targetLang.value}：\n\n${text}` }]
                })
            });

            const data = await response.json();
            dom.result.textContent = data.choices?.[0]?.message?.content || "翻譯失敗";
        } catch (error) {
            dom.result.textContent = `請求失敗：${error.message}`;
        }
    }

    function initImageTranslation() {
        dom.imageInput.addEventListener("change", handleImageUpload);
        dom.extractTextBtn.addEventListener("click", extractTextFromImage);
        dom.translateExtractedBtn.addEventListener("click", translateExtractedText);
    }

    function handleImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            alert("請上傳圖片文件");
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = dom.imageCanvas;
                const ctx = canvas.getContext("2d");

                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0, img.width, img.height);
                
                dom.extractTextBtn.disabled = false;
            };
            img.onerror = () => alert("圖片載入失敗，請使用其他圖片。");
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    async function extractTextFromImage() {
        dom.extractTextBtn.disabled = true;
        dom.translateExtractedBtn.disabled = true;
        dom.extractedText.textContent = "識別中...";

        try {
            const { data } = await Tesseract.recognize(dom.imageCanvas, "chi_tra+eng");

            const extractedText = data.text.trim();
            dom.extractedText.textContent = extractedText || "未能識別出文字";

            dom.translateExtractedBtn.disabled = !extractedText;
        } catch (error) {
            dom.extractedText.textContent = `識別失敗：${error.message}`;
        } finally {
            dom.extractTextBtn.disabled = false;
        }
    }

    async function translateExtractedText() {
        const extractedText = dom.extractedText.textContent.trim();
        if (!extractedText) {
            alert("沒有可翻譯的文字");
            return;
        }

        dom.extractedText.textContent = "翻譯中...";
        try {
            const response = await fetch(API_CONFIG.URL, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${API_CONFIG.KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "gpt-3.5-turbo",
                    messages: [{ role: "user", content: `請將以下文本翻譯成${dom.targetLang.value}：\n\n${extractedText}` }]
                })
            });

            const data = await response.json();
            dom.extractedText.textContent = data.choices?.[0]?.message?.content || "翻譯失敗";
        } catch (error) {
            dom.extractedText.textContent = `請求失敗：${error.message}`;
        }
    }

    init();
});
