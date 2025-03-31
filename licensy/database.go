package licensy

import (
	"database/sql"
	"fmt"
	"log"

	_ "modernc.org/sqlite"
)

func CreateDB() *sql.DB {
	db, err := sql.Open("sqlite", "licensy.db")
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println("Veritabanı bağlantısı başarılı!")
	return db
}

func CreateTable(db *sql.DB) {
	createTableSQL := `CREATE TABLE IF NOT EXISTS keys (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		key TEXT NOT NULL
	);`

	_, err := db.Exec(createTableSQL)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println("Tablo başarıyla oluşturuldu.")
}
