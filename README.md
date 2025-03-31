# Example Application

1. Edit your **config.json**

```json
{
    "admin_key": "ENTER_YOUR_ADMIN_KEY",
    "database_path": "licensy.db"
  }
```

2. Add licensy your application

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