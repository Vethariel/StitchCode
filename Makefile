.PHONY: sync generate test

sync:
	uv sync --all-groups

generate:
	cd woven && uv run antlr4 -Dlanguage=Python3 -visitor Woven.g4

test:
	uv run pytest -q
