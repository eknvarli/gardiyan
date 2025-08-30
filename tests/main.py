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