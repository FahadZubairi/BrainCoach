# The API (backend/). Built from the repo root because the backend compiles shared/api.ts too.
# The web app (frontend/) deploys separately, e.g. on Vercel.
FROM node:22-alpine AS build
WORKDIR /app
COPY backend/package.json backend/package-lock.json backend/
RUN cd backend && npm ci
COPY shared shared
COPY backend backend
RUN cd backend && npm run build && npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app/backend
ENV NODE_ENV=production
COPY --from=build /app/backend/node_modules node_modules
COPY --from=build /app/backend/dist dist
COPY --from=build /app/backend/package.json package.json
EXPOSE 5000
CMD ["node", "dist/backend/src/index.js"]
