FROM node:20-alpine

WORKDIR /app

RUN npm i -g pnpm@10

ENV npm_config_unsafe_perm=true
ENV PNPM_IGNORE_SCRIPTS=false

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --force --no-frozen-lockfile

COPY . .

EXPOSE 3001

CMD ["pnpm", "dev"]
