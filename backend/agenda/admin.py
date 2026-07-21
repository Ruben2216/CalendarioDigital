from django.contrib import admin

from .models import Agrupacion


@admin.register(Agrupacion)
class AgrupacionAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'id_agrupacion')
    search_fields = ('nombre',)
    ordering = ('nombre',)
