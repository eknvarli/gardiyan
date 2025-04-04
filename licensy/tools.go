package licensy

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
)

func IsKeyFound(apiURL, key, adminKey string) bool {
	url := fmt.Sprintf("%s/api/keys/check/%s", apiURL, key)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		log.Println("İstek oluşturulamadı:", err)
		return false
	}

	req.Header.Set("Authorization", adminKey)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		log.Println("API isteği başarısız:", err)
		return false
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Printf("API hata döndürdü: %s\n", resp.Status)
		return false
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Println("Yanıt okunamadı:", err)
		return false
	}

	var result struct {
		Valid bool `json:"valid"`
	}

	err = json.Unmarshal(body, &result)
	if err != nil {
		log.Println("JSON ayrıştırma hatası:", err)
		return false
	}

	return result.Valid
}
