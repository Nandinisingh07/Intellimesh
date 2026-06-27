import ollama
from loguru import logger
from backend.config import settings

class RAGGenerator:
    def __init__(self):
        self.model = "phi3:mini"
        logger.info(f"RAGGenerator initialized with model: {self.model}")

    def generate(self, query: str, context_chunks: list[str]) -> dict:
        if not context_chunks:
            return {"answer": "No relevant documents found in the knowledge base.", "sources": []}
        
        context = "\n\n".join(f"[{i+1}] {chunk}" for i, chunk in enumerate(context_chunks))
        prompt = f"""You are IntelliMesh, a secure AI assistant. Answer ONLY from the provided context. Do not hallucinate.

Guidelines:
- Be extremely concise. Prioritize direct facts over narrative.
- Avoid repetitive content and generic filler text.
- Do NOT use boilerplate AI language (e.g. "Based on the provided documents...", "Here is the summary..."). Start directly with the answer.
- If a query asks for contradictions, risks, or gaps, list only what is explicitly supported by the context.

CONTEXT:
{context}

QUESTION: {query}

ANSWER:"""

        logger.info(f"Generating answer for query: {query[:50]}...")
        response = ollama.chat(
            model=self.model,
            messages=[{"role": "user", "content": prompt}]
        )
        answer = response["message"]["content"]
        logger.info("Generation complete")
        return {"answer": answer}

_generator = None

def get_generator() -> RAGGenerator:
    global _generator
    if _generator is None:
        _generator = RAGGenerator()
    return _generator
