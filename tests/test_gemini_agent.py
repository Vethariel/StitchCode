from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT / "woven"))

import json

from gemini_agent import (  # noqa: E402
    construir_contexto,
    construir_payload_hilo,
    construir_preferencias_estudiante,
    normalizar_perfil,
    normalizar_respuesta_hilo,
    normalizar_respuesta_redaccion,
)


def test_normalizar_json_con_chunks_y_emociones():
    raw = """{
      "chunks": [
        {"text": "Mira la línea 3.", "emotion": "wink"},
        {"text": "¿Qué valor tiene x?", "emotion": "neutral"}
      ]
    }"""
    out = normalizar_respuesta_hilo(raw)
    assert out["type"] == "conversation"
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
    assert "tono: Motivador" in text
    assert "estilo: Con analogías" in text
    assert "objetivos: Aprobar el parcial" in text


def test_normalizar_perfil_aplica_defaults():
    p = normalizar_perfil({"tono": "", "estilo": "Directo", "objetivos": ""})
    assert p["tono"] == "amigable y cercano"
    assert p["estilo"] == "Directo"
    assert p["objetivos"] == "aprender a programar en Woven con buenas prácticas"


def test_payload_gemini_incluye_parametros_perfil():
    perfil = json.dumps(
        {"tono": "Formal", "estilo": "Directo", "objetivos": "Aprobar examen"},
        ensure_ascii=False,
    )
    payload = json.loads(
        construir_payload_hilo(
            "hola",
            "[]",
            "int x = 1",
            "[]",
            "[]",
            False,
            "woven",
            1,
            perfil,
        )
    )
    system_text = payload["system_instruction"]["parts"][0]["text"]
    assert "tono: Formal" in system_text
    assert "estilo: Directo" in system_text
    assert "objetivos: Aprobar examen" in system_text


def test_construir_contexto_modo_bloques():
    ctx = construir_contexto(
        "int x = 1",
        ["1"],
        [],
        False,
        "bloques",
        "Vista: bloques\nL1 · [Declarar]: int x = 1",
    )
    assert "MODO DE VISTA" in ctx
    assert "bloques" in ctx
    assert "PROGRAMA EN BLOQUES" in ctx
    assert "L1 ·" in ctx
    assert "CÓDIGO WOVEN EQUIVALENTE" in ctx


def test_normalizar_explicacion_con_panel():
    raw = json.dumps(
        {
            "type": "explanation",
            "chunks": [
                {
                    "text": "Declaras x.",
                    "emotion": "smile",
                    "panel": "editor",
                    "highlight": {"line": 2},
                },
                {
                    "text": "Sale 5.",
                    "emotion": "wink",
                    "panel": "console",
                    "highlight": {"line": 1},
                },
            ],
        },
        ensure_ascii=False,
    )
    out = normalizar_respuesta_hilo(
        raw,
        codigo="int x = 1\nprint(x)",
        output_json='["5"]',
        modo_vista="texto",
    )
    assert out["type"] == "explanation"
    assert out["chunks"][0]["panel"] == "editor"
    assert out["chunks"][0]["highlight"]["line"] == 2
    assert out["chunks"][1]["panel"] == "console"


def test_normalizar_explicacion_panel_blocks_en_modo_bloques():
    raw = json.dumps(
        {
            "type": "explanation",
            "chunks": [
                {
                    "text": "Bloque L1.",
                    "emotion": "smile",
                    "panel": "blocks",
                    "highlight": {"line": 1},
                }
            ],
        }
    )
    resumen = "Vista: bloques\nL1 · [Declarar]: int x = 1\nL2 · [Mostrar]: print(x)"
    out = normalizar_respuesta_hilo(
        raw,
        codigo="int x = 1\nprint(x)",
        bloques_resumen=resumen,
        modo_vista="bloques",
    )
    assert out["chunks"][0]["panel"] == "blocks"
    assert out["chunks"][0]["highlight"]["line"] == 1


def test_payload_explicacion_incluye_modo_foco():
    payload = json.loads(
        construir_payload_hilo(
            "explícame el código",
            "[]",
            "int x = 1",
            '["1"]',
            "[]",
            False,
            "woven",
            1,
            "{}",
            "explicacion",
        )
    )
    system_text = payload["system_instruction"]["parts"][0]["text"]
    assert "PODER: EXPLICACIÓN" in system_text
    assert 'type "explanation"' in system_text


def test_normalizar_respuesta_redaccion():
    raw = json.dumps(
        {
            "type": "redaccion",
            "codigo": "int x = 1\nprint(x)",
            "objetivo": "ejemplo_correcto",
            "resumen": "variables y print",
        }
    )
    out = normalizar_respuesta_redaccion(raw)
    assert out["codigo"].startswith("int x")
    assert out["objetivo"] == "ejemplo_correcto"


def test_normalizar_explicacion_paneles_traduccion():
    raw = json.dumps(
        {
            "type": "explanation",
            "chunks": [
                {
                    "text": "En Python usa range.",
                    "emotion": "smile",
                    "panel": "python",
                    "highlight": {"line": 2},
                },
                {
                    "text": "En Java van las llaves.",
                    "emotion": "wink",
                    "panel": "java",
                    "highlight": {"line": 4},
                },
            ],
        }
    )
    trad = json.dumps(
        {
            "python": "for i in range(3):\n  pass",
            "java": "for (int i = 0; i < 3; i++) {\n}\n",
            "cpp": "for (int i = 0; i < 3; i++) {}",
        }
    )
    out = normalizar_respuesta_hilo(
        raw,
        traducciones_json=trad,
        modo_vista="texto",
    )
    assert out["type"] == "explanation"
    assert out["chunks"][0]["panel"] == "python"
    assert out["chunks"][0]["highlight"]["line"] == 2
    assert out["chunks"][1]["panel"] == "java"
    assert out["chunks"][1]["highlight"]["line"] <= 3


def test_payload_explicacion_lenguajes_incluye_prompt_traducciones():
    payload = json.loads(
        construir_payload_hilo(
            "compara lenguajes",
            "[]",
            "int x = 1",
            "[]",
            "[]",
            False,
            "woven",
            1,
            "{}",
            "explicacion_lenguajes",
        )
    )
    system_text = payload["system_instruction"]["parts"][0]["text"]
    assert "COMPARACIÓN DE LENGUAJES" in system_text
    assert '"python"' in system_text


def test_normalizar_fallback_texto_plano():
    raw = "Primera frase. Segunda frase."
    out = normalizar_respuesta_hilo(raw)
    assert len(out["chunks"]) >= 2
    assert out["chunks"][0]["text"] == "Primera frase."
