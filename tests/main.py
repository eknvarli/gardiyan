# Test application using PyLicense
import pylicense


API_URL = 'https://api.example.com/licenses' # Enter your pylicense api

def main():
    username = input('username: ')
    password = input('password: ')

    pylicense.run(API_URL, username, password)

if __name__ == '__main__':
    pass