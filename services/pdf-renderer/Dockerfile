FROM node:20-alpine

# Install necessary deps for chromium
RUN apk add --no-cache nss freetype harfbuzz ca-certificates ttf-freefont libgcc

WORKDIR /usr/src/app
COPY package.json tsconfig.json ./
COPY src ./src

RUN npm install --production
RUN npm run build

EXPOSE 3001
CMD ["node", "dist/index.js"]
