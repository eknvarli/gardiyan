# PyLicense | Open source licensing solution for Python projects

import requests
from lib.license import License


# License checker
def run(api_url):
    username = input('username: ')
    password = input('password: ')

    response = requests.get(api_url, auth=(username,password))
    main = License(api_url,app_key='examplekey1')

    # check status
    if response.status_code == 200:
        data = response.json()

        for x in data:
            main.check_license(x['key'])
    else:
        print('API Error: ', response.status_code)


# run checker
if __name__ == '__main__':
    run(
        'http://127.0.0.1:8000/api/licenses/', # Enter your licenses link
    )