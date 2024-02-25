from rest_framework import viewsets
from .models import License, UsageLog
from .serializers import LicenseSerializer, UsageLogSerializer


# ...
class LicenseViewSet(viewsets.ModelViewSet):
    queryset = License.objects.all()
    serializer_class = LicenseSerializer


class UsageLogViewSet(viewsets.ModelViewSet):
    queryset = UsageLog.objects.all()
    serializer_class = UsageLogSerializer