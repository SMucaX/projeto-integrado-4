from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import joblib
import pandas as pd

app = FastAPI(title="API de Previsão de Cobertura Vacinal")

# Liberta o acesso para o teu site (evita bloqueio de CORS no browser)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Carrega os artefactos exportados
modelo = joblib.load("modelo_random_forest.joblib")
colunas_modelo = joblib.load("features_colunas.joblib")

class EntradaPrevisao(BaseModel):
    lag_cobertura: float = Field(..., description="Cobertura do mês anterior")
    mes_numero: int = Field(..., ge=1, le=12, description="Mês de 1 a 12")
    imunobiologico: str = Field(..., description="Nome da vacina")

@app.post("/predict")
def prever(dados: EntradaPrevisao):
    try:
        linha = {col: 0.0 for col in colunas_modelo}
        linha["lag_cobertura"] = dados.lag_cobertura
        linha["mes_numero"] = dados.mes_numero

        nome_dummy = f"imunobiologico_{dados.imunobiologico.strip().title()}"
        if nome_dummy in linha:
            linha[nome_dummy] = 1

        df_input = pd.DataFrame([linha])[colunas_modelo]
        predicao = modelo.predict(df_input)[0]

        return {
            "imunobiologico": dados.imunobiologico,
            "mes": dados.mes_numero,
            "cobertura_prevista": round(float(predicao), 2)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))