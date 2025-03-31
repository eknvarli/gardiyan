package licensy

import (
	"encoding/json"
	"fmt"
	"os"
)

type Config struct {
	AdminKey     string `json:"admin_key"`
	DatabasePath string `json:"database_path"`
}

var AppConfig Config

func LoadConfig(filename string) error {
	file, err := os.Open(filename)
	if err != nil {
		return fmt.Errorf("config dosyası açılamadı: %w", err)
	}
	defer file.Close()

	decoder := json.NewDecoder(file)
	err = decoder.Decode(&AppConfig)
	if err != nil {
		return fmt.Errorf("config dosyası okunamadı: %w", err)
	}

	fmt.Println("Config başarıyla yüklendi:", AppConfig)
	return nil
}
