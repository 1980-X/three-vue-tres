FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare yarn@1.22.22 --activate
COPY package.json ./
RUN yarn install
COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src
RUN yarn prisma generate
RUN yarn build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare yarn@1.22.22 --activate
COPY --from=deps /app/package.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/dist ./dist
COPY --from=deps /app/prisma ./prisma
EXPOSE 3000
CMD ["sh", "-c", "yarn prisma migrate deploy && node dist/index.js"]
