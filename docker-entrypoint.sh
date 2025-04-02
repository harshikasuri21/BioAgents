#!/bin/sh
set -e

# Run database migrations
echo "Running database migrations..."
pnpm db:migrate

# Start the application
echo "Starting the application..."
exec pnpm start 