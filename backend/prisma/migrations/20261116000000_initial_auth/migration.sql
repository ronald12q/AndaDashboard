-- Generated with prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script.
CREATE SCHEMA IF NOT EXISTS "public";
CREATE TABLE "Citizen" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "dui" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Citizen_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Administrator" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Administrator_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Citizen_email_key" ON "Citizen"("email");
CREATE UNIQUE INDEX "Citizen_dui_key" ON "Citizen"("dui");
CREATE UNIQUE INDEX "Administrator_email_key" ON "Administrator"("email");
