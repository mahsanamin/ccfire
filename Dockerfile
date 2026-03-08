FROM node:22-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends openssh-server curl ca-certificates sudo && \
    rm -rf /var/lib/apt/lists/*

# Configure SSHD
RUN mkdir -p /run/sshd && \
    sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config && \
    sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code

# Create non-root user for running claude
RUN useradd -m -s /bin/bash ccfire && \
    echo "ccfire:ccfire" | chpasswd && \
    echo "root:ccfire" | chpasswd

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY server.js index.html ./

RUN chown -R ccfire:ccfire /app

EXPOSE 8283 22

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
