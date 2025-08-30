# License


class License:
    def __init__(self, license_ip, app_key):
        self.license_ip = license_ip
        self.app_key = app_key

    def check_license(self, object):
        if self.app_key in object:
            # License found
            return True
        else:
            # License not found
            return False
