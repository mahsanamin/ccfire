#!/bin/bash
set -e

# Start SSHD in background (needs root)
/usr/sbin/sshd

# Ensure directories are owned by ccfire user
mkdir -p /home/ccfire/.claude /app/outputs
chown -R ccfire:ccfire /home/ccfire/.claude /app/outputs

# Run the app as non-root user
exec su - ccfire -c "cd /app && HOME=/home/ccfire node server.js"
