package controller

import (
	"github.com/gin-gonic/gin"

	"github.com/QuantumNous/new-api/service"
)

// GetUpstreamStatus reports whether relaying is currently succeeding, so the
// console can tell users an upstream outage apart from a broken site. It reads a
// snapshot of real traffic and never touches the database, so polling it is cheap.
func GetUpstreamStatus(c *gin.Context) {
	c.JSON(200, gin.H{
		"success": true,
		"message": "",
		"data":    service.SnapshotUpstreamHealth(),
	})
}
