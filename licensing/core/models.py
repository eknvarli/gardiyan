from django.db import models
from django.contrib.auth.models import User

# Create your models here.
class License(models.Model):
    key = models.CharField(max_length=100, unique=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return self.key


class UsageLog(models.Model):
    license = models.ForeignKey(License, on_delete=models.CASCADE)
    timestamp = models.DateTimeField(auto_now_add=True)
    action = models.CharField(max_length=100)
    
    def __str__(self):
        return f"{self.license.key} - {self.action} at {self.timestamp}"