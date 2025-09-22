FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* .npmrc* ./ 2>/dev/null || true
RUN npm install --production=false
COPY . .
RUN npm run build
EXPOSE 8082
CMD ["npm","start"]
