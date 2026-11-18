FROM mcr.microsoft.com/playwright:v1.49.0-noble

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

CMD ["node", "g1-service.mjs"]
