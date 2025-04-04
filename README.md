# Licensy

## Server-side

1. Edit your **config.json**

```json
{
    "admin_key": "ENTER_YOUR_ADMIN_KEY",
    "database_path": "licensy.db"
  }
```

2. Create your API server

```go
package main

import (
	"fmt"
	"licensy/licensy"
	"log"
)

func main() {
	err := licensy.LoadConfig("config.json")
	if err != nil {
		log.Fatal("Config yüklenemedi:", err)
	}

	fmt.Println("Admin Key:", licensy.AppConfig.AdminKey)

	db := licensy.CreateDB()
	defer db.Close()

	licensy.CreateTable(db)

	// run api
	licensy.RunServer(8080, db)
}
```

## Example application

```go
// Example application
package main

import (
	"fmt"
	"licensy/licensy"
)

func main() {
	apiURL := "http://localhost:8080"
	adminKey := "ENTER_YOUR_ADMIN_KEY"

	keyToCheck := "test1"
	if licensy.IsKeyFound(apiURL, keyToCheck, adminKey) {
		fmt.Println("Key geçerli")
	} else {
		fmt.Println("Key geçersiz!")
	}
}
```