package main

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"sync"
	"time"
)

// LoggingConfig represents the logging configuration from logging.json
type LoggingConfig struct {
	Enabled bool          `json:"enabled"`
	Filters []FilterEntry `json:"filters"`
	Outputs struct {
		Console struct {
			Enabled bool `json:"enabled"`
		} `json:"console"`
	} `json:"outputs"`
}

// FilterEntry represents a filter entry in logging.json
type FilterEntry struct {
	Executable string               `json:"executable"`
	Level      string               `json:"level"`
	Categories map[string]bool      `json:"categories"`
}

// Log level priorities
var levelPriorities = map[string]int{
	"trace": 0,
	"debug": 1,
	"info":  2,
	"warn":  3,
	"error": 4,
	"fatal": 5,
}

var (
	logConfig     *LoggingConfig
	configOnce    sync.Once
	configErr     error
)

// loadLoggingConfig loads and parses the logging.json file
func loadLoggingConfig() (*LoggingConfig, error) {
	var err error
	configOnce.Do(func() {
		// Try to find logging.json by checking environment variable or common locations
		var configPath string

		// Check if AIMEOW_LOG_CONFIG env var is set
		if envPath := os.Getenv("AIMEOW_LOG_CONFIG"); envPath != "" {
			configPath = envPath
		} else {
			// Try current directory first
			configPath = "logging.json"
			if _, err := os.Stat(configPath); os.IsNotExist(err) {
				// Try parent directory (in case we're in data/services/whatsapp)
				configPath = "../../logging.json"
				if _, err := os.Stat(configPath); os.IsNotExist(err) {
					// Try going up more directories
					configPath = "../../../logging.json"
					if _, err := os.Stat(configPath); os.IsNotExist(err) {
						// File not found, use default
						logConfig = &LoggingConfig{Enabled: true}
						return
					}
				}
			}
		}

		data, err := os.ReadFile(configPath)
		if err != nil {
			// If file doesn't exist, use default (log everything)
			logConfig = &LoggingConfig{Enabled: true}
			return
		}

		logConfig = &LoggingConfig{}
		err = json.Unmarshal(data, logConfig)
	})

	return logConfig, err
}

// shouldLog determines if a log message should be output based on config
func shouldLog(category string, level LogLevel) bool {
	cfg, err := loadLoggingConfig()
	if err != nil || !cfg.Enabled {
		return false
	}

	if !cfg.Outputs.Console.Enabled {
		return false
	}

	// Find matching filter for this executable
	var filter *FilterEntry
	for _, f := range cfg.Filters {
		if f.Executable == "aimeow" || f.Executable == "*" {
			filter = &f
			break
		}
	}

	if filter == nil {
		return false
	}

	// Check level
	levelStr := strings.ToLower(level.String())
	if filterLevel, ok := levelPriorities[filter.Level]; ok {
		if msgLevel, ok := levelPriorities[levelStr]; ok {
			if msgLevel < filterLevel {
				return false
			}
		}
	}

	// Check categories (case-insensitive)
	categoryMatched := false
	for cat, enabled := range filter.Categories {
		if cat == "*" {
			if enabled {
				categoryMatched = true
				break
			}
		} else if strings.EqualFold(cat, category) {
			return enabled
		}
	}

	return categoryMatched
}

// LogLevel represents the severity level
type LogLevel int

const (
	INFO LogLevel = iota + 30
	WARN
	ERROR
	DEBUG
	TRACE
)

// String returns the string representation of the log level
func (l LogLevel) String() string {
	switch l {
	case INFO:
		return "INFO"
	case WARN:
		return "WARN"
	case ERROR:
		return "ERROR"
	case DEBUG:
		return "DEBUG"
	case TRACE:
		return "TRACE"
	default:
		return "INFO"
	}
}

// Color returns the ANSI color code for the log level
func (l LogLevel) Color() string {
	switch l {
	case INFO:
		return "\x1b[0;36m" // Cyan
	case WARN:
		return "\x1b[0;33m" // Yellow
	case ERROR:
		return "\x1b[0;31m" // Red
	case DEBUG:
		return "\x1b[0;90m" // Gray
	case TRACE:
		return "\x1b[0;90m" // Gray
	default:
		return "\x1b[0;37m" // White
	}
}

// CategoryColor returns the ANSI color code for the category
func categoryColor(category string) string {
	colors := map[string]string{
		"Server":       "\x1b[0;35m", // Magenta
		"Auth":         "\x1b[0;33m", // Yellow
		"Database":     "\x1b[0;32m", // Green
		"WhatsApp":     "\x1b[0;34m", // Blue
		"Webhook":      "\x1b[0;36m", // Cyan
		"Media":        "\x1b[0;37m", // White
		"Client":       "\x1b[0;32m", // Green
		"QR":           "\x1b[0;35m", // Magenta
		"Message":      "\x1b[0;33m", // Yellow
		"Config":       "\x1b[0;36m", // Cyan
		"API":          "\x1b[0;34m", // Blue
		"Router":       "\x1b[0;35m", // Magenta
		"LID":          "\x1b[0;31m", // Red
		"Location":     "\x1b[0;32m", // Green
		"Base64":       "\x1b[0;37m", // White
		"AIMEOW":       "\x1b[0;35m", // Magenta
	}

	if color, ok := colors[category]; ok {
		return color
	}
	return "\x1b[0;37m" // Default white
}

// Logger represents a structured logger
type Logger struct {
	category string
}

// NewLogger creates a new logger with the specified category
func NewLogger(category string) *Logger {
	if category == "" {
		category = "AIMEOW"
	}
	return &Logger{category: category}
}

// log writes a formatted log message
func (l *Logger) log(level LogLevel, format string, args ...interface{}) {
	// Check if this log should be output based on config
	if !shouldLog(l.category, level) {
		return
	}

	now := time.Now()
	timestamp := now.Format("15:04:05.000")
	reset := "\x1b[0m"

	// Format the message
	message := fmt.Sprintf(format, args...)

	// Use executable name instead of level name
	executableName := "AIMEOW"

	// Build the log line
	logLine := fmt.Sprintf("%s %s[%s]%s %s[%s]%s %s\n",
		timestamp,
		level.Color(),
		executableName,
		reset,
		categoryColor(l.category),
		l.category,
		reset,
		message,
	)

	fmt.Fprint(os.Stderr, logLine)
}

// Info logs an info message
func (l *Logger) Info(format string, args ...interface{}) {
	l.log(INFO, format, args...)
}

// Warn logs a warning message
func (l *Logger) Warn(format string, args ...interface{}) {
	l.log(WARN, format, args...)
}

// Error logs an error message
func (l *Logger) Error(format string, args ...interface{}) {
	l.log(ERROR, format, args...)
}

// Debug logs a debug message
func (l *Logger) Debug(format string, args ...interface{}) {
	l.log(DEBUG, format, args...)
}

// Trace logs a trace message
func (l *Logger) Trace(format string, args ...interface{}) {
	l.log(TRACE, format, args...)
}

// Global loggers for different categories
var (
	LogServer   = NewLogger("Server")
	LogAuth     = NewLogger("Auth")
	LogDatabase = NewLogger("Database")
	LogWhatsApp = NewLogger("WhatsApp")
	LogWebhook  = NewLogger("Webhook")
	LogMedia    = NewLogger("Media")
	LogClient   = NewLogger("Client")
	LogQR       = NewLogger("QR")
	LogMessage  = NewLogger("Message")
	LogConfig   = NewLogger("Config")
	LogAPI      = NewLogger("API")
	LogRouter   = NewLogger("Router")
	LogLID      = NewLogger("LID")
	LogLocation = NewLogger("Location")
	LogBase64   = NewLogger("Base64")
)
