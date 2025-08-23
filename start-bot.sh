#!/bin/bash

# Telegram Bot Startup Script
# This script ensures only one instance of the bot runs at a time

BOT_DIR="/Users/machd/Desktop/linebot"
PID_FILE="$BOT_DIR/bot.pid"
LOG_FILE="$BOT_DIR/logs/startup.log"

# Create logs directory if it doesn't exist
mkdir -p "$BOT_DIR/logs"

echo "$(date): Starting Telegram Bot..." >> "$LOG_FILE"

# Function to stop existing bot
stop_bot() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p $PID > /dev/null 2>&1; then
            echo "$(date): Stopping existing bot process (PID: $PID)..." >> "$LOG_FILE"
            kill -TERM $PID
            sleep 3
            
            # Force kill if still running
            if ps -p $PID > /dev/null 2>&1; then
                echo "$(date): Force killing bot process..." >> "$LOG_FILE"
                kill -9 $PID
            fi
        fi
        rm -f "$PID_FILE"
    fi
    
    # Kill any remaining Node.js processes in our directory
    pkill -f "src/app.js" || true
    sleep 2
}

# Function to start bot
start_bot() {
    cd "$BOT_DIR"
    echo "$(date): Starting new bot process..." >> "$LOG_FILE"
    
    # Clear webhook before starting
    echo "$(date): Clearing Telegram webhook..." >> "$LOG_FILE"
    curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN:-8259248144:AAFK5pPpg9hvHxd-8-bbo4WTpdyv_xeWGbk}/deleteWebhook" \
         -d "drop_pending_updates=true" >> "$LOG_FILE" 2>&1
    
    sleep 2
    
    # Start the bot
    nohup node src/app.js >> "$LOG_FILE" 2>&1 &
    BOT_PID=$!
    
    echo $BOT_PID > "$PID_FILE"
    echo "$(date): Bot started with PID: $BOT_PID" >> "$LOG_FILE"
}

# Main execution
case "${1:-start}" in
    "start")
        echo "$(date): Bot startup requested" >> "$LOG_FILE"
        stop_bot
        start_bot
        echo "Bot started successfully! Check logs at: $LOG_FILE"
        ;;
    "stop")
        echo "$(date): Bot stop requested" >> "$LOG_FILE"
        stop_bot
        echo "Bot stopped successfully!"
        ;;
    "restart")
        echo "$(date): Bot restart requested" >> "$LOG_FILE"
        stop_bot
        start_bot
        echo "Bot restarted successfully! Check logs at: $LOG_FILE"
        ;;
    "status")
        if [ -f "$PID_FILE" ]; then
            PID=$(cat "$PID_FILE")
            if ps -p $PID > /dev/null 2>&1; then
                echo "Bot is running (PID: $PID)"
            else
                echo "Bot is not running (stale PID file)"
                rm -f "$PID_FILE"
            fi
        else
            echo "Bot is not running"
        fi
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status}"
        exit 1
        ;;
esac