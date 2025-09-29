import React, { useState, useRef, useEffect } from "react";
import styles from "./Chatbot.module.css";

const API_URL = `${import.meta.env.VITE_BACKEND_URL}/api/ai/ask`;

const SAMPLE_QUESTIONS = [
  "Jak się zalogować?",
  "Jak zmienić hasło?",
  "Jak ustawić harmonogram?",
  "Jak zarządzać galerią plików?"
];

function Chatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);

  const messagesEndRef = useRef(null);

  const toggleChat = () => setOpen((prev) => !prev);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages, open]);

  const sendMessage = async (text) => {
    if (!text.trim()) return;

    setMessages((prev) => [...prev, { type: "user", text }]);
    setInput("");
    setShowSuggestions(false); // ukryj sugestie po pierwszej wiadomości
    setLoading(true);

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: text }),
      });

      const data = await res.json();
      const aiMessage = data.answer || "Brak odpowiedzi";
      setMessages((prev) => [...prev, { type: "ai", text: aiMessage }]);
    } catch (err) {
      console.error("Chatbot error:", err);
      setMessages((prev) => [...prev, { type: "ai", text: "Błąd serwera." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = () => sendMessage(input.trim());

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = (question) => sendMessage(question);

  return (
    <>
      {/* Floating button */}
      <button className={styles.chatButton} onClick={toggleChat}>
        ?
      </button>

      {/* Chat window */}
      {open && (
        <div className={styles.chatWindow}>
          <div className={styles.chatHeader}>
            <span>Chatbot</span>
            <button className={styles.closeButton} onClick={toggleChat}>
              ×
            </button>
          </div>

          <div className={styles.chatBody}>
            {showSuggestions && SAMPLE_QUESTIONS.length > 0 && (
              <div className={styles.suggestions}>
                {SAMPLE_QUESTIONS.map((q, idx) => (
                  <button
                    key={idx}
                    className={styles.suggestionButton}
                    onClick={() => handleSuggestionClick(q)}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={
                  msg.type === "user" ? styles.userMessage : styles.aiMessage
                }
              >
                {msg.text.split("\n").map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>
            ))}
            {loading && (
              <div className={styles.aiMessage}>
                <em>…piszę odpowiedź</em>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className={styles.chatFooter}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Napisz wiadomość..."
              className={styles.chatInput}
              rows={1}
            />
            <button className={styles.sendButton} onClick={handleSend}>
              Wyślij
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default Chatbot;
