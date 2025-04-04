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
