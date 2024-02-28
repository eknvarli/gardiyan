# PyLicense | Open source licensing solution for Python projects

import requests

# License checker
def run(api_url, username, password, license):
    response = requests.get(api_url, auth=(username,password))

    # check status
    if response.status_code == 200:
        data = response.json()

        return data
    else:
        print('API Error: ', response.status_code)