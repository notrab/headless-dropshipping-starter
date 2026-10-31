# syntax=docker/dockerfile:1

# Builds the store as a standalone Node server, for bunny.net Magic Containers
# or any other container host.
#
#   bunny apps deploy                       (reads .env from this folder)
#   docker build --platform linux/amd64 -t swag-store .
#   docker run -p 4321:4321 --env-file .env swag-store

FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ENV ASTRO_ADAPTER=node

# The build needs your keys: it loads the catalogue from Printful and bakes the
# Stripe publishable key, store name and SITE_URL into the pages. They come
# from a build secret (CI passes --secret id=env) or a .env in the build folder
# (bunny apps deploy, local builds). Either way they stay in this build stage:
# the image you push only gets the built dist/, which holds no secrets.
RUN --mount=type=secret,id=env,target=/run/secrets/env \
    if [ -f /run/secrets/env ]; then cp /run/secrets/env .env; fi && \
    npm run build && \
    rm -f .env

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4321

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist

USER node
EXPOSE 4321
CMD ["node", "./dist/server/entry.mjs"]
