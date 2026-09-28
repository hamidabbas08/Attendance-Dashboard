FROM node:20-slim
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
# next.config.js bakes the /api rewrite in at build time; api.pod is the backend pod.
ARG BACKEND_URL=http://api.pod:4000
ENV BACKEND_URL=$BACKEND_URL NODE_ENV=production
RUN npm run build
EXPOSE 5173
CMD ["npx", "next", "start", "-p", "5173", "-H", "0.0.0.0"]
