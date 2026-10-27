FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN yarn install --frozen-lockfile=false
COPY tsconfig.json ./
COPY src ./src
RUN yarn build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/package.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
