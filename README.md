# PyLicense
PyLicense is a license validation and management solution for your Python projects. It enables you to check, validate, and manage licenses within your Python applications.

## Usage
```python
# Test application using PyLicense
import pylicense


API_URL = 'http://127.0.0.1:8000/api/licenses' # Enter your pylicense api

def main():
    username = input('username: ')
    password = input('password: ')

    license = pylicense.License(API_URL,app_key='examplekey1')
    operation = pylicense.run(API_URL, username, password, license=license)

    # Controller
    for x in operation: # x: License object
        check = license.check_license(x['key'])
        if check:
            print('License found!')
        else:
            print('License not found!')

if __name__ == '__main__':
    main()
```

## Web API's
> /PyLicense/licensing. Based on Django REST Framework.
```python manage.py runserver```


## Requirements
Do ```pip install -r requirements.txt```

## License
This project is licensed under the GPLv3.0 License. For more information, please see the [LICENSE](LICENSE) file.
