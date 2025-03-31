package main

import (
	"licensy/licensy"
)

func main() {
	db := licensy.CreateDB()
	defer db.Close()

	licensy.CreateTable(db)

	// start api
	licensy.RunServer(8080, db)
}
