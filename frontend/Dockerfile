# Local-dev image for the Next.js frontend. Source is bind-mounted by compose;
# node_modules and .next live in container volumes so Windows-native binaries
# from a host `npm install` are never used inside Linux.
FROM node:22-slim

ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app
RUN chown node:node /app
USER node

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci && mkdir .next   # pre-create so compose's .next volume is node-owned

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0", "--port", "3000"]
