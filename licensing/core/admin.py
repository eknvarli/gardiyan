from django.contrib import admin
from .models import License, UsageLog

# Register your models here.
admin.site.register(License)
admin.site.register(UsageLog)