FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production DATA_DIR=/data PORT=3000
# Bản Docker/SQLite chỉ cần web-push; Next.js, React, postgres chỉ dùng khi deploy lên Vercel.
RUN echo '{"name":"remi-legacy","private":true,"dependencies":{"web-push":"^3.6.7"}}' > package.json \
 && npm install --omit=dev
COPY lib ./lib
COPY server ./server
COPY web ./web
RUN mkdir -p /data && chown -R node:node /data
VOLUME /data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--disable-warning=ExperimentalWarning", "server/index.js"]
