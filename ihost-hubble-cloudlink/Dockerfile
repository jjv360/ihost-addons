# Source OS
FROM node:lts

# Copy source code
WORKDIR /app
COPY . .

# Install dependencies
RUN npm install --verbose

# Run app
ENV PORT=9009
EXPOSE $PORT
ENV IHOST_URL=http://host.docker.internal
ENTRYPOINT ["npm", "start"]