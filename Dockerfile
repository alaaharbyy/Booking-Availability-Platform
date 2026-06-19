FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts ./
# prisma.config.ts requires DATABASE_URL; generate does not connect to the DB
ENV DATABASE_URL="postgresql://postgres:postgres@localhost:5432/booking-availability-platform"
RUN npx prisma generate

COPY . .

RUN chmod +x docker/entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["sh", "docker/entrypoint.sh"]
CMD ["npm", "start"]
