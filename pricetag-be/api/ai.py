# api/ai.py
from fastapi import APIRouter
from pydantic import BaseModel
from talk import generate_answer

router = APIRouter()

class QueryRequest(BaseModel):
    query: str

class QueryResponse(BaseModel):
    answer: str

@router.post("/ask", response_model=QueryResponse)
async def ask_ai(request: QueryRequest):
    """
    Endpoint do wysyłania zapytań do lokalnego modelu retrieval.
    """
    answer = generate_answer(request.query)
    return {"answer": answer}
