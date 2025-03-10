// 在 init() 函數中添加此代碼以初始化 Hugging Face iframe
function initHuggingFaceTab() {
    // 設置 iframe 來源 URL
    updateIframeTheme();
    
    // 添加重新載入按鈕功能
    const refreshBtn = document.getElementById("refreshIframeBtn");
    if (refreshBtn) {
        refreshBtn.addEventListener("click", () => {
            updateIframeTheme();
            showNotification("已重新載入 Hugging Face 介面", "info");
        });
    }
}

// 更新 iframe 的主題
function updateIframeTheme() {
    const isDarkMode = document.body.classList.contains("dark-theme");
    const iframe = document.getElementById("huggingfaceFrame");
    if (iframe) {
        const baseUrl = "https://qwerty10218-gary-translate.hf.space";
        iframe.src = `${baseUrl}?__theme=${isDarkMode ? 'dark' : 'light'}`;
    }
}

// 在 initTheme() 函數中添加
// 點擊主題切換按鈕時更新 iframe 主題
document.getElementById("themeToggle").addEventListener("click", () => {
    // 現有的主題切換代碼...
    
    // 更新 iframe 主題
    updateIframeTheme();
});

// 顯示通知函數 (如果尚未實現)
function showNotification(message, type = "info") {
    // 創建通知元素
    const notification = document.createElement("div");
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // 添加到頁面
    document.body.appendChild(notification);
    
    // 顯示通知
    setTimeout(() => {
        notification.classList.add("show");
    }, 10);
    
    // 自動移除
    setTimeout(() => {
        notification.classList.remove("show");
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// 確保在 init() 函數中調用 initHuggingFaceTab()
function init() {
    // 現有的初始化代碼...
    
    initHuggingFaceTab();
}
