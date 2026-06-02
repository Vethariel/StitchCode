from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT / "woven"))

from gemini_agent import construir_preferencias_estudiante, normalizar_respuesta_hilo  # noqa: E402


def test_normalizar_json_con_chunks_y_emociones():
    raw = """{
      "chunks": [
        {"text": "Mira la línea 3.", "emotion": "wink"},
        {"text": "¿Qué valor tiene x?", "emotion": "neutral"}
      ]
    }"""
    out = normalizar_respuesta_hilo(raw)
    assert len(out["chunks"]) == 2
    assert out["chunks"][0]["emotion"] == "wink"
    assert "texto_completo" in out
    assert "Mira la línea 3." in out["texto_completo"]


def test_normalizar_emocion_invalida_usa_neutral():
    raw = '{"chunks": [{"text": "Hola.", "emotion": "mega_happy"}]}'
    out = normalizar_respuesta_hilo(raw)
    assert out["chunks"][0]["emotion"] == "neutral"


def test_construir_preferencias_estudiante():
    raw = '{"tono": "Motivador", "estilo": "Con analogías", "objetivos": "Aprobar el parcial"}'
    text = construir_preferencias_estudiante(raw)
    assert "Motivador" in text
    assert "analogías" in text
    assert "parcial" in text


def test_normalizar_fallback_texto_plano():
    raw = "Primera frase. Segunda frase."
    out = normalizar_respuesta_hilo(raw)
    assert len(out["chunks"]) >= 2
    assert out["chunks"][0]["text"] == "Primera frase."
