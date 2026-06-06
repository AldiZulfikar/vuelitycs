package utils

import (
	"crypto/rand"
	"fmt"
)

// GenerateUUID generates a standard RFC4122 UUID v4 string without external dependencies
func GenerateUUID() string {
	uuid := make([]byte, 16)
	_, _ = rand.Read(uuid)
	
	// Set version 4 (pseudorandom)
	uuid[6] = (uuid[6] & 0x0f) | 0x40
	// Set variant (RFC4122)
	uuid[8] = (uuid[8] & 0x3f) | 0x80

	return fmt.Sprintf("%02x%02x%02x%02x-%02x%02x-%02x%02x-%02x%02x-%02x%02x%02x%02x%02x%02x",
		uuid[0], uuid[1], uuid[2], uuid[3],
		uuid[4], uuid[5],
		uuid[6], uuid[7],
		uuid[8], uuid[9],
		uuid[10], uuid[11], uuid[12], uuid[13], uuid[14], uuid[15])
}
