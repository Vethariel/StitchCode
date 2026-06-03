"""Serialización de valores Woven para la traza (identidad estable para grafos)."""

from interpreter_visitor import NullValue, Value, WovenObject


class TraceValueSerializer:
    """
    Asigna ids estables (o1, l2, …) por identidad Python y rellena heap
    con la definición canónica de cada objeto/lista.
    """

    def __init__(self):
        self.heap = {}
        self._obj_ids = {}

    def reset(self):
        self.heap = {}
        self._obj_ids = {}

    def _alloc_id(self, prefix: str, py_obj) -> str:
        key = id(py_obj)
        if key not in self._obj_ids:
            n = sum(1 for vid in self._obj_ids.values() if vid.startswith(prefix)) + 1
            self._obj_ids[key] = f"{prefix}{n}"
        return self._obj_ids[key]

    def _already_registered(self, py_obj) -> str | None:
        key = id(py_obj)
        return self._obj_ids.get(key)

    def serialize(self, valor):
        if valor is None or isinstance(valor, NullValue):
            return None
        if isinstance(valor, Value):
            return self.serialize(valor.value)

        if isinstance(valor, WovenObject):
            existing = self._already_registered(valor)
            if existing:
                node = {
                    "kind": "object",
                    "id": existing,
                    "class": valor.class_name,
                    "fields": {
                        name: self.serialize(field_val)
                        for name, field_val in valor.fields.items()
                    },
                }
                self.heap[existing] = node
                return {"kind": "ref", "id": existing}
            oid = self._alloc_id("o", valor)
            node = {
                "kind": "object",
                "id": oid,
                "class": valor.class_name,
                "fields": {
                    name: self.serialize(field_val)
                    for name, field_val in valor.fields.items()
                },
            }
            self.heap[oid] = node
            return node

        if isinstance(valor, list):
            existing = self._already_registered(valor)
            if existing:
                node = {
                    "kind": "list",
                    "id": existing,
                    "items": [self.serialize(item) for item in valor],
                }
                self.heap[existing] = node
                return {"kind": "ref", "id": existing}
            lid = self._alloc_id("l", valor)
            node = {
                "kind": "list",
                "id": lid,
                "items": [self.serialize(item) for item in valor],
            }
            self.heap[lid] = node
            return node

        return valor
