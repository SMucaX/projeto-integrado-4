=============================================================
   INSTRUÇÕES DE EXECUÇÃO DA API (RANDOM FOREST / FASTAPI)
=============================================================

1. PRÉ-REQUISITOS:
   Ter o Python 3.10+ instalado no computador.

2. CRIAR E ATIVAR O AMBIENTE VIRTUAL (Recomendado):
   # No Windows (PowerShell/CMD):
   python -m venv venv
   venv\Scripts\activate

   # No Linux/Mac:
   python3 -m venv venv
   source venv/bin/activate

3. INSTALAR AS DEPENDÊNCIAS NECESSÁRIAS:
   pip install fastapi uvicorn pandas joblib scikit-learn

4. INICIAR O SERVIDOR DA API:
   uvicorn main:app --reload --port 8000

5. ACESSAR NO NAVEGADOR:
   - Status da API: http://127.0.0.1:8000
   - Documentação interativa (Swagger UI): http://127.0.0.1:8000/docs
   - Documentação alternativa (Redoc): http://127.0.0.1:8000/redoc

Observação: Mantenha o terminal da API aberto enquanto utilizar o frontend (index.html) para que as requisições de previsão sejam processadas com sucesso.