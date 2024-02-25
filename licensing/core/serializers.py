from rest_framework import serializers
from .models import License, UsageLog
from django.contrib.auth.models import User

# ...
class LicenseSerializer(serializers.ModelSerializer):
    class Meta:
        model = License
        fields = ['id', 'key', 'user', 'created_at', 'updated_at']


class UsageLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = UsageLog
        fields = ['id', 'license', 'timestamp', 'action']



class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email']