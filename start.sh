#!/bin/bash

# radikorec startup script

# Set UID and GID to current user's, or default to 1000
export UID=$(id -u)
export GID=$(id -g)

echo "Setting up radikorec..."
echo "UID = ${UID}, GID = ${GID}"

# Create directories if they don't exist
mkdir -p ./data
mkdir -p ./public/records

# Change ownership to the current user (requires sudo if running as a normal user and directories are owned by root)
# Alternatively, since we create them as the current user, they will belong to the current user.
# But if they were already created by root (Docker daemon), we might need sudo.
if [ -d "./data" ] && [ "$(stat -c '%u' ./data)" != "${UID}" ]; then
  echo "Changing ownership of ./data to ${UID}:${GID} (may require sudo password)"
  sudo chown -R ${UID}:${GID} ./data
fi

if [ -d "./public/records" ] && [ "$(stat -c '%u' ./public/records)" != "${UID}" ]; then
  echo "Changing ownership of ./public/records to ${UID}:${GID} (may require sudo password)"
  sudo chown -R ${UID}:${GID} ./public/records
fi

echo "Starting Docker Compose..."
docker compose up -d --build

echo "Done!"
