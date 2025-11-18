FROM oven/bun:latest

RUN apt-get update && apt-get install -y \
    tzdata \
    openssl \
  && ln -fs /usr/share/zoneinfo/Europe/Amsterdam /etc/localtime \
  && dpkg-reconfigure --frontend noninteractive tzdata \
  && apt-get clean

WORKDIR /app

COPY package.json

RUN bun install

COPY . .

RUN bun prisma generate

WORKDIR /app/src

EXPOSE 3144

CMD ["bun", "run", "index.ts"]