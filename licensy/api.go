package licensy

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	_ "modernc.org/sqlite"
)

type Key struct {
	ID  int    `json:"id"`
	Key string `json:"key"`
}

func GetAllKeys(db *sql.DB) ([]Key, error) {
	rows, err := db.Query("SELECT id, key FROM keys")
	if err != nil {
		log.Fatal(err)
		return nil, err
	}
	defer rows.Close()

	var keys []Key

	for rows.Next() {
		var k Key
		err := rows.Scan(&k.ID, &k.Key)
		if err != nil {
			log.Fatal(err)
			return nil, err
		}
		keys = append(keys, k)
	}

	if err = rows.Err(); err != nil {
		log.Fatal(err)
		return nil, err
	}

	return keys, nil
}

func AdminKeyAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		adminKeyHeader := c.GetHeader("Authorization")

		if adminKeyHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header gereklidir"})
			c.Abort()
			return
		}

		if adminKeyHeader != AppConfig.AdminKey {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Geçersiz admin key"})
			c.Abort()
			return
		}

		c.Next()
	}
}

func RunServer(port int, db *sql.DB) {
	r := gin.Default()

	r.Use(AdminKeyAuth())

	fmt.Println("Yüklenen Admin Key:", AppConfig.AdminKey)

	r.GET("/api/keys", func(c *gin.Context) {
		keys, err := GetAllKeys(db)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Veritabanından anahtarlar çekilemedi"})
			return
		}
		c.JSON(http.StatusOK, keys)
	})

	r.GET("/api/keys/:id", func(c *gin.Context) {
		id := c.Param("id")
		keyID, err := strconv.Atoi(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz ID"})
			return
		}

		keys, err := GetAllKeys(db)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Veritabanından anahtarlar çekilemedi"})
			return
		}

		for _, key := range keys {
			if key.ID == keyID {
				c.JSON(http.StatusOK, key)
				return
			}
		}

		c.JSON(http.StatusNotFound, gin.H{"error": "Anahtar bulunamadı"})
	})

	r.POST("/api/keys", func(c *gin.Context) {
		var newKey Key
		if err := c.ShouldBindJSON(&newKey); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		_, err := db.Exec("INSERT INTO keys (key) VALUES (?)", newKey.Key)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Veritabanına anahtar eklenemedi"})
			return
		}

		c.JSON(http.StatusCreated, newKey)
	})

	r.DELETE("/api/keys/:id", func(c *gin.Context) {
		id := c.Param("id")
		keyID, err := strconv.Atoi(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Geçersiz ID"})
			return
		}

		_, err = db.Exec("DELETE FROM keys WHERE id = ?", keyID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Anahtar silinemedi"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Anahtar başarıyla silindi"})
	})

	r.Run(":" + strconv.Itoa(port))
}
