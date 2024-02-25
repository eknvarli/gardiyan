# PyLicense
PyLicense is a license validation and management solution for your Python projects. It enables you to check, validate, and manage licenses within your Python applications.

## Usage
```python
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
```

## Web API's
> /PyLicense/licensing. Based on Django REST Framework.
```python manage.py runserver```


## Requirements
Do ```pip install -r requirements.txt```

## License
This project is licensed under the GPLv3.0 License. For more information, please see the [LICENSE](LICENSE) file.
