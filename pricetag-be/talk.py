# talk.py
import pickle
import numpy as np
from sentence_transformers import SentenceTransformer
from pathlib import Path

EMBEDDING_FILE = Path(__file__).parent / "embeddings.pkl"
TOP_K = 5

# === Wczytanie embeddingów ===
with open(EMBEDDING_FILE, "rb") as f:
    data = pickle.load(f)
lines = data["lines"]
embeddings = np.array(data["embeddings"])

# === Load embedding model ===
embedder = SentenceTransformer("all-MiniLM-L6-v2")

def retrieve(query, top_k=TOP_K):
    q_emb = embedder.encode([query], convert_to_tensor=False)
    sims = np.dot(embeddings, q_emb[0])
    idxs = sims.argsort()[-top_k:][::-1]
    retrieved = [lines[i] for i in idxs]
    retrieved = list(dict.fromkeys([line for line in retrieved if len(line) > 10]))
    return retrieved

def generate_answer(query):
    fragments = retrieve(query)
    if not fragments:
        return "Nie znalazłem informacji w dokumentacji."
    answer = "\n"
    for i, frag in enumerate(fragments, 1):
        answer += f"{i}. {frag}\n"
    return answer
