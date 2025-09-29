import pickle
import numpy as np
from sentence_transformers import SentenceTransformer
from pathlib import Path

EMBEDDING_FILE = Path(__file__).parent / "embeddings.pkl"
TOP_K = 1  # zwracamy tylko najlepszy blok

# === Wczytanie embeddingów ===
with open(EMBEDDING_FILE, "rb") as f:
    data = pickle.load(f)

blocks = data["blocks"]          # spójny klucz z train.py
embeddings = np.array(data["embeddings"])

# === Ładowanie modelu embeddingowego ===
embedder = SentenceTransformer("all-MiniLM-L6-v2")

def retrieve(query, top_k=TOP_K):
    """Zwraca najlepszy blok instrukcji dla zadanego zapytania"""
    q_emb = embedder.encode([query], convert_to_tensor=False)
    q_emb = np.array(q_emb)
    q_emb = q_emb / np.linalg.norm(q_emb, axis=1, keepdims=True)

    # cosine similarity
    sims = np.dot(embeddings, q_emb[0])
    idxs = sims.argsort()[-top_k:][::-1]

    # zwróć całe bloki
    retrieved = [blocks[i] for i in idxs]
    return retrieved

def generate_answer(query):
    fragments = retrieve(query)
    if not fragments:
        return "Nie znalazłem informacji w dokumentacji."
    
    # zwracamy cały blok jako odpowiedź
    return fragments[0]

# === Test interaktywny ===
if __name__ == "__main__":
    print("Chatbot ready. Wpisz zapytanie:")
    while True:
        q = input("> ")
        print(generate_answer(q))
