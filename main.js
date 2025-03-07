// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/你的倉庫名/', // 修改成你的 GitHub Repo 名稱
});

// package.json
{
  "name": "translation-app",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "predeploy": "npm run build",
    "deploy": "gh-pages -d dist"
  },
  "dependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "gh-pages": "^5.0.0"
  }
}

// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import TranslationApp from './TranslationApp';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <TranslationApp />
  </React.StrictMode>
);

// src/TranslationApp.jsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function TranslationApp() {
  const [text, setText] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [sourceLang, setSourceLang] = useState('日文');
  const [targetLang, setTargetLang] = useState('中文');
  const [tone, setTone] = useState('自然口語');

  const translateText = async () => {
    setLoading(true);
    try {
      const apiKey = import.meta.env.VITE_API_KEY; // 使用環境變數存 API Key
      const apiUrl = 'https://api.chatanywhere.tech/v1/chat/completions';

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: `請將以下${sourceLang}翻譯成${targetLang}，語氣為${tone}：${text}` }],
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API錯誤: ${errorText}`);
      }

      const data = await response.json();
      setResult(data.choices[0].message.content);
    } catch (error) {
      setResult(`翻譯失敗: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-10 bg-gradient-to-b from-green-50 to-green-100">
      <Card className="max-w-3xl mx-auto p-5 shadow-xl">
        <h1 className="text-3xl font-bold text-center mb-5">詮語翻譯</h1>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <Select value={sourceLang} onValueChange={setSourceLang}>
            <SelectTrigger>
              <SelectValue placeholder="選擇來源語言" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="日文">日文</SelectItem>
              <SelectItem value="英文">英文</SelectItem>
              <SelectItem value="中文">中文</SelectItem>
            </SelectContent>
          </Select>
          <Select value={targetLang} onValueChange={setTargetLang}>
            <SelectTrigger>
              <SelectValue placeholder="選擇目標語言" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="中文">中文</SelectItem>
              <SelectItem value="英文">英文</SelectItem>
              <SelectItem value="日文">日文</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Select value={tone} onValueChange={setTone} className="mb-4">
          <SelectTrigger>
            <SelectValue placeholder="選擇語氣" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="自然口語">自然口語</SelectItem>
            <SelectItem value="正式文書">正式文書</SelectItem>
            <SelectItem value="文學風格">文學風格</SelectItem>
          </SelectContent>
        </Select>
        <Textarea
          placeholder="輸入文字..."
          className="w-full mb-4"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Button onClick={translateText} disabled={loading || !text} className="w-full mb-4">
          {loading ? '翻譯中...' : '翻譯'}
        </Button>
        {result && (
          <CardContent className="bg-white rounded-xl shadow p-4">
            <p className="text-lg whitespace-pre-wrap">{result}</p>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
