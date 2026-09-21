# ---------- Dependencias ----------
FROM node:22-alpine AS dependencias
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci

# ---------- Compilacion ----------
FROM node:22-alpine AS compilacion
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY --from=dependencias /app/node_modules ./node_modules
COPY . .
# DATABASE_URL de relleno: en la compilacion no se conecta a la base.
ENV DATABASE_URL="postgresql://usuario:clave@localhost:5432/placeholder"
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npm run build

# ---------- Ejecucion ----------
FROM node:22-alpine AS ejecucion
WORKDIR /app
RUN apk add --no-cache openssl && addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=compilacion /app/public ./public
COPY --from=compilacion --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=compilacion --chown=nextjs:nodejs /app/.next/static ./.next/static
# Prisma CLI y esquema para poder aplicar migraciones al arrancar.
COPY --from=compilacion /app/prisma ./prisma
COPY --from=compilacion /app/node_modules/prisma ./node_modules/prisma
COPY --from=compilacion /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=compilacion /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=compilacion /app/node_modules/.bin ./node_modules/.bin
USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
