FROM node:24-alpine
WORKDIR /app
COPY --chown=node:node app.cjs package.json rules.js range.js ./
COPY --chown=node:node server/ ./server/
COPY --chown=node:node client/ ./client/
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 GAME_DATA_DIR=/data
RUN mkdir /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 3000
CMD ["node", "app.cjs"]
