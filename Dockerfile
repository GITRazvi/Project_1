FROM node:24-alpine

WORKDIR /app

# Install workspace dependencies before copying source code so Docker can reuse
# this layer when only application files change.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci

COPY . .

EXPOSE 3001 5173

CMD ["npm", "run", "dev"]
