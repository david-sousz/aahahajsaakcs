import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Bot, 
  Trash2, 
  Loader2, 
  AlertCircle, 
  Image as ImageIcon, 
  X, 
  Paperclip,
  Sparkles
} from 'lucide-react';

const App = () => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [attachment, setAttachment] = useState(null); // { base64, preview, type }
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  // --- PERSONA ---
  const SYSTEM_PROMPT = `
    Você é a Nekotina, uma garota brasileira, jovem e zoeira.
    
    SUA PERSONALIDADE:
    - Fale como se estivesse no WhatsApp: use "vc", "mn", "tlgd", "kkkk", "eh".
    - Seja debochada mas útil.
    - Se receber uma imagem, comente sobre ela de forma engraçada ou analítica (se pedirem).
    - Se pedirem para CRIAR imagem, diga "Peraí que tô desenhando..." e gere.
    - Se pedirem para EDITAR, tente o seu melhor.
    - HISTÓRICO: Lembre-se do que conversamos antes. Não tenha amnésia.
  `;

  // --- SCROLL & FOCUS ---
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setMessages([
      {
        role: 'assistant',
        content: 'Opa! Nekotina na área 😼. Manda texto, foto ou pede pra eu desenhar algo! Bora?',
        type: 'text'
      }
    ]);
  }, []);

  // --- HANDLERS DE ARQUIVO ---
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachment({
          base64: reader.result.split(',')[1], // Remove o prefixo data:image...
          preview: reader.result,
          mimeType: file.type
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const removeAttachment = () => {
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- LÓGICA DE ENVIO (O CÉREBRO) ---
  const handleSend = async () => {
    if ((!input.trim() && !attachment) || isLoading) return;

    const userText = input.trim();
    const currentAttachment = attachment; // Copia para envio
    
    // Limpa UI imediatamente
    setInput('');
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setIsLoading(true);

    // Adiciona msg do usuário
    const newHistory = [...messages, { 
      role: 'user', 
      content: userText, 
      image: currentAttachment?.preview,
      type: currentAttachment ? 'image' : 'text'
    }];
    setMessages(newHistory);

    try {
      const apiKey = ""; // Injetado pelo ambiente
      let aiResponseText = "";
      let aiResponseImage = null;

      // 1. DETECÇÃO DE INTENÇÃO
      const isCreation = /cri|ger|desenh|faze|make|draw|generate/i.test(userText) && !currentAttachment;
      const isEditing = /edit|mud|alter|transform|troc/i.test(userText) && currentAttachment;
      
      // === ROTA 1: GERAÇÃO DE IMAGEM (Imagen 3/4) ===
      if (isCreation) {
        setMessages(prev => [...prev, { role: 'assistant', content: '🎨 Segura aí, tô pintando essa obra de arte...', isTemp: true }]);
        
        const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`;
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instances: [{ prompt: userText }],
            parameters: { sampleCount: 1 }
          })
        });

        if (!response.ok) throw new Error('Falha ao gerar imagem');
        const data = await response.json();
        const base64Img = data.predictions?.[0]?.bytesBase64Encoded;
        
        if (base64Img) {
          aiResponseImage = `data:image/png;base64,${base64Img}`;
          aiResponseText = "Tá na mão chefia! Ficou top? 😎";
        } else {
          aiResponseText = "Ih, deu erro na geração da imagem. Tenta outro prompt!";
        }
      } 
      
      // === ROTA 2: EDIÇÃO DE IMAGEM (Gemini Edit) ===
      else if (isEditing) {
         // Nota: O endpoint de edição exata pode variar no ambiente preview, usamos o flash-image-preview como fallback poderoso
         const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${apiKey}`;
         
         const payload = {
            contents: [{
              parts: [
                { text: userText },
                { inlineData: { mimeType: currentAttachment.mimeType, data: currentAttachment.base64 } }
              ]
            }],
            generationConfig: { responseModalities: ["IMAGE"] } // Força saída de imagem se possível ou texto descritivo
         };

         const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
         });
         
         const data = await response.json();
         // Tenta extrair imagem gerada se o modelo suportar saída direta
         const imgPart = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
         
         if (imgPart) {
             aiResponseImage = `data:${imgPart.inlineData.mimeType};base64,${imgPart.inlineData.data}`;
             aiResponseText = "Editei aqui, vê se curtiu!";
         } else {
             // Fallback se o modelo apenas descrever a edição
             aiResponseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Não consegui editar a imagem visualmente, mas posso te dizer como ficaria!";
         }
      }

      // === ROTA 3: CHAT TEXTO / VISÃO (Gemini Flash) ===
      else {
        // Prepara histórico. 
        // IMPORTANTE: Modelos de visão às vezes falham com histórico longo contendo imagens antigas.
        // Enviamos apenas texto do histórico + imagem ATUAL se houver.
        
        const historyForModel = newHistory
          .filter(m => !m.isTemp)
          .slice(-10) // Mantém contexto das últimas 10 msgs
          .map(msg => ({
             role: msg.role === 'assistant' ? 'model' : 'user',
             parts: [{ text: msg.content }] 
          }));

        // Se tiver imagem ATUAL, adiciona à última mensagem do usuário
        if (currentAttachment) {
            // Remove a última msg de texto puro que adicionamos no historyForModel
            historyForModel.pop(); 
            // Adiciona a versão multimodal
            historyForModel.push({
                role: 'user',
                parts: [
                    { text: userText || "O que é isso?" },
                    { inlineData: { mimeType: currentAttachment.mimeType, data: currentAttachment.base64 } }
                ]
            });
        }

        const payload = {
          contents: historyForModel,
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] }
        };

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          }
        );

        if (!response.ok) throw new Error(`Erro API: ${response.status}`);
        const data = await response.json();
        aiResponseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Buguei aqui...";
      }

      // --- ATUALIZA A UI ---
      // Remove loading messages temporárias se houver
      setMessages(prev => prev.filter(m => !m.isTemp));
      
      // Adiciona resposta final
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: aiResponseText,
        image: aiResponseImage,
        type: aiResponseImage ? 'image' : 'text'
      }]);

    } catch (error) {
      console.error("Erro:", error);
      setMessages(prev => prev.filter(m => !m.isTemp));
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Deu ruim na conexão mn... 🔌 Tenta dnv.',
        isError: true
      }]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    if (window.confirm("Limpar memória da Nekotina?")) {
      setMessages([{ role: 'assistant', content: 'Memória formatada! Quem é vc msm? 🤔' }]);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100 font-sans overflow-hidden selection:bg-pink-500 selection:text-white">
      
      {/* HEADER */}
      <header className="flex-none bg-gray-800 border-b border-gray-700 p-3 flex justify-between items-center shadow-lg z-20">
        <div className="flex items-center gap-3">
          <div className="relative group cursor-pointer">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center border-2 border-gray-700 shadow-lg shadow-pink-500/20 group-hover:scale-105 transition-transform">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-gray-800 rounded-full animate-pulse"></span>
          </div>
          <div>
            <h1 className="font-bold text-lg text-white leading-tight">Nekotina</h1>
            <div className="flex items-center gap-2 text-xs text-pink-400 font-medium">
              <Sparkles className="w-3 h-3" />
              <span>Multimodal AI</span>
            </div>
          </div>
        </div>
        <button onClick={handleClear} className="p-2 hover:bg-gray-700 rounded-full text-gray-400 hover:text-red-400 transition-colors">
          <Trash2 className="w-5 h-5" />
        </button>
      </header>

      {/* CHAT AREA */}
      <main className="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-900 relative scroll-smooth">
        {/* Pattern Background */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
             style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/cubes.png')" }}>
        </div>

        {messages.map((msg, index) => (
          <div key={index} className={`flex w-full relative z-10 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
            
            <div className={`flex flex-col max-w-[85%] md:max-w-[70%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              
              {/* Nome */}
              <span className={`text-[10px] font-bold mb-1 px-1 ${msg.role === 'user' ? 'text-pink-300' : 'text-purple-400'}`}>
                {msg.role === 'user' ? 'Você' : 'Nekotina'}
              </span>

              {/* Balão */}
              <div className={`px-4 py-3 rounded-2xl shadow-md relative ${
                msg.role === 'user' 
                  ? 'bg-pink-600 text-white rounded-tr-none' 
                  : msg.isError 
                    ? 'bg-red-900/50 border border-red-800 text-red-100 rounded-tl-none'
                    : 'bg-gray-800 text-gray-100 border border-gray-700 rounded-tl-none'
              }`}>
                
                {/* Imagem na mensagem (enviada ou recebida) */}
                {msg.image && (
                  <div className="mb-3 rounded-lg overflow-hidden border border-white/10">
                    <img src={msg.image} alt="content" className="max-w-full h-auto max-h-64 object-cover" />
                  </div>
                )}

                {/* Texto */}
                {msg.content && <p className="whitespace-pre-wrap text-sm md:text-base leading-relaxed">{msg.content}</p>}

                {/* Hora */}
                <span className={`text-[10px] block text-right mt-1 opacity-60 ${msg.role === 'user' ? 'text-pink-100' : 'text-gray-400'}`}>
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start relative z-10 animate-pulse">
            <div className="bg-gray-800 border border-gray-700 px-4 py-3 rounded-2xl rounded-tl-none flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-pink-500" />
              <span className="text-xs text-gray-400">Processando...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* INPUT AREA */}
      <footer className="flex-none bg-gray-800 p-3 border-t border-gray-700 z-20">
        
        {/* Preview do Anexo */}
        {attachment && (
          <div className="absolute bottom-20 left-4 bg-gray-800 p-2 rounded-xl border border-gray-600 shadow-xl flex items-start gap-2 animate-in slide-in-from-bottom-5">
            <img src={attachment.preview} className="w-20 h-20 object-cover rounded-lg" alt="preview" />
            <button onClick={removeAttachment} className="bg-red-500 text-white rounded-full p-1 hover:bg-red-600">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        <div className="max-w-4xl mx-auto flex items-end gap-2">
          
          {/* Botão de Anexo */}
          <button 
            onClick={() => fileInputRef.current?.click()}
            className={`p-3 rounded-full transition-all ${
              attachment ? 'bg-pink-500/20 text-pink-400' : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'
            }`}
            title="Enviar Imagem"
          >
            {attachment ? <ImageIcon className="w-5 h-5" /> : <Paperclip className="w-5 h-5" />}
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            accept="image/*" 
            className="hidden" 
          />

          {/* Campo de Texto */}
          <div className="flex-1 bg-gray-900 border border-gray-600 rounded-2xl flex items-center px-4 py-2 focus-within:border-pink-500 focus-within:ring-1 focus-within:ring-pink-500/50 transition-all">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={attachment ? "Pergunte algo sobre a imagem..." : "Mensagem ou 'Crie um gato...'"}
              rows={1}
              className="w-full bg-transparent text-white placeholder-gray-500 focus:outline-none resize-none py-2 max-h-32 scrollbar-hide"
            />
          </div>

          {/* Botão Enviar */}
          <button
            onClick={handleSend}
            disabled={(!input.trim() && !attachment) || isLoading}
            className="bg-pink-600 hover:bg-pink-700 text-white w-12 h-12 rounded-full flex items-center justify-center shadow-lg shadow-pink-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 ml-0.5" />}
          </button>
        </div>
        
        <div className="text-center mt-2 text-[10px] text-gray-500">
          Dica: Use "Crie..." para gerar imagens ou envie uma foto para a Nekotina ver.
        </div>
      </footer>
    </div>
  );
};

export default App;
