import uuid

from django.db import models


class UniqueIdentifierField(models.UUIDField):
    def db_type(self, connection):
        return "uniqueidentifier"

    def rel_db_type(self, connection):
        # Tipo que usan las claves foráneas que apuntan a este campo.
        return "uniqueidentifier"

    def get_db_prep_value(self, value, connection, prepared=False):
        if value is None:
            return None
        if not isinstance(value, uuid.UUID):
            value = uuid.UUID(str(value))
        return str(value)
