package model

import (
	"sync"

	"github.com/QuantumNous/new-api/common"

	"github.com/bytedance/gopkg/util/gopool"
	"gorm.io/gorm"
)

// Log rows are inserted from a queue rather than from the request that produced
// them. One insert and its commit cost several milliseconds, and a caller that
// waits for it also waits before its own response leaves, because a small body
// sits in the writer's buffer until the handler returns. Queueing the row moves
// that cost off the request path; the flusher then fills a batch from whatever
// piled up, so a busy gateway writes many rows per commit.
//
// A row remembers the database it was created for, so swapping LOG_DB (as the
// tests do) cannot send a row to the wrong connection.

const (
	// Rows held in memory before a caller writes its own row instead.
	logWriteQueueSize = 4096
	// Rows per INSERT. Larger batches amortise the commit further, but they also
	// delay an individual row when the queue is shallow.
	logWriteBatchSize = 128
)

type queuedLog struct {
	row *Log
	db  *gorm.DB
}

var (
	logBuffer      []queuedLog
	logBufferMu    sync.Mutex
	logFlushSignal = make(chan struct{}, 1)
	logFlushOnce   sync.Once
	// Serialises inserts so a flush waits for the batch already in flight.
	logInsertMu sync.Mutex
)

// enqueueLog hands a row to the flusher. A full queue means the writer is
// behind, and then the caller writes its own row: a slow log must never cost a
// row.
func enqueueLog(log *Log) error {
	ensureLogRequestId(log)
	db := LOG_DB
	if db == nil {
		return createLog(log)
	}
	logFlushOnce.Do(startLogFlusher)

	logBufferMu.Lock()
	if len(logBuffer) >= logWriteQueueSize {
		logBufferMu.Unlock()
		return createLog(log)
	}
	logBuffer = append(logBuffer, queuedLog{row: log, db: db})
	logBufferMu.Unlock()

	select {
	case logFlushSignal <- struct{}{}:
	default:
	}
	return nil
}

func startLogFlusher() {
	gopool.Go(func() {
		for range logFlushSignal {
			for {
				batch := takeLogBatch()
				if len(batch) == 0 {
					break
				}
				insertLogs(batch)
			}
		}
	})
}

func takeLogBatch() []queuedLog {
	logBufferMu.Lock()
	defer logBufferMu.Unlock()
	if len(logBuffer) == 0 {
		return nil
	}
	count := min(len(logBuffer), logWriteBatchSize)
	batch := make([]queuedLog, count)
	copy(batch, logBuffer[:count])
	logBuffer = logBuffer[count:]
	if len(logBuffer) == 0 {
		logBuffer = nil
	}
	return batch
}

// insertLogs writes a batch, grouping the rows that share a database so one
// commit covers as many as possible.
func insertLogs(batch []queuedLog) {
	if len(batch) == 0 {
		return
	}
	logInsertMu.Lock()
	defer logInsertMu.Unlock()
	for start := 0; start < len(batch); {
		db := batch[start].db
		end := start
		rows := make([]*Log, 0, len(batch)-start)
		for end < len(batch) && batch[end].db == db {
			rows = append(rows, batch[end].row)
			end++
		}
		if err := db.CreateInBatches(rows, len(rows)).Error; err != nil {
			common.SysError(common.LogText("failed to write %d log rows: %s", len(rows), err.Error()))
		}
		start = end
	}
}

// FlushLogQueue writes every queued row before returning. Shutdown relies on it
// so a restart does not drop the rows still in memory, and tests that read a
// consume log call it to wait for the write they just caused.
func FlushLogQueue() {
	logFlushOnce.Do(startLogFlusher)
	for {
		batch := takeLogBatch()
		if len(batch) == 0 {
			return
		}
		insertLogs(batch)
	}
}
