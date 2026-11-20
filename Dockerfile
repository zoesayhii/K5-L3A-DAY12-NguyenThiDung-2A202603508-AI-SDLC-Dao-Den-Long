# Chua kiem thu trong moi truong lam viec (khong co Docker). Chay: docker build -t dao-den-long . && docker run -p 8080:8080 dao-den-long
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server.mjs game.contract.json ./
COPY server ./server
COPY sim ./sim
COPY web ./web
EXPOSE 8080
VOLUME ["/app/data"]
CMD ["node", "server.mjs", "8080"]
