FROM node:20-slim

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY dist/ ./dist/

ENV WEB2MD_API_KEY=demo
ENV WEB2MD_API_URL=https://web2md.org/api

ENTRYPOINT ["node", "dist/index.js"]
